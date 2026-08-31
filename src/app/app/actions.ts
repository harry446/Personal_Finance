'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireCurrentUser } from '@/lib/current-user';
import {
  archiveCategoryForUser,
  ArchivedCategoryError,
  CategoryNameConflictError,
  createCategoryForUser,
  createManualTransactionForUser,
  deleteTransactionForUser,
  OwnedRecordNotFoundError,
  renameCategoryForUser,
  restoreCategoryForUser,
  updateManualTransactionForUser,
} from '@/lib/ledger';

const archiveConfirmationSchema = z.object({
  confirmation: z.literal('archive', {
    error: 'Confirm that you want to archive this category.',
  }),
});

const deleteConfirmationSchema = z.object({
  confirmation: z.literal('delete', {
    error: 'Confirm that you want to permanently delete this transaction.',
  }),
});

type ActionResult = {
  message: string;
  status: 'error' | 'success';
};

export async function createCategoryAction(
  _previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  try {
    const result = await createCategoryForUser(
      user.id,
      stringValue(formData, 'name'),
    );

    revalidatePath('/app');

    return {
      status: 'success',
      message: result.reactivated
        ? `${result.category.name} was restored.`
        : `${result.category.name} was added.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function renameCategoryAction(
  categoryId: string,
  _previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  try {
    const category = await renameCategoryForUser(
      user.id,
      categoryId,
      stringValue(formData, 'name'),
    );

    revalidatePath('/app');

    return { status: 'success', message: `${category.name} was renamed.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function archiveCategoryAction(
  categoryId: string,
  _previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  try {
    archiveConfirmationSchema.parse({
      confirmation: stringValue(formData, 'confirmation'),
    });
    const category = await archiveCategoryForUser(user.id, categoryId);

    revalidatePath('/app');

    return {
      status: 'success',
      message: `${category.name} was archived. Historical transactions keep this category.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function restoreCategoryAction(
  categoryId: string,
  _previousState: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  try {
    const category = await restoreCategoryForUser(user.id, categoryId);

    revalidatePath('/app');

    return { status: 'success', message: `${category.name} was restored.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createManualTransactionAction(
  _previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  try {
    const transaction = await createManualTransactionForUser(
      user.id,
      transactionFormValues(formData),
    );

    revalidatePath('/app');

    return {
      status: 'success',
      message: `${transaction.description} was saved.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateManualTransactionAction(
  transactionId: string,
  _previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  try {
    const transaction = await updateManualTransactionForUser(
      user.id,
      transactionId,
      transactionFormValues(formData),
    );

    revalidatePath('/app');

    return {
      status: 'success',
      message: `${transaction.description} was updated.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteTransactionAction(
  transactionId: string,
  _previousState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireCurrentUser();

  try {
    deleteConfirmationSchema.parse({
      confirmation: stringValue(formData, 'confirmation'),
    });
    await deleteTransactionForUser(user.id, transactionId);

    revalidatePath('/app');

    return { status: 'success', message: 'Transaction permanently deleted.' };
  } catch (error) {
    return toActionError(error);
  }
}

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === 'string' ? value : '';
}

function transactionFormValues(formData: FormData) {
  return {
    amount: stringValue(formData, 'amount'),
    categoryId: stringValue(formData, 'categoryId'),
    description: stringValue(formData, 'description'),
    notes: stringValue(formData, 'notes'),
    transactionDate: stringValue(formData, 'transactionDate'),
    type: stringValue(formData, 'type'),
  };
}

function toActionError(error: unknown): ActionResult {
  if (error instanceof z.ZodError) {
    return {
      status: 'error',
      message: error.issues[0]?.message ?? 'Check the highlighted information.',
    };
  }

  if (
    error instanceof ArchivedCategoryError ||
    error instanceof CategoryNameConflictError ||
    error instanceof OwnedRecordNotFoundError
  ) {
    return { status: 'error', message: error.message };
  }

  return {
    status: 'error',
    message: 'Something went wrong. Please try again.',
  };
}
