import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { Role } from "@hireheaven/shared";
import {
  applyToPathJob,
  applyWithJobId,
  getForJob,
  getMine,
  patchBulkStatus,
  patchReview,
  patchStatus,
  withdraw,
} from "./controllers/applications.js";
import { isAuth, requireRole } from "./middleware/isAuth.js";
import openApiSpec from "./openapi.js";

const router = Router();
router.get("/openapi.json", (_req, res) => res.json(openApiSpec));
router.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
router.use(isAuth);

router.post("/apply", requireRole(Role.Jobseeker), applyWithJobId);
router.post("/jobs/:jobId/apply", requireRole(Role.Jobseeker), applyToPathJob);
router.get("/mine", requireRole(Role.Jobseeker), getMine);
router.delete("/:id", requireRole(Role.Jobseeker), withdraw);

router.get("/job/:jobId", requireRole(Role.Recruiter), getForJob);
router.patch("/bulk-status", requireRole(Role.Recruiter), patchBulkStatus);
router.patch("/:id/status", requireRole(Role.Recruiter), patchStatus);
router.patch("/:id/review", requireRole(Role.Recruiter), patchReview);

export default router;
