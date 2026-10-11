import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNotificationHandlers } from "../services/eventHandlers.js";
import type { Mailer } from "../services/mailer.js";

const mailer = { send: vi.fn<Mailer["send"]>() };
const saveNotification = vi.fn(async () => undefined);

const handlers = createNotificationHandlers({
  mailer,
  frontendUrl: "https://hireheaven.example",
  saveNotification,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notification Kafka event handlers", () => {
  it("sends welcome and verification mail for user.registered", async () => {
    await handlers.userRegistered({
      eventId: "event-1",
      occurredAt: "2026-10-10T00:00:00Z",
      userId: 12,
      email: "person@example.com",
      name: "A Person",
      verificationToken: "verify-token",
    });

    expect(mailer.send).toHaveBeenCalledWith({
      to: "person@example.com",
      subject: "Welcome to HireHeaven — verify your email",
      template: "welcome",
      context: {
        name: "A Person",
        verificationLink: "https://hireheaven.example/verify-email?token=verify-token",
      },
    });
    expect(saveNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 12 }));
  });

  it("sends password reset email from the domain event", async () => {
    await handlers.passwordResetRequested({
      eventId: "event-2",
      occurredAt: "2026-10-10T00:00:00Z",
      userId: 13,
      email: "person@example.com",
      resetToken: "reset-token",
    });

    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "person@example.com",
        template: "password-reset",
        context: { resetLink: "https://hireheaven.example/reset/reset-token" },
      }),
    );
    expect(saveNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 13 }));
  });

  it("emails the recruiter when an application is submitted", async () => {
    await handlers.applicationSubmitted({
      eventId: "event-3",
      occurredAt: "2026-10-10T00:00:00Z",
      applicationId: "application-4",
      jobId: "job-5",
      applicantId: 21,
      applicantName: "Applicant",
      recruiterId: 31,
      recruiterEmail: "recruiter@example.com",
      recruiterName: "Recruiter",
      jobTitle: "Engineer",
    });

    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "recruiter@example.com",
        template: "application-submitted",
      }),
    );
    expect(saveNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 31 }));
  });

  it("emails the jobseeker when application status changes", async () => {
    await handlers.applicationStatusChanged({
      eventId: "event-4",
      occurredAt: "2026-10-10T00:00:00Z",
      applicationId: "application-4",
      jobId: "job-5",
      applicantId: 21,
      applicantEmail: "applicant@example.com",
      applicantName: "Applicant",
      jobTitle: "Engineer",
      previousStatus: "submitted",
      status: "interview",
    });

    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "applicant@example.com",
        template: "application-status-changed",
      }),
    );
    expect(saveNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 21 }));
  });

  it("sends optional matching job alerts", async () => {
    await handlers.jobCreated({
      eventId: "event-5",
      occurredAt: "2026-10-10T00:00:00Z",
      jobId: "job-5",
      recruiterId: 31,
      companyId: 2,
      companyName: "Acme",
      title: "Engineer",
      description: "Build great products",
      location: "Remote",
      jobType: "full-time",
      salaryMin: 50000,
      salaryMax: 100000,
      skills: ["typescript"],
      deadline: null,
      matchingRecipients: [
        {
          userId: 21,
          email: "applicant@example.com",
          name: "Applicant",
        },
      ],
    });

    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "applicant@example.com",
        template: "job-alert",
      }),
    );
    expect(saveNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 21 }));
  });
});
