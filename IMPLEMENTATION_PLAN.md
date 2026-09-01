# Personal Finance Spending Tracker — Implementation Plan

## Purpose and delivery rules

This plan turns the approved product and architecture decisions into small, verifiable milestones. The product is a one-person spending tracker at launch, but every durable product record must be owned and queried by one Google-authenticated user so independent family accounts can be added later without a data migration.

The following constraints apply to every milestone:

- Scope is CAD only, formatted with `en-CA`; store positive integer cents and use the transaction type as the accounting sign.
- Reporting and budgets use `transaction_date`, never creation or import time.
- AI output is untrusted. It can create reviewable candidates only; a human approval action is the sole path to ledger inserts from an import.
- Each protected server-side read or mutation derives the current user from the Auth.js session and scopes the database query by ownership. Client-provided user IDs are never accepted.
- Zod validates every action, route, form payload, and model response. Database constraints provide the second line of defence.
- Browser code never accesses Prisma, OAuth tokens, OpenAI credentials, or raw provider output.
- Do not add income, transfers, investments, debt, bank syncing, duplicate detection, arbitrary upload limits, queues, microservices, a second database, multi-currency, shared-household data, or a native mobile app.
- Each milestone must pass typecheck, lint, unit tests, applicable integration/browser tests, and migration-on-empty-database checks before handoff. Report files, routes/actions, migrations, tests, commands, and any unresolved contradiction.

## Source-of-truth audit protocol

This document is the authoritative checklist for MVP delivery. Agents reviewing progress must assess the repository and relevant deployed/configured environment against this document—not against a prior handoff, an implementation summary, or the mere presence of source files.

For each milestone, report one of these statuses:

- **Not started:** no meaningful implementation evidence exists.
- **In progress:** work exists, but one or more required deliverables, tests, exit criteria, or scope constraints remain unmet.
- **Blocked:** work cannot proceed because a named dependency, credential, external service, or product decision is unavailable. State the specific blocker and evidence.
- **Complete:** every listed deliverable exists, all required tests and quality gates have current passing evidence, all exit criteria and success metrics are met, and no out-of-scope feature was introduced.

An audit must cite concrete evidence: file paths, migration identifiers, routes/actions, test names, command output and date, and the exact unmet item for every non-complete milestone. Do not infer completion from code volume, a green build alone, or an earlier agent claim. Re-run affected quality gates after material changes. A later milestone cannot be marked complete while a required earlier milestone is incomplete.

If product scope changes, amend this document and its architecture references before implementation; retain the original requirement history in Git. Do not silently reinterpret a requirement during an audit.

## Active operational TODOs

These owner-managed items are separate from code-completion evidence. They must be completed before M5 is treated as live in a hosted environment.

- [ ] **M5 deployment — encrypted-retention purge:** Configure the hosting provider to send an authenticated daily `POST` request to `/api/internal/purge-extractions`. Read `EXTRACTION_PURGE_SECRET` from the host secret manager and send it as `Authorization: Bearer <secret>`. Verify the job succeeds without logging the secret.
- [ ] **M5 model evaluation — accuracy first:** Benchmark the current extraction model against eligible OpenAI Responses API models, including Luna only if it is available to this API project. Use representative, non-sensitive fixtures and mandatory human-review quality criteria; prioritize extraction accuracy over cost before changing the configured model identifier.
## M0 — Project foundation

**Goal.** Establish a reproducible Next.js TypeScript App Router application with the smallest practical UI, database, testing, and delivery foundation. M0 contains no authentication or finance product features.

**Required deliverables.**

- Next.js TypeScript App Router project at the repository root with Tailwind CSS and a minimal accessible foundation page.
- Strict TypeScript, ESLint, Prettier, Vitest/Testing Library, and Playwright configuration with documented scripts.
- PostgreSQL Prisma schema/configuration, server-only Prisma client factory, generated-client workflow, and an initial migration that deploys to an empty database.
- `.env.example` containing only required variable names; real environment files ignored.
- CI workflow that runs the M0 quality gates against a PostgreSQL service.
- Setup/deployment/migration documentation, including future multipart runtime constraints.
- Root-page unit test and browser smoke test.

