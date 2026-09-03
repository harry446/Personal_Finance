import Link from 'next/link';

import { BudgetProgress } from '@/components/budget-progress';
import type { MonthlyDashboard } from '@/lib/dashboard-calculations';
import { formatCad } from '@/lib/formatters';

export function DashboardWorkspace({
  dashboard,
}: {
  dashboard: MonthlyDashboard;
}) {
  if (!dashboard.hasTransactions) {
    return (
      <DashboardEmptyState
        budget={dashboard.budget}
        month={dashboard.month.key}
      />
    );
  }

  const monthLabel = formatMonth(dashboard.month.key);
  const previousMonth = shiftMonth(dashboard.month.key, -1);
  const nextMonth = shiftMonth(dashboard.month.key, 1);
  const expenseCount = dashboard.expenseTransactionCount;
  const refundCount = dashboard.refundTransactionCount;

  return (
    <div className="mx-auto max-w-[1064px] pb-10">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-10 tracking-tight sm:text-[32px]">
            Overview
          </h1>
          <p className="mt-2 text-xs leading-5 text-[var(--pf-text-secondary)]">
            Totals reflect transaction dates, not when records were entered or
            imported.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector
            label={monthLabel}
            nextMonth={nextMonth}
            previousMonth={previousMonth}
          />
          <Link
            className="rounded-[10px] bg-[var(--pf-action-primary)] px-5 py-3 text-xs font-semibold text-[var(--pf-action-on-primary)] transition-colors hover:bg-[#04594e]"
            href="/app/transactions?new=1"
          >
            +&nbsp; Add transaction
          </Link>
        </div>
      </div>

      <section
        aria-label={`${monthLabel} spending summary`}
        className="mt-6 grid gap-4 md:grid-cols-3"
      >
        <MetricCard
          detail="After refunds"
          label="Net spending"
          value={formatCad(dashboard.netSpendingCents)}
        />
        <MetricCard
          detail={transactionCountLabel(expenseCount, 'expense')}
          label="Expenses"
          value={formatCad(dashboard.grossExpensesCents)}
        />
        <MetricCard
          detail={transactionCountLabel(refundCount, 'refund')}
          label="Refunds"
          value={formatCad(dashboard.refundsCents)}
        />
      </section>

      <BudgetProgress
        budget={dashboard.budget}
        monthLabel={monthLabel}
        monthlySpendingCents={dashboard.netSpendingCents}
      />

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <TrendCard dashboard={dashboard} monthLabel={monthLabel} />
        <CategoryCard categoryTotals={dashboard.categoryTotals} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <RecentTransactions transactions={dashboard.recentTransactions} />
        <DashboardGuide />
      </section>
    </div>
  );
}

export function DashboardEmptyState({
  budget,
  month,
}: {
  budget?: MonthlyDashboard['budget'];
  month: string;
}) {
  const monthLabel = formatMonth(month);
  const previousMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  return (
    <div className="mx-auto max-w-[1064px] pb-10">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-10 tracking-tight sm:text-[32px]">
            Overview
          </h1>
          <p className="mt-2 text-xs leading-5 text-[var(--pf-text-secondary)]">
            Totals reflect transaction dates, not when records were entered or
            imported.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector
            label={monthLabel}
            nextMonth={nextMonth}
            previousMonth={previousMonth}
          />
          <Link
            className="rounded-[10px] bg-[var(--pf-action-primary)] px-5 py-3 text-xs font-semibold text-[var(--pf-action-on-primary)] transition-colors hover:bg-[#04594e]"
            href="/app/transactions?new=1"
          >
            +&nbsp; Add transaction
          </Link>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-6 py-12 text-center sm:px-10">
        <p className="text-sm font-semibold text-[var(--pf-action-primary)] uppercase tracking-[0.14em]">
          {monthLabel}
        </p>
        <h2 className="mt-4 text-2xl font-bold tracking-tight">
          No transactions in this month yet.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--pf-text-secondary)]">
          Add an expense or refund with a transaction date in {monthLabel} to
          see your spending trend, category totals, and recent activity here.
        </p>
        <Link
          className="mt-7 inline-flex rounded-[10px] bg-[var(--pf-action-primary)] px-5 py-3 text-sm font-semibold text-[var(--pf-action-on-primary)] transition-colors hover:bg-[#04594e]"
          href="/app/transactions?new=1"
        >
          Add your first transaction
        </Link>
      </section>
      <BudgetProgress
        budget={budget}
        monthLabel={monthLabel}
        monthlySpendingCents={0}
      />
    </div>
  );
}

