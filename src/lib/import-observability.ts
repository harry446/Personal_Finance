import 'server-only';

import {
  hashOperationalIdentifier,
  logOperationalEvent,
  redactOperationalFields,
} from '@/lib/observability';

type ImportLogEvent = {
  durationMs?: number;
  event: 'failed' | 'started' | 'succeeded';
  providerRequestId?: string | null;
  status: 'failed' | 'processing' | 'ready_for_review';
  userId: string;
};

export function redactImportLogEvent(event: ImportLogEvent) {
  return redactOperationalFields({
    durationMs: event.durationMs,
    event: event.event,
    providerRequestId: event.providerRequestId ?? undefined,
    status: event.status,
    userHash: hashOperationalIdentifier(event.userId),
  });
}

export function logImportEvent(event: ImportLogEvent) {
  logOperationalEvent('import_event', redactImportLogEvent(event));
}
