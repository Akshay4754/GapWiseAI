const request = require("supertest");
const app = require("../server"); // adjust path if your entry file is named differently

// ── Test 1: Health / Root route ───────────────────────────────
describe("GET / — Server health check", () => {
  it("should return 200 and confirm server is running", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
  });
});

// ── Test 2: Auth — Register route ─────────────────────────────
describe("POST /api/auth/register — User registration", () => {
  it("should return 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({}); // empty body — should fail validation
    expect(res.statusCode).toBe(400);
  });

  it("should return 400 for invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email: "not-an-email", password: "pass1234" });
    expect([400, 422]).toContain(res.statusCode);
  });
});

// ── Test 3: Auth — Login route ────────────────────────────────
describe("POST /api/auth/login — User login", () => {
  it("should return 400 or 401 for wrong credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.com", password: "wrongpassword" });
    expect([400, 401]).toContain(res.statusCode);
  });
});

// ── Test 4: Protected route — no token ────────────────────────
describe("POST /api/analyze — Protected route without token", () => {
  it("should return 401 when no auth token is provided", async () => {
    const res = await request(app)
      .post("/api/analyze")
      .send({ jobDescription: "Some JD text" });
    expect(res.statusCode).toBe(401);
  });
});

// ── Test 5: Resume generate — no token ────────────────────────
describe("POST /api/resume/generate — Protected route without token", () => {
  it("should return 401 when no auth token is provided", async () => {
    const res = await request(app)
      .post("/api/resume/generate")
      .send({});
    expect(res.statusCode).toBe(401);
  });
});
