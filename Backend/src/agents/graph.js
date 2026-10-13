const { StateGraph, Annotation, START, END } = require("@langchain/langgraph");
const { AGENTS, SPECIALISTS, describeCall, runAgent } = require("./agents");
const tools = require("./tools");
const { withContext } = require("./tools/context");
const { compareSkills } = require("./tools/calculateSkillGaps.tool");
const { applyEdits } = require("./tools/applyResumeEdits.tool");
const { validateClaims } = require("./tools/validateResumeClaims.tool");
const { assessResumeQuality } = require("./tools/validateResumeQuality.tool");
const { MAX_RESUME_CHARS } = require("./tools/extractResume.tool");
const { searchResumeLocally } = require("./tools/retrieveResumeEvidence.tool");
const { buildTokenSet, termSupported, tokenize, uniqueStrings } = require("./text");
const { findImplyingTools, quoteToolLine } = require("./impliedSkills");

const getMaxRevisions = () => Math.max(0, Number(process.env.AGENT_MAX_REVISIONS ?? 1) || 0);

const DEFAULT_OBJECTIVES = {
  resume_analyst: "Read the resume and collect evidence for the job's requirements.",
  job_match: "Compare the job's requirements with the evidence and find the skill gaps.",
  optimizer: "Propose resume edits that use only verified facts.",
  reviewer: "Validate every proposed edit and the resume's overall quality.",
};

// Everything the agents share. Each channel keeps the last value written to it.
const RunState = Annotation.Root({
  goal: Annotation(),
  plan: Annotation(),
  next: Annotation(),
  jobAnalysis: Annotation(),
  candidateProfile: Annotation(),
  skillGaps: Annotation(),
  edits: Annotation(),
  review: Annotation(),
  quality: Annotation(),
  revisionCount: Annotation(),
  revisionInstructions: Annotation(),
  summary: Annotation(),
});

const getRun = (config) => config.configurable.run;

function makeContext(run, state, extra = {}) {
  return {
    userId: run.userId,
    sourceId: run.sourceId,
    resumeText: run.resumeText,
    jobDescription: run.jobDescription,
    usage: run.usage,
    emit: run.emit,
    jobAnalysis: state.jobAnalysis,
    candidateProfile: state.candidateProfile,
    skillGaps: state.skillGaps,
    outbox: {},
    ...extra,
  };
}

const list = (items, empty = "none") => (items?.length ? items.join(", ") : empty);
const getObjective = (state, agent) =>
  state.plan.find((step) => step.agent === agent && step.status === "running")?.objective ||
  DEFAULT_OBJECTIVES[agent];
const completeStep = (plan, agent) =>
  plan.map((step) =>
    step.agent === agent && step.status === "running" ? { ...step, status: "done" } : step,
  );
/* ------------------------------ Supervisor ------------------------------ */

// The model chooses which specialists the goal needs; the order and the
// prerequisites of each one are fixed by what their inputs depend on.
function normalizePlan(requested = []) {
  const wanted = new Set(
    requested.map((step) => step.agent).filter((agent) => SPECIALISTS.includes(agent)),
  );
  if (wanted.size === 0) SPECIALISTS.forEach((agent) => wanted.add(agent));
  if (wanted.has("reviewer")) wanted.add("optimizer");
  if (wanted.has("optimizer")) SPECIALISTS.forEach((agent) => wanted.add(agent));
  if (wanted.has("job_match")) wanted.add("resume_analyst");

  return SPECIALISTS.filter((agent) => wanted.has(agent)).map((agent) => ({
    agent,
    objective:
      requested.find((step) => step.agent === agent)?.objective?.trim() || DEFAULT_OBJECTIVES[agent],
    status: "pending",
  }));
}

function startNextStep(plan) {
  const index = plan.findIndex((step) => step.status === "pending");
  if (index === -1) return null;

  return {
    plan: plan.map((step, i) => (i === index ? { ...step, status: "running" } : step)),
    next: plan[index].agent,
  };
}

