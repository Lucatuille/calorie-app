import { test, expect } from '@playwright/test';
import { STABLE_USER, dismissModals } from './helpers';

test.describe('Navigation & UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/');
    await dismissModals(page);
  });

  test('all nav links present', async ({ page }) => {
    await expect(page.getByRole('link', { name: /inicio/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /registrar/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /historial/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /progreso/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /perfil/i })).toBeVisible();
  });

  test('navigate to each page without errors', async ({ page }) => {
    const routes = ['calculator', 'history', 'progress', 'profile'];
    for (const route of routes) {
      await page.goto(`/app/${route}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('text=/algo salió mal/i')).not.toBeVisible({ timeout: 2000 });
    }
  });

  test('dark mode toggle works', async ({ page }) => {
    const themeBtn = page.locator('button[aria-label*="tema"], button:has-text("☀"), button:has-text("☽")').first();
    if (await themeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await themeBtn.click();
      const htmlTheme = await page.locator('html').getAttribute('data-theme');
      expect(['dark', 'light']).toContain(htmlTheme);
    }
  });

  test('user name shown in header', async ({ page }) => {
    await expect(page.getByText(/Stable/i).first()).toBeVisible();
  });
});

test.describe('Public pages', () => {
  test('privacy page loads', async ({ page }) => {
    await page.goto('/app/privacy');
    await expect(page.getByText(/privacidad/i).first()).toBeVisible();
  });

  test('terms page loads', async ({ page }) => {
    await page.goto('/app/terms');
    await expect(page.getByText(/términos|condiciones/i).first()).toBeVisible();
  });

  test('landing page loads at root', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/caliro/i).first()).toBeVisible();
    await expect(page.getByText(/empieza gratis/i).first()).toBeVisible();
  });

  test('invite page loads', async ({ page }) => {
    await page.goto('/invite');
    await expect(page.getByText(/instala|instálala/i).first()).toBeVisible();
  });

  test('blog page loads', async ({ page }) => {
    await page.goto('/blog/');
    await expect(page.getByText(/blog|caliro/i).first()).toBeVisible();
  });

  test('blog article loads', async ({ page }) => {
    await page.goto('/blog/alternativa-myfitnesspal-espana');
    await expect(page.getByText(/myfitnesspal|alternativa/i).first()).toBeVisible();
  });
});
