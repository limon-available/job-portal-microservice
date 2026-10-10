import axios from "axios";
import { AppError, createLogger } from "@hireheaven/shared";
import type {
  educationCreateSchema,
  educationUpdateSchema,
  experienceCreateSchema,
  experienceUpdateSchema,
  profileSchema,
} from "../validators/user.js";
import type { z } from "zod";
import { env } from "../config/env.js";
import * as repository from "../repositories/profile.js";

type ProfileInput = z.infer<typeof profileSchema>;
type EducationInput = z.infer<typeof educationCreateSchema>;
type EducationPatch = z.infer<typeof educationUpdateSchema>;
type ExperienceInput = z.infer<typeof experienceCreateSchema>;
type ExperiencePatch = z.infer<typeof experienceUpdateSchema>;

const ensureProfile = repository.ensureProfile;
const logger = createLogger();

export const getProfile = async (userId: number) => {
  await ensureProfile(userId);
  const [profile, skills, education, experience] = await Promise.all([
    repository.findProfile(userId),
    repository.listSkills(userId),
    repository.listEducation(userId),
    repository.listExperience(userId),
  ]);
  return { ...profile, skills, education, experience };
};

export const saveProfile = async (userId: number, data: ProfileInput) =>
  repository.updateProfile(userId, data);

const validateAssetType = (file: Express.Multer.File, folder: "avatars" | "resumes") => {
  const extension = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
  const image = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  if (folder === "avatars" && !image.has(extension)) {
    throw new AppError(415, "Profile pictures must be PNG, JPG, or WEBP");
  }
  if (folder === "resumes" && !new Set([".pdf", ".doc", ".docx"]).has(extension)) {
    throw new AppError(415, "Resumes must be PDF, DOC, or DOCX");
  }
};

const deleteAsset = async (publicId: string, folder: "avatars" | "resumes") => {
  await axios.delete(
    `${env.UPLOAD_SERVICE}/api/utils/upload/${encodeURIComponent(publicId)}`,
    {
      params: { folder },
      headers: { "x-internal-key": env.INTERNAL_API_KEY },
    },
  );
};

export const replaceProfileAsset = async (
  userId: number,
  folder: "avatars" | "resumes",
  file: Express.Multer.File,
) => {
  validateAssetType(file, folder);
  const asset = folder === "avatars" ? "picture" : "resume";
  const previous = await repository.findProfileAsset(userId, asset);
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
  body.append("folder", folder);

  let uploaded: { url: string; public_id: string };
  try {
    const response = await axios.post<{
      success: boolean;
      message: string;
      data: { url: string; public_id: string };
    }>(`${env.UPLOAD_SERVICE}/api/utils/upload`, body, {
      headers: { "x-internal-key": env.INTERNAL_API_KEY },
    });
    uploaded = response.data.data;
    if (!uploaded?.url || !uploaded.public_id) {
      throw new Error("Upload service returned an invalid response");
    }
  } catch (error) {
    logger.error({ err: error, userId, folder }, "utils upload failed");
    throw new AppError(502, "File upload failed", false);
  }

  if (!uploaded.url || !uploaded.public_id) {
    throw new AppError(502, "File upload failed", false);
  }

  let updated: Awaited<ReturnType<typeof repository.updateProfileAsset>>;
  try {
    updated = await repository.updateProfileAsset(userId, asset, uploaded.url, uploaded.public_id);
  } catch (error) {
    logger.error({ err: error, userId, folder }, "profile asset metadata update failed");
    try {
      await deleteAsset(uploaded.public_id, folder);
    } catch (cleanupError) {
      logger.error({ err: cleanupError, userId, folder }, "orphaned upload cleanup failed");
    }
    throw new AppError(500, "Uploaded file could not be saved to the profile", false);
  }
  if (previous?.public_id) {
    try {
      await deleteAsset(previous.public_id, folder);
    } catch (error) {
      logger.error({ err: error, userId, folder }, "previous profile asset cleanup failed");
      throw new AppError(502, "Profile updated but the previous file could not be deleted", false);
    }
  }
  return updated;
};

export const addSkill = async (userId: number, name: string) => {
  await ensureProfile(userId);
  const normalizedName = name.trim().replace(/\s+/g, " ");
  await repository.addSkill(userId, normalizedName);
  return repository.listSkills(userId);
};

export const removeSkill = async (userId: number, name: string) => {
  const removed = await repository.deleteSkillByName(userId, name.trim());
  return removed.length > 0;
};

export const listSkills = async (userId: number) => {
  await ensureProfile(userId);
  return repository.listSkills(userId);
};

export const listEducation = async (userId: number) => {
  await ensureProfile(userId);
  return repository.listEducation(userId);
};

export const createEducation = async (userId: number, entry: EducationInput) => {
  await ensureProfile(userId);
  return repository.createEducation(userId, entry);
};

export const updateEducation = (
  userId: number,
  id: number,
  entry: EducationPatch,
) => repository.updateEducation(userId, id, entry);

export const deleteEducation = (userId: number, id: number) =>
  repository.deleteEducation(userId, id);

export const listExperience = async (userId: number) => {
  await ensureProfile(userId);
  return repository.listExperience(userId);
};

export const createExperience = async (userId: number, entry: ExperienceInput) => {
  await ensureProfile(userId);
  return repository.createExperience(userId, entry);
};

export const updateExperience = (
  userId: number,
  id: number,
  entry: ExperiencePatch,
) => repository.updateExperience(userId, id, entry);

export const deleteExperience = (userId: number, id: number) =>
  repository.deleteExperience(userId, id);

export const getProfileCompletion = async (userId: number) => {
  await ensureProfile(userId);
  const completion = await repository.profileCompletionData(userId);
  const fields = [
    Boolean(completion.profile?.name),
    Boolean(completion.profile?.phone),
    Boolean(completion.profile?.bio),
    Boolean(completion.profile?.picture_url),
    Boolean(completion.profile?.resume_url),
    Number(completion.skills?.count ?? 0) > 0,
    Number(completion.education?.count ?? 0) > 0,
    Number(completion.experience?.count ?? 0) > 0,
  ];
  const completed = fields.filter(Boolean).length;
  return { percentage: Math.round((completed / fields.length) * 100), completed, total: fields.length };
};

export const getPublicProfile = async (userId: number) => {
  const result = await repository.publicProfile(userId);
  if (!result.profile) return result;
  const { user_id, name, bio, picture_url } = result.profile;
  return {
    profile: { user_id, name, bio, picture_url },
    skills: result.skills,
    education: result.education,
    experience: result.experience,
  };
};

export const addSavedJob = async (userId: number, jobId: string) => {
  await ensureProfile(userId);
  return repository.saveJob(userId, jobId);
};

export const removeSavedJob = (userId: number, jobId: string) =>
  repository.unsaveJob(userId, jobId);

export const getSavedJobs = async (userId: number) => {
  await ensureProfile(userId);
  return repository.listSavedJobs(userId);
};
