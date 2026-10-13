const agentRunModel = require("../models/agentRun.model");
const { initializeResumeCollection } = require("./rag.service");
const { buildAgentGraph } = require("../agents/graph");
const { describeCall } = require("../agents/agents");
const tools = require("../agents/tools");
const { withContext } = require("../agents/tools/context");
const { cleanResumeText } = require("../agents/text");

const DEFAULT_GOAL = "Optimise my resume for this job.";
const MAX_LLM_CALLS = 30;
const MIN_RESUME_CHARS = 200;
// A run that has not written anything for this long died with its process.
const STALE_AFTER_MS = 4 * 60 * 1000;
const SELECTABLE_STATUSES = ["accepted", "approved", "declined"];

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

const newUsage = () => ({ llmCalls: 0, maxLlmCalls: MAX_LLM_CALLS });

/**
 * Saves a new run. An uploaded PDF is read with the extract_resume tool; a run
 * started from a report reuses the resume text stored with that report.
 */
async function createRun({ userId, report, resumeFile, jobDescription, goal }) {
  const ctx = { resumeText: resumeFile ? "" : report?.resume || "", resumeBuffer: resumeFile?.buffer };
  const steps = [];

  if (resumeFile) {
    const result = await tools.extractResume.invoke({}, withContext(ctx));
    steps.push({ agent: "user", tool: "extract_resume", summary: describeCall("extract_resume", {}, result) });
  }

  const resumeText = cleanResumeText(ctx.resumeText);
  if (resumeText.length < MIN_RESUME_CHARS) {
    throw createHttpError(
      400,
      "The agents need the text of a resume to work with. Upload a text-based resume PDF and try again.",
    );
  }

  const jobText = (jobDescription || report?.jobDescription || "").trim();
  if (!jobText) {
    throw createHttpError(400, "A job description is required.");
  }

  const run = new agentRunModel({
    user: userId,
    interviewReport: report?._id,
    status: "running",
    goal: (goal || "").trim().slice(0, 500) || DEFAULT_GOAL,
    jobDescription: jobText,
    resumeText,
    resumeFileName: resumeFile?.originalname || "resume.pdf",
    steps,
  });
  run.sourceId = `agent-run-${run._id}`;
  await run.save();

  return run;
}

function toFailureMessage(error) {
  if (error?.code === "MISSING_AI_API_KEY") return error.message;
  if (error?.code === "LLM_BUDGET_EXCEEDED") return error.message;
  if (error?.status === 429) return "The AI request limit has been reached. Please try again later.";
  if (error?.status === 503) return "The AI service is temporarily busy. Please try again in a moment.";
  return "The agents could not finish this run. Please start it again.";
}

/**
 * Runs the agent graph for a saved run, writing every step and every state
 * change to the database so the page can follow along.
 */
async function executeRun(runId) {
  const run = await agentRunModel.findById(runId);
  if (!run) return;

  const usage = newUsage();
  // Steps arrive from concurrent tool calls; the chain keeps them in order.
  let writes = Promise.resolve();
  const emit = (step) => {
    writes = writes
      .then(() =>
        agentRunModel.updateOne(
          { _id: runId },
          { $push: { steps: { ...step, at: new Date() } }, $set: { llmCalls: usage.llmCalls } },
        ),
      )
      .catch((error) => console.error("[Agent] Could not save a step:", error.message));
    return writes;
  };

  try {
    let sourceId = null;
    try {
      await initializeResumeCollection(String(run.user), run.resumeText, {
        sourceId: run.sourceId,
        fileName: run.resumeFileName,
        docType: "resume",
      });
      sourceId = run.sourceId;
      await emit({ agent: "system", type: "tool", summary: "Indexed the resume for evidence search" });
    } catch (error) {
      console.warn("[Agent] Resume indexing failed:", error.message);
      await emit({
        agent: "system",
        type: "fallback",
        summary: "Vector index unavailable, so evidence search will read the resume text directly",
      });
    }

    const stream = await buildAgentGraph().stream(
      { goal: run.goal, plan: [], edits: [], revisionCount: 0 },
      {
        streamMode: "values",
        recursionLimit: 40,
        configurable: {
          run: {
            userId: String(run.user),
            sourceId,
            resumeText: run.resumeText,
            jobDescription: run.jobDescription,
            usage,
            emit,
          },
        },
      },
    );

    let state = {};
    for await (const snapshot of stream) {
      state = snapshot;
      await writes;
      await agentRunModel.updateOne(
        { _id: runId },
        {
          $set: {
            plan: state.plan || [],
            jobAnalysis: state.jobAnalysis,
            candidateProfile: state.candidateProfile,
            skillGaps: state.skillGaps,
            edits: state.edits || [],
            review: state.review,
            quality: state.quality,
            revisionCount: state.revisionCount || 0,
            llmCalls: usage.llmCalls,
          },
        },
      );
    }

    await writes;
    const hasAcceptedEdits = (state.edits || []).some((edit) => edit.status === "accepted");
    await agentRunModel.updateOne(
      { _id: runId },
      {
        $set: {
          status: hasAcceptedEdits ? "awaiting_approval" : "completed",
          summary: state.summary || "",
          llmCalls: usage.llmCalls,
        },
      },
    );
  } catch (error) {
    console.error("[Agent] Run failed:", error);
    await writes;
    await agentRunModel.updateOne(
      { _id: runId },
      { $set: { status: "failed", error: toFailureMessage(error), llmCalls: usage.llmCalls } },
    );
  }
}

