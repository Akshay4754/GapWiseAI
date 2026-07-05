const {
  generateInterviewReport,
  generateResumePdf,
  answerQuestionFromPdf,
} = require("../services/ai.service");
const {
  extractPdfTextFromBuffer,
  formatRetrievedChunks,
  initializeResumeCollection,
  retrieveRelevantPdfChunks,
  retrieveRelevantResumeChunks,
} = require("../services/rag.service");
const interviewReportModel = require("../models/interviewReport.model");

/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {
  try {
    const selfDescription = req.body.selfDescription?.trim() || "";
    const jobDescription = req.body.jobDescription?.trim() || "";

    if (!jobDescription) {
      return res.status(400).json({
        message: "Job description is required.",
      });
    }

    let resumeText = "";
    if (req.file) {
      const isPdfMime = req.file.mimetype === "application/pdf";
      const isPdfByName =
        typeof req.file.originalname === "string" &&
        req.file.originalname.toLowerCase().endsWith(".pdf");

      if (!isPdfMime && !isPdfByName) {
        return res.status(400).json({
          message: "Only PDF resumes are supported right now.",
        });
      }

      try {
        resumeText = await extractPdfTextFromBuffer(req.file.buffer);
      } catch (parseError) {
        resumeText = `Resume uploaded: ${req.file.originalname || "resume.pdf"}`;
      }

      if (!resumeText) {
        resumeText = `Resume uploaded: ${req.file.originalname || "resume.pdf"}`;
      }
    }

    if (!resumeText && !selfDescription) {
      return res.status(400).json({
        message: "Upload a resume or add a self-description to continue.",
      });
    }

    let resumeForAi = resumeText;
    let ragMetadata = { used: false, chunksRetrieved: 0, source: "pinecone" };

    if (resumeText && req.file) {
      try {
        const sourceId = `resume-${req.user.id}-${Date.now()}`;

        await initializeResumeCollection(req.user.id, resumeText, {
          sourceId,
          fileName: req.file.originalname || "resume.pdf",
          docType: "resume",
        });

        const relevantChunks = await retrieveRelevantResumeChunks(
          req.user.id,
          jobDescription,
          5,
          {
            sourceId,
            docType: "resume",
          },
        );

        if (relevantChunks.length > 0) {
          resumeForAi = formatRetrievedChunks(relevantChunks);
          ragMetadata = {
            used: true,
            chunksRetrieved: relevantChunks.length,
            source: "pinecone",
            sourceId,
          };
          console.log(
            `[RAG] Retrieved ${relevantChunks.length} relevant chunks for user ${req.user.id}`,
          );
        }
      } catch (ragError) {
        console.warn(
          "[RAG] Pipeline failed, using full resume:",
          ragError.message,
        );
        resumeForAi = resumeText;
      }
    }

    const interViewReportByAi = await generateInterviewReport({
      resume: resumeForAi,
      selfDescription,
      jobDescription,
    });

    const interviewReport = await interviewReportModel.create({
      user: req.user.id,
      resume: resumeText,
      selfDescription,
      jobDescription,
      ragMetadata,
      ...interViewReportByAi,
    });

    res.status(201).json({
      message: "Interview report generated successfully.",
      interviewReport,
    });
  } catch (error) {
    console.error("Failed to generate interview report:", error);

    if (error?.code === "MISSING_AI_API_KEY") {
      return res.status(500).json({
        message: error.message,
      });
    }

    if (error?.code === "MISSING_PINECONE_CONFIG") {
      return res.status(500).json({
        message: error.message,
      });
    }

    if (error?.status === 429 || error?.status === 503) {
      return res.status(error.status).json({
        message:
          "AI service is temporarily busy. Please try again in a moment.",
      });
    }

    if (error?.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: "Failed to generate interview report. Please try again.",
    });
  }
}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {
  const { interviewId } = req.params;

  const interviewReport = await interviewReportModel.findOne({
    _id: interviewId,
    user: req.user.id,
  });

  if (!interviewReport) {
    return res.status(404).json({
      message: "Interview report not found.",
    });
  }

  res.status(200).json({
    message: "Interview report fetched successfully.",
    interviewReport,
  });
}

