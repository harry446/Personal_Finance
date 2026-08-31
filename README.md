# Personal Finance

A private personal-finance spending tracker for expenses, refunds, reviewed document imports, and monthly insight. The implementation follows the milestone plan in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md); this repository currently contains M0 only.

## Technology

- Next.js App Router with TypeScript and Tailwind CSS
- PostgreSQL with Prisma migrations and generated Prisma Client
- Vitest + Testing Library for units, Playwright for browser smoke tests
- GitHub Actions quality gate with a PostgreSQL service

Authentication, user data, transaction models, OpenAI extraction, and budgets are intentionally not implemented until their respective milestones.

## Prerequisites

- Node.js 24 LTS-compatible runtime and npm
- PostgreSQL 16+ for database migration checks
- Chromium installed through Playwright for local browser tests

## Local setup

1. Install dependencies: `npm ci`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to a local PostgreSQL connection string. Set the remaining values only when their later milestones are implemented.
3. Generate the Prisma Client: `npm run prisma:generate`.
4. Apply migrations to an empty local database: `npm run prisma:migrate`.
5. Start the application: `npm run dev`.

The generated `prisma/migrations/20260829180000_baseline` migration is deliberately empty. It establishes the migration workflow; product tables begin in later milestones.

## Quality commands

| Command                    | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `npm run format:check`     | Verify formatting for tracked application/configuration files.      |
| `npm run lint`             | Run the Next.js ESLint configuration.                               |
| `npm run typecheck`        | Typecheck application and test code.                                |
| `npm run test`             | Run Vitest unit tests.                                              |
| `npm run test:integration` | Validate the schema and deploy migrations; requires `DATABASE_URL`. |
| `npm run build`            | Create an optimized production build.                               |
| `npm run test:e2e`         | Run the Playwright Chromium smoke test.                             |
| `npm run test:all`         | Run the non-database quality suite, including the browser test.     |

Before running browser tests locally, install the matching browser once with `npx playwright install chromium`.

## Database and migrations

Prisma uses PostgreSQL exclusively. `prisma.config.ts` reads `DATABASE_URL`, `prisma/schema.prisma` is the schema source of truth, and migration SQL is committed under `prisma/migrations/`.

- Create a development migration after a schema change: `npm run prisma:migrate -- --name <description>`.
- Apply committed migrations in a deployment environment: `npm run prisma:deploy`.
- Never use `prisma db push` as a substitute for a committed production migration.
- CI runs `prisma migrate deploy` against a fresh PostgreSQL service.

## Secrets and deployment

`.env` files are ignored. `.env.example` contains names only—never commit a real database URL, OAuth credential, OpenAI key, encryption key, session secret, or production URL.

The production deployment is one Next.js service plus one managed PostgreSQL database. Apply migrations before serving new application code, use TLS and a secret manager, and verify backup/restore procedures before release.

Future multipart imports will process PDFs and images only in request memory. The chosen host must support the required request body size and execution duration. Those hosting/runtime constraints must be documented operationally; the product will not invent arbitrary upload-size limits.
