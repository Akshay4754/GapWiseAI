// Text helpers shared by the deterministic tools. Everything here is plain
// JavaScript so that skill matching and claim checks behave the same every run.

const STOP_WORDS = new Set([
  "a", "an", "and", "as", "at", "for", "in", "of", "on", "or", "the", "to", "with", "using",
]);

const ALIASES = {
  js: "javascript",
  es6: "javascript",
  html5: "html",
  css3: "css",
  ts: "typescript",
  nodejs: "node",
  reactjs: "react",
  expressjs: "express",
  vuejs: "vue",
  nextjs: "next",
  k8s: "kubernetes",
  postgres: "postgresql",
  mongo: "mongodb",
  golang: "go",
  restful: "rest",
};

// "Node.js" and "node" should compare equal, but "Java" must never match "JavaScript",
// so this only removes punctuation and a few word endings instead of prefix matching.
function canonicalWord(word) {
  let value = String(word).toLowerCase().replace(/[.\-_/]/g, "");
  value = ALIASES[value] || value;

  for (const suffix of ["ing", "ed", "es", "s"]) {
    if (value.endsWith(suffix) && value.length - suffix.length >= 3) {
      value = value.slice(0, -suffix.length);
      break;
    }
  }
  if (value.endsWith("e") && value.length > 4) {
    value = value.slice(0, -1);
  }

  return value;
}

function tokenize(text) {
  const words = String(text || "").toLowerCase().match(/[a-z0-9][a-z0-9+#.]*[a-z0-9+#]|[a-z0-9]/g) || [];
  return words.map(canonicalWord).filter((word) => word && !STOP_WORDS.has(word));
}

function buildTokenSet(text) {
  return new Set(tokenize(text));
}

// A term counts as present only when every meaningful word of it appears.
function termSupported(term, tokenSet) {
  const words = tokenize(term);
  return words.length > 0 && words.every((word) => tokenSet.has(word));
}

function extractNumbers(text) {
  return String(text || "").match(/\d+(?:[.,]\d+)*/g) || [];
}

function countWords(text) {
  return (String(text || "").match(/\S+/g) || []).length;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// PDF extraction breaks lines in odd places, so a quoted passage is matched
// with any run of whitespace between its words.
function buildFlexiblePattern(passage) {
  const parts = String(passage || "").trim().split(/\s+/).filter(Boolean).map(escapeRegex);
  return parts.length > 0 ? new RegExp(parts.join("\\s+")) : null;
}

const SECTION_PATTERNS = {
  summary: /^(professional\s+)?(summary|profile|objective|about(\s+me)?)\b/i,
  experience: /^(work\s+|professional\s+)?(experience|employment|internships?)\b/i,
  projects: /^(key\s+|academic\s+|personal\s+)?projects?\b/i,
  education: /^(education|academics?)\b/i,
  skills: /^(technical\s+|core\s+|key\s+)?(skills|technologies|tech\s+stack|competenc)/i,
  achievements: /^(achievements?|awards?|certifications?|leadership)\b/i,
};

function isHeadingLine(line) {
  const trimmed = line.trim().replace(/[:\-–—]+$/, "").trim();
  return trimmed.length > 0 && trimmed.length <= 40 && countWords(trimmed) <= 5;
}

function detectSections(text) {
  const found = new Set();
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!isHeadingLine(line)) continue;
    for (const [name, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(line.trim())) found.add(name);
    }
  }
  return [...found];
}

// The PDF extractor writes "-- 1 of 2 --" between pages; that is not resume content.
function cleanResumeText(text) {
  return String(text || "")
    .replace(/^[ \t]*-- \d+ of \d+ --[ \t]*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = typeof value === "string" ? value.trim() : "";
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      result.push(text);
    }
  }
  return result;
}

module.exports = {
  SECTION_PATTERNS,
  buildFlexiblePattern,
  buildTokenSet,
  canonicalWord,
  cleanResumeText,
  countWords,
  detectSections,
  extractNumbers,
  isHeadingLine,
  termSupported,
  tokenize,
  uniqueStrings,
};
