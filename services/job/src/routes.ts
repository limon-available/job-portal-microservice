import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import {
  deleteCompany,
  deleteJob,
  getJob,
  getInternalJob,
  getJobs,
  getMyJobs,
  listCompanies,
  patchJobStatus,
  postCompany,
  postJob,
  putCompany,
  putCompanyLogo,
  putJob,
} from "./controllers/jobs.js";
import { isAuth, isInternal, requireRecruiter } from "./middleware/isAuth.js";
import { companyLogoUpload } from "./middleware/upload.js";
import openApiSpec from "./openapi.js";

const router = Router();
router.get("/openapi.json", (_req, res) => res.json(openApiSpec));
router.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

router.get("/internal/jobs/:id", isInternal, getInternalJob);
router.get("/jobs", getJobs);
router.get("/jobs/mine", isAuth, requireRecruiter, getMyJobs);
router.get("/jobs/:idOrSlug", getJob);

router.use(isAuth);
router.use(requireRecruiter);

router.get("/companies", listCompanies);
router.post("/companies", postCompany);
router.put("/companies/:id", putCompany);
router.delete("/companies/:id", deleteCompany);
router.put("/companies/:id/logo", companyLogoUpload.single("file"), putCompanyLogo);

router.post("/jobs", postJob);
router.put("/jobs/:id", putJob);
router.delete("/jobs/:id", deleteJob);
router.patch("/jobs/:id/status", patchJobStatus);

export default router;
