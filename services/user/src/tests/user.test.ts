import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
  replaceProfileAsset: vi.fn(),
  getProfileCompletion: vi.fn(),
  getPublicProfile: vi.fn(),
  listSkills: vi.fn(),
  addSkill: vi.fn(),
  removeSkill: vi.fn(),
  listEducation: vi.fn(),
  createEducation: vi.fn(),
  updateEducation: vi.fn(),
  deleteEducation: vi.fn(),
  listExperience: vi.fn(),
  createExperience: vi.fn(),
  updateExperience: vi.fn(),
  deleteExperience: vi.fn(),
  getSavedJobs: vi.fn(),
  addSavedJob: vi.fn(),
  removeSavedJob: vi.fn(),
}));

vi.mock("../services/user.js", () => ({ ...mocks }));

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.PORT = "5002";
process.env.DB_URL = "postgresql://user:password@localhost:5432/users";
const gatewayKey = "user-test-gateway-secret-with-32-characters";
process.env.GATEWAY_INTERNAL_KEY = gatewayKey;
process.env.UPLOAD_SERVICE = "http://localhost:5001";
process.env.INTERNAL_API_KEY = "user-test-internal-key-with-32-characters";

const { default: app } = await import("../app.js");

const gatewayHeaders = {
  "x-gateway-key": gatewayKey,
  "x-user-id": "73",
  "x-user-role": "jobseeker",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProfile.mockResolvedValue({
    user_id: 73,
    name: "Riley",
    phone: "555-0100",
    bio: "Engineer",
    skills: [{ skill_id: 1, name: "TypeScript" }],
    education: [],
    experience: [],
  });
  mocks.saveProfile.mockImplementation(async (_userId, profile) => profile);
  mocks.replaceProfileAsset.mockResolvedValue({ picture_url: "https://cdn.test/avatar.png" });
  mocks.getProfileCompletion.mockResolvedValue({ percentage: 50, completed: 4, total: 8 });
  mocks.getPublicProfile.mockResolvedValue({
    profile: { user_id: 73, name: "Riley", bio: "Engineer", picture_url: null },
    skills: [],
    education: [],
    experience: [],
  });
  mocks.addSkill.mockResolvedValue([{ skill_id: 1, name: "TypeScript" }]);
  mocks.listSkills.mockResolvedValue([{ skill_id: 1, name: "TypeScript" }]);
  mocks.removeSkill.mockResolvedValue(true);
  mocks.listEducation.mockResolvedValue([]);
  mocks.createEducation.mockResolvedValue({ education_id: 4, institution: "Example U" });
  mocks.updateEducation.mockResolvedValue({ education_id: 4, institution: "Updated U" });
  mocks.deleteEducation.mockResolvedValue([{ education_id: 4 }]);
  mocks.listExperience.mockResolvedValue([]);
  mocks.createExperience.mockResolvedValue({ experience_id: 5, company: "Example Co" });
  mocks.updateExperience.mockResolvedValue({ experience_id: 5, company: "Updated Co" });
  mocks.deleteExperience.mockResolvedValue([{ experience_id: 5 }]);
  mocks.getSavedJobs.mockResolvedValue([]);
  mocks.addSavedJob.mockResolvedValue({ job_id: "job-100" });
  mocks.removeSavedJob.mockResolvedValue([{ job_id: "job-100" }]);
});

