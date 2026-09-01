'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireCurrentUser } from '@/lib/current-user';
import {
  approveImportBatchForUser,
  CandidateApprovalError,
  ImportBatchUnavailableError,
  setCandidateReviewStateForUser,
  updateCandidateForUser,
} from '@/lib/import-review';
import { ArchivedCategoryError, OwnedRecordNotFoundError } from '@/lib/ledger';

type ActionResult = {
  message: string;
  status: 'error' | 'success';
};

export async function updateCandidateAction(
  candidateId: string,
  _previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  void _previousState;
  const user = await requireCurrentUser();

  try {
    const candidate = await updateCandidateForUser(user.id, candidateId, {
      amount: stringValue(formData, 'amount'),
      categoryId: stringValue(formData, 'categoryId'),
      description: stringValue(formData, 'description'),
      notes: stringValue(formData, 'notes'),
      transactionDate: stringValue(formData, 'transactionDate'),
      type: stringValue(formData, 'type'),
    });

    revalidateImportPaths(candidate.importBatchId);

    return {
      status: 'success',
      message: `Candidate ${candidate.ordinal} was updated.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setCandidateReviewStateAction(
  candidateId: string,
  _previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  void _previousState;
  const user = await requireCurrentUser();

  try {
    const candidate = await setCandidateReviewStateForUser(
      user.id,
      candidateId,
      stringValue(formData, 'reviewState'),
    );

    revalidateImportPaths(candidate.importBatchId);

    return {
      status: 'success',
      message: 'Selection updated.',
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function approveImportBatchAction(
  batchId: string,
  _previousState: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  void _previousState;
  void _formData;
  const user = await requireCurrentUser();

  try {
    await approveImportBatchForUser(user.id, batchId);

    revalidatePath('/app');
    revalidateImportPaths(batchId);
  } catch (error) {
    return toActionError(error);
  }

  redirect('/app/imports');
}

function revalidateImportPaths(batchId: string) {
  revalidatePath('/app/imports');
  revalidatePath(`/app/imports/${batchId}`);
}

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === 'string' ? value : '';
}

function toActionError(error: unknown): ActionResult {
  if (error instanceof z.ZodError) {
    return {
      status: 'error',
      message: error.issues[0]?.message ?? 'Check the candidate details.',
    };
  }

  if (
    error instanceof ArchivedCategoryError ||
    error instanceof CandidateApprovalError ||
    error instanceof ImportBatchUnavailableError ||
    error instanceof OwnedRecordNotFoundError
  ) {
    return { status: 'error', message: error.message };
  }

  return {
    status: 'error',
    message: 'Something went wrong. Please try again.',
  };
}
