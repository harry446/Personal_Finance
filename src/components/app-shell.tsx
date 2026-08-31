import Link from 'next/link';
import type { ReactNode } from 'react';

import { SignOutButton } from '@/components/sign-out-button';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-10 lg:px-16">
          <Link className="font-semibold tracking-tight" href="/app">
            Personal Finance
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-10 lg:px-16">
        {children}
      </main>
    </div>
  );
}
