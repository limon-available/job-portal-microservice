import axios from "axios";
import { AppError, createLogger } from "@hireheaven/shared";
import { z } from "zod";
import { env } from "../config/env.js";

const logger = createLogger({ level: env.LOG_LEVEL });

const jobSchema = z.object({
  job_id: z.union([z.number(), z.string()]),
  title: z.string().min(1),
  status: z.string(),
  deadline: z.string().nullable().optional(),
  posted_by: z.union([z.number(), z.string()]),
});

export type JobRecord = z.infer<typeof jobSchema>;

export const getJob = async (jobId: number): Promise<JobRecord> => {
  try {
    const response = await axios.get<{ data: { job: unknown } }>(
      `${env.JOB_SERVICE_URL}/api/jobs/internal/jobs/${jobId}`,
      { headers: { "x-internal-key": env.INTERNAL_API_KEY }, timeout: 5000 },
    );
    return jobSchema.parse(response.data.data.job);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new AppError(404, "Job not found");
    }
    logger.error({ err: error, jobId }, "job service lookup failed");
    if (error instanceof AppError) throw error;
    throw new AppError(502, "Job service is unavailable");
  }
};
