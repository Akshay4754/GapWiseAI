const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const agentController = require("../controllers/agent.controller");
const upload = require("../middlewares/file.middleware");

const agentRouter = express.Router();

/**
 * @route POST /api/agent/runs
 * @description start a multi-agent resume optimisation run from a resume pdf or an interview report.
 * @access private
 */
agentRouter.post(
  "/runs",
  authMiddleware.authUser,
  upload.single("resume"),
  agentController.startRunController,
);

/**
 * @route GET /api/agent/runs/latest?interviewReportId=
 * @description get the most recent agent run for an interview report.
 * @access private
 */
agentRouter.get(
  "/runs/latest",
  authMiddleware.authUser,
  agentController.getLatestRunController,
);

/**
 * @route GET /api/agent/runs/:runId
 * @description get an agent run with its plan, activity log and results.
 * @access private
 */
agentRouter.get(
  "/runs/:runId",
  authMiddleware.authUser,
  agentController.getRunController,
);

/**
 * @route POST /api/agent/runs/:runId/approve
 * @description apply the edits the user approved to the resume.
 * @access private
 */
agentRouter.post(
  "/runs/:runId/approve",
  authMiddleware.authUser,
  agentController.approveRunController,
);

/**
 * @route POST /api/agent/runs/:runId/export
 * @description export the approved resume as a pdf.
 * @access private
 */
agentRouter.post(
  "/runs/:runId/export",
  authMiddleware.authUser,
  agentController.exportRunController,
);

module.exports = agentRouter;
