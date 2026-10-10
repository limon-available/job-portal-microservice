# Job Portal (Microservices)

## Stack
- Node 20, Express 5, TypeScript strict (NodeNext, src -> dist), npm workspaces
- DB: Neon Postgres via @neondatabase/serverless (each service has its own DB_URL)
- Kafka (kafkajs), Redis, Cloudinary, Nodemailer
- Validation: Zod. Logging: Pino. Tests: Vitest + Supertest.
- Frontend: Next.js 14 App Router, Tailwind, shadcn/ui, TanStack Query, React Hook Form + Zod

## Rules
- Each service owns its DB. Never query another service's tables.
- Service-to-service: Kafka domain events (async) or internal HTTP with `x-internal-key` header.
- Structure per service: routes -> controllers -> services -> repositories. No SQL in controllers.
- All handlers wrapped in TryCatch; throw AppError(statusCode, message).
- Response shape: { success, message, data }
- Validate every input with Zod. No `any`. No console.log (use Pino).
- Never hardcode secrets. Validate env with Zod on boot. Keep .env.example updated.
- Passwords hashed with bcrypt. Access JWT 15m, refresh token 7d stored hashed in Redis.
- Roles: jobseeker, recruiter, admin.
- Kafka events: topic names like `user.registered`, payload types live in packages/shared.
- Every new feature needs tests and a short README section update.
- Follow the existing folder structure and code style.
