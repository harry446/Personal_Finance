import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PrivacyPage from '@/app/privacy/page';

describe('privacy notice', () => {
  it('discloses Google SSO, temporary uploads, OpenAI extraction, and retention', () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole('heading', { name: 'Privacy notice' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Google is used only to authenticate you/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/sent directly to OpenAI/i)).toBeInTheDocument();
    expect(
      screen.getByText(/encrypted at rest for up to 30 days/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to sign in' }),
    ).toHaveAttribute('href', '/sign-in');
  });
});
