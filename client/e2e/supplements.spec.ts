import { test, expect } from '@playwright/test';
import { dismissModals } from './helpers';

test.describe('Supplements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/');
    await dismissModals(page);
  });

  test('supplement section visible on dashboard', async ({ page }) => {
    await expect(page.getByText('Suplementos', { exact: true })).toBeVisible();
  });
});
