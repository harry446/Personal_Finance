export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950 sm:px-10 lg:px-16">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col justify-center">
        <p className="text-sm font-semibold tracking-[0.16em] text-emerald-700 uppercase">
          Personal Finance
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          A trustworthy place to understand your spending.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
          The application foundation is ready. Secure sign-in, the spending
          ledger, imports, and budgeting will arrive in their planned
          milestones.
        </p>
        <section
          className="mt-12 grid gap-4 border-t border-slate-200 pt-8 sm:grid-cols-3"
          aria-labelledby="foundation-heading"
        >
          <h2 id="foundation-heading" className="sr-only">
            Foundation status
          </h2>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium">CAD first</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Amounts will use Canadian dollars and en-CA formatting.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium">Private by design</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Authentication and user isolation are the next milestone.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium">Human approval</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Future AI imports will always require review before saving.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
