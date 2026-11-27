# M7 DigitalOcean operations runbook

## Deployment boundary

The release target is one DigitalOcean Basic Droplet running Ubuntu LTS, Caddy, this Next.js application, and self-hosted PostgreSQL. Start with 1 GiB memory only if imports are small and deploy builds are performed elsewhere; use 2 GiB if the Node process, PostgreSQL, or in-memory PDF/image extraction approaches memory pressure.

The Droplet is a single-instance deployment. The M7 rate limiter is intentionally in process: it protects this one host and resets after an application restart. Do not add another application instance without replacing it with a shared rate-limit store.

## Network and TLS

1. Create a DigitalOcean cloud firewall. Permit inbound TCP 80 and 443 from all addresses, and TCP 22 only from the owner administration address. Do not expose TCP 3000 or 5432.
2. Configure PostgreSQL to listen only on 127.0.0.1. Create a dedicated application database role; do not use the PostgreSQL superuser in DATABASE_URL.
3. Install Caddy and copy deployment/Caddyfile to /etc/caddy/Caddyfile after replacing finance.example.com and owner@example.com. Point the final DNS A record to the Droplet before starting Caddy.
4. Caddy must be the only public path to the app. It overwrites X-Real-IP and X-Forwarded-For, which makes the application sign-in and import rate limits safe to key by client address. Bind Next.js only to 127.0.0.1.
5. Validate HTTPS before release. Caddy automatically provisions and renews TLS; verify the redirect from HTTP and the Strict-Transport-Security response header.

## Secrets

On this single Droplet, use a root-owned systemd EnvironmentFile as the release secret store. It is never committed, copied into a build artifact, printed in service output, or passed on the command line.

1. Create /etc/personal-finance with mode 0700 and /etc/personal-finance/personal-finance.env with mode 0600, owned by root.
2. Add DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, NEXTAUTH_URL, NEXT_PUBLIC_APP_URL, OPENAI_API_KEY, EXTRACTION_LOG_ENCRYPTION_KEY, EXTRACTION_PURGE_SECRET, and NEXT_SERVER_ACTIONS_ENCRYPTION_KEY.
3. Set both public URL values to the exact HTTPS origin. Register that origin and its /api/auth/callback/google callback in Google Cloud.
4. Generate unrelated high-entropy values for every secret. Keep NEXT_SERVER_ACTIONS_ENCRYPTION_KEY stable for every build that can serve active Server Actions.
5. Rotate a suspected secret immediately, restart the service, and invalidate/recreate the corresponding external credential where supported.

## Release procedure

1. Run the repository quality gates and confirm CI is green.
2. Confirm the release commit is pushed to `origin/main`. The Droplet can only deploy committed and pushed work.
3. SSH into the Droplet as root and run `bash /srv/personal-finance/deployment/update-droplet.sh`. The script refuses a dirty or diverged checkout, fast-forwards from `origin/main`, stops the application, runs `npm ci --include=dev` so Next.js build tooling is available, applies committed migrations, builds, refreshes the systemd units, starts the application, and checks the local health endpoint. Never use `prisma db push` in production.
4. On the first deployment after this script is added, fetch it before running it:

   ```bash
   runuser --user personal-finance -- git -C /srv/personal-finance pull --ff-only origin main
   bash /srv/personal-finance/deployment/update-droplet.sh
   ```

   For later updates, only the second command is needed because the script performs its own fetch and fast-forward.

5. The script uses `/var/lib/personal-finance` as the deployment user's home and npm cache location. Keep shell history, npm caches, and other service-account state outside `/srv/personal-finance`; otherwise the clean-checkout safety check will stop the release.
6. If the script fails after stopping the service, it intentionally leaves the service stopped instead of serving a partially updated release. Read the reported error and inspect `journalctl -u personal-finance.service -n 100 --no-pager`. Database migrations are not automatically reversible; confirm migration compatibility before manually rolling application code back.
7. On a 1 GiB Droplet, build in CI or add temporary build capacity if the production build approaches the memory limit.
8. Confirm the public HTTPS health endpoint returns status ok.
9. Run the two-account release smoke checklist in docs/M7_RELEASE_CHECKLIST.md and record only date, release revision, environment URL, and pass/fail. Never record session cookies, OAuth tokens, statement data, or secrets.

## Automated releases

The CI workflow can deploy successful `main` pushes or runs started from **Actions → CI → Run workflow** on `main`. Both run the `quality` job first. The deploy job uses Tailscale to reach the Droplet over SSH and passes the tested commit to the existing release script. If `origin/main` has moved since the CI run started, the script exits before stopping the service. GitHub serializes deploy jobs, and the Droplet rejects overlapping manual and automated deployments.

