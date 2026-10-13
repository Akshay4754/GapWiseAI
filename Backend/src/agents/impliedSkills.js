const { canonicalWord, tokenize } = require("./text");

// Skills a tool cannot be used without. A resume that lists React.js but never
// writes "JavaScript" still demonstrates JavaScript; without this an exact
// comparison reports it as a gap. The list is short on purpose: only
// prerequisites nobody would dispute.
const PREREQUISITES = {
  JavaScript: ["React", "Node.js", "Express", "Vue", "Angular", "Next.js", "TypeScript", "jQuery", "Svelte", "NestJS", "Redux"],
  HTML: ["React", "Vue", "Angular", "Next.js", "Svelte", "jQuery", "Tailwind", "Bootstrap"],
  CSS: ["React", "Vue", "Angular", "Next.js", "Svelte", "Tailwind", "Bootstrap", "Sass"],
  Python: ["Django", "Flask", "FastAPI", "Pandas", "NumPy", "PyTorch", "TensorFlow"],
  Java: ["Spring", "Hibernate"],
  SQL: ["MySQL", "PostgreSQL", "SQLite"],
  Git: ["GitHub", "GitLab", "Bitbucket"],
};

const TABLE = new Map(
  Object.entries(PREREQUISITES).map(([skill, tools]) => [
    canonicalWord(skill),
    tools.map((name) => ({ name, key: canonicalWord(name) })),
  ]),
);

/**
 * The tools named in the resume that prove a single-word job skill, e.g.
 * "JavaScript" → ["React", "Node.js"]. Empty when nothing implies it.
 */
function findImplyingTools(skill, resumeTokens) {
  const words = [...new Set(tokenize(skill))];
  if (words.length !== 1) return [];

  return (TABLE.get(words[0]) || [])
    .filter((tool) => resumeTokens.has(tool.key))
    .map((tool) => tool.name);
}

/** The first resume line that names one of the tools, to quote as evidence. */
function quoteToolLine(resumeText, tools) {
  const keys = new Set(tools.map(canonicalWord));
  const line = String(resumeText || "")
    .split(/\r?\n/)
    .find((candidate) => tokenize(candidate).some((word) => keys.has(word)));

  return (line || tools.join(", ")).trim().slice(0, 180);
}

module.exports = { findImplyingTools, quoteToolLine };
