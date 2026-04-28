#!/bin/bash
# Server setup script - run once on fresh Ubuntu/Debian server

set -e

echo "=== Inika Bot Server Setup ==="

# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y \
    python3 python3-venv python3-pip \
    nginx certbot python3-certbot-nginx \
    curl git ufw

# Setup firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable

# Create non-root deploy user (optional - skip if running as root)
# adduser inika
# usermod -aG www-data inika

echo "Server ready! Now run deploy/deploy.sh"