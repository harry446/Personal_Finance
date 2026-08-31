import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/transactions',
}));

vi.mock('@/components/sign-out-button', () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { AppShell } from '@/components/app-shell';

describe('AppShell', () => {
  it('renders the authenticated navigation and sign-out control', () => {
    render(
      <AppShell>
        <h1>Protected content</h1>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Morrow' })).toHaveAttribute(
      'href',
      '/app/transactions',
    );
    expect(screen.getByRole('link', { name: 'Transactions' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('button', { name: 'Sign out' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Protected content' }),
    ).toBeInTheDocument();
  });
});
