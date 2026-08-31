import { expect, test } from '@playwright/test';

test('shows the unauthenticated Google sign-in screen', async ({ page }) => {
  await page.goto('/sign-in');

  await expect(
    page.getByRole('heading', { name: 'Spend with clarity.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible();
});

test('redirects a visitor from the protected shell to sign in', async ({
  page,
}) => {
  await page.goto('/app');

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible();
});
