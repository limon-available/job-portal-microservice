import type { z } from "zod";
import type {
  educationCreateSchema,
  educationUpdateSchema,
  experienceCreateSchema,
  experienceUpdateSchema,
  profileSchema,
} from "../validators/user.js";
import { AppError } from "@hireheaven/shared";
import { sql } from "../utils/db.js";

type ProfileInput = z.infer<typeof profileSchema>;
type EducationInput = z.infer<typeof educationCreateSchema>;
type EducationPatch = z.infer<typeof educationUpdateSchema>;
type ExperienceInput = z.infer<typeof experienceCreateSchema>;
type ExperiencePatch = z.infer<typeof experienceUpdateSchema>;

export const ensureProfile = async (userId: number): Promise<void> => {
  await sql`
    INSERT INTO profiles(user_id) VALUES(${userId})
    ON CONFLICT(user_id) DO NOTHING
  `;
};

export const findProfile = async (userId: number) => {
  const [profile] = await sql`
    SELECT user_id,name,phone,bio,picture_url,picture_public_id,resume_url,resume_public_id,
      created_at,updated_at
    FROM profiles WHERE user_id=${userId}
  `;
  return profile;
};

export const updateProfile = async (userId: number, profile: ProfileInput) => {
  const [updated] = await sql`
    INSERT INTO profiles(user_id,name,phone,bio)
    VALUES(${userId},${profile.name},${profile.phone},${profile.bio})
    ON CONFLICT(user_id) DO UPDATE SET
      name=EXCLUDED.name,phone=EXCLUDED.phone,bio=EXCLUDED.bio,updated_at=CURRENT_TIMESTAMP
    RETURNING user_id,name,phone,bio,picture_url,picture_public_id,resume_url,resume_public_id,
      created_at,updated_at
  `;
  return updated;
};

export const updateProfileAsset = async (
  userId: number,
  asset: "picture" | "resume",
  url: string,
  publicId: string,
) => {
  if (asset === "picture") {
    const [updated] = await sql`
      INSERT INTO profiles(user_id,picture_url,picture_public_id)
      VALUES(${userId},${url},${publicId})
      ON CONFLICT(user_id) DO UPDATE SET
        picture_url=EXCLUDED.picture_url,picture_public_id=EXCLUDED.picture_public_id,
        updated_at=CURRENT_TIMESTAMP
      RETURNING user_id,picture_url,picture_public_id
    `;
    return updated;
  }
  const [updated] = await sql`
    INSERT INTO profiles(user_id,resume_url,resume_public_id)
    VALUES(${userId},${url},${publicId})
    ON CONFLICT(user_id) DO UPDATE SET
      resume_url=EXCLUDED.resume_url,resume_public_id=EXCLUDED.resume_public_id,
      updated_at=CURRENT_TIMESTAMP
    RETURNING user_id,resume_url,resume_public_id
  `;
  return updated;
};

export const findProfileAsset = async (
  userId: number,
  asset: "picture" | "resume",
): Promise<{ public_id: string | null } | undefined> => {
  if (asset === "picture") {
    const [row] = await sql`
      SELECT picture_public_id AS public_id FROM profiles WHERE user_id=${userId}
    `;
    return row as { public_id: string | null } | undefined;
  }
  const [row] = await sql`
    SELECT resume_public_id AS public_id FROM profiles WHERE user_id=${userId}
  `;
  return row as { public_id: string | null } | undefined;
};

export const listSkills = async (userId: number) => sql`
  SELECT s.skill_id,s.name FROM skills s
  JOIN user_skills us ON us.skill_id=s.skill_id
  WHERE us.user_id=${userId} ORDER BY s.name
`;

export const addSkill = async (userId: number, name: string): Promise<void> => {
  const [skill] = await sql`
    INSERT INTO skills(name) VALUES(${name})
    ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name
    RETURNING skill_id
  `;
  if (!skill) throw new AppError(500, "Could not create or find skill", false);
  await sql`
    INSERT INTO user_skills(user_id,skill_id) VALUES(${userId},${skill.skill_id})
    ON CONFLICT(user_id,skill_id) DO NOTHING
  `;
};

export const deleteSkillByName = async (userId: number, name: string) => sql`
  DELETE FROM user_skills us USING skills s
  WHERE us.user_id=${userId} AND us.skill_id=s.skill_id AND LOWER(s.name)=LOWER(${name})
  RETURNING us.skill_id
`;

export const listEducation = async (userId: number) => sql`
  SELECT education_id,institution,degree,field_of_study,start_date,end_date,description
  FROM education WHERE user_id=${userId} ORDER BY start_date DESC NULLS LAST,education_id DESC
`;

export const createEducation = async (userId: number, entry: EducationInput) => {
  const [created] = await sql`
    INSERT INTO education(user_id,institution,degree,field_of_study,start_date,end_date,description)
    VALUES(${userId},${entry.institution},${entry.degree},${entry.fieldOfStudy ?? null},
      ${entry.startDate ?? null},${entry.endDate ?? null},${entry.description ?? null})
    RETURNING education_id,institution,degree,field_of_study,start_date,end_date,description
  `;
  return created;
};

