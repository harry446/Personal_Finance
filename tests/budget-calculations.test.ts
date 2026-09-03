import { describe, expect, it } from 'vitest';

import {
  buildBudgetProgress,
  getApplicableBudgetConfiguration,
} from '@/lib/budget-calculations';
import { parseDashboardMonth } from '@/lib/dashboard-calculations';

const budget = {
  budgetId: 'budget-travel',
  categoryId: 'travel',
  categoryName: 'Travel',
};

function configuration(
  effectiveMonth: string,
  amountCents: number,
  mode: 'monthly_reset' | 'rollover',
) {
  return {
    amountCents,
    effectiveMonth: new Date(effectiveMonth + 'T00:00:00.000Z'),
    mode,
  };
}

function transaction(
  date: string,
  amountCents: number,
  type: 'expense' | 'refund' = 'expense',
) {
  return {
    amountCents,
    categoryId: 'travel',
    transactionDate: new Date(date + 'T00:00:00.000Z'),
    type,
  };
}

function progress(
  month: string,
  configurations: ReturnType<typeof configuration>[],
  transactions: ReturnType<typeof transaction>[] = [],
) {
  return buildBudgetProgress(
    parseDashboardMonth(month),
    [{ ...budget, configurations }],
    transactions,
  )[0];
}

describe('budget calculations', () => {
  it('selects the latest configuration at or before the selected month without rewriting earlier history', () => {
    const configurations = [
      configuration('2026-01-01', 30_000, 'monthly_reset'),
      configuration('2026-03-01', 45_000, 'rollover'),
    ];

    expect(
      getApplicableBudgetConfiguration(configurations, '2026-02'),
    ).toMatchObject({ amountCents: 30_000, mode: 'monthly_reset' });
    expect(
      getApplicableBudgetConfiguration(configurations, '2026-03'),
    ).toMatchObject({ amountCents: 45_000, mode: 'rollover' });
    expect(configurations[0]).toMatchObject({
      amountCents: 30_000,
      effectiveMonth: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('calculates monthly reset limits from category net spending, including refunds in their own month', () => {
    const result = progress(
      '2026-03',
      [configuration('2026-01-01', 30_000, 'monthly_reset')],
      [
        transaction('2026-03-03', 12_000),
        transaction('2026-03-18', 4_500),
        transaction('2026-03-28', 2_000, 'refund'),
        transaction('2026-02-28', 99_000),
      ],
    );

    expect(result).toMatchObject({
      availableCents: 15_500,
      overageCents: 0,
      rawAvailableCents: 15_500,
      usageCents: 14_500,
    });
  });

  it('carries unused rollover allowance and preserves overage into later months', () => {
    const configurations = [configuration('2026-01-01', 30_000, 'rollover')];

    expect(progress('2026-03', configurations)).toMatchObject({
      availableCents: 90_000,
      rawAvailableCents: 90_000,
      rolloverWindowStartMonth: '2026-01',
    });

    expect(
      progress('2026-03', configurations, [transaction('2026-03-12', 90_000)]),
    ).toMatchObject({
      availableCents: 0,
      overageCents: 0,
      rawAvailableCents: 0,
    });
    expect(
      progress('2026-04', configurations, [transaction('2026-03-12', 90_000)]),
    ).toMatchObject({
      availableCents: 30_000,
      rawAvailableCents: 30_000,
    });

    expect(
      progress('2026-03', configurations, [transaction('2026-03-12', 100_000)]),
    ).toMatchObject({
      availableCents: 0,
      overageCents: 10_000,
      rawAvailableCents: -10_000,
    });
    expect(
      progress('2026-04', configurations, [transaction('2026-03-12', 100_000)]),
    ).toMatchObject({
      availableCents: 20_000,
      overageCents: 0,
      rawAvailableCents: 20_000,
    });
  });

  it('begins a new rollover window after the latest monthly-reset configuration', () => {
    const result = progress(
      '2026-04',
      [
        configuration('2026-01-01', 30_000, 'rollover'),
        configuration('2026-03-01', 20_000, 'monthly_reset'),
        configuration('2026-04-01', 50_000, 'rollover'),
      ],
      [
        transaction('2026-01-04', 5_000),
        transaction('2026-03-04', 20_000),
        transaction('2026-04-04', 10_000),
      ],
    );

    expect(result).toMatchObject({
      availableCents: 40_000,
      rawAvailableCents: 40_000,
      rolloverWindowStartMonth: '2026-04',
      usageCents: 10_000,
    });
  });

  it('adds a refund to rollover availability in the refund month', () => {
    const result = progress(
      '2026-02',
      [configuration('2026-01-01', 30_000, 'rollover')],
      [
        transaction('2026-01-10', 50_000),
        transaction('2026-02-05', 7_500, 'refund'),
      ],
    );

    expect(result).toMatchObject({
      rawAvailableCents: 17_500,
      usageCents: -7_500,
    });
  });
});
