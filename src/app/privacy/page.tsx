import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy notice | Personal Finance',
  description: 'How Personal Finance processes and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950 sm:px-10 lg:px-16">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
        <Link
          className="text-sm font-semibold text-emerald-700 underline"
          href="/sign-in"
        >
          Back to sign in
        </Link>
        <p className="mt-8 text-sm font-semibold tracking-[0.16em] text-emerald-700 uppercase">
          Personal Finance
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Privacy notice
        </h1>
        <p className="mt-4 text-sm text-slate-600">
          Effective September 7, 2026
        </p>

        <div className="mt-8 space-y-8 text-base leading-7 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              What we store
            </h2>
            <p className="mt-2">
              The app stores the spending records, categories, budgets,
              import-batch metadata, and review decisions that you create. Each
              record is tied to the Google account used to sign in and is
              separated from other users&apos; records.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Google sign-in
            </h2>
            <p className="mt-2">
              Google is used only to authenticate you. The app keeps the
              authentication data required to maintain your session; it does not
              use Google to read your financial accounts.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Transaction-file extraction
            </h2>
            <p className="mt-2">
              When you choose files for import, the files are processed in
              server memory and sent directly to OpenAI&apos;s API to extract
              suggested transactions. The app does not save upload bytes to its
              disk, database, object storage, or the OpenAI Files API. Suggested
              transactions always require your review before they can be added
              to the ledger.
            </p>
            <p className="mt-2">
              The raw extraction response is encrypted at rest for up to 30 days
              for limited troubleshooting, then its ciphertext is purged
              automatically. Normal application logs do not include uploaded
              content or names, transaction descriptions, notes, email
              addresses, raw model output, OAuth tokens, cookies, or secrets.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Security and retention
            </h2>
            <p className="mt-2">
              The service uses HTTPS in production. Its PostgreSQL database is
              self-hosted with network access limited to the application host.
              Ledger records remain until you delete them; archived categories
              remain attached to historical transactions so past reports stay
              accurate.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Questions or requests
            </h2>
            <p className="mt-2">
              Contact the application owner through the deployment contact
              published with this service for questions, access requests, or
              deletion requests.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
