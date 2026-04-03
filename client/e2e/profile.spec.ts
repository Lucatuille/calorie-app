import { test, expect } from '@playwright/test';
import { dismissModals } from './helpers';

test.describe('Profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/profile');
    await dismissModals(page);
  });

  test('page loads with profile form', async ({ page }) => {
    await expect(page.locator('text=/perfil/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('shows weight and height fields', async ({ page }) => {
    await expect(page.locator('text=/kg/i').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=/cm/i').first()).toBeVisible();
  });

  test('TDEE calculator button exists', async ({ page }) => {
    await expect(page.locator('button, div').filter({ hasText: /TDEE|calculadora|calcular/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('save button exists', async ({ page }) => {
    await expect(page.locator('button').filter({ hasText: /guardar/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('logout link exists', async ({ page }) => {
    await expect(page.locator('text=/salir/i').first()).toBeVisible({ timeout: 8000 });
  });
});
