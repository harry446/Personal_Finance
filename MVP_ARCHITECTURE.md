# Personal Finance Spending Tracker — MVP Architecture

## 1. Recommended minimal stack

Use one TypeScript **Next.js** application (App Router) containing the browser UI, server-rendered reads, authenticated mutation handlers, and the OpenAI integration. Deploy it as one container/service; use one managed **PostgreSQL** database. A managed Postgres provider and the container host are deployment choices, not application boundaries, so either may be changed later without changing product code.

| Concern | Choice | Why this is the simplest reasonable fit |
| --- | --- | --- |
| UI and server | Next.js + TypeScript | One repository and deployable; server-side handlers keep OAuth, database, and API keys out of the browser. |
| Database | PostgreSQL | Reliable relational constraints and transactions suit ownership, category integrity, imports, and reporting. |
| Data access / migrations | Prisma | Typed schema, uncomplicated migrations, and transactions without adding a data layer. |
| Authentication | Auth.js with Google provider and the Prisma adapter | Google SSO, durable sessions, and user records without building credential handling. |
| Validation | Zod at every server boundary | One explicit schema for forms, multipart metadata, and mutation input. It complements—not replaces—database constraints. |
| AI extraction | Official OpenAI JavaScript SDK, Responses API, structured JSON output | The API accepts image and file input, including PDFs; a strict schema makes candidate creation predictable. Send requests with `store: false` and do not use the Files API. |
| Styling/components | Existing project conventions; otherwise Tailwind CSS plus a small accessible component set | Fast to implement and easy to match to the Figma flows without creating a separate design system. |

Use integer cents (`amount_cents`) for all money, `DATE` for a transaction date, and UTC timestamps for audit fields. Do not use floating-point money or a time-of-day to determine reporting months.

## 2. High-level system architecture

```text
Browser (Figma-led UI)
  │ authenticated HTTPS requests
  ▼
Next.js application
  ├─ Auth.js / Google OAuth
  ├─ dashboard and CRUD handlers
  ├─ import handler: transient file buffers → OpenAI Responses API
  └─ Prisma
          │
          ▼
     PostgreSQL (all durable product data)

Google OAuth                  OpenAI API
```

**Persisted:** user profile/settings, categories, transaction ledger, budget configurations, import batch status, candidate rows, and a short-retention encrypted extraction record.

**Temporary only:** uploaded PDF/image bytes, parsed multipart buffers, base64/file payloads used for the OpenAI request, and request-local extraction state. They are discarded in a `finally` block when the request completes. The application does not write uploads to disk, object storage, the database, or the OpenAI Files API.

Manual entry: browser submits a validated transaction → server reads session → server verifies active category ownership → database inserts transaction → dashboard queries recalculate from `transaction_date`.

AI import: browser posts files over authenticated HTTPS → server creates a batch and holds bytes only for this request → server sends the files plus a structured extraction instruction to OpenAI → server saves candidates and a minimal encrypted raw record → browser opens review → only an explicit approval action inserts selected rows into the ledger.

There is no queue or worker in MVP. The import request is synchronous and the UI displays an in-progress state. The hosting runtime must support the resulting request body and execution time; those are operational limits, not product upload-size rules.

## 3. Domain model and database schema

All business tables have a `user_id` unless their parent already establishes ownership. Every application read/write scopes by the authenticated user ID; never accept an arbitrary user ID from the client.

### Core tables

