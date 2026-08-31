'use client';

import Image from 'next/image';
import { useActionState, useEffect, useState } from 'react';

import {
  archiveCategoryAction,
  createCategoryAction,
  renameCategoryAction,
  restoreCategoryAction,
} from '@/app/app/actions';

type ActiveCategory = {
  id: string;
  name: string;
  transactionCount: number;
};

type ArchivedCategory = ActiveCategory & {
  archivedAt: string | null;
};

type CategoryEditor =
  { kind: 'create' } | { category: ActiveCategory; kind: 'edit' } | null;

type ActionState = { message: string; status: 'error' | 'success' } | null;

export function CategoriesWorkspace({
  activeCategories,
  archivedCategories,
}: {
  activeCategories: ActiveCategory[];
  archivedCategories: ArchivedCategory[];
}) {
  const [editor, setEditor] = useState<CategoryEditor>(null);

  return (
    <section
      aria-labelledby="categories-heading"
      className="mx-auto max-w-[1096px]"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-[30px] font-bold leading-[43px] tracking-[-0.02em]"
            id="categories-heading"
          >
            Categories
          </h1>
          <p className="text-sm leading-5 text-[var(--pf-text-secondary)]">
            Organize new transaction choices without losing historical context.
          </p>
        </div>
        <button
          className="inline-flex h-[46px] items-center justify-center rounded-[10px] bg-[var(--pf-action-primary)] px-5 text-[13px] font-semibold text-[var(--pf-bg-surface)] transition-colors hover:bg-[#04594e]"
          onClick={() => setEditor({ kind: 'create' })}
          type="button"
        >
          + Add category
        </button>
      </div>

      <section
        aria-labelledby="active-categories-heading"
        className="mt-12 rounded-2xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)]"
      >
        <div className="flex flex-col gap-3 px-6 pb-5 pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2
              className="text-[19px] font-bold leading-[27px]"
              id="active-categories-heading"
            >
              Active categories
            </h2>
            <p className="mt-1 text-[13px] leading-[18px] text-[var(--pf-text-secondary)]">
              These are available for new manual entries and AI-import review.
            </p>
          </div>
          <p className="text-xs font-semibold leading-[17px] text-[var(--pf-action-primary)]">
            {activeCategories.length} active
          </p>
        </div>
        {activeCategories.length === 0 ? (
          <div className="border-t border-[var(--pf-border-default)] px-6 py-10 text-sm text-[var(--pf-text-secondary)]">
            Add a category to make it available for transactions.
          </div>
        ) : (
          <ul className="max-h-[510px] overflow-y-auto border-t border-[var(--pf-border-default)] px-6">
            {activeCategories.map((category) => (
              <li
                className="flex min-h-[58px] items-center gap-3 border-b border-[var(--pf-border-default)] last:border-0"
                key={category.id}
              >
                <Image
                  alt=""
                  height={10}
                  src="/figma/category-color.svg"
                  width={10}
                />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-5">
                  {category.name}
                </p>
                <p className="hidden whitespace-nowrap text-[13px] leading-[18px] text-[var(--pf-text-secondary)] sm:block sm:w-48">
                  {transactionCountLabel(category.transactionCount)}
                </p>
                <button
                  className="text-[13px] font-semibold leading-[18px] text-[var(--pf-action-primary)] hover:text-[#04594e]"
                  onClick={() => setEditor({ category, kind: 'edit' })}
                  type="button"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="archived-categories-heading"
        className="mt-6 rounded-2xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-6 py-6"
      >
        <h2
          className="text-[19px] font-bold leading-[27px]"
          id="archived-categories-heading"
        >
          Archived categories
        </h2>
        <p className="mt-1 text-[13px] leading-[18px] text-[var(--pf-text-secondary)]">
          Archived categories are hidden from new entries, while historical
          transactions keep their original category.
        </p>
        <div className="mt-5 rounded-[10px] bg-[#d1ede3] px-5 py-3">
          <p className="text-[13px] font-semibold leading-[18px]">
            Restore instead of duplicate
          </p>
          <p className="mt-1 text-xs leading-[17px] text-[var(--pf-text-secondary)]">
            Creating a matching name restores the archived category after
            trim-and-case-insensitive matching.
          </p>
        </div>
        {archivedCategories.length === 0 ? (
          <p className="pt-5 text-sm text-[var(--pf-text-secondary)]">
            No categories are archived.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--pf-border-default)]">
            {archivedCategories.map((category) => (
              <li
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                key={category.id}
              >
                <div>
                  <p className="text-sm font-medium leading-5">
                    {category.name}
                  </p>
                  <p className="mt-1 text-xs leading-[17px] text-[var(--pf-text-secondary)]">
                    {transactionCountLabel(category.transactionCount)} ·
                    archived{' '}
                    {category.archivedAt
                      ? formatArchiveDate(category.archivedAt)
                      : 'recently'}
                  </p>
                </div>
                <RestoreCategoryForm categoryId={category.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {editor ? (
        <CategoryDialog editor={editor} onClose={() => setEditor(null)} />
      ) : null}
    </section>
  );
}

function CategoryDialog({
  editor,
  onClose,
}: {
  editor: Exclude<CategoryEditor, null>;
  onClose: () => void;
}) {
  return (
    <div
      aria-labelledby="category-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0e1317]/45 p-4"
      role="dialog"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-[var(--pf-bg-surface)] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2
              className="text-2xl font-bold leading-8"
              id="category-dialog-title"
            >
              {editor.kind === 'create' ? 'Add category' : 'Edit category'}
            </h2>
            <p className="mt-1 text-sm text-[var(--pf-text-secondary)]">
              Names are matched without case or surrounding spaces.
            </p>
          </div>
          <button
            aria-label="Close category editor"
            className="rounded-lg px-2 py-1 text-lg leading-5 text-[var(--pf-text-secondary)] hover:bg-[#f1f5f2]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        {editor.kind === 'create' ? (
          <CreateCategoryForm onComplete={onClose} />
        ) : (
          <EditCategoryForm category={editor.category} onComplete={onClose} />
        )}
      </div>
    </div>
  );
}

function CreateCategoryForm({ onComplete }: { onComplete: () => void }) {
  const [state, formAction, pending] = useActionState(
    createCategoryAction,
    null,
  );

  useEffect(() => {
    if (state?.status === 'success') {
      onComplete();
    }
  }, [onComplete, state]);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <CategoryNameField />
      <ActionMessage state={state} />
      <DialogActions
        onClose={onComplete}
        pending={pending}
        submitLabel="Add category"
      />
    </form>
  );
}

function EditCategoryForm({
  category,
  onComplete,
}: {
  category: ActiveCategory;
  onComplete: () => void;
}) {
  const renameAction = renameCategoryAction.bind(null, category.id);
  const [state, formAction, pending] = useActionState(renameAction, null);

  useEffect(() => {
    if (state?.status === 'success') {
      onComplete();
    }
  }, [onComplete, state]);

  return (
    <>
      <form action={formAction} className="mt-8 space-y-5">
        <CategoryNameField defaultValue={category.name} />
        <ActionMessage state={state} />
        <DialogActions
          onClose={onComplete}
          pending={pending}
          submitLabel="Save changes"
        />
      </form>
      <ArchiveCategoryForm category={category} onComplete={onComplete} />
    </>
  );
}

function CategoryNameField({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--pf-text-primary)]">
      Category name
      <input
        className="h-11 rounded-lg border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-3 text-sm font-normal outline-none transition-colors placeholder:text-[#9aa7a9] focus:border-[var(--pf-action-primary)]"
        defaultValue={defaultValue}
        maxLength={80}
        name="name"
        placeholder="e.g. Pet care"
        required
        type="text"
      />
    </label>
  );
}

function DialogActions({
  onClose,
  pending,
  submitLabel,
}: {
  onClose: () => void;
  pending: boolean;
  submitLabel: string;
}) {
  return (
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
        {pending ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

function ArchiveCategoryForm({
  category,
  onComplete,
}: {
  category: ActiveCategory;
  onComplete: () => void;
}) {
  const archiveAction = archiveCategoryAction.bind(null, category.id);
  const [state, formAction, pending] = useActionState(archiveAction, null);

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
      <p className="text-sm font-semibold text-[var(--pf-text-primary)]">
        Archive {category.name}
      </p>
      <p className="mt-1 text-sm leading-5 text-[var(--pf-text-secondary)]">
        It will be unavailable for new transactions. Existing transactions keep
        this category.
      </p>
      <label className="mt-4 flex items-start gap-3 text-sm leading-5 text-[var(--pf-text-secondary)]">
        <input
          className="mt-1"
          name="confirmation"
          type="checkbox"
          value="archive"
        />
        I understand this archives the category.
      </label>
      <ActionMessage state={state} />
      <button
        className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-[var(--pf-status-expense)] hover:bg-[#fff0ed] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Archiving…' : 'Archive category'}
      </button>
    </form>
  );
}

function RestoreCategoryForm({ categoryId }: { categoryId: string }) {
  const restoreAction = restoreCategoryAction.bind(null, categoryId);
  const [state, formAction, pending] = useActionState(restoreAction, null);

  return (
    <form
      action={formAction}
      className="flex flex-col items-start gap-2 sm:items-end"
    >
      <button
        className="text-xs font-semibold text-[var(--pf-action-primary)] hover:text-[#04594e] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Restoring…' : 'Restore'}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function ActionMessage({ state }: { state: ActionState }) {
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

function transactionCountLabel(count: number) {
  return `${count} transaction${count === 1 ? '' : 's'}`;
}

function formatArchiveDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}
