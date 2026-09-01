import { z } from 'zod';

import {
  amountInputSchema,
  transactionDateSchema,
  transactionTypeSchema,
} from '@/lib/ledger-validation';

export const candidateReviewStateSchema = z.enum(['pending', 'selected']);

const optionalDescriptionSchema = z
  .string()
  .trim()
  .max(160, 'Description must be 160 characters or fewer.')
  .transform((value) => value || null);

const optionalNotesSchema = z
  .string()
  .trim()
  .max(1_000, 'Notes must be 1,000 characters or fewer.')
  .transform((value) => value || null);

const optionalCategorySchema = z
  .string()
  .trim()
  .max(191, 'Choose a valid category.')
  .transform((value) => value || null);

const optionalDateSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) {
      return null;
    }

    const parsed = transactionDateSchema.safeParse(value);

    if (!parsed.success) {
      context.addIssue({
        code: 'custom',
        message: parsed.error.issues[0]?.message ?? 'Enter a valid value.',
      });
      return z.NEVER;
    }

    return parseCalendarDate(parsed.data);
  });

const optionalAmountSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) {
      return null;
    }

    const parsed = amountInputSchema.safeParse(value);

    if (!parsed.success) {
      context.addIssue({
        code: 'custom',
        message: parsed.error.issues[0]?.message ?? 'Enter a valid value.',
      });
      return z.NEVER;
    }

    return parsed.data;
  });

const optionalTypeSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) {
      return null;
    }

    const parsed = transactionTypeSchema.safeParse(value);

    if (!parsed.success) {
      context.addIssue({
        code: 'custom',
        message: 'Choose expense or refund.',
      });
      return z.NEVER;
    }

    return parsed.data;
  });

export const candidateTransactionFormSchema = z.object({
  amount: optionalAmountSchema,
  categoryId: optionalCategorySchema,
  description: optionalDescriptionSchema,
  notes: optionalNotesSchema,
  transactionDate: optionalDateSchema,
  type: optionalTypeSchema,
});

export type CandidateTransactionInput = z.infer<
  typeof candidateTransactionFormSchema
>;

export type CandidateRequiredField =
  'amount' | 'category' | 'date' | 'description' | 'type';

export function parseCandidateTransactionInput(
  value: unknown,
): CandidateTransactionInput {
  return candidateTransactionFormSchema.parse(value);
}

export function incompleteCandidateFields(candidate: {
  amountCents: number | null;
  categoryId: string | null;
  description: string | null;
  transactionDate: Date | null;
  type: string | null;
}): CandidateRequiredField[] {
  const missing: CandidateRequiredField[] = [];

  if (!candidate.transactionDate) {
    missing.push('date');
  }
  if (!candidate.type) {
    missing.push('type');
  }
  if (!candidate.amountCents || candidate.amountCents <= 0) {
    missing.push('amount');
  }
  if (!candidate.description?.trim()) {
    missing.push('description');
  }
  if (!candidate.categoryId) {
    missing.push('category');
  }

  return missing;
}

export function formatIncompleteCandidateFields(
  fields: CandidateRequiredField[],
) {
  return fields
    .map((field) => {
      switch (field) {
        case 'amount':
          return 'amount';
        case 'category':
          return 'category';
        case 'date':
          return 'date';
        case 'description':
          return 'description';
        case 'type':
          return 'type';
      }
    })
    .join(', ');
}

function parseCalendarDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}
