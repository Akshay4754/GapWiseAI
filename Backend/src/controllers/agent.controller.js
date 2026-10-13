const mongoose = require("mongoose");
const agentRunModel = require("../models/agentRun.model");
const interviewReportModel = require("../models/interviewReport.model");
const agentRunService = require("../services/agentRun.service");

// The page never needs the raw resume or job text back, only the results.
function toRunView(run) {
  const { resumeText, jobDescription, sourceId, __v, ...view } = run.toObject ? run.toObject() : run;
  return view;
}

function sendError(res, error, fallbackMessage) {
  if (error?.expose) {
    return res.status(error.status).json({ message: error.message });
  }

  console.error("[Agent]", error);
  return res.status(500).json({ message: fallbackMessage });
}

async function findOwnedRun(req) {
  const { runId } = req.params;
  if (!mongoose.isValidObjectId(runId)) return null;

  const run = await agentRunModel.findOne({ _id: runId, user: req.user.id });
  return run ? agentRunService.failIfStale(run) : null;
}

/**
 * @description Start an agent run from an uploaded resume PDF or from an existing interview report.
 */
async function startRunController(req, res) {
  try {
    const { interviewReportId, jobDescription, goal } = req.body || {};
    let report = null;

    if (interviewReportId) {
      report = mongoose.isValidObjectId(interviewReportId)
        ? await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id })
        : null;

      if (!report) {
        return res.status(404).json({ message: "Interview report not found." });
      }

      // One run at a time per report: return the one already working.
      const active = await agentRunModel.findOne({
        user: req.user.id,
        interviewReport: report._id,
        status: "running",
      });
      if (active && (await agentRunService.failIfStale(active)).status === "running") {
        return res.status(200).json({ message: "A run is already in progress.", run: toRunView(active) });
      }
    }

    if (req.file) {
      const isPdf =
        req.file.mimetype === "application/pdf" ||
        String(req.file.originalname || "").toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        return res.status(400).json({ message: "Only PDF resumes are supported right now." });
      }
    } else if (!report) {
      return res.status(400).json({ message: "Upload a resume PDF or start from an interview report." });
    }

    const run = await agentRunService.createRun({
      userId: req.user.id,
      report,
      resumeFile: req.file,
      jobDescription,
      goal,
    });
    agentRunService.launchRun(run._id);

    return res.status(202).json({ message: "Agent run started.", run: toRunView(run) });
  } catch (error) {
    return sendError(res, error, "Could not start the agent run.");
  }
}

/**
 * @description Get one agent run with its plan, activity log and results.
 */
async function getRunController(req, res) {
  try {
    const run = await findOwnedRun(req);
    if (!run) {
      return res.status(404).json({ message: "Agent run not found." });
    }

    return res.status(200).json({ run: toRunView(run) });
  } catch (error) {
    return sendError(res, error, "Could not fetch the agent run.");
  }
}

/**
 * @description Get the most recent agent run for an interview report (run is null when there is none).
 */
async function getLatestRunController(req, res) {
  try {
    const { interviewReportId } = req.query;
    if (!mongoose.isValidObjectId(interviewReportId)) {
      return res.status(400).json({ message: "interviewReportId is required." });
    }

    const run = await agentRunModel
      .findOne({ user: req.user.id, interviewReport: interviewReportId })
      .sort({ createdAt: -1 });

    return res.status(200).json({ run: run ? toRunView(await agentRunService.failIfStale(run)) : null });
  } catch (error) {
    return sendError(res, error, "Could not fetch the agent run.");
  }
}

/**
 * @description Apply the edits the user approved and re-check the resume.
 */
async function approveRunController(req, res) {
  try {
    const run = await findOwnedRun(req);
    if (!run) {
      return res.status(404).json({ message: "Agent run not found." });
    }

    const editIds = req.body?.editIds;
    if (!Array.isArray(editIds) || editIds.some((id) => typeof id !== "string")) {
      return res.status(400).json({ message: "editIds must be a list of edit ids." });
    }

    const approved = await agentRunService.approveRun(run, editIds);
    return res.status(200).json({ message: "Edits applied.", run: toRunView(approved) });
  } catch (error) {
    return sendError(res, error, "Could not apply the approved edits.");
  }
}

/**
 * @description Export the approved resume as a PDF.
 */
async function exportRunController(req, res) {
  try {
    const run = await findOwnedRun(req);
    if (!run) {
      return res.status(404).json({ message: "Agent run not found." });
    }

    const pdfBuffer = await agentRunService.exportRun(run);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=optimized_resume_${run._id}.pdf`,
    });
    return res.send(pdfBuffer);
  } catch (error) {
    return sendError(res, error, "Could not export the resume PDF.");
  }
}

module.exports = {
  startRunController,
  getRunController,
  getLatestRunController,
  approveRunController,
  exportRunController,
};
