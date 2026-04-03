import { test, expect } from '@playwright/test';
import { STABLE_USER } from './helpers';

test.describe('Auth flows', () => {
  test('register page loads with form', async ({ page }) => {
    await page.goto('/app/register');
    await page.waitForLoadState('networkidle');
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('login page loads with form', async ({ page }) => {
    await page.goto('/app/login');
    await page.waitForLoadState('networkidle');
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible();
    await expect(page.getByText('Entrar')).toBeVisible();
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/app/login');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder(/email/i).first().fill('wrong@example.com');
    await page.getByPlaceholder(/••••/i).first().fill('wrongpassword1');
    await page.getByText('Entrar').click();
    await expect(page.getByText(/credenciales incorrectas/i)).toBeVisible({ timeout: 5000 });
  });

  test('login with valid credentials works', async ({ page }) => {
    await page.goto('/app/login');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder(/email/i).first().fill(STABLE_USER.email);
    await page.getByPlaceholder(/••••/i).first().fill(STABLE_USER.password);
    await page.getByText('Entrar').click();
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
  });
});
