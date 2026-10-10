const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "HireHeaven Application Service API",
    version: "1.0.0",
    description: "Job applications, recruiter review, and status history.",
  },
  servers: [{ url: "/api/applications" }],
  components: {
    securitySchemes: {
      gatewayKey: { type: "apiKey", in: "header", name: "x-gateway-key" },
      userId: { type: "apiKey", in: "header", name: "x-user-id" },
      userRole: { type: "apiKey", in: "header", name: "x-user-role" },
    },
  },
  paths: {
    "/apply": {
      post: {
        summary: "Apply to an open job (include jobId in body)",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: {
            type: "object",
            required: ["jobId"],
            properties: {
              jobId: { type: "integer", minimum: 1 },
              resumeUrl: { type: "string", format: "uri", nullable: true },
              coverLetter: { type: "string", maxLength: 5000 },
            },
          } } },
        },
        responses: { "201": { description: "Application submitted" }, "409": { description: "Already applied or job closed" } },
      },
    },
    "/jobs/{jobId}/apply": {
      post: {
        summary: "Apply to an open job",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "201": { description: "Application submitted" } },
      },
    },
    "/mine": {
      get: {
        summary: "List the authenticated jobseeker's applications",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        responses: { "200": { description: "Applications" } },
      },
    },
    "/{id}": {
      delete: {
        summary: "Withdraw an application",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Application withdrawn" } },
      },
    },
    "/job/{jobId}": {
      get: {
        summary: "List applications for a recruiter's job",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        parameters: [
          { name: "jobId", in: "path", required: true, schema: { type: "integer" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
        ],
        responses: { "200": { description: "Paginated applications" } },
      },
    },
    "/{id}/status": {
      patch: {
        summary: "Advance or reject an application and optionally add a note or rating",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["shortlisted", "interview", "hired", "rejected"] },
            recruiterNote: { type: "string", maxLength: 5000, nullable: true },
            rating: { type: "integer", minimum: 1, maximum: 5, nullable: true },
          },
        } } } },
        responses: { "200": { description: "Application updated" }, "409": { description: "Invalid state transition" } },
      },
    },
    "/bulk-status": {
      patch: {
        summary: "Update up to 100 recruiter-owned applications",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        responses: { "200": { description: "Applications updated" } },
      },
    },
    "/{id}/review": {
      patch: {
        summary: "Update an application note and/or rating",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        responses: { "200": { description: "Review updated" } },
      },
    },
  },
} as const;

export default openApiSpec;