**Entry criteria.** The repository contains the approved planning documents, is clean or has only changes identified before work, and no conflicting implementation baseline is present.

**Ordered implementation steps.**

1. Record the current Git state and inspect all repository instructions before creating files.
2. Scaffold a Next.js TypeScript App Router application in the repository root without replacing the planning documents. Select Tailwind and a conventional `src/` layout; retain only the dependencies necessary for the M0 baseline.
3. Replace starter UI with an accessible, responsive foundation page that states the product is under construction. Add a small local primitive set only when it removes a concrete accessibility or consistency need; do not introduce product screens or an external design system.
4. Add Prettier, ESLint integration, strict TypeScript, a unit-test runner, and browser/integration test setup. Configure scripts for `dev`, `build`, `lint`, `format:check`, `typecheck`, `test`, `test:integration`, `test:e2e`, and `test:all`.
5. Add Prisma configured for PostgreSQL. Commit an initial empty-baseline migration that can apply to a fresh database, plus a server-only Prisma client factory suitable for development hot reload. Do not add finance models before M1/M2.
6. Create `.env.example` with variable names only: database connection, Auth.js/Google OAuth placeholders, OpenAI key placeholder, extraction-encryption key placeholder, and public application URL. Ensure every real `.env*` remains ignored.
7. Add GitHub Actions CI that installs with the committed package manager lockfile and runs formatting, lint, typecheck, unit tests, integration tests, production build, and empty-database migration verification with an ephemeral PostgreSQL service.
8. Expand `README.md` with prerequisites, local setup, documented quality commands, PostgreSQL migration workflow, secret-handling guidance, and deployment notes. Explicitly document that multipart uploads in later milestones require a host/runtime with sufficient request-body and execution-time capacity; do not convert operational limits into product upload-size limits.
9. Add focused tests for the root page and a browser smoke test, then run all M0 gates.

**Required tests.** Root-page unit/render test; browser smoke test of the foundation page; production build; lint; formatting check; strict typecheck; Prisma schema validation and migration deploy against a fresh PostgreSQL database; CI workflow syntax/behavior where practical.

**Exit criteria.** A fresh checkout can install dependencies, configure a local PostgreSQL URL from `.env.example`, run the documented commands, apply the empty migration, and load the foundation page. No secret is tracked; CI covers the same quality gates.

**Success metrics.** All documented M0 commands pass locally and in CI; `git diff --check` is clean; a new database reaches the current migration without manual SQL; no product route, authenticated data model, or external AI call exists.

**Dependencies.** Node.js LTS, package registry access, PostgreSQL for local migration verification, and GitHub Actions availability for CI.

**Out of scope.** Google SSO, user records, categories, transactions, dashboards, imports, OpenAI calls, and budgets.

## M1 — Authentication, bootstrap, and isolation

**Goal.** Add Google OAuth through Auth.js and establish the user-owned-data guardrails used by every later milestone.

**Required deliverables.**

- Auth.js Google provider, Prisma adapter schema/migration, typed session handling, callback route, sign-in screen, authenticated shell, and sign-out control.
- Idempotent user bootstrap that creates one owned user record and default categories once, with `archived_at` set to `NULL`.
- Server-only `requireCurrentUser()` helper and a reusable user-scoped data-access pattern.
- Authentication, bootstrap, and cross-user isolation tests.

**Entry criteria.** M0 exits successfully; a deployed or local Google OAuth redirect URL and required Auth.js secrets can be configured.

**Ordered implementation steps.**

