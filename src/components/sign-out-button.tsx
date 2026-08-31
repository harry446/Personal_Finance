'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none"
      onClick={() => void signOut({ callbackUrl: '/sign-in' })}
      type="button"
    >
      Sign out
    </button>
  );
}
