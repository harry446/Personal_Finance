'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';

import {
  approveImportBatchAction,
  setCandidateReviewStateAction,
  updateCandidateAction,
} from '@/app/app/imports/actions';
import { formatCad, formatTransactionDate } from '@/lib/formatters';

type ActionState = { message: string; status: 'error' | 'success' } | null;

type ActiveCategory = {
  id: string;
  name: string;
};

type ImportBatchSummary = {
  approvedCount: number;
  candidateCount: number;
  createdAt: string;
  id: string;
  status: 'APPROVED' | 'FAILED' | 'PROCESSING' | 'READY_FOR_REVIEW';
};

type Candidate = {
  amountCents: number | null;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  id: string;
  isIncomplete: boolean;
  notes: string | null;
  ordinal: number;
  reviewState: 'APPROVED' | 'EXCLUDED' | 'PENDING' | 'SELECTED';
  savedTransactionId: string | null;
  transactionDate: string | null;
  type: 'expense' | 'refund' | null;
};

type ImportBatch = ImportBatchSummary & {
  candidates: Candidate[];
  failureMessageSafe: string | null;
  model: string | null;
};

export function ImportsWorkspace({
  activeCategories,
  batch,
  batches,
  requestedBatchWasUnavailable,
}: {
  activeCategories: ActiveCategory[];
  batch: ImportBatch | null;
  batches: ImportBatchSummary[];
  requestedBatchWasUnavailable: boolean;
}) {
  return (
    <section
      aria-labelledby="imports-heading"
      className="mx-auto max-w-[1096px]"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1
            className="text-[30px] font-bold leading-[43px] tracking-[-0.02em]"
            id="imports-heading"
          >
            Import transactions
          </h1>
          <p className="text-sm leading-5 text-[var(--pf-text-secondary)]">
            Review every recommendation before it reaches your ledger.
          </p>
        </div>
        <ImportSteps status={batch?.status} />
      </div>

      <div className="mt-9 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-6">
          <UploadNotice />
          {requestedBatchWasUnavailable ? <UnavailableBatchNotice /> : null}
          {batch ? (
            <ReviewBatch activeCategories={activeCategories} batch={batch} />
          ) : (
            <EmptyReviewQueue />
          )}
        </div>
        <ImportHistory batches={batches} selectedBatchId={batch?.id ?? null} />
      </div>
    </section>
  );
}

function ImportSteps({
  status,
}: {
  status: ImportBatchSummary['status'] | undefined;
}) {
  const reviewActive = status === 'READY_FOR_REVIEW';
  const saveActive = status === 'APPROVED';

  return (
    <ol
      aria-label="Import progress"
      className="flex items-center gap-3 text-xs font-semibold"
    >
      <Step active={false} label="Upload" number={1} />
      <Step active={reviewActive} label="Review" number={2} />
      <Step active={saveActive} label="Save" number={3} />
    </ol>
  );
}

