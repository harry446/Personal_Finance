import { randomUUID } from 'node:crypto';

import {
  CandidateReviewState,
  ImportBatchStatus,
  TransactionSource,
  TransactionType,
} from '@/generated/prisma/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { bootstrapDefaultCategories } from '@/lib/bootstrap';
import { db } from '@/lib/db';
import {
  approveImportBatchForUser,
  CandidateApprovalError,
  ImportBatchUnavailableError,
  getImportBatchForUser,
  listImportBatchesForUser,
  listReviewBatchesForUser,
  setCandidateReviewStateForUser,
  updateCandidateForUser,
} from '@/lib/import-review';
import { archiveCategoryForUser, OwnedRecordNotFoundError } from '@/lib/ledger';

const createdUserIds: string[] = [];

type CandidateSeed = {
  amountCents: number | null;
  categoryId: string | null;
  description: string | null;
  ordinal: number;
  reviewState: CandidateReviewState;
  transactionDate: Date | null;
  type: TransactionType | null;
};

async function createUser(label: string) {
  const user = await db.user.create({
    data: {
      email: `m4-integration-${label}-${randomUUID()}@example.test`,
    },
  });

  createdUserIds.push(user.id);
  await db.$transaction((transaction) =>
    bootstrapDefaultCategories(transaction, user.id),
  );

  return user;
}

async function groceriesFor(userId: string) {
  return db.category.findFirstOrThrow({
    where: { normalizedName: 'groceries', userId },
  });
}

async function createBatch(userId: string, candidates: CandidateSeed[]) {
  return db.importBatch.create({
    data: {
      candidateCount: candidates.length,
      model: 'pre-seeded-m4-review',
      status: ImportBatchStatus.READY_FOR_REVIEW,
      userId,
      candidates: {
        create: candidates.map((candidate) => ({
          amountCents: candidate.amountCents,
          categoryId: candidate.categoryId,
          description: candidate.description,
          ordinal: candidate.ordinal,
          reviewState: candidate.reviewState,
          transactionDate: candidate.transactionDate,
          type: candidate.type,
        })),
      },
    },
    include: { candidates: { orderBy: { ordinal: 'asc' } } },
  });
}

