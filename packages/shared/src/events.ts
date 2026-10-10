export interface EventPayload {
  eventId: string;
  occurredAt: string;
}

export interface UserRegistered extends EventPayload {
  userId: number;
  email: string;
  name: string;
  verificationToken: string;
}

export interface PasswordResetRequested extends EventPayload {
  userId: number;
  email: string;
  resetToken: string;
}

export interface JobCreated extends EventPayload {
  jobId: string;
  recruiterId: number;
  title: string;
  description: string;
  companyId: number;
  companyName: string;
  location: string;
  jobType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  skills: string[];
  deadline: string | null;
  matchingRecipients?: Array<{
    userId: number;
    email: string;
    name: string;
  }>;
}

export interface JobUpdated extends EventPayload {
  jobId: string;
  recruiterId: number;
  companyId: number;
  title: string;
  status: string;
  changes: Record<string, unknown>;
}

export interface JobDeleted extends EventPayload {
  jobId: string;
  recruiterId: number;
  companyId: number;
  title: string;
}

export interface ApplicationSubmitted extends EventPayload {
  applicationId: string;
  jobId: string;
  applicantId: number;
  applicantName: string;
  recruiterId: number;
  recruiterEmail: string;
  recruiterName: string;
  jobTitle: string;
}

export interface ApplicationStatusChanged extends EventPayload {
  applicationId: string;
  jobId: string;
  applicantId: number;
  applicantEmail: string;
  applicantName: string;
  jobTitle: string;
  previousStatus: string;
  status: string;
}
