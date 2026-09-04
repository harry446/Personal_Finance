import Link from 'next/link';

import {
  summarizeBudgetProgress,
  type BudgetDashboard,
} from '@/lib/budget-calculations';
import { formatCad } from '@/lib/formatters';

export function BudgetProgress({
  budget,
  categoryTotals = [],
  monthLabel,
}: {
  budget?: BudgetDashboard;
  categoryTotals?: Array<{ categoryId: string; netCents: number }>;
  monthLabel: string;
}) {
  if (!budget?.enabled) {
    return null;
  }

  const summary = summarizeBudgetProgress(budget.progress);
  const budgetedCategoryIds = new Set(
    budget.progress.map((progress) => progress.categoryId),
  );
  const unbudgetedNetSpendingCents = categoryTotals.reduce(
    (total, category) =>
      budgetedCategoryIds.has(category.categoryId)
        ? total
        : total + category.netCents,
    0,
  );
  const barLimitCents = Math.max(
    summary.effectiveBudgetCents,
    summary.budgetedSpendingCents,
    1,
  );
  const progressPercent = percentage(
    summary.budgetedSpendingCents,
    barLimitCents,
  );

  return (
    <section aria-label="Budget progress" className="mt-8">
      <Link
        aria-label={`Open detailed budgets for ${monthLabel}`}
        className="group block rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] p-6 transition-colors hover:border-[#9fc8bf] hover:bg-[#fcfffd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-action-primary)]"
        href="/app/budgets"
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--pf-text-secondary)]">
              Monthly budget
            </p>
            <h2 className="mt-2 text-xl font-semibold leading-7">
              {monthLabel}
            </h2>
          </div>
          <span className="text-sm font-semibold text-[var(--pf-action-primary)] group-hover:underline">
            View details
          </span>
        </div>

        {budget.progress.length === 0 ? (
          <p className="mt-6 text-sm leading-5 text-[var(--pf-text-secondary)]">
            No category budgets are configured yet. Set one up to see your
            monthly plan here.
          </p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-3 gap-4 border-y border-[var(--pf-border-default)] py-5">
              <SummaryValue
                label="Budgeted spent"
                value={formatCad(summary.budgetedSpendingCents)}
              />
              <SummaryValue
                label="Available"
                tone="action"
                value={formatCad(summary.availableCents)}
              />
              <SummaryValue
                label="Budget capacity"
                value={formatCad(summary.effectiveBudgetCents)}
              />
            </div>
            <div
              aria-label={`${formatCad(summary.budgetedSpendingCents)} budgeted spending of ${formatCad(summary.effectiveBudgetCents)} budget capacity`}
              aria-valuemax={barLimitCents}
              aria-valuemin={0}
              aria-valuenow={Math.max(0, summary.budgetedSpendingCents)}
              className="mt-5 h-3 overflow-hidden rounded-full bg-[#dbe9e5]"
              role="progressbar"
            >
              <span
                className={
                  'block h-full rounded-full transition-[width] ' +
                  (summary.overageCents > 0
                    ? 'bg-[var(--pf-status-expense)]'
                    : 'bg-[var(--pf-action-primary)]')
                }
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-4 text-[var(--pf-text-secondary)]">
              {budget.progress.length} category budget
              {budget.progress.length === 1 ? '' : 's'} configured.
              {summary.rolloverCapacityAdjustmentCents > 0
                ? ` ${formatCad(summary.rolloverCapacityAdjustmentCents)} is carried forward through rollover.`
                : summary.rolloverCapacityAdjustmentCents < 0
                  ? ` A prior rollover overage reduces capacity by ${formatCad(Math.abs(summary.rolloverCapacityAdjustmentCents))}.`
                  : ''}
              {summary.overageCents > 0
                ? ` ${formatCad(summary.overageCents)} is over budget across its category.`
                : ''}
              {unbudgetedNetSpendingCents > 0
                ? ` ${formatCad(unbudgetedNetSpendingCents)} of unbudgeted spending is excluded from this progress.`
                : unbudgetedNetSpendingCents < 0
                  ? ` ${formatCad(Math.abs(unbudgetedNetSpendingCents))} in unbudgeted refunds is excluded from this progress.`
                  : ' Refunds reduce budgeted spending in the month they occur.'}
            </p>
          </>
        )}
      </Link>
    </section>
  );
}

function SummaryValue({
  label,
  tone = 'primary',
  value,
}: {
  label: string;
  tone?: 'action' | 'expense' | 'primary';
  value: string;
}) {
  const toneClassName =
    tone === 'action'
      ? 'text-[var(--pf-action-primary)]'
      : tone === 'expense'
        ? 'text-[var(--pf-status-expense)]'
        : 'text-[var(--pf-text-primary)]';

  return (
    <div>
      <p className="text-xs font-semibold leading-4 text-[var(--pf-text-secondary)]">
        {label}
      </p>
      <p className={'mt-1 text-lg font-semibold leading-6 ' + toneClassName}>
        {value}
      </p>
    </div>
  );
}

function percentage(spentCents: number, limitCents: number) {
  if (limitCents <= 0 || spentCents <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((spentCents / limitCents) * 100));
}
