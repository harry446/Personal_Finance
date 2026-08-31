'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--pf-text-secondary)] transition-colors hover:bg-[#f1f5f2] hover:text-[var(--pf-text-primary)] focus-visible:outline-none"
      onClick={() => void signOut({ callbackUrl: '/sign-in' })}
      type="button"
    >
      Sign out
    </button>
  );
}
