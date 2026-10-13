// The PDF and vector services are not needed for the rule-based tools
jest.mock("../src/services/ai.service", () => ({ generatePdfFromHtml: jest.fn() }));
jest.mock("../src/services/rag.service", () => ({
  extractPdfTextFromBuffer: jest.fn(),
  retrieveRelevantChunks: jest.fn(),
}));

const ragService = require("../src/services/rag.service");
const aiService = require("../src/services/ai.service");
const tools = require("../src/agents/tools");
const { withContext } = require("../src/agents/tools/context");
const { compareSkills } = require("../src/agents/tools/calculateSkillGaps.tool");
const { applyEdits } = require("../src/agents/tools/applyResumeEdits.tool");
const { validateClaims } = require("../src/agents/tools/validateResumeClaims.tool");
const { assessResumeQuality } = require("../src/agents/tools/validateResumeQuality.tool");
const { buildResumeHtml } = require("../src/agents/resumeHtml");

const RESUME = `JANE DOE
jane@example.com | [GitHub](https://github.com/jane)

SKILLS
JavaScript, Node.js, Express, MongoDB, Docker

PROJECTS
Shop API | Node.js, Express
• Built an API for a shop with 20 endpoints.
• Set up GitHub Actions to run tests and
  build Docker images.

EDUCATION
B.Tech in Computer Science, 2026`;

const jobAnalysis = {
  title: "Backend Engineer",
  requiredSkills: ["Node.js", "Docker", "Kubernetes", "CI/CD"],
  preferredSkills: ["TypeScript"],
  responsibilities: [],
  keywords: ["REST APIs"],
};

beforeEach(() => jest.resetAllMocks());

describe("calculate_skill_gaps", () => {
  it("should match skills despite spelling differences and report the rest as missing", () => {
    const result = compareSkills({
      requiredSkills: ["Node.js", "REST APIs", "Kubernetes"],
      preferredSkills: ["TypeScript"],
      candidateSkills: ["NodeJS", "RESTful API design", "TS"],
    });

    expect(result.matched).toEqual(["Node.js", "REST APIs"]);
    expect(result.missing).toEqual(["Kubernetes"]);
    expect(result.preferredMatched).toEqual(["TypeScript"]);
    expect(result.matchScore).toBe(71);
  });

  it("should not let Java count as JavaScript", () => {
    const result = compareSkills({ requiredSkills: ["Java"], candidateSkills: ["JavaScript"] });
    expect(result.missing).toEqual(["Java"]);
  });

  it("should use the analysed job requirements over the ones the model passes", async () => {
    const result = await tools.calculateSkillGaps.invoke(
      { requiredSkills: ["Node.js"], candidateSkills: ["Node.js"] },
      withContext({ jobAnalysis }),
    );

    expect(result.missing).toEqual(["Docker", "Kubernetes", "CI/CD"]);
  });
});

describe("apply_resume_edits", () => {
  it("should replace a passage even when the PDF wrapped it across lines", () => {
    const { text, results } = applyEdits(RESUME, [
      {
        id: "e1",
        original: "• Set up GitHub Actions to run tests and build Docker images.",
        replacement: "Configured GitHub Actions to run tests and build Docker images.",
      },
    ]);

    expect(results[0].applied).toBe(true);
    expect(text).toContain("• Configured GitHub Actions to run tests and build Docker images.");
    expect(text).not.toContain("Set up GitHub Actions");
  });

  it("should report an edit whose original text is not in the resume", () => {
    const { text, results } = applyEdits(RESUME, [
      { id: "e1", original: "Managed a team of five engineers.", replacement: "Led five engineers." },
    ]);

    expect(results[0]).toMatchObject({ applied: false, mode: "not_found" });
    expect(text).toBe(RESUME);
  });

  it("should add a new line under the named section", () => {
    const { text } = applyEdits(RESUME, [
      { id: "e1", section: "Skills", original: "", replacement: "Tools: Git, GitHub Actions" },
    ]);

    expect(text).toContain("SKILLS\nTools: Git, GitHub Actions\nJavaScript");
  });

  it("should work on a copy and keep earlier accepted edits", async () => {
    const ctx = {
      resumeText: RESUME,
      acceptedEdits: [{ id: "a1", original: "• Built an API for a shop with 20 endpoints.", replacement: "• Built a shop API with 20 endpoints." }],
    };

    const result = await tools.applyResumeEdits.invoke(
      {
        edits: [
          {
            section: "Education",
            original: "B.Tech in Computer Science, 2026",
            replacement: "B.Tech in Computer Science (2026)",
            reason: "Consistent date format",
            evidence: "B.Tech in Computer Science, 2026",
          },
        ],
      },
      withContext(ctx),
    );

    expect(result.applied).toBe(1);
    expect(ctx.appliedText).toContain("Built a shop API with 20 endpoints.");
    expect(ctx.appliedText).toContain("B.Tech in Computer Science (2026)");
    expect(ctx.resumeText).toBe(RESUME);
    expect(ctx.appliedEdits[0].id).toMatch(/^edit-/);
  });
});

