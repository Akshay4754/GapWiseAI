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
 * @description Service to start a multi-agent resume optimisation run for an interview report.
 */
export const startAgentRun = async ({ interviewReportId, goal }) => {
  const response = await api.post("/api/agent/runs", { interviewReportId, goal });

  return response.data;
};

/**
 * @description Service to get the most recent agent run of an interview report (run is null when there is none).
 */
export const getLatestAgentRun = async (interviewReportId) => {
  const response = await api.get("/api/agent/runs/latest", {
    params: { interviewReportId },
  });

  return response.data;
};

/**
 * @description Service to get an agent run with its plan, activity log and results.
 */
export const getAgentRun = async (runId) => {
  const response = await api.get(`/api/agent/runs/${runId}`);

  return response.data;
};

/**
 * @description Service to apply the edits the user approved.
 */
export const approveAgentRun = async (runId, editIds) => {
  const response = await api.post(`/api/agent/runs/${runId}/approve`, { editIds });

  return response.data;
};

/**
 * @description Service to export the approved resume as a pdf.
 */
export const exportAgentRunPdf = async (runId) => {
  const response = await api.post(`/api/agent/runs/${runId}/export`, null, {
    responseType: "arraybuffer",
    headers: {
      Accept: "application/pdf",
    },
  });

  return response.data;
};
