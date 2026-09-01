'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { SignOutButton } from '@/components/sign-out-button';

const navigation: ReadonlyArray<{ href?: string; label: string }> = [
  { href: '/app', label: 'Overview' },
  { href: '/app/transactions', label: 'Transactions' },
  { label: 'Imports' },
  { label: 'Budgets' },
  { href: '/app/categories', label: 'Categories' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--pf-bg-canvas)] text-[var(--pf-text-primary)] md:flex">
      <aside className="border-b border-[var(--pf-border-default)] bg-[var(--pf-bg-surface)] px-4 py-6 md:sticky md:top-0 md:flex md:h-screen md:w-[248px] md:shrink-0 md:flex-col md:border-r md:border-b-0 md:px-4 md:py-8">
        <div className="px-4">
          <Link className="text-xl font-semibold leading-7" href="/app">
            Morrow
          </Link>
          <p className="mt-1 text-xs leading-[17px] text-[var(--pf-text-secondary)]">
            Your spending, clearly.
          </p>
        </div>
        <nav
          aria-label="Main navigation"
          className="mt-8 flex gap-1 overflow-x-auto md:block md:space-y-1"
        >
          {navigation.map((item) => {
            const isActive = item.href === pathname;
            const className = `shrink-0 rounded-[10px] px-4 py-[11px] text-sm leading-5 transition-colors md:block md:w-full ${
              isActive
                ? 'bg-[var(--pf-action-primary)] text-[var(--pf-bg-surface)]'
                : 'text-[var(--pf-text-secondary)] hover:bg-[#f1f5f2] hover:text-[var(--pf-text-primary)]'
            }`;

            if (!item.href) {
              return (
                <span
                  aria-disabled="true"
                  className={`${className} cursor-default opacity-70`}
                  key={item.label}
                  title={`${item.label} arrives in a later milestone.`}
                >
                  {item.label}
                </span>
              );
            }

            return (
              <Link
                aria-current={isActive ? 'page' : undefined}
                className={className}
                href={item.href}
                key={item.label}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 border-t border-[var(--pf-border-default)] pt-3 md:mt-auto">
          <SignOutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-6 py-8 sm:px-10 md:px-12 md:py-11">
        {children}
      </main>
    </div>
  );
}
