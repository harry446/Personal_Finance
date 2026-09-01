import { ImportBatchStatus, TransactionType } from '@/generated/prisma/client';
import { ImportsWorkspace } from '@/components/imports-workspace';
import { requireCurrentUser } from '@/lib/current-user';
import {
  getImportBatchForUser,
  listImportBatchesForUser,
  listReviewBatchesForUser,
} from '@/lib/import-review';
import { incompleteCandidateFields } from '@/lib/import-validation';
import { listCategoriesForUser } from '@/lib/ledger';

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string | string[] }>;
}) {
  const user = await requireCurrentUser();
  const { batch: requestedBatch } = await searchParams;
  const [batches, categories, reviewBatches] = await Promise.all([
    listImportBatchesForUser(user.id),
    listCategoriesForUser(user.id),
    listReviewBatchesForUser(user.id),
  ]);
  const requestedBatchId =
    typeof requestedBatch === 'string' ? requestedBatch : undefined;
  const selectedBatchId = reviewBatches.some(
    (batch) => batch.id === requestedBatchId,
  )
    ? requestedBatchId
    : (reviewBatches.find(
        (batch) => batch.status === ImportBatchStatus.READY_FOR_REVIEW,
      )?.id ?? reviewBatches[0]?.id);
  const selectedBatch = selectedBatchId
    ? await getImportBatchForUser(user.id, selectedBatchId)
    : null;

  return (
    <ImportsWorkspace
      activeCategories={categories.map((category) => ({
        id: category.id,
        name: category.name,
      }))}
      batches={batches.map((batch) => ({
        approvedCount: batch.approvedCount,
        candidateCount: batch.candidateCount,
        createdAt: batch.createdAt.toISOString(),
        id: batch.id,
        status: batch.status,
      }))}
      batch={
        selectedBatch
          ? {
              approvedCount: selectedBatch.approvedCount,
              candidateCount: selectedBatch.candidateCount,
              createdAt: selectedBatch.createdAt.toISOString(),
              failureMessageSafe: selectedBatch.failureMessageSafe,
              id: selectedBatch.id,
              model: selectedBatch.model,
              status: selectedBatch.status,
              candidates: selectedBatch.candidates.map((candidate) => {
                const type =
                  candidate.type === TransactionType.EXPENSE
                    ? 'expense'
                    : candidate.type === TransactionType.REFUND
                      ? 'refund'
                      : null;

                return {
                  amountCents: candidate.amountCents,
                  categoryId: candidate.categoryId,
                  categoryName:
                    categories.find(
                      (category) => category.id === candidate.categoryId,
                    )?.name ?? null,
                  description: candidate.description,
                  id: candidate.id,
                  isIncomplete:
                    incompleteCandidateFields({
                      amountCents: candidate.amountCents,
                      categoryId: candidate.categoryId,
                      description: candidate.description,
                      transactionDate: candidate.transactionDate,
                      type,
                    }).length > 0,
                  notes: candidate.notes,
                  ordinal: candidate.ordinal,
                  reviewState: candidate.reviewState,
                  savedTransactionId: candidate.savedTransactionId,
                  transactionDate:
                    candidate.transactionDate?.toISOString() ?? null,
                  type,
                };
              }),
            }
          : null
      }
      requestedBatchWasUnavailable={Boolean(
        requestedBatchId && requestedBatchId !== selectedBatchId,
      )}
    />
  );
}
