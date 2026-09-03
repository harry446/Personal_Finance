import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { Client } from 'pg';

async function seedMockedReviewBatch() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required for authenticated browser tests.',
    );
  }

  const client = new Client({ connectionString });

  await client.connect();

  try {
    const user = await client.query<{ id: string }>(
      `SELECT "id" FROM "users"
       WHERE "email" LIKE 'playwright-m3-%@example.test'
       ORDER BY "created_at" DESC
       LIMIT 1`,
    );
    const userId = user.rows[0]?.id;

    if (!userId) {
      throw new Error('The authenticated browser user was not found.');
    }

    const categories = await client.query<{
      id: string;
      normalizedName: string;
    }>(
      `SELECT "id", "normalized_name" AS "normalizedName" FROM "categories"
       WHERE "user_id" = $1 AND "normalized_name" IN ('groceries', 'restaurants')`,
      [userId],
    );
    const categoryId = categories.rows.find(
      (category) => category.normalizedName === 'groceries',
    )?.id;
    const alternateCategoryId = categories.rows.find(
      (category) => category.normalizedName === 'restaurants',
    )?.id;

    if (!categoryId || !alternateCategoryId) {
      throw new Error(
        'The authenticated browser groceries and restaurants categories were not found.',
      );
    }

    const batchId = randomUUID();
    const candidateId = randomUUID();

    await client.query(
      `INSERT INTO "import_batches" (
        "id", "user_id", "status", "file_count", "candidate_count", "approved_count", "model", "updated_at"
      ) VALUES ($1, $2, 'ready_for_review', 1, 1, 0, 'playwright-m5-mocked', CURRENT_TIMESTAMP)`,
      [batchId, userId],
    );
    await client.query(
      `INSERT INTO "candidate_transactions" (
        "id", "import_batch_id", "ordinal", "transaction_date", "type", "amount_cents", "description", "category_id", "review_state", "updated_at"
      ) VALUES ($1, $2, 1, '2026-08-14', 'expense', 2145, 'M5 mocked upload candidate', $3, 'pending', CURRENT_TIMESTAMP)`,
      [candidateId, batchId, categoryId],
    );

    return { alternateCategoryId, batchId, candidateId, categoryId };
  } finally {
    await client.end();
  }
}

