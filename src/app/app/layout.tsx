import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { requireCurrentUser } from '@/lib/current-user';

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireCurrentUser();

  return <AppShell>{children}</AppShell>;
}
