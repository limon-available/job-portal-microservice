import {
  Kafka,
  type Consumer,
  type ConsumerConfig,
  type EachMessagePayload,
  type KafkaConfig,
  type Producer,
  type ProducerConfig,
} from "kafkajs";

export interface RedisIdempotencyClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options: { NX?: true; EX: number },
  ): Promise<string | null>;
  del(key: string): Promise<number>;
}

export interface ProducerOptions {
  kafka: KafkaConfig;
  producer?: ProducerConfig;
  retries?: number;
  initialRetryMs?: number;
  maxRetryMs?: number;
}

export interface SharedProducer {
  producer: Producer;
  publish(topic: string, payload: object, key?: string): Promise<void>;
  disconnect(): Promise<void>;
}

export interface ConsumerOptions<T> {
  kafka: KafkaConfig;
  consumer: ConsumerConfig;
  topic: string;
  redis: RedisIdempotencyClient;
  handler(payload: T, message: EachMessagePayload): Promise<void>;
  eventId?(payload: T, message: EachMessagePayload): string;
  retries?: number;
  initialRetryMs?: number;
  maxRetryMs?: number;
  processedTtlSeconds?: number;
  processingTtlSeconds?: number;
  deadLetterTopic?: string;
  fromBeginning?: boolean;
}

export interface SharedConsumer {
  consumer: Consumer;
  stop(): Promise<void>;
}

const sleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

const backoff = (initialRetryMs: number, maxRetryMs: number, attempt: number) =>
  Math.min(maxRetryMs, initialRetryMs * 2 ** (attempt - 1));

export const createProducer = async ({
  kafka: kafkaConfig,
  producer: producerConfig,
  retries = 5,
  initialRetryMs = 100,
  maxRetryMs = 5000,
}: ProducerOptions): Promise<SharedProducer> => {
  const kafka = new Kafka(kafkaConfig);
  const producer = kafka.producer({
    ...producerConfig,
    retry: {
      ...producerConfig?.retry,
      retries,
      initialRetryTime: initialRetryMs,
      maxRetryTime: maxRetryMs,
    },
  });
  await producer.connect();

  return {
    producer,
    async publish(topic, payload, key) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
        try {
          await producer.send({
            topic,
            messages: [{
              key: key ?? null,
              value: JSON.stringify(payload),
            }],
          });
          return;
        } catch (error) {
          lastError = error;
          if (attempt <= retries) {
            await sleep(backoff(initialRetryMs, maxRetryMs, attempt));
          }
        }
      }
      throw lastError;
    },
    disconnect: () => producer.disconnect(),
  };
};

export const createConsumer = async <T>({
  kafka: kafkaConfig,
  consumer: consumerConfig,
  topic,
  redis,
  handler,
  eventId,
  retries = 5,
  initialRetryMs = 100,
  maxRetryMs = 5000,
  processedTtlSeconds = 60 * 60 * 24 * 30,
  processingTtlSeconds = 60,
  deadLetterTopic = `${topic}.dlq`,
  fromBeginning = false,
}: ConsumerOptions<T>): Promise<SharedConsumer> => {
  const kafka = new Kafka(kafkaConfig);
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      topics: [
        { topic, numPartitions: 1, replicationFactor: 1 },
        { topic: deadLetterTopic, numPartitions: 1, replicationFactor: 1 },
      ],
    });
  } finally {
    await admin.disconnect();
  }

  const consumer = kafka.consumer(consumerConfig);
  const deadLetterProducer = await createProducer({
    kafka: kafkaConfig,
    retries,
    initialRetryMs,
    maxRetryMs,
  });

  try {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning });
    await consumer.run({
      eachMessage: async (message) => {
        const value = message.message.value?.toString();
        if (!value) {
          throw new Error(`Received empty Kafka message on ${topic}`);
        }

        let payload: T;
        try {
          payload = JSON.parse(value) as T;
        } catch (error) {
          await deadLetterProducer.publish(deadLetterTopic, {
            sourceTopic: topic,
            partition: message.partition,
            offset: message.message.offset,
            error: error instanceof Error ? error.message : "Invalid JSON payload",
            rawValue: value,
            failedAt: new Date().toISOString(),
          });
          return;
        }

        const id = eventId?.(payload, message) ??
          (typeof payload === "object" && payload !== null && "eventId" in payload &&
            typeof payload.eventId === "string"
            ? payload.eventId
            : `${topic}:${message.partition}:${message.message.offset}`);
        const processedKey = `processed:${id}`;
        const reservation = await redis.set(processedKey, "processing", {
          NX: true,
          EX: processingTtlSeconds,
        });
        if (reservation !== "OK") {
          const state = await redis.get(processedKey);
          if (state === "1") {
            return;
          }
          throw new Error(`Kafka event ${id} is already being processed`);
        }

        let processingComplete = false;
        const markProcessed = async (): Promise<void> => {
          await redis.set(processedKey, "1", { EX: processedTtlSeconds });
          processingComplete = true;
        };

        try {
          let lastError: unknown;
          let handled = false;
          for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
            try {
              await handler(payload, message);
              handled = true;
              break;
            } catch (error) {
              lastError = error;
              if (attempt <= retries) {
                await sleep(backoff(initialRetryMs, maxRetryMs, attempt));
              }
            }
          }

          if (handled) {
            await markProcessed();
            return;
          }

          try {
            await deadLetterProducer.publish(deadLetterTopic, {
              sourceTopic: topic,
              partition: message.partition,
              offset: message.message.offset,
              eventId: id,
              payload,
              error: lastError instanceof Error ? lastError.message : "Consumer handler failed",
              failedAt: new Date().toISOString(),
            });
          } catch (error) {
            throw new AggregateError(
              [lastError, error],
              `Kafka event ${id} failed and could not be written to its dead-letter topic`,
            );
          }
          await markProcessed();
        } finally {
          if (!processingComplete) {
            await redis.del(processedKey);
          }
        }
      },
    });
  } catch (error) {
    await consumer.disconnect().catch(() => undefined);
    await deadLetterProducer.disconnect().catch(() => undefined);
    throw error;
  }

  return {
    consumer,
    async stop() {
      await consumer.disconnect();
      await deadLetterProducer.disconnect();
    },
  };
};