| Table | Essential fields and constraints | Notes |
| --- | --- | --- |
| `users` | `id UUID PK`, `email CITEXT UNIQUE`, `name`, `image_url`, `budget_mode_enabled BOOL`, timestamps | Created/upserted after Google sign-in. Auth.js tables (`accounts`, `sessions`, `verification_tokens`) are also owned by the adapter. |
| `categories` | `id`, `user_id FK`, `name`, `normalized_name`, `archived_at NULL`, timestamps; `UNIQUE(user_id, normalized_name)` | `normalized_name = lower(trim(name))`. A matching archived row is reactivated; an active match returns a conflict. `archived_at` is the soft-delete marker. |
| `transactions` | `id`, `user_id FK`, `category_id FK`, `transaction_date DATE`, `type ENUM(expense, refund)`, `amount_cents INT CHECK (>0)`, `description`, `notes NULL`, `source ENUM(manual, import)`, `import_batch_id NULL FK`, timestamps | Amount is always positive; `type` determines its sign in calculations. Delete is a hard `DELETE`. Category FK is restrictive so history cannot lose its category. |
| `budgets` | `id`, `user_id FK`, `category_id FK`, `monthly_amount_cents INT CHECK (>0)`, `mode ENUM(monthly_reset, rollover)`, `start_month DATE`, `active BOOL`, timestamps; one active configuration per `(user_id, category_id)` | `start_month` must be the first day of a month. A budget belongs to an active category when created; preserve it if that category is later archived, but hide it from normal budget setup. |
| `import_batches` | `id`, `user_id FK`, `status ENUM(processing, ready_for_review, approved, failed)`, `file_count`, `candidate_count`, `approved_count`, `model`, `failure_code NULL`, `failure_message_safe NULL`, timestamps | No source-file column or blob. It is the durable review/history shell. |
| `candidate_transactions` | `id`, `import_batch_id FK`, `ordinal`, `transaction_date NULL`, `type NULL`, `amount_cents NULL`, `description NULL`, `category_id NULL FK`, `notes NULL`, `suggested_category_text NULL`, `review_state ENUM(pending, selected, excluded, approved)`, `saved_transaction_id NULL FK`, timestamps | Candidate fields may be incomplete; rows are not ledger entries. Candidate categories must also belong to the batch user and be active when approved. |
| `extraction_logs` | `id`, `import_batch_id FK UNIQUE`, `provider_request_id NULL`, `model`, `status`, `raw_output_ciphertext NULL`, `error_code NULL`, `duration_ms`, `expires_at`, timestamps | Store only the response required for debugging/audit, encrypted at rest; automatically purge raw ciphertext after 30 days. Retain non-sensitive request metadata only as long as import history is useful. Never store file bytes. |

Recommended indexes: `transactions(user_id, transaction_date DESC)`, `transactions(user_id, category_id, transaction_date)`, `categories(user_id, archived_at)`, `import_batches(user_id, created_at DESC)`, `candidate_transactions(import_batch_id, ordinal)`, and `budgets(user_id, category_id)`.

The server creates default categories in the same database transaction as first-time user setup, using `normalized_name` to make the operation idempotent.

## 4. Server/API boundary

Use server-only service functions underneath either Next.js Server Actions (form mutations) or Route Handlers (JSON/multipart). Routes below describe the stable boundary; the UI must not access Prisma or OpenAI directly.

| Boundary | Minimum actions | Authorization |
| --- | --- | --- |
| Session | Auth.js sign-in/sign-out/callback routes | Google OAuth callback validates provider identity; session is HTTP-only and secure in production. |
| Dashboard | `GET /api/dashboard?month=YYYY-MM` | Require session; aggregate only `transactions.user_id = session.user.id`. |
| Transactions | create, list/recent, update `/:id`, delete `/:id` | Require session; lookup by both transaction ID and user ID; verify category ownership/active state on create/update. |
| Categories | list active/all, create, rename, archive, reactivate | Require session; all lookups and uniqueness logic are user-scoped. Do not archive a category belonging to another user. |
| Budgets | list, upsert category budget, disable | Require session; verify category ownership, active status, and date/mode input. Respect `budget_mode_enabled` for UI reads; configurations may exist while mode is off. |
| Imports | `POST /api/imports` multipart, `GET /api/imports`, `GET /api/imports/:id`, review-row update, approve | Require session; batch and every candidate are retrieved through a user-scoped batch lookup. The multipart route is server-only and is the sole OpenAI caller. |
| Import retry | recreate import after new upload | Require session. A failed extraction cannot be retried from the old batch because no source file is kept. The UI starts a new batch; it may link its display to the failed batch only as non-sensitive metadata. |

