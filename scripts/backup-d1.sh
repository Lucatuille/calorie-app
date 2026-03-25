#!/bin/bash
# D1 Database Backup Script
# Run manually: bash scripts/backup-d1.sh
# Or schedule weekly via cron/Task Scheduler

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y-%m-%d_%H%M)
FILE="$BACKUP_DIR/calorie-app-db_$DATE.sql"

echo "Exporting D1 database..."
cd "$PROJECT_DIR/worker"
npx wrangler d1 export calorie-app-db --remote --output="$FILE"

echo "Backup saved: $FILE"

# Keep only last 10 backups
ls -t "$BACKUP_DIR"/calorie-app-db_*.sql 2>/dev/null | tail -n +11 | xargs -r rm --
echo "Cleanup done. Current backups:"
ls -lh "$BACKUP_DIR"/calorie-app-db_*.sql 2>/dev/null
