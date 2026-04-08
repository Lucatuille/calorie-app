// Genera OG images de Caliro (2400x1260) usando Satori.
// Satori convierte JSX/objetos → SVG con glyph paths embebidos (kerning real).
// Luego sharp convierte SVG → PNG. Calidad tipográfica de producto.

import satori from 'satori';
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fontsDir = resolve(__dirname, 'fonts');

const W = 2400;
const H = 1260;

// ---------- Fuentes ----------
const fonts = [
  { name: 'Inter',            data: readFileSync(resolve(fontsDir, 'Inter-Regular.ttf')),         weight: 400, style: 'normal' },
  { name: 'Inter',            data: readFileSync(resolve(fontsDir, 'Inter-Bold.ttf')),            weight: 700, style: 'normal' },
  { name: 'Instrument Serif', data: readFileSync(resolve(fontsDir, 'InstrumentSerif-Italic.ttf')), weight: 400, style: 'italic' },
];

// ---------- Helper para crear nodos sin JSX ----------
const h = (type, props, ...children) => {
  const flat = children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false);
  return {
    type,
    props: {
      ...(props || {}),
      ...(flat.length > 0 ? { children: flat.length === 1 ? flat[0] : flat } : {}),
    },
  };
};

// ---------- Logo C como data URL SVG (lo embebemos como img) ----------
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700" viewBox="0 0 700 700">
  <path d="M 426 174 A 180 180 0 1 0 426 426" stroke="#111111" stroke-width="66" fill="none" stroke-linecap="round"/>
  <circle cx="486" cy="300" r="39" fill="#22c55e"/>
</svg>`;
const logoDataUrl = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

// ---------- Markup principal ----------
const mainMarkup = h('div', {
  style: {
    width: W,
    height: H,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F2EE',
    padding: '0 180px',
    gap: 100,
  },
},
  // Logo
  h('img', { src: logoDataUrl, width: 720, height: 720 }),

  // Bloque de texto (nudge -40 para compensar peso óptico de la C)
  h('div', {
    style: { display: 'flex', flexDirection: 'column', flex: 1, marginTop: -110 },
  },
    // Kicker (co-título)
    h('div', {
      style: {
        fontFamily: 'Instrument Serif',
        fontStyle: 'italic',
        fontSize: 92,
        color: '#999999',
        marginBottom: 48,
        letterSpacing: 1,
      },
    }, 'Caliro'),

    // Línea 1
    h('div', {
      style: {
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: 86,
        color: '#1a1a1a',
        letterSpacing: -2,
        lineHeight: 1.15,
      },
    }, 'La app de nutrición que'),

    // Línea 2 (con "aprende" en verde bold)
    h('div', {
      style: {
        display: 'flex',
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: 86,
        color: '#1a1a1a',
        letterSpacing: -2,
        lineHeight: 1.15,
        marginTop: 12,
      },
    },
      h('span', { style: { fontWeight: 700, color: '#22c55e' } }, 'aprende'),
      h('span', null, '\u00A0cómo comes tú.'),
    ),
  ),
);

// ---------- Markup para artículos del blog ----------
const articleMarkup = ({ title, tagline }) => h('div', {
  style: {
    width: W,
    height: H,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F2EE',
    padding: '0 180px',
    gap: 100,
  },
},
  h('img', { src: logoDataUrl, width: 600, height: 600 }),
  h('div', {
    style: { display: 'flex', flexDirection: 'column', flex: 1 },
  },
    h('div', {
      style: {
        fontFamily: 'Instrument Serif',
        fontStyle: 'italic',
        fontSize: 56,
        color: '#999999',
        marginBottom: 32,
        letterSpacing: 1,
      },
    }, 'Caliro'),
    h('div', {
      style: {
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 92,
        color: '#1a1a1a',
        letterSpacing: -2,
        lineHeight: 1.1,
        marginBottom: 28,
      },
    }, title),
    h('div', {
      style: {
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: 52,
        color: '#666666',
        letterSpacing: -1,
        lineHeight: 1.3,
      },
    }, tagline),
  ),
);

// ---------- Renderer ----------
const render = async (markup, outPath) => {
  const svg = await satori(markup, { width: W, height: H, fonts });
  await sharp(Buffer.from(svg)).png({ quality: 95 }).toFile(outPath);
  console.log('OK', outPath);
};

// ---------- Artículos ----------
const articles = [
  { slug: 'alternativa-myfitnesspal-espana', title: 'Por qué dejé MyFitnessPal', tagline: 'Y qué uso ahora en su lugar' },
  { slug: 'cal-ai-2026-opinion',             title: 'Cal AI en 2026',           tagline: 'Opinión honesta tras un mes de uso' },
  { slug: 'calculadora-tdee',                title: 'Calculadora TDEE',         tagline: 'Calcula tus calorías diarias gratis' },
  { slug: 'contar-calorias-ia',              title: 'Contar calorías con IA',   tagline: 'La forma más rápida en 2026' },
];

// ---------- Main ----------
const main = async () => {
  console.log('Generando og-image.png principal...');
  await render(mainMarkup, 'public/og-image.png');

  console.log('Generando OG images por artículo...');
  for (const a of articles) {
    await render(articleMarkup(a), `public/blog/og-${a.slug}.png`);
  }
  console.log('Listo.');
};

main().catch(e => { console.error(e); process.exit(1); });
