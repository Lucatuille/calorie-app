// ============================================================
//  SCHEDULED HANDLER — Backups + emails automáticos
//  Cron: diario 03:00 UTC (configurado en wrangler.toml)
// ============================================================

import { day3EmailHTML } from './routes/auth.js';

// Fecha mínima de registro para activar el envío del email día 3.
// Previene mass-send accidental a users históricos cuando se hace el primer
// deploy de esta feature. Solo users registrados desde esta fecha califican.
const DAY3_MIN_REGISTRATION_DATE = '2026-05-08';

// Tablas a backupear (todas las que contienen datos del producto).
// Si una tabla no existe en D1, se ignora silenciosamente.
const TABLES = [
  'users',
  'entries',
  'weight_logs',
  'user_supplements',
  'supplement_logs',
  'ai_corrections',
  'user_calibration',
  'ai_usage_log',
  'ai_usage_logs',
  'assistant_conversations',
  'assistant_messages',
  'assistant_usage',
  'assistant_digests',
  'upgrade_events',
  'password_reset_tokens',
  'spanish_dishes',
  'auth_attempts',
];

const RETENTION_DAYS = 30;

async function dumpTable(env, table) {
  try {
    const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
    return { rows: results || [], count: (results || []).length, error: null };
  } catch (err) {
    return { rows: [], count: 0, error: String(err?.message || err) };
  }
}

async function deleteOldBackups(env) {
  try {
    const list = await env.BACKUP_BUCKET.list({ prefix: 'backup-' });
    const cutoff = Date.now() - RETENTION_DAYS * 86400000;
    const toDelete = (list.objects || [])
      .filter(obj => new Date(obj.uploaded).getTime() < cutoff)
      .map(obj => obj.key);
    if (toDelete.length > 0) {
      await env.BACKUP_BUCKET.delete(toDelete);
    }
    return toDelete.length;
  } catch {
    return 0;
  }
}

export async function runBackup(env) {
  const startedAt = new Date().toISOString();
  const dump = {};
  const tableSummary = {};
  let totalRows = 0;

  for (const table of TABLES) {
    const { rows, count, error } = await dumpTable(env, table);
    dump[table] = rows;
    tableSummary[table] = error ? { error } : { count };
    totalRows += count;
  }

  const finishedAt = new Date().toISOString();
  const backup = {
    schema_version: 1,
    started_at:  startedAt,
    finished_at: finishedAt,
    total_rows:  totalRows,
    table_summary: tableSummary,
    data: dump,
  };

  const dateStr = startedAt.split('T')[0];
  const key = `backup-${dateStr}.json`;
  const body = JSON.stringify(backup);

  await env.BACKUP_BUCKET.put(key, body, {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: {
      total_rows: String(totalRows),
      tables: String(Object.keys(tableSummary).length),
    },
  });

  // Limpiar backups más viejos que RETENTION_DAYS
  const deleted = await deleteOldBackups(env);

  return {
    ok: true,
    key,
    size_bytes: body.length,
    total_rows: totalRows,
    deleted_old: deleted,
  };
}

// ============================================================
//  EMAIL DÍA 3 — chequeo personal automatizado
// ============================================================
//
// Cada noche identifica users registrados hace exactamente 3 días que
// aún no han recibido el email día 3 (day3_email_sent_at IS NULL) y se
// lo envía vía Resend. Marca el flag tras envío exitoso para idempotencia.
//
// Filtros:
// - Solo users registrados desde DAY3_MIN_REGISTRATION_DATE (anti-mass-send)
// - Excluye waitlist (access_level = 0) — ellos reciben otro flow distinto
// - Solo si tiene email válido

export async function runDay3Emails(env) {
  if (!env.RESEND_API_KEY) {
    return { ok: false, reason: 'RESEND_API_KEY not configured', sent: 0 };
  }

  // Users registrados hace 3 días (yyyy-mm-dd UTC) sin email enviado.
  // Margen: date(created_at) entre -3 y -4 días por si un cron falla un día.
  let candidates;
  try {
    const { results } = await env.DB.prepare(`
      SELECT id, name, email
      FROM users
      WHERE day3_email_sent_at IS NULL
        AND date(created_at) >= date('now', '-4 days')
        AND date(created_at) <= date('now', '-3 days')
        AND date(created_at) >= date(?)
        AND access_level != 0
        AND email IS NOT NULL
        AND email != ''
    `).bind(DAY3_MIN_REGISTRATION_DATE).all();
    candidates = results || [];
  } catch (err) {
    return { ok: false, reason: 'query_failed', error: String(err?.message || err), sent: 0 };
  }

  if (candidates.length === 0) {
    return { ok: true, sent: 0, candidates: 0 };
  }

  let sent = 0;
  let failed = 0;
  const failures = [];

  for (const user of candidates) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Caliro <noreply@caliro.dev>',
          reply_to: 'contacto@caliro.dev',
          to: [user.email],
          subject: '¿Qué tal va tu primera semana con Caliro?',
          html: day3EmailHTML(user.name),
        }),
      });

      if (res.ok) {
        // Marcar como enviado para no duplicar en siguientes runs
        await env.DB.prepare(
          "UPDATE users SET day3_email_sent_at = datetime('now') WHERE id = ?"
        ).bind(user.id).run().catch(() => {});
        sent++;
      } else {
        failed++;
        const body = await res.text().catch(() => '');
        failures.push({ id: user.id, status: res.status, body: body.slice(0, 200) });
        // Si es 4xx (email malformado, dominio inválido), marcar igualmente
        // para no reintentar para siempre. 5xx se reintenta mañana.
        if (res.status >= 400 && res.status < 500) {
          await env.DB.prepare(
            "UPDATE users SET day3_email_sent_at = datetime('now') WHERE id = ?"
          ).bind(user.id).run().catch(() => {});
        }
      }
    } catch (err) {
      failed++;
      failures.push({ id: user.id, error: String(err?.message || err) });
    }
  }

  return {
    ok: true,
    candidates: candidates.length,
    sent,
    failed,
    failures: failures.slice(0, 5), // primeros 5 para logs
  };
}

export async function handleScheduled(event, env, ctx) {
  // 1. Backup (crítico) — si falla, lanzamos para que CF marque error visible
  try {
    const result = await runBackup(env);
    console.log('[backup] OK', JSON.stringify(result));
  } catch (err) {
    console.error('[backup] FAILED', err);
    throw err;
  }

  // 2. Email día 3 — fire-and-forget, errores no rompen el cron
  try {
    const result = await runDay3Emails(env);
    console.log('[day3-emails]', JSON.stringify(result));
  } catch (err) {
    console.error('[day3-emails] FAILED', err);
    // No throw: el backup ya está hecho, no queremos perder eso por un email
  }
}
