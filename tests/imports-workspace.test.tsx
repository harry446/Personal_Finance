import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/app/app/imports/actions', () => ({
  approveImportBatchAction: vi.fn(),
  setCandidateReviewStateAction: vi.fn(),
  updateCandidateAction: vi.fn(),
}));

import { ImportsWorkspace } from '@/components/imports-workspace';

const batches = [
  {
    approvedCount: 0,
    candidateCount: 2,
    createdAt: '2026-09-03T00:00:00.000Z',
    id: 'batch-1',
    status: 'READY_FOR_REVIEW' as const,
  },
];

describe('ImportsWorkspace', () => {
  it('presents inline editable review candidates with selection-only controls', () => {
    render(
      <ImportsWorkspace
        activeCategories={[{ id: 'category-1', name: 'Groceries' }]}
        batch={{
          ...batches[0],
          failureMessageSafe: null,
          model: 'pre-seeded-m4-review',
          candidates: [
            {
              amountCents: 1_875,
              categoryId: 'category-1',
              categoryName: 'Groceries',
              description: 'Reviewed market purchase',
              id: 'candidate-1',
              isIncomplete: false,
              notes: null,
              ordinal: 1,
              reviewState: 'SELECTED',
              savedTransactionId: null,
              transactionDate: '2026-09-02T00:00:00.000Z',
              type: 'expense',
            },
            {
              amountCents: null,
              categoryId: null,
              categoryName: null,
              description: 'Uncertain receipt line',
              id: 'candidate-2',
              isIncomplete: true,
              notes: null,
              ordinal: 2,
              reviewState: 'SELECTED',
              savedTransactionId: null,
              transactionDate: null,
              type: null,
            },
          ],
        }}
        batches={batches}
        requestedBatchWasUnavailable={false}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Recommended transactions' }),
    ).toBeVisible();
    expect(screen.getAllByLabelText('Description or merchant')[1]).toHaveValue(
      'Uncertain receipt line',
    );
    expect(
      screen.getByText(/This selected candidate is incomplete/),
    ).toBeVisible();
    expect(screen.getAllByLabelText('Date')).toHaveLength(2);
    expect(screen.getAllByLabelText('Description or merchant')).toHaveLength(2);
    expect(screen.getAllByLabelText('Category')).toHaveLength(2);
    expect(screen.getAllByLabelText('Amount (CAD)')).toHaveLength(2);
    expect(screen.getAllByLabelText('Type')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Edit notes' })).toHaveLength(
      2,
    );
    expect(
      screen.queryByRole('button', { name: /exclude/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Ready', { exact: true }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save selected' })).toBeEnabled();
    expect(screen.getByRole('link', { name: /Sep 3, 2026/ })).toHaveAttribute(
      'href',
      '/app/imports?batch=batch-1',
    );
  });

  it('allows an all-discard finalization with no candidate selected', () => {
    render(
      <ImportsWorkspace
        activeCategories={[]}
        batch={{
          ...batches[0],
          failureMessageSafe: null,
          model: 'pre-seeded-m4-review',
          candidates: [
            {
              amountCents: null,
              categoryId: null,
              categoryName: null,
              description: 'Uncertain receipt line',
              id: 'candidate-1',
              isIncomplete: true,
              notes: null,
              ordinal: 1,
              reviewState: 'PENDING',
              savedTransactionId: null,
              transactionDate: null,
              type: null,
            },
          ],
        }}
        batches={batches}
        requestedBatchWasUnavailable={false}
      />,
    );

    expect(screen.getByText('0 candidates selected')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Discard all' })).toBeEnabled();
  });
  it('uses the Figma-aligned empty review queue when no pre-seeded batch exists', () => {
    render(
      <ImportsWorkspace
        activeCategories={[]}
        batch={null}
        batches={[]}
        requestedBatchWasUnavailable={false}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Nothing to review yet' }),
    ).toBeVisible();
    expect(screen.getByText('Waiting for an extraction')).toBeVisible();
    expect(
      screen.getByRole('heading', {
        name: 'Turn statements into reviewable transactions',
      }),
    ).toBeVisible();
  });
});
