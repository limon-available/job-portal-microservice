import type {
  ApplicationStatusChanged,
  ApplicationSubmitted,
  JobCreated,
  PasswordResetRequested,
  UserRegistered,
} from "@hireheaven/shared";
import type { NewNotification } from "../repositories/notifications.js";
import type { Mailer } from "./mailer.js";

type NotificationWriter = (notification: NewNotification) => Promise<void>;

export interface NotificationDependencies {
  mailer: Mailer;
  frontendUrl: string;
  saveNotification: NotificationWriter;
}

export const createNotificationHandlers = ({
  mailer,
  frontendUrl,
  saveNotification,
}: NotificationDependencies) => ({
  async userRegistered(event: UserRegistered): Promise<void> {
    await mailer.send({
      to: event.email,
      subject: "Welcome to HireHeaven — verify your email",
      template: "welcome",
      context: {
        name: event.name,
        verificationLink: `${frontendUrl}/verify-email?token=${encodeURIComponent(event.verificationToken)}`,
      },
    });
    await saveNotification({
      userId: event.userId,
      type: "user.registered",
      title: "Welcome to HireHeaven",
      message: "Your account is ready. Verify your email to finish setting it up.",
    });
  },

  async passwordResetRequested(event: PasswordResetRequested): Promise<void> {
    await mailer.send({
      to: event.email,
      subject: "Reset your HireHeaven password",
      template: "password-reset",
      context: { resetLink: `${frontendUrl}/reset/${encodeURIComponent(event.resetToken)}` },
    });
    await saveNotification({
      userId: event.userId,
      type: "user.password_reset_requested",
      title: "Password reset requested",
      message: "A password reset link has been sent to your email.",
    });
  },

  async applicationSubmitted(event: ApplicationSubmitted): Promise<void> {
    await mailer.send({
      to: event.recruiterEmail,
      subject: `New application for ${event.jobTitle}`,
      template: "application-submitted",
      context: {
        recruiterName: event.recruiterName,
        applicantName: event.applicantName,
        jobTitle: event.jobTitle,
      },
    });
    await saveNotification({
      userId: event.recruiterId,
      type: "application.submitted",
      title: "New application",
      message: `${event.applicantName} applied for ${event.jobTitle}.`,
    });
  },

  async applicationStatusChanged(event: ApplicationStatusChanged): Promise<void> {
    await mailer.send({
      to: event.applicantEmail,
      subject: `Application update for ${event.jobTitle}`,
      template: "application-status-changed",
      context: {
        applicantName: event.applicantName,
        jobTitle: event.jobTitle,
        previousStatus: event.previousStatus,
        status: event.status,
      },
    });
    await saveNotification({
      userId: event.applicantId,
      type: "application.status_changed",
      title: "Application status changed",
      message: `Your application for ${event.jobTitle} changed to ${event.status}.`,
    });
  },

  async jobCreated(event: JobCreated): Promise<void> {
    for (const recipient of event.matchingRecipients ?? []) {
      await mailer.send({
        to: recipient.email,
        subject: `New job alert: ${event.title}`,
        template: "job-alert",
        context: {
          name: recipient.name,
          jobTitle: event.title,
          description: event.description,
        },
      });
      await saveNotification({
        userId: recipient.userId,
        type: "job.created",
        title: "New job alert",
        message: `A new job may match your interests: ${event.title}.`,
      });
    }
  },
});
