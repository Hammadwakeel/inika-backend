#!/bin/bash
set -e

DEPLOY_DIR="/opt/inika-bot"
SERVICE_NAME="inika"

echo "=== Inika Bot Deployment Script ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo $0"
    exit 1
fi

# Stop existing service
systemctl stop $SERVICE_NAME 2>/dev/null || true

# Create deployment directory
mkdir -p $DEPLOY_DIR

# Copy files (exclude sensitive data)
rsync -av --exclude='.venv' --exclude='__pycache__' --exclude='*.pyc' --exclude='.git' --exclude='node_modules' . $DEPLOY_DIR/

# Setup virtual environment
python3 -m venv $DEPLOY_DIR/.venv
$DEPLOY_DIR/.venv/bin/pip install -r $DEPLOY_DIR/backend/requirements.txt

# Setup systemd service
cp deploy/inika.service /etc/systemd/system/$SERVICE_NAME.service
systemctl daemon-reload
systemctl enable $SERVICE_NAME

# Reload nginx
cp nginx/inika.conf /etc/nginx/sites-available/$SERVICE_NAME.conf
ln -sf /etc/nginx/sites-available/$SERVICE_NAME.conf /etc/nginx/sites-enabled/$SERVICE_NAME.conf
nginx -t && systemctl reload nginx

# Start services
systemctl start $SERVICE_NAME

# Show status
echo ""
echo "=== Deployment Complete ==="
systemctl status $SERVICE_NAME --no-pager
echo ""
echo "Nginx: $(systemctl is-active nginx)"