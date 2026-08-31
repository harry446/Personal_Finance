import { z } from 'zod';

const MAX_AMOUNT_CENTS = 2_147_483_647;
const DATE_INPUT_PATTERN = /^[1-9]\d{3}-\d{2}-\d{2}$/;
const MONEY_INPUT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export const transactionTypeSchema = z.enum(['expense', 'refund']);

export const transactionDateSchema = z
  .string()
  .trim()
  .regex(DATE_INPUT_PATTERN, 'Enter a date in YYYY-MM-DD format.')
  .refine(isCalendarDate, 'Enter a valid calendar date.');

export const amountInputSchema = z
  .string()
  .trim()
  .regex(
    MONEY_INPUT_PATTERN,
    'Enter a positive amount with no more than two decimal places.',
  )
  .transform(toAmountCents)
  .pipe(
    z
      .number()
      .int()
      .positive('Amount must be greater than $0.00.')
      .max(MAX_AMOUNT_CENTS, 'Amount is too large.'),
  );

export const manualTransactionFormSchema = z.object({
  categoryId: z.string().trim().min(1, 'Choose a category.').max(191),
  transactionDate: transactionDateSchema,
  type: transactionTypeSchema,
  amount: amountInputSchema,
  description: z
    .string()
    .trim()
    .min(1, 'Enter a description.')
    .max(160, 'Description must be 160 characters or fewer.'),
  notes: z
    .string()
    .trim()
    .max(1_000, 'Notes must be 1,000 characters or fewer.')
    .transform((value) => value || null)
    .optional(),
});

export type ManualTransactionInput = {
  amountCents: number;
  categoryId: string;
  description: string;
  notes: string | null;
  transactionDate: Date;
  type: z.infer<typeof transactionTypeSchema>;
};

export function parseManualTransactionInput(
  value: unknown,
): ManualTransactionInput {
  const parsed = manualTransactionFormSchema.parse(value);

  return {
    amountCents: parsed.amount,
    categoryId: parsed.categoryId,
    description: parsed.description,
    notes: parsed.notes ?? null,
    transactionDate: parseCalendarDate(parsed.transactionDate),
    type: parsed.type,
  };
}

function isCalendarDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseCalendarDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function toAmountCents(value: string) {
  const [whole, fractional = ''] = value.split('.');
  const cents = `${whole}${fractional.padEnd(2, '0')}`;

  return Number(cents);
}
