const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "HireHeaven User Service API",
    version: "1.0.0",
    description: "Profile, education, experience, skills, and saved-job endpoints.",
  },
  servers: [{ url: "/api/user" }],
  components: {
    securitySchemes: {
      gatewayIdentity: {
        type: "apiKey",
        in: "header",
        name: "x-gateway-key",
      },
      forwardedUserId: {
        type: "apiKey",
        in: "header",
        name: "x-user-id",
        description: "Trusted identity supplied by the API gateway.",
      },
      forwardedUserRole: {
        type: "apiKey",
        in: "header",
        name: "x-user-role",
        description: "Trusted role supplied by the API gateway.",
      },
    },
    schemas: {
      Profile: {
        type: "object",
        required: ["name", "phone", "bio"],
        properties: {
          name: { type: "string", maxLength: 255 },
          phone: { type: "string", maxLength: 32 },
          bio: { type: "string", maxLength: 5000 },
        },
      },
      Education: {
        type: "object",
        required: ["institution", "degree"],
        properties: {
          institution: { type: "string" },
          degree: { type: "string" },
          fieldOfStudy: { type: "string" },
          startDate: { type: "string", format: "date", nullable: true },
          endDate: { type: "string", format: "date", nullable: true },
          description: { type: "string" },
        },
      },
      Experience: {
        type: "object",
        required: ["company", "title"],
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          location: { type: "string" },
          startDate: { type: "string", format: "date", nullable: true },
          endDate: { type: "string", format: "date", nullable: true },
          description: { type: "string" },
        },
      },
      SavedJob: {
        type: "object",
        required: ["jobId"],
        properties: { jobId: { type: "string" } },
      },
    },
  },
  security: [{ gatewayIdentity: [], forwardedUserId: [], forwardedUserRole: [] }],
  paths: {
    "/profile": {
      get: { summary: "Get own profile", responses: { "200": { description: "Profile" } } },
      put: {
        summary: "Replace profile name, phone, and bio",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Profile" } } },
        },
        responses: { "200": { description: "Updated profile" } },
      },
    },
    "/profile/picture": {
      put: {
        summary: "Upload profile picture",
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: {
            type: "object",
            properties: { file: { type: "string", format: "binary" } },
          } } },
        },
        responses: { "200": { description: "Updated picture" } },
      },
    },
    "/profile/resume": {
      put: {
        summary: "Upload resume",
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: {
            type: "object",
            properties: { file: { type: "string", format: "binary" } },
          } } },
        },
        responses: { "200": { description: "Updated resume" } },
      },
    },
    "/profile/completion": {
      get: { summary: "Get profile completion percentage", responses: { "200": { description: "Completion" } } },
    },
    "/public/{userId}": {
      get: {
        summary: "Get public profile without email or phone",
        security: [],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Public profile" }, "404": { description: "Not found" } },
      },
    },
    "/skills": {
      get: { summary: "List own skills", responses: { "200": { description: "Skills" } } },
      post: {
        summary: "Add a skill (creates it if needed)",
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["name"], properties: { name: { type: "string" } },
        } } } },
        responses: { "201": { description: "Skill added" } },
      },
      delete: {
        summary: "Remove an own skill by name",
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["name"], properties: { name: { type: "string" } },
        } } } },
        responses: { "200": { description: "Skill removed" } },
      },
    },
    "/education": {
      get: { summary: "List education", responses: { "200": { description: "Education list" } } },
      post: {
        summary: "Create education",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Education" } } } },
        responses: { "201": { description: "Created education" } },
      },
    },
    "/education/{id}": {
      put: {
        summary: "Update education",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Education" } } } },
        responses: { "200": { description: "Updated education" } },
      },
      delete: {
        summary: "Delete education",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Deleted education" } },
      },
    },
    "/experience": {
      get: { summary: "List experience", responses: { "200": { description: "Experience list" } } },
      post: {
        summary: "Create experience",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Experience" } } } },
        responses: { "201": { description: "Created experience" } },
      },
    },
    "/experience/{id}": {
      put: {
        summary: "Update experience",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Experience" } } } },
        responses: { "200": { description: "Updated experience" } },
      },
      delete: {
        summary: "Delete experience",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Deleted experience" } },
      },
    },
    "/saved-jobs": {
      get: { summary: "List saved jobs", responses: { "200": { description: "Saved jobs" } } },
      post: {
        summary: "Save a job",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SavedJob" } } } },
        responses: { "201": { description: "Saved job" } },
      },
    },
    "/saved-jobs/{jobId}": {
      delete: {
        summary: "Remove a saved job",
        parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Removed saved job" } },
      },
    },
  },
} as const;

export default openApiSpec;
