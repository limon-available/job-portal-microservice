import { Kafka } from "kafkajs";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const startSendMailConsumer = async () => {
    try {
        const kafka = new Kafka({
            clientId: "mail-service",
            brokers: [
                process.env.KAFKA_BROKER || "localhost:9092",
            ],
        });

        const consumer = kafka.consumer({
            groupId: "mail-service-group",
        });

        await consumer.connect();

        const topicName = "send-mail";

        await consumer.subscribe({
            topic: topicName,
            fromBeginning: false,
        });

        console.log(
            "Mail service consumer started, listening for messages..."
        );

        await consumer.run({
            eachMessage: async ({ message }) => {
                try {
                    const { to, subject, html } = JSON.parse(
                        message.value?.toString() || "{}"
                    );

                    if (!to || !subject || !html) {
                        console.log(
                            "Invalid mail payload received"
                        );
                        return;
                    }

                    const transporter =
                        nodemailer.createTransport({
                            host: "smtp.gmail.com",
                            port: 465,
                            secure: true,
                            auth: {
                                user: process.env.EMAIL_USER,
                                pass: process.env.EMAIL_PASS,
                            },
                        });

                    await transporter.sendMail({
                        from: `HireHeaven <${process.env.EMAIL_USER}>`,
                        to,
                        subject,
                        html,
                    });

                    console.log(
                        `Email sent successfully to ${to}`
                    );
                } catch (error) {
                    console.log(
                        "Failed to send mail:",
                        error
                    );
                }
            },
        });
    } catch (error) {
        console.log(
            "Failed to start Kafka consumer:",
            error
        );
    }
};