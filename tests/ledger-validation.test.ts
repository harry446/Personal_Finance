import { describe, expect, it } from 'vitest';

import {
  amountInputSchema,
  parseManualTransactionInput,
  transactionDateSchema,
} from '@/lib/ledger-validation';

describe('manual ledger validation', () => {
  it('converts valid CAD amounts to positive integer cents', () => {
    expect(amountInputSchema.parse('24')).toBe(2_400);
    expect(amountInputSchema.parse('24.5')).toBe(2_450);
    expect(amountInputSchema.parse('24.50')).toBe(2_450);
  });

  it('rejects zero, negative values, excess precision, and malformed amounts', () => {
    for (const amount of ['0', '-1', '1.999', '$12.00', '12,00']) {
      expect(() => amountInputSchema.parse(amount)).toThrow();
    }
  });

  it('accepts real calendar dates and rejects invalid dates', () => {
    expect(transactionDateSchema.parse('2028-02-29')).toBe('2028-02-29');
    expect(() => transactionDateSchema.parse('2027-02-29')).toThrow();
    expect(() => transactionDateSchema.parse('2027-13-01')).toThrow();
  });

  it('trims values and produces a timezone-stable transaction date', () => {
    const transaction = parseManualTransactionInput({
      amount: ' 12.34 ',
      categoryId: 'category-1',
      description: '  Local market  ',
      notes: '  ',
      transactionDate: '2026-08-31',
      type: 'expense',
    });

    expect(transaction).toMatchObject({
      amountCents: 1_234,
      categoryId: 'category-1',
      description: 'Local market',
      notes: null,
      type: 'expense',
    });
    expect(transaction.transactionDate.toISOString()).toBe(
      '2026-08-31T00:00:00.000Z',
    );
  });

  it('requires every field that defines a saved manual transaction', () => {
    expect(() =>
      parseManualTransactionInput({
        amount: '10.00',
        categoryId: '',
        description: '',
        transactionDate: '',
        type: 'transfer',
      }),
    ).toThrow();
  });
});
