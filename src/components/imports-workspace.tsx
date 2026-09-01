'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';

import {
  approveImportBatchAction,
  setCandidateReviewStateAction,
  updateCandidateAction,
} from '@/app/app/imports/actions';

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
      <h1
        className="text-[30px] font-bold leading-[43px] tracking-[-0.02em]"
        id="imports-heading"
      >
        Import transactions
      </h1>
      <p className="text-sm leading-5 text-[var(--pf-text-secondary)]">
        Review every recommendation before it reaches your ledger.
      </p>

      <div className="mt-9 space-y-6">
        <UploadNotice />
        {requestedBatchWasUnavailable ? <UnavailableBatchNotice /> : null}
        {batch ? (
          <ReviewBatch activeCategories={activeCategories} batch={batch} />
        ) : (
          <EmptyReviewQueue />
        )}
        <ImportHistory batches={batches} selectedBatchId={batch?.id ?? null} />
      </div>
    </section>
  );
}

type ImportUploadResponse = {
  batchId?: string;
  error?: string;
  message?: string;
};

function UploadNotice() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function uploadFiles(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (files.length === 0) {
      setError('Choose at least one PDF, screenshot, or image to import.');
      return;
    }

    setError(null);
    setIsUploading(true);
    const formData = new FormData();

    for (const file of files) {
      formData.append('files', file);
    }

    try {
      const response = await fetch('/api/imports', {
        body: formData,
        method: 'POST',
      });
      const payload = (await response
        .json()
        .catch(() => null)) as ImportUploadResponse | null;

      if (payload?.batchId) {
        router.push(
          `/app/imports?batch=${encodeURIComponent(payload.batchId)}`,
        );
        return;
      }

      setError(
        payload?.error ??
          payload?.message ??
          'We could not start this import. Please try a new upload.',
      );
    } catch {
      setError('We could not reach the import service. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section
      aria-labelledby="upload-heading"
      className="rounded-xl border border-dashed border-[var(--pf-action-primary)] bg-[var(--pf-bg-surface)] px-6 py-8 text-center"
    >
      <p className="text-xs font-semibold tracking-[0.12em] text-[var(--pf-action-primary)]">
        UPLOAD & EXTRACT
      </p>
      <h2 className="mt-3 text-xl font-bold leading-7" id="upload-heading">
        Turn statements into reviewable transactions
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-5 text-[var(--pf-text-secondary)]">
        Choose PDFs, screenshots, or common images. Files are held only while
        this request runs, then sent to OpenAI for extraction. Nothing reaches
        your ledger until you review and approve it.
      </p>
      <form className="mx-auto mt-6 max-w-xl" onSubmit={uploadFiles}>
        <label className="flex cursor-pointer flex-col items-center rounded-lg border border-[var(--pf-border-default)] bg-[var(--pf-bg-canvas)] px-5 py-5 text-sm font-semibold text-[var(--pf-text-primary)] transition-colors hover:border-[var(--pf-action-primary)]">
          <span>Choose import files</span>
          <span className="mt-1 text-xs font-normal text-[var(--pf-text-secondary)]">
            PDF, PNG, JPEG, WEBP, or GIF
          </span>
          <input
            accept=".pdf,application/pdf,image/png,image/jpeg,image/webp,image/gif"
            aria-label="Choose import files"
            className="sr-only"
            multiple
            onChange={(event) => {
              setError(null);
              setFiles(Array.from(event.currentTarget.files ?? []));
            }}
            type="file"
          />
        </label>
        <p className="mt-3 text-xs leading-4 text-[var(--pf-text-secondary)]">
          {files.length === 0
            ? 'No files selected yet.'
            : `${files.length} file${files.length === 1 ? '' : 's'} selected. File names and source bytes are not saved.`}
        </p>
        {error ? (
          <p
            className="mt-3 rounded-lg bg-[#fff0ed] px-3 py-2 text-xs leading-4 text-[var(--pf-status-expense)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <button
          className="mt-5 rounded-full bg-[var(--pf-action-primary)] px-5 py-2.5 text-xs font-semibold text-[var(--pf-bg-surface)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isUploading}
          type="submit"
        >
          {isUploading ? 'Creating review batch…' : 'Extract transactions'}
        </button>
      </form>
    </section>
  );
}

function UnavailableBatchNotice() {
  return (
    <p
      className="rounded-lg bg-[#fff0ed] px-4 py-3 text-sm text-[var(--pf-status-expense)]"
      role="alert"
    >
      That batch is not awaiting review. Showing your current review queue
      instead.
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

  return (
    <section
      aria-labelledby="review-queue-heading"
      className="rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)]"
    >
      <div className="px-6 pb-5 pt-6">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--pf-text-secondary)]">
          REVIEW QUEUE
        </p>
        <h2
          className="mt-2 text-[22px] font-bold leading-[30px]"
          id="review-queue-heading"
        >
          Recommended transactions
        </h2>
        <p className="mt-1 text-sm leading-5 text-[var(--pf-text-secondary)]">
          Edit details inline, then select only the rows you want to save.
        </p>
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
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <ApprovalForm batchId={batch.id} selectedCount={selectedCount} />
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
          'No transactions were added to your ledger. Upload the files again to create a fresh review batch.'}
      </p>
    </section>
  );
}

function CandidateReviewRow({
  activeCategories,
  candidate,
}: {
  activeCategories: ActiveCategory[];
  candidate: Candidate;
}) {
  return (
    <article className="px-6 py-5">
      <div className="grid gap-3 xl:grid-cols-[36px_minmax(0,1fr)] xl:items-center">
        <CandidateStateControl candidate={candidate} />
        <CandidateInlineEditor
          activeCategories={activeCategories}
          candidate={candidate}
        />
      </div>
      {candidate.isIncomplete && candidate.reviewState === 'SELECTED' ? (
        <p className="mt-4 rounded-lg bg-[#fff0ed] px-3 py-2 text-xs leading-4 text-[var(--pf-status-expense)]">
          This selected candidate is incomplete. Finish its required details
          before approving the batch.
        </p>
      ) : null}
    </article>
  );
}

function CandidateStateControl({ candidate }: { candidate: Candidate }) {
  const selected = candidate.reviewState === 'SELECTED';

  return (
    <ReviewStateForm
      candidateId={candidate.id}
      label={selected ? 'Unselect candidate' : 'Select candidate'}
      reviewState={selected ? 'pending' : 'selected'}
    >
      <span
        aria-hidden="true"
        className={`inline-flex size-5 items-center justify-center rounded-full border text-xs ${
          selected
            ? 'border-[var(--pf-action-primary)] bg-[var(--pf-action-primary)] text-[var(--pf-bg-surface)]'
            : 'border-[#b8c6bf] text-transparent'
        }`}
      >
        ✓
      </span>
    </ReviewStateForm>
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
  reviewState: 'pending' | 'selected';
}) {
  const action = setCandidateReviewStateAction.bind(null, candidateId);
  const [, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction}>
      <input name="reviewState" type="hidden" value={reviewState} />
      <button
        aria-label={label}
        className="rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {children}
      </button>
    </form>
  );
}

