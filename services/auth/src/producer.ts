import {
  createLogger,
  createProducer,
  KAFKA_TOPICS,
  type KafkaTopic,
  type SharedProducer,
} from "@hireheaven/shared";
import { Kafka } from "kafkajs";
import { env } from "./config/env.js";

const logger = createLogger({ level: env.LOG_LEVEL });
let producer: SharedProducer | undefined;

export const connectKafka = async (): Promise<void> => {
  const kafkaConfig = {
    clientId: "auth-service",
    brokers: env.KAFKA_BROKER,
  };
  const kafka = new Kafka(kafkaConfig);
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      topics: [
        ...Object.values(KAFKA_TOPICS).map((topic) => ({
          topic,
          numPartitions: 1,
          replicationFactor: 1,
        })),
        ...Object.values(KAFKA_TOPICS).map((topic) => ({
          topic: `${topic}.dlq`,
          numPartitions: 1,
          replicationFactor: 1,
        })),
      ],
    });
  } finally {
    await admin.disconnect();
  }

  producer = await createProducer({ kafka: kafkaConfig });
  logger.info("connected to Kafka producer");
};

export const publishToTopic = async (
  topic: KafkaTopic,
  message: object,
): Promise<void> => {
  if (!producer) {
    throw new Error("Kafka producer is not initialized");
  }
  const eventId = "eventId" in message && typeof message.eventId === "string"
    ? message.eventId
    : undefined;
  await producer.publish(topic, message, eventId);
};

export const disconnectKafka = async (): Promise<void> => {
  if (producer) {
    await producer.disconnect();
    producer = undefined;
  }
};
