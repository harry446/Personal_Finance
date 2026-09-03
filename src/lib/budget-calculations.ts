import { z } from 'zod';

import type { DashboardMonth } from '@/lib/dashboard-calculations';

export const budgetCalculationModeSchema = z.enum([
  'monthly_reset',
  'rollover',
]);

export type BudgetCalculationMode = z.infer<typeof budgetCalculationModeSchema>;

export type BudgetConfigurationForCalculation = {
  amountCents: number;
  effectiveMonth: Date;
  mode: BudgetCalculationMode;
};

export type BudgetTransactionForCalculation = {
  amountCents: number;
  categoryId: string;
  transactionDate: Date;
  type: 'expense' | 'refund';
};

export type BudgetProgress = {
  availableCents: number;
  budgetId: string;
  categoryId: string;
  categoryName: string;
  configurationEffectiveMonth: string;
  configuredLimitCents: number;
  mode: BudgetCalculationMode;
  overageCents: number;
  rawAvailableCents: number;
  rolloverWindowStartMonth: string | null;
  usageCents: number;
};

export type BudgetDashboard = {
  enabled: boolean;
  progress: BudgetProgress[];
};

type BudgetForCalculation = {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  configurations: readonly BudgetConfigurationForCalculation[];
};

export function getApplicableBudgetConfiguration(
  configurations: readonly BudgetConfigurationForCalculation[],
  monthKey: string,
) {
  return [...configurations]
    .filter(
      (configuration) =>
        monthKeyForDate(configuration.effectiveMonth) <= monthKey,
    )
    .sort(
      (left, right) =>
        right.effectiveMonth.getTime() - left.effectiveMonth.getTime(),
    )[0];
}

export function buildBudgetProgress(
  month: DashboardMonth,
  budgets: readonly BudgetForCalculation[],
  transactions: readonly BudgetTransactionForCalculation[],
): BudgetProgress[] {
  return budgets
    .map((budget) => buildProgressForBudget(month, budget, transactions))
    .filter((progress): progress is BudgetProgress => progress !== null)
    .sort((left, right) => left.categoryName.localeCompare(right.categoryName));
}

function buildProgressForBudget(
  month: DashboardMonth,
  budget: BudgetForCalculation,
  transactions: readonly BudgetTransactionForCalculation[],
) {
  const configuration = getApplicableBudgetConfiguration(
    budget.configurations,
    month.key,
  );

  if (!configuration) {
    return null;
  }

  const usageCents = categoryNetForMonth(
    budget.categoryId,
    month.key,
    transactions,
  );
  const isRollover = configuration.mode === 'rollover';
  const rolloverWindowStartMonth = isRollover
    ? findRolloverWindowStart(month.key, budget.configurations)
    : null;
  const rawAvailableCents = isRollover
    ? calculateRolloverAvailability(
        budget.categoryId,
        month.key,
        rolloverWindowStartMonth ?? month.key,
        budget.configurations,
        transactions,
      )
    : configuration.amountCents - usageCents;

  return {
    availableCents: Math.max(0, rawAvailableCents),
    budgetId: budget.budgetId,
    categoryId: budget.categoryId,
    categoryName: budget.categoryName,
    configurationEffectiveMonth: monthKeyForDate(configuration.effectiveMonth),
    configuredLimitCents: configuration.amountCents,
    mode: configuration.mode,
    overageCents: Math.max(0, -rawAvailableCents),
    rawAvailableCents,
    rolloverWindowStartMonth,
    usageCents,
  };
}

function calculateRolloverAvailability(
  categoryId: string,
  monthKey: string,
  windowStartMonth: string,
  configurations: readonly BudgetConfigurationForCalculation[],
  transactions: readonly BudgetTransactionForCalculation[],
) {
  let allowanceCents = 0;

  for (
    let cursor = windowStartMonth;
    cursor <= monthKey;
    cursor = shiftMonth(cursor, 1)
  ) {
    const configuration = getApplicableBudgetConfiguration(
      configurations,
      cursor,
    );

    if (!configuration || configuration.mode !== 'rollover') {
      throw new Error('A rollover window must use rollover configurations.');
    }

    allowanceCents += configuration.amountCents;
  }

  return (
    allowanceCents -
    categoryNetForRange(categoryId, windowStartMonth, monthKey, transactions)
  );
}

function findRolloverWindowStart(
  monthKey: string,
  configurations: readonly BudgetConfigurationForCalculation[],
) {
  let windowStartMonth = monthKey;

  for (;;) {
    const previousMonth = shiftMonth(windowStartMonth, -1);
    const previousConfiguration = getApplicableBudgetConfiguration(
      configurations,
      previousMonth,
    );

    if (!previousConfiguration || previousConfiguration.mode !== 'rollover') {
      return windowStartMonth;
    }

    windowStartMonth = previousMonth;
  }
}

function categoryNetForMonth(
  categoryId: string,
  monthKey: string,
  transactions: readonly BudgetTransactionForCalculation[],
) {
  return categoryNetForRange(categoryId, monthKey, monthKey, transactions);
}

function categoryNetForRange(
  categoryId: string,
  startMonth: string,
  endMonth: string,
  transactions: readonly BudgetTransactionForCalculation[],
) {
  return transactions.reduce((total, transaction) => {
    const transactionMonth = monthKeyForDate(transaction.transactionDate);

    if (
      transaction.categoryId !== categoryId ||
      transactionMonth < startMonth ||
      transactionMonth > endMonth
    ) {
      return total;
    }

    return (
      total +
      (transaction.type === 'expense'
        ? transaction.amountCents
        : -transaction.amountCents)
    );
  }, 0);
}

function monthKeyForDate(value: Date) {
  return value.toISOString().slice(0, 7);
}

function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));

  return (
    String(shifted.getUTCFullYear()) +
    '-' +
    String(shifted.getUTCMonth() + 1).padStart(2, '0')
  );
}