function describeProgress(state) {
  const lines = [`User goal: ${state.goal}`];
  lines.push(`Completed: ${state.plan.map((step) => step.agent).join(" → ")}`);

  if (state.skillGaps) {
    lines.push(
      `Skill coverage: ${state.skillGaps.matchScore}% of the job's skills are backed by the resume. Missing required skills: ${list(
        state.skillGaps.missing.filter((gap) => gap.severity === "high").map((gap) => gap.skill),
      )}.`,
    );
  }

  if (state.review) {
    const accepted = state.edits.filter((edit) => edit.status === "accepted").length;
    const rejected = state.edits.filter(
      (edit) => edit.status === "rejected" && edit.round === state.revisionCount,
    );
    lines.push(`Reviewer verdict: ${state.review.verdict}. Feedback: ${state.review.feedback || "none"}`);
    lines.push(`Edits accepted so far: ${accepted}.`);
    lines.push(
      `Edits rejected this round: ${
        rejected.length
          ? rejected.map((edit) => `\n- ${edit.section}: ${edit.reviewNote}`).join("")
          : "none"
      }`,
    );
  }

  if (state.quality) {
    lines.push(`Resume quality score: ${state.quality.score}. Issues: ${list(state.quality.issues)}.`);
  }

  return lines.join("\n");
}

async function supervisorNode(state, config) {
  const run = getRun(config);

  // 1. No plan yet: understand the job and decide who works on the goal.
  if (!state.plan?.length) {
    const ctx = makeContext(run, state);
    await runAgent(AGENTS.planner, {
      ctx,
      input: [
        `User goal: ${state.goal}`,
        `Resume: available (${run.resumeText.length} characters).`,
        "Job description: available.",
        "Call analyze_job_description to understand the job and create_plan to choose the specialists. You may call both in the same turn.",
      ].join("\n"),
    });

    if (!ctx.jobAnalysis) {
      const result = await tools.analyzeJobDescription.invoke({}, withContext(ctx));
      if (result.error) throw new Error(result.error);
      await run.emit({
        agent: "supervisor",
        type: "fallback",
        tool: "analyze_job_description",
        summary: describeCall("analyze_job_description", {}, result),
      });
    }

    const plan = normalizePlan(ctx.outbox.plan);
    const requested = (ctx.outbox.plan || []).map((step) => step.agent).join(",");
    if (requested !== plan.map((step) => step.agent).join(",")) {
      await run.emit({
        agent: "supervisor",
        type: "fallback",
        summary: `Plan set to ${plan.map((step) => step.agent).join(" → ")} so each specialist has the inputs it depends on`,
      });
    }

    return { jobAnalysis: ctx.jobAnalysis, ...startNextStep(plan) };
  }

  // 2. Planned work remains: hand over to the next specialist.
  const handoff = startNextStep(state.plan);
  if (handoff) return handoff;

  // 3. The plan is done: revise once more, or finish.
  const maxRevisions = getMaxRevisions();
  const canRevise =
    state.review?.verdict === "revise" && (state.revisionCount || 0) < maxRevisions;
  const ctx = makeContext(run, state);
  const agent = canRevise
    ? AGENTS.supervisor
    : { ...AGENTS.supervisor, tools: AGENTS.supervisor.tools.filter((item) => item.name === "finish") };

  await runAgent(agent, {
    ctx,
    input: [
      describeProgress(state),
      state.review
        ? `Revision rounds used: ${state.revisionCount || 0} of ${maxRevisions}.`
        : "No resume edits were part of this plan.",
      canRevise ? "Decide: request_revision or finish." : "Call finish with the summary for the candidate.",
    ].join("\n"),
  });

  if (canRevise && ctx.outbox.revision) {
    const plan = [
      ...state.plan,
      { agent: "optimizer", objective: ctx.outbox.revision, status: "pending" },
      { agent: "reviewer", objective: DEFAULT_OBJECTIVES.reviewer, status: "pending" },
    ];
    return {
      revisionCount: (state.revisionCount || 0) + 1,
      revisionInstructions: ctx.outbox.revision,
      ...startNextStep(plan),
    };
  }

  return {
    next: "finish",
    summary: ctx.outbox.summary || "The agents finished working on your resume.",
  };
}

/* ---------------------------- Resume Analyst ---------------------------- */

// A quote counts as evidence only when most of its words are in the resume.
function isQuoteFromResume(quote, resumeTokens) {
  const words = tokenize(quote);
  if (words.length < 2) return false;
  return words.filter((word) => resumeTokens.has(word)).length / words.length >= 0.7;
}