export const updateEducation = async (
  userId: number,
  educationId: number,
  entry: EducationPatch,
) => {
  const [updated] = await sql`
    UPDATE education SET
      institution=COALESCE(${entry.institution ?? null},institution),
      degree=COALESCE(${entry.degree ?? null},degree),
      field_of_study=CASE WHEN ${entry.fieldOfStudy !== undefined} THEN ${entry.fieldOfStudy ?? null} ELSE field_of_study END,
      start_date=CASE WHEN ${entry.startDate !== undefined} THEN ${entry.startDate ?? null} ELSE start_date END,
      end_date=CASE WHEN ${entry.endDate !== undefined} THEN ${entry.endDate ?? null} ELSE end_date END,
      description=CASE WHEN ${entry.description !== undefined} THEN ${entry.description ?? null} ELSE description END
    WHERE user_id=${userId} AND education_id=${educationId}
    RETURNING education_id,institution,degree,field_of_study,start_date,end_date,description
  `;
  return updated;
};

export const deleteEducation = async (userId: number, educationId: number) => sql`
  DELETE FROM education WHERE user_id=${userId} AND education_id=${educationId}
  RETURNING education_id
`;

export const listExperience = async (userId: number) => sql`
  SELECT experience_id,company,title,location,start_date,end_date,description
  FROM experience WHERE user_id=${userId} ORDER BY start_date DESC NULLS LAST,experience_id DESC
`;

export const createExperience = async (userId: number, entry: ExperienceInput) => {
  const [created] = await sql`
    INSERT INTO experience(user_id,company,title,location,start_date,end_date,description)
    VALUES(${userId},${entry.company},${entry.title},${entry.location ?? null},
      ${entry.startDate ?? null},${entry.endDate ?? null},${entry.description ?? null})
    RETURNING experience_id,company,title,location,start_date,end_date,description
  `;
  return created;
};

export const updateExperience = async (
  userId: number,
  experienceId: number,
  entry: ExperiencePatch,
) => {
  const [updated] = await sql`
    UPDATE experience SET
      company=COALESCE(${entry.company ?? null},company),
      title=COALESCE(${entry.title ?? null},title),
      location=CASE WHEN ${entry.location !== undefined} THEN ${entry.location ?? null} ELSE location END,
      start_date=CASE WHEN ${entry.startDate !== undefined} THEN ${entry.startDate ?? null} ELSE start_date END,
      end_date=CASE WHEN ${entry.endDate !== undefined} THEN ${entry.endDate ?? null} ELSE end_date END,
      description=CASE WHEN ${entry.description !== undefined} THEN ${entry.description ?? null} ELSE description END
    WHERE user_id=${userId} AND experience_id=${experienceId}
    RETURNING experience_id,company,title,location,start_date,end_date,description
  `;
  return updated;
};

export const deleteExperience = async (userId: number, experienceId: number) => sql`
  DELETE FROM experience WHERE user_id=${userId} AND experience_id=${experienceId}
  RETURNING experience_id
`;

export const listSavedJobs = async (userId: number) => sql`
  SELECT job_id,created_at FROM saved_jobs
  WHERE user_id=${userId} ORDER BY created_at DESC
`;

export const saveJob = async (userId: number, jobId: string) => {
  const [saved] = await sql`
    INSERT INTO saved_jobs(user_id,job_id) VALUES(${userId},${jobId})
    ON CONFLICT(user_id,job_id) DO UPDATE SET job_id=EXCLUDED.job_id
    RETURNING job_id,created_at
  `;
  return saved;
};

export const unsaveJob = async (userId: number, jobId: string) => sql`
  DELETE FROM saved_jobs WHERE user_id=${userId} AND job_id=${jobId}
  RETURNING job_id
`;

export const publicProfile = async (userId: number) => {
  const profile = await sql`
    SELECT user_id,name,bio,picture_url FROM profiles WHERE user_id=${userId}
  `;
  const [skills, education, experience] = await Promise.all([
    listSkills(userId),
    listEducation(userId),
    listExperience(userId),
  ]);
  return { profile: profile[0], skills, education, experience };
};

export const profileCompletionData = async (userId: number) => {
  const [profile] = await sql`
    SELECT name,phone,bio,picture_url,resume_url FROM profiles WHERE user_id=${userId}
  `;
  const [skills] = await sql`SELECT COUNT(*)::integer AS count FROM user_skills WHERE user_id=${userId}`;
  const [education] = await sql`SELECT COUNT(*)::integer AS count FROM education WHERE user_id=${userId}`;
  const [experience] = await sql`SELECT COUNT(*)::integer AS count FROM experience WHERE user_id=${userId}`;
  return { profile, skills, education, experience };
};
