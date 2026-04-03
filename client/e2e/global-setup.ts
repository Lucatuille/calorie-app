import { chromium } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(import.meta.dirname, '.auth-state.json');

async function globalSetup() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('https://caliro.dev/app/login');
  await page.waitForLoadState('networkidle');
  await page.getByPlaceholder(/email/i).first().fill('e2e-stable@caliro.dev');
  await page.getByPlaceholder(/••••/i).first().fill('StableE2E-2026!');
  await page.getByText('Entrar').click();

  // Wait for redirect away from login
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Dismiss WelcomeDisclaimer — set localStorage directly to skip it
  await page.evaluate(() => localStorage.setItem('caliro_disclaimer_v1', 'true'));

  // Reload to apply (disclaimer check happens on render)
  await page.goto('https://caliro.dev/app/');
  await page.waitForLoadState('networkidle');

  // Also try clicking away any remaining modals (WhatsNew etc)
  for (const label of [/empezar/i, /cerrar|×|✕/i]) {
    try {
      const btn = page.getByRole('button', { name: label });
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    } catch {}
  }

  // Verify token exists
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) throw new Error('Global setup: login failed, no token in localStorage');

  const disclaimer = await page.evaluate(() => localStorage.getItem('caliro_disclaimer_v1'));
  console.log(`Global setup: token=${!!token}, disclaimer=${disclaimer}`);

  // Save state including localStorage (token + disclaimer flag)
  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}

export default globalSetup;
export { AUTH_FILE };
