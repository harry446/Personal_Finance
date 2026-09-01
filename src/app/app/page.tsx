import { z } from 'zod';

import {
  DashboardInvalidMonthState,
  DashboardWorkspace,
} from '@/components/dashboard-workspace';
import type { MonthlyDashboard } from '@/lib/dashboard-calculations';
import { requireCurrentUser } from '@/lib/current-user';
import { getMonthlyDashboardForUser } from '@/lib/dashboard';

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const user = await requireCurrentUser();
  const { month } = await searchParams;
  let dashboard: MonthlyDashboard | null = null;
  let hasInvalidMonth = false;

  try {
    dashboard = await getMonthlyDashboardForUser(user.id, month);
  } catch (error) {
    if (error instanceof z.ZodError) {
      hasInvalidMonth = true;
    } else {
      throw error;
    }
  }

  if (hasInvalidMonth) {
    return (
      <DashboardInvalidMonthState
        value={typeof month === 'string' ? month : ''}
      />
    );
  }

  if (!dashboard) {
    throw new Error('Dashboard data was unavailable.');
  }

  return <DashboardWorkspace dashboard={dashboard} />;
}
