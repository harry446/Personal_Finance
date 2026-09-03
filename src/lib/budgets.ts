import 'server-only';

import { BudgetMode, TransactionType } from '@/generated/prisma/client';
import {
  buildBudgetProgress,
  getApplicableBudgetConfiguration,
  type BudgetDashboard,
  type BudgetCalculationMode,
  type BudgetConfigurationForCalculation,
} from '@/lib/budget-calculations';
import {
  parseBudgetConfigurationInput,
  type BudgetConfigurationInput,
} from '@/lib/budget-validation';
import {
  parseDashboardMonth,
  type DashboardMonth,
} from '@/lib/dashboard-calculations';
import { db } from '@/lib/db';
import { OwnedRecordNotFoundError } from '@/lib/ledger';

export class BudgetCategoryUnavailableError extends Error {
  constructor() {
    super('Archived categories cannot be configured for a budget.');
    this.name = 'BudgetCategoryUnavailableError';
  }
}

export type BudgetSetup = {
  budgetModeEnabled: boolean;
  currentMonth: string;
  progress: BudgetDashboard['progress'];
  categories: Array<{
    categoryId: string;
    configuration: {
      amountCents: number;
      effectiveMonth: string;
      mode: BudgetCalculationMode;
    } | null;
    name: string;
  }>;
};

export async function setBudgetModeForUser(userId: string, enabled: boolean) {
  return db.user.update({
    where: { id: userId },
    data: { budgetModeEnabled: enabled },
    select: { budgetModeEnabled: true },
  });
}

export async function upsertCurrentBudgetConfigurationForUser(
  userId: string,
  values: unknown,
  now = new Date(),
) {
  const input = parseBudgetConfigurationInput(values);
  const currentMonth = parseDashboardMonth(undefined, now);

  return db.$transaction(async (transaction) => {
    const category = await transaction.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { archivedAt: true, id: true },
    });

    if (!category) {
      throw new OwnedRecordNotFoundError('category');
    }

    if (category.archivedAt) {
      throw new BudgetCategoryUnavailableError();
    }

    const budget = await transaction.budget.upsert({
      where: {
        userId_categoryId: {
          categoryId: category.id,
          userId,
        },
      },
      create: {
        categoryId: category.id,
        userId,
      },
      update: {},
      select: { id: true },
    });

    return transaction.budgetConfiguration.upsert({
      where: {
        budgetId_effectiveMonth: {
          budgetId: budget.id,
          effectiveMonth: currentMonth.start,
        },
      },
      create: budgetConfigurationData(budget.id, currentMonth, input),
      update: {
        amountCents: input.amountCents,
        mode: toPrismaBudgetMode(input.mode),
      },
    });
  });
}

export async function getBudgetSetupForUser(
  userId: string,
  now = new Date(),
): Promise<BudgetSetup> {
  const currentMonth = parseDashboardMonth(undefined, now);
  const [user, categories] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { budgetModeEnabled: true },
    }),
    db.category.findMany({
      where: { archivedAt: null, userId },
      select: {
        id: true,
        name: true,
        budgets: {
          select: {
            id: true,
            configurations: {
              where: { effectiveMonth: { lt: currentMonth.endExclusive } },
              select: {
                amountCents: true,
                effectiveMonth: true,
                mode: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const budgetModeEnabled = user?.budgetModeEnabled ?? false;
  const budgetCategories = categories.flatMap((category) =>
    category.budgets.map((budget) => ({
      budgetId: budget.id,
      categoryId: category.id,
      categoryName: category.name,
      configurations: budget.configurations.map(toCalculationConfiguration),
    })),
  );
  const categoryIds = budgetCategories.map((budget) => budget.categoryId);
  const transactions =
    budgetModeEnabled && categoryIds.length > 0
      ? await db.transaction.findMany({
          where: {
            categoryId: { in: categoryIds },
            transactionDate: { lt: currentMonth.endExclusive },
            userId,
          },
          select: {
            amountCents: true,
            categoryId: true,
            transactionDate: true,
            type: true,
          },
        })
      : [];

  return {
    budgetModeEnabled,
    currentMonth: currentMonth.key,
    progress: budgetModeEnabled
      ? buildBudgetProgress(
          currentMonth,
          budgetCategories,
          transactions.map((transaction) => ({
            amountCents: transaction.amountCents,
            categoryId: transaction.categoryId,
            transactionDate: transaction.transactionDate,
            type:
              transaction.type === TransactionType.EXPENSE
                ? 'expense'
                : 'refund',
          })),
        )
      : [],
    categories: categories.map((category) => {
      const configurations =
        category.budgets[0]?.configurations.map(toCalculationConfiguration) ??
        [];
      const configuration = getApplicableBudgetConfiguration(
        configurations,
        currentMonth.key,
      );

      return {
        categoryId: category.id,
        configuration: configuration
          ? {
              amountCents: configuration.amountCents,
              effectiveMonth: configuration.effectiveMonth
                .toISOString()
                .slice(0, 7),
              mode: configuration.mode,
            }
          : null,
        name: category.name,
      };
    }),
  };
}

export async function getBudgetDashboardForMonth(
  userId: string,
  month: DashboardMonth,
): Promise<BudgetDashboard> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { budgetModeEnabled: true },
  });

  if (!user?.budgetModeEnabled) {
    return { enabled: false, progress: [] };
  }

  const budgets = await db.budget.findMany({
    where: {
      category: { archivedAt: null },
      userId,
    },
    select: {
      category: {
        select: { id: true, name: true },
      },
      configurations: {
        where: { effectiveMonth: { lt: month.endExclusive } },
        select: {
          amountCents: true,
          effectiveMonth: true,
          mode: true,
        },
      },
      id: true,
    },
  });
  const categoryIds = budgets.map((budget) => budget.category.id);

  if (categoryIds.length === 0) {
    return { enabled: true, progress: [] };
  }

  const transactions = await db.transaction.findMany({
    where: {
      categoryId: { in: categoryIds },
      transactionDate: { lt: month.endExclusive },
      userId,
    },
    select: {
      amountCents: true,
      categoryId: true,
      transactionDate: true,
      type: true,
    },
  });

  return {
    enabled: true,
    progress: buildBudgetProgress(
      month,
      budgets.map((budget) => ({
        budgetId: budget.id,
        categoryId: budget.category.id,
        categoryName: budget.category.name,
        configurations: budget.configurations.map(toCalculationConfiguration),
      })),
      transactions.map((transaction) => ({
        amountCents: transaction.amountCents,
        categoryId: transaction.categoryId,
        transactionDate: transaction.transactionDate,
        type:
          transaction.type === TransactionType.EXPENSE ? 'expense' : 'refund',
      })),
    ),
  };
}

function budgetConfigurationData(
  budgetId: string,
  month: DashboardMonth,
  input: BudgetConfigurationInput,
) {
  return {
    amountCents: input.amountCents,
    budgetId,
    effectiveMonth: month.start,
    mode: toPrismaBudgetMode(input.mode),
  };
}

function toCalculationConfiguration(configuration: {
  amountCents: number;
  effectiveMonth: Date;
  mode: BudgetMode;
}): BudgetConfigurationForCalculation {
  return {
    amountCents: configuration.amountCents,
    effectiveMonth: configuration.effectiveMonth,
    mode:
      configuration.mode === BudgetMode.ROLLOVER ? 'rollover' : 'monthly_reset',
  };
}

function toPrismaBudgetMode(mode: BudgetCalculationMode) {
  return mode === 'rollover' ? BudgetMode.ROLLOVER : BudgetMode.MONTHLY_RESET;
}
