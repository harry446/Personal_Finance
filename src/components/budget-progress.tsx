import Link from 'next/link';

import type { BudgetDashboard } from '@/lib/budget-calculations';
import { formatCad } from '@/lib/formatters';

export function BudgetProgress({
  budget,
  monthLabel,
  monthlySpendingCents,
}: {
  budget?: BudgetDashboard;
  monthLabel: string;
  monthlySpendingCents?: number;
}) {
  if (!budget?.enabled) {
    return null;
  }

  const totalBudgetCents = budget.progress.reduce(
    (total, progress) => total + progress.configuredLimitCents,
    0,
  );
  const totalSpentCents =
    monthlySpendingCents ??
    budget.progress.reduce((total, progress) => total + progress.usageCents, 0);
  const remainingCents = totalBudgetCents - totalSpentCents;
  const progressPercent = percentage(totalSpentCents, totalBudgetCents);

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
              <SummaryValue label="Spent" value={formatCad(totalSpentCents)} />
              <SummaryValue
                label={remainingCents < 0 ? 'Over by' : 'Left to spend'}
                tone={remainingCents < 0 ? 'expense' : 'action'}
                value={formatCad(Math.abs(remainingCents))}
              />
              <SummaryValue
                label="Budget"
                value={formatCad(totalBudgetCents)}
              />
            </div>
            <div
              aria-label={`${formatCad(totalSpentCents)} spent of ${formatCad(totalBudgetCents)} monthly budget`}
              aria-valuemax={Math.max(totalBudgetCents, 0)}
              aria-valuemin={0}
              aria-valuenow={Math.max(0, totalSpentCents)}
              className="mt-5 h-3 overflow-hidden rounded-full bg-[#dbe9e5]"
              role="progressbar"
            >
              <span
                className={
                  'block h-full rounded-full transition-[width] ' +
                  (remainingCents < 0
                    ? 'bg-[var(--pf-status-expense)]'
                    : 'bg-[var(--pf-action-primary)]')
                }
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-4 text-[var(--pf-text-secondary)]">
              {budget.progress.length} category budget
              {budget.progress.length === 1 ? '' : 's'} configured. Refunds
              reduce spending in the month they occur.
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
