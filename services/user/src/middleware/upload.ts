import multer from "multer";
import { AppError } from "@hireheaven/shared";

const acceptedTypes = new Map([
  [".pdf", new Set(["application/pdf"])],
  [".doc", new Set(["application/msword", "application/x-ole-storage"])],
  [".docx", new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ])],
  [".png", new Set(["image/png"])],
  [".jpg", new Set(["image/jpeg"])],
  [".jpeg", new Set(["image/jpeg"])],
  [".webp", new Set(["image/webp"])],
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const extension = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (!acceptedTypes.get(extension)?.has(file.mimetype.toLowerCase())) {
      callback(new AppError(415, "Unsupported file extension or MIME type"));
      return;
    }
    callback(null, true);
  },
});
