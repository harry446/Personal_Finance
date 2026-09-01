import 'server-only';

import {
  buildMonthlyDashboard,
  parseDashboardMonth,
  type MonthlyDashboard,
} from '@/lib/dashboard-calculations';
import { db } from '@/lib/db';

export async function getMonthlyDashboardForUser(
  userId: string,
  rawMonth?: unknown,
): Promise<MonthlyDashboard> {
  const month = parseDashboardMonth(rawMonth);
  const transactions = await db.transaction.findMany({
    where: {
      transactionDate: {
        gte: month.start,
        lt: month.endExclusive,
      },
      userId,
    },
    select: {
      amountCents: true,
      category: {
        select: {
          archivedAt: true,
          id: true,
          name: true,
        },
      },
      categoryId: true,
      description: true,
      id: true,
      transactionDate: true,
      type: true,
    },
    orderBy: { transactionDate: 'desc' },
  });

  return buildMonthlyDashboard(month, transactions);
}
