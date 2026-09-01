import { expect, test } from '@playwright/test';

test('creates a manual expense and reports safe field validation', async ({
  page,
}) => {
  await page.goto('/app/transactions');

  await page
    .getByRole('button', { name: /add transaction/i })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Add transaction' }),
  ).toBeVisible();
  await page.getByLabel('Description or merchant').fill('FreshCo');
  await page
    .locator('select[name="categoryId"]')
    .selectOption({ label: 'Groceries' });
  await page.getByLabel('Amount (CAD)').fill('84.16');
  await page.getByRole('button', { name: 'Save transaction' }).click();

  await expect(page.getByText('FreshCo')).toBeVisible();
  await expect(
    page.locator('tr').filter({ hasText: 'FreshCo' }).getByText('-$84.16'),
  ).toBeVisible();

  await page
    .getByRole('button', { name: /add transaction/i })
    .first()
    .click();
  await page.getByLabel('Description or merchant').fill('Invalid amount');
  await page
    .locator('select[name="categoryId"]')
    .selectOption({ label: 'Groceries' });
  await page.getByLabel('Amount (CAD)').fill('0');
  await page.getByRole('button', { name: 'Save transaction' }).click();

  await expect(page.getByText(/Amount must be greater than/)).toContainText(
    'Amount must be greater than $0.00.',
  );
});

test('archives a category and exposes its restore control', async ({
  page,
}) => {
  await page.goto('/app/categories');

  await page
    .getByRole('button', { name: /add category/i })
    .first()
    .click();
  await page.getByLabel('Category name').fill('Browser test category');
  await page.getByRole('button', { name: 'Add category', exact: true }).click();

  const categoryRow = page.locator('li').filter({
    hasText: 'Browser test category',
  });
  await expect(categoryRow).toBeVisible();
  await categoryRow.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Archive category' }).click();

  await expect(
    page.getByText('Browser test category', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
});

test('shows an empty dashboard state for a selected month without ledger rows', async ({
  page,
}) => {
  await page.goto('/app?month=2026-01');

  await expect(
    page.getByRole('heading', { name: 'No transactions in this month yet.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Add your first transaction' }),
  ).toHaveAttribute('href', '/app/transactions?new=1');
});

test('shows populated monthly dashboard totals, trend, and recent ledger records', async ({
  page,
}) => {
  await page.goto('/app?month=2026-08');

  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(
    page.getByLabel('August 2026 expense and refund trend by transaction date'),
  ).toBeVisible();
  await expect(page.getByText('Dashboard groceries')).toBeVisible();
  await expect(page.getByText('Dashboard refund')).toBeVisible();
  await expect(page.getByText('Top categories')).toBeVisible();
});

test('reviews a pre-seeded import, blocks incomplete approval, excludes it, and saves the valid candidate', async ({
  page,
}) => {
  await page.goto('/app/imports');

  await expect(
    page.getByRole('heading', { name: 'Recommended transactions' }),
  ).toBeVisible();
  const validCandidate = page.locator('article').filter({
    hasText: 'Playwright reviewed purchase',
  });
  const incompleteCandidate = page.locator('article').filter({
    hasText: 'Incomplete candidate',
  });

  await validCandidate
    .getByRole('button', { name: 'Select candidate' })
    .click();
  await incompleteCandidate
    .getByRole('button', { name: 'Select candidate' })
    .click();
  await page.getByRole('button', { name: 'Approve selected' }).click();

  await expect(page.getByText(/Candidate 2 needs/)).toBeVisible();
  await incompleteCandidate
    .getByRole('button', { name: 'Exclude candidate' })
    .click();
  await expect(incompleteCandidate.getByText('Excluded')).toBeVisible();

  await page.getByRole('button', { name: 'Approve selected' }).click();
  await expect(
    page.getByRole('heading', { name: 'Saved recommendations' }),
  ).toBeVisible();
  await expect(
    page.getByText('1 transaction saved from this batch.'),
  ).toBeVisible();
  await expect(validCandidate.getByText('Saved')).toBeVisible();

  await page.goto('/app?month=2026-09');
  await expect(page.getByText('Playwright reviewed purchase')).toBeVisible();
});
