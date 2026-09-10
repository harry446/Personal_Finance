import { db } from '@/lib/db';
import { logOperationalEvent } from '@/lib/observability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const responseHeaders = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    await db.$queryRawUnsafe('SELECT 1');

    return Response.json({ status: 'ok' }, { headers: responseHeaders });
  } catch {
    logOperationalEvent('health_check', {
      outcome: 'unavailable',
      route: '/api/health',
      status: 503,
    });

    return Response.json(
      { status: 'unavailable' },
      { headers: responseHeaders, status: 503 },
    );
  }
}
