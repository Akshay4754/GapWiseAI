const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const {
  buildTokenSet,
  canonicalWord,
  extractNumbers,
  termSupported,
  tokenize,
  uniqueStrings,
} = require("../text");
const { getContext } = require("./context");

// Capitalised or acronym-style words that are not at the start of a sentence
// or bullet are treated as names of tools, products or companies.
function findProperTerms(text) {
  const terms = [];
  const pattern = /(^|[.!?•\n]\s*|[-–—]\s+)?\b([A-Z][A-Za-z0-9+#]*(?:\.[A-Za-z]+)?)/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const startsSentence = match[1] !== undefined || match.index === 0;
    const word = match[2];
    const isAcronym = /^[A-Z0-9+#]{2,}$/.test(word);
    if (word.length > 1 && (!startsSentence || isAcronym)) {
      terms.push(word);
    }
  }

  return uniqueStrings(terms);
}

const sameSkill = (a, b) => {
  const first = tokenize(a);
  const second = new Set(tokenize(b));
  return first.length > 0 && first.every((word) => second.has(word));
};

/**
 * Checks one proposed edit against the resume it claims to be based on.
 * - unsupported: it adds a number the resume never mentions, or a job skill
 *   with no evidence at all (every skill reported as a gap is one of these).
 * - needs_review: it adds a job skill the resume does not name but the analyst
 *   backed with a resume quote, or another named term the resume never uses.
 *   A reviewer has to judge those.
 * - supported: everything new in it appears in the resume.
 */
function validateEdit(edit, { resumeTokens, resumeNumbers, jobTerms, inferredSkills, missingSkills }) {
  const result = {
    editId: edit.id,
    status: "supported",
    unsupportedTerms: [],
    unverifiedTerms: [],
    inferredTerms: [],
    reason: "Every skill, number and named term in the edit appears in the resume.",
  };

  if (edit.applied === false) {
    return {
      ...result,
      status: "unsupported",
      reason: "The text to replace was not found in the resume, so the edit cannot be applied.",
    };
  }

  const originalTokens = buildTokenSet(edit.original);
  const replacementTokens = buildTokenSet(edit.replacement);
  const originalNumbers = new Set(extractNumbers(edit.original));

  const inventedNumbers = uniqueStrings(extractNumbers(edit.replacement)).filter(
    (number) => !originalNumbers.has(number) && !resumeNumbers.has(number),
  );

  const newJobTerms = jobTerms.filter(
    (term) =>
      termSupported(term, replacementTokens) &&
      !termSupported(term, originalTokens) &&
      !termSupported(term, resumeTokens),
  );

  const inventedSkills = [];
  for (const term of newJobTerms) {
    // A gap blocks a term only when the term contains the whole gap: the gap
    // "Tailwind CSS" must not block plain "CSS".
    const backing =
      !missingSkills.some((skill) => sameSkill(skill, term)) &&
      inferredSkills.find((skill) => sameSkill(term, skill.name));

    if (backing) {
      result.inferredTerms.push({ term, evidence: backing.evidence });
    } else {
      inventedSkills.push(term);
    }
  }

  const jobTermWords = new Set(newJobTerms.flatMap((term) => tokenize(term)));
  result.unverifiedTerms = findProperTerms(edit.replacement).filter((term) => {
    const word = canonicalWord(term);
    return !resumeTokens.has(word) && !originalTokens.has(word) && !jobTermWords.has(word);
  });
  result.unsupportedTerms = [...inventedSkills, ...inventedNumbers];

  if (result.unsupportedTerms.length > 0) {
    return {
      ...result,
      status: "unsupported",
      reason: `The resume has no evidence for: ${result.unsupportedTerms.join(", ")}.`,
    };
  }

  if (result.inferredTerms.length > 0 || result.unverifiedTerms.length > 0) {
    const notes = [
      ...result.inferredTerms.map(
        (item) => `"${item.term}" is not named in the resume and is inferred from "${item.evidence}"`,
      ),
      ...(result.unverifiedTerms.length > 0
        ? [`not in the resume: ${result.unverifiedTerms.join(", ")}`]
        : []),
    ];
    return {
      ...result,
      status: "needs_review",
      reason: `Needs a reviewer's judgement: ${notes.join("; ")}.`,
    };
  }

  return result;
}

function validateClaims({ edits = [], resumeText = "", jobAnalysis, candidateProfile, skillGaps }) {
  const context = {
    resumeTokens: buildTokenSet(resumeText),
    resumeNumbers: new Set(extractNumbers(resumeText)),
    jobTerms: uniqueStrings([
      ...(jobAnalysis?.requiredSkills || []),
      ...(jobAnalysis?.preferredSkills || []),
      ...(jobAnalysis?.keywords || []),
    ]),
    // Skills the analyst proved with a real resume quote although the resume does not name them.
    inferredSkills: (candidateProfile?.skills || []).filter((skill) => skill.verified && skill.evidence),
    missingSkills: (skillGaps?.missing || []).map((gap) => gap.skill),
  };

  const results = edits.map((edit) => validateEdit(edit, context));

  return {
    results,
    summary: {
      supported: results.filter((result) => result.status === "supported").length,
      needsReview: results.filter((result) => result.status === "needs_review").length,
      unsupported: results.filter((result) => result.status === "unsupported").length,
    },
  };
}

const validateResumeClaims = tool(
  async ({ editIds }, config) => {
    const ctx = getContext(config);
    const pending = (ctx.pendingEdits || []).filter(
      (edit) => !editIds?.length || editIds.includes(edit.id),
    );

    const report = validateClaims({
      edits: pending,
      resumeText: ctx.resumeText,
      jobAnalysis: ctx.jobAnalysis,
      candidateProfile: ctx.candidateProfile,
      skillGaps: ctx.skillGaps,
    });

    ctx.claimResults = { ...(ctx.claimResults || {}) };
    for (const result of report.results) {
      ctx.claimResults[result.editId] = result;
    }

    return report;
  },
  {
    name: "validate_resume_claims",
    description:
      "Check whether the proposed resume edits are backed by the candidate's resume. Marks each edit supported, needs_review (a claim is inferred rather than stated in the resume) or unsupported (a skill or number with no evidence). Run this before accepting any edit.",
    schema: z.object({
      editIds: z.array(z.string()).optional().describe("Edits to check; leave out to check all pending edits"),
    }),
  },
);

module.exports = { validateResumeClaims, validateClaims, findProperTerms };
