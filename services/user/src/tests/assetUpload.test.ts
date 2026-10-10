import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  delete: vi.fn(),
  findProfileAsset: vi.fn(),
  updateProfileAsset: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    post: mocks.post,
    delete: mocks.delete,
  },
}));

vi.mock("../repositories/profile.js", () => ({
  ensureProfile: vi.fn(),
  findProfileAsset: mocks.findProfileAsset,
  updateProfileAsset: mocks.updateProfileAsset,
}));

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.PORT = "5002";
process.env.DB_URL = "postgresql://user:password@localhost:5432/users";
process.env.GATEWAY_INTERNAL_KEY = "user-test-gateway-secret-with-32-characters";
process.env.UPLOAD_SERVICE = "http://utils.internal";
const internalKey = "user-test-internal-key-with-32-characters";
process.env.INTERNAL_API_KEY = internalKey;

const { replaceProfileAsset } = await import("../services/user.js");

const uploadedFile = (filename: string, mimetype: string): Express.Multer.File => ({
  fieldname: "file",
  originalname: filename,
  encoding: "7bit",
  mimetype,
  size: 4,
  destination: "",
  filename,
  path: "",
  buffer: Buffer.from("test"),
  stream: Readable.from(Buffer.from("test")),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findProfileAsset.mockResolvedValue({ public_id: "old-avatar" });
  mocks.post.mockResolvedValue({
    data: {
      data: { url: "https://cdn.example/new-avatar.png", public_id: "new-avatar" },
    },
  });
  mocks.updateProfileAsset.mockResolvedValue({ picture_url: "https://cdn.example/new-avatar.png" });
  mocks.delete.mockResolvedValue({ data: { success: true } });
});

describe("profile asset replacement", () => {
  it("uploads with the internal key, persists the new asset, then deletes the old asset", async () => {
    const result = await replaceProfileAsset(
      73,
      "avatars",
      uploadedFile("avatar.png", "image/png"),
    );

    expect(mocks.post).toHaveBeenCalledWith(
      "http://utils.internal/api/utils/upload",
      expect.any(FormData),
      { headers: { "x-internal-key": internalKey } },
    );
    expect(mocks.updateProfileAsset).toHaveBeenCalledWith(
      73,
      "picture",
      "https://cdn.example/new-avatar.png",
      "new-avatar",
    );
    expect(mocks.delete).toHaveBeenCalledWith(
      "http://utils.internal/api/utils/upload/old-avatar",
      expect.objectContaining({
        params: { folder: "avatars" },
        headers: { "x-internal-key": internalKey },
      }),
    );
    expect(result).toEqual({ picture_url: "https://cdn.example/new-avatar.png" });
  });

  it("rejects a resume file type that is not supported before uploading", async () => {
    await expect(replaceProfileAsset(
      73,
      "resumes",
      uploadedFile("resume.png", "image/png"),
    )).rejects.toMatchObject({ statusCode: 415 });
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