1. Add Auth.js Google provider, Prisma adapter models and migration, session typing, callback route, sign-in screen, authenticated application shell, and sign-out control.
2. Create an idempotent first-sign-in bootstrap transaction that creates the user and default active categories exactly once using normalized names.
3. Implement a server-only `requireCurrentUser()` helper and user-scoped database access pattern. Protected paths/actions must use it before touching business data.
4. Add an explicit unauthenticated state and safe error handling; do not leak email addresses, tokens, or provider details.
5. Test sign-in configuration, bootstrap idempotence, authentication redirects, and cross-user denial for top-level resources. Use automated browser tests for the unauthenticated sign-in and redirect paths; complete the real Google OAuth and authenticated-shell acceptance check manually in normal Chrome because providers may reject automated browsers.

**Required tests.** Unit tests for session/user helper and default-category normalization; integration tests for two isolated users; browser tests for the unauthenticated sign-in screen and protected-route redirect; manual normal-Chrome Google OAuth sign-in and authenticated-shell acceptance check; migration apply on empty database.

**Exit criteria.** A real Google user can sign in, gets one user record plus the default category set, and cannot read or mutate another user’s data.

**Success metrics.** The authorization tests cover both direct and nested resource lookups; a repeated sign-in creates no duplicate categories; no protected handler trusts a user ID from the browser.

**Dependencies.** M0, Google OAuth credentials, `AUTH_SECRET`, and a migrated PostgreSQL database.

**Out of scope.** Manual transaction CRUD, dashboards, imports, and budgets.

## M2 — Categories and transaction ledger

**Goal.** Deliver an owned, validated ledger for manual expenses and refunds with an archive-safe category lifecycle.

**Required deliverables.**

- Transactions Prisma models/enums, ownership constraints, and migrations; the user-owned category model is established in M1 so first-sign-in bootstrap can create default category records.
- Category create, rename, active-list, archive, and normalized reactivation behavior.
- Manual expense/refund create, edit, recent-list, and confirmed hard-delete actions and UI.
- Zod validation, CAD/`en-CA` presentation, mutation revalidation, and ownership/ledger browser and integration tests.

**Entry criteria.** M1 authentication and user isolation are live; default categories exist per user.

**Ordered implementation steps.**

1. Add Prisma enums/models and migrations for transactions, including user ownership, category foreign keys, transaction type, source, positive-cent check, and `transaction_date`. Retain and extend the M1 category ownership, `archived_at` lifecycle, and normalized-name constraints as needed; do not recreate the category table.
2. Implement category create, rename, list, archive, and normalized reactivation service/actions. Archiving sets `archived_at`; reactivation clears it. A matching active category returns a safe conflict; a matching archived row reactivates instead of creating a duplicate.
3. Implement manual expense/refund create, edit, recent list, and confirmation-protected hard delete actions/UI. The active, owned category must be verified on every create and edit.
4. Validate dates, descriptions, types, categories, notes, and positive integer cents with Zod; format values in CAD/`en-CA`.
5. Revalidate dependent views after every mutation and provide accessible empty, pending, success, and safe error states.

**Required tests.** Category normalization/archival/reactivation units; positive-cent and required-field validation units; transaction CRUD integration tests; archived-category historical-reference tests; hard-delete tests; two-user authorization tests for category and transaction IDs; browser happy path and validation/error coverage.

**Exit criteria.** A signed-in user can manage active categories and manually save, edit, list, and permanently delete owned expense/refund rows. Archived categories are unavailable for new entries but remain on existing transactions.

**Success metrics.** Every mutation path is protected by `requireCurrentUser()` plus ownership-aware queries; all stored money is a positive integer amount; test fixtures verify no cross-user read or mutation succeeds.

**Dependencies.** M1 and a reliable database migration path.

**Out of scope.** Advanced search/filters, duplicate detection, dashboard aggregation, imports, and budgets.

## M3 — Monthly dashboard

**Goal.** Provide a useful month-based view of ledger data without changing ledger semantics.

**Required deliverables.**

- User-scoped server dashboard service with validated `YYYY-MM` input and current-month default.
- Dashboard UI for gross expenses, refunds, net spending, category net totals, daily trend, recent transactions, and empty/loading/error states.
- Revalidation after all ledger mutations and test coverage for date, refund, edit/delete, archived-category, and isolation rules.

