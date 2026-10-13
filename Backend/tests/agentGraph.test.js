// The graph and every rule-based tool run for real; only Gemini, Pinecone and
// the PDF renderer are replaced.
jest.mock("../src/agents/llm", () => ({ callWithTools: jest.fn(), generateJson: jest.fn() }));
jest.mock("../src/services/ai.service", () => ({ generatePdfFromHtml: jest.fn() }));
jest.mock("../src/services/rag.service", () => ({
  extractPdfTextFromBuffer: jest.fn(),
  retrieveRelevantChunks: jest.fn(),
}));

const llm = require("../src/agents/llm");
const { buildAgentGraph, normalizePlan } = require("../src/agents/graph");

const RESUME = `JANE DOE
jane@example.com

SKILLS
JavaScript, Node.js, Express, MongoDB, Docker

PROJECTS
Shop API | Node.js, Express
• Built an API for a shop with 20 endpoints.
• Set up GitHub Actions to run tests and build Docker images.

EDUCATION
B.Tech in Computer Science, 2026`;

const JOB_ANALYSIS = {
  title: "Backend Engineer",
  requiredSkills: ["Node.js", "Docker", "Kubernetes", "CI/CD"],
  preferredSkills: ["TypeScript"],
  responsibilities: ["Build APIs"],
  keywords: ["REST APIs"],
};

const GOOD_EDIT = {
  section: "Projects",
  original: "• Built an API for a shop with 20 endpoints.",
  replacement: "Developed a shop API in Node.js and Express with 20 endpoints.",
  reason: "Names the stack",
  evidence: "Shop API | Node.js, Express",
};
const KUBERNETES_EDIT = {
  section: "Projects",
  original: "• Set up GitHub Actions to run tests and build Docker images.",
  replacement: "Deployed Docker images to Kubernetes using GitHub Actions.",
  reason: "Adds a required skill",
  evidence: "build Docker images",
};
const CICD_EDIT = {
  ...KUBERNETES_EDIT,
  replacement: "Built a CI/CD pipeline with GitHub Actions to run tests and build Docker images.",
  reason: "Surfaces CI/CD",
  evidence: "Set up GitHub Actions to run tests and build Docker images.",
};

const call = (name, args = {}) => ({ name, args });
const reply = (...functionCalls) => ({ functionCalls, content: { role: "model", parts: [] } });
const offered = (request, name) => request.tools.some((tool) => tool.name === name);
// The agent's own prompt is the first message; later ones are tool results.
const isFirstTurn = (request) => request.contents.length === 1;
const pendingEditIds = (request) => [...request.contents[0].parts[0].text.matchAll(/\[(edit-[a-z0-9]+)\]/g)].map((m) => m[1]);

/**
 * A stand-in model that behaves like each agent would, including the mistakes
 * the guardrails have to catch.
 */
