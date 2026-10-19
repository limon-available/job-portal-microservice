import { sql } from "../utils/db.js";
import type { CompanyInput, CompanyPatch, JobInput, JobPatch } from "../services/types.js";

export const listCompanies = async (ownerId: number) => sql`
  SELECT company_id,name,description,website,location,logo_url,logo_public_id,created_at,updated_at
  FROM companies WHERE owner_id=${ownerId} ORDER BY created_at DESC
`;

export const findCompany = async (companyId: number) => {
  const [company] = await sql`
    SELECT company_id,owner_id,name,description,website,location,logo_url,logo_public_id
    FROM companies WHERE company_id=${companyId}
  `;
  return company;
};

export const createCompany = async (ownerId: number, company: CompanyInput) => {
  const [created] = await sql`
    INSERT INTO companies(owner_id,name,description,website,location)
    VALUES(${ownerId},${company.name},${company.description},${company.website ?? null},
      ${company.location ?? null})
    RETURNING company_id,owner_id,name,description,website,location,logo_url,logo_public_id,
      created_at,updated_at
  `;
  return created;
};

export const updateCompany = async (ownerId: number, companyId: number, company: CompanyPatch) => {
  const [updated] = await sql`
    UPDATE companies SET
      name=COALESCE(${company.name ?? null},name),
      description=COALESCE(${company.description ?? null},description),
      website=CASE WHEN ${company.website !== undefined} THEN ${company.website ?? null} ELSE website END,
      location=CASE WHEN ${company.location !== undefined} THEN ${company.location ?? null} ELSE location END,
      updated_at=CURRENT_TIMESTAMP
    WHERE company_id=${companyId} AND owner_id=${ownerId}
    RETURNING company_id,owner_id,name,description,website,location,logo_url,logo_public_id,
      created_at,updated_at
  `;
  return updated;
};

export const updateCompanyLogo = async (
  ownerId: number,
  companyId: number,
  logoUrl: string,
  publicId: string,
) => {
  const [updated] = await sql`
    UPDATE companies SET logo_url=${logoUrl},logo_public_id=${publicId},updated_at=CURRENT_TIMESTAMP
    WHERE company_id=${companyId} AND owner_id=${ownerId}
    RETURNING company_id,logo_url,logo_public_id
  `;
  return updated;
};

export const deleteCompany = async (ownerId: number, companyId: number) => sql`
  DELETE FROM companies WHERE company_id=${companyId} AND owner_id=${ownerId}
  RETURNING company_id,logo_public_id
`;

const slugify = (title: string): string =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180) || "job";

export const findOwnedJob = async (ownerId: number, jobId: number) => {
  const [job] = await sql`
    SELECT j.job_id,j.title,j.description,j.location,j.job_type,j.salary_min,j.salary_max,
      j.experience_years,j.deadline,j.status,j.company_id,j.posted_by,j.views,j.slug,
      j.created_at,j.updated_at,c.name AS company_name,
      COALESCE((
        SELECT array_agg(js.skill ORDER BY js.skill)
        FROM job_skills js WHERE js.job_id=j.job_id
      ),ARRAY[]::varchar[]) AS skills
    FROM jobs j JOIN companies c ON c.company_id=j.company_id
    WHERE j.job_id=${jobId} AND j.posted_by=${ownerId} AND c.owner_id=${ownerId}
  `;
  return job;
};

export const findJob = async (jobIdOrSlug: string) => {
  const numericId = /^\d+$/.test(jobIdOrSlug) ? Number(jobIdOrSlug) : null;
  const [job] = await sql`
    SELECT j.job_id,j.title,j.description,j.location,j.job_type,j.salary_min,j.salary_max,
      j.experience_years,j.deadline,j.status,j.company_id,j.posted_by,j.views,j.slug,
      j.created_at,j.updated_at,c.name AS company_name,c.description AS company_description,
      c.website AS company_website,c.location AS company_location,c.logo_url AS company_logo
    FROM jobs j JOIN companies c ON c.company_id=j.company_id
    WHERE (${numericId}::bigint IS NOT NULL AND j.job_id=${numericId})
       OR (${numericId}::bigint IS NULL AND j.slug=${jobIdOrSlug})
  `;
  return job;
};

