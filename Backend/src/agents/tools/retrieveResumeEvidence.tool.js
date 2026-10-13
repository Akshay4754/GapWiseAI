const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { retrieveRelevantChunks } = require("../../services/rag.service");
const { tokenize } = require("../text");
const { getContext } = require("./context");

const MAX_CHUNK_CHARS = 700;

// Used when Pinecone is unreachable or has not finished indexing this resume:
// rank overlapping windows of the resume by how many query words they contain.
function searchResumeLocally(resumeText, query, topK) {
  const lines = String(resumeText || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const queryWords = new Set(tokenize(query));
  const windows = [];

  for (let start = 0; start < lines.length; start += 3) {
    const text = lines.slice(start, start + 6).join("\n");
    const words = new Set(tokenize(text));
    const score = [...queryWords].filter((word) => words.has(word)).length;
    if (score > 0) windows.push({ text, score });
  }

  return windows
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((window) => window.text);
}

const retrieveResumeEvidence = tool(
  async ({ query, topK = 3 }, config) => {
    const ctx = getContext(config);
    ctx.resumeRead = true;
    let chunks = [];
    let source = "pinecone";

    if (ctx.sourceId) {
      try {
        const results = await retrieveRelevantChunks({
          query,
          topK,
          filter: { userId: String(ctx.userId), sourceId: ctx.sourceId, docType: "resume" },
        });
        chunks = results.map((chunk) => chunk.pageContent?.trim()).filter(Boolean);
      } catch (error) {
        console.warn("[Agent] Pinecone retrieval failed, searching the resume text:", error.message);
      }
    }

    if (chunks.length === 0) {
      source = "resume-text";
      chunks = searchResumeLocally(ctx.resumeText, query, topK);
    }

    return {
      query,
      source,
      found: chunks.length,
      chunks: chunks.map((chunk) => chunk.slice(0, MAX_CHUNK_CHARS)),
    };
  },
  {
    name: "retrieve_resume_evidence",
    description:
      "Search the candidate's resume for evidence about one skill, technology, responsibility or achievement. Returns the most relevant resume passages, or none when the resume does not mention it.",
    schema: z.object({
      query: z.string().min(2).describe("What to look for, e.g. 'Redis caching' or 'led a team'"),
      topK: z.number().int().min(1).max(5).optional().describe("How many passages to return (default 3)"),
    }),
  },
);

module.exports = { retrieveResumeEvidence, searchResumeLocally };