function scriptModel({
  plan,
  optimizerRounds,
  reviewerVerdict = "revise",
  jobAnalysis = JOB_ANALYSIS,
  profileSkills = [
    { name: "Node.js", evidence: "Shop API | Node.js, Express" },
    { name: "Docker", evidence: "build Docker images" },
    { name: "CI/CD", evidence: "Set up GitHub Actions to run tests and build Docker images." },
  ],
  // Wrongly claims Kubernetes: the graph has to drop it.
  claimedSkills = ["Node.js", "Docker", "CI/CD", "Kubernetes"],
} = {}) {
  let optimizerRound = 0;

  llm.generateJson.mockResolvedValue(jobAnalysis);
  llm.callWithTools.mockImplementation(async (request) => {
    request.usage.llmCalls += 1;

    if (offered(request, "create_plan")) {
      return reply(
        call("analyze_job_description"),
        call("create_plan", {
          steps: plan || [
            { agent: "resume_analyst", objective: "Find evidence" },
            { agent: "job_match", objective: "Find gaps" },
            { agent: "optimizer", objective: "Improve wording" },
            { agent: "reviewer", objective: "Check claims" },
          ],
        }),
      );
    }

    if (offered(request, "submit_candidate_profile")) {
      return isFirstTurn(request)
        ? reply(call("extract_resume"), call("retrieve_resume_evidence", { query: "Kubernetes" }))
        : reply(
            call("submit_candidate_profile", {
              summary: "Backend-leaning student.",
              highlights: ["Built an API for a shop with 20 endpoints."],
              skills: profileSkills,
            }),
          );
    }

    if (offered(request, "calculate_skill_gaps")) {
      return reply(
        call("calculate_skill_gaps", {
          requiredSkills: jobAnalysis.requiredSkills,
          preferredSkills: jobAnalysis.preferredSkills,
          candidateSkills: claimedSkills,
        }),
      );
    }

    if (offered(request, "apply_resume_edits")) {
      const rounds = optimizerRounds || [[GOOD_EDIT, KUBERNETES_EDIT], [CICD_EDIT]];
      const edits = rounds[Math.min(optimizerRound, rounds.length - 1)];
      optimizerRound += 1;
      return reply(call("apply_resume_edits", { edits }));
    }

    if (offered(request, "submit_review")) {
      if (isFirstTurn(request)) {
        return reply(call("validate_resume_claims"), call("validate_resume_quality"));
      }
      // Accepts everything, including the unsupported claim.
      return reply(
        call("submit_review", {
          verdict: reviewerVerdict,
          feedback: "Do not claim Kubernetes.",
          decisions: pendingEditIds(request).map((editId) => ({ editId, decision: "accept", note: "Looks fine." })),
        }),
      );
    }

    if (offered(request, "request_revision")) {
      return reply(call("request_revision", { instructions: "Replace the Kubernetes edit with a supported one." }));
    }

    return reply(call("finish", { summary: "Your edits are ready for approval." }));
  });
}

async function runGraph({ goal = "Optimise my resume for this job.", resume = RESUME } = {}) {
  const steps = [];
  const usage = { llmCalls: 0, maxLlmCalls: 30 };

  const state = await buildAgentGraph().invoke(
    { goal, plan: [], edits: [], revisionCount: 0 },
    {
      recursionLimit: 40,
      configurable: {
        run: {
          userId: "user-1",
          sourceId: null,
          resumeText: resume,
          jobDescription: "Backend Engineer. Node.js, Docker, Kubernetes, CI/CD.",
          usage,
          emit: async (step) => steps.push(step),
        },
      },
    },
  );

  return { state, steps, usage };
}

beforeEach(() => {
  jest.resetAllMocks();
  delete process.env.AGENT_MAX_REVISIONS;
});

describe("normalizePlan", () => {
  it("should keep an analysis-only plan as it is", () => {
    const plan = normalizePlan([{ agent: "job_match", objective: "Gaps only" }]);
    expect(plan.map((step) => step.agent)).toEqual(["resume_analyst", "job_match"]);
    expect(plan[1].objective).toBe("Gaps only");
  });

  it("should add what an optimizer depends on, and its reviewer", () => {
    const plan = normalizePlan([{ agent: "optimizer", objective: "Edit" }]);
    expect(plan.map((step) => step.agent)).toEqual(["resume_analyst", "job_match", "optimizer", "reviewer"]);
  });

  it("should fall back to the full team when the plan is empty", () => {
    expect(normalizePlan([])).toHaveLength(4);
  });
});