describe("validate_resume_claims", () => {
  const check = (edit, extra = {}) =>
    validateClaims({ edits: [{ id: "e1", ...edit }], resumeText: RESUME, jobAnalysis, ...extra }).results[0];

  it("should support a rewording that only uses resume facts", () => {
    const result = check({
      original: "• Built an API for a shop with 20 endpoints.",
      replacement: "Developed a shop API in Node.js and Express with 20 endpoints.",
    });
    expect(result.status).toBe("supported");
  });

  it("should reject a job skill the resume has no evidence for", () => {
    const result = check({
      original: "• Set up GitHub Actions to run tests and build Docker images.",
      replacement: "Deployed Docker images to Kubernetes with GitHub Actions.",
    });
    expect(result.status).toBe("unsupported");
    expect(result.unsupportedTerms).toEqual(["Kubernetes"]);
  });

  it("should reject an invented number", () => {
    const result = check({
      original: "• Built an API for a shop with 20 endpoints.",
      replacement: "Built a shop API with 20 endpoints, cutting response time by 40%.",
    });
    expect(result.status).toBe("unsupported");
    expect(result.unsupportedTerms).toEqual(["40"]);
  });

  it("should send an evidence-backed inference to the reviewer", () => {
    const candidateProfile = {
      skills: [{ name: "CI/CD", evidence: "Set up GitHub Actions to run tests", verified: true }],
    };
    const result = check(
      {
        original: "• Set up GitHub Actions to run tests and build Docker images.",
        replacement: "Built a CI/CD pipeline with GitHub Actions to run tests and build Docker images.",
      },
      { candidateProfile },
    );

    expect(result.status).toBe("needs_review");
    expect(result.inferredTerms).toEqual([{ term: "CI/CD", evidence: "Set up GitHub Actions to run tests" }]);
  });

  it("should never accept a skill reported as a gap, even with a quote attached", () => {
    const result = check(
      {
        original: "• Set up GitHub Actions to run tests and build Docker images.",
        replacement: "Ran Kubernetes deployments from GitHub Actions.",
      },
      {
        candidateProfile: { skills: [{ name: "Kubernetes", evidence: "build Docker images", verified: true }] },
        skillGaps: { missing: [{ skill: "Kubernetes", severity: "high" }] },
      },
    );
    expect(result.status).toBe("unsupported");
  });

  it("should not let a longer gap block a different, proven skill", () => {
    const result = validateClaims({
      edits: [{ id: "e1", original: "JavaScript, Node.js, Express, MongoDB, Docker", replacement: "JavaScript, CSS, Node.js, Express, MongoDB, Docker" }],
      resumeText: RESUME,
      jobAnalysis: { requiredSkills: ["CSS"], preferredSkills: ["Tailwind CSS"], keywords: [] },
      candidateProfile: { skills: [{ name: "CSS", evidence: "Shop API | Node.js, Express", verified: true }] },
      skillGaps: { missing: [{ skill: "Tailwind CSS", severity: "low" }] },
    }).results[0];

    expect(result.status).toBe("needs_review");
    expect(result.inferredTerms.map((item) => item.term)).toEqual(["CSS"]);
  });

  it("should flag a named tool the resume never mentions for review", () => {
    const result = check({
      original: "• Built an API for a shop with 20 endpoints.",
      replacement: "Built a shop API with 20 endpoints and Grafana dashboards.",
    });
    expect(result.status).toBe("needs_review");
    expect(result.unverifiedTerms).toEqual(["Grafana"]);
  });

  it("should reject an edit that could not be placed in the resume", () => {
    const result = check({ applied: false, original: "x", replacement: "Reworded line." });
    expect(result.status).toBe("unsupported");
  });
});

describe("validate_resume_quality", () => {
  it("should pass an edited resume that keeps its sections and raises keyword coverage", () => {
    const edited = RESUME.replace("Built an API", "Built REST APIs");
    const report = assessResumeQuality({ text: edited, originalText: RESUME, jobAnalysis });

    expect(report.passed).toBe(true);
    expect(report.keywordCoverage.percent).toBeGreaterThan(report.keywordCoverage.percentBefore);
    expect(report.keywordCoverage.missing).toContain("Kubernetes");
  });

  it("should fail when an edit removes a section or leaves placeholder text", () => {
    const edited = RESUME.replace("EDUCATION", "").replace("Shop API", "[Company] API");
    const report = assessResumeQuality({ text: edited, originalText: RESUME, jobAnalysis });

    expect(report.passed).toBe(false);
    expect(report.issues.join(" ")).toMatch(/Sections kept/);
    expect(report.issues.join(" ")).toMatch(/placeholder/);
  });

  it("should only warn about things the original resume already lacked", () => {
    const report = assessResumeQuality({ text: "Just one line.", originalText: "Just one line.", jobAnalysis });

    expect(report.passed).toBe(true);
    expect(report.score).toBeLessThan(100);
  });
});

