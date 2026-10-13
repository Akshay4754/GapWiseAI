const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { tokenize, uniqueStrings } = require("../text");
const { getContext } = require("./context");

// Plain JavaScript on purpose: an exact comparison should not depend on a model.
function compareSkills({ requiredSkills = [], preferredSkills = [], candidateSkills = [] }) {
  const candidateTokenSets = uniqueStrings(candidateSkills).map((skill) => new Set(tokenize(skill)));

  const isCovered = (skill) => {
    const words = tokenize(skill);
    return (
      words.length > 0 &&
      candidateTokenSets.some((tokens) => words.every((word) => tokens.has(word)))
    );
  };

  const required = uniqueStrings(requiredSkills);
  const preferred = uniqueStrings(preferredSkills).filter(
    (skill) => !required.some((item) => item.toLowerCase() === skill.toLowerCase()),
  );

  const matched = required.filter(isCovered);
  const missing = required.filter((skill) => !isCovered(skill));
  const preferredMatched = preferred.filter(isCovered);
  const preferredMissing = preferred.filter((skill) => !isCovered(skill));

  // Preferred skills count half as much as required ones.
  const total = required.length + preferred.length * 0.5;
  const earned = matched.length + preferredMatched.length * 0.5;

  return {
    matched,
    missing,
    preferredMatched,
    preferredMissing,
    matchScore: total > 0 ? Math.round((earned / total) * 100) : 0,
  };
}

const calculateSkillGaps = tool(
  async ({ requiredSkills, candidateSkills, preferredSkills = [] }, config) => {
    const ctx = getContext(config);

    // The job analysis is the source of truth for what the job requires, so a
    // model cannot shrink the gap list by leaving requirements out.
    const required = ctx.jobAnalysis?.requiredSkills?.length
      ? ctx.jobAnalysis.requiredSkills
      : requiredSkills;
    const preferred = ctx.jobAnalysis?.preferredSkills?.length
      ? ctx.jobAnalysis.preferredSkills
      : preferredSkills;

    return compareSkills({ requiredSkills: required, preferredSkills: preferred, candidateSkills });
  },
  {
    name: "calculate_skill_gaps",
    description:
      "Compare the job's requirements against the skills the resume evidence supports. Returns matched skills, missing skills and a match score. candidateSkills must contain only skills backed by resume evidence, worded the way the job description words them when they are the same skill.",
    schema: z.object({
      requiredSkills: z.array(z.string()).describe("The job's required skills"),
      candidateSkills: z.array(z.string()).describe("Skills the resume evidence supports"),
      preferredSkills: z.array(z.string()).optional().describe("The job's nice-to-have skills"),
    }),
  },
);

module.exports = { calculateSkillGaps, compareSkills };