### Protect `main` and create the production environment

1. In the GitHub repository settings, protect `main`. Require a pull request with zero required approvals, require the `quality` status check, and apply the rule to administrators. Keep force pushes and branch deletion disabled.
2. Create the `production` Actions environment and restrict its deployment branches to `main`. Leave required reviewers disabled for unattended deployment.
3. Keep the repository Actions variable `PRODUCTION_DEPLOY_ENABLED` unset until the Droplet and environment are ready. The deploy job runs only when this variable is `true`.

### Connect the Droplet and GitHub Actions

1. Join the Droplet to your Tailscale network with the `tag:finance-droplet` tag. Keep the public SSH firewall rule restricted to your administration IP. If UFW filters SSH on the Droplet, allow SSH on the `tailscale0` interface.
2. Create `tag:finance-ci` and allow it to reach `tag:finance-droplet` on TCP port 22 in your Tailscale access policy. Check that existing grants don't give `tag:finance-ci` broader access.
3. Create a Tailscale [federated identity](https://tailscale.com/docs/features/workload-identity-federation) for GitHub Actions with **Auth Keys → Write** and `tag:finance-ci`. Restrict the subject to this repository's `production` environment, using the repository's [GitHub OIDC subject format](https://docs.github.com/en/actions/reference/security/oidc#filtering-for-a-specific-environment).
4. In the GitHub `production` environment, set `TS_CLIENT_ID` and `TS_AUDIENCE` to the federated identity's client ID and audience. Set `DROPLET_SSH_HOST` to the Droplet's Tailscale hostname or IP. Set `DROPLET_SSH_KNOWN_HOSTS` to a known-hosts line containing that exact host and the SSH host public key verified on the Droplet, typically from `/etc/ssh/ssh_host_ed25519_key.pub`. The line should look like `finance.example.ts.net ssh-ed25519 AAAA...`.

### Install the restricted SSH command

1. Generate a dedicated Ed25519 key pair for unattended deployment. Save the private key as the GitHub `production` environment secret `DROPLET_SSH_PRIVATE_KEY`.
2. After the workflow PR is merged, run the normal manual release once to put the updated script on the Droplet. As root, create the dedicated account and install a root-owned copy of the reviewed release script:

   ```bash
   adduser --disabled-password --gecos '' personal-finance-deploy
   install -o personal-finance-deploy -g personal-finance-deploy -m 0700 -d /home/personal-finance-deploy/.ssh
   install -o root -g root -m 0755 /srv/personal-finance/deployment/update-droplet.sh /usr/local/sbin/personal-finance-deploy
   ```

3. Add this line to `/home/personal-finance-deploy/.ssh/authorized_keys`, replacing `ssh-ed25519 AAAA...` with the deployment public key. Set the file owner to `personal-finance-deploy` and its mode to `0600`.

   ```text
   restrict,command="/usr/bin/sudo -n /usr/local/sbin/personal-finance-deploy --ci" ssh-ed25519 AAAA...
   ```

4. Run `visudo -f /etc/sudoers.d/personal-finance-deploy` and add these rules. They preserve the SSH-supplied commit for this command and give the deployment account permission to run only the installed script in CI mode.

   ```sudoers
   Cmnd_Alias PERSONAL_FINANCE_DEPLOY = /usr/local/sbin/personal-finance-deploy --ci
   Defaults!PERSONAL_FINANCE_DEPLOY env_keep += "SSH_ORIGINAL_COMMAND"
   personal-finance-deploy ALL=(root) NOPASSWD: PERSONAL_FINANCE_DEPLOY
   ```

5. Set the repository Actions variable `PRODUCTION_DEPLOY_ENABLED` to `true`, then run **Actions → CI → Run workflow** on `main`. Confirm the deploy step reports the expected revision and a healthy service, then check the public HTTPS health endpoint. To pause automated releases, remove the variable or set it to `false`.

When `deployment/update-droplet.sh` changes, reinstall the reviewed root-owned copy on the Droplet. Keep the installed script separate from the application checkout so the deployment account can't modify the command it can run with `sudo`.

## Authentication account investigation and removal

Seeing the owner's email after attempting to choose another Google account does not by itself prove that the accounts or finance records were combined. The browser may still hold an authenticated database session for the owner. Use **Sign out or switch account**, then retry in a private browser window before changing production data.

If the behavior remains unclear, SSH into the Droplet as root and open PostgreSQL through its local administrator account. This avoids placing `DATABASE_URL` or the database password on the command line:

```bash
runuser --user postgres -- psql --dbname personal_finance
```

Set psql variables for the two exact email addresses, then run the read-only inspection. Do not paste session tokens, OAuth tokens, or account-provider IDs into an incident record.

```sql
\set ON_ERROR_STOP on
\set owner_email 'owner@example.com'
\set test_email 'test@example.com'

SELECT
  u.id,
  u.email,
  u.created_at,
  (SELECT count(*) FROM accounts a WHERE a.user_id = u.id) AS account_count,
  (SELECT count(*) FROM sessions s WHERE s.user_id = u.id AND s.expires > now()) AS active_session_count,
  (SELECT count(*) FROM categories c WHERE c.user_id = u.id) AS category_count,
  (SELECT count(*) FROM transactions t WHERE t.user_id = u.id) AS transaction_count,
  (SELECT count(*) FROM import_batches i WHERE i.user_id = u.id) AS import_batch_count,
  (SELECT count(*) FROM budgets b WHERE b.user_id = u.id) AS budget_count
FROM users u
WHERE lower(u.email) IN (lower(:'owner_email'), lower(:'test_email'))
ORDER BY lower(u.email);

SELECT
  u.email,
  a.provider,
  left(md5(a.provider_account_id), 12) AS provider_account_fingerprint
FROM accounts a
JOIN users u ON u.id = a.user_id
WHERE lower(u.email) IN (lower(:'owner_email'), lower(:'test_email'))
ORDER BY lower(u.email), a.provider, provider_account_fingerprint;
```

Interpret the result before deleting anything:

- Only the owner row exists with one Google account: the test account was not saved; reset the owner's sessions instead of deleting the owner.
- Two user rows exist and each has exactly one Google account fingerprint: the inspected database identities are separate. A retained browser session is a possible cause of the unexpected displayed email; verify from a new private browser session.
- More than one Google fingerprint is attached to one user, an email is attached unexpectedly, or ownership counts look wrong: stop and investigate before deleting anything.

### Multiple Google accounts linked to one user

The installed NextAuth v4 OAuth callback links a previously unlinked provider account to the currently authenticated user when an app session exists. Choosing another Google account before signing out can therefore create an unintended login association. Subsequent sign-ins with that Google identity resolve to the linked user even from a fresh browser. A sign-out control does not repair existing links, and deleting a separate test user will not remove a link attached to the owner.

First identify the extra `accounts` row. This read-only query decodes stored Google ID-token payloads locally and prints only account row IDs, email claims, hashed provider IDs, and whether the subject matches. It never prints a token. The decoded claims are historical metadata; this query does not validate the signature, expiry, or current Google identity. If a token is missing, malformed, or its subject does not match, stop and investigate instead of guessing which link to remove.

```sql
WITH payloads AS (
  SELECT a.id, a.user_id, a.provider_account_id,
         split_part(a.id_token, '.', 2) AS payload
  FROM accounts a
  JOIN users u ON u.id = a.user_id
  WHERE a.provider = 'google'
    AND lower(u.email) = lower(:'owner_email')
), claims AS (
  SELECT id, user_id, provider_account_id,
         CASE WHEN payload IS NOT NULL AND payload <> '' THEN
           convert_from(
             decode(
               translate(payload, '-_', '+/') ||
               repeat('=', (4 - length(payload) % 4) % 4),
               'base64'
             ), 'UTF8'
           )::jsonb
         END AS token_claims
  FROM payloads
)
SELECT c.id AS account_row_id,
       u.email AS linked_user_email,
       left(md5(c.provider_account_id), 12) AS account_fingerprint,
       c.token_claims ->> 'email' AS google_email_at_link_time,
       (c.token_claims ->> 'sub') = c.provider_account_id AS subject_matches
FROM claims c
JOIN users u ON u.id = c.user_id
ORDER BY account_fingerprint;
```

Compare the claimed emails with the Google accounts actually used in the test. Confirm the extra row ID and fingerprint and which intended owner link must remain. If the historical claims are insufficient, verify the identity with Google before proceeding. Never unlink an account based only on row order or count.

Once the unintended link is positively identified, exit psql with `\q`. Create a unique backup file with restricted permissions and check that its archive index is readable. This check does not replace a full restore rehearsal. Run these commands at the root shell and proceed only if both backup commands succeed:

```bash
repair_backup=$(runuser --user postgres -- mktemp /var/lib/postgresql/pf-account-repair.XXXXXX.dump)
runuser --user postgres -- pg_dump --format=custom --file="$repair_backup" personal_finance
runuser --user postgres -- pg_restore --list "$repair_backup" >/dev/null
printf 'Backup: %s\n' "$repair_backup"

systemctl stop personal-finance.service
runuser --user postgres -- psql --dbname personal_finance
```

Set the confirmed owner email, extra account row ID and fingerprint, and the correct account row ID that must remain. The transaction deletes only the extra login link and checks that the correct Google link still exists for the same user:

```sql
\set ON_ERROR_STOP on
\set owner_email 'owner@example.com'
\set extra_account_id 'REPLACE_WITH_EXTRA_ACCOUNT_ROW_ID'
\set extra_fingerprint 'REPLACE_WITH_EXTRA_FINGERPRINT'
\set keep_account_id 'REPLACE_WITH_CORRECT_ACCOUNT_ROW_ID'

BEGIN;
SET LOCAL lock_timeout = '5s';

DELETE FROM accounts a
USING users u
WHERE a.user_id = u.id
  AND u.email = :'owner_email'
  AND a.provider = 'google'
  AND a.id = :'extra_account_id'
  AND left(md5(a.provider_account_id), 12) = :'extra_fingerprint'
  AND EXISTS (
    SELECT 1 FROM accounts kept
    WHERE kept.id = :'keep_account_id'
      AND kept.id <> a.id
      AND kept.user_id = u.id
      AND kept.provider = 'google'
  )
RETURNING a.id, left(md5(a.provider_account_id), 12) AS removed_fingerprint;
```

Confirm the command returned exactly the extra account row and reports `DELETE 1` before proceeding. If it did not, enter `ROLLBACK;`. If it did, invalidate the owner's sessions and inspect the remaining Google links:

```sql
DELETE FROM sessions
WHERE user_id = (SELECT id FROM users WHERE email = :'owner_email');

SELECT a.id, u.email, a.provider,
       left(md5(a.provider_account_id), 12) AS remaining_fingerprint
FROM accounts a
JOIN users u ON u.id = a.user_id
WHERE u.email = :'owner_email' AND a.provider = 'google';
```

Enter `COMMIT;` only if the intended owner link remains and the unintended one is absent. Otherwise, or after any SQL error, enter `ROLLBACK;`. Do not delete either `users` row to fix an account link.

After committing, exit with `\q` and run `systemctl start personal-finance.service`. This preserves user rows and financial data; recovery of the removed association requires the backup or deliberate account linking. Test the owner and the previously mislinked Google account in separate new browser sessions. The unlinked Google identity can create its own user on its next successful sign-in. Existing categories and records remain with their original user; unlinking does not transfer them.

To invalidate every current browser session for one confirmed user without deleting categories or finance data, remain in psql and run:

```sql
BEGIN;
DELETE FROM sessions
WHERE user_id = (
  SELECT id FROM users WHERE lower(email) = lower(:'owner_email')
);
COMMIT;
```

Use `test_email` instead of `owner_email` only when resetting the test user's sessions. Exit with `\q`, then sign in again from a private window and verify the displayed email before creating or changing data.

Only delete a test user when the read-only inspection confirms the exact test email and all of that user's categories, transactions, imports, and budgets are intentionally disposable. First exit psql with `\q` and create a recoverable database backup:

```bash
runuser --user postgres -- pg_dump \
  --format=custom \
  --file=/var/lib/postgresql/personal-finance-before-test-user-removal.dump \
  personal_finance

runuser --user postgres -- pg_restore \
  --list \
  /var/lib/postgresql/personal-finance-before-test-user-removal.dump
```

Reopen psql, set `test_email` again, and execute the deletion as one transaction. Import children are removed first, followed by transactions, budgets, and categories, so restrictive category and saved-transaction foreign keys cannot leave a partial deletion.

```sql
\set ON_ERROR_STOP on
\set test_email 'test@example.com'

SELECT id, email, created_at
FROM users
WHERE lower(email) = lower(:'test_email');

BEGIN;

DELETE FROM import_batches
WHERE user_id IN (
  SELECT id FROM users WHERE lower(email) = lower(:'test_email')
);

DELETE FROM transactions
WHERE user_id IN (
  SELECT id FROM users WHERE lower(email) = lower(:'test_email')
);

DELETE FROM budgets
WHERE user_id IN (
  SELECT id FROM users WHERE lower(email) = lower(:'test_email')
);

DELETE FROM categories
WHERE user_id IN (
  SELECT id FROM users WHERE lower(email) = lower(:'test_email')
);

DELETE FROM sessions
WHERE user_id IN (
  SELECT id FROM users WHERE lower(email) = lower(:'test_email')
);

DELETE FROM accounts
WHERE user_id IN (
  SELECT id FROM users WHERE lower(email) = lower(:'test_email')
);

DELETE FROM verification_tokens
WHERE lower(identifier) = lower(:'test_email');

DELETE FROM users
WHERE lower(email) = lower(:'test_email')
RETURNING id, email;
```

Inspect the final `RETURNING` row. Enter `COMMIT;` only if it returns exactly the intended test user; otherwise enter `ROLLBACK;`. After committing, rerun the read-only inspection, exit with `\q`, and verify both Google accounts in separate private browser profiles. Never delete the owner row as a shortcut for a session problem.

## Reset all application data

Use this procedure only when every user's application data is intentionally disposable. It permanently clears all current application tables, including users, Google account links, sessions, categories, transactions, budgets, imports, extraction logs, and verification tokens. The database schema and `_prisma_migrations` remain intact. No rebuild, migration, or redeployment is needed. This procedure does not remove existing backup archives.

SSH into the Droplet as root. Stop the application to prevent concurrent sign-ins or writes, then open the exact application database:

```bash
systemctl stop personal-finance.service
runuser --user postgres -- psql --dbname personal_finance
```

Check the target before executing the reset:

```sql
SELECT current_database();
```

Proceed only if it returns `personal_finance`. Then run:

```sql
\set ON_ERROR_STOP on

BEGIN;
SET LOCAL lock_timeout = '5s';

TRUNCATE TABLE
  public.users,
  public.accounts,
  public.sessions,
  public.verification_tokens,
  public.categories,
  public.transactions,
  public.import_batches,
  public.candidate_transactions,
  public.extraction_logs,
  public.budgets,
  public.budget_configurations;

COMMIT;

SELECT
  (SELECT count(*) FROM public.users) AS users,
  (SELECT count(*) FROM public.accounts) AS accounts,
  (SELECT count(*) FROM public.sessions) AS sessions;
```

Expect `TRUNCATE TABLE`, `COMMIT`, and zero for each count. All related application tables are named explicitly so the reset does not cascade into unrelated tables. If any SQL command errors, enter `ROLLBACK;`, exit psql, restart the application, and investigate before retrying. Before committing, `ROLLBACK` cancels the reset; after committing, recovery requires a database backup.

Exit with `\q`, then restart and check the application:

```bash
systemctl start personal-finance.service
curl --fail --show-error --retry 5 --retry-connrefused --retry-delay 2 \
  http://127.0.0.1:3000/api/health
```

Sign in from a new browser session. Each successful first Google sign-in creates a new user and default categories. When testing account isolation, use separate browser profiles or sign out through **Sign out or switch account** before signing in with another identity. Returning to the landing page alone does not sign out.

## Backup and restore

Enable DigitalOcean weekly Droplet backups. The initial recovery objective is an RPO of seven days and an RTO of two hours; update these objectives before expanding beyond a few users.

Before public release and then after a significant database or infrastructure change:

1. Create an isolated temporary Droplet from the newest backup. Do not attach a public application domain or open PostgreSQL to the internet.
2. Start PostgreSQL and the application with test-only secrets and a local health check.
3. Verify the restored database has the expected schema migration history, a representative user, and the health endpoint response. Do not copy finance records into tickets or logs.
4. Record the backup timestamp, restore duration, tested migration revision, and pass/fail in the deployment record.
5. Destroy the temporary restore Droplet after the rehearsal.

## Monitoring and incidents

Enable DigitalOcean Monitoring and configure owner-email alerts for sustained CPU above 90%, memory pressure or swap use, disk above 80%, and Droplet availability. Configure an external HTTPS monitor against /api/health at least every five minutes; the local systemd timer is a secondary diagnostic, not an availability monitor.

For a health alert: check the Caddy and personal-finance service status, inspect redacted journal entries, confirm local PostgreSQL health, and roll back only application code after confirming the database migration compatibility. For a suspected data exposure: stop public access, rotate affected secrets, preserve only redacted operational evidence, assess affected users, and do not use raw import output for diagnosis. For extraction failures or unexpected request volume: inspect status, duration, provider request IDs, and rate-limit events only; never enable plaintext prompt or model-response logging.
