import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hashOperationalIdentifier,
  logOperationalEvent,
  redactOperationalFields,
} from '@/lib/observability';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('M7 operational log redaction', () => {
  it('retains only allow-listed, non-sensitive operational fields', () => {
    const result = redactOperationalFields({
      description: 'Private merchant name',
      durationMs: 27,
      email: 'person@example.com',
      event: 'succeeded',
      filename: 'statement.pdf',
      notes: 'Private note',
      rawResponse: 'Private model output',
      route: '/api/imports',
      status: 'ready_for_review',
      userHash: 'safe-correlation-id',
    });

    expect(result).toEqual({
      durationMs: 27,
      event: 'succeeded',
      route: '/api/imports',
      status: 'ready_for_review',
      userHash: 'safe-correlation-id',
    });
    expect(JSON.stringify(result)).not.toMatch(
      /Private|person@example|statement|merchant|note/i,
    );
  });

  it('uses a keyed one-way correlation value instead of the raw identifier', () => {
    const identifier = 'person@example.com';
    const hash = hashOperationalIdentifier(identifier);

    expect(hash).not.toBe(identifier);
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
    expect(hashOperationalIdentifier(identifier)).toBe(hash);
  });

  it('logs only sanitized fields', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    logOperationalEvent('import_event', {
      durationMs: 25,
      prompt: 'bank statement content',
      status: 'failed',
      token: 'secret-token',
    });

    expect(info).toHaveBeenCalledWith('import_event', {
      durationMs: 25,
      status: 'failed',
    });
  });
});
