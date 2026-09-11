import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/transactions',
}));

vi.mock('@/components/sign-out-button', () => ({
  SignOutButton: () => (
    <button type="button">Sign out or switch account</button>
  ),
}));

import { AppShell } from '@/components/app-shell';

describe('AppShell', () => {
  it('renders the authenticated navigation and sign-out control', () => {
    render(
      <AppShell userEmail="owner@example.test">
        <h1>Protected content</h1>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Morrow' })).toHaveAttribute(
      'href',
      '/app',
    );
    expect(screen.getByRole('link', { name: 'Transactions' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Imports' })).toHaveAttribute(
      'href',
      '/app/imports',
    );
    expect(
      screen.getByRole('button', { name: 'Sign out or switch account' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Signed in as')).toBeInTheDocument();
    expect(screen.getByText('owner@example.test')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Protected content' }),
    ).toBeInTheDocument();
  });
});
