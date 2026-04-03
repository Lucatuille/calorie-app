import { test, expect } from '@playwright/test';
import { dismissModals } from './helpers';

test.describe('Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/calculator');
    await dismissModals(page);
  });

  test('page loads with meal type selector', async ({ page }) => {
    await expect(page.getByText('Desayuno')).toBeVisible();
    await expect(page.getByText('Cena')).toBeVisible();
    await expect(page.getByText('Snack')).toBeVisible();
  });

  test('three input methods visible', async ({ page }) => {
    await expect(page.getByText(/foto/i).first()).toBeVisible();
    await expect(page.getByText(/escanear/i).first()).toBeVisible();
    await expect(page.getByText(/describir/i).first()).toBeVisible();
  });

  test('meal type selection works', async ({ page }) => {
    await page.getByText('Snack').click();
  });

  test('text analyzer opens on Describir click', async ({ page }) => {
    await page.getByText(/describir/i).first().click();
    await expect(page.locator('textarea')).toBeVisible({ timeout: 5000 });
  });

  test('save button exists', async ({ page }) => {
    await expect(page.getByText(/guardar comida/i)).toBeVisible();
  });
});
