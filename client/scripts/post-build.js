// Post-build: copy SPA entry to dist/app/index.html
// so Cloudflare Pages serves it natively at /app/ without redirects.

import { copyFileSync, mkdirSync } from 'fs';

mkdirSync('dist/app', { recursive: true });
copyFileSync('dist/spa.html', 'dist/app/index.html');
console.log('✓ Copied spa.html → app/index.html');
