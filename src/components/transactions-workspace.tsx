'use client';

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  createManualTransactionAction,
  deleteTransactionAction,
  updateManualTransactionAction,
} from '@/app/app/actions';
import { formatCad, formatTransactionDate } from '@/lib/formatters';

type CategoryOption = {
  id: string;
  name: string;
};

type TransactionRow = {
  amountCents: number;
  categoryId: string;
  categoryName: string;
  description: string;
  id: string;
  notes: string | null;
  transactionDate: string;
  type: 'expense' | 'refund';
};

type EditorMode =
  { kind: 'create' } | { kind: 'edit'; transaction: TransactionRow } | null;
type TypeFilter = 'all' | TransactionRow['type'];

export function TransactionsWorkspace({
  categories,
  openOnLoad = false,
  transactions,
}: {
  categories: CategoryOption[];
  openOnLoad?: boolean;
  transactions: TransactionRow[];
}) {
  const [editor, setEditor] = useState<EditorMode>(
    openOnLoad ? { kind: 'create' } : null,
  );
  const [monthFilter, setMonthFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const months = useMemo(
    () =>
      [
        ...new Set(transactions.map((transaction) => monthKey(transaction))),
      ].sort((first, second) => second.localeCompare(first)),
    [transactions],
  );

  const visibleTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        return (
          (monthFilter === 'all' || monthKey(transaction) === monthFilter) &&
          (categoryFilter === 'all' ||
            transaction.categoryId === categoryFilter) &&
          (typeFilter === 'all' || transaction.type === typeFilter)
        );
      }),
    [categoryFilter, monthFilter, transactions, typeFilter],
  );

  return (
    <section
      aria-labelledby="transactions-heading"
      className="mx-auto max-w-[1064px]"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-[32px] font-bold leading-10 tracking-[-0.02em]"
            id="transactions-heading"
          >
            Transactions
          </h1>
          <p className="mt-1 text-sm leading-5 text-[var(--pf-text-secondary)]">
            All activity, organized by transaction date.
          </p>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center rounded-[10px] bg-[var(--pf-action-primary)] px-6 text-xs font-semibold text-[var(--pf-bg-surface)] transition-colors hover:bg-[#04594e]"
          onClick={() => setEditor({ kind: 'create' })}
          type="button"
        >
          +&nbsp; Add transaction
        </button>
      </div>

      <div
        className="mt-10 flex flex-col gap-3 sm:flex-row"
        aria-label="Transaction filters"
      >
        <FilterSelect
          ariaLabel="Filter by month"
          onChange={setMonthFilter}
          value={monthFilter}
        >
          <option value="all">All months</option>
          {months.map((month) => (
            <option key={month} value={month}>
              {formatMonth(month)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          ariaLabel="Filter by category"
          onChange={setCategoryFilter}
          value={categoryFilter}
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          ariaLabel="Filter by type"
          onChange={(value) => setTypeFilter(value as TypeFilter)}
          value={typeFilter}
        >
          <option value="all">All types</option>
          <option value="expense">Expenses</option>
          <option value="refund">Refunds</option>
        </FilterSelect>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)]">
        {visibleTransactions.length === 0 ? (
          <EmptyLedger onAdd={() => setEditor({ kind: 'create' })} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[780px] w-full text-left">
              <thead>
                <tr className="border-b border-[var(--pf-border-default)] text-xs font-semibold leading-4 text-[var(--pf-text-secondary)]">
                  <th className="px-6 py-6">Date</th>
                  <th className="px-6 py-6">Merchant</th>
                  <th className="px-6 py-6">Category</th>
                  <th className="px-6 py-6">Type</th>
                  <th className="px-6 py-6 text-right">Amount</th>
                  <th className="px-6 py-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((transaction) => (
                  <tr
                    className="border-b border-[var(--pf-border-default)] last:border-0"
                    key={transaction.id}
                  >
                    <td className="whitespace-nowrap px-6 py-[26px] text-sm leading-5 text-[var(--pf-text-secondary)]">
                      {formatTransactionDate(
                        new Date(transaction.transactionDate),
                      )}
                    </td>
                    <td className="px-6 py-[26px] text-sm leading-5 text-[var(--pf-text-primary)]">
                      <span className="line-clamp-2">
                        {transaction.description}
                      </span>
                      {transaction.notes ? (
                        <span className="mt-1 block line-clamp-1 text-xs text-[var(--pf-text-secondary)]">
                          {transaction.notes}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-6 py-[26px] text-sm leading-5 text-[var(--pf-text-secondary)]">
                      {transaction.categoryName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-[26px] text-xs font-semibold leading-4 text-[var(--pf-text-secondary)]">
                      {transaction.type === 'expense' ? 'Expense' : 'Refund'}
                    </td>
                    <td
                      className={`whitespace-nowrap px-6 py-[26px] text-right text-xs font-semibold leading-4 ${
                        transaction.type === 'expense'
                          ? 'text-[var(--pf-status-expense)]'
                          : 'text-[var(--pf-status-refund)]'
                      }`}
                    >
                      {transaction.type === 'expense' ? '-' : '+'}
                      {formatCad(transaction.amountCents)}
                    </td>
                    <td className="px-6 py-[26px] text-right">
                      <button
                        className="text-xs font-semibold leading-4 text-[var(--pf-text-secondary)] hover:text-[var(--pf-text-primary)]"
                        onClick={() => setEditor({ kind: 'edit', transaction })}
                        type="button"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editor ? (
        <TransactionDialog
          categories={categories}
          editor={editor}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </section>
  );
}

function FilterSelect({
  ariaLabel,
  children,
  onChange,
  value,
}: {
  ariaLabel: string;
  children: ReactNode;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="h-10 w-full rounded-lg border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-3 text-xs font-semibold text-[var(--pf-text-secondary)] outline-none transition-colors hover:border-[#c8d4ce] focus:border-[var(--pf-action-primary)] sm:w-[170px]"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

function EmptyLedger({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
      <h2 className="text-xl font-semibold">No transactions yet</h2>
      <p className="mt-2 max-w-sm text-sm leading-5 text-[var(--pf-text-secondary)]">
        Add your first expense or refund to begin building your ledger.
      </p>
      <button
        className="mt-6 rounded-[10px] bg-[var(--pf-action-primary)] px-5 py-3 text-xs font-semibold text-[var(--pf-bg-surface)] hover:bg-[#04594e]"
        onClick={onAdd}
        type="button"
      >
        Add transaction
      </button>
    </div>
  );
}

function TransactionDialog({
  categories,
  editor,
  onClose,
}: {
  categories: CategoryOption[];
  editor: Exclude<EditorMode, null>;
  onClose: () => void;
}) {
  return (
    <div
      aria-labelledby="transaction-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0e1317]/45 p-4"
      role="dialog"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-[var(--pf-bg-surface)] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2
              className="text-2xl font-bold leading-8"
              id="transaction-dialog-title"
            >
              {editor.kind === 'create'
                ? 'Add transaction'
                : 'Edit transaction'}
            </h2>
            <p className="mt-1 text-sm text-[var(--pf-text-secondary)]">
              Amounts are stored in Canadian dollars.
            </p>
          </div>
          <button
            aria-label="Close transaction editor"
            className="rounded-lg px-2 py-1 text-lg leading-5 text-[var(--pf-text-secondary)] hover:bg-[#f1f5f2]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        {editor.kind === 'create' ? (
          <CreateTransactionForm categories={categories} onComplete={onClose} />
        ) : (
          <EditTransactionForm
            categories={categories}
            onComplete={onClose}
            transaction={editor.transaction}
          />
        )}
      </div>
    </div>
  );
}

function CreateTransactionForm({
  categories,
  onComplete,
}: {
  categories: CategoryOption[];
  onComplete: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createManualTransactionAction,
    null,
  );

  useEffect(() => {
    if (state?.status === 'success') {
      onComplete();
    }
  }, [onComplete, state]);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <TransactionFields categories={categories} />
      <ActionMessage state={state} />
      <div className="flex justify-end gap-3 border-t border-[var(--pf-border-default)] pt-5">
        <button
          className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--pf-text-secondary)] hover:bg-[#f1f5f2]"
          onClick={onComplete}
          type="button"
        >
          Cancel
        </button>
        <button
          className="rounded-[10px] bg-[var(--pf-action-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--pf-bg-surface)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending || categories.length === 0}
          type="submit"
        >
          {pending ? 'Saving…' : 'Save transaction'}
        </button>
      </div>
    </form>
  );
}

function EditTransactionForm({
  categories,
  onComplete,
  transaction,
}: {
  categories: CategoryOption[];
  onComplete: () => void;
  transaction: TransactionRow;
}) {
  const updateAction = updateManualTransactionAction.bind(null, transaction.id);
  const [state, formAction, pending] = useActionState(updateAction, null);

  useEffect(() => {
    if (state?.status === 'success') {
      onComplete();
    }
  }, [onComplete, state]);

  return (
    <>
      <form action={formAction} className="mt-8 space-y-5">
        <TransactionFields categories={categories} transaction={transaction} />
        <ActionMessage state={state} />
        <div className="flex justify-end gap-3 border-t border-[var(--pf-border-default)] pt-5">
          <button
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--pf-text-secondary)] hover:bg-[#f1f5f2]"
            onClick={onComplete}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-[10px] bg-[var(--pf-action-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--pf-bg-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending || categories.length === 0}
            type="submit"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
      <DeleteTransactionForm
        onComplete={onComplete}
        transactionId={transaction.id}
      />
    </>
  );
}

function TransactionFields({
  categories,
  transaction,
}: {
  categories: CategoryOption[];
  transaction?: TransactionRow;
}) {
  return (
    <fieldset className="grid gap-5 sm:grid-cols-2">
      <legend className="sr-only">Transaction details</legend>
      <label className="grid gap-2 text-sm font-semibold text-[var(--pf-text-primary)]">
        Type
        <select
          className={fieldClassName}
          defaultValue={transaction?.type ?? 'expense'}
          name="type"
        >
          <option value="expense">Expense</option>
          <option value="refund">Refund</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-[var(--pf-text-primary)]">
        Date
        <input
          className={fieldClassName}
          defaultValue={
            transaction?.transactionDate.slice(0, 10) ??
            new Date().toISOString().slice(0, 10)
          }
          name="transactionDate"
          required
          type="date"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-[var(--pf-text-primary)] sm:col-span-2">
        Description or merchant
        <input
          className={fieldClassName}
          defaultValue={transaction?.description}
          maxLength={160}
          name="description"
          required
          type="text"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-[var(--pf-text-primary)]">
        Category
        <select
          className={fieldClassName}
          defaultValue={transaction?.categoryId}
          name="categoryId"
          required
        >
          <option disabled value="">
            Choose a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-[var(--pf-text-primary)]">
        Amount (CAD)
        <input
          className={fieldClassName}
          defaultValue={
            transaction ? (transaction.amountCents / 100).toFixed(2) : undefined
          }
          inputMode="decimal"
          name="amount"
          placeholder="0.00"
          required
          step="0.01"
          type="number"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-[var(--pf-text-primary)] sm:col-span-2">
        Notes{' '}
        <span className="font-normal text-[var(--pf-text-secondary)]">
          (optional)
        </span>
        <textarea
          className={`${fieldClassName} min-h-24 resize-y`}
          defaultValue={transaction?.notes ?? ''}
          maxLength={1000}
          name="notes"
          rows={3}
        />
      </label>
    </fieldset>
  );
}

function DeleteTransactionForm({
  onComplete,
  transactionId,
}: {
  onComplete: () => void;
  transactionId: string;
}) {
  const deleteAction = deleteTransactionAction.bind(null, transactionId);
  const [state, formAction, pending] = useActionState(deleteAction, null);

  useEffect(() => {
    if (state?.status === 'success') {
      onComplete();
    }
  }, [onComplete, state]);

  return (
    <form
      action={formAction}
      className="mt-8 border-t border-[var(--pf-border-default)] pt-5"
    >
      <label className="flex items-start gap-3 text-sm leading-5 text-[var(--pf-text-secondary)]">
        <input
          className="mt-1"
          name="confirmation"
          type="checkbox"
          value="delete"
        />
        I understand this permanently deletes this transaction.
      </label>
      <ActionMessage state={state} />
      <button
        className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-[var(--pf-status-expense)] hover:bg-[#fff0ed] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Deleting…' : 'Delete transaction'}
      </button>
    </form>
  );
}

function ActionMessage({
  state,
}: {
  state: { message: string; status: 'error' | 'success' } | null;
}) {
  if (!state) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={`rounded-lg px-3 py-2 text-sm ${
        state.status === 'error'
          ? 'bg-[#fff0ed] text-[var(--pf-status-expense)]'
          : 'bg-[#e5f3ef] text-[var(--pf-status-refund)]'
      }`}
      role={state.status === 'error' ? 'alert' : undefined}
    >
      {state.message}
    </p>
  );
}

const fieldClassName =
  'h-11 rounded-lg border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-3 text-sm font-normal text-[var(--pf-text-primary)] outline-none transition-colors placeholder:text-[#9aa7a9] focus:border-[var(--pf-action-primary)]';

function monthKey(transaction: TransactionRow) {
  return transaction.transactionDate.slice(0, 7);
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${value}-01T00:00:00.000Z`));
}
