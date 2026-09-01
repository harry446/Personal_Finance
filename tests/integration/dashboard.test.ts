import { randomUUID } from 'node:crypto';

import { TransactionType } from '@/generated/prisma/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { bootstrapDefaultCategories } from '@/lib/bootstrap';
import { getMonthlyDashboardForUser } from '@/lib/dashboard';
import { db } from '@/lib/db';
import {
  archiveCategoryForUser,
  createManualTransactionForUser,
  deleteTransactionForUser,
  updateManualTransactionForUser,
} from '@/lib/ledger';

const createdUserIds: string[] = [];

async function createUser(label: string) {
  const user = await db.user.create({
    data: {
      email: `m3-dashboard-${label}-${randomUUID()}@example.test`,
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
    where: { userId, normalizedName },
  });
}

function expense(
  categoryId: string,
  transactionDate: string,
  amount = '24.50',
) {
  return {
    amount,
    categoryId,
    description: 'M3 ledger entry',
    notes: '',
    transactionDate,
    type: 'expense' as const,
  };
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

describe('M3 monthly dashboard', () => {
  it('uses transaction dates for aggregates and retains archived category history', async () => {
    const user = await createUser('aggregate');
    const groceries = await categoryFor(user.id, 'groceries');
    const restaurants = await categoryFor(user.id, 'restaurants');

    await createManualTransactionForUser(
      user.id,
      expense(groceries.id, '2026-08-02', '100.00'),
    );
    await createManualTransactionForUser(user.id, {
      ...expense(groceries.id, '2026-08-03', '25.00'),
      type: 'refund',
    });
    await createManualTransactionForUser(
      user.id,
      expense(restaurants.id, '2026-08-03', '40.00'),
    );
    await createManualTransactionForUser(
      user.id,
      expense(groceries.id, '2026-07-31', '99.00'),
    );
    await archiveCategoryForUser(user.id, groceries.id);

    const dashboard = await getMonthlyDashboardForUser(user.id, '2026-08');

    expect(dashboard).toMatchObject({
      grossExpensesCents: 14_000,
      netSpendingCents: 11_500,
      refundsCents: 2_500,
    });
    expect(dashboard.categoryTotals).toEqual([
      expect.objectContaining({
        archived: true,
        categoryId: groceries.id,
        netCents: 7_500,
      }),
      expect.objectContaining({
        categoryId: restaurants.id,
        netCents: 4_000,
      }),
    ]);
    expect(
      dashboard.dailyTrend.find((day) => day.date === '2026-08-03'),
    ).toMatchObject({
      expenseCents: 4_000,
      netCents: 1_500,
      refundCents: 2_500,
    });
    expect(dashboard.recentTransactions).toHaveLength(3);
    expect(
      dashboard.recentTransactions.every(
        (transaction) => transaction.transactionDate.slice(0, 7) === '2026-08',
      ),
    ).toBe(true);
  });

  it('reconciles edits and deletes by month while isolating dashboard rows per user', async () => {
    const owner = await createUser('owner');
    const otherUser = await createUser('other');
    const ownerCategory = await categoryFor(owner.id, 'groceries');
    const otherCategory = await categoryFor(otherUser.id, 'groceries');
    const ownerTransaction = await createManualTransactionForUser(
      owner.id,
      expense(ownerCategory.id, '2026-08-12', '24.50'),
    );
    await createManualTransactionForUser(
      otherUser.id,
      expense(otherCategory.id, '2026-08-12', '25.00'),
    );

    expect(
      (await getMonthlyDashboardForUser(owner.id, '2026-08')).netSpendingCents,
    ).toBe(2_450);
    expect(
      (await getMonthlyDashboardForUser(otherUser.id, '2026-08'))
        .netSpendingCents,
    ).toBe(2_500);

    const movedTransaction = await updateManualTransactionForUser(
      owner.id,
      ownerTransaction.id,
      expense(ownerCategory.id, '2026-07-12', '9.00'),
    );
    expect(movedTransaction.type).toBe(TransactionType.EXPENSE);
    expect(
      (await getMonthlyDashboardForUser(owner.id, '2026-08')).netSpendingCents,
    ).toBe(0);
    expect(
      (await getMonthlyDashboardForUser(owner.id, '2026-07')).netSpendingCents,
    ).toBe(900);

    await deleteTransactionForUser(owner.id, ownerTransaction.id);
    expect(
      (await getMonthlyDashboardForUser(owner.id, '2026-07')).netSpendingCents,
    ).toBe(0);
    expect(
      (
        await getMonthlyDashboardForUser(otherUser.id, '2026-08')
      ).recentTransactions.map((transaction) => transaction.id),
    ).not.toContain(ownerTransaction.id);
  });
});
