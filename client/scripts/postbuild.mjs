/**
 * Post-build: restructure dist/ so landing is at root and SPA is at /app/
 * Runs from client/ directory (cd client && npm run build)
 */
import { copyFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// process.cwd() = client/ when npm run build runs
const dist    = resolve(process.cwd(), 'dist');
const appDist = resolve(process.cwd(), 'dist/app');
const landing = resolve(process.cwd(), '../kcal-landing.html');

mkdirSync(appDist, { recursive: true });
copyFileSync(resolve(dist, 'index.html'), resolve(appDist, 'index.html'));
console.log('✓ dist/index.html → dist/app/index.html');

copyFileSync(landing, resolve(dist, 'index.html'));
console.log('✓ kcal-landing.html → dist/index.html');
