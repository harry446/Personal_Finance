import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BudgetProgress } from '@/components/budget-progress';

describe('budget progress', () => {
  it('shows one clickable monthly summary rather than category cards', () => {
    render(
      <BudgetProgress
        budget={{
          enabled: true,
          progress: [
            {
              availableCents: 20_000,
              budgetId: 'budget-groceries',
              categoryId: 'groceries',
              categoryName: 'Groceries',
              configurationEffectiveMonth: '2026-09',
              configuredLimitCents: 30_000,
              mode: 'monthly_reset',
              overageCents: 0,
              rawAvailableCents: 20_000,
              rolloverWindowStartMonth: null,
              usageCents: 10_000,
            },
            {
              availableCents: 12_500,
              budgetId: 'budget-transport',
              categoryId: 'transport',
              categoryName: 'Transport',
              configurationEffectiveMonth: '2026-09',
              configuredLimitCents: 20_000,
              mode: 'monthly_reset',
              overageCents: 0,
              rawAvailableCents: 12_500,
              rolloverWindowStartMonth: null,
              usageCents: 7_500,
            },
          ],
        }}
        monthlySpendingCents={20_000}
        monthLabel="September 2026"
      />,
    );

    const summary = screen.getByRole('link', {
      name: 'Open detailed budgets for September 2026',
    });

    expect(summary).toHaveAttribute('href', '/app/budgets');
    expect(within(summary).getByText('Monthly budget')).toBeVisible();
    expect(within(summary).queryByText('Groceries')).not.toBeInTheDocument();
    expect(within(summary).queryByText('Transport')).not.toBeInTheDocument();
    expect(
      within(summary).getByRole('progressbar', {
        name: '$200.00 spent of $500.00 monthly budget',
      }),
    ).toHaveAttribute('aria-valuenow', '20000');
    expect(within(summary).getByText('$300.00')).toBeVisible();
  });
});
