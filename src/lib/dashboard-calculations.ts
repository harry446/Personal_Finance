import { TransactionType } from '@/generated/prisma/client';
import { z } from 'zod';

import type { BudgetDashboard } from '@/lib/budget-calculations';

export const dashboardMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a month in YYYY-MM format.');

export const DASHBOARD_PRESENTATION_TIME_ZONE = 'America/Toronto';

const dashboardMonthFormatter = new Intl.DateTimeFormat('en-CA', {
  month: '2-digit',
  timeZone: DASHBOARD_PRESENTATION_TIME_ZONE,
  year: 'numeric',
});

export type DashboardMonth = {
  endExclusive: Date;
  key: string;
  start: Date;
};

type DashboardTransaction = {
  amountCents: number;
  category: {
    archivedAt: Date | null;
    id: string;
    name: string;
  };
  categoryId: string;
  description: string;
  id: string;
  transactionDate: Date;
  type: TransactionType;
};

export type MonthlyDashboard = {
  categoryTotals: Array<{
    archived: boolean;
    categoryId: string;
    name: string;
    netCents: number;
  }>;
  budget?: BudgetDashboard;
  dailyTrend: Array<{
    date: string;
    expenseCents: number;
    netCents: number;
    refundCents: number;
  }>;
  expenseTransactionCount: number;
  grossExpensesCents: number;
  hasTransactions: boolean;
  month: DashboardMonth;
  netSpendingCents: number;
  refundTransactionCount: number;
  recentTransactions: Array<{
    amountCents: number;
    categoryName: string;
    description: string;
    id: string;
    transactionDate: string;
    type: 'expense' | 'refund';
  }>;
  refundsCents: number;
};

export function currentDashboardMonth(now = new Date()) {
  const parts = dashboardMonthFormatter.formatToParts(now);
  const month = parts.find((part) => part.type === 'month')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;

  if (!month || !year) {
    throw new Error('Could not determine the dashboard month.');
  }

  return `${year}-${month}`;
}

export function parseDashboardMonth(
  value: unknown,
  now = new Date(),
): DashboardMonth {
  const key =
    value === undefined
      ? currentDashboardMonth(now)
      : dashboardMonthSchema.parse(value);
  const [yearText, monthText] = key.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));

  return {
    endExclusive: new Date(Date.UTC(year, monthIndex + 1, 1)),
    key,
    start,
  };
}

export function buildMonthlyDashboard(
  month: DashboardMonth,
  transactions: readonly DashboardTransaction[],
): MonthlyDashboard {
  const dailyTotals = new Map<
    string,
    { expenseCents: number; refundCents: number }
  >();
  const categoryTotals = new Map<
    string,
    {
      archived: boolean;
      categoryId: string;
      name: string;
      netCents: number;
    }
  >();
  const transactionsInMonth = transactions.filter((transaction) =>
    isInMonth(transaction.transactionDate, month),
  );
  let expenseTransactionCount = 0;
  let grossExpensesCents = 0;
  let refundTransactionCount = 0;
  let refundsCents = 0;

  for (const transaction of transactionsInMonth) {
    const isExpense = transaction.type === TransactionType.EXPENSE;
    const signedAmount = isExpense
      ? transaction.amountCents
      : -transaction.amountCents;
    const date = dateKey(transaction.transactionDate);
    const daily = dailyTotals.get(date) ?? {
      expenseCents: 0,
      refundCents: 0,
    };
    const category = categoryTotals.get(transaction.categoryId) ?? {
      archived: transaction.category.archivedAt !== null,
      categoryId: transaction.categoryId,
      name: transaction.category.name,
      netCents: 0,
    };

    if (isExpense) {
      expenseTransactionCount += 1;
      grossExpensesCents += transaction.amountCents;
      daily.expenseCents += transaction.amountCents;
    } else {
      refundTransactionCount += 1;
      refundsCents += transaction.amountCents;
      daily.refundCents += transaction.amountCents;
    }

    category.netCents += signedAmount;
    categoryTotals.set(transaction.categoryId, category);
    dailyTotals.set(date, daily);
  }

  return {
    categoryTotals: [...categoryTotals.values()].sort(
      (left, right) =>
        right.netCents - left.netCents || left.name.localeCompare(right.name),
    ),
    dailyTrend: daysInMonth(month).map((date) => {
      const daily = dailyTotals.get(date) ?? {
        expenseCents: 0,
        refundCents: 0,
      };

      return {
        date,
        expenseCents: daily.expenseCents,
        netCents: daily.expenseCents - daily.refundCents,
        refundCents: daily.refundCents,
      };
    }),
    expenseTransactionCount,
    grossExpensesCents,
    hasTransactions: transactionsInMonth.length > 0,
    month,
    netSpendingCents: grossExpensesCents - refundsCents,
    recentTransactions: [...transactionsInMonth]
      .sort(
        (left, right) =>
          right.transactionDate.getTime() - left.transactionDate.getTime() ||
          right.id.localeCompare(left.id),
      )
      .slice(0, 8)
      .map((transaction) => ({
        amountCents: transaction.amountCents,
        categoryName: transaction.category.name,
        description: transaction.description,
        id: transaction.id,
        transactionDate: dateKey(transaction.transactionDate),
        type:
          transaction.type === TransactionType.EXPENSE ? 'expense' : 'refund',
      })),
    refundTransactionCount,
    refundsCents,
  };
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function daysInMonth(month: DashboardMonth) {
  const days = [] as string[];

  for (
    let cursor = new Date(month.start);
    cursor < month.endExclusive;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1_000)
  ) {
    days.push(dateKey(cursor));
  }

  return days;
}

function isInMonth(value: Date, month: DashboardMonth) {
  return value >= month.start && value < month.endExclusive;
}
