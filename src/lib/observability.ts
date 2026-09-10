import 'server-only';

import { createHmac } from 'node:crypto';

const sensitiveKey =
  /(amount|authorization|body|content|cookie|description|email|file|filename|image|merchant|note|oauth|password|prompt|raw|secret|statement|token|transaction|upload)/i;

const safeKeys = new Set([
  'deleted',
  'durationMs',
  'event',
  'limitScope',
  'outcome',
  'providerRequestId',
  'retryAfterSeconds',
  'route',
  'status',
  'userHash',
]);

type OperationalFields = Record<string, boolean | number | string | undefined>;

/**
 * Produces a stable, deployment-secret keyed identifier suitable for operational
 * correlation. Raw user IDs, IP addresses, and emails must never enter logs.
 */
export function hashOperationalIdentifier(value: string) {
  return createHmac('sha256', process.env.AUTH_SECRET ?? 'missing-auth-secret')
    .update(value)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Keeps logs deliberately small and allow-listed. Unknown or sensitive-looking
 * fields are omitted rather than relying on call sites to remember redaction.
 */
export function redactOperationalFields(fields: OperationalFields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([key, value]) => {
      if (value === undefined || sensitiveKey.test(key) || !safeKeys.has(key)) {
        return false;
      }

      return (
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value)) ||
        typeof value === 'string'
      );
    }),
  );
}

export function logOperationalEvent(event: string, fields: OperationalFields) {
  console.info(event, redactOperationalFields(fields));
}
