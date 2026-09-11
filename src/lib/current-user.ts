import 'server-only';

import type { Session } from 'next-auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { auth } from '@/auth';

const sessionUserIdSchema = z.string().min(1);

export function getSessionUserId(session: Session | null) {
  const parsed = sessionUserIdSchema.safeParse(session?.user?.id);

  return parsed.success ? parsed.data : null;
}

export async function requireCurrentUser() {
  const session = await auth();
  const userId = getSessionUserId(session);

  if (!userId) {
    redirect('/sign-in');
  }

  return { email: session?.user?.email ?? null, id: userId };
}

export async function redirectAuthenticatedUser() {
  if (getSessionUserId(await auth())) {
    redirect('/app');
  }
}
