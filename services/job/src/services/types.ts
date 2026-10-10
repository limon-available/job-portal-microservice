import type { z } from "zod";
import type { companyPatchSchema, companySchema, jobPatchSchema, jobSchema } from "../validators/job.js";

export type CompanyInput = z.infer<typeof companySchema>;
export type CompanyPatch = z.infer<typeof companyPatchSchema>;
export type JobInput = z.infer<typeof jobSchema>;
export type JobPatch = z.infer<typeof jobPatchSchema>;