The approval handler is a single database transaction: lock/read the user-owned batch and selected candidates, validate all required candidate fields and category ownership, insert ledger transactions, set each candidate to `approved` with its saved ID, and set the batch to `approved`. If validation or insertion fails, commit nothing.

## 5. AI import workflow

1. Validate the authenticated multipart request: allowed broad document/image MIME families, file metadata, and server/runtime safety checks. Do not introduce a product-level size limit.
2. Create `import_batches(status=processing)`.
3. Keep upload bytes in request memory only. Send them directly as file/image input to the Responses API, use a versioned extraction prompt, a strict JSON schema, and `store: false`.
4. Validate the returned JSON again with Zod. For uncertain dates, type, description, amount, or category, require the model to emit `null`/blank—not a guess.
5. In one database transaction, write `candidate_transactions`, an encrypted `extraction_logs` record, counts, and `ready_for_review`. Only a suggested category name may be mapped to an existing active category; it is never auto-created.
6. The review screen lets the user edit, select, or exclude every row. Incomplete selected rows are visibly invalid and cannot be approved.
7. Approval performs the all-or-nothing transaction described above; excluded rows remain in batch history but are never inserted into `transactions`.

Failure handling: mark the batch `failed`, retain a safe error code/message plus the short-lived encrypted provider response when available, and discard the in-memory bytes. Retryable provider/network failures can receive one bounded automatic retry while bytes are still in the active request. Once that request ends, the user must re-upload to try again. Never expose raw provider responses or internal errors in the normal UI.

