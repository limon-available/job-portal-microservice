import type { RequestHandler } from "express";
import { AppError } from "@hireheaven/shared";
import { z } from "zod";
import { TryCatch } from "../utils/TryCatch.js";
import {
  educationCreateSchema,
  educationUpdateSchema,
  experienceCreateSchema,
  experienceUpdateSchema,
  idSchema,
  profileSchema,
  publicUserIdSchema,
  savedJobSchema,
  skillSchema,
} from "../validators/user.js";
import * as userService from "../services/user.js";

const currentUserId = (req: Parameters<RequestHandler>[0]): number => {
  const userId = req.authenticatedUser?.userId;
  if (!userId) throw new AppError(401, "Authentication required");
  return userId;
};

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, "Invalid request data");
  return result.data;
};

const requireFile = (req: Parameters<RequestHandler>[0]): Express.Multer.File => {
  if (!req.file) throw new AppError(400, "file is required");
  return req.file;
};

export const getProfile: RequestHandler = TryCatch(async (req, res) => {
  const profile = await userService.getProfile(currentUserId(req));
  res.json({ success: true, message: "Profile", data: { profile } });
});

export const putProfile: RequestHandler = TryCatch(async (req, res) => {
  const profile = await userService.saveProfile(
    currentUserId(req),
    parse(profileSchema, req.body),
  );
  res.json({ success: true, message: "Profile updated", data: { profile } });
});

export const putPicture: RequestHandler = TryCatch(async (req, res) => {
  const profile = await userService.replaceProfileAsset(
    currentUserId(req),
    "avatars",
    requireFile(req),
  );
  res.json({ success: true, message: "Profile picture updated", data: { profile } });
});

export const putResume: RequestHandler = TryCatch(async (req, res) => {
  const profile = await userService.replaceProfileAsset(
    currentUserId(req),
    "resumes",
    requireFile(req),
  );
  res.json({ success: true, message: "Resume updated", data: { profile } });
});

export const getProfileCompletion: RequestHandler = TryCatch(async (req, res) => {
  const completion = await userService.getProfileCompletion(currentUserId(req));
  res.json({ success: true, message: "Profile completion", data: completion });
});

export const getPublicProfile: RequestHandler = TryCatch(async (req, res) => {
  const userId = parse(publicUserIdSchema, req.params.userId);
  const profile = await userService.getPublicProfile(userId);
  if (!profile.profile) throw new AppError(404, "Profile not found");
  const { user_id, name, bio, picture_url } = profile.profile;
  res.json({
    success: true,
    message: "Public profile",
    data: {
      profile: { user_id, name, bio, picture_url },
      skills: profile.skills,
      education: profile.education,
      experience: profile.experience,
    },
  });
});

export const getSkills: RequestHandler = TryCatch(async (req, res) => {
  const skills = await userService.listSkills(currentUserId(req));
  res.json({ success: true, message: "Skills", data: { skills } });
});

export const addSkill: RequestHandler = TryCatch(async (req, res) => {
  const { name } = parse(skillSchema, req.body);
  const skills = await userService.addSkill(currentUserId(req), name);
  res.status(201).json({ success: true, message: "Skill added", data: { skills } });
});

export const deleteSkill: RequestHandler = TryCatch(async (req, res) => {
  const { name } = parse(skillSchema, req.body);
  const removed = await userService.removeSkill(currentUserId(req), name);
  if (!removed) throw new AppError(404, "Skill not found");
  res.json({ success: true, message: "Skill removed", data: null });
});

export const getEducation: RequestHandler = TryCatch(async (req, res) => {
  const education = await userService.listEducation(currentUserId(req));
  res.json({ success: true, message: "Education", data: { education } });
});

export const postEducation: RequestHandler = TryCatch(async (req, res) => {
  const entry = await userService.createEducation(
    currentUserId(req),
    parse(educationCreateSchema, req.body),
  );
  res.status(201).json({ success: true, message: "Education created", data: { education: entry } });
});

export const putEducation: RequestHandler = TryCatch(async (req, res) => {
  const id = parse(idSchema, req.params.id);
  const entry = await userService.updateEducation(
    currentUserId(req),
    id,
    parse(educationUpdateSchema, req.body),
  );
  if (!entry) throw new AppError(404, "Education not found");
  res.json({ success: true, message: "Education updated", data: { education: entry } });
});

export const deleteEducation: RequestHandler = TryCatch(async (req, res) => {
  const removed = await userService.deleteEducation(
    currentUserId(req),
    parse(idSchema, req.params.id),
  );
  if (removed.length === 0) throw new AppError(404, "Education not found");
  res.json({ success: true, message: "Education deleted", data: null });
});

export const getExperience: RequestHandler = TryCatch(async (req, res) => {
  const experience = await userService.listExperience(currentUserId(req));
  res.json({ success: true, message: "Experience", data: { experience } });
});

export const postExperience: RequestHandler = TryCatch(async (req, res) => {
  const entry = await userService.createExperience(
    currentUserId(req),
    parse(experienceCreateSchema, req.body),
  );
  res.status(201).json({ success: true, message: "Experience created", data: { experience: entry } });
});

export const putExperience: RequestHandler = TryCatch(async (req, res) => {
  const entry = await userService.updateExperience(
    currentUserId(req),
    parse(idSchema, req.params.id),
    parse(experienceUpdateSchema, req.body),
  );
  if (!entry) throw new AppError(404, "Experience not found");
  res.json({ success: true, message: "Experience updated", data: { experience: entry } });
});

export const deleteExperience: RequestHandler = TryCatch(async (req, res) => {
  const removed = await userService.deleteExperience(
    currentUserId(req),
    parse(idSchema, req.params.id),
  );
  if (removed.length === 0) throw new AppError(404, "Experience not found");
  res.json({ success: true, message: "Experience deleted", data: null });
});

export const getSavedJobs: RequestHandler = TryCatch(async (req, res) => {
  const savedJobs = await userService.getSavedJobs(currentUserId(req));
  res.json({ success: true, message: "Saved jobs", data: { savedJobs } });
});

export const postSavedJob: RequestHandler = TryCatch(async (req, res) => {
  const { jobId } = parse(savedJobSchema, req.body);
  const savedJob = await userService.addSavedJob(currentUserId(req), jobId);
  res.status(201).json({ success: true, message: "Job saved", data: { savedJob } });
});

export const deleteSavedJob: RequestHandler = TryCatch(async (req, res) => {
  const jobId = parse(z.string().trim().min(1).max(200), req.params.jobId);
  const removed = await userService.removeSavedJob(currentUserId(req), jobId);
  if (removed.length === 0) throw new AppError(404, "Saved job not found");
  res.json({ success: true, message: "Saved job removed", data: null });
});
