#!/bin/bash
set -e

# Backup script for inika-bot

BACKUP_DIR="${BACKUP_DIR:-/backups/inika}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Create backup directory with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"

echo "=== Inika Bot Backup ==="
echo "Timestamp: $TIMESTAMP"
echo "Source: $PROJECT_DIR"
echo "Destination: $BACKUP_PATH"
echo ""

# Create backup directory
mkdir -p "$BACKUP_PATH"

# Backup data
echo "Backing up tenant data..."
tar -czf "$BACKUP_PATH/data.tar.gz" data/ 2>/dev/null || true

# Backup nginx config
echo "Backing up nginx configuration..."
cp -r nginx "$BACKUP_PATH/nginx" 2>/dev/null || true

# Backup environment (without secrets)
echo "Backing up environment configuration..."
if [ -f "backend/.env" ]; then
    grep -v "SECRET\|KEY\|PASSWORD" backend/.env > "$BACKUP_PATH/.env.template" 2>/dev/null || true
fi

# Backup docker compose
cp docker-compose.yml "$BACKUP_PATH/" 2>/dev/null || true
cp Dockerfile.backend "$BACKUP_PATH/" 2>/dev/null || true
cp Dockerfile.frontend "$BACKUP_PATH/" 2>/dev/null || true

# Create metadata
cat > "$BACKUP_PATH/backup_info.txt" << EOF
Backup Date: $(date -u)
Hostname: $(hostname)
Project Directory: $PROJECT_DIR
Git Commit: $(git rev-parse HEAD 2>/dev/null || echo "N/A")
Git Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "N/A")
EOF

# Show backup contents
echo ""
echo "Backup contents:"
ls -la "$BACKUP_PATH"

# Cleanup old backups (keep last 7)
echo ""
echo "Cleaning up old backups (keeping last 7)..."
find "$BACKUP_DIR" -maxdepth 1 -name "backup_*" -type d | sort -r | tail -n +8 | xargs -r rm -rf

echo ""
echo "Backup completed: $BACKUP_PATH"