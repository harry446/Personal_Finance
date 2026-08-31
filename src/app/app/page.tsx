export default function AppHome() {
  return (
    <section aria-labelledby="workspace-heading">
      <p className="text-sm font-semibold tracking-[0.16em] text-emerald-700 uppercase">
        Private workspace
      </p>
      <h1
        id="workspace-heading"
        className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        Your private space is ready.
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
        Your account is set up with default categories. Manual transactions,
        dashboards, imports, and budgets will arrive in their planned
        milestones.
      </p>
    </section>
  );
}
