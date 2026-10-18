import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findCompany: vi.fn(),
  createJob: vi.fn(),
  findOwnedJob: vi.fn(),
  updateJob: vi.fn(),
  updateJobStatus: vi.fn(),
  deleteJob: vi.fn(),
  expireJobsAndQueueEvents: vi.fn(),
  pendingExpiryEvents: vi.fn(),
  markExpiryEventPublished: vi.fn(),
  listJobSkills: vi.fn(),
  publishJobCreated: vi.fn(),
  publishJobUpdated: vi.fn(),
  publishJobDeleted: vi.fn(),
  queueJobView: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../repositories/jobs.js", () => ({ ...mocks }));
vi.mock("../services/kafka.js", () => ({
  publishJobCreated: mocks.publishJobCreated,
  publishJobUpdated: mocks.publishJobUpdated,
  publishJobDeleted: mocks.publishJobDeleted,
}));
vi.mock("../services/views.js", () => ({ queueJobView: mocks.queueJobView }));
vi.mock("axios", () => ({
  default: { post: mocks.post, delete: mocks.delete },
}));

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.PORT = "5003";
process.env.DB_URL = "postgresql://user:password@localhost:5432/jobs";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.KAFKA_BROKER = "localhost:9092";
process.env.GATEWAY_INTERNAL_KEY = "job-test-gateway-secret-with-32-characters";
process.env.UPLOAD_SERVICE = "http://localhost:5001";
process.env.INTERNAL_API_KEY = "job-test-internal-key-with-32-characters";

const service = await import("../services/job.js");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findCompany.mockResolvedValue({
    company_id: 2,
    owner_id: 33,
    name: "Acme",
    logo_public_id: null,
  });
  mocks.createJob.mockResolvedValue({
    job_id: 12,
    title: "Engineer",
    description: "Build things",
    location: "Remote",
    job_type: "full-time",
    salary_min: 50000,
    salary_max: 100000,
    deadline: null,
    status: "open",
    company_id: 2,
    posted_by: 33,
  });
  mocks.listJobSkills.mockResolvedValue(["typescript"]);
  mocks.findOwnedJob.mockResolvedValue({
    job_id: 12,
    title: "Engineer",
    status: "open",
    company_id: 2,
    posted_by: 33,
    salary_min: 50000,
    salary_max: 100000,
    deadline: null,
  });
  mocks.updateJob.mockResolvedValue({
    job_id: 12,
    title: "Senior Engineer",
    status: "open",
    company_id: 2,
  });
  mocks.updateJobStatus.mockResolvedValue({
    job_id: 12,
    title: "Engineer",
    status: "closed",
    company_id: 2,
  });
  mocks.deleteJob.mockResolvedValue([
    {
      job_id: 12,
      title: "Engineer",
      company_id: 2,
    },
  ]);
  mocks.expireJobsAndQueueEvents.mockResolvedValue([]);
  mocks.pendingExpiryEvents
    .mockResolvedValueOnce([
      {
        event_id: "event-123",
        payload: {
          eventId: "event-123",
          occurredAt: "2025-01-01T00:00:00.000Z",
          jobId: "12",
          recruiterId: 33,
          companyId: 2,
          title: "Engineer",
          status: "expired",
          changes: { status: "expired" },
        },
      },
    ])
    .mockResolvedValueOnce([]);
  mocks.markExpiryEventPublished.mockResolvedValue(undefined);
});

describe("job domain service", () => {
  it("rejects creating jobs for a company owned by another recruiter", async () => {
    mocks.findCompany.mockResolvedValueOnce({ company_id: 2, owner_id: 99, name: "Other" });
    await expect(
      service.createJob(33, {
        title: "Engineer",
        description: "Build things",
        location: "Remote",
        jobType: "full-time",
        companyId: 2,
        skills: [],
        status: "draft",
        experienceYears: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it("rejects invalid owner IDs returned by the company repository", async () => {
    mocks.findCompany.mockResolvedValueOnce({ company_id: 2, owner_id: "invalid", name: "Other" });

    await expect(
      service.createJob(33, {
        title: "Engineer",
        description: "Build things",
        location: "Remote",
        jobType: "full-time",
        companyId: 2,
        skills: [],
        status: "draft",
        experienceYears: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 500, isOperational: false });
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it("publishes job.created after inserting a job with its skill payload", async () => {
    await service.createJob(33, {
      title: "Engineer",
      description: "Build things",
      location: "Remote",
      jobType: "full-time",
      companyId: 2,
      skills: ["TypeScript"],
      status: "open",
      experienceYears: 3,
    });

    expect(mocks.publishJobCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "12",
        recruiterId: 33,
        companyId: 2,
        companyName: "Acme",
        location: "Remote",
        jobType: "full-time",
        salaryMin: 50000,
        salaryMax: 100000,
        skills: ["typescript"],
        deadline: null,
      }),
    );
  });

  it("checks job ownership before updating or deleting and publishes domain events", async () => {
    await service.updateJob(33, 12, { title: "Senior Engineer" });
    await service.deleteJob(33, 12);

    expect(mocks.publishJobUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "12",
        recruiterId: 33,
        changes: { title: "Senior Engineer" },
      }),
    );
    expect(mocks.publishJobDeleted).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "12",
        recruiterId: 33,
        companyId: 2,
      }),
    );
  });

  it("updates compensation and experience fields on an owned draft", async () => {
    mocks.findOwnedJob.mockResolvedValueOnce({
      job_id: 12,
      title: "Engineer",
      status: "draft",
      company_id: 2,
      posted_by: 33,
      salary_min: null,
      salary_max: null,
      deadline: null,
    });
    mocks.updateJob.mockResolvedValueOnce({
      job_id: 12,
      title: "Engineer",
      status: "draft",
      company_id: 2,
      salary_min: 60000,
      salary_max: 110000,
      experience_years: 5,
      deadline: "2027-03-01",
    });

    await service.updateJob(33, 12, {
      salaryMin: 60000,
      salaryMax: 110000,
      experienceYears: 5,
      deadline: "2027-03-01",
    });

    expect(mocks.findOwnedJob).toHaveBeenCalledWith(33, 12);
    expect(mocks.updateJob).toHaveBeenCalledWith(33, 12, {
      salaryMin: 60000,
      salaryMax: 110000,
      experienceYears: 5,
      deadline: "2027-03-01",
    });
  });

  it("publishes and acknowledges the durable expiry event", async () => {
    await service.expireJobs();
    expect(mocks.publishJobUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "12",
        status: "expired",
        changes: { status: "expired" },
      }),
    );
    expect(mocks.markExpiryEventPublished).toHaveBeenCalledWith("event-123");
  });

  it("leaves expiry events pending when Kafka publication fails", async () => {
    mocks.publishJobUpdated.mockRejectedValueOnce(new Error("Kafka unavailable"));
    await expect(service.expireJobs()).rejects.toThrow("Kafka unavailable");
    expect(mocks.markExpiryEventPublished).not.toHaveBeenCalled();
  });
});
