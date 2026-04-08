// ============================================================
//  Genera todos los tamaños de iconos iOS desde un PNG 1024x1024
//  Uso: node scripts/generate-ios-icons.js
//  Requisitos: client/ios-assets/icon-1024.png debe existir
//  Salida: client/ios-assets/AppIcon.appiconset/
// ============================================================

import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(__dirname, '..', 'ios-assets', 'icon-1024.png');
const OUTPUT_DIR = join(__dirname, '..', 'ios-assets', 'AppIcon.appiconset');

// Tamaños iOS oficiales (universal). Apple los necesita todos.
const ICON_SIZES = [
  { name: 'AppIcon-20.png',         size: 20  },
  { name: 'AppIcon-20@2x.png',      size: 40  },
  { name: 'AppIcon-20@3x.png',      size: 60  },
  { name: 'AppIcon-29.png',         size: 29  },
  { name: 'AppIcon-29@2x.png',      size: 58  },
  { name: 'AppIcon-29@3x.png',      size: 87  },
  { name: 'AppIcon-40.png',         size: 40  },
  { name: 'AppIcon-40@2x.png',      size: 80  },
  { name: 'AppIcon-40@3x.png',      size: 120 },
  { name: 'AppIcon-60@2x.png',      size: 120 },
  { name: 'AppIcon-60@3x.png',      size: 180 },
  { name: 'AppIcon-76.png',         size: 76  },
  { name: 'AppIcon-76@2x.png',      size: 152 },
  { name: 'AppIcon-83.5@2x.png',    size: 167 },
  { name: 'AppIcon-1024.png',       size: 1024 },
];

// Contents.json — Apple lo requiere en el .appiconset
const CONTENTS_JSON = {
  images: [
    { idiom: 'iphone',     scale: '2x', size: '20x20',   filename: 'AppIcon-20@2x.png' },
    { idiom: 'iphone',     scale: '3x', size: '20x20',   filename: 'AppIcon-20@3x.png' },
    { idiom: 'iphone',     scale: '2x', size: '29x29',   filename: 'AppIcon-29@2x.png' },
    { idiom: 'iphone',     scale: '3x', size: '29x29',   filename: 'AppIcon-29@3x.png' },
    { idiom: 'iphone',     scale: '2x', size: '40x40',   filename: 'AppIcon-40@2x.png' },
    { idiom: 'iphone',     scale: '3x', size: '40x40',   filename: 'AppIcon-40@3x.png' },
    { idiom: 'iphone',     scale: '2x', size: '60x60',   filename: 'AppIcon-60@2x.png' },
    { idiom: 'iphone',     scale: '3x', size: '60x60',   filename: 'AppIcon-60@3x.png' },
    { idiom: 'ipad',       scale: '1x', size: '20x20',   filename: 'AppIcon-20.png' },
    { idiom: 'ipad',       scale: '2x', size: '20x20',   filename: 'AppIcon-20@2x.png' },
    { idiom: 'ipad',       scale: '1x', size: '29x29',   filename: 'AppIcon-29.png' },
    { idiom: 'ipad',       scale: '2x', size: '29x29',   filename: 'AppIcon-29@2x.png' },
    { idiom: 'ipad',       scale: '1x', size: '40x40',   filename: 'AppIcon-40.png' },
    { idiom: 'ipad',       scale: '2x', size: '40x40',   filename: 'AppIcon-40@2x.png' },
    { idiom: 'ipad',       scale: '1x', size: '76x76',   filename: 'AppIcon-76.png' },
    { idiom: 'ipad',       scale: '2x', size: '76x76',   filename: 'AppIcon-76@2x.png' },
    { idiom: 'ipad',       scale: '2x', size: '83.5x83.5', filename: 'AppIcon-83.5@2x.png' },
    { idiom: 'ios-marketing', scale: '1x', size: '1024x1024', filename: 'AppIcon-1024.png' },
  ],
  info: { author: 'xcode', version: 1 },
};

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`❌ No existe ${SOURCE}`);
    console.error('   Crea un PNG cuadrado de 1024x1024 con tu logo en esa ruta.');
    console.error('   Recomendación: fondo sólido (no transparente) — Apple lo exige.');
    process.exit(1);
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`📸 Generando iconos desde ${SOURCE}...`);

  for (const { name, size } of ICON_SIZES) {
    const out = join(OUTPUT_DIR, name);
    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(out);
    console.log(`   ✓ ${name} (${size}x${size})`);
  }

  writeFileSync(
    join(OUTPUT_DIR, 'Contents.json'),
    JSON.stringify(CONTENTS_JSON, null, 2)
  );
  console.log('   ✓ Contents.json');

  console.log('\n✅ Iconos generados en client/ios-assets/AppIcon.appiconset/');
  console.log('\nPara usarlos en Xcode:');
  console.log('  1. Abre client/ios/App/App/Assets.xcassets en Xcode');
  console.log('  2. Borra el AppIcon existente');
  console.log('  3. Arrastra la carpeta AppIcon.appiconset entera dentro');
}

main().catch(err => {
  console.error('❌ Error generando iconos:', err);
  process.exit(1);
});
