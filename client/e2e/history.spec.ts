import { test, expect } from '@playwright/test';
import { dismissModals } from './helpers';

test.describe('History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/history');
    await dismissModals(page);
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /historial/i })).toBeVisible();
  });

  test('shows day groups', async ({ page }) => {
    await expect(page.getByText(/hoy|lunes|martes|miércoles|jueves|viernes|sábado|domingo/i).first()).toBeVisible();
  });

  test('entries show kcal', async ({ page }) => {
    await expect(page.getByText(/kcal/i).first()).toBeVisible();
  });

  test('add past meal buttons exist', async ({ page }) => {
    await expect(page.locator('[aria-label*="Añadir comida"]').first()).toBeVisible();
  });
});