export const createJob = async (ownerId: number, job: JobInput, slugSuffix: string) => {
  const slug = `${slugify(job.title)}-${slugSuffix}`;
  const [created] = await sql`
    INSERT INTO jobs(
      title,description,location,job_type,salary_min,salary_max,experience_years,
      deadline,status,company_id,posted_by,slug
    )
    SELECT ${job.title},${job.description},${job.location},${job.jobType},${job.salaryMin ?? null},
      ${job.salaryMax ?? null},${job.experienceYears},${job.deadline ?? null},${job.status},
      c.company_id,${ownerId},${slug}
    FROM companies c WHERE c.company_id=${job.companyId} AND c.owner_id=${ownerId}
    RETURNING job_id,title,description,location,job_type,salary_min,salary_max,experience_years,
      deadline,status,company_id,posted_by,views,slug,created_at,updated_at
  `;
  if (created) {
    for (const skill of [...new Set(job.skills.map((name) => name.trim().toLowerCase()))]) {
      await sql`INSERT INTO job_skills(job_id,skill) VALUES(${created.job_id},${skill})`;
    }
  }
  return created;
};

export const updateJob = async (ownerId: number, jobId: number, job: JobPatch) => {
  const [updated] = await sql`
    UPDATE jobs j SET
      title=COALESCE(${job.title ?? null},j.title),
      description=COALESCE(${job.description ?? null},j.description),
      location=COALESCE(${job.location ?? null},j.location),
      job_type=COALESCE(${job.jobType ?? null},j.job_type),
      salary_min=CASE WHEN ${job.salaryMin !== undefined} THEN ${job.salaryMin ?? null} ELSE j.salary_min END,
      salary_max=CASE WHEN ${job.salaryMax !== undefined} THEN ${job.salaryMax ?? null} ELSE j.salary_max END,
      experience_years=COALESCE(${job.experienceYears ?? null},j.experience_years),
      deadline=CASE WHEN ${job.deadline !== undefined} THEN ${job.deadline ?? null} ELSE j.deadline END,
      status=COALESCE(${job.status ?? null},j.status),
      company_id=COALESCE((
        SELECT c.company_id FROM companies c
        WHERE c.company_id=COALESCE(${job.companyId ?? null},j.company_id)
          AND c.owner_id=${ownerId}
      ),j.company_id),
      updated_at=CURRENT_TIMESTAMP
    WHERE j.job_id=${jobId} AND j.posted_by=${ownerId}
      AND EXISTS (
        SELECT 1 FROM companies own_company
        WHERE own_company.company_id=j.company_id AND own_company.owner_id=${ownerId}
      )
    RETURNING j.job_id,j.title,j.description,j.location,j.job_type,j.salary_min,j.salary_max,
      j.experience_years,j.deadline,j.status,j.company_id,j.posted_by,j.views,j.slug,
      j.created_at,j.updated_at
  `;
  if (updated && job.skills !== undefined) {
    await sql`DELETE FROM job_skills WHERE job_id=${jobId}`;
    for (const skill of [...new Set(job.skills.map((name) => name.trim().toLowerCase()))]) {
      await sql`INSERT INTO job_skills(job_id,skill) VALUES(${jobId},${skill})`;
    }
  }
  return updated;
};

export const updateJobStatus = async (
  ownerId: number,
  jobId: number,
  status: "draft" | "open" | "closed" | "expired",
) => {
  const [updated] = await sql`
    UPDATE jobs j SET status=${status},updated_at=CURRENT_TIMESTAMP
    WHERE j.job_id=${jobId} AND j.posted_by=${ownerId}
      AND EXISTS (
        SELECT 1 FROM companies c WHERE c.company_id=j.company_id AND c.owner_id=${ownerId}
      )
    RETURNING j.job_id,j.title,j.description,j.location,j.job_type,j.salary_min,j.salary_max,
      j.experience_years,j.deadline,j.status,j.company_id,j.posted_by,j.views,j.slug,
      j.created_at,j.updated_at
  `;
  return updated;
};

