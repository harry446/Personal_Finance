import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  DashboardEmptyState,
  DashboardInvalidMonthState,
  DashboardWorkspace,
} from '@/components/dashboard-workspace';
import type { MonthlyDashboard } from '@/lib/dashboard-calculations';

const populatedDashboard: MonthlyDashboard = {
  categoryTotals: [
    {
      archived: false,
      categoryId: 'groceries',
      name: 'Groceries',
      netCents: 8_000,
    },
  ],
  dailyTrend: [
    {
      date: '2026-08-02',
      expenseCents: 10_000,
      netCents: 8_000,
      refundCents: 2_000,
    },
  ],
  expenseTransactionCount: 1,
  grossExpensesCents: 10_000,
  hasTransactions: true,
  month: {
    endExclusive: new Date('2026-09-01T00:00:00.000Z'),
    key: '2026-08',
    start: new Date('2026-08-01T00:00:00.000Z'),
  },
  netSpendingCents: 8_000,
  recentTransactions: [
    {
      amountCents: 10_000,
      categoryName: 'Groceries',
      description: 'Weekly groceries',
      id: 'expense-1',
      transactionDate: '2026-08-02',
      type: 'expense',
    },
    {
      amountCents: 2_000,
      categoryName: 'Groceries',
      description: 'Returned item',
      id: 'refund-1',
      transactionDate: '2026-08-02',
      type: 'refund',
    },
  ],
  refundTransactionCount: 1,
  refundsCents: 2_000,
};

describe('dashboard workspace', () => {
  it('presents month totals, trend context, category net spending, and signed recent rows', () => {
    render(<DashboardWorkspace dashboard={populatedDashboard} />);

    expect(
      screen.getByRole('heading', { name: 'Overview', level: 1 }),
    ).toBeVisible();
    const summary = screen.getByLabelText('August 2026 spending summary');
    expect(within(summary).getByText('$80.00')).toBeVisible();
    expect(within(summary).getByText('$100.00')).toBeVisible();
    expect(within(summary).getByText('$20.00')).toBeVisible();
    expect(
      within(screen.getByLabelText('Top categories')).getByText('Groceries'),
    ).toBeVisible();
    expect(screen.getByText('−$100.00')).toBeVisible();
    expect(screen.getByText('+$20.00')).toBeVisible();
    expect(
      screen.getByLabelText(
        'August 2026 expense and refund trend by transaction date',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Show July 2026' }),
    ).toHaveAttribute('href', '/app?month=2026-07');
  });

  it('explains the selected empty month and links to manual entry', () => {
    render(<DashboardEmptyState month="2026-08" />);

    expect(
      screen.getByRole('heading', {
        name: 'No transactions in this month yet.',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Add your first transaction' }),
    ).toHaveAttribute('href', '/app/transactions?new=1');
  });

  it('keeps invalid month input in a safe error state', () => {
    render(<DashboardInvalidMonthState value="not-a-month" />);

    expect(
      screen.getByRole('heading', { name: 'Choose a valid month.' }),
    ).toBeVisible();
    expect(screen.getByText(/“not-a-month” is not valid\./)).toBeVisible();
  });
});