function selectedCandidate(categoryId: string): CandidateSeed {
  return {
    amountCents: 1_875,
    categoryId,
    description: 'Reviewed market purchase',
    ordinal: 1,
    reviewState: CandidateReviewState.SELECTED,
    transactionDate: new Date('2026-09-02T00:00:00.000Z'),
    type: TransactionType.EXPENSE,
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

describe('M4 import review and approval', () => {
  it('rolls back every selected write when one candidate is invalid', async () => {
    const user = await createUser('atomicity');
    const groceries = await groceriesFor(user.id);
    const batch = await createBatch(user.id, [
      selectedCandidate(groceries.id),
      {
        amountCents: 1_200,
        categoryId: null,
        description: 'Missing category',
        ordinal: 2,
        reviewState: CandidateReviewState.SELECTED,
        transactionDate: new Date('2026-09-03T00:00:00.000Z'),
        type: TransactionType.EXPENSE,
      },
    ]);

    await expect(approveImportBatchForUser(user.id, batch.id)).rejects.toThrow(
      CandidateApprovalError,
    );

    await expect(
      db.transaction.count({ where: { importBatchId: batch.id } }),
    ).resolves.toBe(0);
    await expect(
      db.importBatch.findUniqueOrThrow({ where: { id: batch.id } }),
    ).resolves.toMatchObject({
      approvedCount: 0,
      status: ImportBatchStatus.READY_FOR_REVIEW,
    });
    await expect(
      db.candidateTransaction.findMany({
        where: { importBatchId: batch.id },
        orderBy: { ordinal: 'asc' },
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reviewState: CandidateReviewState.SELECTED,
          savedTransactionId: null,
        }),
      ]),
    );
  });

  it('keeps failed batches in audit history but out of the temporary review queue', async () => {
    const user = await createUser('failed-history');
    const readyBatch = await createBatch(user.id, []);
    const failedBatch = await db.importBatch.create({
      data: {
        failureCode: 'provider_unavailable',
        failureMessageSafe: 'We could not prepare this upload right now.',
        model: 'pre-seeded-m5-failure',
        status: ImportBatchStatus.FAILED,
        userId: user.id,
      },
    });

    expect(
      (await listImportBatchesForUser(user.id)).map((batch) => batch.id),
    ).toEqual(expect.arrayContaining([readyBatch.id, failedBatch.id]));
    expect(
      (await listReviewBatchesForUser(user.id)).map((batch) => batch.id),
    ).toEqual([readyBatch.id]);
  });
  it('finalizes every row: selected rows save and unselected rows are excluded from the review queue', async () => {
    const user = await createUser('exclusion');
    const groceries = await groceriesFor(user.id);
    const batch = await createBatch(user.id, [
      selectedCandidate(groceries.id),
      {
        amountCents: null,
        categoryId: null,
        description: 'Uncertain receipt line',
        ordinal: 2,
        reviewState: CandidateReviewState.PENDING,
        transactionDate: null,
        type: null,
      },
    ]);

    const result = await approveImportBatchForUser(user.id, batch.id);

    expect(result.savedTransactions).toHaveLength(1);
    expect(result.savedTransactions[0]).toMatchObject({
      importBatchId: batch.id,
      source: TransactionSource.IMPORT,
      userId: user.id,
    });
    const history = await getImportBatchForUser(user.id, batch.id);
    expect(history).toMatchObject({
      approvedCount: 1,
      status: ImportBatchStatus.APPROVED,
    });
    expect(history.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ordinal: 1,
          reviewState: CandidateReviewState.APPROVED,
          savedTransactionId: result.savedTransactions[0]?.id,
        }),
        expect.objectContaining({
          ordinal: 2,
          reviewState: CandidateReviewState.EXCLUDED,
          savedTransactionId: null,
        }),
      ]),
    );
    await expect(
      db.transaction.count({
        where: {
          description: 'Uncertain receipt line',
          importBatchId: batch.id,
        },
      }),
    ).resolves.toBe(0);
    expect(
      (await listReviewBatchesForUser(user.id)).map((item) => item.id),
    ).not.toContain(batch.id);
  });

  it('finalizes an all-unselected batch without ledger writes', async () => {
    const user = await createUser('discard-all');
    const batch = await createBatch(user.id, [
      {
        amountCents: null,
        categoryId: null,
        description: 'Uncertain first line',
        ordinal: 1,
        reviewState: CandidateReviewState.PENDING,
        transactionDate: null,
        type: null,
      },
      {
        amountCents: null,
        categoryId: null,
        description: 'Uncertain second line',
        ordinal: 2,
        reviewState: CandidateReviewState.PENDING,
        transactionDate: null,
        type: null,
      },
    ]);

    const result = await approveImportBatchForUser(user.id, batch.id);

    expect(result.savedTransactions).toEqual([]);
    await expect(
      db.transaction.count({ where: { importBatchId: batch.id } }),
    ).resolves.toBe(0);
    const history = await getImportBatchForUser(user.id, batch.id);
    expect(history).toMatchObject({
      approvedCount: 0,
      status: ImportBatchStatus.APPROVED,
    });
    expect(history.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ordinal: 1,
          reviewState: CandidateReviewState.EXCLUDED,
          savedTransactionId: null,
        }),
        expect.objectContaining({
          ordinal: 2,
          reviewState: CandidateReviewState.EXCLUDED,
          savedTransactionId: null,
        }),
      ]),
    );
    expect(
      (await listReviewBatchesForUser(user.id)).map((item) => item.id),
    ).not.toContain(batch.id);
  });
  it('requires ownership through every batch and candidate path', async () => {
    const owner = await createUser('owner');
    const otherUser = await createUser('other');
    const groceries = await groceriesFor(owner.id);
    const batch = await createBatch(owner.id, [
      selectedCandidate(groceries.id),
    ]);
    const candidate = batch.candidates[0]!;

    expect(
      (await listImportBatchesForUser(owner.id)).map((item) => item.id),
    ).toContain(batch.id);
    expect(
      (await listImportBatchesForUser(otherUser.id)).map((item) => item.id),
    ).not.toContain(batch.id);

    await expect(
      getImportBatchForUser(otherUser.id, batch.id),
    ).rejects.toBeInstanceOf(OwnedRecordNotFoundError);
    await expect(
      updateCandidateForUser(otherUser.id, candidate.id, {
        amount: '18.75',
        categoryId: '',
        description: 'Attempted edit',
        notes: '',
        transactionDate: '2026-09-02',
        type: 'expense',
      }),
    ).rejects.toBeInstanceOf(OwnedRecordNotFoundError);
    await expect(
      setCandidateReviewStateForUser(otherUser.id, candidate.id, 'selected'),
    ).rejects.toBeInstanceOf(OwnedRecordNotFoundError);
    await expect(
      approveImportBatchForUser(otherUser.id, batch.id),
    ).rejects.toBeInstanceOf(OwnedRecordNotFoundError);
  });

  it('blocks an approval when a selected candidate category has been archived', async () => {
    const user = await createUser('archived-category');
    const groceries = await groceriesFor(user.id);
    const batch = await createBatch(user.id, [selectedCandidate(groceries.id)]);

    await archiveCategoryForUser(user.id, groceries.id);

    await expect(approveImportBatchForUser(user.id, batch.id)).rejects.toThrow(
      /Archived categories cannot be used/,
    );
    await expect(
      db.transaction.count({ where: { importBatchId: batch.id } }),
    ).resolves.toBe(0);
  });
  it('rejects candidate mutations after approval preserves the batch history', async () => {
    const user = await createUser('approved-batch-mutation');
    const groceries = await groceriesFor(user.id);
    const batch = await createBatch(user.id, [
      selectedCandidate(groceries.id),
      {
        amountCents: null,
        categoryId: null,
        description: 'Excluded history row',
        ordinal: 2,
        reviewState: CandidateReviewState.PENDING,
        transactionDate: null,
        type: null,
      },
    ]);
    const excludedCandidate = batch.candidates[1]!;

    await approveImportBatchForUser(user.id, batch.id);

    await expect(
      updateCandidateForUser(user.id, excludedCandidate.id, {
        amount: '18.75',
        categoryId: groceries.id,
        description: 'Attempted post-approval edit',
        notes: '',
        transactionDate: '2026-09-02',
        type: 'expense',
      }),
    ).rejects.toBeInstanceOf(ImportBatchUnavailableError);
    await expect(
      setCandidateReviewStateForUser(user.id, excludedCandidate.id, 'pending'),
    ).rejects.toBeInstanceOf(ImportBatchUnavailableError);
    await expect(
      db.candidateTransaction.findUniqueOrThrow({
        where: { id: excludedCandidate.id },
      }),
    ).resolves.toMatchObject({
      description: 'Excluded history row',
      reviewState: CandidateReviewState.EXCLUDED,
      savedTransactionId: null,
    });
  });
});