**Entry criteria.** M2 ledger operations and test fixtures are stable.

**Ordered implementation steps.**

1. Define and validate a server-side `YYYY-MM` month input; default to the current calendar month in the user’s configured presentation context.
2. Build a user-scoped dashboard service that returns gross expenses, refunds, net spending, category net totals, daily trend, and recent transactions using `transaction_date` only.
3. Build responsive dashboard states for empty, loading, failure, and populated data; present all money in CAD/`en-CA`.
4. Ensure create, edit, and delete mutations revalidate the affected month(s), including records moved across months by editing.

**Required tests.** Aggregate unit tests for expenses/refunds; cross-month transaction-date tests; category net tests with refunds; edit/delete and archived-category history integration tests; dashboard authorization tests; browser empty and populated dashboard tests.

**Exit criteria.** Dashboard figures, category totals, trend, and recent records reconcile to the user’s ledger for the selected month and update after ledger changes.

**Success metrics.** No calculation uses `created_at` or import time; refunds reduce net and category spending in their own calendar month; cross-user dashboard queries return no data.

**Dependencies.** M2 transactions, categories, and mutation revalidation.

**Out of scope.** Budget widgets, advanced analytics, income, and import candidates.

## M4 — Import domain and mandatory review

**Goal.** Build the durable candidate-review and atomic-approval domain before connecting it to an AI provider.

**Required deliverables.**

- Import batch, candidate transaction, and extraction-log metadata migrations with no uploaded-file blob or byte column.
- User-scoped import audit history and a temporary review queue with inline editable candidate fields, select/unselect controls, and incomplete-row indicators.
- One all-or-nothing finalization service that inserts selected valid transactions, records approved candidate IDs, marks every unselected row excluded, supports finalizing an all-unselected batch with zero ledger writes, and removes the completed batch from the review queue.
- Atomicity, nested-ownership, finalization, validation, inline-editing, and browser review tests.

**Entry criteria.** M2 user/category/transaction ownership contracts are tested; M3 can revalidate dashboard reads.

**Ordered implementation steps.**

1. Add migrations for `import_batches`, `candidate_transactions`, and `extraction_logs` metadata, including ownership through the batch, batch/candidate status enums, candidate ordinal, saved-transaction reference, and expiry fields. Do not add any upload byte/blob column.
2. Implement a user-scoped temporary review queue with inline editable candidate fields, select/unselect state, incomplete-row indicators, and accessible controls. Retain completed batch metadata as non-queue audit history.
3. Implement final approval as one database transaction: load and lock a user-owned batch and selected candidates; validate each selected row and active owned category; insert all selected transactions; mark selected candidates approved with saved IDs; mark every unselected candidate excluded; permit finalization when none are selected; update batch counts/status. Any invalid selected row aborts the entire transaction.
4. Do not provide an explicit exclusion control: unselected rows are finalized as excluded when the user approves the batch. Preserve final row states in audit history, block excluded rows from ledger insertion, and do not return completed candidates to the review queue. Candidate rows may remain incomplete until selected for approval.
5. Wire revalidation so approval updates the corresponding dashboard month(s).

**Required tests.** Candidate state/edit validation units; inline editing with manual-form-equivalent field validation; approval atomicity integration test with one invalid selected row; unselected-rows-never-in-ledger/finalization test, including all-discard; candidate/batch nested ownership tests; two-user batch lookup/mutation tests; browser review, error, and completed-batch-removal paths.

**Exit criteria.** A pre-seeded batch can be reviewed and finalized safely: selected complete rows enter the ledger atomically, all other rows are durably excluded (including a zero-selection all-discard decision), and no completed candidates remain in the review queue.

**Success metrics.** The only import-to-ledger code path is the atomic approval service; missing required values block selected rows; unselected rows have no saved transaction ID; and approved batches never appear as reviewable candidates.

**Dependencies.** M2, M3, Prisma transactions, and database isolation tests.