function Step({
  active,
  label,
  number,
}: {
  active: boolean;
  label: string;
  number: number;
}) {
  return (
    <li className="flex items-center gap-1.5 text-[var(--pf-text-secondary)]">
      <span
        className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] ${
          active
            ? 'bg-[var(--pf-action-primary)] text-[var(--pf-bg-surface)]'
            : 'bg-[var(--pf-border-default)] text-[var(--pf-text-secondary)]'
        }`}
      >
        {number}
      </span>
      <span className={active ? 'text-[var(--pf-text-primary)]' : undefined}>
        {label}
      </span>
    </li>
  );
}

function UploadNotice() {
  return (
    <section
      aria-labelledby="upload-next-heading"
      className="rounded-xl border border-dashed border-[var(--pf-action-primary)] bg-[var(--pf-bg-surface)] px-6 py-8 text-center"
    >
      <p className="text-xs font-semibold tracking-[0.12em] text-[var(--pf-action-primary)]">
        NEXT UP
      </p>
      <h2 className="mt-3 text-xl font-bold leading-7" id="upload-next-heading">
        Upload extraction arrives in M5
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-5 text-[var(--pf-text-secondary)]">
        This milestone is deliberately limited to durable review and approval.
        Files and OpenAI extraction will create future review batches without
        saving transactions automatically.
      </p>
    </section>
  );
}

function UnavailableBatchNotice() {
  return (
    <p
      className="rounded-lg bg-[#fff0ed] px-4 py-3 text-sm text-[var(--pf-status-expense)]"
      role="alert"
    >
      That import batch is not available in your workspace. Showing your most
      recent review batch instead.
    </p>
  );
}

function EmptyReviewQueue() {
  return (
    <section
      aria-labelledby="review-queue-heading"
      className="rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-6 py-8 sm:px-8"
    >
      <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--pf-text-secondary)]">
        REVIEW QUEUE
      </p>
      <h2
        className="mt-4 text-[22px] font-bold leading-[30px]"
        id="review-queue-heading"
      >
        Nothing to review yet
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-5 text-[var(--pf-text-secondary)]">
        After extraction, recommended transactions will appear here. They begin
        unselected and are never saved automatically.
      </p>
      <p className="mt-6 inline-flex rounded-full bg-[#d1ede3] px-4 py-2 text-xs font-semibold text-[var(--pf-action-primary)]">
        Waiting for an extraction
      </p>
    </section>
  );
}

function ReviewBatch({
  activeCategories,
  batch,
}: {
  activeCategories: ActiveCategory[];
  batch: ImportBatch;
}) {
  if (batch.status === 'FAILED') {
    return <FailedBatch batch={batch} />;
  }

  if (batch.status === 'PROCESSING') {
    return (
      <section className="rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-6 py-8">
        <p className="text-xs font-semibold tracking-[0.1em] text-[var(--pf-text-secondary)]">
          REVIEW QUEUE
        </p>
        <h2 className="mt-3 text-xl font-bold">Preparing recommendations</h2>
        <p className="mt-2 text-sm text-[var(--pf-text-secondary)]">
          This batch is not ready to review yet.
        </p>
      </section>
    );
  }

  const selectedCount = batch.candidates.filter(
    (candidate) => candidate.reviewState === 'SELECTED',
  ).length;
  const approved = batch.status === 'APPROVED';

  return (
    <section
      aria-labelledby="review-queue-heading"
      className="rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)]"
    >
      <div className="flex flex-col gap-4 px-6 pb-5 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--pf-text-secondary)]">
            REVIEW QUEUE
          </p>
          <h2
            className="mt-2 text-[22px] font-bold leading-[30px]"
            id="review-queue-heading"
          >
            {approved ? 'Saved recommendations' : 'Recommended transactions'}
          </h2>
          <p className="mt-1 text-sm leading-5 text-[var(--pf-text-secondary)]">
            {approved
              ? `${batch.approvedCount} transaction${batch.approvedCount === 1 ? '' : 's'} saved from this batch.`
              : 'Edit details, then select only the rows you want to save.'}
          </p>
        </div>
        <BatchStatus status={batch.status} />
      </div>

      <div className="border-y border-[var(--pf-border-default)]">
        {batch.candidates.length === 0 ? (
          <p className="px-6 py-8 text-sm text-[var(--pf-text-secondary)]">
            This batch has no candidate transactions.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--pf-border-default)]">
            {batch.candidates.map((candidate) => (
              <li key={candidate.id}>
                <CandidateReviewRow
                  activeCategories={activeCategories}
                  candidate={candidate}
                  isReadOnly={approved}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {approved ? (
        <p className="px-6 py-5 text-sm text-[var(--pf-text-secondary)]">
          Candidate history is retained for this batch. Approved entries can be
          found in Transactions and the dashboard.
        </p>
      ) : (
        <ApprovalForm batchId={batch.id} selectedCount={selectedCount} />
      )}
    </section>
  );
}

function FailedBatch({ batch }: { batch: ImportBatch }) {
  return (
    <section
      aria-labelledby="failed-batch-heading"
      className="rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-6 py-7"
    >
      <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--pf-status-expense)]">
        IMPORT FAILED
      </p>
      <h2 className="mt-3 text-xl font-bold" id="failed-batch-heading">
        This batch could not be prepared for review
      </h2>
      <p className="mt-2 text-sm leading-5 text-[var(--pf-text-secondary)]">
        {batch.failureMessageSafe ??
          'No transactions were added to your ledger. A new upload will be required in the next milestone.'}
      </p>
    </section>
  );
}

function CandidateReviewRow({
  activeCategories,
  candidate,
  isReadOnly,
}: {
  activeCategories: ActiveCategory[];
  candidate: Candidate;
  isReadOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <article className="px-6 py-5">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[36px_minmax(145px,1.2fr)_minmax(115px,.8fr)_minmax(100px,.7fr)_minmax(88px,.55fr)_auto] lg:items-center">
        <CandidateStateControl candidate={candidate} disabled={isReadOnly} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5">
            {candidate.description || 'Missing description'}
          </p>
          <p className="mt-1 text-xs leading-4 text-[var(--pf-text-secondary)]">
            {candidate.transactionDate
              ? formatTransactionDate(new Date(candidate.transactionDate))
              : 'Missing date'}
            {' · '}
            {candidate.type
              ? candidate.type === 'expense'
                ? 'Expense'
                : 'Refund'
              : 'Missing type'}
          </p>
        </div>
        <p className="text-sm text-[var(--pf-text-secondary)]">
          {candidate.categoryName ?? 'Missing category'}
        </p>
        <p
          className={`text-sm font-semibold ${
            candidate.type === 'refund'
              ? 'text-[var(--pf-status-refund)]'
              : 'text-[var(--pf-status-expense)]'
          }`}
        >
          {candidate.amountCents
            ? `${candidate.type === 'refund' ? '+' : '−'}${formatCad(candidate.amountCents)}`
            : 'Missing amount'}
        </p>
        <CandidateBadge candidate={candidate} />
        {isReadOnly ? null : (
          <div className="flex items-center gap-3 lg:justify-self-end">
            {candidate.reviewState === 'EXCLUDED' ? null : (
              <ReviewStateForm
                candidateId={candidate.id}
                label="Exclude candidate"
                reviewState="excluded"
              >
                Exclude
              </ReviewStateForm>
            )}
            <button
              className="text-xs font-semibold text-[var(--pf-action-primary)] hover:text-[#04594e]"
              onClick={() => setEditing((value) => !value)}
              type="button"
            >
              {editing ? 'Close edit' : 'Edit'}
            </button>
          </div>
        )}
      </div>
      {candidate.isIncomplete && candidate.reviewState === 'SELECTED' ? (
        <p className="mt-4 rounded-lg bg-[#fff0ed] px-3 py-2 text-xs leading-4 text-[var(--pf-status-expense)]">
          This selected candidate is incomplete. Finish its required details
          before approving the batch.
        </p>
      ) : null}
      {editing ? (
        <CandidateEditor
          activeCategories={activeCategories}
          candidate={candidate}
          onComplete={() => setEditing(false)}
        />
      ) : null}
    </article>
  );
}

function CandidateStateControl({
  candidate,
  disabled,
}: {
  candidate: Candidate;
  disabled: boolean;
}) {
  if (disabled || candidate.reviewState === 'APPROVED') {
    return (
      <span
        aria-label="Approved candidate"
        className="text-center text-lg text-[var(--pf-action-primary)]"
      >
        ✓
      </span>
    );
  }

  if (candidate.reviewState === 'EXCLUDED') {
    return (
      <ReviewStateForm
        candidateId={candidate.id}
        label="Include candidate in review"
        reviewState="pending"
      >
        ↺
      </ReviewStateForm>
    );
  }

  return (
    <ReviewStateForm
      candidateId={candidate.id}
      label={
        candidate.reviewState === 'SELECTED'
          ? 'Unselect candidate'
          : 'Select candidate'
      }
      reviewState={
        candidate.reviewState === 'SELECTED' ? 'pending' : 'selected'
      }
    >
      <span
        aria-hidden="true"
        className={`inline-flex size-5 items-center justify-center rounded-full border text-xs ${
          candidate.reviewState === 'SELECTED'
            ? 'border-[var(--pf-action-primary)] bg-[var(--pf-action-primary)] text-[var(--pf-bg-surface)]'
            : 'border-[#b8c6bf] text-transparent'
        }`}
      >
        ✓
      </span>
    </ReviewStateForm>
  );
}

function CandidateBadge({ candidate }: { candidate: Candidate }) {
  if (candidate.reviewState === 'APPROVED') {
    return (
      <span className="text-xs font-semibold text-[var(--pf-status-refund)]">
        Saved
      </span>
    );
  }
  if (candidate.reviewState === 'EXCLUDED') {
    return (
      <span className="text-xs font-semibold text-[var(--pf-text-secondary)]">
        Excluded
      </span>
    );
  }
  if (candidate.isIncomplete) {
    return (
      <span className="text-xs font-semibold text-[var(--pf-status-expense)]">
        Needs details
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-[var(--pf-action-primary)]">
      Ready
    </span>
  );
}

function ReviewStateForm({
  candidateId,
  children,
  label,
  reviewState,
}: {
  candidateId: string;
  children: React.ReactNode;
  label: string;
  reviewState: 'excluded' | 'pending' | 'selected';
}) {
  const action = setCandidateReviewStateAction.bind(null, candidateId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input name="reviewState" type="hidden" value={reviewState} />
      <button
        aria-label={label}
        className={`rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-50 ${typeof children === 'string' ? 'text-xs font-semibold text-[var(--pf-text-secondary)] hover:text-[var(--pf-status-expense)]' : ''}`}
        disabled={pending}
        type="submit"
      >
        {children}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function CandidateEditor({
  activeCategories,
  candidate,
  onComplete,
}: {
  activeCategories: ActiveCategory[];
  candidate: Candidate;
  onComplete: () => void;
}) {
  const action = updateCandidateAction.bind(null, candidate.id);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.status === 'success') {
      onComplete();
    }
  }, [onComplete, state]);

  return (
    <form
      action={formAction}
      className="mt-5 grid gap-4 rounded-xl bg-[var(--pf-bg-canvas)] p-4 sm:grid-cols-2"
    >
      <label className="grid gap-1.5 text-xs font-semibold">
        Date
        <input
          className={fieldClassName}
          defaultValue={candidate.transactionDate?.slice(0, 10) ?? ''}
          name="transactionDate"
          type="date"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold">
        Type
        <select
          className={fieldClassName}
          defaultValue={candidate.type ?? ''}
          name="type"
        >
          <option value="">Choose type</option>
          <option value="expense">Expense</option>
          <option value="refund">Refund</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-semibold sm:col-span-2">
        Description or merchant
        <input
          className={fieldClassName}
          defaultValue={candidate.description ?? ''}
          maxLength={160}
          name="description"
          type="text"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold">
        Category
        <select
          className={fieldClassName}
          defaultValue={candidate.categoryId ?? ''}
          name="categoryId"
        >
          <option value="">Choose a category</option>
          {candidate.categoryId &&
          !activeCategories.some(
            (category) => category.id === candidate.categoryId,
          ) ? (
            <option value={candidate.categoryId}>
              {candidate.categoryName ?? 'Unavailable category'}
            </option>
          ) : null}
          {activeCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-semibold">
        Amount (CAD)
        <input
          className={fieldClassName}
          defaultValue={
            candidate.amountCents === null
              ? ''
              : (candidate.amountCents / 100).toFixed(2)
          }
          inputMode="decimal"
          name="amount"
          placeholder="0.00"
          step="0.01"
          type="number"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold sm:col-span-2">
        Notes{' '}
        <span className="font-normal text-[var(--pf-text-secondary)]">
          (optional)
        </span>
        <textarea
          className={`${fieldClassName} min-h-20 resize-y py-2`}
          defaultValue={candidate.notes ?? ''}
          maxLength={1_000}
          name="notes"
          rows={3}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <ActionMessage state={state} />
        <button
          className="rounded-full bg-[var(--pf-action-primary)] px-5 py-2.5 text-xs font-semibold text-[var(--pf-bg-surface)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Saving…' : 'Save candidate'}
        </button>
      </div>
    </form>
  );
}

function ApprovalForm({
  batchId,
  selectedCount,
}: {
  batchId: string;
  selectedCount: number;
}) {
  const action = approveImportBatchAction.bind(null, batchId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="text-sm font-semibold">
          {selectedCount} candidate{selectedCount === 1 ? '' : 's'} selected
        </p>
        <p className="mt-1 text-xs leading-4 text-[var(--pf-text-secondary)]">
          Approval is all-or-nothing. Excluded candidates stay in this batch and
          never enter your ledger.
        </p>
        <ActionMessage state={state} />
      </div>
      <button
        className="shrink-0 rounded-full bg-[var(--pf-action-primary)] px-5 py-3 text-xs font-semibold text-[var(--pf-bg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending || selectedCount === 0}
        type="submit"
      >
        {pending ? 'Approving…' : 'Approve selected'}
      </button>
    </form>
  );
}

function BatchStatus({ status }: { status: ImportBatchSummary['status'] }) {
  const label = {
    APPROVED: 'Saved',
    FAILED: 'Failed',
    PROCESSING: 'Processing',
    READY_FOR_REVIEW: 'Ready for review',
  }[status];

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
        status === 'FAILED'
          ? 'bg-[#fff0ed] text-[var(--pf-status-expense)]'
          : 'bg-[#d1ede3] text-[var(--pf-action-primary)]'
      }`}
    >
      {label}
    </span>
  );
}

