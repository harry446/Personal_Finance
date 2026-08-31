import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: React.ComponentProps<'img'>) => <img {...props} />,
}));

vi.mock('@/app/app/actions', () => ({
  archiveCategoryAction: vi.fn(),
  createCategoryAction: vi.fn(),
  renameCategoryAction: vi.fn(),
  restoreCategoryAction: vi.fn(),
}));

import { CategoriesWorkspace } from '@/components/categories-workspace';

describe('CategoriesWorkspace', () => {
  it('separates active choices from archived history and exposes restore', () => {
    render(
      <CategoriesWorkspace
        activeCategories={[
          { id: 'category-1', name: 'Groceries', transactionCount: 3 },
          { id: 'category-2', name: 'Restaurants', transactionCount: 1 },
        ]}
        archivedCategories={[
          {
            archivedAt: '2026-08-03T00:00:00.000Z',
            id: 'category-3',
            name: 'Coffee and snacks',
            transactionCount: 4,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Active categories' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 active')).toBeInTheDocument();
    expect(screen.getByText('3 transactions')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Archived categories' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });

  it('explains the archive lifecycle when no categories are archived', () => {
    render(
      <CategoriesWorkspace activeCategories={[]} archivedCategories={[]} />,
    );

    expect(
      screen.getByText('Restore instead of duplicate'),
    ).toBeInTheDocument();
    expect(screen.getByText('No categories are archived.')).toBeInTheDocument();
  });
});
