import { describe, expect, it } from "vitest";

const gatewayUrl = process.env.E2E_GATEWAY_URL?.replace(/\/$/, "");
const password = process.env.E2E_PASSWORD ?? "E2e-Flow-Test-Password-2026!";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

interface Session {
  accessToken: string;
}

async function api<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<ApiEnvelope<T>> {
  if (!gatewayUrl) throw new Error("E2E_GATEWAY_URL is required");
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${gatewayUrl}${path}`, { ...options, headers });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof result === "object" && result !== null && "message" in result
      ? String(result.message)
      : `Request failed with status ${response.status}`;
    throw new Error(`${options.method ?? "GET"} ${path}: ${message}`);
  }
  if (
    typeof result !== "object" ||
    result === null ||
    !("success" in result) ||
    typeof result.success !== "boolean" ||
    !("message" in result) ||
    typeof result.message !== "string" ||
    !("data" in result)
  ) {
    throw new Error(`${options.method ?? "GET"} ${path}: invalid API response envelope`);
  }
  return {
    success: result.success,
    message: result.message,
    data: result.data as T,
  };
}

async function createSession(role: "jobseeker" | "recruiter"): Promise<Session> {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const email = `e2e-${role}-${unique}@example.test`;
  const fields = {
    name: role === "recruiter" ? "E2E Recruiter" : "E2E Candidate",
    email,
    password,
    phoneNumber: "5550100123",
    role,
    bio: "Temporary account for the end-to-end job application flow.",
  };

  if (role === "recruiter") {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(fields),
    });
  } else {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    form.append(
      "file",
      new Blob(["%PDF-1.7\nHireHeaven end-to-end test resume\n"], { type: "application/pdf" }),
      "e2e-resume.pdf",
    );
    await api("/api/auth/register", { method: "POST", body: form });
  }

  const login = await api<{ accessToken: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return { accessToken: login.data.accessToken };
}

async function waitForNotification(
  accessToken: string,
  predicate: (item: { title: string; message: string }) => boolean,
): Promise<{ title: string; message: string }> {
  const deadline = Date.now() + 60_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await api<{ notifications: Array<{ title: string; message: string }> }>(
        "/api/notifications",
        {},
        accessToken,
      );
      const found = response.data.notifications.find(predicate);
      if (found) return found;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (lastError) throw lastError;
  throw new Error("Expected notification was not created within 60 seconds");
}

describe.skipIf(!gatewayUrl)("end-to-end registration through application notification", () => {
  it("registers, posts a job, applies, updates status, and creates notifications", async () => {
    const recruiter = await createSession("recruiter");
    const candidate = await createSession("jobseeker");

    const company = await api<{ company: { company_id: number } }>(
      "/api/jobs/companies",
      {
        method: "POST",
        body: JSON.stringify({
          name: `E2E Company ${Date.now()}`,
          description: "Temporary company for integration flow verification.",
          location: "Remote",
        }),
      },
      recruiter.accessToken,
    );
    const job = await api<{ job: { job_id: number } }>(
      "/api/jobs/jobs",
      {
        method: "POST",
        body: JSON.stringify({
          title: `E2E Software Engineer ${Date.now()}`,
          description: "A temporary role used to validate the application workflow.",
          location: "Remote",
          jobType: "full-time",
          companyId: company.data.company.company_id,
          status: "open",
          skills: ["TypeScript"],
        }),
      },
      recruiter.accessToken,
    );
    const application = await api<{ application: { application_id: number } }>(
      "/api/applications/apply",
      {
        method: "POST",
        body: JSON.stringify({
          jobId: job.data.job.job_id,
          coverLetter: "I am interested in this end-to-end test role.",
        }),
      },
      candidate.accessToken,
    );

    const recruiterNotification = await waitForNotification(
      recruiter.accessToken,
      (item) => item.title === "New application",
    );
    expect(recruiterNotification.message).toContain("applied");

    await api(
      `/api/applications/${application.data.application.application_id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "shortlisted" }),
      },
      recruiter.accessToken,
    );
    const candidateNotification = await waitForNotification(
      candidate.accessToken,
      (item) => item.title === "Application status changed",
    );
    expect(candidateNotification.message).toContain("shortlisted");
  }, 180_000);
});
