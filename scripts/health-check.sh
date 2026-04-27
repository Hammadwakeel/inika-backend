#!/bin/bash
set -e

# Health check script for monitoring

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

check_backend() {
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" 2>/dev/null)
    if [ "$response" = "200" ]; then
        echo "Backend: OK"
        return 0
    else
        echo "Backend: FAILED (HTTP $response)"
        return 1
    fi
}

check_frontend() {
    response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null)
    if [ "$response" = "200" ] || [ "$response" = "304" ]; then
        echo "Frontend: OK"
        return 0
    else
        echo "Frontend: FAILED (HTTP $response)"
        return 1
    fi
}

# Run checks
echo "=== Inika Bot Health Check ==="
echo "Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""

check_backend
backend_status=$?

check_frontend
frontend_status=$?

echo ""
if [ $((backend_status + frontend_status)) -eq 0 ]; then
    echo "Status: ALL OK"
    exit 0
else
    echo "Status: ISSUES DETECTED"
    exit 1
fi