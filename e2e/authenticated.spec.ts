import { expect, test } from '@playwright/test';

test('shows the protected shell for an authenticated Google session', async ({
  page,
}) => {
  await page.goto('/app');

  await expect(
    page.getByRole('heading', { name: 'Your private space is ready.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
});
