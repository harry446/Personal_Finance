import { randomUUID } from 'node:crypto';

import { TransactionSource, TransactionType } from '@/generated/prisma/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { bootstrapDefaultCategories } from '@/lib/bootstrap';
import { db } from '@/lib/db';
import {
  ArchivedCategoryError,
  archiveCategoryForUser,
  CategoryNameConflictError,
  createCategoryForUser,
  createManualTransactionForUser,
  deleteTransactionForUser,
  listCategoriesForUser,
  listRecentTransactionsForUser,
  OwnedRecordNotFoundError,
  renameCategoryForUser,
  restoreCategoryForUser,
  updateManualTransactionForUser,
} from '@/lib/ledger';

const createdUserIds: string[] = [];

async function createUser(label: string) {
  const user = await db.user.create({
    data: {
      email: `m2-integration-${label}-${randomUUID()}@example.test`,
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

const expense = (categoryId: string) => ({
  amount: '24.50',
  categoryId,
  description: 'Corner store',
  notes: 'Receipt saved',
  transactionDate: '2026-08-30',
  type: 'expense' as const,
});

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

describe('M2 owned manual ledger', () => {
  it('archives categories and reactivates a normalized-name match without duplicating history', async () => {
    const user = await createUser('category-lifecycle');
    const groceries = await categoryFor(user.id, 'groceries');
    const savedTransaction = await createManualTransactionForUser(
      user.id,
      expense(groceries.id),
    );

    await archiveCategoryForUser(user.id, groceries.id);
    const directlyRestored = await restoreCategoryForUser(
      user.id,
      groceries.id,
    );
    expect(directlyRestored.archivedAt).toBeNull();
    await archiveCategoryForUser(user.id, groceries.id);
    expect(await listCategoriesForUser(user.id)).not.toContainEqual(
      expect.objectContaining({ id: groceries.id }),
    );

    await expect(
      createManualTransactionForUser(user.id, expense(groceries.id)),
    ).rejects.toBeInstanceOf(ArchivedCategoryError);

    const reactivated = await createCategoryForUser(user.id, '  GROCERIES ');

    expect(reactivated).toMatchObject({
      reactivated: true,
      category: { id: groceries.id, archivedAt: null, name: 'GROCERIES' },
    });
    await expect(
      createCategoryForUser(user.id, 'groceries'),
    ).rejects.toBeInstanceOf(CategoryNameConflictError);

    const renamed = await renameCategoryForUser(user.id, groceries.id, 'Food');
    expect(renamed).toMatchObject({ name: 'Food', normalizedName: 'food' });
    await expect(listCategoriesForUser(user.id)).resolves.toContainEqual(
      expect.objectContaining({ id: groceries.id, name: 'Food' }),
    );

    const history = await listRecentTransactionsForUser(user.id);
    expect(history).toContainEqual(
      expect.objectContaining({
        id: savedTransaction.id,
        category: expect.objectContaining({ name: 'Food' }),
      }),
    );
  });

  it('creates, updates, lists, and hard-deletes manual expenses and refunds', async () => {
    const user = await createUser('transaction-crud');
    const groceries = await categoryFor(user.id, 'groceries');
    const refund = await createManualTransactionForUser(user.id, {
      ...expense(groceries.id),
      amount: '4.25',
      description: 'Returned item',
      notes: '',
      transactionDate: '2026-07-31',
      type: 'refund',
    });

    expect(refund).toMatchObject({
      amountCents: 425,
      description: 'Returned item',
      notes: null,
      source: TransactionSource.MANUAL,
      type: TransactionType.REFUND,
      userId: user.id,
    });

    const updated = await updateManualTransactionForUser(user.id, refund.id, {
      ...expense(groceries.id),
      amount: '19.99',
      transactionDate: '2026-08-01',
    });

    expect(updated).toMatchObject({
      amountCents: 1_999,
      transactionDate: new Date('2026-08-01T00:00:00.000Z'),
      type: TransactionType.EXPENSE,
    });
    expect(await listRecentTransactionsForUser(user.id)).toContainEqual(
      expect.objectContaining({ id: refund.id, categoryId: groceries.id }),
    );

    await deleteTransactionForUser(user.id, refund.id);
    await expect(
      db.transaction.findUnique({ where: { id: refund.id } }),
    ).resolves.toBeNull();
  });

  it('enforces category and transaction ownership for both users', async () => {
    const owner = await createUser('owner');
    const otherUser = await createUser('other');
    const ownerCategory = await categoryFor(owner.id, 'groceries');
    const foreignCategory = await categoryFor(otherUser.id, 'groceries');
    const ownerTransaction = await createManualTransactionForUser(
      owner.id,
      expense(ownerCategory.id),
    );
    const otherTransaction = await createManualTransactionForUser(
      otherUser.id,
      expense(foreignCategory.id),
    );

    const ownerLedger = await listRecentTransactionsForUser(owner.id);
    const otherUserLedger = await listRecentTransactionsForUser(otherUser.id);

    expect(ownerLedger.map((transaction) => transaction.id)).toContain(
      ownerTransaction.id,
    );
    expect(ownerLedger.map((transaction) => transaction.id)).not.toContain(
      otherTransaction.id,
    );
    expect(otherUserLedger.map((transaction) => transaction.id)).toContain(
      otherTransaction.id,
    );
    expect(otherUserLedger.map((transaction) => transaction.id)).not.toContain(
      ownerTransaction.id,
    );

    await expect(
      createManualTransactionForUser(owner.id, expense(foreignCategory.id)),
    ).rejects.toBeInstanceOf(OwnedRecordNotFoundError);
    await expect(
      updateManualTransactionForUser(otherUser.id, ownerTransaction.id, {
        ...expense(foreignCategory.id),
        amount: '9.00',
      }),
    ).rejects.toBeInstanceOf(OwnedRecordNotFoundError);
    await expect(
      deleteTransactionForUser(otherUser.id, ownerTransaction.id),
    ).rejects.toBeInstanceOf(OwnedRecordNotFoundError);
    await expect(
      renameCategoryForUser(otherUser.id, ownerCategory.id, 'Food'),
    ).rejects.toBeInstanceOf(OwnedRecordNotFoundError);
  });

  it('keeps the database positive-cents constraint in addition to form validation', async () => {
    const user = await createUser('positive-cents');
    const groceries = await categoryFor(user.id, 'groceries');

    await expect(
      db.transaction.create({
        data: {
          amountCents: 0,
          categoryId: groceries.id,
          description: 'Invalid direct write',
          transactionDate: new Date('2026-08-30T00:00:00.000Z'),
          type: TransactionType.EXPENSE,
          userId: user.id,
        },
      }),
    ).rejects.toThrow();
  });
});
