#!/bin/bash
set -e

echo "=== Updating Inika Backend ==="

cd /opt/inika-backend

# Pull latest
git pull

# Rebuild and restart
docker compose down
docker compose up -d --build

# Show logs
docker compose logs --tail=20