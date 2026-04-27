#!/bin/bash
set -e

# VM Setup script - Run once on fresh VM
# Usage: curl -sL https://raw.githubusercontent.com/shivwng1/inika-bot/main/scripts/setup-vm.sh | bash

set -e

echo "=== Inika Bot VM Setup ==="
echo ""

# Update system
echo "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# Install dependencies
echo "Installing dependencies..."
apt-get install -y -qq \
    curl \
    wget \
    git \
    nginx \
    certbot \
    python3 \
    python3-venv \
    python3-pip \
    ufw \
    fail2ban

# Install Docker (if not present)
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
fi

# Install Docker Compose
if ! command -v docker compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Configure firewall
echo "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# Configure fail2ban
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
maxretry = 5
bantime = 3600
findtime = 600
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# Create application directory
echo "Creating application directory..."
mkdir -p /opt/inika-bot
cd /opt/inika-bot

# Clone repository
echo "Cloning repository..."
if [ -d ".git" ]; then
    git pull
else
    git clone https://github.com/shivwng1/inika-bot.git .
fi

# Setup Python venv
echo "Setting up Python environment..."
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip

# Create data directories
mkdir -p data/tenants nginx/ssl

# Create systemd service files
echo "Installing systemd services..."
cp systemd/*.service /etc/systemd.system/ 2>/dev/null || true
systemctl daemon-reload

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Configure environment: nano /opt/inika-bot/backend/.env"
echo "2. Deploy: cd /opt/inika-bot && ./scripts/deploy.sh --build"
echo "3. Enable services: systemctl enable inika-backend inika-frontend inika-nginx"
echo ""
echo "Or use Docker Compose:"
echo "  cd /opt/inika-bot"
echo "  docker compose up -d"