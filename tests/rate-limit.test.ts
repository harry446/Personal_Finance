import { afterEach, describe, expect, it } from 'vitest';

import {
  clearRateLimitsForTest,
  enforceRateLimit,
  rateLimitedResponse,
  requestClientIdentifier,
} from '@/lib/rate-limit';

afterEach(() => {
  clearRateLimitsForTest();
});

describe('M7 request rate limiting', () => {
  it('allows a bounded number of attempts, then returns a safe retry window', () => {
    const policy = { limit: 2, windowSeconds: 60 };

    expect(
      enforceRateLimit('sign_in', '203.0.113.10', policy, 1_000),
    ).toMatchObject({
      allowed: true,
    });
    expect(
      enforceRateLimit('sign_in', '203.0.113.10', policy, 1_001),
    ).toMatchObject({
      allowed: true,
    });
    expect(enforceRateLimit('sign_in', '203.0.113.10', policy, 1_002)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });

  it('keeps scopes and client identifiers isolated and resets after the window', () => {
    const policy = { limit: 1, windowSeconds: 10 };

    expect(enforceRateLimit('sign_in', 'ip-a', policy, 1_000).allowed).toBe(
      true,
    );
    expect(enforceRateLimit('import_ip', 'ip-a', policy, 1_001).allowed).toBe(
      true,
    );
    expect(enforceRateLimit('sign_in', 'ip-b', policy, 1_001).allowed).toBe(
      true,
    );
    expect(enforceRateLimit('sign_in', 'ip-a', policy, 11_000).allowed).toBe(
      true,
    );
  });

  it('uses the reverse proxy client header without emitting it', () => {
    expect(
      requestClientIdentifier(
        new Request('https://finance.example/api/imports', {
          headers: {
            'x-forwarded-for': '198.51.100.1, 127.0.0.1',
            'x-real-ip': '203.0.113.33',
          },
        }),
      ),
    ).toBe('203.0.113.33');
  });

  it('returns a generic no-store 429 response', async () => {
    const response = rateLimitedResponse(42);

    expect(response.status).toBe(429);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('42');
    await expect(response.json()).resolves.toEqual({
      error: 'Too many requests. Please try again later.',
    });
  });
});
