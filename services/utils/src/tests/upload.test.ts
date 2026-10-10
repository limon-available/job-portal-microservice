import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  uploadStream: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("cloudinary", () => ({
  default: {
    v2: {
      uploader: {
        upload_stream: mocks.uploadStream,
        destroy: mocks.destroy,
      },
    },
  },
}));

const validKey = "test-internal-api-key-with-32-characters";
process.env.INTERNAL_API_KEY = validKey;

const { default: app } = await import("../app.js");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.uploadStream.mockImplementation((
    _options: unknown,
    callback: (error: null, result: { secure_url: string; public_id: string }) => void,
  ) => {
    callback(null, {
      secure_url: "https://cdn.example/resumes/resume-123.pdf",
      public_id: "resumes/resume-123",
    });
    return { end: vi.fn() };
  });
  mocks.destroy.mockResolvedValue({ result: "ok" });
});

describe("internal upload API", () => {
  it("exposes health and Prometheus metrics", async () => {
    await request(app).get("/health").expect(200);
    const response = await request(app).get("/metrics").expect(200);
    expect(response.text).toContain("http_server_requests_total");
    expect(response.text).toContain('service="utils"');
  });

  it("rejects requests without the internal service key", async () => {
    await request(app)
      .post("/api/utils/upload")
      .attach("file", Buffer.from("%PDF-1.7"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      })
      .field("folder", "resumes")
      .expect(401);
  });

  it("rejects a mismatch between file extension and MIME type", async () => {
    await request(app)
      .post("/api/utils/upload")
      .set("x-internal-key", validKey)
      .attach("file", Buffer.from("not a pdf"), {
        filename: "resume.pdf",
        contentType: "application/octet-stream",
      })
      .field("folder", "resumes")
      .expect(415);
  });

  it("rejects unsupported extensions even when the MIME type is allowed", async () => {
    await request(app)
      .post("/api/utils/upload")
      .set("x-internal-key", validKey)
      .attach("file", Buffer.from("binary"), {
        filename: "resume.exe",
        contentType: "application/pdf",
      })
      .field("folder", "resumes")
      .expect(415);
  });

  it("rejects files larger than five megabytes", async () => {
    await request(app)
      .post("/api/utils/upload")
      .set("x-internal-key", validKey)
      .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      })
      .field("folder", "resumes")
      .expect(413);
  });

  it("rejects folders outside the allowlist", async () => {
    await request(app)
      .post("/api/utils/upload")
      .set("x-internal-key", validKey)
      .attach("file", Buffer.from("%PDF-1.7"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      })
      .field("folder", "private")
      .expect(400);
  });

  it("uploads an allowed file to the selected folder", async () => {
    const response = await request(app)
      .post("/api/utils/upload")
      .set("x-internal-key", validKey)
      .field("folder", "resumes")
      .attach("file", Buffer.from("%PDF-1.7"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      })
      .expect(200);

    expect(response.body.data).toEqual({
      url: "https://cdn.example/resumes/resume-123.pdf",
      public_id: "resume-123",
    });
    expect(mocks.uploadStream).toHaveBeenCalledWith(
      { folder: "resumes", resource_type: "auto" },
      expect.any(Function),
    );
  });

  it("deletes an asset in the selected folder", async () => {
    const response = await request(app)
      .delete("/api/utils/upload/resume-123?folder=resumes")
      .set("x-internal-key", validKey)
      .expect(200);

    expect(mocks.destroy).toHaveBeenCalledWith("resumes/resume-123");
    expect(response.body.data.result).toBe("ok");
  });

  it("protects deletes with the internal service key", async () => {
    await request(app).delete("/api/utils/upload/example?folder=resumes").expect(401);
  });
});
