import { describe, expect, it } from 'vitest';

import { formatCad, formatTransactionDate } from '@/lib/formatters';

describe('ledger presentation formatting', () => {
  it('formats stored cents as Canadian dollars', () => {
    expect(formatCad(1_234)).toBe('$12.34');
  });

  it('formats stored transaction dates without local timezone drift', () => {
    expect(formatTransactionDate(new Date('2026-08-31T00:00:00.000Z'))).toBe(
      'Aug 31, 2026',
    );
  });
});
