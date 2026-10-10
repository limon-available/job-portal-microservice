import multer from "multer";
import { AppError } from "@hireheaven/shared";

export const companyLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const extension = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    const valid = new Map([
      [".png", "image/png"],
      [".jpg", "image/jpeg"],
      [".jpeg", "image/jpeg"],
      [".webp", "image/webp"],
    ]);
    if (valid.get(extension) !== file.mimetype.toLowerCase()) {
      callback(new AppError(415, "Company logo must be PNG, JPG, or WEBP"));
      return;
    }
    callback(null, true);
  },
});