describe("Agent graph — full optimisation", () => {
  it("should plan, analyse, match, optimise, review and revise once", async () => {
    scriptModel();
    const { state, usage } = await runGraph();

    expect(state.plan.map((step) => `${step.agent}:${step.status}`)).toEqual([
      "resume_analyst:done",
      "job_match:done",
      "optimizer:done",
      "reviewer:done",
      "optimizer:done",
      "reviewer:done",
    ]);
    expect(state.revisionCount).toBe(1);
    expect(state.summary).toBe("Your edits are ready for approval.");
    expect(usage.llmCalls).toBeLessThanOrEqual(14);
  });

  it("should let each agent call only its own tools", async () => {
    scriptModel();
    await runGraph();

    const toolSets = llm.callWithTools.mock.calls.map(([request]) => request.tools.map((tool) => tool.name).join(","));
    expect(new Set(toolSets)).toEqual(
      new Set([
        "analyze_job_description,create_plan",
        "extract_resume,retrieve_resume_evidence,submit_candidate_profile",
        "analyze_job_description,calculate_skill_gaps",
        "apply_resume_edits",
        "validate_resume_claims,validate_resume_quality,submit_review",
        "request_revision,finish",
        "finish",
      ]),
    );
  });

  it("should report Kubernetes as a gap even though the model claimed it", async () => {
    scriptModel();
    const { state, steps } = await runGraph();

    expect(state.skillGaps.matched).toEqual(["Node.js", "Docker", "CI/CD"]);
    expect(state.skillGaps.missing).toEqual([
      { skill: "Kubernetes", severity: "high" },
      { skill: "TypeScript", severity: "low" },
    ]);
    expect(steps.some((step) => step.agent === "job_match" && /Recalculated without Kubernetes/.test(step.summary))).toBe(true);
  });

  it("should reject the unsupported edit even though the reviewer accepted it", async () => {
    scriptModel();
    const { state, steps } = await runGraph();

    const kubernetes = state.edits.find((edit) => /Kubernetes/.test(edit.replacement));
    expect(kubernetes).toMatchObject({ status: "rejected", claimStatus: "unsupported", round: 0 });
    expect(kubernetes.reviewNote).toMatch(/no evidence for: Kubernetes/);
    expect(steps.some((step) => step.agent === "reviewer" && /Blocked 1 accepted edit/.test(step.summary))).toBe(true);
  });

  it("should accept the supported edit and the evidence-backed revision", async () => {
    scriptModel();
    const { state } = await runGraph();

    const accepted = state.edits.filter((edit) => edit.status === "accepted");
    expect(accepted.map((edit) => edit.replacement)).toEqual([GOOD_EDIT.replacement, CICD_EDIT.replacement]);
    expect(accepted[1]).toMatchObject({ claimStatus: "needs_review", inferredTerms: ["CI/CD"], round: 1 });
    expect(state.review).toMatchObject({ verdict: "approve", accepted: 2, rejected: 0 });
    expect(state.quality.passed).toBe(true);
    expect(state.quality.keywordCoverage.percent).toBeGreaterThan(state.quality.keywordCoverage.percentBefore);
  });

  it("should stop revising when the budget is used up", async () => {
    // The optimizer never fixes its edit.
    scriptModel({ optimizerRounds: [[KUBERNETES_EDIT]] });
    const { state } = await runGraph();

    expect(state.revisionCount).toBe(1);
    expect(state.edits.map((edit) => edit.status)).toEqual(["rejected", "rejected"]);
    expect(state.review.verdict).toBe("revise");
    expect(state.next).toBe("finish");
  });

  it("should not revise at all when revisions are switched off", async () => {
    process.env.AGENT_MAX_REVISIONS = "0";
    scriptModel();
    const { state } = await runGraph();

    expect(state.revisionCount).toBe(0);
    expect(state.plan).toHaveLength(4);
    expect(state.edits.filter((edit) => edit.status === "accepted")).toHaveLength(1);
  });
});