export const deleteJob = async (ownerId: number, jobId: number) => sql`
  DELETE FROM jobs j
  WHERE j.job_id=${jobId} AND j.posted_by=${ownerId}
    AND EXISTS (
      SELECT 1 FROM companies c WHERE c.company_id=j.company_id AND c.owner_id=${ownerId}
    )
  RETURNING j.job_id,j.title,j.company_id
`;

export const listMyJobs = async (ownerId: number) => sql`
  SELECT j.job_id,j.title,j.description,j.location,j.job_type,j.salary_min,j.salary_max,
    j.experience_years,j.deadline,j.status,j.company_id,j.posted_by,j.views,j.slug,
    j.created_at,j.updated_at,c.name AS company_name,
    COALESCE((
      SELECT array_agg(js.skill ORDER BY js.skill)
      FROM job_skills js WHERE js.job_id=j.job_id
    ),ARRAY[]::varchar[]) AS skills
  FROM jobs j JOIN companies c ON c.company_id=j.company_id
  WHERE j.posted_by=${ownerId} AND c.owner_id=${ownerId}
  ORDER BY j.created_at DESC
`;

export const replaceJobSkills = async (jobId: number, skills: string[]): Promise<void> => {
  await sql`DELETE FROM job_skills WHERE job_id=${jobId}`;
  for (const skill of [...new Set(skills.map((name) => name.trim().toLowerCase()))]) {
    await sql`INSERT INTO job_skills(job_id,skill) VALUES(${jobId},${skill})`;
  }
};

export interface SearchFilters {
  keyword?: string;
  location?: string;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  skills: string[];
  sort: "newest" | "oldest" | "salary_asc" | "salary_desc";
  limit: number;
  offset: number;
}

