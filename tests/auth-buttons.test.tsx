import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signInMock, signOutMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  signIn: signInMock,
  signOut: signOutMock,
}));

import { SignInButton } from '@/components/sign-in-button';
import { SignOutButton } from '@/components/sign-out-button';

describe('authentication buttons', () => {
  beforeEach(() => {
    signInMock.mockReset();
    signOutMock.mockReset();
  });

  it('forces Google to show an account chooser', () => {
    render(<SignInButton />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Continue with Google' }),
    );

    expect(signInMock).toHaveBeenCalledWith(
      'google',
      { callbackUrl: '/app' },
      { prompt: 'select_account' },
    );
  });

  it('clears the app session before switching accounts', () => {
    render(<SignOutButton />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Sign out or switch account' }),
    );

    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/sign-in' });
  });
});
