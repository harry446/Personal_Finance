'use client';

import { useActionState, useEffect, useState } from 'react';

import {
  setBudgetModeAction,
  upsertCurrentBudgetConfigurationAction,
} from '@/app/app/actions';
import type { BudgetProgress as BudgetProgressData } from '@/lib/budget-calculations';
import { formatCad } from '@/lib/formatters';

type BudgetMode = 'monthly_reset' | 'rollover';

type BudgetCategory = {
  categoryId: string;
  configuration: {
    amountCents: number;
    effectiveMonth: string;
    mode: BudgetMode;
  } | null;
  name: string;
};

type ActionState = { message: string; status: 'error' | 'success' } | null;

export function BudgetsWorkspace({
  budgetModeEnabled,
  categories,
  currentMonth,
  progress,
}: {
  budgetModeEnabled: boolean;
  categories: BudgetCategory[];
  currentMonth: string;
  progress: BudgetProgressData[];
}) {
  const [editor, setEditor] = useState<BudgetCategory | null>(null);
  const progressByCategoryId = new Map(
    progress.map((item) => [item.categoryId, item]),
  );

  return (
    <section
      aria-labelledby="budgets-heading"
      className="mx-auto max-w-[1064px] pb-10"
    >
      <div>
        <h1
          className="text-[32px] font-bold leading-10 tracking-[-0.02em]"
          id="budgets-heading"
        >
          Budgets
        </h1>
        <p className="mt-1 text-sm leading-5 text-[var(--pf-text-secondary)]">
          Set optional category limits without changing the ledger.
        </p>
      </div>

      <BudgetModeControl enabled={budgetModeEnabled} />

      {budgetModeEnabled ? (
        <section
          aria-labelledby="category-budgets-heading"
          className="mt-8 overflow-hidden rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)]"
        >
          <div className="flex flex-col gap-2 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2
                className="text-xl font-semibold leading-7"
                id="category-budgets-heading"
              >
                Category budgets
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-[var(--pf-text-secondary)]">
                Changes take effect in {formatMonth(currentMonth)}. Earlier
                month configurations stay unchanged.
              </p>
            </div>
            <p className="text-xs font-semibold text-[var(--pf-action-primary)]">
              {categories.length} active
            </p>
          </div>

          {categories.length === 0 ? (
            <p className="border-t border-[var(--pf-border-default)] px-6 py-10 text-sm text-[var(--pf-text-secondary)]">
              Add an active category before setting a budget.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--pf-border-default)]">
              {categories.map((category) => {
                const categoryProgress = progressByCategoryId.get(
                  category.categoryId,
                );

                return (
                  <li
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                    key={category.categoryId}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold leading-6">
                        {category.name}
                      </p>
                      {category.configuration ? (
                        <>
                          <BudgetMeter
                            categoryName={category.name}
                            progress={categoryProgress}
                          />
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-[var(--pf-text-secondary)]">
                          No budget is configured yet.
                        </p>
                      )}
                    </div>
                    <button
                      className="shrink-0 text-sm font-semibold text-[var(--pf-action-primary)] hover:text-[#04594e]"
                      onClick={() => setEditor(category)}
                      type="button"
                    >
                      {category.configuration ? 'Edit budget' : 'Set budget'}{' '}
                      <span className="sr-only">for {category.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section className="mt-8 rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-6 py-8">
          <h2 className="text-xl font-semibold leading-7">
            Budget mode is off
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--pf-text-secondary)]">
            Turn it on to set active-category budgets and see monthly progress
            on your overview. Existing budget history remains private and
            unchanged while this mode is off.
          </p>
        </section>
      )}

      {editor ? (
        <BudgetDialog
          category={editor}
          currentMonth={currentMonth}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </section>
  );
}

function BudgetMeter({
  categoryName,
  progress,
}: {
  categoryName: string;
  progress: BudgetProgressData | undefined;
}) {
  if (!progress) {
    return (
      <p className="mt-3 text-sm text-[var(--pf-text-secondary)]">
        Current-month progress is unavailable. Refresh the page to try again.
      </p>
    );
  }

  const isOverBudget = progress.overageCents > 0;
  const balanceCents = isOverBudget
    ? progress.overageCents
    : progress.availableCents;
  const barLimitCents =
    progress.mode === 'rollover'
      ? Math.max(
          progress.configuredLimitCents,
          progress.usageCents + Math.max(progress.availableCents, 0),
          1,
        )
      : Math.max(progress.configuredLimitCents, 1);

  return (
    <div className="mt-4 rounded-xl bg-[#f4f8f6] p-4 sm:p-5">
      <div className="grid grid-cols-3 gap-3">
        <BudgetStat label="Spent" value={formatCad(progress.usageCents)} />
        <BudgetStat
          label={isOverBudget ? 'Over by' : 'Left to spend'}
          tone={isOverBudget ? 'expense' : 'action'}
          value={formatCad(balanceCents)}
        />
        <BudgetStat
          label="Limit"
          value={formatCad(progress.configuredLimitCents)}
        />
      </div>
      <div
        aria-label={`${categoryName} budget progress`}
        aria-valuemax={barLimitCents}
        aria-valuemin={0}
        aria-valuenow={Math.max(0, progress.usageCents)}
        className="mt-4 h-3 overflow-hidden rounded-full bg-[#dbe9e5]"
        role="progressbar"
      >
        <span
          className={
            'block h-full rounded-full transition-[width] ' +
            (isOverBudget
              ? 'bg-[var(--pf-status-expense)]'
              : 'bg-[var(--pf-action-primary)]')
          }
          style={{
            width: `${percentage(progress.usageCents, barLimitCents)}%`,
          }}
        />
      </div>
      <p className="mt-3 text-xs leading-4 text-[var(--pf-text-secondary)]">
        {progress.mode === 'rollover' && progress.rolloverWindowStartMonth
          ? `Rollover available since ${formatMonth(progress.rolloverWindowStartMonth)}.`
          : `Monthly reset · effective ${formatMonth(progress.configurationEffectiveMonth)}.`}
      </p>
    </div>
  );
}

function BudgetStat({
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
function BudgetModeControl({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState(
    setBudgetModeAction,
    null,
  );

  return (
    <section className="mt-8 rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold leading-7">Budget mode</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--pf-text-secondary)]">
            {enabled
              ? 'On — budget progress is visible on the Overview page.'
              : 'Off — budget progress is hidden from the Overview page.'}
          </p>
        </div>
        <form action={formAction}>
          <input
            name="enabled"
            type="hidden"
            value={enabled ? 'false' : 'true'}
          />
          <button
            className="rounded-[10px] border border-[var(--pf-action-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--pf-action-primary)] transition-colors hover:bg-[#e5f3ef] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending
              ? 'Saving…'
              : enabled
                ? 'Turn budget mode off'
                : 'Turn budget mode on'}
          </button>
        </form>
      </div>
      <ActionMessage state={state} />
    </section>
  );
}

function BudgetDialog({
  category,
  currentMonth,
  onClose,
}: {
  category: BudgetCategory;
  currentMonth: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    upsertCurrentBudgetConfigurationAction,
    null,
  );

  useEffect(() => {
    if (state?.status === 'success') {
      onClose();
    }
  }, [onClose, state]);

  return (
    <div
      aria-labelledby="budget-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0e1317]/45 p-4"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-xl bg-[var(--pf-bg-surface)] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2
              className="text-2xl font-bold leading-8"
              id="budget-dialog-title"
            >
              {category.configuration ? 'Edit budget' : 'Set budget'} for{' '}
              {category.name}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[var(--pf-text-secondary)]">
              This change applies from {formatMonth(currentMonth)}. Earlier
              month configurations cannot be rewritten.
            </p>
          </div>
          <button
            aria-label="Close budget editor"
            className="rounded-lg px-2 py-1 text-lg leading-5 text-[var(--pf-text-secondary)] hover:bg-[#f1f5f2]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <form action={formAction} className="mt-8 space-y-5">
          <input name="categoryId" type="hidden" value={category.categoryId} />
          <label className="grid gap-2 text-sm font-semibold">
            Monthly amount (CAD)
            <input
              className={fieldClassName}
              defaultValue={
                category.configuration
                  ? (category.configuration.amountCents / 100).toFixed(2)
                  : ''
              }
              inputMode="decimal"
              min="0.01"
              name="amount"
              placeholder="0.00"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Budget behavior
            <select
              className={fieldClassName}
              defaultValue={category.configuration?.mode ?? 'monthly_reset'}
              name="mode"
            >
              <option value="monthly_reset">Monthly reset</option>
              <option value="rollover">Rollover</option>
            </select>
          </label>
          <p className="rounded-lg bg-[#e5f3ef] px-4 py-3 text-sm leading-5 text-[var(--pf-text-secondary)]">
            Refunds reduce spending in the month of the refund. Rollover keeps
            both unused amounts and overages across later months.
          </p>
          <ActionMessage state={state} />
          <div className="flex justify-end gap-3 border-t border-[var(--pf-border-default)] pt-5">
            <button
              className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--pf-text-secondary)] hover:bg-[#f1f5f2]"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-[10px] bg-[var(--pf-action-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--pf-bg-surface)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? 'Saving…' : 'Save budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActionMessage({ state }: { state: ActionState }) {
  if (!state) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={
        'mt-4 rounded-lg px-3 py-2 text-sm ' +
        (state.status === 'error'
          ? 'bg-[#fff0ed] text-[var(--pf-status-expense)]'
          : 'bg-[#e5f3ef] text-[var(--pf-status-refund)]')
      }
      role={state.status === 'error' ? 'alert' : undefined}
    >
      {state.message}
    </p>
  );
}

const fieldClassName =
  'h-11 rounded-lg border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-3 text-sm font-normal text-[var(--pf-text-primary)] outline-none transition-colors placeholder:text-[#9aa7a9] focus:border-[var(--pf-action-primary)]';

function formatMonth(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(value + '-01T00:00:00.000Z'));
}