describe("Agent graph — skills the resume proves without naming", () => {
  // Lists React and Node.js but never writes JavaScript, HTML or CSS
  const FRONTEND_RESUME = `JANE DOE
jane@example.com

SKILLS
Frontend & Backend: React.js, Node.js, Express.js, REST APIs
Tools: Git, Docker

PROJECTS
Shop UI | React.js
• Built a shop interface with 20 screens.

EDUCATION
B.Tech in Computer Science, 2026`;

  const FRONTEND_JOB = {
    title: "Frontend Developer Intern",
    requiredSkills: ["HTML", "CSS", "JavaScript", "React.js", "Redux", "REST APIs"],
    preferredSkills: ["Next.js", "Tailwind CSS"],
    responsibilities: ["Build interfaces"],
    keywords: [],
  };

  const frontendScript = (overrides = {}) =>
    scriptModel({
      jobAnalysis: FRONTEND_JOB,
      // The analyst and the job match agent both report only what is written down
      profileSkills: [
        { name: "React.js", evidence: "Frontend & Backend: React.js, Node.js, Express.js, REST APIs" },
        { name: "REST APIs", evidence: "Frontend & Backend: React.js, Node.js, Express.js, REST APIs" },
      ],
      claimedSkills: ["React.js"],
      plan: [
        { agent: "resume_analyst", objective: "Find evidence" },
        { agent: "job_match", objective: "Find gaps" },
      ],
      ...overrides,
    });

  it("should count JavaScript, HTML and CSS for a resume that lists React", async () => {
    frontendScript();
    const { state, steps } = await runGraph({ resume: FRONTEND_RESUME });

    expect(state.skillGaps.matched).toEqual(["HTML", "CSS", "JavaScript", "React.js", "REST APIs"]);
    expect(state.skillGaps.implied).toEqual(["HTML", "CSS", "JavaScript"]);
    expect(state.skillGaps.missing).toEqual([
      { skill: "Redux", severity: "high" },
      { skill: "Next.js", severity: "low" },
      { skill: "Tailwind CSS", severity: "low" },
    ]);
    expect(state.skillGaps.matchScore).toBe(71);
    expect(steps.some((step) => step.agent === "resume_analyst" && /Counted HTML, CSS, JavaScript/.test(step.summary))).toBe(true);
  });

  it("should quote the resume line that proves an implied skill", async () => {
    frontendScript();
    const { state } = await runGraph({ resume: FRONTEND_RESUME });

    const javascript = state.candidateProfile.skills.find((skill) => skill.name === "JavaScript");
    expect(javascript).toEqual({
      name: "JavaScript",
      evidence: "Frontend & Backend: React.js, Node.js, Express.js, REST APIs",
      verified: true,
      implied: true,
    });
  });

  it("should not let the job match agent leave out a skill the resume names", async () => {
    // The model claims only React.js although REST APIs is written in the resume
    frontendScript();
    const { state, steps } = await runGraph({ resume: FRONTEND_RESUME });

    expect(state.skillGaps.matched).toContain("REST APIs");
    expect(steps.some((step) => step.agent === "job_match" && /Also counted .*REST APIs/.test(step.summary))).toBe(true);
  });

  it("should still report unrelated skills as gaps", async () => {
    frontendScript();
    const { state } = await runGraph({ resume: FRONTEND_RESUME });

    expect(state.skillGaps.matched).not.toContain("Redux");
    expect(state.skillGaps.implied).not.toContain("Tailwind CSS");
  });

  it("should send an edit that names an implied skill to the reviewer instead of blocking it", async () => {
    frontendScript({
      plan: undefined,
      reviewerVerdict: "approve",
      optimizerRounds: [
        [
          {
            section: "Skills",
            original: "Frontend & Backend: React.js, Node.js, Express.js, REST APIs",
            replacement: "Frontend & Backend: JavaScript, HTML, CSS, React.js, Node.js, Express.js, REST APIs",
            reason: "Names the languages the job screens for",
            evidence: "Frontend & Backend: React.js, Node.js, Express.js, REST APIs",
          },
          {
            section: "Skills",
            original: "Tools: Git, Docker",
            replacement: "Tools: Git, Docker, Redux",
            reason: "Adds a required skill",
            evidence: "Tools: Git, Docker",
          },
        ],
      ],
    });
    const { state } = await runGraph({ resume: FRONTEND_RESUME });

    const [languages, redux] = state.edits;
    expect(languages).toMatchObject({ status: "accepted", claimStatus: "needs_review" });
    expect(languages.inferredTerms).toEqual(["HTML", "CSS", "JavaScript"]);
    expect(redux).toMatchObject({ status: "rejected", claimStatus: "unsupported" });
  });
});

