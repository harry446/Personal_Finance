import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, describe, expect, it } from 'vitest';

import {
  CandidateReviewState,
  ImportBatchStatus,
  TransactionType,
} from '@/generated/prisma/client';
import { bootstrapDefaultCategories } from '@/lib/bootstrap';
import {
  getBudgetSetupForUser,
  setBudgetModeForUser,
  upsertCurrentBudgetConfigurationForUser,
} from '@/lib/budgets';
import { getMonthlyDashboardForUser } from '@/lib/dashboard';
import { db } from '@/lib/db';
import {
  approveImportBatchForUser,
  getImportBatchForUser,
  listImportBatchesForUser,
  listReviewBatchesForUser,
  setCandidateReviewStateForUser,
  updateCandidateForUser,
} from '@/lib/import-review';
import {
  archiveCategoryForUser,
  createManualTransactionForUser,
  deleteTransactionForUser,
  listCategoriesForUser,
  listRecentTransactionsForUser,
  renameCategoryForUser,
  restoreCategoryForUser,
  updateManualTransactionForUser,
} from '@/lib/ledger';

const createdUserIds: string[] = [];

async function createUser(label: string) {
  const user = await db.user.create({
    data: {
      email: 'm7-' + label + '-' + randomUUID() + '@example.test',
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

async function readyBatch(userId: string, categoryId: string, label: string) {
  const batch = await db.importBatch.create({
    data: {
      candidateCount: 1,
      fileCount: 1,
      model: 'm7-matrix',
      status: ImportBatchStatus.READY_FOR_REVIEW,
      userId,
    },
  });
  const candidate = await db.candidateTransaction.create({
    data: {
      amountCents: 1250,
      categoryId,
      description: label + ' candidate',
      importBatchId: batch.id,
      ordinal: 1,
      reviewState: CandidateReviewState.PENDING,
      transactionDate: new Date('2026-09-05T00:00:00.000Z'),
      type: TransactionType.EXPENSE,
    },
  });
  return { batch, candidate };
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

describe('M7 authorization matrix', () => {
  it('returns only the authenticated owner records across direct and collection reads', async () => {
    const owner = await createUser('owner-read');
    const other = await createUser('other-read');
    const ownerCategory = await categoryFor(owner.id, 'groceries');
    const otherCategory = await categoryFor(other.id, 'groceries');

    await createManualTransactionForUser(owner.id, {
      amount: '12.50',
      categoryId: ownerCategory.id,
      description: 'Owner only transaction',
      notes: '',
      transactionDate: '2026-09-05',
      type: 'expense',
    });
    await createManualTransactionForUser(other.id, {
      amount: '9.00',
      categoryId: otherCategory.id,
      description: 'Other only transaction',
      notes: '',
      transactionDate: '2026-09-05',
      type: 'expense',
    });
    const ownerImport = await readyBatch(owner.id, ownerCategory.id, 'owner');
    await readyBatch(other.id, otherCategory.id, 'other');

    const [
      categories,
      transactions,
      dashboard,
      setup,
      batches,
      reviewBatches,
      batch,
    ] = await Promise.all([
      listCategoriesForUser(owner.id),
      listRecentTransactionsForUser(owner.id),
      getMonthlyDashboardForUser(owner.id, '2026-09'),
      getBudgetSetupForUser(owner.id, new Date('2026-09-07T12:00:00.000Z')),
      listImportBatchesForUser(owner.id),
      listReviewBatchesForUser(owner.id),
      getImportBatchForUser(owner.id, ownerImport.batch.id),
    ]);

    expect(categories).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: owner.id })]),
    );
    expect(categories.every((category) => category.userId === owner.id)).toBe(
      true,
    );
    expect(
      transactions.map((transaction) => transaction.description),
    ).toContain('Owner only transaction');
    expect(
      transactions.map((transaction) => transaction.description),
    ).not.toContain('Other only transaction');
    expect(
      dashboard.recentTransactions.map(
        (transaction) => transaction.description,
      ),
    ).toEqual(['Owner only transaction']);
    expect(setup.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categoryId: ownerCategory.id }),
      ]),
    );
    expect(setup.categories).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categoryId: otherCategory.id }),
      ]),
    );
    expect(batches.map((candidateBatch) => candidateBatch.userId)).toEqual([
      owner.id,
    ]);
    expect(
      reviewBatches.map((candidateBatch) => candidateBatch.userId),
    ).toEqual([owner.id]);
    expect(batch.userId).toBe(owner.id);
  });

  it('rejects foreign direct IDs and foreign nested candidate/category paths', async () => {
    const owner = await createUser('owner-write');
    const other = await createUser('other-write');
    const ownerCategory = await categoryFor(owner.id, 'groceries');
    const otherCategory = await categoryFor(other.id, 'groceries');
    const ownerTransaction = await createManualTransactionForUser(owner.id, {
      amount: '20.00',
      categoryId: ownerCategory.id,
      description: 'Owner transaction',
      notes: '',
      transactionDate: '2026-09-05',
      type: 'expense',
    });
    const otherTransaction = await createManualTransactionForUser(other.id, {
      amount: '20.00',
      categoryId: otherCategory.id,
      description: 'Other transaction',
      notes: '',
      transactionDate: '2026-09-05',
      type: 'expense',
    });
    const ownerImport = await readyBatch(owner.id, ownerCategory.id, 'owner');
    const otherImport = await readyBatch(other.id, otherCategory.id, 'other');

    await expect(
      renameCategoryForUser(owner.id, otherCategory.id, 'Foreign'),
    ).rejects.toThrow();
    await expect(
      archiveCategoryForUser(owner.id, otherCategory.id),
    ).rejects.toThrow();
    await expect(
      restoreCategoryForUser(owner.id, otherCategory.id),
    ).rejects.toThrow();
    await expect(
      createManualTransactionForUser(owner.id, {
        amount: '1.00',
        categoryId: otherCategory.id,
        description: 'Foreign category attempt',
        notes: '',
        transactionDate: '2026-09-05',
        type: 'expense',
      }),
    ).rejects.toThrow();
    await expect(
      updateManualTransactionForUser(owner.id, otherTransaction.id, {
        amount: '21.00',
        categoryId: ownerCategory.id,
        description: 'Foreign transaction attempt',
        notes: '',
        transactionDate: '2026-09-05',
        type: 'expense',
      }),
    ).rejects.toThrow();
    await expect(
      deleteTransactionForUser(owner.id, otherTransaction.id),
    ).rejects.toThrow();
    await expect(
      upsertCurrentBudgetConfigurationForUser(
        owner.id,
        {
          amount: '100',
          categoryId: otherCategory.id,
          mode: 'monthly_reset',
        },
        new Date('2026-09-07T12:00:00.000Z'),
      ),
    ).rejects.toThrow();
    await expect(
      getImportBatchForUser(owner.id, otherImport.batch.id),
    ).rejects.toThrow();
    await expect(
      updateCandidateForUser(owner.id, otherImport.candidate.id, {
        amount: '12.50',
        categoryId: ownerCategory.id,
        description: 'Foreign nested candidate',
        notes: '',
        transactionDate: '2026-09-05',
        type: 'expense',
      }),
    ).rejects.toThrow();
    await expect(
      setCandidateReviewStateForUser(
        owner.id,
        otherImport.candidate.id,
        'selected',
      ),
    ).rejects.toThrow();
    await expect(
      approveImportBatchForUser(owner.id, otherImport.batch.id),
    ).rejects.toThrow();

    await expect(
      updateCandidateForUser(owner.id, ownerImport.candidate.id, {
        amount: '12.50',
        categoryId: ownerCategory.id,
        description: 'Owner nested candidate',
        notes: '',
        transactionDate: '2026-09-05',
        type: 'expense',
      }),
    ).resolves.toMatchObject({ id: ownerImport.candidate.id });
    await expect(
      setCandidateReviewStateForUser(
        owner.id,
        ownerImport.candidate.id,
        'selected',
      ),
    ).resolves.toMatchObject({ reviewState: CandidateReviewState.SELECTED });
    await expect(
      approveImportBatchForUser(owner.id, ownerImport.batch.id),
    ).resolves.toMatchObject({
      savedTransactions: [expect.objectContaining({ userId: owner.id })],
    });

    await setBudgetModeForUser(owner.id, true);
    expect(
      await db.user.findUniqueOrThrow({
        where: { id: owner.id },
        select: { budgetModeEnabled: true },
      }),
    ).toEqual({ budgetModeEnabled: true });
    expect(
      await db.user.findUniqueOrThrow({
        where: { id: other.id },
        select: { budgetModeEnabled: true },
      }),
    ).toEqual({ budgetModeEnabled: false });
    await expect(
      updateManualTransactionForUser(owner.id, ownerTransaction.id, {
        amount: '21.00',
        categoryId: ownerCategory.id,
        description: 'Owner transaction updated',
        notes: '',
        transactionDate: '2026-09-05',
        type: 'expense',
      }),
    ).resolves.toMatchObject({ id: ownerTransaction.id, userId: owner.id });
  });
});
