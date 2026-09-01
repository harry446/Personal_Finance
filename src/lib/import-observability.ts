import 'server-only';

import { createHash } from 'node:crypto';

type ImportLogEvent = {
  durationMs?: number;
  event: 'failed' | 'started' | 'succeeded';
  providerRequestId?: string | null;
  status: 'failed' | 'processing' | 'ready_for_review';
  userId: string;
};

export function redactImportLogEvent(event: ImportLogEvent) {
  return {
    durationMs: event.durationMs,
    event: event.event,
    providerRequestId: event.providerRequestId ?? undefined,
    status: event.status,
    userHash: createHash('sha256')
      .update(event.userId)
      .digest('hex')
      .slice(0, 16),
  };
}

export function logImportEvent(event: ImportLogEvent) {
  console.info('import_event', redactImportLogEvent(event));
}
