import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createApplication: vi.fn(),
  findById: vi.fn(),
  listMine: vi.fn(),
  withdraw: vi.fn(),
  listForJob: vi.fn(),
  findManyByIds: vi.fn(),
  updateStatus: vi.fn(),
  updateReview: vi.fn(),
  closeApplicationsForJob: vi.fn(),
  getJob: vi.fn(),
  getUserIdentity: vi.fn(),
  publishApplicationSubmitted: vi.fn(),
  publishApplicationStatusChanged: vi.fn(),
}));

vi.mock("../repositories/applications.js", () => ({ ...mocks }));
vi.mock("../services/jobClient.js", () => ({ getJob: mocks.getJob }));
vi.mock("../services/identityClient.js", () => ({ getUserIdentity: mocks.getUserIdentity }));
vi.mock("../services/kafka.js", () => ({
  publishApplicationSubmitted: mocks.publishApplicationSubmitted,
  publishApplicationStatusChanged: mocks.publishApplicationStatusChanged,
}));

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.PORT = "5004";
process.env.DB_URL = "postgresql://user:password@localhost:5432/applications";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.KAFKA_BROKER = "localhost:9092";
process.env.GATEWAY_INTERNAL_KEY = "application-test-gateway-key-is-32-characters";
process.env.JOB_SERVICE_URL = "http://localhost:5003";
process.env.AUTH_SERVICE_URL = "http://localhost:5000";
process.env.INTERNAL_API_KEY = "application-test-internal-key-is-32-characters";

const service = await import("../services/application.js");
const { stateTransitions } = await import("../validators/application.js");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getJob.mockResolvedValue({
    job_id: 20,
    title: "Platform Engineer",
    status: "open",
    deadline: null,
    posted_by: 5,
  });
  mocks.getUserIdentity.mockImplementation(async (userId: number) => ({
    user_id: userId,
    name: userId === 5 ? "Recruiter" : "Applicant",
    email: userId === 5 ? "recruiter@example.test" : "applicant@example.test",
  }));
  mocks.createApplication.mockResolvedValue({
    application_id: 30,
    job_id: 20,
    user_id: 10,
    status: "applied",
    cover_letter: "",
  });
  mocks.findById.mockResolvedValue({
    application_id: 30,
    job_id: 20,
    user_id: 10,
    status: "applied",
  });
  mocks.updateStatus.mockResolvedValue({
    application_id: 30,
    job_id: 20,
    user_id: 10,
    status: "shortlisted",
  });
});

describe("application state machine", () => {
  it("allows only the declared forward and terminal transitions", () => {
    expect(stateTransitions.applied).toContain("shortlisted");
    expect(stateTransitions.shortlisted).toContain("interview");
    expect(stateTransitions.interview).toContain("hired");
    expect(stateTransitions.interview).toContain("rejected");
    expect(stateTransitions.hired).toEqual([]);
    expect(stateTransitions.rejected).toEqual([]);
  });

  it("persists and publishes an allowed transition", async () => {
    const updated = await service.updateApplicationStatus(30, 5, "shortlisted", {});

    expect(updated.status).toBe("shortlisted");
    expect(mocks.updateStatus).toHaveBeenCalledWith(30, "applied", "shortlisted", 5, {});
    expect(mocks.publishApplicationStatusChanged).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: "30",
      jobId: "20",
      applicantId: 10,
      applicantName: "Applicant",
      applicantEmail: "applicant@example.test",
      previousStatus: "applied",
      status: "shortlisted",
    }));
  });

  it("rejects skipping a required state", async () => {
    await expect(
      service.updateApplicationStatus(30, 5, "interview", {}),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    expect(mocks.publishApplicationStatusChanged).not.toHaveBeenCalled();
  });
});

describe("duplicate applications", () => {
  it("rejects closed and past-deadline jobs before inserting", async () => {
    mocks.getJob.mockResolvedValueOnce({
      job_id: 20,
      title: "Platform Engineer",
      status: "closed",
      deadline: null,
      posted_by: 5,
    });
    await expect(
      service.applyToJob(20, 10, { coverLetter: "" }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    mocks.getJob.mockResolvedValueOnce({
      job_id: 20,
      title: "Platform Engineer",
      status: "open",
      deadline: yesterday,
      posted_by: 5,
    });
    await expect(
      service.applyToJob(20, 10, { coverLetter: "" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.createApplication).not.toHaveBeenCalled();
  });

  it("creates an application and publishes recipient identity for notification", async () => {
    await service.applyToJob(20, 10, { coverLetter: "I'm interested" });

    expect(mocks.createApplication).toHaveBeenCalledWith({
      jobId: 20,
      userId: 10,
      resumeUrl: null,
      coverLetter: "I'm interested",
    });
    expect(mocks.publishApplicationSubmitted).toHaveBeenCalledWith(expect.objectContaining({
      applicantId: 10,
      applicantName: "Applicant",
      recruiterId: 5,
      recruiterName: "Recruiter",
      recruiterEmail: "recruiter@example.test",
      jobTitle: "Platform Engineer",
    }));
  });

  it("returns conflict for the database unique constraint and does not republish", async () => {
    mocks.createApplication.mockRejectedValueOnce({ code: "23505" });

    await expect(
      service.applyToJob(20, 10, { coverLetter: "" }),
    ).rejects.toMatchObject({ statusCode: 409, message: "You have already applied to this job" });

    expect(mocks.getJob).toHaveBeenCalledWith(20);
    expect(mocks.publishApplicationSubmitted).not.toHaveBeenCalled();
  });
});