async function resumeAnalystNode(state, config) {
  const run = getRun(config);
  const ctx = makeContext(run, state);
  const job = state.jobAnalysis;

  await runAgent(AGENTS.resume_analyst, {
    ctx,
    input: [
      `Objective: ${getObjective(state, "resume_analyst")}`,
      `Target job: ${job.title}`,
      `Required skills: ${list(job.requiredSkills)}`,
      `Preferred skills: ${list(job.preferredSkills)}`,
      `Main responsibilities: ${list(job.responsibilities)}`,
    ].join("\n"),
  });

  const resumeTokens = buildTokenSet(run.resumeText);
  let profile = ctx.outbox.profile;

  if (!profile) {
    // The agent never reported back: fall back to the job skills the resume names outright.
    const named = uniqueStrings([...job.requiredSkills, ...job.preferredSkills]).filter((skill) =>
      termSupported(skill, resumeTokens),
    );
    profile = {
      summary: "",
      highlights: [],
      skills: named.map((name) => ({
        name,
        evidence: searchResumeLocally(run.resumeText, name, 1)[0]?.split("\n")[0] || "",
      })),
    };
    await run.emit({
      agent: "resume_analyst",
      type: "fallback",
      summary: `No profile was submitted, so ${named.length} skills named in the resume were used`,
    });
  }

  const skills = profile.skills.map((skill) => ({
    name: skill.name,
    evidence: skill.evidence,
    verified:
      termSupported(skill.name, resumeTokens) || isQuoteFromResume(skill.evidence, resumeTokens),
  }));

  // A job skill the resume never names can still be proven by the tools it does
  // name (React.js shows JavaScript). Those are added with the line that proves them.
  const isCovered = (jobSkill) => {
    const words = tokenize(jobSkill);
    return skills.some((skill) => {
      const tokens = new Set(tokenize(skill.name));
      return skill.verified && words.every((word) => tokens.has(word));
    });
  };
  const implied = [];
  for (const jobSkill of uniqueStrings([...job.requiredSkills, ...job.preferredSkills])) {
    if (termSupported(jobSkill, resumeTokens) || isCovered(jobSkill)) continue;

    const provingTools = findImplyingTools(jobSkill, resumeTokens);
    if (provingTools.length > 0) {
      implied.push(jobSkill);
      skills.push({
        name: jobSkill,
        evidence: quoteToolLine(run.resumeText, provingTools),
        verified: true,
        implied: true,
      });
    }
  }
  if (implied.length > 0) {
    await run.emit({
      agent: "resume_analyst",
      type: "fallback",
      summary: `Counted ${list(implied)}: the resume does not name ${implied.length === 1 ? "it" : "them"}, but the tools it lists cannot be used without ${implied.length === 1 ? "it" : "them"}`,
    });
  }

  return {
    plan: completeStep(state.plan, "resume_analyst"),
    candidateProfile: {
      summary: profile.summary,
      highlights: profile.highlights || [],
      skills,
    },
  };
}

/* ------------------------------ Job Match ------------------------------- */

async function jobMatchNode(state, config) {
  const run = getRun(config);
  const ctx = makeContext(run, state);
  const job = state.jobAnalysis;
  const profileSkills = state.candidateProfile?.skills || [];
  const verified = profileSkills.filter((skill) => skill.verified);
  const unverified = profileSkills.filter((skill) => !skill.verified);

  const calls = await runAgent(AGENTS.job_match, {
    ctx,
    input: [
      `Objective: ${getObjective(state, "job_match")}`,
      `Required skills: ${JSON.stringify(job.requiredSkills)}`,
      `Preferred skills: ${JSON.stringify(job.preferredSkills)}`,
      "Evidence-backed candidate skills:",
      ...verified.map((skill) => `- ${skill.name} — "${skill.evidence}"`),
      `Listed without verifiable evidence (do not count): ${list(unverified.map((skill) => skill.name))}`,
    ].join("\n"),
  });

  // A skill counts only if the resume names it or the analyst verified it.
  const resumeTokens = buildTokenSet(run.resumeText);
  const verifiedTokenSets = verified.map((skill) => new Set(tokenize(skill.name)));
  const isBacked = (skill) => {
    const words = tokenize(skill);
    return (
      termSupported(skill, resumeTokens) ||
      verifiedTokenSets.some((tokens) => words.length > 0 && words.every((word) => tokens.has(word)))
    );
  };

  const claimed = [...calls].reverse().find((call) => call.name === "calculate_skill_gaps" && !call.result?.error);
  const proposed = claimed ? claimed.args.candidateSkills : [];
  const dropped = proposed.filter((skill) => !isBacked(skill));

  // The agent's list is corrected in both directions: nothing counts without
  // evidence, and nothing the evidence supports can be left out.
  const comparison = compareSkills({
    requiredSkills: job.requiredSkills,
    preferredSkills: job.preferredSkills,
    candidateSkills: uniqueStrings([
      ...proposed.filter(isBacked),
      ...verified.map((skill) => skill.name),
      ...[...job.requiredSkills, ...job.preferredSkills].filter((skill) => termSupported(skill, resumeTokens)),
    ]),
  });
  const allMatched = [...comparison.matched, ...comparison.preferredMatched];
  const agentMatched = claimed ? [...claimed.result.matched, ...claimed.result.preferredMatched] : [];
  const added = claimed ? allMatched.filter((skill) => !agentMatched.includes(skill)) : [];

  if (!claimed) {
    await run.emit({
      agent: "job_match",
      type: "fallback",
      tool: "calculate_skill_gaps",
      summary: describeCall("calculate_skill_gaps", {}, comparison),
    });
  }
  if (dropped.length > 0) {
    await run.emit({
      agent: "job_match",
      type: "fallback",
      tool: "calculate_skill_gaps",
      summary: `Recalculated without ${list(dropped)}: no resume evidence backs ${dropped.length === 1 ? "it" : "them"}`,
    });
  }
  if (added.length > 0) {
    await run.emit({
      agent: "job_match",
      type: "fallback",
      tool: "calculate_skill_gaps",
      summary: `Also counted ${list(added)}: the evidence supports ${added.length === 1 ? "it" : "them"} (coverage ${comparison.matchScore}%)`,
    });
  }

  return {
    plan: completeStep(state.plan, "job_match"),
    skillGaps: {
      matchScore: comparison.matchScore,
      matched: comparison.matched,
      preferredMatched: comparison.preferredMatched,
      // Matched through evidence although the resume never writes the word
      implied: allMatched.filter((skill) => !termSupported(skill, resumeTokens)),
      missing: [
        ...comparison.missing.map((skill) => ({ skill, severity: "high" })),
        ...comparison.preferredMissing.map((skill) => ({ skill, severity: "low" })),
      ],
    },
  };
}

