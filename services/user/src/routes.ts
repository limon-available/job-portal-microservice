import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import isAuth from "./middleware/isAuth.js";
import { upload } from "./middleware/upload.js";
import openApiSpec from "./openapi.js";
import {
  addSkill,
  deleteEducation,
  deleteExperience,
  deleteSavedJob,
  deleteSkill,
  getEducation,
  getExperience,
  getProfile,
  getProfileCompletion,
  getPublicProfile,
  getSavedJobs,
  getSkills,
  postEducation,
  postExperience,
  postSavedJob,
  putEducation,
  putExperience,
  putPicture,
  putProfile,
  putResume,
} from "./controllers/user.js";

const router = Router();

router.get("/openapi.json", (_req, res) => res.json(openApiSpec));
router.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
router.get("/public/:userId", getPublicProfile);

router.use(isAuth);
router.get("/profile", getProfile);
router.put("/profile", putProfile);
router.put("/profile/picture", upload.single("file"), putPicture);
router.put("/profile/resume", upload.single("file"), putResume);
router.get("/profile/completion", getProfileCompletion);
router.get("/skills", getSkills);
router.post("/skills", addSkill);
router.delete("/skills", deleteSkill);
router.get("/education", getEducation);
router.post("/education", postEducation);
router.put("/education/:id", putEducation);
router.delete("/education/:id", deleteEducation);
router.get("/experience", getExperience);
router.post("/experience", postExperience);
router.put("/experience/:id", putExperience);
router.delete("/experience/:id", deleteExperience);
router.get("/saved-jobs", getSavedJobs);
router.post("/saved-jobs", postSavedJob);
router.delete("/saved-jobs/:jobId", deleteSavedJob);

export default router;
