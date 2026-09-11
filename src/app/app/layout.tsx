import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { requireCurrentUser } from '@/lib/current-user';

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await requireCurrentUser();

  return <AppShell userEmail={user.email}>{children}</AppShell>;
}
