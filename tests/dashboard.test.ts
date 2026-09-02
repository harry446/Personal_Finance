import { TransactionType } from '@/generated/prisma/client';
import { describe, expect, it } from 'vitest';

import {
  buildMonthlyDashboard,
  currentDashboardMonth,
  parseDashboardMonth,
} from '@/lib/dashboard-calculations';

const groceries = {
  archivedAt: null,
  id: 'category-groceries',
  name: 'Groceries',
};
const restaurants = {
  archivedAt: null,
  id: 'category-restaurants',
  name: 'Restaurants',
};

function transaction(
  id: string,
  date: string,
  amountCents: number,
  type: TransactionType,
  category = groceries,
) {
  return {
    amountCents,
    category,
    categoryId: category.id,
    description: `${category.name} ${id}`,
    id,
    transactionDate: new Date(`${date}T00:00:00.000Z`),
    type,
  };
}

describe('monthly dashboard calculations', () => {
  it('defaults to the current America/Toronto calendar month and validates YYYY-MM input', () => {
    expect(currentDashboardMonth(new Date('2026-09-01T03:59:59.000Z'))).toBe(
      '2026-08',
    );
    expect(
      parseDashboardMonth(undefined, new Date('2026-09-01T04:00:00.000Z')),
    ).toMatchObject({
      key: '2026-09',
      start: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(currentDashboardMonth(new Date('2026-12-01T04:59:59.000Z'))).toBe(
      '2026-11',
    );
    expect(currentDashboardMonth(new Date('2026-12-01T05:00:00.000Z'))).toBe(
      '2026-12',
    );
    expect(() => parseDashboardMonth('2026-13')).toThrow(
      'Choose a month in YYYY-MM format.',
    );
    expect(() => parseDashboardMonth(['2026-08'])).toThrow();
  });

  it('calculates expenses, refunds, net categories, daily trend, and recent records', () => {
    const dashboard = buildMonthlyDashboard(parseDashboardMonth('2026-08'), [
      transaction(
        'grocery-expense',
        '2026-08-02',
        10_000,
        TransactionType.EXPENSE,
      ),
      transaction(
        'grocery-refund',
        '2026-08-03',
        2_000,
        TransactionType.REFUND,
      ),
      transaction(
        'restaurant-expense',
        '2026-08-03',
        5_000,
        TransactionType.EXPENSE,
        restaurants,
      ),
    ]);

    expect(dashboard).toMatchObject({
      expenseTransactionCount: 2,
      grossExpensesCents: 15_000,
      hasTransactions: true,
      netSpendingCents: 13_000,
      refundTransactionCount: 1,
      refundsCents: 2_000,
    });
    expect(dashboard.categoryTotals).toEqual([
      expect.objectContaining({ name: 'Groceries', netCents: 8_000 }),
      expect.objectContaining({ name: 'Restaurants', netCents: 5_000 }),
    ]);
    expect(dashboard.dailyTrend).toHaveLength(31);
    expect(dashboard.dailyTrend[1]).toMatchObject({
      date: '2026-08-02',
      expenseCents: 10_000,
      netCents: 10_000,
      refundCents: 0,
    });
    expect(dashboard.dailyTrend[2]).toMatchObject({
      date: '2026-08-03',
      expenseCents: 5_000,
      netCents: 3_000,
      refundCents: 2_000,
    });
    expect(dashboard.recentTransactions.map((item) => item.id)).toEqual([
      'restaurant-expense',
      'grocery-refund',
      'grocery-expense',
    ]);
  });

  it('uses transaction dates rather than creation timing and excludes other months', () => {
    const dashboard = buildMonthlyDashboard(parseDashboardMonth('2026-08'), [
      transaction('july', '2026-07-31', 10_000, TransactionType.EXPENSE),
      transaction('august', '2026-08-01', 4_500, TransactionType.EXPENSE),
      transaction('september', '2026-09-01', 7_500, TransactionType.EXPENSE),
    ]);

    expect(dashboard.grossExpensesCents).toBe(4_500);
    expect(dashboard.recentTransactions.map((item) => item.id)).toEqual([
      'august',
    ]);
  });
});
