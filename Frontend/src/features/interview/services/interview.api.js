import axios from "axios";

const normalizedApiUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const api = axios.create({
  baseURL: normalizedApiUrl,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

/**
 * @description Service to generate interview report based on user self description, resume and job description.
 */
export const generateInterviewReport = async ({
  jobDescription,
  selfDescription,
  resumeFile,
}) => {
  const formData = new FormData();
  formData.append("jobDescription", jobDescription || "");
  formData.append("selfDescription", selfDescription || "");

  const hasSelectedResume =
    resumeFile &&
    typeof resumeFile === "object" &&
    typeof resumeFile.name === "string";
  if (hasSelectedResume) {
    formData.append("resume", resumeFile);
  }

  const response = await api.post("/api/interview/", formData);

  return response.data;
};

/**
 * @description Service to get interview report by interviewId.
 */
export const getInterviewReportById = async (interviewId) => {
  const response = await api.get(`/api/interview/report/${interviewId}`);

  return response.data;
};

/**
 * @description Service to get all interview reports of logged in user.
 */
export const getAllInterviewReports = async () => {
  const response = await api.get("/api/interview/");

  return response.data;
};

/**
 * @description Service to generate resume pdf based on user self description, resume content and job description.
 */
export const generateResumePdf = async ({ interviewReportId }) => {
  const response = await api.post(
    `/api/interview/resume/pdf/${interviewReportId}`,
    null,
    {
      responseType: "arraybuffer",
      headers: {
        Accept: "application/pdf",
      },
    },
  );

  return response.data;
};

/**
 * @description Service to ask a question from an uploaded PDF using RAG.
 */
export const askQuestionFromPdf = async ({ pdfFile, question }) => {
  const formData = new FormData();
  formData.append("question", question || "");

  const hasPdfFile =
    pdfFile && typeof pdfFile === "object" && typeof pdfFile.name === "string";
  if (hasPdfFile) {
    formData.append("pdf", pdfFile);
  }

  const response = await api.post("/api/interview/ask-from-pdf", formData);

  return response.data;
};
