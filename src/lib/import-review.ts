import 'server-only';

import {
  CandidateReviewState,
  ImportBatchStatus,
  TransactionSource,
  TransactionType,
  type Prisma,
} from '@/generated/prisma/client';
import { db } from '@/lib/db';
import {
  candidateReviewStateSchema,
  formatIncompleteCandidateFields,
  incompleteCandidateFields,
  parseCandidateTransactionInput,
} from '@/lib/import-validation';
import { ArchivedCategoryError, OwnedRecordNotFoundError } from '@/lib/ledger';

type ImportWriter = Pick<
  Prisma.TransactionClient,
  | '$queryRaw'
  | 'candidateTransaction'
  | 'category'
  | 'importBatch'
  | 'transaction'
>;

type CandidateForApproval = {
  amountCents: number | null;
  categoryId: string | null;
  description: string | null;
  id: string;
  notes: string | null;
  ordinal: number;
  transactionDate: Date | null;
  type: TransactionType | null;
};

export class ImportBatchUnavailableError extends Error {
  constructor() {
    super('This import batch can no longer be approved.');
    this.name = 'ImportBatchUnavailableError';
  }
}

export class CandidateApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CandidateApprovalError';
  }
}

export async function listImportBatchesForUser(userId: string) {
  return db.importBatch.findMany({
    where: { userId },
    include: {
      _count: {
        select: { candidates: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listReviewBatchesForUser(userId: string) {
  return db.importBatch.findMany({
    where: {
      status: {
        in: [
          ImportBatchStatus.FAILED,
          ImportBatchStatus.PROCESSING,
          ImportBatchStatus.READY_FOR_REVIEW,
        ],
      },
      userId,
    },
    include: {
      _count: {
        select: { candidates: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getImportBatchForUser(userId: string, batchId: string) {
  const batch = await db.importBatch.findFirst({
    where: { id: batchId, userId },
    include: {
      candidates: {
        orderBy: { ordinal: 'asc' },
      },
    },
  });

  if (!batch) {
    throw new OwnedRecordNotFoundError('import batch');
  }

  return batch;
}

export async function updateCandidateForUser(
  userId: string,
  candidateId: string,
  values: unknown,
) {
  const input = parseCandidateTransactionInput(values);

  return db.$transaction(async (transaction) => {
    const candidate = await requireOwnedMutableCandidate(
      transaction,
      userId,
      candidateId,
    );

    if (input.categoryId) {
      await requireActiveOwnedCategory(transaction, userId, input.categoryId);
    }

    return transaction.candidateTransaction.update({
      where: { id: candidate.id },
      data: {
        amountCents: input.amount,
        categoryId: input.categoryId,
        description: input.description,
        notes: input.notes,
        transactionDate: input.transactionDate,
        type: input.type
          ? input.type === 'expense'
            ? TransactionType.EXPENSE
            : TransactionType.REFUND
          : null,
      },
    });
  });
}

export async function setCandidateReviewStateForUser(
  userId: string,
  candidateId: string,
  rawReviewState: unknown,
) {
  const reviewState = candidateReviewStateSchema.parse(rawReviewState);

  return db.$transaction(async (transaction) => {
    const candidate = await requireOwnedMutableCandidate(
      transaction,
      userId,
      candidateId,
    );

    return transaction.candidateTransaction.update({
      where: { id: candidate.id },
      data: { reviewState: reviewStateToDatabaseValue(reviewState) },
    });
  });
}

export async function approveImportBatchForUser(
  userId: string,
  batchId: string,
) {
  return db.$transaction(async (transaction) => {
    const batch = await requireReadyOwnedImportBatch(
      transaction,
      userId,
      batchId,
    );

    const lockedCandidateRows = await transaction.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT "id"
      FROM "candidate_transactions"
      WHERE "import_batch_id" = ${batch.id}
        AND "review_state" = 'selected'::"CandidateReviewState"
      FOR UPDATE
    `;

    const candidateIds = lockedCandidateRows.map((candidate) => candidate.id);
    const candidates = await transaction.candidateTransaction.findMany({
      where: {
        id: { in: candidateIds },
        importBatchId: batch.id,
        reviewState: CandidateReviewState.SELECTED,
      },
      orderBy: { ordinal: 'asc' },
    });

    if (candidates.length !== candidateIds.length) {
      throw new ImportBatchUnavailableError();
    }

    const preparedCandidates = candidates.map(prepareCandidateForApproval);

    for (const candidate of preparedCandidates) {
      await requireActiveOwnedCategory(
        transaction,
        userId,
        candidate.categoryId,
      );
    }

    await transaction.candidateTransaction.updateMany({
      where: {
        importBatchId: batch.id,
        reviewState: { not: CandidateReviewState.SELECTED },
      },
      data: { reviewState: CandidateReviewState.EXCLUDED },
    });

    const savedTransactions = [];

    for (const candidate of preparedCandidates) {
      const savedTransaction = await transaction.transaction.create({
        data: {
          amountCents: candidate.amountCents,
          categoryId: candidate.categoryId,
          description: candidate.description,
          importBatchId: batch.id,
          notes: candidate.notes,
          source: TransactionSource.IMPORT,
          transactionDate: candidate.transactionDate,
          type: candidate.type,
          userId,
        },
      });

      await transaction.candidateTransaction.update({
        where: { id: candidate.id },
        data: {
          reviewState: CandidateReviewState.APPROVED,
          savedTransactionId: savedTransaction.id,
        },
      });
      savedTransactions.push(savedTransaction);
    }

    const updatedBatch = await transaction.importBatch.update({
      where: { id: batch.id },
      data: {
        approvedCount: savedTransactions.length,
        status: ImportBatchStatus.APPROVED,
      },
    });

    return {
      batch: updatedBatch,
      savedTransactions,
    };
  });
}

async function requireOwnedMutableCandidate(
  writer: ImportWriter,
  userId: string,
  candidateId: string,
) {
  const candidate = await requireOwnedCandidate(writer, userId, candidateId);

  await requireReadyOwnedImportBatch(writer, userId, candidate.importBatchId);

  if (candidate.reviewState === CandidateReviewState.APPROVED) {
    throw new ImportBatchUnavailableError();
  }

  return candidate;
}

async function requireReadyOwnedImportBatch(
  writer: ImportWriter,
  userId: string,
  batchId: string,
) {
  const lockedBatches = await writer.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "import_batches"
    WHERE "id" = ${batchId} AND "user_id" = ${userId}
    FOR UPDATE
  `;

  if (lockedBatches.length === 0) {
    throw new OwnedRecordNotFoundError('import batch');
  }

  const batch = await writer.importBatch.findFirstOrThrow({
    where: { id: batchId, userId },
  });

  if (batch.status !== ImportBatchStatus.READY_FOR_REVIEW) {
    throw new ImportBatchUnavailableError();
  }

  return batch;
}
async function requireOwnedCandidate(
  writer: ImportWriter,
  userId: string,
  candidateId: string,
) {
  const candidate = await writer.candidateTransaction.findFirst({
    where: {
      id: candidateId,
      importBatch: { userId },
    },
  });

  if (!candidate) {
    throw new OwnedRecordNotFoundError('candidate');
  }

  return candidate;
}

async function requireActiveOwnedCategory(
  writer: ImportWriter,
  userId: string,
  categoryId: string,
) {
  const category = await writer.category.findFirst({
    where: { archivedAt: null, id: categoryId, userId },
  });

  if (!category) {
    const ownedCategory = await writer.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (ownedCategory?.archivedAt) {
      throw new ArchivedCategoryError();
    }

    throw new OwnedRecordNotFoundError('category');
  }

  return category;
}

function prepareCandidateForApproval(candidate: CandidateForApproval) {
  const incompleteFields = incompleteCandidateFields(candidate);

  if (incompleteFields.length > 0) {
    throw new CandidateApprovalError(
      `Candidate ${candidate.ordinal} needs ${formatIncompleteCandidateFields(incompleteFields)} before approval.`,
    );
  }

  if (
    candidate.transactionDate === null ||
    candidate.type === null ||
    candidate.amountCents === null ||
    candidate.categoryId === null ||
    candidate.description === null
  ) {
    throw new CandidateApprovalError(
      `Candidate ${candidate.ordinal} needs complete transaction details before approval.`,
    );
  }

  if (candidate.description.trim().length > 160) {
    throw new CandidateApprovalError(
      `Candidate ${candidate.ordinal} has a description that is too long.`,
    );
  }

  if (candidate.notes && candidate.notes.length > 1_000) {
    throw new CandidateApprovalError(
      `Candidate ${candidate.ordinal} has notes that are too long.`,
    );
  }

  return {
    amountCents: candidate.amountCents,
    categoryId: candidate.categoryId,
    description: candidate.description.trim(),
    id: candidate.id,
    notes: candidate.notes?.trim() || null,
    transactionDate: candidate.transactionDate,
    type: candidate.type,
  };
}

function reviewStateToDatabaseValue(reviewState: 'pending' | 'selected') {
  return reviewState === 'selected'
    ? CandidateReviewState.SELECTED
    : CandidateReviewState.PENDING;
}
