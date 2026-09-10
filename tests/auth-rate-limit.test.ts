import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handlerMock, rateLimitMock } = vi.hoisted(() => ({
  handlerMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock('next-auth', () => ({
  default: vi.fn(() => handlerMock),
}));

vi.mock('@/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/rate-limit', () => ({
  enforceRequestRateLimit: rateLimitMock,
  rateLimitedResponse: (retryAfterSeconds: number) =>
    Response.json(
      { error: 'Too many requests. Please try again later.' },
      { headers: { 'Retry-After': String(retryAfterSeconds) }, status: 429 },
    ),
}));

import { POST } from '@/app/api/auth/[...nextauth]/route';

describe('Google sign-in rate limiting', () => {
  beforeEach(() => {
    handlerMock.mockReset();
    rateLimitMock.mockReset();
    handlerMock.mockResolvedValue(new Response(null, { status: 200 }));
    rateLimitMock.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it('limits the user-initiated Google sign-in path before delegating to Auth.js', async () => {
    rateLimitMock.mockReturnValue({ allowed: false, retryAfterSeconds: 30 });

    const response = await POST(
      new Request('https://finance.example/api/auth/signin/google', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(handlerMock).not.toHaveBeenCalled();
  });

  it('does not rate-limit the provider callback path as a shared Google IP', async () => {
    const request = new Request(
      'https://finance.example/api/auth/callback/google',
      {
        method: 'POST',
      },
    );

    await expect(POST(request)).resolves.toMatchObject({ status: 200 });
    expect(rateLimitMock).not.toHaveBeenCalled();
    expect(handlerMock).toHaveBeenCalledWith(request);
  });
});
