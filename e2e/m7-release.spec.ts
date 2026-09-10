import { randomUUID } from 'node:crypto';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { Client } from 'pg';

const secondAuthStatePath = path.resolve('e2e/.auth/second-user.json');

test.use({ viewport: { height: 1000, width: 1440 } });

async function seedOwnerReviewBatch() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required for authenticated browser tests.',
    );
  }

  const client = new Client({ connectionString });
  const batchId = randomUUID();
  const candidateId = randomUUID();

  await client.connect();

  try {
    const user = await client.query<{ id: string }>(
      'SELECT "id" FROM "users" WHERE "email" LIKE $1 ORDER BY "created_at" DESC LIMIT 1',
      ['playwright-m3-%@example.test'],
    );
    const userId = user.rows[0]?.id;

    if (!userId) {
      throw new Error('The primary browser user was not found.');
    }

    const category = await client.query<{ id: string }>(
      'SELECT "id" FROM "categories" WHERE "user_id" = $1 AND "normalized_name" = $2 LIMIT 1',
      [userId, 'groceries'],
    );
    const categoryId = category.rows[0]?.id;

    if (!categoryId) {
      throw new Error('The primary browser groceries category was not found.');
    }

    await client.query(
      'INSERT INTO "import_batches" ("id", "user_id", "status", "file_count", "candidate_count", "approved_count", "model", "updated_at") VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)',
      [batchId, userId, 'ready_for_review', 1, 1, 0, 'm7-release-fixture'],
    );
    await client.query(
      'INSERT INTO "candidate_transactions" ("id", "import_batch_id", "ordinal", "transaction_date", "type", "amount_cents", "description", "category_id", "review_state", "updated_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)',
      [
        candidateId,
        batchId,
        1,
        '2026-09-05',
        'expense',
        1288,
        'M7 reviewed import expense',
        categoryId,
        'pending',
      ],
    );

    return { batchId, candidateId };
  } finally {
    await client.end();
  }
}

async function readCandidateReviewState(candidateId: string) {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required for authenticated browser tests.',
    );
  }

  const client = new Client({ connectionString });

  await client.connect();

  try {
    const result = await client.query<{ reviewState: string }>(
      'SELECT "review_state"::text AS "reviewState" FROM "candidate_transactions" WHERE "id" = $1',
      [candidateId],
    );

    return result.rows[0]?.reviewState ?? null;
  } finally {
    await client.end();
  }
}

async function createManualExpense(page: Page, description: string) {
  await page.goto('/app/transactions');
  await page
    .getByRole('button', { name: /add transaction/i })
    .first()
    .click();
  await page.getByLabel('Description or merchant').fill(description);
  await page
    .locator('select[name="categoryId"]')
    .selectOption({ label: 'Groceries' });
  await page.getByLabel('Amount (CAD)').fill('7.77');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
}

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
}

test('M7 release smoke: isolated accounts, human import approval, accessible responsive UI', async ({
  browser,
  page,
}, testInfo) => {
  await createManualExpense(page, 'M7 account A expense');

  const { batchId, candidateId } = await seedOwnerReviewBatch();
  await page.goto('/app/imports?batch=' + batchId);
  await expect(
    page.getByRole('heading', { name: 'Recommended transactions' }),
  ).toBeVisible();
  const reviewCandidate = page
    .locator('article')
    .filter({ has: page.locator('input[name="description"]') })
    .first();
  await reviewCandidate
    .getByRole('button', { name: 'Select candidate' })
    .click();
  await page.getByRole('button', { name: 'Save selected' }).click();
  await page.waitForURL(/\/app\/imports$/);
  await expect
    .poll(() => readCandidateReviewState(candidateId))
    .toBe('approved');

  await page.goto('/app?month=2026-09');
  await expect(page.getByText('M7 account A expense')).toBeVisible();
  await expect(page.getByText('M7 reviewed import expense')).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('m7-dashboard-desktop.png'),
  });

  await page.goto('/app/budgets');
  const enableBudgetMode = page.getByRole('button', {
    name: 'Turn budget mode on',
  });
  if (await enableBudgetMode.count()) {
    await enableBudgetMode.click();
  }
  await expect(
    page.getByRole('heading', { name: 'Category budgets' }),
  ).toBeVisible();
  const setBudget = page.getByRole('button', {
    name: 'Set budget for Groceries',
  });
  const editBudget = page.getByRole('button', {
    name: 'Edit budget for Groceries',
  });
  if (await setBudget.count()) {
    await setBudget.click();
  } else {
    await editBudget.click();
  }
  await page.getByLabel('Monthly amount (CAD)').fill('300');
  await page.getByLabel('Budget behavior').selectOption('monthly_reset');
  await page.getByRole('button', { name: 'Save budget' }).click();
  await expect(
    page.getByRole('progressbar', { name: 'Groceries budget progress' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit budget for Groceries' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toHaveCount(1);
  await expectNoAccessibilityViolations(page);

  const secondContext = await browser.newContext({
    storageState: secondAuthStatePath,
    viewport: { height: 844, width: 390 },
  });
  const secondPage = await secondContext.newPage();

  try {
    await secondPage.goto('/app?month=2026-09');
    await expect(secondPage.getByText('M7 account A expense')).toHaveCount(0);
    await expect(
      secondPage.getByText('M7 reviewed import expense'),
    ).toHaveCount(0);
    await createManualExpense(secondPage, 'M7 account B expense');
    await secondPage.goto('/app?month=2026-09');
    await expect(secondPage.getByText('M7 account B expense')).toBeVisible();
    await expect(secondPage.getByText('M7 account A expense')).toHaveCount(0);
    await expect(
      secondPage
        .locator('html')
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).resolves.toBe(true);
    await expectNoAccessibilityViolations(secondPage);
    await secondPage.screenshot({
      fullPage: true,
      path: testInfo.outputPath('m7-dashboard-mobile.png'),
    });
  } finally {
    await secondContext.close();
  }

  await page.goto('/privacy');
  await expect(
    page.getByRole('heading', { name: 'Privacy notice' }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page);
});