export const searchJobs = async (filters: SearchFilters) => {
  const keyword = filters.keyword || null;
  const location = filters.location || null;
  const jobType = filters.jobType || null;
  const salaryMin = filters.salaryMin ?? null;
  const salaryMax = filters.salaryMax ?? null;
  const skills = filters.skills;
  const rows = await sql`
    SELECT j.job_id,j.title,j.description,j.location,j.job_type,j.salary_min,j.salary_max,
      j.experience_years,j.deadline,j.status,j.company_id,j.posted_by,j.views,j.slug,
      j.created_at,j.updated_at,c.name AS company_name,c.logo_url AS company_logo,
      COALESCE(array_agg(DISTINCT js.skill) FILTER (WHERE js.skill IS NOT NULL),ARRAY[]::text[]) AS skills
    FROM jobs j JOIN companies c ON c.company_id=j.company_id
    LEFT JOIN job_skills js ON js.job_id=j.job_id
    WHERE j.status='open'
      AND (j.deadline IS NULL OR j.deadline >= CURRENT_DATE)
      AND (${keyword}::text IS NULL OR c.name ILIKE '%' || ${keyword} || '%' OR
        to_tsvector('english',coalesce(j.title,'') || ' ' || coalesce(j.description,'')) @@
        plainto_tsquery('english',${keyword}))
      AND (${location}::text IS NULL OR j.location ILIKE '%' || ${location} || '%')
      AND (${jobType}::text IS NULL OR j.job_type=${jobType})
      AND (${salaryMin}::integer IS NULL OR j.salary_max IS NULL OR j.salary_max >= ${salaryMin})
      AND (${salaryMax}::integer IS NULL OR j.salary_min IS NULL OR j.salary_min <= ${salaryMax})
      AND (cardinality(${skills}::text[])=0 OR EXISTS (
        SELECT 1 FROM job_skills search_skill
        WHERE search_skill.job_id=j.job_id
          AND lower(search_skill.skill)=ANY(${skills}::text[])
      ))
    GROUP BY j.job_id,c.name,c.logo_url
    ORDER BY
      CASE WHEN ${filters.sort}='newest' THEN j.created_at END DESC,
      CASE WHEN ${filters.sort}='oldest' THEN j.created_at END ASC,
      CASE WHEN ${filters.sort}='salary_asc' THEN j.salary_min END ASC NULLS LAST,
      CASE WHEN ${filters.sort}='salary_desc' THEN j.salary_max END DESC NULLS LAST,
      j.job_id DESC
    LIMIT ${filters.limit} OFFSET ${filters.offset}
  `;
  const [count] = await sql`
    SELECT COUNT(DISTINCT j.job_id)::integer AS total
    FROM jobs j JOIN companies c ON c.company_id=j.company_id
    WHERE j.status='open' AND (j.deadline IS NULL OR j.deadline >= CURRENT_DATE)
      AND (${keyword}::text IS NULL OR c.name ILIKE '%' || ${keyword} || '%' OR
        to_tsvector('english',coalesce(j.title,'') || ' ' || coalesce(j.description,'')) @@
        plainto_tsquery('english',${keyword}))
      AND (${location}::text IS NULL OR j.location ILIKE '%' || ${location} || '%')
      AND (${jobType}::text IS NULL OR j.job_type=${jobType})
      AND (${salaryMin}::integer IS NULL OR j.salary_max IS NULL OR j.salary_max >= ${salaryMin})
      AND (${salaryMax}::integer IS NULL OR j.salary_min IS NULL OR j.salary_min <= ${salaryMax})
      AND (cardinality(${skills}::text[])=0 OR EXISTS (
        SELECT 1 FROM job_skills search_skill
        WHERE search_skill.job_id=j.job_id
          AND lower(search_skill.skill)=ANY(${skills}::text[])
      ))
  `;
  return { jobs: rows, total: Number(count?.total ?? 0) };
};

export const incrementJobViews = async (jobId: number, count: number) => sql`
  UPDATE jobs SET views=views+${count} WHERE job_id=${jobId}
`;

export const expireJobsAndQueueEvents = async () => sql`
  WITH expired AS (
    UPDATE jobs SET status='expired',updated_at=CURRENT_TIMESTAMP
    WHERE status='open' AND deadline < CURRENT_DATE
    RETURNING job_id,title,company_id,posted_by
  )
  INSERT INTO job_event_outbox(event_id,payload)
  SELECT event_id,jsonb_build_object(
    'eventId',event_id,
    'occurredAt',CURRENT_TIMESTAMP,
    'jobId',job_id::text,
    'recruiterId',posted_by,
    'companyId',company_id,
    'title',title,
    'status','expired',
    'changes',jsonb_build_object('status','expired')
  )
  FROM (
    SELECT gen_random_uuid() AS event_id,job_id,title,company_id,posted_by
    FROM expired
  ) queued
  RETURNING event_id,payload
`;

export const pendingExpiryEvents = async () => sql`
  SELECT event_id,payload FROM job_event_outbox
  WHERE published_at IS NULL ORDER BY created_at LIMIT 100
`;

export const markExpiryEventPublished = async (eventId: string): Promise<void> => {
  await sql`
    UPDATE job_event_outbox SET published_at=CURRENT_TIMESTAMP
    WHERE event_id=${eventId}::uuid AND published_at IS NULL
  `;
};

export const listJobSkills = async (jobId: number): Promise<string[]> => {
  const rows = await sql`
    SELECT skill FROM job_skills WHERE job_id=${jobId} ORDER BY skill
  `;
  return rows.map((row) => String(row.skill));
};

export const companyHasJobs = async (companyId: number): Promise<boolean> => {
  const [row] = await sql`
    SELECT EXISTS(SELECT 1 FROM jobs WHERE company_id=${companyId}) AS has_jobs
  `;
  return row?.has_jobs === true;
};
