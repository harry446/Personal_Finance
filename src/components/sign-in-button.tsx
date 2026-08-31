'use client';

import { signIn } from 'next-auth/react';

export function SignInButton() {
  return (
    <button
      className="rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none disabled:cursor-not-allowed"
      onClick={() => void signIn('google', { callbackUrl: '/app' })}
      type="button"
    >
      Continue with Google
    </button>
  );
}