/* ------------------------------ Optimizer ------------------------------- */

async function optimizerNode(state, config) {
  const run = getRun(config);
  const job = state.jobAnalysis;
  const gaps = state.skillGaps;
  const edits = state.edits || [];
  const acceptedEdits = edits.filter((edit) => edit.status === "accepted");
  const rejectedEdits = edits.filter((edit) => edit.status === "rejected");
  const ctx = makeContext(run, state, { acceptedEdits });

  // In a revision the agent edits the resume as it stands with accepted edits in place.
  const workingText = applyEdits(run.resumeText, acceptedEdits).text;
  const resumeTokens = buildTokenSet(run.resumeText);
  const usableKeywords = uniqueStrings([
    ...gaps.matched,
    ...gaps.preferredMatched,
    ...job.keywords.filter((keyword) => termSupported(keyword, resumeTokens)),
  ]);

  const input = [
    `Objective: ${getObjective(state, "optimizer")}`,
    `Target job: ${job.title}`,
    `Job keywords the resume supports (surface these): ${list(usableKeywords)}`,
    `Skills the resume proves but never names (add them where they are true, for example in the skills line): ${list(gaps.implied)}`,
    `Missing skills (never add these): ${list(gaps.missing.map((gap) => gap.skill))}`,
    `Candidate highlights: ${list(state.candidateProfile?.highlights, "none recorded")}`,
  ];

  if (state.revisionInstructions) {
    input.push(`This is a revision. Instructions: ${state.revisionInstructions}`);
    input.push(`Reviewer feedback: ${state.review?.feedback || "none"}`);
    input.push(
      "Rejected edits (fix or drop them; do not repeat them unchanged):",
      ...rejectedEdits.map((edit) => `- "${edit.replacement}" was rejected: ${edit.reviewNote}`),
    );
    input.push("Propose only replacements for rejected edits. Accepted edits are already in the text below.");
  }

  input.push(`Resume text:\n"""\n${workingText.slice(0, MAX_RESUME_CHARS)}\n"""`);

  await runAgent(AGENTS.optimizer, { ctx, input: input.join("\n") });

  const proposed = (ctx.appliedEdits || []).map((edit) => ({
    ...edit,
    round: state.revisionCount || 0,
    status: "proposed",
  }));

  return {
    plan: completeStep(state.plan, "optimizer"),
    edits: [...edits, ...proposed],
  };
}

/* ------------------------------- Reviewer ------------------------------- */