**Out of scope.** Multipart uploads, OpenAI SDK, raw provider content, retries, queues, or auto-created categories.

## M5 — Temporary OpenAI extraction

**Goal.** Add the authenticated, transient file-to-candidate extraction path while retaining mandatory human approval.

**Required deliverables.**

- Authenticated multipart import route that supports PDFs, screenshots, and common images using request-memory files only.
- Official OpenAI Responses API integration with direct file/image input, strict structured output, `store: false`, versioned prompt, and Zod revalidation.
- Candidate creation flow that never auto-creates categories or writes ledger transactions.
- Encrypted raw-output retention record, 30-day idempotent purge, redacted logs, safe failed-batch/re-upload behavior, and tests.

**Entry criteria.** M4 review/approval behavior is complete and proved atomic; host/runtime upload constraints are known and documented.

**Ordered implementation steps.**

1. Create the authenticated multipart import route. Accept PDFs, screenshots, and common images; validate metadata and runtime safety conditions without imposing a product upload-size limit.
2. Create a processing batch before provider work. Hold uploaded bytes and request-local payloads only in memory; release references in `finally` and never write source files to disk, object storage, database, or the OpenAI Files API.
3. Use the official OpenAI JavaScript SDK Responses API with direct file/image input, `store: false`, versioned prompt, strict JSON schema, and model identifier. The prompt returns actual transactions only and blanks/nulls uncertain fields; it ignores balances, totals, limits, payments, and summaries; it may remove a merchant branch/store designator only when that shortening is highly certain; and it never creates categories.
4. Zod-validate structured provider output before candidate creation. Map a suggested category only to an existing active owned category when safely matched; otherwise leave it unresolved.
5. Encrypt raw provider output at rest, attach it to an extraction log with a 30-day expiry, and expose no raw content in normal UI or logs. Implement an idempotent purge that clears ciphertext while retaining non-sensitive batch metadata.
6. Turn provider/validation failures into safe failed batches. Permit at most one bounded retry while request memory remains; afterward require a new upload and never claim the old source is recoverable.

**Required tests.** Multipart authentication/type handling; provider request contract mocked at the boundary; malformed structured output; no automatic ledger insertion; candidate/category mapping; safe failed batch; retention purge idempotence; redaction; cross-user import/batch access; browser upload-to-review flow with mocked provider.

**Exit criteria.** Supported in-memory uploads create reviewable candidates or a safe failed batch, and only a later M4 approval action can write transactions.

**Success metrics.** Source bytes never appear in durable storage or logs; all OpenAI calls use `store: false`; raw output ciphertext expires after 30 days; zero tests permit an extraction call to insert into `transactions`.

**Dependencies.** M4, `OPENAI_API_KEY`, encryption key management, multipart-capable hosting, and approved OpenAI data/privacy disclosure.

**Out of scope.** Auto-approval, raw-output UI, persistent uploads, arbitrary retries, queues/workers, duplicate detection, and CSV/ZIP support.

## M6 — Budget mode and calculations

**Goal.** Add optional category budgets with immutable month-effective configuration history and accurate refunds/rollover treatment.

**Required deliverables.**

- Per-user budget-mode setting, stable `budgets` identity, and immutable `budget_configurations` history migration.
- Current-month configuration upsert that does not mutate prior months.
- Server calculations and UI for monthly-reset and rollover modes, including raw negative availability/overage treatment.
- Required refund, rollover, reset-boundary, historical-configuration, ownership, and browser tests.

**Entry criteria.** M2 and M3 ledger/month calculations are stable; M1 user settings exist.

**Ordered implementation steps.**

1. Add the per-user budget-mode toggle, off by default. When disabled, hide budget UI but preserve budget history.
2. Add `budgets` as a stable owned budget identity and `budget_configurations` as the historical `effective_month`, amount, and mode source. Enforce one configuration per budget/month.
3. Implement current-month create/edit as an upsert for the current `effective_month`; prohibit edits to prior-month rows. Apply current-month changes immediately with no proration.
4. Build monthly-reset calculation as the applicable configuration’s limit minus category net spending in that month.
5. Build rollover calculation by locating the applicable configuration for every month, starting at the first rollover configuration or after the latest reset, summing configured allowance, and subtracting category net spending. Preserve negative raw availability; present zero available plus overage when appropriate.
6. Add budget setup and dashboard progress UI for active owned categories. Archived categories remain historical but are unavailable to normal setup.

