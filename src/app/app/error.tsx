'use client';

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-[760px] py-12">
      <p className="text-sm font-semibold text-[var(--pf-status-expense)] uppercase tracking-[0.14em]">
        Dashboard unavailable
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        We couldn’t load this month.
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--pf-text-secondary)]">
        Your ledger was not changed. Try again in a moment.
      </p>
      <button
        className="mt-7 rounded-[10px] bg-[var(--pf-action-primary)] px-5 py-3 text-sm font-semibold text-[var(--pf-action-on-primary)]"
        onClick={() => reset()}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
