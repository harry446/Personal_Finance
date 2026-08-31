import { expect, test } from '@playwright/test';

test('shows the M0 foundation page', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'A trustworthy place to understand your spending.',
    }),
  ).toBeVisible();
  await expect(page.getByText('Human approval')).toBeVisible();
});
