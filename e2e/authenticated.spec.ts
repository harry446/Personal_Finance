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
  await expect(page.getByText('-$84.16')).toBeVisible();

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
