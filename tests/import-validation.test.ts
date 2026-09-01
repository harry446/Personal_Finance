import { describe, expect, it } from 'vitest';

import {
  candidateReviewStateSchema,
  incompleteCandidateFields,
  parseCandidateTransactionInput,
} from '@/lib/import-validation';

describe('import candidate validation', () => {
  it('parses editable candidate values while allowing incomplete review rows', () => {
    expect(
      parseCandidateTransactionInput({
        amount: ' 42.50 ',
        categoryId: ' category-1 ',
        description: ' Market run ',
        notes: ' Receipt matched ',
        transactionDate: '2026-09-02',
        type: 'expense',
      }),
    ).toEqual({
      amount: 4_250,
      categoryId: 'category-1',
      description: 'Market run',
      notes: 'Receipt matched',
      transactionDate: new Date('2026-09-02T00:00:00.000Z'),
      type: 'expense',
    });

    expect(
      parseCandidateTransactionInput({
        amount: '',
        categoryId: '',
        description: '',
        notes: '',
        transactionDate: '',
        type: '',
      }),
    ).toEqual({
      amount: null,
      categoryId: null,
      description: null,
      notes: null,
      transactionDate: null,
      type: null,
    });
  });

  it('keeps malformed candidate edits out of the review service', () => {
    expect(() =>
      parseCandidateTransactionInput({
        amount: '0',
        categoryId: '',
        description: '',
        notes: '',
        transactionDate: '2026-02-30',
        type: 'income',
      }),
    ).toThrow(/valid calendar date|greater than \$0\.00|expense or refund/i);
  });

  it('identifies exactly the fields that block selecting an incomplete candidate', () => {
    expect(
      incompleteCandidateFields({
        amountCents: null,
        categoryId: null,
        description: 'Coffee',
        transactionDate: new Date('2026-09-02T00:00:00.000Z'),
        type: null,
      }),
    ).toEqual(['type', 'amount', 'category']);

    expect(
      incompleteCandidateFields({
        amountCents: 525,
        categoryId: 'category-1',
        description: 'Coffee',
        transactionDate: new Date('2026-09-02T00:00:00.000Z'),
        type: 'expense',
      }),
    ).toEqual([]);
  });

  it('permits only selection state changes from client input', () => {
    expect(candidateReviewStateSchema.parse('pending')).toBe('pending');
    expect(candidateReviewStateSchema.parse('selected')).toBe('selected');
    expect(() => candidateReviewStateSchema.parse('excluded')).toThrow();
    expect(() => candidateReviewStateSchema.parse('approved')).toThrow();
  });
});
