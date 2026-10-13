const { extractResume } = require("./extractResume.tool");
const { retrieveResumeEvidence } = require("./retrieveResumeEvidence.tool");
const { analyzeJobDescription } = require("./analyzeJobDescription.tool");
const { calculateSkillGaps } = require("./calculateSkillGaps.tool");
const { validateResumeClaims } = require("./validateResumeClaims.tool");
const { applyResumeEdits } = require("./applyResumeEdits.tool");
const { validateResumeQuality } = require("./validateResumeQuality.tool");
const { exportResumePdf } = require("./exportResumePdf.tool");

// The eight actions GapWise agents (and the user, for the last steps) can take.
module.exports = {
  extractResume,
  retrieveResumeEvidence,
  analyzeJobDescription,
  calculateSkillGaps,
  validateResumeClaims,
  applyResumeEdits,
  validateResumeQuality,
  exportResumePdf,
};
