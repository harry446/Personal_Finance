import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: authMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import { getSessionUserId, requireCurrentUser } from '@/lib/current-user';

describe('current user guard', () => {
  beforeEach(() => {
    authMock.mockReset();
    redirectMock.mockReset();
    redirectMock.mockImplementation(() => {
      throw new Error('redirected');
    });
  });

  it('accepts only a non-empty typed session user id', () => {
    expect(getSessionUserId({ user: { id: 'user-1' } } as never)).toBe(
      'user-1',
    );
    expect(getSessionUserId(null)).toBeNull();
    expect(getSessionUserId({ user: { id: '' } } as never)).toBeNull();
  });

  it('returns the authenticated user id', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });

    await expect(requireCurrentUser()).resolves.toEqual({ id: 'user-1' });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects an unauthenticated request to the sign-in screen', async () => {
    authMock.mockResolvedValue(null);

    await expect(requireCurrentUser()).rejects.toThrow('redirected');
    expect(redirectMock).toHaveBeenCalledWith('/sign-in');
  });
});
