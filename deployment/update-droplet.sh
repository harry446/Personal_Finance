#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="/srv/personal-finance"
APP_HOME="/var/lib/personal-finance"
APP_USER="personal-finance"
APP_GROUP="personal-finance"
BRANCH="main"
REMOTE="origin"
ENV_FILE="/etc/personal-finance/personal-finance.env"
SERVICE="personal-finance.service"
HEALTH_TIMER="personal-finance-healthcheck.timer"
deployment_started=false

log() {
  printf '\n==> %s\n' "$*"
}

stop_partial_deployment() {
  if [[ "$deployment_started" == true ]]; then
    systemctl stop "$SERVICE" >/dev/null 2>&1 || true
  fi
}

fail() {
  stop_partial_deployment
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  trap - ERR
  stop_partial_deployment
  printf '\nERROR: Deployment command failed with exit code %s. The application service has been stopped.\n' "$exit_code" >&2
  exit "$exit_code"
}

trap on_error ERR

run_as_app() {
  runuser --user "$APP_USER" -- /usr/bin/env HOME="$APP_HOME" "$@"
}

run_with_secrets() {
  local step="$1"
  shift

  systemd-run \
    --quiet \
    --wait \
    --collect \
    --pipe \
    --unit="personal-finance-deploy-${step}-$$" \
    --property="User=$APP_USER" \
    --property="Group=$APP_GROUP" \
    --property="WorkingDirectory=$APP_DIR" \
    --property="EnvironmentFile=$ENV_FILE" \
    --property="Environment=HOME=$APP_HOME" \
    --property="Environment=NPM_CONFIG_CACHE=$APP_HOME/.npm" \
    --property="Environment=NODE_ENV=production" \
    --property="Environment=NEXT_TELEMETRY_DISABLED=1" \
    "$@"
}

if [[ "${EUID}" -ne 0 ]]; then
  fail "Run this script as root."
fi

for command in git runuser systemctl systemd-run curl install id sleep; do
  command -v "$command" >/dev/null 2>&1 || fail "Required command is missing: $command"
done

[[ -x /usr/bin/npm ]] || fail "Required executable is missing: /usr/bin/npm"
[[ -x /usr/bin/env ]] || fail "Required executable is missing: /usr/bin/env"
[[ -d "$APP_DIR/.git" ]] || fail "Git checkout not found at $APP_DIR"
[[ -f "$ENV_FILE" ]] || fail "Environment file not found at $ENV_FILE"
id "$APP_USER" >/dev/null 2>&1 || fail "Deployment user does not exist: $APP_USER"
install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 "$APP_HOME"

current_branch="$(run_as_app git -C "$APP_DIR" branch --show-current)"
[[ "$current_branch" == "$BRANCH" ]] || fail "Expected branch $BRANCH, found ${current_branch:-detached HEAD}"

dirty_status="$(run_as_app git -C "$APP_DIR" status --porcelain)"
if [[ -n "$dirty_status" ]]; then
  printf '%s\n' "$dirty_status" >&2
  fail "The Droplet checkout has uncommitted changes. Resolve them before deploying."
fi

log "Fetching $REMOTE/$BRANCH"
run_as_app git -C "$APP_DIR" fetch --prune "$REMOTE" "$BRANCH"

if ! run_as_app git -C "$APP_DIR" merge-base --is-ancestor HEAD "$REMOTE/$BRANCH"; then
  fail "The Droplet checkout cannot fast-forward to $REMOTE/$BRANCH. Resolve the branch divergence manually."
fi

old_revision="$(run_as_app git -C "$APP_DIR" rev-parse --short HEAD)"
target_revision="$(run_as_app git -C "$APP_DIR" rev-parse --short "$REMOTE/$BRANCH")"

log "Stopping $SERVICE"
systemctl stop "$SERVICE"
deployment_started=true

log "Fast-forwarding $old_revision to $target_revision"
run_as_app git -C "$APP_DIR" merge --ff-only "$REMOTE/$BRANCH"

log "Installing locked dependencies"
run_with_secrets dependencies /usr/bin/npm ci

log "Applying committed database migrations"
run_with_secrets migrations /usr/bin/npm run prisma:deploy

log "Building the production application"
run_with_secrets build /usr/bin/npm run build

log "Refreshing systemd units"
install -o root -g root -m 0644 "$APP_DIR/deployment/personal-finance.service" "/etc/systemd/system/$SERVICE"
install -o root -g root -m 0644 "$APP_DIR/deployment/personal-finance-healthcheck.service" /etc/systemd/system/personal-finance-healthcheck.service
install -o root -g root -m 0644 "$APP_DIR/deployment/personal-finance-healthcheck.timer" "/etc/systemd/system/$HEALTH_TIMER"
systemctl daemon-reload
systemctl enable "$SERVICE" "$HEALTH_TIMER" >/dev/null

log "Starting $SERVICE"
systemctl start "$SERVICE"

log "Waiting for the local health endpoint"
healthy=false
for _ in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:3000/api/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" != true ]]; then
  systemctl --no-pager --full status "$SERVICE" || true
  fail "The service did not become healthy. Inspect: journalctl -u $SERVICE -n 100 --no-pager"
fi

systemctl start "$HEALTH_TIMER"
new_revision="$(run_as_app git -C "$APP_DIR" rev-parse --short HEAD)"
deployment_started=false

log "Deployment complete"
printf 'Revision: %s\n' "$new_revision"
printf 'Health:   http://127.0.0.1:3000/api/health (ok)\n'
printf 'Next:     Verify the public HTTPS health endpoint and complete the two-account smoke test.\n'
