import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Home from '@/app/page';

describe('Home', () => {
  it('renders the foundation message', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', {
        name: 'A trustworthy place to understand your spending.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('CAD first')).toBeInTheDocument();
  });
});
