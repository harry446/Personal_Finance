import { z } from 'zod';

import { auth } from '@/auth';
import { getMonthlyDashboardForUser } from '@/lib/dashboard';
import { getSessionUserId } from '@/lib/current-user';

export async function GET(request: Request) {
  const userId = getSessionUserId(await auth());

  if (!userId) {
    return Response.json(
      { error: 'Authentication is required.' },
      { status: 401 },
    );
  }

  try {
    const month = new URL(request.url).searchParams.get('month') ?? undefined;
    const dashboard = await getMonthlyDashboardForUser(userId, month);

    return Response.json(dashboard);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Choose a month in YYYY-MM format.' },
        { status: 400 },
      );
    }

    return Response.json(
      { error: 'Unable to load the dashboard.' },
      { status: 500 },
    );
  }
}
