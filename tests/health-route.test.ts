import { beforeEach, describe, expect, it, vi } from 'vitest';

const { logMock, queryMock } = vi.hoisted(() => ({
  logMock: vi.fn(),
  queryMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: { $queryRawUnsafe: queryMock },
}));

vi.mock('@/lib/observability', () => ({
  logOperationalEvent: logMock,
}));

import { GET } from '@/app/api/health/route';

describe('health route', () => {
  beforeEach(() => {
    logMock.mockReset();
    queryMock.mockReset();
  });

  it('confirms the service and database without exposing details', async () => {
    queryMock.mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();

    expect(queryMock).toHaveBeenCalledWith('SELECT 1');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(logMock).not.toHaveBeenCalled();
  });

  it('returns a generic unavailable response when the database is unhealthy', async () => {
    queryMock.mockRejectedValue(new Error('database connection details'));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: 'unavailable' });
    expect(logMock).toHaveBeenCalledWith('health_check', {
      outcome: 'unavailable',
      route: '/api/health',
      status: 503,
    });
  });
});
