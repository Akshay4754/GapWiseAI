const request = require("supertest");
const jwt = require("jsonwebtoken");

// No database, Gemini, Pinecone or browser in tests
jest.mock("../src/models/blacklist.model", () => ({ findOne: jest.fn() }));
jest.mock("../src/models/interviewReport.model", () => ({ findOne: jest.fn() }));
jest.mock("../src/models/agentRun.model", () => {
  const Model = jest.fn(function AgentRun(doc) {
    Object.assign(this, doc, { _id: "64b7f0c2a1b2c3d4e5f60003" });
    this.save = jest.fn().mockResolvedValue(this);
    this.toObject = () => JSON.parse(JSON.stringify(this));
  });
  Model.findOne = jest.fn();
  return Model;
});
jest.mock("../src/agents/llm", () => ({ callWithTools: jest.fn(), generateJson: jest.fn() }));
jest.mock("../src/services/ai.service", () => ({
  generatePdfFromHtml: jest.fn(),
  generateInterviewReport: jest.fn(),
  generateResumePdf: jest.fn(),
}));
jest.mock("../src/services/rag.service", () => ({
  extractPdfTextFromBuffer: jest.fn(),
  retrieveRelevantChunks: jest.fn(),
  initializeResumeCollection: jest.fn(),
}));

process.env.JWT_SECRET = "test-secret";

const app = require("../src/app");
const blacklistModel = require("../src/models/blacklist.model");
const interviewReportModel = require("../src/models/interviewReport.model");
const agentRunModel = require("../src/models/agentRun.model");
const agentRunService = require("../src/services/agentRun.service");
const aiService = require("../src/services/ai.service");
const ragService = require("../src/services/rag.service");

const USER_ID = "64b7f0c2a1b2c3d4e5f60001";
const REPORT_ID = "64b7f0c2a1b2c3d4e5f60002";
const RUN_ID = "64b7f0c2a1b2c3d4e5f60003";

const token = jwt.sign({ id: USER_ID, username: "tester" }, process.env.JWT_SECRET);
const auth = (req) => req.set("Authorization", `Bearer ${token}`);

const RESUME = `JANE DOE
jane@example.com

SKILLS
JavaScript, Node.js, Express, MongoDB, Docker

PROJECTS
Shop API | Node.js, Express
• Built an API for a shop with 20 endpoints.
• Set up GitHub Actions to run tests and build Docker images.

EDUCATION
B.Tech in Computer Science, ABC Institute of Technology, 2026`;

const report = { _id: REPORT_ID, resume: RESUME, jobDescription: "Backend Engineer. Node.js, Docker." };

const buildEdit = (overrides = {}) => ({
  id: "edit-good",
  section: "Projects",
  original: "• Built an API for a shop with 20 endpoints.",
  replacement: "Developed a shop API in Node.js and Express with 20 endpoints.",
  reason: "Names the stack",
  evidence: "Shop API | Node.js, Express",
  keywords: [],
  status: "accepted",
  ...overrides,
});

const buildRun = (overrides = {}) => {
  const run = {
    _id: RUN_ID,
    user: USER_ID,
    status: "awaiting_approval",
    goal: "Optimise my resume for this job.",
    resumeText: RESUME,
    jobDescription: report.jobDescription,
    jobAnalysis: { requiredSkills: ["Node.js", "Docker"], preferredSkills: [], keywords: [] },
    edits: [
      buildEdit(),
      buildEdit({ id: "edit-second", original: "B.Tech in Computer Science, ABC Institute of Technology, 2026", replacement: "B.Tech in Computer Science, ABC Institute of Technology (2026)" }),
      buildEdit({ id: "edit-rejected", status: "rejected", replacement: "Deployed to Kubernetes." }),
    ],
    steps: [],
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  };
  run.toObject = () => JSON.parse(JSON.stringify(run));
  return run;
};

let launchRun;

