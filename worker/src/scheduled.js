// ============================================================
//  SCHEDULED HANDLER — Backups automáticos D1 → R2
//  Cron: diario 03:00 UTC (configurado en wrangler.toml)
// ============================================================

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

export async function handleScheduled(event, env, ctx) {
  try {
    const result = await runBackup(env);
    console.log('[backup] OK', JSON.stringify(result));
  } catch (err) {
    console.error('[backup] FAILED', err);
    throw err; // Cloudflare lo capturará y lo mostrará en los logs
  }
}
