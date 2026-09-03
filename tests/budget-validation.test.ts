import { describe, expect, it } from 'vitest';

import {
  budgetConfigurationFormSchema,
  parseBudgetConfigurationInput,
} from '@/lib/budget-validation';

describe('budget validation', () => {
  it('parses a positive CAD amount and a supported budget mode', () => {
    expect(
      parseBudgetConfigurationInput({
        amount: '300.50',
        categoryId: 'category-1',
        mode: 'rollover',
      }),
    ).toEqual({
      amountCents: 30_050,
      categoryId: 'category-1',
      mode: 'rollover',
    });
  });

  it('rejects a missing category, non-positive amount, and unknown mode', () => {
    expect(() =>
      budgetConfigurationFormSchema.parse({
        amount: '0',
        categoryId: '',
        mode: 'weekly',
      }),
    ).toThrow();
  });
});
