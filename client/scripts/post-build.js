// Post-build: move SPA entry to dist/app/index.html
// and delete dist/app.html to prevent Cloudflare Pretty URLs
// from creating a 308 redirect /app.html → /app

import { copyFileSync, mkdirSync, unlinkSync } from 'fs';

mkdirSync('dist/app', { recursive: true });
copyFileSync('dist/app.html', 'dist/app/index.html');
unlinkSync('dist/app.html');
console.log('✓ Moved app.html → app/index.html (deleted app.html)');
