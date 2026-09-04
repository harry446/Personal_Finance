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
        categoryTotals={[
          { categoryId: 'groceries', netCents: 10_000 },
          { categoryId: 'transport', netCents: 7_500 },
          { categoryId: 'other', netCents: 2_500 },
        ]}
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
        name: '$175.00 budgeted spending of $500.00 budget capacity',
      }),
    ).toHaveAttribute('aria-valuenow', '17500');
    expect(within(summary).getByText('$325.00')).toBeVisible();
    expect(
      within(summary).getByText(
        /\$25\.00 of unbudgeted spending is excluded from this progress\./,
      ),
    ).toBeVisible();
  });

  it('uses category rollover capacity without netting category overages', () => {
    render(
      <BudgetProgress
        budget={{
          enabled: true,
          progress: [
            {
              availableCents: 55_000,
              budgetId: 'budget-travel',
              categoryId: 'travel',
              categoryName: 'Travel',
              configurationEffectiveMonth: '2026-09',
              configuredLimitCents: 30_000,
              mode: 'rollover',
              overageCents: 0,
              rawAvailableCents: 55_000,
              rolloverWindowStartMonth: '2026-08',
              usageCents: 5_000,
            },
            {
              availableCents: 0,
              budgetId: 'budget-restaurants',
              categoryId: 'restaurants',
              categoryName: 'Restaurants',
              configurationEffectiveMonth: '2026-09',
              configuredLimitCents: 10_000,
              mode: 'monthly_reset',
              overageCents: 2_000,
              rawAvailableCents: -2_000,
              rolloverWindowStartMonth: null,
              usageCents: 12_000,
            },
          ],
        }}
        categoryTotals={[
          { categoryId: 'travel', netCents: 5_000 },
          { categoryId: 'restaurants', netCents: 12_000 },
          { categoryId: 'other', netCents: 4_500 },
        ]}
        monthLabel="September 2026"
      />,
    );

    const summary = screen.getByRole('link', {
      name: 'Open detailed budgets for September 2026',
    });

    expect(
      within(summary).getByRole('progressbar', {
        name: '$170.00 budgeted spending of $700.00 budget capacity',
      }),
    ).toHaveAttribute('aria-valuenow', '17000');
    expect(within(summary).getByText('$550.00')).toBeVisible();
    expect(
      within(summary).getByText(
        /\$300\.00 is carried forward through rollover\./,
      ),
    ).toBeVisible();
    expect(
      within(summary).getByText(
        /\$20\.00 is over budget across its category\./,
      ),
    ).toBeVisible();
    expect(
      within(summary).getByText(
        /\$45\.00 of unbudgeted spending is excluded from this progress\./,
      ),
    ).toBeVisible();
  });
});
