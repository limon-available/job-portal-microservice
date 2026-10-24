import express from "express";
import { timingSafeEqual } from "node:crypto";
import cloudinary from "cloudinary";
import multer from "multer";
import { AppError } from "@hireheaven/shared";

const router = express.Router();
const allowedFiles = new Map([
  [".pdf", new Set(["application/pdf"])],
  [".doc", new Set(["application/msword", "application/x-ole-storage"])],
  [
    ".docx",
    new Set([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
    ]),
  ],
  [".png", new Set(["image/png"])],
  [".jpg", new Set(["image/jpeg"])],
  [".jpeg", new Set(["image/jpeg"])],
  [".webp", new Set(["image/webp"])],
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const extension = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (!allowedFiles.get(extension)?.has(file.mimetype.toLowerCase())) {
      callback(new AppError(415, "Unsupported file extension or MIME type"));
      return;
    }
    callback(null, true);
  },
});
const hasExpectedSignature = (file: Express.Multer.File): boolean => {
  const extension = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
  const buffer = file.buffer;
  switch (extension) {
    case ".pdf":
      return buffer.indexOf("%PDF-") >= 0 && buffer.indexOf("%PDF-") < 1024;
    case ".doc":
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    case ".docx":
      return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    case ".png":
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case ".jpg":
    case ".jpeg":
      return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    case ".webp":
      return (
        buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP"
      );
    default:
      return false;
  }
};
const folders = new Set(["resumes", "avatars", "logos"]);

const requireInternalKey: express.RequestHandler = (req, _res, next) => {
  const expected = process.env.INTERNAL_API_KEY;
  const provided = req.get("x-internal-key");
  if (!expected || !provided) {
    next(new AppError(401, "Invalid internal service key"));
    return;
  }

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (
    expectedBytes.length !== providedBytes.length ||
    !timingSafeEqual(expectedBytes, providedBytes)
  ) {
    next(new AppError(401, "Invalid internal service key"));
    return;
  }
  next();
};

router.post("/upload", requireInternalKey, upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError(400, "file is required");
    }
    if (!hasExpectedSignature(file)) {
      throw new AppError(415, "File content does not match its extension");
    }
    const folder = typeof req.body.folder === "string" ? req.body.folder : "";
    if (!folders.has(folder)) {
      throw new AppError(400, "folder must be resumes, avatars, or logos");
    }
    const cloud = await new Promise<cloudinary.UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.v2.uploader.upload_stream(
        { folder, resource_type: "auto" },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve(result);
          } else {
            reject(new Error("Cloudinary upload returned no result"));
          }
        },
      );
      stream.end(file.buffer);
    });
    res.json({
      success: true,
      message: "File uploaded successfully",
      data: {
        url: cloud.secure_url,
        public_id: cloud.public_id.split("/").pop() ?? cloud.public_id,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/upload/:publicId", requireInternalKey, async (req, res, next) => {
  try {
    const publicIdParam = req.params.publicId;
    const publicId = typeof publicIdParam === "string" ? publicIdParam : "";
    if (!publicId) {
      throw new AppError(400, "publicId is required");
    }
    const folder = typeof req.query.folder === "string" ? req.query.folder : "";
    if (!folders.has(folder)) {
      throw new AppError(400, "folder must be resumes, avatars, or logos");
    }
    const assetPublicId = publicId.startsWith(`${folder}/`) ? publicId : `${folder}/${publicId}`;
    const result = await cloudinary.v2.uploader.destroy(assetPublicId);
    if (result.result !== "ok" && result.result !== "not found") {
      throw new Error(`Cloudinary delete failed: ${result.result}`);
    }
    res.json({
      success: true,
      message: result.result === "ok" ? "File deleted successfully" : "File not found",
      data: { result: result.result },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