function CandidateInlineEditor({
  activeCategories,
  candidate,
}: {
  activeCategories: ActiveCategory[];
  candidate: Candidate;
}) {
  const action = updateCandidateAction.bind(null, candidate.id);
  const [state, formAction, pending] = useActionState(action, null);
  const [notesOpen, setNotesOpen] = useState(Boolean(candidate.notes));

  return (
    <form action={formAction} className="min-w-0">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[112px_minmax(180px,1.5fr)_minmax(145px,1fr)_112px_132px_auto] xl:items-end">
        <label className="block">
          <span className="sr-only">Date</span>
          <input
            aria-label="Date"
            className={fieldClassName}
            defaultValue={candidate.transactionDate?.slice(0, 10) ?? ''}
            name="transactionDate"
            type="date"
          />
        </label>
        <label className="block min-w-0">
          <span className="sr-only">Description or merchant</span>
          <input
            aria-label="Description or merchant"
            className={fieldClassName}
            defaultValue={candidate.description ?? ''}
            maxLength={160}
            name="description"
            placeholder="Merchant or description"
            type="text"
          />
        </label>
        <label className="block min-w-0">
          <span className="sr-only">Category</span>
          <select
            aria-label="Category"
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
        <label className="block">
          <span className="sr-only">Amount (CAD)</span>
          <input
            aria-label="Amount (CAD)"
            className={fieldClassName}
            defaultValue={
              candidate.amountCents === null
                ? ''
                : (candidate.amountCents / 100).toFixed(2)
            }
            inputMode="decimal"
            name="amount"
            placeholder="Amount"
            step="0.01"
            type="number"
          />
        </label>
        <label className="block">
          <span className="sr-only">Type</span>
          <select
            aria-label="Type"
            className={fieldClassName}
            defaultValue={candidate.type ?? ''}
            name="type"
          >
            <option value="">Choose type</option>
            <option value="expense">Expense</option>
            <option value="refund">Refund</option>
          </select>
        </label>
        <div className="flex items-center justify-end gap-3">
          <button
            className="text-xs font-semibold text-[var(--pf-action-primary)] hover:text-[#04594e]"
            onClick={() => setNotesOpen((value) => !value)}
            type="button"
          >
            {notesOpen ? 'Hide notes' : 'Edit notes'}
          </button>
          <button
            className="rounded-full bg-[var(--pf-action-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--pf-bg-surface)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {notesOpen ? (
        <label className="mt-3 grid gap-1.5 text-xs font-semibold">
          Notes{' '}
          <span className="font-normal text-[var(--pf-text-secondary)]">
            (optional)
          </span>
          <textarea
            aria-label="Notes"
            className={`${fieldClassName} min-h-20 resize-y py-2`}
            defaultValue={candidate.notes ?? ''}
            maxLength={1_000}
            name="notes"
            rows={3}
          />
        </label>
      ) : (
        <input name="notes" type="hidden" value={candidate.notes ?? ''} />
      )}
      <ActionMessage state={state?.status === 'error' ? state : null} />
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
          Finalizing is permanent. With no selection, every suggested
          transaction is discarded; otherwise, only selected transactions are
          saved.
        </p>
        <ActionMessage state={state} />
      </div>
      <button
        className="shrink-0 rounded-full bg-[var(--pf-action-primary)] px-5 py-3 text-xs font-semibold text-[var(--pf-bg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending
          ? 'Finalizing…'
          : selectedCount === 0
            ? 'Discard all'
            : 'Save selected'}
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
      className="rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)]"
    >
      <div className="border-b border-[var(--pf-border-default)] px-5 py-5">
        <h2 className="text-lg font-bold" id="import-history-heading">
          Import history
        </h2>
        <p className="mt-1 text-xs leading-4 text-[var(--pf-text-secondary)]">
          Completed batches are retained for audit history, but never return to
          the review queue.
        </p>
      </div>
      {batches.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--pf-text-secondary)]">
          No import batches yet.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--pf-border-default)] md:grid md:grid-cols-2 md:divide-y-0">
          {batches.map((batch) => {
            const content = (
              <>
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
              </>
            );

            return (
              <li
                className="border-[var(--pf-border-default)] md:border-b md:[&:nth-child(odd)]:border-r"
                key={batch.id}
              >
                {batch.status === 'APPROVED' ? (
                  <div className="px-5 py-4">{content}</div>
                ) : (
                  <Link
                    aria-current={
                      selectedBatchId === batch.id ? 'page' : undefined
                    }
                    className={`block px-5 py-4 transition-colors hover:bg-[#f1f5f2] ${
                      selectedBatchId === batch.id ? 'bg-[#eef7f3]' : ''
                    }`}
                    href={`/app/imports?batch=${encodeURIComponent(batch.id)}`}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
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
