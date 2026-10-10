# Job Portal — Microservices

A microservices-based Job Portal backend (branded **HireHeaven** in emails) built with **Node.js + Express + TypeScript** and npm workspaces. It includes an API Gateway, Auth, User, Job, Application, Utils (uploads), and Notification services plus a shared workspace package, with Kafka, Neon Postgres, Redis, Nodemailer, and Cloudinary integrations.

> Repo: `https://github.com/limon-available/job-portal-microservice.git` — branch `main`

## Table of Contents

- [Architecture](#architecture)
- [Repo Structure](#repo-structure)
- [Workspaces & Tooling](#workspaces--tooling)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema-auth)
- [API Reference](#api-reference)
- [Event-Driven Flow](#event-driven-flow-kafka)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Roadmap & Known Gaps](#roadmap--known-gaps)

## Architecture

```text
client --> gateway (:8080) --> auth, user, job, application, notification
gateway --verified JWT + trusted identity headers--> protected APIs
auth (:5000) --Kafka user.password_reset_requested--> notification (:5005)
auth --Kafka user.registered--> notification welcome/verification
application/job services --Kafka domain events--> notification email + inbox
application (:5004) --x-internal-key HTTP--> auth identity + job eligibility/ownership
job.deleted --Kafka + Redis idempotency--> application closes active applications
auth --multipart POST /api/utils/upload--> utils Cloudinary upload
auth --> own Neon DB + Redis (forgot:email)
notification --> own Neon DB (notifications) + Redis (Kafka idempotency)
user (:5002) --> own Neon DB (profiles, skills, education, experience, saved jobs)
job (:5003) --> own Neon DB (companies, jobs, job_skills) + Redis (view buffer)
application (:5004) --> own Neon DB (applications, status history) + Redis/Kafka
user --multipart HTTP + x-internal-key--> utils Cloudinary upload/delete
job --multipart HTTP + x-internal-key--> utils company logo upload
utils --> Cloudinary
Kafka: localhost:9092 (default)
```

Every HTTP service exposes Prometheus metrics at `/metrics` and a `/health` endpoint. HTTP request totals and duration histograms use bounded route labels. Each service also creates OpenTelemetry server spans; set `OTEL_EXPORTER_OTLP_ENDPOINT` in the root `.env` (for example, to an OTLP/HTTP collector on port 4318) to export traces. Pino redacts password, token, authorization, cookie, and internal-key fields.

- **Sync:** Auth -> Utils via HTTP (`axios`) for resume upload.
- **Async:** Auth publishes `user.registered` and `user.password_reset_requested`. Notification consumes those and application/job domain events, sends Handlebars email through Nodemailer, and persists in-app notifications.
- **Profile ownership:** Auth owns credentials, email, role, and verification state. Its existing `users` table may retain registration-time profile snapshots, but User's separate database is authoritative for editable name, phone, bio, skills, education, experience, saved jobs, and profile asset references. User never reads auth tables; the gateway forwards the authenticated `x-user-id` and `x-user-role`. Profile changes in User are not mirrored back into Auth.
- **Job ownership:** Job owns company and job-listing data in its own database. `owner_id` and `posted_by` are gateway user IDs only; Job never queries Auth or User tables.
- **Application ownership:** Application owns applications and their status history. It stores identity IDs rather than foreign keys into Auth/User, checks job eligibility and recruiter ownership through Job's internal-key-protected endpoint, and never reads another service's database.

## Repo Structure

```text
job-portal-microservice/
├── packages/
│   └── shared/              # shared events, roles, AppError, logging, Kafka helpers
└── services/
    ├── gateway/             # port 8080; JWT auth, routing, rate limits, circuit breakers
    ├── auth/               # port 5000, base /api/auth
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── migrations/      # versioned node-pg-migrate schema changes
    │   └── src/
    │       ├── app.ts      # mounts /api/auth
    │       ├── index.ts    # validated config, Redis + Kafka, server lifecycle
    │       ├── producer.ts # Kafka producer
    │       
    │       ├── controllers/auth.ts
    │       ├── routes/auth.ts
    │       ├── middleware/ # validation, rate limits, request IDs, uploads
    │       ├── validators/auth.ts
    │       ├── config/env.ts
    │       └── utils/ # database, Redis, token helpers, TryCatch, error handler
    ├── user/               # port 5002, base /api/user; profile and saved-job API
    │   ├── migrations/     # user-owned profile schema migrations
    │   └── src/
    │       ├── controllers/
    │       ├── services/
    │       ├── repositories/
    │       └── openapi.ts  # Swagger document served at /api/user/docs
    ├── job/                # port 5003, base /api/jobs; company and job listings API
    │   ├── migrations/     # job-owned company/job schema
    │   └── src/openapi.ts  # Swagger document served at /api/jobs/docs
    ├── application/        # port 5004, base /api/applications
    │   ├── migrations/     # application data and status history
    │   └── src/openapi.ts  # Swagger document served at /api/applications/docs
    ├── utils/              # port 5001, base /api/utils
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/            # Cloudinary upload/delete API
    └── notification/      # port 5005, /notifications API + Kafka consumers
        ├── migrations/    # notification-owned schema migrations
        └── src/templates/ # HireHeaven Handlebars email templates
├── apps/
│   └── web/                # Next.js 14 App Router web client (port 3000)
```

## Workspaces & Tooling

The root `package.json` declares `packages/shared`, all services under `services/`, and the Next.js client under `apps/web` as npm workspaces. Install dependencies once from the repository root:

```bash
npm install
```

Root scripts:

| Script | Purpose |
|--------|---------|
| `npm run dev` | build shared package, then run the gateway and all six backend services |
| `npm run build` | build all workspaces |
| `npm run lint` | lint the repository with ESLint |
| `npm run format` / `npm run format:check` | format or check formatting with Prettier |
| `npm test` | build shared then run workspace tests |

Husky runs `lint-staged` before commits and Commitlint validates Conventional Commit messages. Shared Kafka topics, payloads, roles, errors, and Pino logger factory are exported from `@hireheaven/shared`. Its Kafka consumer helper retries with exponential backoff, sends failed events to `<topic>.dlq`, and marks successfully handled event IDs in Redis as `processed:<eventId>`.

Apply the auth database migration before starting auth:

```bash
npm run migrate:up --workspace @hireheaven/auth
```

Roll back the latest migration with `npm run migrate:down --workspace @hireheaven/auth`. Keep `DB_URL` set in `services/auth/.env`; migrations are versioned in `services/auth/migrations`.

Apply the notification-owned schema separately with `npm run migrate:up --workspace @hireheaven/notification`; use its own Neon `DB_URL`.

Apply the user-owned schema with `npm run migrate:up --workspace @hireheaven/user`; its `services/user/.env` must contain a separate Neon `DB_URL`.

Apply the job-owned schema with `npm run migrate:up --workspace @hireheaven/job`; set its independent Neon `DB_URL`.

Apply the application-owned schema with `npm run migrate:up --workspace @hireheaven/application`; configure its separate Neon `DB_URL`.

## Services

| Service | Port | Base path | Responsibilities |
|---------|------|-----------|------------------|
| gateway | 8080 | — | Public entry point, JWT verification, trusted identity forwarding, Redis rate limiting, proxying |
| auth | 5000 | `/api/auth` | register, login, forgot-password, reset-password |
| utils | 5001 | `/api/utils` | Internal-key-protected multipart uploads and deletion via Cloudinary |
| notification | 5005 | `/notifications` | Kafka email delivery and per-user notification inbox |
| user | 5002 | `/api/user` | Profile, skills, education, experience, completion, public profiles, and saved jobs |
| job | 5003 | `/api/jobs` | Recruiter companies/jobs, public search/detail, Kafka lifecycle events |
| application | 5004 | `/api/applications` | Jobseeker applications, recruiter review/state transitions, job deletion handling |

The web app runs on port 3000 and uses the gateway at port 8080. It is a Next.js 14 App Router workspace in `apps/web`, with public/auth/seeker/recruiter/admin route groups, URL-driven job filters, job detail metadata and JobPosting JSON-LD, role dashboards, responsive skeleton/error/404 states, and system-aware dark mode. shadcn/ui-compatible primitives are in `apps/web/src/components/ui.tsx`.

Web routes include `/`, `/jobs`, `/jobs/[idOrSlug]`, `/login`, `/register`, `/forgot`, `/reset/[token]`, and `/verify-email`; seeker workspace pages are `/seeker/profile`, `/seeker/skills`, `/seeker/education`, `/seeker/experience`, `/seeker/resume`, `/seeker/applications`, `/seeker/saved-jobs`, and `/seeker/notifications`. Recruiter workspace pages are `/recruiter/company`, `/recruiter/jobs`, `/recruiter/jobs/new`, `/recruiter/jobs/[jobId]/edit`, and `/recruiter/jobs/[jobId]/applicants`. Admin routes live under `/admin`. The Axios client sends access JWTs, includes the refresh cookie, and performs one coordinated refresh/retry after a 401; the gateway remains the sole API origin configured by `NEXT_PUBLIC_GATEWAY_URL`.

## Tech Stack

- Node.js, Express 5, TypeScript (`NodeNext`, `src` -> `dist`, `strict`)
- shared: `kafkajs`, Pino, event payloads, topic names, role enum, and `AppError`
- auth: `bcrypt`, `jsonwebtoken`, `multer`, `axios`, `redis`, `node-pg-migrate`, `@neondatabase/serverless`
- utils: `cloudinary`, `multer`, `cors`
- notification: `nodemailer`, `handlebars`, `redis`, `node-pg-migrate`, `@neondatabase/serverless`
- user: `axios`, `multer`, `node-pg-migrate`, `swagger-ui-express`, `@neondatabase/serverless`
- job: `axios`, `ioredis`, `node-cron`, `multer`, `node-pg-migrate`, `swagger-ui-express`, `@neondatabase/serverless`
- application: `axios`, `redis`, `node-pg-migrate`, `swagger-ui-express`, `@neondatabase/serverless`
- Root tooling: ESLint, Prettier, Husky, lint-staged, Commitlint, Vitest, TypeScript
## Database Schema (auth)

Managed by versioned node-pg-migrate scripts in `services/auth/migrations`:

```sql
CREATE TYPE user_role AS ENUM ('jobseeker','recruiter','admin');
CREATE TABLE users(
  user_id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL, password VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL, role user_role NOT NULL,
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  bio TEXT, resume VARCHAR(255), resume_public_id VARCHAR(255),
  profile_pic VARCHAR(255), profile_pic_public_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  subscription TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);
CREATE TABLE skills(skill_id SERIAL PRIMARY KEY, name VARCHAR(100) UNIQUE NOT NULL);
CREATE TABLE user_skills(
  user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
  skill_id INT REFERENCES skills(skill_id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, skill_id)
);
```

Login joins skills: `ARRAY_AGG(s.name) AS skills` grouped by user.
The auth schema is managed by versioned node-pg-migrate scripts, including the `admin` role and email verification column.

## API Reference

### Gateway `http://localhost:8080`

Use the gateway as the client-facing entry point. It routes `/api/auth`, `/api/user`, `/api/jobs`, `/api/applications`, and `/api/notifications` to their services; notification requests are rewritten to the notification service's `/notifications` base. `/api/utils` and service-internal identity/job routes are intentionally blocked at the gateway. Public routes (login/register/reset/verification, public profiles and job search/detail, health and docs) are forwarded without user identity. Protected routes require `Authorization: Bearer <access-token>`; the gateway verifies the access-purpose JWT, expiry, and Redis blacklist, then resolves the current account role through Auth's internal API.

Before proxying, the gateway removes client-supplied `x-user-*`, `x-gateway-key`, `x-internal-key`, and access-token-claim headers. It supplies trusted identity and verified access-token metadata for protected calls, plus the configured gateway/internal keys and a generated request ID. In production, Auth accepts access identity/claims only from these trusted gateway headers; other protected services likewise authorize only from gateway-forwarded identity. The gateway applies Helmet, CORS origin allowlisting, Pino access logs, proxy timeouts, Redis-backed IP rate limiting (default 120 requests per 60 seconds), and per-service Opossum circuit breakers. `GET /health` aggregates `/health` from all backend services and returns 503 if any are unavailable.

### Auth `http://localhost:5000/api/auth`

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/register` | multipart `name,email,password,phoneNumber,role,bio,file` | recruiter: direct insert; jobseeker: sends the resume as multipart to utils with `x-internal-key`. Publishes `user.registered`, returns a 15m access token and sets a 7d refresh cookie |
| POST | `/login` | `{email,password}` | Zod validation and bcrypt compare; returns user+skills (no password) and access token; sets refresh cookie; five attempts per 15 minutes per IP/email |
| POST | `/forgot` | `{email}` | generic reply; if exists: reset-purpose JWT signed with `RESET_JWT_SEC` for `15m`, `SET forgot:<email> EX 900`, publishes `user.password_reset_requested`; five attempts per 15 minutes per IP/email |
| POST | `/reset/:token` | `{password}` | verifies reset-purpose JWT against Redis, hashes and updates password, then consumes the token |
| GET | `/verify-email/:token` | — | verifies the 24-hour registration token and marks the email verified |
| GET | `/me` | Bearer access token | returns the authenticated user |
| POST | `/refresh` | refresh cookie | rotates the 7d refresh token; reuse revokes all refresh tokens for that user |
| POST | `/logout` | Bearer access token + refresh cookie | blacklists the access token through expiry and removes the presented refresh token |
| POST | `/change-password` | `{currentPassword,password}` + Bearer access token | changes the password and revokes active sessions |
| GET | `/health` | — | liveness check |

The refresh token is HttpOnly, Secure, SameSite=Strict, and scoped to `/api/auth`. Its SHA-256 hash is stored in Redis as `refresh:<userId>:<tokenId>`. Protected endpoints require `Authorization: Bearer <accessToken>`.

```bash
curl -X POST http://localhost:5000/api/auth/register \
 -F "name=John" -F "email=j@mail.com" -F "password=secret123" \
 -F "phoneNumber=01700000000" -F "role=jobseeker" -F "bio=Backend dev" \
 -F "file=@./resume.pdf"

curl -X POST http://localhost:5000/api/auth/login \
 -H "Content-Type: application/json" -d '{"email":"j@mail.com","password":"secret123"}'

curl -X POST http://localhost:5000/api/auth/forgot \
 -H "Content-Type: application/json" -d '{"email":"j@mail.com"}'
```

### Utils `http://localhost:5001/api/utils`

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/upload` | multipart `file`, `folder` (`resumes`, `avatars`, or `logos`) | requires `x-internal-key`; accepts PDF/DOC/DOCX/PNG/JPG/WEBP up to 5MB with matching MIME type and extension |
| DELETE | `/upload/:publicId?folder=resumes` | — | requires `x-internal-key`; deletes a Cloudinary asset in `resumes`, `avatars`, or `logos` |

## Event Flow (Kafka)

The shared Kafka helper creates producer and consumer clients with retries and exponential backoff. Failed messages are sent to `<topic>.dlq`; handled event IDs are tracked in Redis under `processed:<eventId>`. The notification service consumes `user.registered`, `user.password_reset_requested`, `application.submitted`, `application.status_changed`, and optionally `job.created`.

```text
POST /forgot -> reset JWT -> Redis forgot:email EX 900
 -> Kafka user.password_reset_requested -> notification -> Nodemailer
resetLink = ${FRONTEND_URL}/reset/${resetToken} (15 min)
```

Registration publishes `user.registered` with the verification token (24 hours). The client can direct the user to `/api/auth/verify-email/:token`; access tokens expire after 15 minutes, and refresh tokens rotate on use.
Run the monorepo tests with `npm test`; service API tests use Vitest and Supertest, notification consumer handlers use a mocked mailer, job domain tests cover ownership and expiry-event publication, and application tests cover state transitions and duplicate applications.

## Environment Variables

Auth `services/auth/.env` (start from `services/auth/.env.example`):

```env
NODE_ENV=development
LOG_LEVEL=info
PORT=5000
DB_URL=postgresql://user:pass@host/db?sslmode=require
REDIS_URL=redis://localhost:6379
JWT_SEC=replace-with-a-random-secret-at-least-32-characters
RESET_JWT_SEC=replace-with-a-different-random-secret-at-least-32-characters
REFRESH_JWT_SEC=replace-with-another-random-secret-at-least-32-characters
EMAIL_VERIFY_JWT_SEC=replace-with-a-separate-random-secret-at-least-32-characters
KAFKA_BROKER=localhost:9092
UPLOAD_SERVICE=http://localhost:5001
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
```

utils `.env`:

```env
PORT=5001
INTERNAL_API_KEY=use-the-same-random-secret-as-auth-service
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

Set the same `INTERNAL_API_KEY` in auth and utils.

Copy `services/notification/.env.example` to `services/notification/.env`. It requires a separate Neon `DB_URL`, SMTP credentials, `REDIS_URL`, `KAFKA_BROKER`, and a `GATEWAY_INTERNAL_KEY` shared with the trusted API gateway.

Copy `services/user/.env.example` to `services/user/.env`. Set a separate Neon `DB_URL`, the gateway's `GATEWAY_INTERNAL_KEY`, and the same `INTERNAL_API_KEY` configured in auth and utils.

Copy `services/job/.env.example` to `services/job/.env`; configure its own Neon database, Redis and Kafka endpoints, gateway key, and utils internal key.

Copy `services/application/.env.example` to `services/application/.env`; configure its separate Neon database, Redis/Kafka endpoints, gateway key, Auth and Job service URLs, and the same internal key configured by Auth, Job, and Utils.

Copy `services/gateway/.env.example` to `services/gateway/.env`. Set `JWT_SEC` to the same secret as Auth's, `GATEWAY_INTERNAL_KEY` to the same key configured on Auth/User/Job/Application/Notification, and `INTERNAL_API_KEY` to the same key configured on Auth/Job/Application/Utils. Service URLs default to the localhost ports listed above.

Notification API (gateway supplies `x-gateway-key`, `x-user-id`, and `x-user-role` headers):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List the current user's notifications; supports `limit` and `offset` |
| PATCH | `/notifications/:id/read` | Mark one owned notification as read |
| PATCH | `/notifications/read-all` | Mark all owned notifications as read |
| GET | `/notifications/unread-count` | Return the current user's unread count |

Application event payloads include recipient identity and email fields so the notification service never queries another service's tables. A `job.created` event may include `matchingRecipients` for optional matching alerts.

### User `http://localhost:5002/api/user`

Private endpoints require gateway-forwarded `x-user-id` and `x-user-role`, plus `x-gateway-key` matching `GATEWAY_INTERNAL_KEY`. The gateway must strip client-supplied identity headers and set them only after authenticating the caller. Public profile reads do not require these headers.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET / PUT | `/profile` | Read or update name, phone, and bio |
| PUT | `/profile/picture` | Multipart `file`; replaces avatar and deletes the old Cloudinary asset |
| PUT | `/profile/resume` | Multipart `file`; replaces resume and deletes the old Cloudinary asset |
| POST / DELETE / GET | `/skills` | Add a skill by name (create if absent), remove by name, or list own skills |
| GET / POST | `/education` | List or create education entries |
| PUT / DELETE | `/education/:id` | Update or delete an owned education entry |
| GET / POST | `/experience` | List or create experience entries |
| PUT / DELETE | `/experience/:id` | Update or delete an owned experience entry |
| GET | `/profile/completion` | Return completion percentage and completed/total field counts |
| GET | `/public/:userId` | Read public profile, skills, education, and experience (never email or phone) |
| GET / POST | `/saved-jobs` | List or save jobs by job ID |
| DELETE | `/saved-jobs/:jobId` | Remove a saved job |
| GET | `/docs` | Swagger UI; OpenAPI JSON at `/openapi.json` |

Profile pictures accept PNG/JPG/WEBP and resumes accept PDF/DOC/DOCX, each up to 5 MB. Upload and replacement deletion call the utils service using `INTERNAL_API_KEY`.

### Application `http://localhost:5004/api/applications`

The gateway must forward the authenticated user's `x-user-id` and `x-user-role` and set the trusted `x-gateway-key`. Jobseekers can submit via `POST /apply` with `jobId`, or `POST /jobs/:jobId/apply`, list their records with `GET /mine`, and withdraw with `DELETE /:id`. Apply accepts optional `resumeUrl` and `coverLetter`. Job is checked through `GET /api/jobs/internal/jobs/:id` using `x-internal-key`; only open, non-expired jobs accept applications. The unique `(job_id,user_id)` constraint prevents duplicate applications and returns HTTP 409.

Recruiters can list a job's applications with `GET /job/:jobId?status=applied&page=1&limit=20`; the response contains pagination metadata and the job must belong to them. `PATCH /:id/status` supports `applied -> shortlisted -> interview -> hired/rejected`, with optional note/rating. `PATCH /bulk-status` applies a valid transition to up to 100 applications, and `PATCH /:id/review` edits notes and ratings independently. Each status change is written to `application_history` and published as `application.status_changed`. The service consumes `job.deleted` and closes all active applications for that job. Auth identity data is fetched over internal HTTP so application events retain the recipient details required for email delivery. Swagger UI and OpenAPI JSON are available at `/docs` and `/openapi.json`.

### Job `http://localhost:5003/api/jobs`

Recruiter-only routes require the gateway-forwarded identity headers and gateway key. Company and job updates/deletes are scoped to the authenticated recruiter; a job can reference only a company owned by that recruiter. Public listing returns `data.meta.total` and supports `keyword`, `location`, `jobType`, `salaryMin`, `salaryMax`, comma-separated or repeated `skills`, `sort` (`newest`, `oldest`, `salary_asc`, `salary_desc`), `page`, and `limit`. Public detail accepts a numeric ID or slug. View increments are buffered in Redis and flushed to the job database periodically.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET / POST | `/companies` | List owned companies or create one |
| PUT / DELETE | `/companies/:id` | Update/delete an owned company; deletion is rejected while jobs reference it |
| PUT | `/companies/:id/logo` | Upload/replace PNG/JPG/WEBP logo through utils |
| GET / POST | `/jobs` | Public search or create a recruiter-owned job |
| GET | `/jobs/mine` | List the authenticated recruiter's jobs |
| GET | `/jobs/:idOrSlug` | Get a public open job and increment its view count |
| PUT / DELETE | `/jobs/:id` | Update or delete an owned job |
| PATCH | `/jobs/:id/status` | Change an owned job's status |
| GET | `/docs` | Swagger UI; OpenAPI JSON at `/openapi.json` |

The hourly expiry task closes open jobs whose deadline has passed and publishes `job.updated` with `status: expired`. Job create/update/delete operations publish the corresponding shared `job.created`, `job.updated`, and `job.deleted` events.

## Getting Started

Requirements: Docker Engine with the Compose plugin, separate Neon databases for auth, user, job, application, and notification, Cloudinary credentials, and SMTP credentials. Node 20/npm are needed only for the convenience scripts below; the Docker Compose commands can be run directly without installing Node locally. The web client is published at `http://localhost:3000` and the API gateway at `http://localhost:8080`. Kafka and Redis are available on loopback ports 9092 and 6379 for local tooling; backend service ports remain private on the Compose network.

```bash
git clone https://github.com/limon-available/job-portal-microservice.git
cd job-portal-microservice
npm install # optional; needed for local development, tests, and root convenience scripts
```

Copy the template env files, then fill in the external connection details and shared secrets:

```powershell
Copy-Item .env.example .env
$services = @('auth', 'utils', 'notification', 'user', 'job', 'application', 'gateway')
foreach ($service in $services) {
  Copy-Item "services\$service\.env.example" "services\$service\.env"
}
Copy-Item apps\web\.env.example apps\web\.env
```

```bash
# Build/start Kafka (KRaft), Redis, topic initialization, and all seven services.
docker compose up --build -d

# Apply each service-owned schema after configuring its DB_URL.
npm run migrate:all

# Follow logs, then use http://localhost:8080.
npm run logs
```

The required service env files are `services/auth/.env`, `services/utils/.env`, `services/notification/.env`, `services/user/.env`, `services/job/.env`, `services/application/.env`, and `services/gateway/.env`, each copied from its corresponding `.env.example`. Also copy `apps/web/.env.example` to `apps/web/.env`. Configure separate Neon `DB_URL`s in Auth, Notification, User, Job, and Application; plus SMTP credentials in Notification and Cloudinary credentials in Utils. Set strong shared root `INTERNAL_API_KEY` and `GATEWAY_INTERNAL_KEY` values in `.env`. `NEXT_PUBLIC_GATEWAY_URL` is the browser-accessible gateway origin; the web container uses the private gateway DNS URL for server-side rendering. Compose overrides localhost service URLs and Kafka/Redis addresses with service DNS names. Never commit populated `.env` files.

For development with source mounts and TypeScript hot reload, use the override:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The Kafka KRaft broker creates all seven shared domain topics and their matching `.dlq` topics in the one-shot `kafka-init` job before Kafka-dependent services start. Database migrations remain explicit and service-owned; `npm run migrate:all` applies them in sequence through the service containers. Auth verification and password-reset email links direct users into the web app (`/verify-email` and `/reset/[token]`).

GitHub Actions runs lint, typecheck, all service tests, and builds with Postgres and Redis service containers. The separate Docker publishing workflow pushes `ghcr.io/limon-available/job-portal-microservice-{auth,utils,notification,user,job,application,gateway,web}` images tagged `latest` and with the commit SHA on pushes to `main`. Set the repository Actions variable `NEXT_PUBLIC_GATEWAY_URL` to the public gateway origin before deploying the published web image; builds fall back to localhost for development. The opt-in end-to-end test uses live gateway/API/Kafka/database services and an SMTP test sink; configure `E2E_GATEWAY_URL` and `E2E_PASSWORD`, apply migrations, and provide upload/email integrations before running it. It creates disposable accounts and company/job/application records, so use an isolated test environment.

| Script | Purpose |
|--------|---------|
| `npm run up` | build and start the complete production-style Docker Compose stack |
| `npm run down` | stop and remove containers, retaining Kafka/Redis data volumes |
| `npm run logs` | follow all Compose service logs |
| `npm run migrate:all` | build migration images and apply every service migration |
| `npm run dev` | run all workspaces locally (requires Node 20+, Kafka, Redis, and configured service env) |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` | start the development Compose stack with source mounts and hot reload |
| `npm run build` | compile all workspaces to `dist/` |
| `npm test` | build shared and run service tests |
| `npm run lint` | run ESLint |
| `npm run typecheck` | typecheck all workspaces without emitting files |
| `npm run test:e2e` | run the register-to-notification flow against a configured live stack |
| `npm run migrate:up --workspace @hireheaven/auth` | apply auth schema migrations |
| `npm run migrate:up --workspace @hireheaven/notification` | apply notification schema migrations |
| `npm run migrate:up --workspace @hireheaven/user` | apply user schema migrations |
| `npm run migrate:up --workspace @hireheaven/job` | apply job schema migrations |
| `npm run migrate:up --workspace @hireheaven/application` | apply application schema migrations |

## Roadmap & Known Gaps

- [x] register/login, forgot-password event publishing, protected upload service
- [x] finish `resetPassword` (check Redis, hash, UPDATE users, del key)
- [x] auth CORS whitelist, Helmet, Redis-backed login/forgot rate limits, request IDs, health check, graceful shutdown
- [x] JWT middleware, `GET /me`, refresh-token rotation, logout, password change, and email verification
- [x] API gateway and Docker Compose/KRaft development environment
- Kafka uses one broker and replication factor 1 for local development; production deployments require a properly secured multi-broker cluster.
