import { Page, expect } from '@playwright/test';

export const STABLE_USER = {
  name: 'Stable E2E',
  email: 'e2e-stable@caliro.dev',
  password: 'StableE2E-2026!',
};

/** Dismiss any modals that block content — fast timeout */
export async function dismissModals(page: Page) {
  for (const label of [/empezar/i, /cerrar|×|✕/i]) {
    try {
      const btn = page.getByRole('button', { name: label });
      if (await btn.isVisible({ timeout: 800 })) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    } catch {}
  }
}
