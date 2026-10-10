export const KAFKA_TOPICS = {
  UserRegistered: "user.registered",
  PasswordResetRequested: "user.password_reset_requested",
  JobCreated: "job.created",
  JobUpdated: "job.updated",
  JobDeleted: "job.deleted",
  ApplicationSubmitted: "application.submitted",
  ApplicationStatusChanged: "application.status_changed",
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];
