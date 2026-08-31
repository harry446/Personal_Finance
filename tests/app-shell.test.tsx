import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

    expect(
      screen.getByRole('link', { name: 'Personal Finance' }),
    ).toHaveAttribute('href', '/app');
    expect(
      screen.getByRole('button', { name: 'Sign out' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Protected content' }),
    ).toBeInTheDocument();
  });
});
