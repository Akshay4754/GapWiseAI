const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const {
  buildTokenSet,
  countWords,
  detectSections,
  termSupported,
  uniqueStrings,
} = require("../text");
const { getContext } = require("./context");

const MAX_WORDS = 900;
const MAX_BULLET_WORDS = 45;
const PLACEHOLDER_PATTERN = /\[[^\]]*(your|insert|add|company|number|x%)[^\]]*\]|\bTODO\b|\bXYZ\b|lorem ipsum|<[^>]*(insert|placeholder)[^>]*>/i;
const FIRST_PERSON_PATTERN = /\b(I|my|me)\b/g;

function getKeywordCoverage(text, jobTerms) {
  const tokens = buildTokenSet(text);
  const covered = jobTerms.filter((term) => termSupported(term, tokens));
  return {
    covered,
    missing: jobTerms.filter((term) => !covered.includes(term)),
    percent: jobTerms.length > 0 ? Math.round((covered.length / jobTerms.length) * 100) : 100,
  };
}

const countMatches = (text, pattern) => (text.match(pattern) || []).length;

const countLongBullets = (text) =>
  text.split(/\r?\n/).filter((line) => countWords(line) > MAX_BULLET_WORDS).length;

/**
 * Rule-based resume check. "critical" checks fail only for problems the edits
 * introduced; things the original resume already lacked are "warning" checks.
 */
function assessResumeQuality({ text = "", originalText = "", jobAnalysis }) {
  const jobTerms = uniqueStrings([
    ...(jobAnalysis?.requiredSkills || []),
    ...(jobAnalysis?.preferredSkills || []),
    ...(jobAnalysis?.keywords || []),
  ]);
  const baseline = originalText || text;

  const coverage = getKeywordCoverage(text, jobTerms);
  const coverageBefore = getKeywordCoverage(baseline, jobTerms);
  const sections = detectSections(text);
  const sectionsBefore = detectSections(baseline);
  const words = countWords(text);
  const wordsBefore = countWords(baseline);
  const hasEmail = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text);

  const checks = [
    {
      name: "Keyword coverage",
      severity: "critical",
      passed: coverage.percent >= coverageBefore.percent,
      detail: `${coverage.percent}% of job keywords appear (was ${coverageBefore.percent}%).`,
    },
    {
      name: "Sections kept",
      severity: "critical",
      passed: sectionsBefore.every((section) => sections.includes(section)),
      detail: `Sections found: ${sections.join(", ") || "none"}.`,
    },
    {
      name: "Length",
      severity: "critical",
      passed: words <= Math.max(MAX_WORDS, Math.round(wordsBefore * 1.15)),
      detail: `${words} words (was ${wordsBefore}). One page fits roughly ${MAX_WORDS}.`,
    },
    {
      name: "No placeholder text",
      severity: "critical",
      passed: !PLACEHOLDER_PATTERN.test(text) || PLACEHOLDER_PATTERN.test(baseline),
      detail: "Edits must not leave template text such as [Company] or TODO.",
    },
    {
      name: "Core sections present",
      severity: "warning",
      passed:
        sections.includes("skills") &&
        sections.includes("education") &&
        (sections.includes("experience") || sections.includes("projects")),
      detail: "A resume should have Skills, Education and Experience or Projects.",
    },
    {
      name: "Contact details",
      severity: "warning",
      passed: hasEmail,
      detail: hasEmail ? "An email address is present." : "No email address was found.",
    },
    {
      name: "No first-person wording",
      severity: "warning",
      passed: countMatches(text, FIRST_PERSON_PATTERN) <= countMatches(baseline, FIRST_PERSON_PATTERN),
      detail: "Resume bullets read better without I, my or me.",
    },
    {
      name: "Concise bullets",
      severity: "warning",
      passed: countLongBullets(text) <= countLongBullets(baseline),
      detail: `No line should run past ${MAX_BULLET_WORDS} words.`,
    },
  ];

  const failedCritical = checks.filter((check) => !check.passed && check.severity === "critical");
  const failedWarnings = checks.filter((check) => !check.passed && check.severity === "warning");

  return {
    passed: failedCritical.length === 0,
    score: Math.max(0, 100 - failedCritical.length * 25 - failedWarnings.length * 8),
    checks,
    issues: [...failedCritical, ...failedWarnings].map((check) => `${check.name}: ${check.detail}`),
    keywordCoverage: {
      percent: coverage.percent,
      percentBefore: coverageBefore.percent,
      covered: coverage.covered,
      missing: coverage.missing,
    },
    words,
  };
}

const validateResumeQuality = tool(
  async (_input, config) => {
    const ctx = getContext(config);
    const report = assessResumeQuality({
      text: ctx.appliedText || ctx.resumeText,
      originalText: ctx.resumeText,
      jobAnalysis: ctx.jobAnalysis,
    });

    ctx.qualityReport = report;
    return report;
  },
  {
    name: "validate_resume_quality",
    description:
      "Check the edited resume for job keyword coverage, required sections, length and formatting problems. Returns a score, each check's result and a list of issues.",
    schema: z.object({}),
  },
);

module.exports = { validateResumeQuality, assessResumeQuality };
