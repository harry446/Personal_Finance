import { randomUUID } from 'node:crypto';

import { BudgetMode } from '@/generated/prisma/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import {
  BudgetCategoryUnavailableError,
  getBudgetDashboardForMonth,
  getBudgetSetupForUser,
  setBudgetModeForUser,
  upsertCurrentBudgetConfigurationForUser,
} from '@/lib/budgets';
import { bootstrapDefaultCategories } from '@/lib/bootstrap';
import { parseDashboardMonth } from '@/lib/dashboard-calculations';
import { db } from '@/lib/db';
import { archiveCategoryForUser, OwnedRecordNotFoundError } from '@/lib/ledger';

const createdUserIds: string[] = [];

async function createUser(label: string) {
  const user = await db.user.create({
    data: {
      email: 'm6-budget-' + label + '-' + randomUUID() + '@example.test',
    },
  });

  createdUserIds.push(user.id);
  await db.$transaction((transaction) =>
    bootstrapDefaultCategories(transaction, user.id),
  );

  return user;
}

async function categoryFor(userId: string, normalizedName: string) {
  return db.category.findFirstOrThrow({
    where: { normalizedName, userId },
  });
}

function asOf(value: string) {
  return new Date(value + 'T12:00:00.000Z');
}

afterEach(async () => {
  await Promise.all(
    createdUserIds
      .splice(0)
      .map((userId) =>
        db.user.delete({ where: { id: userId } }).catch(() => undefined),
      ),
  );
});

afterAll(async () => {
  await db.$disconnect();
});

describe('M6 budget mode and configuration history', () => {
  it('upserts only the current effective month while preserving prior configuration history', async () => {
    const user = await createUser('history');
    const groceries = await categoryFor(user.id, 'groceries');

    await upsertCurrentBudgetConfigurationForUser(
      user.id,
      {
        amount: '300.00',
        categoryId: groceries.id,
        mode: 'rollover',
      },
      asOf('2026-01-15'),
    );
    await upsertCurrentBudgetConfigurationForUser(
      user.id,
      {
        amount: '325.00',
        categoryId: groceries.id,
        mode: 'monthly_reset',
      },
      asOf('2026-01-31'),
    );
    await upsertCurrentBudgetConfigurationForUser(
      user.id,
      {
        amount: '400.00',
        categoryId: groceries.id,
        mode: 'rollover',
      },
      asOf('2026-03-01'),
    );

    const budget = await db.budget.findFirstOrThrow({
      where: { categoryId: groceries.id, userId: user.id },
      include: {
        configurations: {
          orderBy: { effectiveMonth: 'asc' },
        },
      },
    });

    expect(budget.configurations).toHaveLength(2);
    expect(budget.configurations).toEqual([
      expect.objectContaining({
        amountCents: 32_500,
        effectiveMonth: new Date('2026-01-01T00:00:00.000Z'),
        mode: BudgetMode.MONTHLY_RESET,
      }),
      expect.objectContaining({
        amountCents: 40_000,
        effectiveMonth: new Date('2026-03-01T00:00:00.000Z'),
        mode: BudgetMode.ROLLOVER,
      }),
    ]);
    await expect(
      db.budgetConfiguration.create({
        data: {
          amountCents: 0,
          budgetId: budget.id,
          effectiveMonth: new Date('2026-04-01T00:00:00.000Z'),
          mode: BudgetMode.ROLLOVER,
        },
      }),
    ).rejects.toThrow();
  });

  it('keeps budget mode per user and rejects foreign or archived categories', async () => {
    const owner = await createUser('owner');
    const otherUser = await createUser('other');
    const ownerGroceries = await categoryFor(owner.id, 'groceries');
    const foreignGroceries = await categoryFor(otherUser.id, 'groceries');

    expect(
      await getBudgetDashboardForMonth(
        owner.id,
        parseDashboardMonth('2026-03'),
      ),
    ).toEqual({ enabled: false, progress: [] });

    await setBudgetModeForUser(owner.id, true);
    await expect(
      upsertCurrentBudgetConfigurationForUser(
        owner.id,
        {
          amount: '300.00',
          categoryId: foreignGroceries.id,
          mode: 'rollover',
        },
        asOf('2026-03-01'),
      ),
    ).rejects.toBeInstanceOf(OwnedRecordNotFoundError);

    await upsertCurrentBudgetConfigurationForUser(
      owner.id,
      {
        amount: '300.00',
        categoryId: ownerGroceries.id,
        mode: 'rollover',
      },
      asOf('2026-03-01'),
    );

    const configuredSetup = await getBudgetSetupForUser(
      owner.id,
      asOf('2026-03-02'),
    );
    expect(
      configuredSetup.categories.find(
        (category) => category.categoryId === ownerGroceries.id,
      ),
    ).toMatchObject({
      configuration: {
        amountCents: 30_000,
        effectiveMonth: '2026-03',
        mode: 'rollover',
      },
    });
    expect(configuredSetup.progress).toEqual([
      expect.objectContaining({
        availableCents: 30_000,
        categoryId: ownerGroceries.id,
        configuredLimitCents: 30_000,
        usageCents: 0,
      }),
    ]);

    await archiveCategoryForUser(owner.id, ownerGroceries.id);

    await expect(
      upsertCurrentBudgetConfigurationForUser(
        owner.id,
        {
          amount: '350.00',
          categoryId: ownerGroceries.id,
          mode: 'rollover',
        },
        asOf('2026-03-02'),
      ),
    ).rejects.toBeInstanceOf(BudgetCategoryUnavailableError);

    const setup = await getBudgetSetupForUser(owner.id, asOf('2026-03-02'));
    expect(setup.budgetModeEnabled).toBe(true);
    expect(
      setup.categories.map((category) => category.categoryId),
    ).not.toContain(ownerGroceries.id);
    await expect(
      getBudgetDashboardForMonth(owner.id, parseDashboardMonth('2026-03')),
    ).resolves.toEqual({ enabled: true, progress: [] });
  });
});
