import express from "express";
import {
  forgotPassword,
  getMe,
  getInternalUser,
  loginUser,
  logout,
  changePassword,
  registerUser,
  refreshSession,
  resetPassword,
  verifyEmail,
} from "../controllers/auth.js";
import uploadFile from "../middleware/multer.js";
import { validate } from "../middleware/validate.js";
import {
  changePasswordSchema,
  forgotSchema,
  loginSchema,
  registerSchema,
  resetParamsSchema,
  resetSchema,
  verifyEmailParamsSchema,
} from "../validators/auth.js";
import { forgotRateLimit, loginRateLimit } from "../middleware/authRateLimit.js";
import { isAuth } from "../middleware/isAuth.js";
import { internalAuth } from "../middleware/internalAuth.js";

const router = express.Router();

router.get("/internal/users/:id", internalAuth, getInternalUser);
router.post("/register", uploadFile, validate(registerSchema), registerUser);
router.post("/login", loginRateLimit, validate(loginSchema), loginUser);
router.post("/forgot", forgotRateLimit, validate(forgotSchema), forgotPassword);
router.get(
  "/verify-email/:token",
  validate(verifyEmailParamsSchema, "params"),
  verifyEmail,
);
router.post(
  "/reset/:token",
  validate(resetParamsSchema, "params"),
  validate(resetSchema),
  resetPassword,
);
router.post("/refresh", refreshSession);
router.get("/me", isAuth, getMe);
router.post("/logout", isAuth, logout);
router.post(
  "/change-password",
  isAuth,
  validate(changePasswordSchema),
  changePassword,
);

export default router;
