import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

export interface MailMessage {
  to: string;
  subject: string;
  template: string;
  context: Record<string, string | number>;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export const createMailer = (
  transporter: Transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  }),
): Mailer => ({
  async send({ to, subject, template, context }) {
    const path = fileURLToPath(new URL(`../templates/${template}.hbs`, import.meta.url));
    const source = await readFile(path, "utf8");
    const html = Handlebars.compile(source, { strict: true })(context);
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    });
  },
});