describe("user profile API", () => {
  it("exposes health and Prometheus metrics", async () => {
    await request(app).get("/health").expect(200);
    const response = await request(app).get("/metrics").expect(200);
    expect(response.text).toContain("http_server_requests_total");
    expect(response.text).toContain('service="user"');
  });

  it("requires a valid gateway identity for private routes", async () => {
    await request(app).get("/api/user/profile").expect(401);
    await request(app)
      .get("/api/user/profile")
      .set("x-gateway-key", "wrong-gateway-secret-000000000000000")
      .set("x-user-id", "73")
      .set("x-user-role", "jobseeker")
      .expect(401);
  });

  it("uses the forwarded user ID for profile reads and updates", async () => {
    await request(app)
      .get("/api/user/profile")
      .set(gatewayHeaders)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.profile.user_id).toBe(73);
      });

    await request(app)
      .put("/api/user/profile")
      .set(gatewayHeaders)
      .send({ name: "Riley Example", phone: "555-0123", bio: "New bio" })
      .expect(200);
    expect(mocks.saveProfile).toHaveBeenCalledWith(73, {
      name: "Riley Example",
      phone: "555-0123",
      bio: "New bio",
    });
  });

  it("rejects invalid profile values", async () => {
    await request(app)
      .put("/api/user/profile")
      .set(gatewayHeaders)
      .send({ name: "", phone: "x".repeat(40), bio: "ok" })
      .expect(400);
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("keeps phone and email out of public profiles", async () => {
    mocks.getPublicProfile.mockResolvedValueOnce({
      profile: {
        user_id: 73,
        name: "Riley",
        bio: "Engineer",
        picture_url: null,
        phone: "private",
        email: "private@example.com",
        picture_public_id: "private-id",
      },
      skills: [],
      education: [],
      experience: [],
    });
    await request(app)
      .get("/api/user/public/73")
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.profile).not.toHaveProperty("phone");
        expect(body.data.profile).not.toHaveProperty("email");
      });
  });

  it("parses multipart file uploads and forwards the file to the asset service", async () => {
    await request(app)
      .put("/api/user/profile/picture")
      .set(gatewayHeaders)
      .attach("file", Buffer.from("image"), {
        filename: "avatar.png",
        contentType: "image/png",
      })
      .expect(200);
    expect(mocks.replaceProfileAsset).toHaveBeenCalledWith(
      73,
      "avatars",
      expect.objectContaining({ originalname: "avatar.png" }),
    );
  });

  it("returns a client error when a multipart upload uses the wrong file field", async () => {
    await request(app)
      .put("/api/user/profile/resume")
      .set(gatewayHeaders)
      .attach("resume", Buffer.from("%PDF-1.7"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Invalid multipart upload");
      });
    expect(mocks.replaceProfileAsset).not.toHaveBeenCalled();
  });

  it("supports skill creation and removal", async () => {
    await request(app)
      .post("/api/user/skills")
      .set(gatewayHeaders)
      .send({ name: "TypeScript" })
      .expect(201);
    expect(mocks.addSkill).toHaveBeenCalledWith(73, "TypeScript");

    await request(app)
      .delete("/api/user/skills")
      .set(gatewayHeaders)
      .send({ name: "TypeScript" })
      .expect(200);
    expect(mocks.removeSkill).toHaveBeenCalledWith(73, "TypeScript");
  });

  it("supports education and experience CRUD", async () => {
    await request(app).get("/api/user/education").set(gatewayHeaders).expect(200);
    const education = { institution: "Example U", degree: "BSc" };
    await request(app).post("/api/user/education").set(gatewayHeaders).send(education).expect(201);
    await request(app)
      .put("/api/user/education/4")
      .set(gatewayHeaders)
      .send({ institution: "Updated U" })
      .expect(200);
    await request(app).delete("/api/user/education/4").set(gatewayHeaders).expect(200);

    await request(app).get("/api/user/experience").set(gatewayHeaders).expect(200);
    await request(app)
      .post("/api/user/experience")
      .set(gatewayHeaders)
      .send({ company: "Example Co", title: "Engineer" })
      .expect(201);
    await request(app)
      .put("/api/user/experience/5")
      .set(gatewayHeaders)
      .send({ company: "Updated Co" })
      .expect(200);
    await request(app).delete("/api/user/experience/5").set(gatewayHeaders).expect(200);
    await request(app).delete("/api/user/experience/5").set(gatewayHeaders).expect(200);
  });

  it("provides profile completion and saved-job operations", async () => {
    await request(app)
      .get("/api/user/profile/completion")
      .set(gatewayHeaders)
      .expect(200)
      .expect(({ body }) => expect(body.data.percentage).toBe(50));

    await request(app).get("/api/user/saved-jobs").set(gatewayHeaders).expect(200);
    await request(app)
      .post("/api/user/saved-jobs")
      .set(gatewayHeaders)
      .send({ jobId: "job-100" })
      .expect(201);
    await request(app).delete("/api/user/saved-jobs/job-100").set(gatewayHeaders).expect(200);
  });

  it("serves OpenAPI documentation", async () => {
    await request(app)
      .get("/api/user/openapi.json")
      .expect(200)
      .expect(({ body }) => {
        expect(body.paths["/saved-jobs"]).toBeDefined();
        expect(body.paths["/profile/picture"]).toBeDefined();
      });
  });
});
