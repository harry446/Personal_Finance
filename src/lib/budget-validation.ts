import { z } from 'zod';

import { amountInputSchema } from '@/lib/ledger-validation';

export const budgetModeInputSchema = z.enum(['monthly_reset', 'rollover']);

export const budgetConfigurationFormSchema = z.object({
  amount: amountInputSchema,
  categoryId: z.string().trim().min(1, 'Choose a category.').max(191),
  mode: budgetModeInputSchema,
});

export type BudgetConfigurationInput = {
  amountCents: number;
  categoryId: string;
  mode: z.infer<typeof budgetModeInputSchema>;
};

export function parseBudgetConfigurationInput(
  value: unknown,
): BudgetConfigurationInput {
  const parsed = budgetConfigurationFormSchema.parse(value);

  return {
    amountCents: parsed.amount,
    categoryId: parsed.categoryId,
    mode: parsed.mode,
  };
}