function ImportHistory({
  batches,
  selectedBatchId,
}: {
  batches: ImportBatchSummary[];
  selectedBatchId: string | null;
}) {
  return (
    <aside
      aria-labelledby="import-history-heading"
      className="h-fit rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)]"
    >
      <div className="border-b border-[var(--pf-border-default)] px-5 py-5">
        <h2 className="text-lg font-bold" id="import-history-heading">
          Import history
        </h2>
        <p className="mt-1 text-xs leading-4 text-[var(--pf-text-secondary)]">
          Reviewable batches stay available after approval.
        </p>
      </div>
      {batches.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--pf-text-secondary)]">
          No import batches yet.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--pf-border-default)]">
          {batches.map((batch) => (
            <li key={batch.id}>
              <Link
                aria-current={selectedBatchId === batch.id ? 'page' : undefined}
                className={`block px-5 py-4 transition-colors hover:bg-[#f1f5f2] ${
                  selectedBatchId === batch.id ? 'bg-[#eef7f3]' : ''
                }`}
                href={`/app/imports?batch=${encodeURIComponent(batch.id)}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    {formatBatchDate(batch.createdAt)}
                  </p>
                  <BatchStatus status={batch.status} />
                </div>
                <p className="mt-1 text-xs leading-4 text-[var(--pf-text-secondary)]">
                  {batch.candidateCount} candidate
                  {batch.candidateCount === 1 ? '' : 's'} ·{' '}
                  {batch.approvedCount} saved
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function ActionMessage({ state }: { state: ActionState }) {
  if (!state) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={`mt-2 rounded-lg px-3 py-2 text-xs leading-4 ${
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
  'h-10 rounded-lg border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-3 text-sm font-normal text-[var(--pf-text-primary)] outline-none transition-colors focus:border-[var(--pf-action-primary)]';

function formatBatchDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(value));
}
