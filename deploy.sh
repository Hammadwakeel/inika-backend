#!/bin/bash
set -e

echo "=== Deploying Inika Backend ==="

# Stop and remove existing container
docker compose down 2>/dev/null || true

# Build and start
docker compose up -d --build

# Show status
docker compose ps

echo ""
echo "=== Deployed ==="
echo "Health: curl http://localhost:8000/health"
