import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/app/actions', () => ({
  setBudgetModeAction: vi.fn(),
  upsertCurrentBudgetConfigurationAction: vi.fn(),
}));

import { BudgetsWorkspace } from '@/components/budgets-workspace';

describe('budgets workspace', () => {
  it('hides configuration controls while budget mode is off', () => {
    render(
      <BudgetsWorkspace
        budgetModeEnabled={false}
        categories={[]}
        currentMonth="2026-09"
        progress={[]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Budget mode is off' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Turn budget mode on' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Category budgets' }),
    ).not.toBeInTheDocument();
  });

  it('shows a current-month bar for each configured active category', () => {
    render(
      <BudgetsWorkspace
        budgetModeEnabled
        categories={[
          {
            categoryId: 'groceries',
            configuration: {
              amountCents: 30_000,
              effectiveMonth: '2026-08',
              mode: 'rollover',
            },
            name: 'Groceries',
          },
        ]}
        currentMonth="2026-09"
        progress={[
          {
            availableCents: 22_500,
            budgetId: 'budget-groceries',
            categoryId: 'groceries',
            categoryName: 'Groceries',
            configurationEffectiveMonth: '2026-08',
            configuredLimitCents: 30_000,
            mode: 'rollover',
            overageCents: 0,
            rawAvailableCents: 22_500,
            rolloverWindowStartMonth: '2026-08',
            usageCents: 7_500,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('progressbar', { name: 'Groceries budget progress' }),
    ).toHaveAttribute('aria-valuenow', '7500');
    expect(
      screen.getByText('Rollover available since August 2026.'),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit budget for Groceries' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Edit budget for Groceries' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Monthly amount (CAD)')).toHaveValue(300);
    expect(screen.getByLabelText('Budget behavior')).toHaveValue('rollover');
    expect(
      screen.getByText(/Earlier month configurations cannot be rewritten/),
    ).toBeVisible();
  });
});
