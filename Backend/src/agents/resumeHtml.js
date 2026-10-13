const { SECTION_PATTERNS, countWords, isHeadingLine } = require("./text");

const BULLET_PATTERN = /^[•●▪◦*\-–]\s+/;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// The PDF extractor writes hyperlinks as [label](url). Those, bare URLs and
// email addresses become real anchors so they stay clickable in the PDF.
function formatInline(line) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|tel:[^\s)]+)\)|(https?:\/\/[^\s|,)]+)|([\w.+-]+@[\w-]+\.[\w.-]+)/g;
  let html = "";
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(line)) !== null) {
    html += escapeHtml(line.slice(lastIndex, match.index));
    if (match[1]) {
      html += `<a href="${escapeHtml(match[2])}">${escapeHtml(match[1])}</a>`;
    } else if (match[3]) {
      html += `<a href="${escapeHtml(match[3])}">${escapeHtml(match[3].replace(/^https?:\/\/(www\.)?/, ""))}</a>`;
    } else {
      html += `<a href="mailto:${escapeHtml(match[4])}">${escapeHtml(match[4])}</a>`;
    }
    lastIndex = pattern.lastIndex;
  }

  return html + escapeHtml(line.slice(lastIndex));
}

function isSectionHeading(line) {
  if (!isHeadingLine(line)) return false;
  const text = line.trim().replace(/[:\-–—]+$/, "").trim();
  // "TECHNICAL SKILLS" is a heading; "CGPA: 8.4" is not.
  const isUpperCase = /^[A-Z][A-Z &/]{2,}$/.test(text);
  return isUpperCase || Object.values(SECTION_PATTERNS).some((pattern) => pattern.test(text));
}

// PDF text is hard-wrapped; a line starting in lower case continues the one above.
const isContinuation = (line) => /^[a-z(]/.test(line);

/**
 * Lays out approved resume text as a one-column, ATS-friendly page. It only
 * formats: every word in the output comes from the text it was given.
 */
function buildResumeHtml(resumeText) {
  const lines = String(resumeText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // The first line is the candidate's name, even when it is written in capitals.
  const firstHeading = lines.findIndex((line, index) => index > 0 && isSectionHeading(line));
  const headerLines = lines.slice(0, firstHeading === -1 ? Math.min(lines.length, 3) : firstHeading);
  const bodyLines = lines.slice(headerLines.length);
  const [name = "Resume", ...contactLines] = headerLines;

  const blocks = [];
  for (const line of bodyLines) {
    const last = blocks[blocks.length - 1];

    if (isSectionHeading(line)) {
      blocks.push({ type: "heading", text: line.replace(/[:\-–—]+$/, "").trim() });
    } else if (BULLET_PATTERN.test(line)) {
      blocks.push({ type: "bullet", text: line.replace(BULLET_PATTERN, "") });
    } else if (last && last.type !== "heading" && isContinuation(line)) {
      last.text += ` ${line}`;
    } else {
      blocks.push({ type: "paragraph", text: line });
    }
  }

  // PDF extraction usually drops bullet markers. Outside the summary, a full
  // sentence on its own line was a bullet in the original.
  let inSummary = false;
  for (const block of blocks) {
    if (block.type === "heading") {
      inSummary = SECTION_PATTERNS.summary.test(block.text);
    } else if (block.type === "paragraph" && !inSummary && /[.!?]$/.test(block.text) && countWords(block.text) >= 5) {
      block.type = "bullet";
    }
  }

  let body = "";
  let listOpen = false;
  for (const [index, block] of blocks.entries()) {
    if (block.type !== "bullet" && listOpen) {
      body += "</ul>";
      listOpen = false;
    }

    if (block.type === "heading") {
      body += `<h2>${escapeHtml(block.text)}</h2>`;
    } else if (block.type === "bullet") {
      if (!listOpen) {
        body += "<ul>";
        listOpen = true;
      }
      body += `<li>${formatInline(block.text)}</li>`;
    } else {
      // A line that introduces bullets is a job or project title.
      const isEntryTitle = blocks[index + 1]?.type === "bullet";
      body += `<p${isEntryTitle ? ' class="entry"' : ""}>${formatInline(block.text)}</p>`;
    }
  }
  if (listOpen) body += "</ul>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(name)} Resume</title>
<style>
  html, body { margin: 0; padding: 0; }
  body { font-family: Calibri, Arial, Helvetica, sans-serif; color: #1c2520; font-size: 10pt; line-height: 1.32; }
  h1 { margin: 0 0 3pt; font-size: 21pt; letter-spacing: -.01em; text-align: center; }
  .contact { margin: 0 0 8pt; color: #46524b; font-size: 9.5pt; text-align: center; }
  h2 { margin: 9pt 0 4pt; padding-bottom: 2pt; border-bottom: 1px solid #b9c7be; color: #2f5a40; font-size: 11pt; letter-spacing: .05em; text-transform: uppercase; break-after: avoid; }
  p { margin: 0 0 3pt; }
  p.entry { margin-top: 5pt; font-weight: 700; break-after: avoid; }
  ul { margin: 0 0 4pt; padding-left: 14pt; }
  li { margin-bottom: 2pt; break-inside: avoid; }
  a { color: #2f5a40; text-decoration: none; }
</style>
</head>
<body>
<h1>${escapeHtml(name)}</h1>
${contactLines.length > 0 ? `<p class="contact">${contactLines.map(formatInline).join(" | ")}</p>` : ""}
${body}
</body>
</html>`;
}

module.exports = { buildResumeHtml };