**Required tests.** Configuration selection/history immutability; current-month upsert; monthly-reset formula; refund-month budget effect; rollover transitions and reset boundary; exact fixtures: $300 in Jan/Feb with no spend yields $900 in March, $900 March spend yields $300 in April, and $1,000 March spend yields $200 in April; cross-user and archived-category access tests; browser mode-toggle/setup/progress tests.

**Exit criteria.** Budget mode can be enabled per user and presents correct monthly-reset and rollover availability from immutable historical configurations.

**Success metrics.** Prior months cannot be rewritten by a current edit; each month uses its applicable configuration; raw negative rollover values are preserved internally; refunds reduce usage in the calendar month/category of the refund.

**Dependencies.** M1 settings, M2 ledger/category ownership, M3 aggregates, and schema migrations.

**Out of scope.** Income budgets, shared budgets, alerts, proration, multicurrency, and linked purchase/refund relationships.

## M7 — Security, operations, and release readiness

**Goal.** Make the complete MVP safe to operate, deploy, and verify before release.

**Required deliverables.**

- Authorization matrix, nested-resource coverage, log-redaction controls, and host-appropriate rate limiting.
- Deployment migration, secret-management, TLS, database backup/restore, health-check, monitoring, and incident/runbook documentation.
- Privacy notice covering Google SSO, temporary uploads, OpenAI extraction, and 30-day raw-output retention.
- Accessibility/responsive/Figma QA evidence and a two-account release smoke test.

**Entry criteria.** M1–M6 exit criteria are satisfied and the target hosting/database choices are known.

**Ordered implementation steps.**

1. Expand authorization coverage into a full matrix covering direct IDs and nested paths for every owned resource and action.
2. Add rate limiting appropriate to the host for sign-in and import abuse paths, health checks, deployment migration procedure, database backup/restore runbook, and monitoring/alert configuration.
3. Audit structured logging to redact statements, uploaded content/names, descriptions, notes, emails, raw model output, OAuth tokens, cookies, and secrets. Retain only safe operational identifiers and timing.
4. Verify production TLS, secret-manager configuration, database network restrictions, migration-before-deploy behavior, and privacy notice. The notice must disclose Google SSO, temporary upload processing, OpenAI extraction, and 30-day encrypted raw-output retention.
5. Perform accessibility, responsive, and Figma-guidance QA using a node-specific design reference when available. Run a two-account release smoke test.

**Required tests.** Full authorization matrix; log-redaction units; rate-limit behavior; production-like migration/backup-restore rehearsal; accessibility/browser smoke tests; two-account end-to-end workflow from sign-in through manual ledger, import review, approval, dashboard, and budget visibility.

**Exit criteria.** The release checklist, operational runbooks, privacy notice, security controls, and two-account smoke test all pass with no sensitive data in normal logs.

**Success metrics.** Every resource has both positive and negative authorization coverage; restore rehearsal meets the documented recovery objective; critical alerts and health checks are observable; accessibility defects from release QA are resolved or formally accepted.

**Dependencies.** All preceding milestones, deployment credentials, host-level rate limiting/secret management, and a production-equivalent database backup facility.

**Out of scope.** New end-user features, separate analytics platforms, external data sharing, or scale architecture beyond the single Next.js/PostgreSQL deployment.

## Milestone handoff template

Each handoff must state: the milestone and outcome; changed files; migrations; routes/actions; tests added; exact quality commands with results; deployment/configuration changes; scope deliberately not started; and any contradiction or blocker requiring a product decision. A milestone does not advance solely because code exists—its exit criteria and required tests must be evidenced.
