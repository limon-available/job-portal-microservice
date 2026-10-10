import {
  createProducer,
  KAFKA_TOPICS,
  type ApplicationStatusChanged,
  type ApplicationSubmitted,
  type SharedProducer,
} from "@hireheaven/shared";
import { env } from "../config/env.js";

let producer: SharedProducer | undefined;

export const connectKafka = async (): Promise<void> => {
  producer = await createProducer({
    kafka: { clientId: "application-service", brokers: env.KAFKA_BROKER },
  });
};

export const publishApplicationSubmitted = async (event: ApplicationSubmitted): Promise<void> => {
  if (!producer) throw new Error("Application Kafka producer is not connected");
  await producer.publish(KAFKA_TOPICS.ApplicationSubmitted, event, event.eventId);
};

export const publishApplicationStatusChanged = async (
  event: ApplicationStatusChanged,
): Promise<void> => {
  if (!producer) throw new Error("Application Kafka producer is not connected");
  await producer.publish(KAFKA_TOPICS.ApplicationStatusChanged, event, event.eventId);
};

export const disconnectKafka = async (): Promise<void> => {
  if (producer) {
    await producer.disconnect();
    producer = undefined;
  }
};