The OpenAI Responses API supports file/image input and structured JSON output. The `store: false` choice avoids intentionally retaining application response state, though OpenAI’s published data controls still describe abuse-monitoring and exceptional image/file retention; reflect that in the product privacy notice. [OpenAI API quickstart](https://platform.openai.com/docs/quickstart/make-your-first-api-request) and [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

## 6. Calculation rules

For a selected calendar month `M`, all queries use `transaction_date` in that month—not import or creation time.

```text
gross_expenses(M) = Σ amount where type = expense
refunds(M)        = Σ amount where type = refund
net_spending(M)   = gross_expenses(M) − refunds(M)
category_net(C,M) = Σ expenses(C,M) − Σ refunds(C,M)
```

`category_net` is both category spending and budget consumption. Thus a $40 refund in Groceries in August reduces August’s Groceries spending and August’s budget usage by $40, even if the original purchase occurred in July. Refunds are never linked to an original transaction in MVP.

For a monthly-reset budget with limit `L`, `usage(M) = category_net(C,M)` and `remaining(M) = L − usage(M)`. Keep the raw value: a refund can produce negative usage / more than `L` remaining. The UI may show that as a credit rather than falsely clamping it.

For a rollover budget beginning at `start_month S`, with `n` inclusive months from `S` through `M`:

```text
raw_available(M) = n × L − Σ category_net(C, each month S..M)
display_available(M) = max(0, raw_available(M))
overage(M) = max(0, −raw_available(M))
```

Do not discard a negative raw balance: it is what causes an overage to reduce later months. Examples for a $300/month travel budget beginning January:

- $0 in January and February → March starts with $900 available.
- $900 spent in March → March raw available is $0; April starts with $300.
- $1,000 spent in March → March raw available is −$100 (show $0 available and $100 over); April raw available is $200.
- A $75 April refund reduces April spending by $75 and increases April’s raw availability by $75.

Months before `start_month` do not contribute to a budget. Category archival does not remove past transactions or alter calculations. A hard-deleted transaction immediately disappears from all dashboard and budget queries.

## 7. Security, privacy, and observability

- Authenticate only through Google OAuth; use Auth.js session checks in every server handler. OAuth tokens and the OpenAI API key stay server-side.
- Treat ownership as a database query condition, not a UI promise: every query and mutation is constrained by `user_id = session.user.id`, including nested candidates and category/budget references.
- Validate client input with Zod and enforce database foreign keys, unique normalized category names, positive amount checks, and enums. Use CSRF-safe framework defaults for mutations, rate-limit sign-in and import endpoints, and return generic user-safe errors.
- Process uploads in memory, do not include file contents in error reporting, and zero/release references in `finally`. Enforce only unavoidable gateway/runtime safeguards and document them operationally.
- Encrypt raw extraction output at rest with an application-managed key from the deployment secret manager. Purge ciphertext after 30 days; keep minimal non-content metadata only. Make the retention job idempotent and record deletion success without logging content.
- Normal logs may contain request IDs, user ID hashes, route, status, duration, and provider request ID. They must not contain statements, file names, transaction descriptions, notes, email addresses, raw OpenAI responses, OAuth tokens, session cookies, or API keys.
- Back up the database, restrict database/network access to the application identity, use TLS in transit, and keep secrets in the host’s secret manager. A privacy notice must explain that selected uploads are sent to OpenAI for extraction.

## 8. Implementation sequence

1. **Foundation:** Next.js app, PostgreSQL/Prisma migrations, Auth.js Google SSO, session helpers, user bootstrap, and user-scoped query helpers.
2. **Ledger:** category defaults and archive/reactivate behavior; manual transaction form; transaction edit and hard delete; server validation and ownership tests.
3. **Dashboard:** month selector/current-month default, totals, category aggregation, trend, and recent transactions. Build exclusively from ledger queries.
4. **Imports:** batch/candidate schema, temporary multipart handler, Responses API structured extraction, review UI, atomic approval, import history, retention cleanup, and failure/re-upload UX.
5. **Budgets:** budget mode setting, monthly-reset calculations/UI, rollover calculation tests, then rollover UI.
6. **Hardening:** access-control tests, input/error redaction, rate limits, backups, and observability alerts.

Foundation precedes every other phase. Ledger and category work can share a phase but category constraints must land before transaction mutations. Dashboard can proceed once read models and transaction fixtures exist. Import UI and OpenAI integration can be developed in parallel after the schema/service contracts are agreed. Budgets should wait until ledger calculations are stable.

## 9. Open questions and recommendations

Only these decisions need product-owner confirmation before implementation:

1. **Currency presentation:** choose the single MVP currency and locale (for example, CAD / `en-CA`). Store cents; multi-currency remains out of scope.
2. **Extraction-log access:** confirm a fixed 30-day encrypted raw-output retention window, with metadata retained for 90 days or for the life of the batch. The recommended default is 30 days of encrypted content, then metadata only.
3. **Budget reconfiguration semantics:** when a user changes a budget mid-month, recommend applying the new configuration prospectively from the next calendar month; this avoids silently rewriting historical availability. A user can choose a `start_month` for a new configuration if retrospective behavior is wanted.

## Recommended MVP architecture

A single TypeScript Next.js application with Auth.js Google SSO, Prisma, and PostgreSQL provides the smallest maintainable boundary. It stores only user-owned finance data, processes source files transiently in the server request, uses OpenAI Responses structured output to create reviewable candidates, and commits ledger entries only through an atomic human-approval action.

### First implementation checklist

- [ ] Create the Next.js, Prisma, PostgreSQL, and Auth.js foundation.
- [ ] Implement user bootstrap and default categories with normalized archival/reactivation rules.
- [ ] Add transaction CRUD with ownership checks and integer-cent validation.
- [ ] Build dashboard aggregates from `transaction_date`.
- [ ] Add import batch/candidate schema and review/approval transaction.
- [ ] Integrate transient OpenAI extraction with `store: false` and encrypted, expiring extraction logs.
- [ ] Add budget mode, then monthly-reset and rollover calculations.