async function reviewerNode(state, config) {
  const run = getRun(config);
  const edits = state.edits || [];
  const acceptedEdits = edits.filter((edit) => edit.status === "accepted");
  const pendingEdits = edits.filter((edit) => edit.status === "proposed");
  const round = state.revisionCount || 0;

  let review = { decisions: [], verdict: "approve", feedback: "There were no new edits to review." };

  if (pendingEdits.length > 0) {
    const ctx = makeContext(run, state, {
      acceptedEdits,
      pendingEdits,
      appliedText: applyEdits(run.resumeText, [...acceptedEdits, ...pendingEdits]).text,
    });

    await runAgent(AGENTS.reviewer, {
      ctx,
      input: [
        `Objective: ${getObjective(state, "reviewer")}`,
        `Missing skills that must not appear as claims: ${list(state.skillGaps.missing.map((gap) => gap.skill))}`,
        "Pending edits:",
        ...pendingEdits.map((edit) =>
          [
            `[${edit.id}] ${edit.section}`,
            `  original: ${edit.original || "(new line)"}`,
            `  replacement: ${edit.replacement}`,
            `  evidence: ${edit.evidence}`,
            `  reason: ${edit.reason}`,
          ].join("\n"),
        ),
      ].join("\n"),
    });

    if (ctx.outbox.review) {
      review = ctx.outbox.review;
    } else {
      review = { decisions: [], verdict: "revise", feedback: "The review was not completed, so only fully supported edits were kept." };
      await run.emit({
        agent: "reviewer",
        type: "fallback",
        summary: "No review was submitted, so the claim check alone decided each edit",
      });
    }
  }

  // The claim check is authoritative: no decision can accept an unsupported edit.
  const claims = validateClaims({
    edits: pendingEdits,
    resumeText: run.resumeText,
    jobAnalysis: state.jobAnalysis,
    candidateProfile: state.candidateProfile,
    skillGaps: state.skillGaps,
  }).results;

  const overridden = [];
  const reviewed = edits.map((edit) => {
    if (edit.status !== "proposed") return edit;

    const claim = claims.find((result) => result.editId === edit.id);
    const decision = review.decisions.find((item) => item.editId === edit.id);
    const base = {
      ...edit,
      claimStatus: claim.status,
      unsupportedTerms: claim.unsupportedTerms,
      inferredTerms: claim.inferredTerms.map((item) => item.term),
    };

    if (claim.status === "unsupported") {
      if (decision?.decision === "accept") overridden.push(edit.id);
      return { ...base, status: "rejected", reviewNote: claim.reason };
    }
    if (decision) {
      return {
        ...base,
        status: decision.decision === "accept" ? "accepted" : "rejected",
        reviewNote: decision.note,
      };
    }
    return claim.status === "supported"
      ? { ...base, status: "accepted", reviewNote: claim.reason }
      : { ...base, status: "rejected", reviewNote: `Not confirmed by the reviewer. ${claim.reason}` };
  });

  if (overridden.length > 0) {
    await run.emit({
      agent: "reviewer",
      type: "fallback",
      tool: "validate_resume_claims",
      summary: `Blocked ${overridden.length} accepted edit${overridden.length === 1 ? "" : "s"} because the resume has no evidence for the claim`,
    });
  }

  const nowAccepted = reviewed.filter((edit) => edit.status === "accepted");
  const rejectedThisRound = reviewed.filter((edit) => edit.status === "rejected" && edit.round === round);
  const quality = assessResumeQuality({
    text: applyEdits(run.resumeText, nowAccepted).text,
    originalText: run.resumeText,
    jobAnalysis: state.jobAnalysis,
  });
  const needsWork = rejectedThisRound.length > 0 || !quality.passed;

  return {
    plan: completeStep(state.plan, "reviewer"),
    edits: reviewed,
    quality,
    review: {
      round,
      verdict: needsWork ? review.verdict : "approve",
      feedback: review.feedback,
      accepted: nowAccepted.length,
      rejected: rejectedThisRound.length,
    },
  };
}

/* -------------------------------- Graph --------------------------------- */

function buildAgentGraph() {
  return new StateGraph(RunState)
    .addNode("supervisor", supervisorNode)
    .addNode("resume_analyst", resumeAnalystNode)
    .addNode("job_match", jobMatchNode)
    .addNode("optimizer", optimizerNode)
    .addNode("reviewer", reviewerNode)
    .addEdge(START, "supervisor")
    .addConditionalEdges("supervisor", (state) => state.next, {
      resume_analyst: "resume_analyst",
      job_match: "job_match",
      optimizer: "optimizer",
      reviewer: "reviewer",
      finish: END,
    })
    .addEdge("resume_analyst", "supervisor")
    .addEdge("job_match", "supervisor")
    .addEdge("optimizer", "supervisor")
    .addEdge("reviewer", "supervisor")
    .compile();
}

module.exports = { buildAgentGraph, normalizePlan };
