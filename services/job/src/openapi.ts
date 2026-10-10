const jobSchema = {
  type: "object",
  required: ["title", "description", "location", "jobType", "companyId"],
  properties: {
    title: { type: "string", maxLength: 255 },
    description: { type: "string" },
    location: { type: "string" },
    jobType: { type: "string", enum: ["full-time", "part-time", "contract", "internship", "temporary", "remote"] },
    salaryMin: { type: "integer", minimum: 0, nullable: true },
    salaryMax: { type: "integer", minimum: 0, nullable: true },
    experienceYears: { type: "integer", minimum: 0 },
    deadline: { type: "string", format: "date", nullable: true },
    status: { type: "string", enum: ["draft", "open", "closed"] },
    companyId: { type: "integer" },
    skills: { type: "array", items: { type: "string" } },
  },
} as const;

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "HireHeaven Job Service API",
    version: "1.0.0",
    description: "Company and job listing management and public job search.",
  },
  servers: [{ url: "/api/jobs" }],
  components: {
    securitySchemes: {
      gatewayKey: { type: "apiKey", in: "header", name: "x-gateway-key" },
      userId: { type: "apiKey", in: "header", name: "x-user-id" },
      userRole: { type: "apiKey", in: "header", name: "x-user-role" },
    },
    schemas: {
      Job: jobSchema,
      Company: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", maxLength: 255 },
          description: { type: "string" },
          website: { type: "string", format: "uri", nullable: true },
          location: { type: "string", nullable: true },
        },
      },
    },
  },
  paths: {
    "/companies": {
      get: {
        summary: "List recruiter's companies",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        responses: { "200": { description: "Companies" } },
      },
      post: {
        summary: "Create a company",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Company" } } } },
        responses: { "201": { description: "Company created" } },
      },
    },
    "/companies/{id}": {
      put: {
        summary: "Update an owned company",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Company" } } } },
        responses: { "200": { description: "Company updated" }, "404": { description: "Not found" } },
      },
      delete: {
        summary: "Delete an owned company without jobs",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Company deleted" }, "409": { description: "Company has jobs" } },
      },
    },
    "/companies/{id}/logo": {
      put: {
        summary: "Upload or replace a company logo",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "multipart/form-data": { schema: {
          type: "object",
          properties: { file: { type: "string", format: "binary" } },
        } } } },
        responses: { "200": { description: "Logo updated" } },
      },
    },
    "/jobs": {
      get: {
        summary: "Search public open jobs",
        parameters: [
          { name: "keyword", in: "query", schema: { type: "string" } },
          { name: "location", in: "query", schema: { type: "string" } },
          { name: "jobType", in: "query", schema: { type: "string" } },
          { name: "salaryMin", in: "query", schema: { type: "integer" } },
          { name: "salaryMax", in: "query", schema: { type: "integer" } },
          { name: "skills", in: "query", schema: { type: "array", items: { type: "string" } } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["newest", "oldest", "salary_asc", "salary_desc"] } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
        ],
        responses: { "200": { description: "Jobs and pagination metadata including total" } },
      },
      post: {
        summary: "Create a job (recruiter only)",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Job" } } } },
        responses: { "201": { description: "Job created" } },
      },
    },
    "/jobs/mine": {
      get: {
        summary: "List recruiter's own jobs",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        responses: { "200": { description: "Owned jobs" } },
      },
    },
    "/jobs/{idOrSlug}": {
      get: {
        summary: "Get a public job by ID or slug",
        parameters: [{ name: "idOrSlug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Job details" }, "404": { description: "Not found" } },
      },
    },
    "/jobs/{id}": {
      put: {
        summary: "Update an owned job (recruiter only)",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Job" } } } },
        responses: { "200": { description: "Job updated" }, "404": { description: "Not found" } },
      },
      delete: {
        summary: "Delete an owned job (recruiter only)",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Job deleted" }, "404": { description: "Not found" } },
      },
    },
    "/jobs/{id}/status": {
      patch: {
        summary: "Change owned job status (recruiter only)",
        security: [{ gatewayKey: [], userId: [], userRole: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object",
          required: ["status"],
          properties: { status: { type: "string", enum: ["draft", "open", "closed", "expired"] } },
        } } } },
        responses: { "200": { description: "Status updated" } },
      },
    },
  },
} as const;

export default openApiSpec;
