# Personal Finance

A private personal-finance spending tracker for expenses, refunds, reviewed document imports, and monthly insight. The implementation follows the milestone plan in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md); this repository currently contains M0 through M4.

## Technology

- Next.js App Router with TypeScript and Tailwind CSS
- PostgreSQL with Prisma migrations and generated Prisma Client
- Vitest + Testing Library for units, Playwright for browser smoke tests
- GitHub Actions quality gate with a PostgreSQL service

M1 provides Google OAuth, user bootstrap, default categories, and user-isolation guardrails. M2 adds the owned manual transaction ledger and archive-safe category management. M3 adds the user-scoped monthly dashboard: validated month selection, gross expenses, refunds, net spending, category net totals, daily trend, and recent ledger activity. M4 adds durable, user-scoped import batches and candidate review: editable candidates, select/exclude states, atomic approval into the ledger, and durable history. File upload and OpenAI extraction remain deliberately deferred to M5; budgets remain deferred to M6.

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

The generated `prisma/migrations/20260829180000_baseline` migration is deliberately empty. The M1 migrations create Auth.js adapter tables and the user-owned category table; the M2 migration adds the positive-cents transaction ledger with user/category foreign keys and restrictive category deletion. M3 adds no database migration; it reads the owned M2 ledger by transaction date. M4 adds import-batch, candidate-review, non-content extraction metadata, and imported-transaction references; it intentionally stores neither uploaded file bytes nor raw provider output.

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

### Google OAuth acceptance check

`npm run test:e2e` verifies the unauthenticated sign-in screen and protected-route redirect against an isolated test server. It deliberately does not drive Google OAuth.

Google may reject Playwright-controlled browsers as insecure. Verify the actual Google OAuth journey manually in a normal Chrome browser at `http://localhost:3000`: select **Continue with Google**, complete sign-in, and confirm the protected `/app` shell plus sign-out control appear. Record the date, application URL, and outcome in the M1 handoff; never record cookies, provider tokens, or OAuth credentials.

The normal-Chrome result is the authoritative M1 Google OAuth acceptance evidence. Database integration tests separately prove bootstrap idempotence and user isolation.

## Manual ledger and categories (M2)

After sign-in, `/app` opens the Transactions workspace. M2 provides:

- Manual expense and refund creation, editing, recent-ledger filtering, and confirmed permanent deletion.
- Positive integer-cents storage, Canadian-dollar formatting, required transaction date/description/category/type, and Zod validation on every mutation.
- User-owned category creation, renaming, archive confirmation, restoration, and normalized-name reactivation without duplicates.
- Historical category references for archived categories; archived categories are unavailable for new transactions.

### M2 browser verification

`npm run test:e2e` requires `DATABASE_URL` and runs both signed-out and signed-in browser coverage. It creates a temporary PostgreSQL user, two categories, and a database session for the test browser, then removes them afterward. This verifies the ledger happy path, server validation message, category archive/recovery path, and protected-route behavior without attempting to automate Google OAuth.

## Quality commands

| Command                    | Purpose                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run format:check`     | Verify formatting for tracked application/configuration files.                                             |
| `npm run lint`             | Run the Next.js ESLint configuration.                                                                      |
| `npm run typecheck`        | Typecheck application and test code.                                                                       |
| `npm run test`             | Run Vitest unit tests.                                                                                     |
| `npm run test:integration` | Validate/deploy migrations and run database-backed bootstrap and isolation tests; requires `DATABASE_URL`. |
| `npm run build`            | Create an optimized production build.                                                                      |
| `npm run test:e2e`         | Run signed-out plus database-seeded authenticated Playwright coverage; requires `DATABASE_URL`.            |
| `npm run test:all`         | Run formatting, lint, types, unit tests, production build, and browser tests; requires `DATABASE_URL`.     |

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
