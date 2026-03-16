// ============================================================
//  PRODUCTS CACHE — /api/products/*
// ============================================================

import { jsonResponse, errorResponse, authenticate } from '../utils.js';

async function requireAuth(request, env) {
  const user = await authenticate(request, env);
  if (!user) return null;
  return user;
}

export async function handleProducts(request, env, path) {
  const user = await requireAuth(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  // ── GET /api/products/:barcode ──────────────────────────
  const barcodeMatch = path.match(/^\/api\/products\/([^/]+)$/);
  if (barcodeMatch && request.method === 'GET') {
    const barcode = barcodeMatch[1];

    const product = await env.DB.prepare(
      'SELECT * FROM products_cache WHERE barcode = ?'
    ).bind(barcode).first();

    if (!product) return jsonResponse(null);

    // Incrementar scan_count (fire and forget)
    env.DB.prepare(
      `UPDATE products_cache SET scan_count = scan_count + 1, updated_at = datetime('now') WHERE barcode = ?`
    ).bind(barcode).run().catch(() => {});

    return jsonResponse(product);
  }

  // ── POST /api/products/cache ────────────────────────────
  if (path === '/api/products/cache' && request.method === 'POST') {
    const body = await request.json();
    const {
      barcode, name, brand, image_url, quantity, quantity_unit,
      calories_100g, protein_100g, carbs_100g, fat_100g, source,
    } = body;

    if (!barcode || !name || calories_100g == null) {
      return errorResponse('barcode, name y calories_100g son obligatorios');
    }

    await env.DB.prepare(`
      INSERT INTO products_cache
        (barcode, name, brand, image_url, quantity, quantity_unit,
         calories_100g, protein_100g, carbs_100g, fat_100g, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(barcode) DO UPDATE SET
        scan_count = scan_count + 1,
        updated_at = datetime('now')
    `).bind(
      barcode,
      name,
      brand         || '',
      image_url     || '',
      quantity      ?? 100,
      quantity_unit || 'g',
      calories_100g,
      protein_100g  ?? 0,
      carbs_100g    ?? 0,
      fat_100g      ?? 0,
      source        || 'openfoodfacts',
    ).run();

    return jsonResponse({ ok: true });
  }

  return errorResponse('Not found', 404);
}