export function DashboardInvalidMonthState({ value }: { value: string }) {
  return (
    <div className="mx-auto max-w-[760px] py-12">
      <p className="text-sm font-semibold text-[var(--pf-action-primary)] uppercase tracking-[0.14em]">
        Dashboard
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        Choose a valid month.
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--pf-text-secondary)]">
        {value
          ? `“${value}” is not valid.`
          : 'The requested month is not valid.'}{' '}
        Use the format YYYY-MM, such as 2026-08.
      </p>
      <Link
        className="mt-7 inline-flex rounded-[10px] bg-[var(--pf-action-primary)] px-5 py-3 text-sm font-semibold text-[var(--pf-action-on-primary)]"
        href="/app"
      >
        Return to the current month
      </Link>
    </div>
  );
}

function MetricCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <article className="min-h-36 rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] p-5">
      <p className="text-xs font-semibold leading-4 text-[var(--pf-text-secondary)]">
        {label}
      </p>
      <p className="mt-2 text-[28px] font-semibold leading-[34px] tracking-tight">
        {value}
      </p>
      <p className="mt-3 text-sm leading-5 text-[var(--pf-text-secondary)]">
        {detail}
      </p>
    </article>
  );
}

function MonthSelector({
  label,
  nextMonth,
  previousMonth,
}: {
  label: string;
  nextMonth: string;
  previousMonth: string;
}) {
  return (
    <div
      aria-label="Dashboard month"
      className="flex h-11 min-w-[220px] items-center justify-between rounded-[10px] border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-3"
    >
      <Link
        aria-label={`Show ${formatMonth(previousMonth)}`}
        className="rounded px-2 text-lg leading-7 text-[var(--pf-action-primary)] hover:bg-[#e5f3ef]"
        href={`/app?month=${previousMonth}`}
      >
        ‹
      </Link>
      <p className="text-xs font-semibold text-[var(--pf-text-primary)]">
        {label}
      </p>
      <Link
        aria-label={`Show ${formatMonth(nextMonth)}`}
        className="rounded px-2 text-lg leading-7 text-[var(--pf-action-primary)] hover:bg-[#e5f3ef]"
        href={`/app?month=${nextMonth}`}
      >
        ›
      </Link>
    </div>
  );
}

function TrendCard({
  dashboard,
  monthLabel,
}: {
  dashboard: MonthlyDashboard;
  monthLabel: string;
}) {
  const activeDays = dashboard.dailyTrend.filter(
    (day) => day.expenseCents > 0 || day.refundCents > 0,
  );
  const chartDays = activeDays.length > 0 ? activeDays : dashboard.dailyTrend;
  const maximum = Math.max(
    ...chartDays.map((day) => Math.max(day.expenseCents, day.refundCents)),
    1,
  );

  return (
    <article className="rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] p-6">
      <h2 className="text-xl font-semibold leading-7">Spending trend</h2>
      <p className="mt-1 text-sm leading-5 text-[var(--pf-text-secondary)]">
        Expenses and refunds by transaction date
      </p>
      <div className="mt-5 flex items-center gap-4 text-xs text-[var(--pf-text-secondary)]">
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[var(--pf-action-primary)]" />
          Expenses
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#8fcfc3]" />
          Refunds
        </span>
      </div>
      <figure
        aria-label={`${monthLabel} expense and refund trend by transaction date`}
        className="mt-5 h-40 overflow-x-auto"
      >
        <div className="flex h-[142px] min-w-max items-end gap-2 border-b border-[var(--pf-border-default)] px-1">
          {chartDays.map((day) => {
            const expenseHeight = Math.max(
              day.expenseCents > 0 ? 7 : 0,
              Math.round((day.expenseCents / maximum) * 128),
            );
            const refundHeight = Math.max(
              day.refundCents > 0 ? 7 : 0,
              Math.round((day.refundCents / maximum) * 128),
            );

            return (
              <div
                className="flex h-full min-w-7 flex-1 flex-col justify-end gap-1"
                key={day.date}
                title={`${formatDay(day.date)}: ${formatCad(day.expenseCents)} expenses, ${formatCad(day.refundCents)} refunds`}
              >
                <span
                  aria-hidden="true"
                  className="block rounded-[6px] bg-[#8fcfc3]"
                  style={{ height: `${refundHeight}px` }}
                />
                <span
                  aria-hidden="true"
                  className="block rounded-[6px] bg-[var(--pf-action-primary)]"
                  style={{ height: `${expenseHeight}px` }}
                />
                <span className="sr-only">
                  {formatDay(day.date)}: {formatCad(day.expenseCents)} expenses
                  and {formatCad(day.refundCents)} refunds
                </span>
              </div>
            );
          })}
        </div>
      </figure>
      <p className="mt-2 text-[11px] leading-4 text-[var(--pf-text-secondary)]">
        Expenses are shown in dark teal. Refunds are shown separately and reduce
        net spending for this month.
      </p>
    </article>
  );
}

