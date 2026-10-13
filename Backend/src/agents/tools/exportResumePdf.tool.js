const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { generatePdfFromHtml } = require("../../services/ai.service");
const { buildResumeHtml } = require("../resumeHtml");
const { getContext } = require("./context");

const exportResumePdf = tool(
  async (_input, config) => {
    const ctx = getContext(config);
    const finalResume = (ctx.finalResume || "").trim();

    if (!finalResume) {
      return { exported: false, message: "There is no approved resume to export yet." };
    }

    // Puppeteer returns a Uint8Array; Express and tests expect a Buffer.
    ctx.pdfBuffer = Buffer.from(await generatePdfFromHtml(buildResumeHtml(finalResume)));

    return { exported: true, bytes: ctx.pdfBuffer.length };
  },
  {
    name: "export_resume_pdf",
    description:
      "Generate the downloadable PDF of the approved resume. Only works after the user has approved the edits.",
    schema: z.object({}),
  },
);

module.exports = { exportResumePdf };
