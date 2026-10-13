const { randomUUID } = require("crypto");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { SECTION_PATTERNS, buildFlexiblePattern, isHeadingLine } = require("../text");
const { getContext } = require("./context");

const editSchema = z.object({
  section: z.string().describe("Resume section the edit belongs to, e.g. 'Experience' or 'Summary'"),
  original: z
    .string()
    .describe("Exact text copied from the resume that will be replaced. Empty string to add a new line to the section."),
  replacement: z.string().min(3).describe("The improved text"),
  reason: z.string().describe("Why this edit helps for the target job"),
  evidence: z.string().describe("Quote from the resume that proves the replacement is true"),
  keywords: z.array(z.string()).optional().describe("Job keywords this edit surfaces"),
});

function findHeadingIndex(lines, section) {
  const wanted = String(section || "").trim().toLowerCase();
  if (!wanted) return -1;

  const pattern = Object.entries(SECTION_PATTERNS).find(
    ([name, regex]) => name === wanted || regex.test(wanted),
  )?.[1];

  return lines.findIndex((line) => {
    if (!isHeadingLine(line)) return false;
    const text = line.trim();
    return pattern ? pattern.test(text) : text.toLowerCase().startsWith(wanted);
  });
}

function insertIntoSection(text, section, addition) {
  const lines = text.split(/\r?\n/);
  const headingIndex = findHeadingIndex(lines, section);

  if (headingIndex >= 0) {
    lines.splice(headingIndex + 1, 0, addition);
    return lines.join("\n");
  }

  const heading = String(section || "Additional").trim().toUpperCase();
  return `${text.trimEnd()}\n\n${heading}\n${addition}`;
}

/**
 * Applies edits to resume text and reports, per edit, whether its original
 * passage could be found. The stored resume is never changed here: callers get
 * new text back.
 */
function applyEdits(resumeText, edits = []) {
  let text = String(resumeText || "");
  const results = [];

  for (const edit of edits) {
    const original = (edit.original || "").trim();
    const replacement = (edit.replacement || "").trim();

    if (!original) {
      text = insertIntoSection(text, edit.section, replacement);
      results.push({ editId: edit.id, applied: true, mode: "added" });
      continue;
    }

    const pattern = buildFlexiblePattern(original);
    if (pattern && pattern.test(text)) {
      // Keep the bullet marker when the rewrite dropped it.
      const bullet = /^[•●▪◦*\-–]\s*/.exec(original)?.[0] || "";
      const rewritten = bullet && !/^[•●▪◦*\-–]/.test(replacement) ? `${bullet}${replacement}` : replacement;
      // A function replacement keeps "$" in the new text literal.
      text = text.replace(pattern, () => rewritten);
      results.push({ editId: edit.id, applied: true, mode: "replaced" });
    } else {
      results.push({
        editId: edit.id,
        applied: false,
        mode: "not_found",
        note: "The original text was not found in the resume.",
      });
    }
  }

  return { text, results };
}

const applyResumeEdits = tool(
  async ({ edits }, config) => {
    const ctx = getContext(config);
    const prepared = edits.map((edit) => ({
      ...edit,
      id: `edit-${randomUUID().slice(0, 8)}`,
      keywords: edit.keywords || [],
    }));

    // Earlier accepted edits stay in place so a revision builds on them.
    const base = applyEdits(ctx.resumeText, ctx.acceptedEdits || []);
    const { text, results } = applyEdits(base.text, prepared);

    ctx.appliedText = text;
    ctx.appliedEdits = prepared.map((edit, index) => ({
      ...edit,
      applied: results[index].applied,
    }));

    return {
      applied: results.filter((result) => result.applied).length,
      notApplied: results.filter((result) => !result.applied).length,
      results,
    };
  },
  {
    name: "apply_resume_edits",
    description:
      "Apply a set of edits to a working copy of the resume. Each edit replaces an exact passage copied from the resume, or adds a line to a section when original is empty. Reports which edits could be applied. The candidate's stored resume is not changed.",
    schema: z.object({
      edits: z.array(editSchema).min(1).max(10),
    }),
  },
);

module.exports = { applyResumeEdits, applyEdits, editSchema };
