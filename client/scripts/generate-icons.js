// Genera todos los iconos de Caliro desde 2 fuentes SVG con padding distinto:
//   - icon-source.svg          → favicons + apple-touch + manifest "any" (padding 20%)
//   - icon-maskable-source.svg → manifest "maskable" para Android adaptive (padding 25%)
// El logo.svg "estricto" se mantiene aparte para uso inline en la app web.

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '../public');
const ICON_SRC          = join(PUBLIC, 'icon-source.svg');
const ICON_MASKABLE_SRC = join(PUBLIC, 'icon-maskable-source.svg');
const ICONS_DIR         = join(PUBLIC, 'icons');

mkdirSync(ICONS_DIR, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// 1. Iconos PWA estándar (purpose: any) — desde icon-source
for (const size of sizes) {
  await sharp(ICON_SRC)
    .resize(size, size)
    .png()
    .toFile(join(ICONS_DIR, `icon-${size}x${size}.png`));
  console.log(`icon-${size}x${size}.png`);
}

// 2. Iconos maskable (Android adaptive) — solo 192 y 512 (los tamaños que pide manifest)
for (const size of [192, 512]) {
  await sharp(ICON_MASKABLE_SRC)
    .resize(size, size)
    .png()
    .toFile(join(ICONS_DIR, `icon-${size}x${size}-maskable.png`));
  console.log(`icon-${size}x${size}-maskable.png`);
}

// 3. Favicons (browser tab) — desde icon-source
await sharp(ICON_SRC).resize(16, 16).png().toFile(join(PUBLIC, 'favicon-16.png'));
console.log('favicon-16.png');

await sharp(ICON_SRC).resize(32, 32).png().toFile(join(PUBLIC, 'favicon-32.png'));
console.log('favicon-32.png');

await sharp(ICON_SRC).resize(32, 32).png().toFile(join(PUBLIC, 'favicon.ico'));
console.log('favicon.ico');

// 4. Apple touch icon (iOS PWA install) — desde icon-source
//    iOS aplica su propia máscara de esquinas redondeadas, no maskable agresivo
await sharp(ICON_SRC)
  .resize(180, 180)
  .png()
  .toFile(join(PUBLIC, 'apple-touch-icon.png'));
console.log('apple-touch-icon.png');

console.log('All icons generated!');