function CategoryCard({
  categoryTotals,
}: {
  categoryTotals: MonthlyDashboard['categoryTotals'];
}) {
  return (
    <article
      aria-label="Top categories"
      className="rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] p-6"
    >
      <h2 className="text-xl font-semibold leading-7">Top categories</h2>
      <div className="mt-6 divide-y divide-[var(--pf-border-default)]">
        {categoryTotals.slice(0, 5).map((category) => (
          <div
            className="flex items-center justify-between gap-4 py-3 first:pt-0"
            key={category.categoryId}
          >
            <span className="min-w-0 truncate text-sm text-[var(--pf-text-secondary)]">
              {category.name}
              {category.archived ? ' (archived)' : ''}
            </span>
            <span
              className={`shrink-0 text-xs font-semibold ${
                category.netCents < 0
                  ? 'text-[var(--pf-status-refund)]'
                  : 'text-[var(--pf-text-primary)]'
              }`}
            >
              {formatCad(category.netCents)}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function RecentTransactions({
  transactions,
}: {
  transactions: MonthlyDashboard['recentTransactions'];
}) {
  return (
    <article
      aria-label="Recent transactions"
      className="rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] p-6"
    >
      <h2 className="text-xl font-semibold leading-7">Recent transactions</h2>
      <div className="mt-6 divide-y divide-[var(--pf-border-default)]">
        {transactions.map((transaction) => (
          <div
            className="grid gap-1 py-3 text-sm sm:grid-cols-[70px_minmax(0,1fr)_minmax(110px,0.9fr)_auto] sm:items-center sm:gap-4"
            key={transaction.id}
          >
            <time
              className="text-xs font-semibold text-[var(--pf-text-secondary)]"
              dateTime={transaction.transactionDate}
            >
              {formatDay(transaction.transactionDate)}
            </time>
            <p className="min-w-0 truncate text-[var(--pf-text-secondary)]">
              {transaction.description}
            </p>
            <p className="text-xs font-semibold text-[var(--pf-text-secondary)]">
              {transaction.categoryName}
            </p>
            <p
              className={`text-xs font-semibold sm:text-right ${
                transaction.type === 'expense'
                  ? 'text-[var(--pf-status-expense)]'
                  : 'text-[var(--pf-status-refund)]'
              }`}
            >
              {transaction.type === 'expense' ? '−' : '+'}
              {formatCad(transaction.amountCents)}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function DashboardGuide() {
  return (
    <aside className="rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] p-6">
      <h2 className="text-xl font-semibold leading-7">Monthly view</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--pf-text-secondary)]">
        Category totals are net spending: expenses increase them and refunds
        reduce them in the transaction’s own calendar month.
      </p>
      <Link
        className="mt-6 inline-flex text-sm font-semibold text-[var(--pf-action-primary)] hover:underline"
        href="/app/transactions"
      >
        View all transactions
      </Link>
    </aside>
  );
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${value}-01T00:00:00.000Z`));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function transactionCountLabel(count: number, type: 'expense' | 'refund') {
  return `${count} ${type} transaction${count === 1 ? '' : 's'}`;
}

function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));

  return `${shifted.getUTCFullYear()}-${String(
    shifted.getUTCMonth() + 1,
  ).padStart(2, '0')}`;
}
