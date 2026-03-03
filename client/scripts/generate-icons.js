import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SVG  = join(__dirname, '../public/logo.svg');
const DEST = join(__dirname, '../public/icons');

mkdirSync(DEST, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  await sharp(SVG).resize(size, size).png().toFile(join(DEST, `icon-${size}x${size}.png`));
  console.log(`icon-${size}x${size}.png`);
}

// favicon.ico (32x32)
await sharp(SVG).resize(32, 32).png().toFile(join(__dirname, '../public/favicon.ico'));
console.log('favicon.ico');

// apple-touch-icon (180x180)
await sharp(SVG).resize(180, 180).png().toFile(join(__dirname, '../public/apple-touch-icon.png'));
console.log('apple-touch-icon.png');

console.log('All icons generated!');
