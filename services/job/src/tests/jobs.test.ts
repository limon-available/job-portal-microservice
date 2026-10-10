import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  listCompanies: vi.fn(),
  createCompany: vi.fn(),
  updateCompany: vi.fn(),
  deleteCompany: vi.fn(),
  uploadCompanyLogo: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  deleteJob: vi.fn(),
  updateJobStatus: vi.fn(),
  listMyJobs: vi.fn(),
  searchJobs: vi.fn(),
  getPublicJob: vi.fn(),
  getInternalJob: vi.fn(),
}));

vi.mock("../services/job.js", () => ({ ...mocks }));

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.PORT = "5003";
process.env.DB_URL = "postgresql://user:password@localhost:5432/jobs";
const gatewayKey = "job-test-gateway-secret-with-32-characters";
process.env.GATEWAY_INTERNAL_KEY = gatewayKey;
process.env.REDIS_URL = "redis://localhost:6379";
process.env.KAFKA_BROKER = "localhost:9092";
process.env.UPLOAD_SERVICE = "http://localhost:5001";
process.env.INTERNAL_API_KEY = "job-test-internal-key-with-32-characters";

const { default: app } = await import("../app.js");

const recruiterHeaders = {
  "x-gateway-key": gatewayKey,
  "x-user-id": "33",
  "x-user-role": "recruiter",
};
const jobseekerHeaders = {
  "x-gateway-key": gatewayKey,
  "x-user-id": "44",
  "x-user-role": "jobseeker",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listCompanies.mockResolvedValue([{ company_id: 2, name: "Acme" }]);
  mocks.createCompany.mockResolvedValue({ company_id: 2, name: "Acme" });
  mocks.updateCompany.mockResolvedValue({ company_id: 2, name: "Acme Updated" });
  mocks.deleteCompany.mockResolvedValue(undefined);
  mocks.uploadCompanyLogo.mockResolvedValue({ logo_url: "https://cdn.test/logo.png" });
  mocks.createJob.mockResolvedValue({ job_id: 12, slug: "engineer-unique" });
  mocks.updateJob.mockResolvedValue({ job_id: 12, title: "Senior Engineer" });
  mocks.deleteJob.mockResolvedValue(undefined);
  mocks.updateJobStatus.mockResolvedValue({ job_id: 12, status: "open" });
  mocks.listMyJobs.mockResolvedValue([{ job_id: 12 }]);
  mocks.searchJobs.mockResolvedValue({
    jobs: [{ job_id: 12, title: "Engineer" }],
    total: 27,
  });
  mocks.getPublicJob.mockResolvedValue({ job_id: 12, views: 5 });
  mocks.getInternalJob.mockResolvedValue({
    job_id: 12,
    title: "Engineer",
    status: "open",
    posted_by: 33,
  });
});