describe("Agent graph — planning and failure handling", () => {
  it("should skip the optimizer and reviewer for an analysis-only goal", async () => {
    scriptModel({
      plan: [
        { agent: "resume_analyst", objective: "Find evidence" },
        { agent: "job_match", objective: "Find gaps" },
      ],
    });
    const { state } = await runGraph({ goal: "Only tell me my skill gaps." });

    expect(state.plan.map((step) => step.agent)).toEqual(["resume_analyst", "job_match"]);
    expect(state.edits).toEqual([]);
    expect(state.skillGaps.missing.map((gap) => gap.skill)).toContain("Kubernetes");
    expect(llm.callWithTools.mock.calls.some(([request]) => offered(request, "apply_resume_edits"))).toBe(false);
  });

  it("should give a tool error back to the agent so it can correct itself", async () => {
    scriptModel();
    const scripted = llm.callWithTools.getMockImplementation();
    let analystTurns = 0;
    llm.callWithTools.mockImplementation(async (request) => {
      if (offered(request, "submit_candidate_profile")) {
        analystTurns += 1;
        // First tries to report without having read the resume.
        if (analystTurns === 1) {
          request.usage.llmCalls += 1;
          return reply(call("submit_candidate_profile", { summary: "Guess", highlights: [], skills: [] }));
        }
        return scripted({ ...request, contents: analystTurns === 2 ? [request.contents[0]] : request.contents });
      }
      return scripted(request);
    });

    const { state, steps } = await runGraph();

    expect(steps.some((step) => step.type === "error" && /Read the resume/.test(step.summary))).toBe(true);
    expect(state.candidateProfile.skills.map((skill) => skill.name)).toEqual(["Node.js", "Docker", "CI/CD"]);
  });

  it("should leave an agent only its hand-in action on its last turn", async () => {
    scriptModel();
    const scripted = llm.callWithTools.getMockImplementation();
    const analystToolSets = [];
    llm.callWithTools.mockImplementation(async (request) => {
      if (!offered(request, "submit_candidate_profile")) return scripted(request);

      analystToolSets.push(request.tools.map((tool) => tool.name));
      // Keeps searching for as long as it is allowed to
      if (offered(request, "retrieve_resume_evidence")) {
        request.usage.llmCalls += 1;
        return reply(call("retrieve_resume_evidence", { query: "Docker" }));
      }
      return scripted({ ...request, contents: [...request.contents] });
    });

    const { state, steps } = await runGraph();

    expect(analystToolSets).toHaveLength(4);
    expect(analystToolSets[3]).toEqual(["submit_candidate_profile"]);
    expect(state.candidateProfile.skills.map((skill) => skill.name)).toEqual(["Node.js", "Docker", "CI/CD"]);
    expect(steps.some((step) => /No profile was submitted/.test(step.summary))).toBe(false);
  });

  it("should stop the run when the AI service is out of quota", async () => {
    scriptModel();
    llm.callWithTools.mockRejectedValue(Object.assign(new Error("quota"), { status: 429 }));

    await expect(runGraph()).rejects.toMatchObject({ status: 429 });
  });

  it("should stop once the run's AI call budget is spent", async () => {
    scriptModel();
    const steps = [];
    const run = buildAgentGraph().invoke(
      { goal: "Optimise", plan: [], edits: [], revisionCount: 0 },
      {
        configurable: {
          run: {
            userId: "user-1",
            sourceId: null,
            resumeText: RESUME,
            jobDescription: "Backend Engineer",
            usage: { llmCalls: 0, maxLlmCalls: 3 },
            emit: async (step) => steps.push(step),
          },
        },
      },
    );

    await expect(run).rejects.toMatchObject({ code: "LLM_BUDGET_EXCEEDED" });
  });
});
