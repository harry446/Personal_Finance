import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/sign-in-button', () => ({
  SignInButton: () => <button type="button">Continue with Google</button>,
}));

import Home from '@/app/page';

describe('Home', () => {
  it('renders the unauthenticated Google sign-in screen', () => {
    render(<Home />);

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
