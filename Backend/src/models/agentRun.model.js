const mongoose = require("mongoose");

const planStepSchema = new mongoose.Schema(
  {
    agent: { type: String, required: true },
    objective: { type: String, default: "" },
    status: { type: String, enum: ["pending", "running", "done"], default: "pending" },
  },
  { _id: false },
);

// One line of the activity log: which agent (or the user) did what.
const stepSchema = new mongoose.Schema(
  {
    agent: { type: String, required: true },
    type: { type: String, enum: ["tool", "fallback", "error"], default: "tool" },
    tool: { type: String },
    summary: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const editSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    section: { type: String, default: "" },
    original: { type: String, default: "" },
    replacement: { type: String, required: true },
    reason: { type: String, default: "" },
    evidence: { type: String, default: "" },
    keywords: [{ type: String }],
    applied: { type: Boolean, default: true },
    round: { type: Number, default: 0 },
    // proposed → accepted/rejected by the reviewer → approved/declined by the user
    status: {
      type: String,
      enum: ["proposed", "accepted", "rejected", "approved", "declined"],
      default: "proposed",
    },
    claimStatus: { type: String },
    unsupportedTerms: [{ type: String }],
    inferredTerms: [{ type: String }],
    reviewNote: { type: String, default: "" },
  },
  { _id: false, id: false },
);

const agentRunSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    interviewReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterviewReport",
      index: true,
    },
    status: {
      type: String,
      enum: ["running", "awaiting_approval", "completed", "approved", "failed"],
      default: "running",
      index: true,
    },
    goal: { type: String, required: true },
    jobDescription: { type: String, required: true },
    resumeText: { type: String, required: true },
    resumeFileName: { type: String, default: "resume.pdf" },
    sourceId: { type: String },

    plan: [planStepSchema],
    steps: [stepSchema],
    jobAnalysis: { type: mongoose.Schema.Types.Mixed },
    candidateProfile: { type: mongoose.Schema.Types.Mixed },
    skillGaps: { type: mongoose.Schema.Types.Mixed },
    edits: [editSchema],
    review: { type: mongoose.Schema.Types.Mixed },
    quality: { type: mongoose.Schema.Types.Mixed },
    revisionCount: { type: Number, default: 0 },
    summary: { type: String, default: "" },

    finalResume: { type: String },
    finalQuality: { type: mongoose.Schema.Types.Mixed },
    llmCalls: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AgentRun", agentRunSchema);
