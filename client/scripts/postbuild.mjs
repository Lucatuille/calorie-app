/**
 * Post-build script: restructure dist/ so that:
 *   dist/app/index.html  → React SPA (moved from dist/index.html)
 *   dist/index.html      → Landing page (copied from kcal-landing.html at repo root)
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../dist');
const appDir = resolve(distDir, 'app');
const landingSrc = resolve(__dirname, '../../kcal-landing.html');

// 1. Create dist/app/
if (!existsSync(appDir)) mkdirSync(appDir, { recursive: true });

// 2. Copy dist/index.html → dist/app/index.html
copyFileSync(resolve(distDir, 'index.html'), resolve(appDir, 'index.html'));
console.log('✓ Copied dist/index.html → dist/app/index.html');

// 3. Copy kcal-landing.html → dist/index.html (overwrites)
copyFileSync(landingSrc, resolve(distDir, 'index.html'));
console.log('✓ Copied kcal-landing.html → dist/index.html');
