import {
  createConsumer,
  KAFKA_TOPICS,
  type JobDeleted,
  type RedisIdempotencyClient,
  type SharedConsumer,
} from "@hireheaven/shared";
import { z } from "zod";
import { env } from "../config/env.js";
import { closeApplicationsForDeletedJob } from "./application.js";

const jobDeletedSchema = z.object({
  eventId: z.string().min(1),
  occurredAt: z.string().datetime(),
  jobId: z.string().regex(/^[1-9]\d*$/)
    .refine((jobId) => Number.isSafeInteger(Number(jobId))),
  recruiterId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  title: z.string().min(1),
});

export const startConsumers = async (
  redis: RedisIdempotencyClient,
): Promise<SharedConsumer[]> => {
  const consumer = await createConsumer<JobDeleted>({
    kafka: { clientId: "application-service", brokers: env.KAFKA_BROKER },
    consumer: { groupId: "hireheaven-applications" },
    topic: KAFKA_TOPICS.JobDeleted,
    redis,
    handler: async (payload) => {
      const event = jobDeletedSchema.parse(payload);
      await closeApplicationsForDeletedJob(Number(event.jobId));
    },
  });
  return [consumer];
};
