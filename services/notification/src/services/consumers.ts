import {
  createConsumer,
  KAFKA_TOPICS,
  type SharedConsumer,
  type ApplicationStatusChanged,
  type ApplicationSubmitted,
  type JobCreated,
  type PasswordResetRequested,
  type UserRegistered,
} from "@hireheaven/shared";
import type { RedisIdempotencyClient } from "@hireheaven/shared";
import { z } from "zod";
import { env } from "../config/env.js";
import type { NotificationDependencies } from "./eventHandlers.js";
import { createNotificationHandlers } from "./eventHandlers.js";

export const startConsumers = async (
  redis: RedisIdempotencyClient,
  dependencies: NotificationDependencies,
): Promise<SharedConsumer[]> => {
  const handlers = createNotificationHandlers(dependencies);
  const kafka = {
    clientId: "notification-service",
    brokers: env.KAFKA_BROKER,
  };
  const consumerConfig = { groupId: "hireheaven-notifications" };
  const eventBase = {
    eventId: z.string().min(1),
    occurredAt: z.string().datetime(),
  };
  const eventSchemas = {
    userRegistered: z.object({
      ...eventBase,
      userId: z.number().int().positive(),
      email: z.string().email(),
      name: z.string().min(1),
      verificationToken: z.string().min(1),
    }),
    passwordResetRequested: z.object({
      ...eventBase,
      userId: z.number().int().positive(),
      email: z.string().email(),
      resetToken: z.string().min(1),
    }),
    applicationSubmitted: z.object({
      ...eventBase,
      applicationId: z.string().min(1),
      jobId: z.string().min(1),
      applicantId: z.number().int().positive(),
      applicantName: z.string().min(1),
      recruiterId: z.number().int().positive(),
      recruiterEmail: z.string().email(),
      recruiterName: z.string().min(1),
      jobTitle: z.string().min(1),
    }),
    applicationStatusChanged: z.object({
      ...eventBase,
      applicationId: z.string().min(1),
      jobId: z.string().min(1),
      applicantId: z.number().int().positive(),
      applicantEmail: z.string().email(),
      applicantName: z.string().min(1),
      jobTitle: z.string().min(1),
      previousStatus: z.string().min(1),
      status: z.string().min(1),
    }),
    jobCreated: z.object({
      ...eventBase,
      jobId: z.string().min(1),
      recruiterId: z.number().int().positive(),
      companyId: z.number().int().positive(),
      companyName: z.string(),
      title: z.string().min(1),
      description: z.string(),
      location: z.string(),
      jobType: z.string().min(1),
      salaryMin: z.number().nullable(),
      salaryMax: z.number().nullable(),
      skills: z.array(z.string()),
      deadline: z.string().nullable(),
      matchingRecipients: z
        .array(
          z.object({
            userId: z.number().int().positive(),
            email: z.string().email(),
            name: z.string().min(1),
          }),
        )
        .default([]),
    }),
  };

  const consumers: SharedConsumer[] = [];
  const subscribe = async <T>(
    topic: string,
    schema: z.ZodType<T>,
    handler: (payload: T) => Promise<void>,
  ): Promise<SharedConsumer> =>
    createConsumer<T>({
      kafka,
      consumer: consumerConfig,
      topic,
      redis,
      handler: (payload) => handler(schema.parse(payload)),
    });
  try {
    consumers.push(
      await subscribe<UserRegistered>(
        KAFKA_TOPICS.UserRegistered,
        eventSchemas.userRegistered,
        handlers.userRegistered,
      ),
    );
    consumers.push(
      await subscribe<PasswordResetRequested>(
        KAFKA_TOPICS.PasswordResetRequested,
        eventSchemas.passwordResetRequested,
        handlers.passwordResetRequested,
      ),
    );
    consumers.push(
      await subscribe<ApplicationSubmitted>(
        KAFKA_TOPICS.ApplicationSubmitted,
        eventSchemas.applicationSubmitted,
        handlers.applicationSubmitted,
      ),
    );
    consumers.push(
      await subscribe<ApplicationStatusChanged>(
        KAFKA_TOPICS.ApplicationStatusChanged,
        eventSchemas.applicationStatusChanged,
        handlers.applicationStatusChanged,
      ),
    );
    consumers.push(
      await subscribe<JobCreated>(
        KAFKA_TOPICS.JobCreated,
        eventSchemas.jobCreated,
        handlers.jobCreated,
      ),
    );
    return consumers;
  } catch (error) {
    await Promise.all(consumers.map((consumer) => consumer.stop()));
    throw error;
  }
};
