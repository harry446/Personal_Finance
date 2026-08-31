import { SignInButton } from '@/components/sign-in-button';

export function SignInScreen() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950 sm:px-10 lg:px-16">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-xl flex-col justify-center">
        <p className="text-sm font-semibold tracking-[0.16em] text-emerald-700 uppercase">
          Personal Finance
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Spend with clarity.
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">
          Sign in to keep your spending data private and separate from every
          other account.
        </p>
        <div className="mt-10">
          <SignInButton />
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-500">
          We use Google only to sign you in. Your spending data is isolated to
          your account.
        </p>
      </div>
    </main>
  );
}
