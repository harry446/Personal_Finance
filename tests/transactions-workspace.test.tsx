import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/app/actions', () => ({
  createManualTransactionAction: vi.fn(),
  deleteTransactionAction: vi.fn(),
  updateManualTransactionAction: vi.fn(),
}));

import { TransactionsWorkspace } from '@/components/transactions-workspace';

describe('TransactionsWorkspace', () => {
  it('renders the ledger with accessible filters and accounting-sign amounts', () => {
    render(
      <TransactionsWorkspace
        categories={[{ id: 'category-1', name: 'Groceries' }]}
        transactions={[
          {
            amountCents: 8_416,
            categoryId: 'category-1',
            categoryName: 'Groceries',
            description: 'FreshCo',
            id: 'transaction-1',
            notes: null,
            transactionDate: '2026-08-24T00:00:00.000Z',
            type: 'expense',
          },
          {
            amountCents: 1_000,
            categoryId: 'category-1',
            categoryName: 'Groceries',
            description: 'Refund',
            id: 'transaction-2',
            notes: null,
            transactionDate: '2026-08-23T00:00:00.000Z',
            type: 'refund',
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Transactions' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by month')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by category')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by type')).toBeInTheDocument();
    expect(screen.getByText('-$84.16')).toBeInTheDocument();
    expect(screen.getByText('+$10.00')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add transaction/i }),
    ).toBeInTheDocument();
  });

  it('shows an actionable empty ledger state', () => {
    render(<TransactionsWorkspace categories={[]} transactions={[]} />);

    expect(
      screen.getByRole('heading', { name: 'No transactions yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add transaction' }),
    ).toBeInTheDocument();
  });
});
