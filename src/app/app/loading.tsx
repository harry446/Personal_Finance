export default function AppLoading() {
  return (
    <div
      aria-label="Loading dashboard"
      className="mx-auto max-w-[1064px]"
      role="status"
    >
      <div className="h-10 w-44 animate-pulse rounded bg-[#e8eeea]" />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            className="h-36 animate-pulse rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)]"
            key={item}
          />
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <div className="h-72 animate-pulse rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)]" />
        <div className="h-72 animate-pulse rounded-xl border border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)]" />
      </div>
      <span className="sr-only">Loading dashboard</span>
    </div>
  );
}
