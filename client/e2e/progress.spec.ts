import { test, expect } from '@playwright/test';
import { dismissModals } from './helpers';

test.describe('Progress', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/progress');
    await dismissModals(page);
  });

  test('page loads with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /progreso/i })).toBeVisible();
  });

  test('calorie chart section visible', async ({ page }) => {
    await expect(page.getByText(/calorías diarias/i).first()).toBeVisible();
  });

  test('time range buttons visible', async ({ page }) => {
    await expect(page.getByText('7 días')).toBeVisible();
    await expect(page.getByText('30 días')).toBeVisible();
  });

  test('advanced analytics button exists', async ({ page }) => {
    await expect(page.getByText(/análisis profundo/i).first()).toBeVisible();
  });
});
