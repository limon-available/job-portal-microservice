import {
  createProducer,
  KAFKA_TOPICS,
  type JobCreated,
  type JobDeleted,
  type JobUpdated,
  type SharedProducer,
} from "@hireheaven/shared";
import { env } from "../config/env.js";

let producer: SharedProducer | undefined;

export const connectKafka = async (): Promise<void> => {
  producer = await createProducer({
    kafka: { clientId: "job-service", brokers: env.KAFKA_BROKER },
  });
};

export const publishJobCreated = async (event: JobCreated): Promise<void> => {
  if (!producer) throw new Error("Job Kafka producer is not connected");
  await producer.publish(KAFKA_TOPICS.JobCreated, event, event.eventId);
};

export const publishJobUpdated = async (event: JobUpdated): Promise<void> => {
  if (!producer) throw new Error("Job Kafka producer is not connected");
  await producer.publish(KAFKA_TOPICS.JobUpdated, event, event.eventId);
};

export const publishJobDeleted = async (event: JobDeleted): Promise<void> => {
  if (!producer) throw new Error("Job Kafka producer is not connected");
  await producer.publish(KAFKA_TOPICS.JobDeleted, event, event.eventId);
};

export const disconnectKafka = async (): Promise<void> => {
  if (producer) {
    await producer.disconnect();
    producer = undefined;
  }
};