// The HTTP request returns straight away; the page polls for progress.
function launchRun(runId) {
  setImmediate(() => {
    executeRun(runId).catch((error) => console.error("[Agent] Run crashed:", error));
  });
}

async function failIfStale(run) {
  if (run.status === "running" && Date.now() - new Date(run.updatedAt).getTime() > STALE_AFTER_MS) {
    run.status = "failed";
    run.error = "This run stopped unexpectedly. Please start it again.";
    await run.save();
  }
  return run;
}

/**
 * The user's approval step: applies the edits they selected (only ones the
 * reviewer accepted) to the original resume and re-checks the result.
 */
async function approveRun(run, editIds = []) {
  if (!["awaiting_approval", "approved"].includes(run.status)) {
    throw createHttpError(409, "This run has no edits waiting for approval.");
  }

  const selectable = run.edits.filter((edit) => SELECTABLE_STATUSES.includes(edit.status));
  const unknown = editIds.filter((id) => !selectable.some((edit) => edit.id === id));
  if (unknown.length > 0) {
    throw createHttpError(400, "Only edits accepted by the reviewer can be approved.");
  }

  const chosen = selectable.filter((edit) => editIds.includes(edit.id));
  const ctx = {
    resumeText: run.resumeText,
    jobAnalysis: run.jobAnalysis,
    acceptedEdits: [],
    appliedText: run.resumeText,
  };

  if (chosen.length > 0) {
    const result = await tools.applyResumeEdits.invoke(
      {
        edits: chosen.map(({ section, original, replacement, reason, evidence, keywords }) => ({
          section,
          original,
          replacement,
          reason,
          evidence,
          keywords,
        })),
      },
      withContext(ctx),
    );
    run.steps.push({
      agent: "user",
      tool: "apply_resume_edits",
      summary: `Approved ${chosen.length} edit${chosen.length === 1 ? "" : "s"}; ${result.applied} applied to the resume`,
    });
  }

  const quality = await tools.validateResumeQuality.invoke({}, withContext(ctx));
  run.steps.push({
    agent: "user",
    tool: "validate_resume_quality",
    summary: describeCall("validate_resume_quality", {}, quality),
  });

  for (const edit of selectable) {
    edit.status = editIds.includes(edit.id) ? "approved" : "declined";
  }
  run.finalResume = ctx.appliedText;
  run.finalQuality = quality;
  run.status = "approved";
  await run.save();

  return run;
}

/** The user's export step: turns the approved resume into a PDF. */
async function exportRun(run) {
  if (run.status !== "approved" || !run.finalResume) {
    throw createHttpError(409, "Approve the edits before exporting the resume.");
  }

  const ctx = { finalResume: run.finalResume };
  const result = await tools.exportResumePdf.invoke({}, withContext(ctx));
  if (!result.exported) {
    throw createHttpError(409, result.message);
  }

  run.steps.push({
    agent: "user",
    tool: "export_resume_pdf",
    summary: describeCall("export_resume_pdf", {}, result),
  });
  await run.save();

  return ctx.pdfBuffer;
}

module.exports = {
  DEFAULT_GOAL,
  approveRun,
  createRun,
  executeRun,
  exportRun,
  failIfStale,
  launchRun,
};
