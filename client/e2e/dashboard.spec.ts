import { test, expect } from '@playwright/test';
import { dismissModals } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/');
    await dismissModals(page);
  });

  test('shows greeting', async ({ page }) => {
    await expect(page.getByText(/buenos días|buenas tardes|buenas noches/i).first()).toBeVisible();
  });

  test('shows calorie summary with kcal', async ({ page }) => {
    await expect(page.getByText(/kcal/i).first()).toBeVisible();
  });

  test('shows macro cards', async ({ page }) => {
    await expect(page.getByText(/proteína/i).first()).toBeVisible();
    await expect(page.getByText(/carbos/i).first()).toBeVisible();
    await expect(page.getByText(/grasa/i).first()).toBeVisible();
  });

  test('shows supplement section', async ({ page }) => {
    await expect(page.getByText('Suplementos', { exact: true })).toBeVisible();
  });

  test('shows assistant card', async ({ page }) => {
    await expect(page.getByText(/asistente personal/i).first()).toBeVisible();
  });

  test('navigation to all pages works', async ({ page }) => {
    await page.getByRole('link', { name: /historial/i }).click();
    await page.waitForURL(/history/, { timeout: 5000 });

    await page.getByRole('link', { name: /progreso/i }).click();
    await page.waitForURL(/progress/, { timeout: 5000 });

    await page.getByRole('link', { name: /perfil/i }).click();
    await page.waitForURL(/profile/, { timeout: 5000 });
  });
});
