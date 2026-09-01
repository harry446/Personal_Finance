import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createMock,
  deleteMock,
  revalidatePathMock,
  requireCurrentUserMock,
  updateMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  deleteMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireCurrentUserMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('@/lib/current-user', () => ({
  requireCurrentUser: requireCurrentUserMock,
}));

vi.mock('@/lib/ledger', () => ({
  ArchivedCategoryError: class ArchivedCategoryError extends Error {},
  archiveCategoryForUser: vi.fn(),
  CategoryNameConflictError: class CategoryNameConflictError extends Error {},
  createCategoryForUser: vi.fn(),
  createManualTransactionForUser: createMock,
  deleteTransactionForUser: deleteMock,
  OwnedRecordNotFoundError: class OwnedRecordNotFoundError extends Error {},
  renameCategoryForUser: vi.fn(),
  restoreCategoryForUser: vi.fn(),
  updateManualTransactionForUser: updateMock,
}));

import {
  createManualTransactionAction,
  deleteTransactionAction,
  updateManualTransactionAction,
} from '@/app/app/actions';

function transactionFormData() {
  const formData = new FormData();

  formData.set('amount', '24.50');
  formData.set('categoryId', 'category-1');
  formData.set('description', 'FreshCo');
  formData.set('notes', '');
  formData.set('transactionDate', '2026-08-24');
  formData.set('type', 'expense');

  return formData;
}

describe('ledger dashboard revalidation', () => {
  beforeEach(() => {
    createMock.mockReset();
    deleteMock.mockReset();
    revalidatePathMock.mockReset();
    requireCurrentUserMock.mockReset();
    updateMock.mockReset();
    requireCurrentUserMock.mockResolvedValue({ id: 'user-1' });
  });

  it('revalidates the dashboard after creating a manual transaction', async () => {
    createMock.mockResolvedValue({ description: 'FreshCo' });

    await expect(
      createManualTransactionAction(null, transactionFormData()),
    ).resolves.toMatchObject({ status: 'success' });
    expect(revalidatePathMock).toHaveBeenCalledWith('/app');
  });

  it('revalidates the dashboard after editing a transaction into another month', async () => {
    updateMock.mockResolvedValue({ description: 'FreshCo' });

    await expect(
      updateManualTransactionAction(
        'transaction-1',
        null,
        transactionFormData(),
      ),
    ).resolves.toMatchObject({ status: 'success' });
    expect(revalidatePathMock).toHaveBeenCalledWith('/app');
  });

  it('revalidates the dashboard after permanently deleting a transaction', async () => {
    const formData = new FormData();
    formData.set('confirmation', 'delete');
    deleteMock.mockResolvedValue(undefined);

    await expect(
      deleteTransactionAction('transaction-1', null, formData),
    ).resolves.toMatchObject({ status: 'success' });
    expect(revalidatePathMock).toHaveBeenCalledWith('/app');
  });
});
