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
2. Update the checked-out release at /srv/personal-finance as the deployment user. Install the lockfile dependencies with npm ci and generate Prisma Client.
3. Run npm run prisma:deploy before starting new application code. Never use prisma db push in production.
4. Run npm run build. On a 1 GiB Droplet, build in CI or add temporary build capacity rather than allowing the production process to be killed by memory pressure.
5. Copy deployment/personal-finance.service to /etc/systemd/system, reload systemd, then restart personal-finance.
6. Copy and enable the healthcheck service and timer. Confirm both the local health endpoint and the public HTTPS health endpoint return status ok.
7. Run the two-account release smoke checklist in docs/M7_RELEASE_CHECKLIST.md and record only date, release revision, environment URL, and pass/fail. Never record session cookies, OAuth tokens, statement data, or secrets.

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
