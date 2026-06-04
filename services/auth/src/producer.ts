import { Kafka } from "kafkajs";
import type { Admin, Producer } from "kafkajs";
import dotenv from "dotenv";

dotenv.config();

let producer: Producer;
let admin: Admin;

export const connectKafka = async () => {
    try {
        const kafka = new Kafka({
            clientId: "auth-service",
            brokers: [
                process.env.KAFKA_BROKER || "localhost:9092"
            ],
        });

        admin = kafka.admin();
        await admin.connect();

        await admin.createTopics({
            topics: [
                {
                    topic: "send-mail",
                    numPartitions: 1,
                    replicationFactor: 1,
                },
            ],
        });

        await admin.disconnect();

        producer = kafka.producer();
        await producer.connect();

        console.log("Connected to Kafka producer");
    } catch (error) {
        console.log("Failed to connect Kafka", error);
    }
};

export const publishToTopic = async (
    topic: string,
    message: any
) => {
    if (!producer) {
        console.log("Kafka producer is not initialized");
        return;
    }

    try {
        await producer.send({
            topic,
            messages: [
                {
                    value: JSON.stringify(message),
                },
            ],
        });

        console.log("Message published successfully");
    } catch (error) {
        console.log(
            "Failed to publish message to Kafka",
            error
        );
    }
};

export const disconnectKafka = async () => {
    if (producer) {
        await producer.disconnect();
    }
};