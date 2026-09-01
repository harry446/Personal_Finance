import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, dashboardMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  dashboardMock: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/dashboard', () => ({
  getMonthlyDashboardForUser: dashboardMock,
}));

import { GET } from '@/app/api/dashboard/route';

describe('dashboard route', () => {
  beforeEach(() => {
    authMock.mockReset();
    dashboardMock.mockReset();
  });

  it('derives the user from the session before loading a validated month', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    dashboardMock.mockResolvedValue({ month: { key: '2026-08' } });

    const response = await GET(
      new Request('http://localhost/api/dashboard?month=2026-08'),
    );

    expect(response.status).toBe(200);
    expect(dashboardMock).toHaveBeenCalledWith('user-1', '2026-08');
    await expect(response.json()).resolves.toEqual({
      month: { key: '2026-08' },
    });
  });

  it('returns a safe authentication error without accepting a browser user id', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/dashboard?userId=other-user'),
    );

    expect(response.status).toBe(401);
    expect(dashboardMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication is required.',
    });
  });

  it('reports invalid month input without leaking implementation details', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    dashboardMock.mockRejectedValue(new z.ZodError([]));

    const response = await GET(
      new Request('http://localhost/api/dashboard?month=invalid'),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Choose a month in YYYY-MM format.',
    });
  });
});
