import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  approveMock,
  revalidatePathMock,
  requireCurrentUserMock,
  reviewStateMock,
  updateMock,
} = vi.hoisted(() => ({
  approveMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireCurrentUserMock: vi.fn(),
  reviewStateMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('@/lib/current-user', () => ({
  requireCurrentUser: requireCurrentUserMock,
}));

vi.mock('@/lib/import-review', () => ({
  approveImportBatchForUser: approveMock,
  CandidateApprovalError: class CandidateApprovalError extends Error {},
  ImportBatchUnavailableError: class ImportBatchUnavailableError extends Error {},
  setCandidateReviewStateForUser: reviewStateMock,
  updateCandidateForUser: updateMock,
}));

vi.mock('@/lib/ledger', () => ({
  ArchivedCategoryError: class ArchivedCategoryError extends Error {},
  OwnedRecordNotFoundError: class OwnedRecordNotFoundError extends Error {},
}));

import {
  approveImportBatchAction,
  setCandidateReviewStateAction,
  updateCandidateAction,
} from '@/app/app/imports/actions';

describe('import review actions', () => {
  beforeEach(() => {
    approveMock.mockReset();
    revalidatePathMock.mockReset();
    requireCurrentUserMock.mockReset();
    reviewStateMock.mockReset();
    updateMock.mockReset();
    requireCurrentUserMock.mockResolvedValue({ id: 'user-1' });
  });

  it('revalidates the dashboard and import detail after a successful approval', async () => {
    approveMock.mockResolvedValue({
      savedTransactions: [{ id: 'transaction-1' }, { id: 'transaction-2' }],
    });

    await expect(
      approveImportBatchAction('batch-1', null, new FormData()),
    ).resolves.toEqual({
      message: '2 transactions added to your ledger.',
      status: 'success',
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/app');
    expect(revalidatePathMock).toHaveBeenCalledWith('/app/imports');
    expect(revalidatePathMock).toHaveBeenCalledWith('/app/imports/batch-1');
  });

  it('updates an owned candidate and refreshes only the relevant import paths', async () => {
    updateMock.mockResolvedValue({ importBatchId: 'batch-1', ordinal: 2 });
    const formData = new FormData();

    formData.set('amount', '18.75');
    formData.set('categoryId', 'category-1');
    formData.set('description', 'Market');
    formData.set('notes', '');
    formData.set('transactionDate', '2026-09-02');
    formData.set('type', 'expense');

    await expect(
      updateCandidateAction('candidate-1', null, formData),
    ).resolves.toEqual({
      message: 'Candidate 2 was updated.',
      status: 'success',
    });
    expect(revalidatePathMock).not.toHaveBeenCalledWith('/app');
    expect(revalidatePathMock).toHaveBeenCalledWith('/app/imports/batch-1');
  });

  it('persists exclusion state without treating the row as a ledger transaction', async () => {
    reviewStateMock.mockResolvedValue({
      importBatchId: 'batch-1',
      ordinal: 3,
      reviewState: 'EXCLUDED',
    });
    const formData = new FormData();

    formData.set('reviewState', 'excluded');

    await expect(
      setCandidateReviewStateAction('candidate-3', null, formData),
    ).resolves.toEqual({
      message: 'Candidate 3 is excluded from approval.',
      status: 'success',
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/app/imports/batch-1');
  });
});
