const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { extractPdfTextFromBuffer } = require("../../services/rag.service");
const { detectSections } = require("../text");
const { getContext } = require("./context");

const MAX_RESUME_CHARS = 9000;

const extractResume = tool(
  async (_input, config) => {
    const ctx = getContext(config);
    let source = "stored";

    if (!ctx.resumeText?.trim() && ctx.resumeBuffer) {
      ctx.resumeText = await extractPdfTextFromBuffer(ctx.resumeBuffer);
      source = "pdf";
    }

    const text = (ctx.resumeText || "").trim();
    ctx.resumeRead = Boolean(text);
    if (!text) {
      return {
        found: false,
        message: "No resume text is available. The user needs to upload a resume PDF.",
      };
    }

    return {
      found: true,
      source,
      characters: text.length,
      truncated: text.length > MAX_RESUME_CHARS,
      sections: detectSections(text),
      text: text.slice(0, MAX_RESUME_CHARS),
    };
  },
  {
    name: "extract_resume",
    description:
      "Read the candidate's resume. Extracts the text from the uploaded PDF when it has not been extracted yet, and returns the full resume text with the sections it contains.",
    schema: z.object({}),
  },
);

module.exports = { extractResume, MAX_RESUME_CHARS };