beforeEach(() => {
  jest.clearAllMocks();
  interviewReportModel.findOne.mockReset();
  agentRunModel.findOne.mockReset();
  blacklistModel.findOne.mockResolvedValue(null);
  launchRun = jest.spyOn(agentRunService, "launchRun").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("Agent routes without a token", () => {
  it("should return 401 for every endpoint", async () => {
    const responses = await Promise.all([
      request(app).post("/api/agent/runs").send({ interviewReportId: REPORT_ID }),
      request(app).get("/api/agent/runs/latest").query({ interviewReportId: REPORT_ID }),
      request(app).get(`/api/agent/runs/${RUN_ID}`),
      request(app).post(`/api/agent/runs/${RUN_ID}/approve`).send({ editIds: [] }),
      request(app).post(`/api/agent/runs/${RUN_ID}/export`),
    ]);

    responses.forEach((res) => expect(res.statusCode).toBe(401));
  });
});

describe("POST /api/agent/runs — Start a run", () => {
  const start = (body) => auth(request(app).post("/api/agent/runs")).send(body);

  it("should return 400 without a resume or a report", async () => {
    const res = await start({ jobDescription: "Backend Engineer" });
    expect(res.statusCode).toBe(400);
  });

  it("should return 404 when the report belongs to another user", async () => {
    interviewReportModel.findOne.mockResolvedValue(null);

    const res = await start({ interviewReportId: REPORT_ID });

    expect(res.statusCode).toBe(404);
    expect(interviewReportModel.findOne).toHaveBeenCalledWith({ _id: REPORT_ID, user: USER_ID });
    expect(launchRun).not.toHaveBeenCalled();
  });

  it("should return 400 when the report has no usable resume text", async () => {
    interviewReportModel.findOne.mockResolvedValue({ ...report, resume: "Resume uploaded: resume.pdf" });
    agentRunModel.findOne.mockResolvedValue(null);

    const res = await start({ interviewReportId: REPORT_ID });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/text of a resume/);
  });

  it("should start a run from a report without echoing the resume back", async () => {
    interviewReportModel.findOne.mockResolvedValue(report);
    agentRunModel.findOne.mockResolvedValue(null);

    const res = await start({ interviewReportId: REPORT_ID });

    expect(res.statusCode).toBe(202);
    expect(res.body.run).toMatchObject({ status: "running", goal: "Optimise my resume for this job." });
    expect(res.body.run.resumeText).toBeUndefined();
    expect(res.body.run.jobDescription).toBeUndefined();
    expect(agentRunModel).toHaveBeenCalledWith(
      expect.objectContaining({ user: USER_ID, interviewReport: REPORT_ID, resumeText: RESUME }),
    );
    expect(launchRun).toHaveBeenCalledWith(RUN_ID);
  });

  it("should return the run already in progress instead of starting another", async () => {
    interviewReportModel.findOne.mockResolvedValue(report);
    agentRunModel.findOne.mockResolvedValue(buildRun({ status: "running" }));

    const res = await start({ interviewReportId: REPORT_ID });

    expect(res.statusCode).toBe(200);
    expect(launchRun).not.toHaveBeenCalled();
  });

  it("should reject an upload that is not a PDF", async () => {
    const res = await auth(request(app).post("/api/agent/runs"))
      .field("jobDescription", "Backend Engineer")
      .attach("resume", Buffer.from("hello"), { filename: "resume.txt", contentType: "text/plain" });

    expect(res.statusCode).toBe(400);
  });

  it("should read an uploaded PDF with the extract_resume tool", async () => {
    ragService.extractPdfTextFromBuffer.mockResolvedValue(`${RESUME}\n\n-- 1 of 1 --\n`);

    const res = await auth(request(app).post("/api/agent/runs"))
      .field("jobDescription", "Backend Engineer. Node.js.")
      .field("goal", "Only tell me my skill gaps.")
      .attach("resume", Buffer.from("%PDF-1.4"), { filename: "jane.pdf", contentType: "application/pdf" });

    expect(res.statusCode).toBe(202);
    expect(ragService.extractPdfTextFromBuffer).toHaveBeenCalledTimes(1);
    // The extractor's page marker is not resume content
    expect(agentRunModel).toHaveBeenCalledWith(expect.objectContaining({ resumeText: RESUME }));
    expect(res.body.run.goal).toBe("Only tell me my skill gaps.");
    expect(res.body.run.steps[0]).toMatchObject({ agent: "user", tool: "extract_resume" });
  });
});

describe("GET /api/agent/runs — Read runs", () => {
  it("should return 404 for another user's run or a malformed id", async () => {
    agentRunModel.findOne.mockResolvedValue(null);

    const foreign = await auth(request(app).get(`/api/agent/runs/${RUN_ID}`));
    const malformed = await auth(request(app).get("/api/agent/runs/not-an-id"));

    expect(foreign.statusCode).toBe(404);
    expect(agentRunModel.findOne).toHaveBeenCalledWith({ _id: RUN_ID, user: USER_ID });
    expect(malformed.statusCode).toBe(404);
  });

  it("should mark a run that stopped writing as failed", async () => {
    const run = buildRun({ status: "running", updatedAt: new Date(Date.now() - 10 * 60 * 1000) });
    agentRunModel.findOne.mockResolvedValue(run);

    const res = await auth(request(app).get(`/api/agent/runs/${RUN_ID}`));

    expect(res.body.run.status).toBe("failed");
    expect(run.save).toHaveBeenCalled();
  });

  it("should return null when a report has no run yet", async () => {
    agentRunModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });

    const res = await auth(request(app).get("/api/agent/runs/latest").query({ interviewReportId: REPORT_ID }));

    expect(res.statusCode).toBe(200);
    expect(res.body.run).toBeNull();
    expect(agentRunModel.findOne).toHaveBeenCalledWith({ user: USER_ID, interviewReport: REPORT_ID });
  });

  it("should return 400 when latest is asked without a report id", async () => {
    const res = await auth(request(app).get("/api/agent/runs/latest"));
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/agent/runs/:runId/approve — Approve edits", () => {
  const approve = (editIds) => auth(request(app).post(`/api/agent/runs/${RUN_ID}/approve`)).send({ editIds });

  it("should return 400 when editIds is not a list", async () => {
    agentRunModel.findOne.mockResolvedValue(buildRun());
    const res = await approve("edit-good");
    expect(res.statusCode).toBe(400);
  });

  it("should return 409 while the agents are still working", async () => {
    agentRunModel.findOne.mockResolvedValue(buildRun({ status: "running" }));
    const res = await approve(["edit-good"]);
    expect(res.statusCode).toBe(409);
  });

  it("should refuse an edit the reviewer rejected", async () => {
    const run = buildRun();
    agentRunModel.findOne.mockResolvedValue(run);

    const res = await approve(["edit-good", "edit-rejected"]);

    expect(res.statusCode).toBe(400);
    expect(run.save).not.toHaveBeenCalled();
  });

  it("should apply only the edits the user selected", async () => {
    const run = buildRun();
    agentRunModel.findOne.mockResolvedValue(run);

    const res = await approve(["edit-good"]);

    expect(res.statusCode).toBe(200);
    expect(res.body.run.status).toBe("approved");
    expect(run.finalResume).toContain("• Developed a shop API in Node.js and Express with 20 endpoints.");
    expect(run.finalResume).toContain("ABC Institute of Technology, 2026");
    expect(run.resumeText).toBe(RESUME);
    expect(run.edits.map((edit) => edit.status)).toEqual(["approved", "declined", "rejected"]);
    expect(run.finalQuality.passed).toBe(true);
    expect(run.steps.map((step) => step.tool)).toEqual(["apply_resume_edits", "validate_resume_quality"]);
  });

  it("should keep the original resume when no edit is selected", async () => {
    const run = buildRun();
    agentRunModel.findOne.mockResolvedValue(run);

    const res = await approve([]);

    expect(res.statusCode).toBe(200);
    expect(run.finalResume).toBe(RESUME);
  });
});

describe("POST /api/agent/runs/:runId/export — Export the PDF", () => {
  it("should return 409 before the edits are approved", async () => {
    agentRunModel.findOne.mockResolvedValue(buildRun());

    const res = await auth(request(app).post(`/api/agent/runs/${RUN_ID}/export`));

    expect(res.statusCode).toBe(409);
    expect(aiService.generatePdfFromHtml).not.toHaveBeenCalled();
  });

  it("should return the approved resume as a PDF", async () => {
    aiService.generatePdfFromHtml.mockResolvedValue(new Uint8Array(Buffer.from("%PDF-1.4 test")));
    const run = buildRun({ status: "approved", finalResume: RESUME });
    agentRunModel.findOne.mockResolvedValue(run);

    const res = await auth(request(app).post(`/api/agent/runs/${RUN_ID}/export`));

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    expect(res.body.toString()).toBe("%PDF-1.4 test");
    expect(aiService.generatePdfFromHtml.mock.calls[0][0]).toContain("<h1>JANE DOE</h1>");
    expect(run.steps[0]).toMatchObject({ agent: "user", tool: "export_resume_pdf" });
  });
});
