import { describe, expect, it } from 'vitest';

import nextConfig from '../next.config';

describe('production response headers', () => {
  it('sets baseline browser security headers for every route', async () => {
    const rules = await nextConfig.headers?.();
    const headers = rules?.[0]?.headers ?? [];
    const values = Object.fromEntries(
      headers.map((header) => [header.key, header.value]),
    );

    expect(values['Content-Security-Policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(values['Permissions-Policy']).toContain('camera=()');
    expect(values['Referrer-Policy']).toBe('no-referrer');
    expect(values['X-Content-Type-Options']).toBe('nosniff');
    expect(values['X-Frame-Options']).toBe('DENY');
  });
});
