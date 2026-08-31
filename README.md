# Personal Finance

A private personal-finance spending tracker for expenses, refunds, reviewed document imports, and monthly insight. The implementation follows the milestone plan in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md); this repository currently contains M0 and M1.

## Technology

- Next.js App Router with TypeScript and Tailwind CSS
- PostgreSQL with Prisma migrations and generated Prisma Client
- Vitest + Testing Library for units, Playwright for browser smoke tests
- GitHub Actions quality gate with a PostgreSQL service

M1 provides Google OAuth, user bootstrap, default categories, and user-isolation guardrails. Ledger CRUD, dashboards, imports, and budgets remain intentionally deferred to their respective milestones.

## Prerequisites

- Node.js 24 LTS-compatible runtime and npm
- PostgreSQL 16+ for database migration checks
- Chromium installed through Playwright for local browser tests

## Local setup

1. Install dependencies: `npm ci`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to a local PostgreSQL connection string. For M1 sign-in, also configure the Google OAuth variables described below.
3. Generate the Prisma Client: `npm run prisma:generate`.
4. Apply migrations to an empty local database: `npm run prisma:migrate`.
5. Start the application: `npm run dev`.

The generated `prisma/migrations/20260829180000_baseline` migration is deliberately empty. The following M1 migration creates the Auth.js adapter tables, user-owned default-category table, and their ownership constraints.

## Google OAuth configuration (M1)

Before a real user can sign in, create Google OAuth credentials for the environment where the app runs:

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project and configure its OAuth consent screen. During testing, add each permitted Google account as a test user.
2. Create an OAuth 2.0 **Web application** client.
3. Add `http://localhost:3000` as an authorized JavaScript origin and `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI for local development. Add the equivalent HTTPS origin and callback URI for every deployed environment.
4. In the untracked `.env`, set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` from that client. Set `AUTH_SECRET` to a distinct high-entropy random value. Set both `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to the exact application origin—for example, `http://localhost:3000` locally.

The callback route is `/api/auth/callback/google`; do not enter a wildcard callback URL. For a local OAuth flow, open exactly `http://localhost:3000` (not `127.0.0.1` or a network-IP URL) and ensure that the same origin is used in `NEXTAUTH_URL` and Google Cloud. The app deliberately shows generic sign-in failures and never displays provider tokens, email addresses, or credential details.

### OAuth troubleshooting

If the server reports **“State cookie was missing”**:

1. Confirm `NEXTAUTH_URL=http://localhost:3000` is present in `.env`.
2. Stop and restart `npm run dev` after changing any environment variable.
3. Clear site data for `localhost` in the browser, then retry from `http://localhost:3000`. Do not start the Google flow from one local origin and return to another.
4. Keep `AUTH_SECRET` stable for the entire sign-in attempt; do not regenerate or edit it between starting Google sign-in and its callback.

### Authenticated browser check

The normal browser suite verifies the unauthenticated sign-in and redirect states. After completing Google OAuth setup, capture an authenticated local-browser state outside Git and run the protected-shell check:

1. Run `npm run dev`, sign in at `http://localhost:3000`, and save a Playwright storage state file through Playwright's codegen or your team test harness.
2. Set `E2E_AUTH_STORAGE_STATE` to that file's absolute path and run `npm run test:e2e`.
3. Keep the storage-state file outside the repository; it contains an authenticated session cookie.

## Quality commands

| Command                    | Purpose                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run format:check`     | Verify formatting for tracked application/configuration files.                                             |
| `npm run lint`             | Run the Next.js ESLint configuration.                                                                      |
| `npm run typecheck`        | Typecheck application and test code.                                                                       |
| `npm run test`             | Run Vitest unit tests.                                                                                     |
| `npm run test:integration` | Validate/deploy migrations and run database-backed bootstrap and isolation tests; requires `DATABASE_URL`. |
| `npm run build`            | Create an optimized production build.                                                                      |
| `npm run test:e2e`         | Run the Playwright Chromium smoke test.                                                                    |
| `npm run test:all`         | Run the non-database quality suite, including the browser test.                                            |

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