/**
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
  const interviewReports = await interviewReportModel
    .find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .select(
      "-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan",
    );

  res.status(200).json({
    message: "Interview reports fetched successfully.",
    interviewReports,
  });
}

/**
 * @description Controller to answer a question from an uploaded PDF using RAG.
 */
async function askFromPdfController(req, res) {
  try {
    const question = req.body.question?.trim() || "";

    if (!question) {
      return res.status(400).json({
        message: "Question is required.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a PDF file.",
      });
    }

    const isPdfMime = req.file.mimetype === "application/pdf";
    const isPdfByName =
      typeof req.file.originalname === "string" &&
      req.file.originalname.toLowerCase().endsWith(".pdf");

    if (!isPdfMime && !isPdfByName) {
      return res.status(400).json({
        message: "Only PDF files are supported for Ask From PDF.",
      });
    }

    const pdfText = await extractPdfTextFromBuffer(req.file.buffer);

    if (!pdfText) {
      return res.status(400).json({
        message: "Could not extract text from the uploaded PDF.",
      });
    }

    const sourceId = `pdf-${req.user.id}-${Date.now()}`;
    let relevantChunks = [];
    let context = pdfText.slice(0, 6000);

    try {
      await initializeResumeCollection(req.user.id, pdfText, {
        sourceId,
        fileName: req.file.originalname || "document.pdf",
        docType: "pdf-qa",
      });

      relevantChunks = await retrieveRelevantPdfChunks(
        req.user.id,
        question,
        5,
        {
          sourceId,
          docType: "pdf-qa",
        },
      );

      if (relevantChunks.length > 0) {
        context = formatRetrievedChunks(relevantChunks);
      }
    } catch (ragError) {
      console.warn(
        "[RAG] Ask From PDF retrieval failed, using extracted PDF text:",
        ragError.message,
      );
    }

    const answer = await answerQuestionFromPdf({
      question,
      context,
      documentName: req.file.originalname || "Uploaded PDF",
    });

    return res.status(200).json({
      message: "PDF question answered successfully.",
      answer: answer.answer,
      supportingPoints: answer.supportingPoints,
      sources:
        relevantChunks.length > 0
          ? relevantChunks.map((chunk) => ({
              fileName:
                chunk.metadata?.fileName ||
                req.file.originalname ||
                "Uploaded PDF",
              chunk: chunk.pageContent,
            }))
          : [
              {
                fileName: req.file.originalname || "Uploaded PDF",
                chunk: pdfText.slice(0, 6000),
              },
            ],
    });
  } catch (error) {
    console.error("Failed to answer question from PDF:", error);

    if (error?.code === "MISSING_AI_API_KEY") {
      return res.status(500).json({
        message: error.message,
      });
    }

    if (error?.code === "MISSING_PINECONE_CONFIG") {
      return res.status(500).json({
        message: error.message,
      });
    }

    if (error?.status === 429 || error?.status === 503) {
      return res.status(error.status).json({
        message:
          "AI service is temporarily busy. Please try again in a moment.",
      });
    }

    res.status(500).json({
      message: "Failed to answer the PDF question. Please try again.",
    });
  }
}

/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
  try {
    const { interviewReportId } = req.params;

    const interviewReport = await interviewReportModel.findOne({
      _id: interviewReportId,
      user: req.user.id,
    });

    if (!interviewReport) {
      return res.status(404).json({
        message: "Interview report not found.",
      });
    }

    const { resume, jobDescription, selfDescription } = interviewReport;

    const pdfBuffer = await generateResumePdf({
      resume,
      jobDescription,
      selfDescription,
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Failed to generate resume PDF:", error);

    if (error?.code === "MISSING_AI_API_KEY") {
      return res.status(500).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: "Failed to generate resume PDF. Please try again.",
    });
  }
}

module.exports = {
  generateInterViewReportController,
  getInterviewReportByIdController,
  getAllInterviewReportsController,
  generateResumePdfController,
  askFromPdfController,
};
