#!/bin/bash
set -e

# Deployment script for inika-bot on VM
# Usage: ./scripts/deploy.sh [--build] [--stop] [--logs]

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
BUILD=false
STOP=false
LOGS=false
for arg in "$@"; do
    case $arg in
        --build) BUILD=true ;;
        --stop) STOP=true ;;
        --logs) LOGS=true ;;
    esac
done

# Stop existing containers
if [ "$STOP" = true ]; then
    log_info "Stopping existing containers..."
    docker compose down 2>/dev/null || true
fi

# Create necessary directories
log_info "Creating directories..."
mkdir -p data/tenants nginx/ssl

# Copy environment file if it doesn't exist
if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        log_warn "Created backend/.env from example. Please configure it!"
    else
        log_warn "No backend/.env found. Please create it manually."
    fi
fi

# Build and start containers
if [ "$BUILD" = true ]; then
    log_info "Building Docker images..."
    docker compose build --parallel
fi

log_info "Starting services..."
docker compose up -d

# Wait for services to be healthy
log_info "Waiting for services to start..."
sleep 5

# Check status
if docker compose ps | grep -q "Up"; then
    log_info "Services started successfully!"
else
    log_error "Some services failed to start. Check logs with: docker compose logs"
fi

# Show status
docker compose ps

# Show logs if requested
if [ "$LOGS" = true ]; then
    log_info "Showing logs (Ctrl+C to exit)..."
    docker compose logs -f
fi