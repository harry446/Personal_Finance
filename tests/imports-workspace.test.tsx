import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/app/imports/actions', () => ({
  approveImportBatchAction: vi.fn(),
  setCandidateReviewStateAction: vi.fn(),
  updateCandidateAction: vi.fn(),
}));

import { ImportsWorkspace } from '@/components/imports-workspace';

const batches = [
  {
    approvedCount: 0,
    candidateCount: 3,
    createdAt: '2026-09-03T00:00:00.000Z',
    id: 'batch-1',
    status: 'READY_FOR_REVIEW' as const,
  },
];

describe('ImportsWorkspace', () => {
  it('presents editable review candidates with incomplete and excluded states', () => {
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
            {
              amountCents: null,
              categoryId: null,
              categoryName: null,
              description: 'Excluded line',
              id: 'candidate-3',
              isIncomplete: true,
              notes: null,
              ordinal: 3,
              reviewState: 'EXCLUDED',
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
    expect(screen.getByText('Uncertain receipt line')).toBeVisible();
    expect(screen.getByText('Needs details')).toBeVisible();
    expect(
      screen.getByText(/This selected candidate is incomplete/),
    ).toBeVisible();
    expect(screen.getByText('Excluded')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Approve selected' }),
    ).toBeEnabled();
    expect(screen.getByRole('link', { name: /Sep 3, 2026/ })).toHaveAttribute(
      'href',
      '/app/imports?batch=batch-1',
    );
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
      screen.getByRole('heading', { name: 'Upload extraction arrives in M5' }),
    ).toBeVisible();
  });
});
