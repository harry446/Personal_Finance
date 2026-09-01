import { afterEach, describe, expect, it, vi } from 'vitest';

const purgeMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/import-retention', () => ({
  purgeExpiredExtractionCiphertext: purgeMock,
}));

import { POST } from '@/app/api/internal/purge-extractions/route';

const previousSecret = process.env.EXTRACTION_PURGE_SECRET;

afterEach(() => {
  purgeMock.mockReset();

  if (previousSecret === undefined) {
    delete process.env.EXTRACTION_PURGE_SECRET;
  } else {
    process.env.EXTRACTION_PURGE_SECRET = previousSecret;
  }
});

describe('extraction retention purge route', () => {
  it('requires a configured bearer secret', async () => {
    process.env.EXTRACTION_PURGE_SECRET = 'm5-test-secret';

    const response = await POST(
      new Request('http://localhost:3000/api/internal/purge-extractions', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(401);
    expect(purgeMock).not.toHaveBeenCalled();
  });

  it('runs the idempotent purge without returning sensitive content', async () => {
    process.env.EXTRACTION_PURGE_SECRET = 'm5-test-secret';
    purgeMock.mockResolvedValue(3);

    const response = await POST(
      new Request('http://localhost:3000/api/internal/purge-extractions', {
        headers: { authorization: 'Bearer m5-test-secret' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 3 });
  });
});
