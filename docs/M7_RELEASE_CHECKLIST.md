# M7 release checklist

## Pre-release

- [ ] Docs in docs/AUTHORIZATION_MATRIX.md match all routes, actions, and nested resources.
- [ ] No normal log call includes uploads, names, transaction descriptions, notes, emails, raw model output, OAuth tokens, cookies, or secrets.
- [ ] HTTPS, Caddy proxy headers, host firewall, local-only Next.js/PostgreSQL bindings, and root-only secret file are verified.
- [ ] npm run prisma:deploy completed before the application restart.
- [ ] /api/health returns status ok locally and through the HTTPS origin.
- [ ] DigitalOcean weekly backups are enabled and a restore rehearsal met the documented seven-day RPO and two-hour RTO.
- [ ] DigitalOcean resource alerts and an external HTTPS health alert route to the owner.
- [ ] The public Privacy notice is linked from sign-in and accurately reflects the deployed configuration.

## Two-account smoke test

Use two separate real Google accounts in normal Chrome. Do not automate Google sign-in and do not save any browser state.

1. Sign in as account A. Create a manual expense, confirm it appears in the correct dashboard month, then enable budget mode and save one category budget.
2. Using a non-sensitive fixture, upload a supported PDF or image as account A. Confirm the browser clears the file selection after extraction, edit/select a candidate, approve it, and confirm the saved transaction appears in the correct month.
3. Sign in as account B in a separate browser profile. Confirm none of account A's transaction descriptions, categories, budget configuration, import history, batch URLs, or candidate URLs are accessible. Create and confirm account B's own manual expense.
4. Return to account A. Confirm account B's data is absent and account A's budget progress remains visible.
5. Record the release revision, test date, application origin, and pass/fail only.

## Visual and accessibility evidence

Automated browser coverage captures the authenticated desktop overview and narrow mobile overview, verifies keyboard-visible focus, checks responsive reflow, and scans the signed-in and public screens for automated axe violations. A node-specific Figma frame is not available in the current repository; design QA is recorded in design-qa.md and must be revisited if one is supplied.

Current local automated evidence (September 7, 2026): the production-build Playwright suite passed 11 tests, including account A/account B isolation and a human-reviewed import approval. The relevant desktop and 390 px mobile screenshots are retained in `test-results/` during the test run. Manual pixel comparison remains pending because the local image-view sandbox cannot open the captured artifacts.
