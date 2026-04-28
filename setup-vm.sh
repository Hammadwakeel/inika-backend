#!/bin/bash
# Run this on a fresh Ubuntu/Debian VM

set -e

echo "=== Inika Backend Server Setup ==="

# Update
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add current user to docker group
usermod -aG docker $USER

# Setup firewall
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "=== Setup Complete ==="
echo "Logout and login again, then run:"
echo "  cd /opt && git clone https://github.com/Hammadwakeel/inika-backend.git"
echo "  cd inika-backend"
echo "  cp .env.example .env"
echo "  # Edit .env with your API keys"
echo "  ./deploy.sh"