describe("job API", () => {
  it("exposes health and Prometheus metrics", async () => {
    await request(app).get("/health").expect(200);
    const response = await request(app).get("/metrics").expect(200);
    expect(response.text).toContain("http_server_requests_total");
    expect(response.text).toContain('service="job"');
  });

  it("protects the internal job lookup with the internal API key", async () => {
    await request(app).get("/api/jobs/internal/jobs/12").expect(401);
    await request(app)
      .get("/api/jobs/internal/jobs/12")
      .set("x-internal-key", "job-test-internal-key-with-32-characters")
      .expect(200)
      .expect(({ body }) => expect(body.data.job.posted_by).toBe(33));
  });

  it("allows public job search and returns total pagination metadata", async () => {
    await request(app)
      .get("/api/jobs/jobs?keyword=engineer&location=Remote&jobType=full-time&salaryMin=50000&skills=typescript,react&page=2&limit=10")
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.meta).toEqual({
          total: 27,
          page: 2,
          limit: 10,
          totalPages: 3,
        });
      });
    expect(mocks.searchJobs).toHaveBeenCalledWith(expect.objectContaining({
      keyword: "engineer",
      location: "Remote",
      jobType: "full-time",
      salaryMin: 50000,
      skills: ["typescript", "react"],
      offset: 10,
    }));
  });

  it("returns a public job by ID or slug", async () => {
    await request(app)
      .get("/api/jobs/jobs/engineer-unique")
      .expect(200)
      .expect(({ body }) => expect(body.data.job.job_id).toBe(12));
  });

  it("restricts company and job mutations to recruiters", async () => {
    await request(app)
      .post("/api/jobs/companies")
      .set(jobseekerHeaders)
      .send({ name: "Acme" })
      .expect(403);
    await request(app)
      .post("/api/jobs/jobs")
      .set(jobseekerHeaders)
      .send({})
      .expect(403);
    expect(mocks.createCompany).not.toHaveBeenCalled();
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it("requires a trusted gateway identity on private routes", async () => {
    await request(app)
      .post("/api/jobs/companies")
      .send({ name: "Acme" })
      .expect(401);
  });

  it("creates owned companies and jobs with validated payloads", async () => {
    await request(app)
      .post("/api/jobs/companies")
      .set(recruiterHeaders)
      .send({ name: "Acme", description: "Hiring" })
      .expect(201);
    expect(mocks.createCompany).toHaveBeenCalledWith(33, {
      name: "Acme",
      description: "Hiring",
    });

    await request(app)
      .post("/api/jobs/jobs")
      .set(recruiterHeaders)
      .send({
        title: "Engineer",
        description: "Build things",
        location: "Remote",
        jobType: "full-time",
        salaryMin: 50000,
        salaryMax: 100000,
        experienceYears: 3,
        status: "open",
        companyId: 2,
        skills: ["TypeScript"],
      })
      .expect(201);
    expect(mocks.createJob).toHaveBeenCalledWith(33, expect.objectContaining({
      companyId: 2,
      title: "Engineer",
    }));
  });

  it("validates job salary ranges", async () => {
    await request(app)
      .post("/api/jobs/jobs")
      .set(recruiterHeaders)
      .send({
        title: "Engineer",
        description: "Build things",
        location: "Remote",
        jobType: "full-time",
        salaryMin: 100000,
        salaryMax: 50000,
        companyId: 2,
      })
      .expect(400);
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it("exposes recruiter-owned CRUD and status endpoints", async () => {
    await request(app).get("/api/jobs/companies").set(recruiterHeaders).expect(200);
    await request(app)
      .put("/api/jobs/companies/2")
      .set(recruiterHeaders)
      .send({ name: "Acme Updated" })
      .expect(200);
    await request(app).delete("/api/jobs/companies/2").set(recruiterHeaders).expect(200);
    await request(app).get("/api/jobs/jobs/mine").set(recruiterHeaders).expect(200);
    await request(app)
      .put("/api/jobs/jobs/12")
      .set(recruiterHeaders)
      .send({ title: "Senior Engineer" })
      .expect(200);
    await request(app)
      .patch("/api/jobs/jobs/12/status")
      .set(recruiterHeaders)
      .send({ status: "open" })
      .expect(200);
    await request(app).delete("/api/jobs/jobs/12").set(recruiterHeaders).expect(200);

    expect(mocks.updateJob).toHaveBeenCalledWith(33, 12, { title: "Senior Engineer" });
    expect(mocks.updateJobStatus).toHaveBeenCalledWith(33, 12, "open");
    expect(mocks.deleteJob).toHaveBeenCalledWith(33, 12);
  });

  it("serves Swagger OpenAPI documentation", async () => {
    await request(app)
      .get("/api/jobs/openapi.json")
      .expect(200)
      .expect(({ body }) => {
        expect(body.paths["/jobs"]).toBeDefined();
        expect(body.paths["/companies/{id}/logo"]).toBeDefined();
      });
  });
});
