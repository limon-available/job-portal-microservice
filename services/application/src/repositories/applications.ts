import { sql } from "../utils/db.js";
import type { ApplicationReview, ApplicationStatus, RecruiterStatus } from "../validators/application.js";

export interface CreateApplicationInput {
  jobId: number;
  userId: number;
  resumeUrl: string | null;
  coverLetter: string;
}

export const createApplication = async ({
  jobId,
  userId,
  resumeUrl,
  coverLetter,
}: CreateApplicationInput) => {
  const [application] = await sql`
    WITH created AS (
      INSERT INTO applications(job_id,user_id,resume_url,cover_letter,status)
      VALUES(${jobId},${userId},${resumeUrl},${coverLetter},'applied')
      RETURNING *
    ), history AS (
      INSERT INTO application_history(application_id,from_status,to_status,changed_by)
      SELECT application_id,NULL,'applied',${userId} FROM created
      RETURNING application_id
    )
    SELECT created.* FROM created JOIN history USING(application_id)
  `;
  return application;
};

export const findById = async (applicationId: number) => {
  const [application] = await sql`
    SELECT application_id,job_id,user_id,resume_url,cover_letter,status,
      recruiter_note,rating,applied_at,updated_at
    FROM applications WHERE application_id=${applicationId}
  `;
  return application;
};

export const listMine = async (userId: number) => sql`
  SELECT application_id,job_id,user_id,resume_url,cover_letter,status,
    recruiter_note,rating,applied_at,updated_at
  FROM applications WHERE user_id=${userId}
  ORDER BY applied_at DESC
`;

export const withdraw = async (
  applicationId: number,
  userId: number,
  expectedStatus: ApplicationStatus,
) => {
  const [application] = await sql`
    WITH updated AS (
      UPDATE applications SET status='withdrawn',updated_at=CURRENT_TIMESTAMP
      WHERE application_id=${applicationId} AND user_id=${userId} AND status=${expectedStatus}
      RETURNING *,${expectedStatus}::varchar AS previous_status
    ), history AS (
      INSERT INTO application_history(application_id,from_status,to_status,changed_by)
      SELECT application_id,previous_status,'withdrawn',${userId} FROM updated
      RETURNING application_id
    )
    SELECT updated.* FROM updated JOIN history USING(application_id)
  `;
  return application;
};

export const listForJob = async (
  jobId: number,
  status: ApplicationStatus | undefined,
  limit: number,
  offset: number,
) => {
  const applications = await sql`
    SELECT application_id,job_id,user_id,resume_url,cover_letter,status,
      recruiter_note,rating,applied_at,updated_at
    FROM applications
    WHERE job_id=${jobId} AND (${status ?? null}::text IS NULL OR status=${status ?? null})
    ORDER BY applied_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [count] = await sql`
    SELECT COUNT(*)::integer AS total FROM applications
    WHERE job_id=${jobId} AND (${status ?? null}::text IS NULL OR status=${status ?? null})
  `;
  return { applications, total: Number(count?.total ?? 0) };
};

export const findManyByIds = async (applicationIds: number[]) => sql`
  SELECT application_id,job_id,user_id,resume_url,cover_letter,status,
    recruiter_note,rating,applied_at,updated_at
  FROM applications WHERE application_id=ANY(${applicationIds}::bigint[])
`;

export const updateStatus = async (
  applicationId: number,
  expectedStatus: ApplicationStatus,
  status: RecruiterStatus,
  changedBy: number,
  review: ApplicationReview,
) => {
  const [application] = await sql`
    WITH current AS (
      SELECT application_id,status FROM applications
      WHERE application_id=${applicationId} FOR UPDATE
    ), updated AS (
      UPDATE applications a SET
        status=${status},
        recruiter_note=CASE WHEN ${review.recruiterNote !== undefined}
          THEN ${review.recruiterNote ?? null} ELSE a.recruiter_note END,
        rating=CASE WHEN ${review.rating !== undefined}
          THEN ${review.rating ?? null} ELSE a.rating END,
        updated_at=CURRENT_TIMESTAMP
      FROM current c
      WHERE a.application_id=c.application_id AND c.status=${expectedStatus}
      RETURNING a.*,c.status AS previous_status
    ), history AS (
      INSERT INTO application_history(application_id,from_status,to_status,changed_by)
      SELECT application_id,previous_status,${status},${changedBy} FROM updated
      RETURNING application_id
    )
    SELECT updated.* FROM updated JOIN history USING(application_id)
  `;
  return application;
};

export const updateReview = async (
  applicationId: number,
  review: ApplicationReview,
) => {
  const [application] = await sql`
    UPDATE applications SET
      recruiter_note=CASE WHEN ${review.recruiterNote !== undefined}
        THEN ${review.recruiterNote ?? null} ELSE recruiter_note END,
      rating=CASE WHEN ${review.rating !== undefined}
        THEN ${review.rating ?? null} ELSE rating END,
      updated_at=CURRENT_TIMESTAMP
    WHERE application_id=${applicationId}
    RETURNING application_id,job_id,user_id,resume_url,cover_letter,status,
      recruiter_note,rating,applied_at,updated_at
  `;
  return application;
};

export const closeApplicationsForJob = async (jobId: number) => sql`
  WITH updated AS (
    UPDATE applications SET status='closed',updated_at=CURRENT_TIMESTAMP
    WHERE job_id=${jobId} AND status IN ('applied','shortlisted','interview')
    RETURNING application_id,status AS previous_status,user_id,job_id
  ), history AS (
    INSERT INTO application_history(application_id,from_status,to_status,changed_by)
    SELECT application_id,previous_status,'closed',NULL FROM updated
    RETURNING application_id
  )
  SELECT updated.* FROM updated JOIN history USING(application_id)
`;