async function readMockedReviewCandidate(candidateId: string) {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required for authenticated browser tests.',
    );
  }

  const client = new Client({ connectionString });

  await client.connect();

  try {
    const result = await client.query<{
      categoryId: string | null;
      type: 'expense' | 'refund' | null;
    }>(
      `SELECT "category_id" AS "categoryId", "type"::text AS "type"
       FROM "candidate_transactions"
       WHERE "id" = $1`,
      [candidateId],
    );

    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

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

test('finalizes a reviewed import and removes every row from the review queue', async ({
  page,
}) => {
  await page.goto('/app/imports');

  await expect(
    page.getByRole('heading', { name: 'Recommended transactions' }),
  ).toBeVisible();
  const reviewCandidates = page.locator('article').filter({
    has: page.locator('input[name=description]'),
  });
  const validCandidate = reviewCandidates.nth(0);
  const incompleteCandidate = reviewCandidates.nth(1);

  await expect(validCandidate.getByLabel('Date', { exact: true })).toHaveValue(
    '2026-09-02',
  );
  await expect(
    validCandidate.getByLabel('Description or merchant'),
  ).toHaveValue('Playwright reviewed purchase');
  await expect(validCandidate.getByLabel('Amount (CAD)')).toHaveValue('18.75');
  await expect(
    validCandidate.getByRole('button', { name: 'Edit notes' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /exclude/i })).toHaveCount(0);

  await expect(page.getByRole('button', { name: 'Discard all' })).toBeEnabled();

  await validCandidate
    .getByRole('button', { name: 'Select candidate' })
    .click();
  await page.getByRole('button', { name: 'Save selected' }).click();

  await page.waitForURL(/\/app\/imports$/);
  await expect(
    page.getByRole('heading', { name: 'Nothing to review yet' }),
  ).toBeVisible();
  await expect(validCandidate).toHaveCount(0);
  await expect(incompleteCandidate).toHaveCount(0);
  await expect(page.getByText('2 candidates · 1 saved')).toBeVisible();

  await page.goto('/app?month=2026-09');
  await expect(page.getByText('Playwright reviewed purchase')).toBeVisible();
});
test('uploads a supported file and opens the review queue with a mocked extraction response', async ({
  page,
}) => {
  await page.goto('/app/imports');
  await page.waitForLoadState('networkidle');

  const { alternateCategoryId, batchId, candidateId, categoryId } =
    await seedMockedReviewBatch();
  await page.route('**/api/imports', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      body: JSON.stringify({
        batchId,
        message: 'Your files are ready for review.',
        status: 'READY_FOR_REVIEW',
      }),
      contentType: 'application/json',
      status: 201,
    });
  });

  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from('%PDF-1.7 test statement'),
    mimeType: 'application/pdf',
    name: 'private-statement.pdf',
  });
  await expect
    .poll(() =>
      page
        .locator('input[type="file"]')
        .evaluate((input) => (input as HTMLInputElement).files?.length),
    )
    .toBe(1);
  await expect(page.getByText(/1 file selected/)).toBeVisible();
  await page.getByRole('button', { name: 'Extract transactions' }).click();

  await page.waitForURL(new RegExp(`/app/imports\\?batch=${batchId}`));
  await expect(
    page.getByRole('heading', { name: 'Recommended transactions' }),
  ).toBeVisible();
  const extractedCandidate = page
    .locator('article')
    .filter({ has: page.locator('input[name=description]') })
    .first();
  await expect(extractedCandidate).toBeVisible();
  await expect(
    extractedCandidate.getByLabel('Date', { exact: true }),
  ).toHaveValue('2026-08-14');
  await expect(extractedCandidate.getByLabel('Category')).toHaveValue(
    categoryId,
  );
  await expect(extractedCandidate.getByLabel('Amount (CAD)')).toHaveValue(
    '21.45',
  );

  await extractedCandidate
    .getByLabel('Category')
    .selectOption(alternateCategoryId);
  await extractedCandidate.getByLabel('Type').selectOption('refund');
  await extractedCandidate
    .getByRole('button', { name: 'Save', exact: true })
    .click();

  await expect
    .poll(() => readMockedReviewCandidate(candidateId))
    .toEqual({
      categoryId: alternateCategoryId,
      type: 'refund',
    });
  await expect(extractedCandidate.getByLabel('Category')).toHaveValue(
    alternateCategoryId,
  );
  await expect(extractedCandidate.getByLabel('Type')).toHaveValue('refund');

  await extractedCandidate
    .getByRole('button', { name: 'Save', exact: true })
    .click();

  await expect
    .poll(() => readMockedReviewCandidate(candidateId))
    .toEqual({
      categoryId: alternateCategoryId,
      type: 'refund',
    });
});

test('enables budget mode, saves an active-category budget, and opens its detailed progress', async ({
  page,
}) => {
  await page.goto('/app/budgets');

  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();
  await page.getByRole('button', { name: 'Turn budget mode on' }).click();
  await expect(
    page.getByRole('heading', { name: 'Category budgets' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Set budget for Groceries' }).click();
  await page.getByLabel('Monthly amount (CAD)').fill('300');
  await page.getByLabel('Budget behavior').selectOption('rollover');
  await page.getByRole('button', { name: 'Save budget' }).click();

  await expect(
    page.getByRole('button', { name: 'Edit budget for Groceries' }),
  ).toBeVisible();

  await page.goto('/app');
  const budgetSummary = page.getByRole('link', {
    name: /Open detailed budgets/,
  });
  await expect(budgetSummary).toBeVisible();
  await expect(budgetSummary).toContainText('Monthly budget');
  await expect(budgetSummary).not.toContainText('Groceries');
  await budgetSummary.click();

  await page.waitForURL('/app/budgets');
  await expect(
    page.getByRole('progressbar', { name: 'Groceries budget progress' }),
  ).toBeVisible();
});