describe("extract_resume and retrieve_resume_evidence", () => {
  it("should extract text from an uploaded PDF once", async () => {
    ragService.extractPdfTextFromBuffer.mockResolvedValue(RESUME);
    const ctx = { resumeText: "", resumeBuffer: Buffer.from("pdf") };

    const result = await tools.extractResume.invoke({}, withContext(ctx));

    expect(result).toMatchObject({ found: true, source: "pdf" });
    expect(result.sections).toEqual(expect.arrayContaining(["skills", "projects", "education"]));
    expect(ctx.resumeText).toBe(RESUME);
  });

  it("should say so when there is no resume", async () => {
    const result = await tools.extractResume.invoke({}, withContext({ resumeText: "" }));
    expect(result.found).toBe(false);
  });

  it("should scope the vector search to the user and this run's resume", async () => {
    ragService.retrieveRelevantChunks.mockResolvedValue([{ pageContent: "Docker images" }]);

    const result = await tools.retrieveResumeEvidence.invoke(
      { query: "Docker" },
      withContext({ userId: "u1", sourceId: "agent-run-1", resumeText: RESUME }),
    );

    expect(result).toMatchObject({ source: "pinecone", found: 1 });
    expect(ragService.retrieveRelevantChunks).toHaveBeenCalledWith({
      query: "Docker",
      topK: 3,
      filter: { userId: "u1", sourceId: "agent-run-1", docType: "resume" },
    });
  });

  it("should search the resume text when the vector index fails", async () => {
    ragService.retrieveRelevantChunks.mockRejectedValue(new Error("pinecone down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const ctx = { userId: "u1", sourceId: "agent-run-1", resumeText: RESUME };
    const found = await tools.retrieveResumeEvidence.invoke({ query: "GitHub Actions" }, withContext(ctx));
    const missing = await tools.retrieveResumeEvidence.invoke({ query: "Kubernetes" }, withContext(ctx));

    expect(found.source).toBe("resume-text");
    expect(found.chunks[0]).toContain("GitHub Actions");
    expect(missing.found).toBe(0);
    warn.mockRestore();
  });
});

describe("export_resume_pdf", () => {
  it("should refuse to export before a resume is approved", async () => {
    const result = await tools.exportResumePdf.invoke({}, withContext({}));

    expect(result.exported).toBe(false);
    expect(aiService.generatePdfFromHtml).not.toHaveBeenCalled();
  });

  it("should render the approved text and hand back a Buffer", async () => {
    aiService.generatePdfFromHtml.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    const ctx = { finalResume: RESUME };

    const result = await tools.exportResumePdf.invoke({}, withContext(ctx));

    expect(result).toEqual({ exported: true, bytes: 4 });
    expect(Buffer.isBuffer(ctx.pdfBuffer)).toBe(true);
    expect(aiService.generatePdfFromHtml.mock.calls[0][0]).toContain("<h1>JANE DOE</h1>");
  });

  it("should restore bullets that PDF extraction dropped, but not in the summary", () => {
    const html = buildResumeHtml(`JANE DOE
jane@example.com
SUMMARY
Backend developer who builds APIs with Node.js and Express.
PROJECTS
Shop API | Node.js, Express
Built an API for a shop with 20 endpoints and
wrote tests for every route.
EDUCATION
B.Tech in Computer Science, 2026`);

    expect(html).toContain("<p>Backend developer who builds APIs with Node.js and Express.</p>");
    expect(html).toContain('<p class="entry">Shop API | Node.js, Express</p>');
    expect(html).toContain("<li>Built an API for a shop with 20 endpoints and wrote tests for every route.</li>");
    expect(html).toContain("<p>B.Tech in Computer Science, 2026</p>");
  });

  it("should format headings, bullets and links without changing the words", () => {
    const html = buildResumeHtml(RESUME);

    expect(html).toContain("<h2>SKILLS</h2>");
    expect(html).toContain('<a href="https://github.com/jane">GitHub</a>');
    expect(html).toContain('<a href="mailto:jane@example.com">jane@example.com</a>');
    expect(html).toContain("<li>Set up GitHub Actions to run tests and build Docker images.</li>");
    expect(html).toContain('<p class="entry">Shop API | Node.js, Express</p>');
  });
});
