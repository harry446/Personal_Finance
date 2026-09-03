import 'server-only';

import { getBudgetDashboardForMonth } from '@/lib/budgets';
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
  const transactionsPromise = db.transaction.findMany({
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
  const [transactions, budget] = await Promise.all([
    transactionsPromise,
    getBudgetDashboardForMonth(userId, month),
  ]);

  return { ...buildMonthlyDashboard(month, transactions), budget };
}
