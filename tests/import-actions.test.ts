import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  approveMock,
  redirectMock,
  revalidatePathMock,
  requireCurrentUserMock,
  reviewStateMock,
  updateMock,
} = vi.hoisted(() => ({
  approveMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireCurrentUserMock: vi.fn(),
  reviewStateMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
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
    redirectMock.mockReset();
    revalidatePathMock.mockReset();
    requireCurrentUserMock.mockReset();
    reviewStateMock.mockReset();
    updateMock.mockReset();
    requireCurrentUserMock.mockResolvedValue({ id: 'user-1' });
    redirectMock.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  it('revalidates affected pages and redirects to the queue after a successful finalization', async () => {
    approveMock.mockResolvedValue({
      savedTransactions: [{ id: 'transaction-1' }, { id: 'transaction-2' }],
    });

    await expect(
      approveImportBatchAction('batch-1', null, new FormData()),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/app/imports');
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

  it('persists selection state without treating the row as a ledger transaction', async () => {
    reviewStateMock.mockResolvedValue({
      importBatchId: 'batch-1',
      ordinal: 3,
      reviewState: 'SELECTED',
    });
    const formData = new FormData();

    formData.set('reviewState', 'selected');

    await expect(
      setCandidateReviewStateAction('candidate-3', null, formData),
    ).resolves.toEqual({
      message: 'Selection updated.',
      status: 'success',
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/app/imports/batch-1');
  });
});
