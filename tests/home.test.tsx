import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { redirectAuthenticatedUserMock } = vi.hoisted(() => ({
  redirectAuthenticatedUserMock: vi.fn(),
}));

vi.mock('@/components/sign-in-button', () => ({
  SignInButton: () => <button type="button">Continue with Google</button>,
}));

vi.mock('@/lib/current-user', () => ({
  redirectAuthenticatedUser: redirectAuthenticatedUserMock,
}));

import Home from '@/app/page';

describe('Home', () => {
  it('renders the unauthenticated Google sign-in screen', async () => {
    render(await Home());

    expect(redirectAuthenticatedUserMock).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('heading', {
        name: 'Spend with clarity.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeInTheDocument();
  });
});
