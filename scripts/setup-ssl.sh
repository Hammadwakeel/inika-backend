#!/bin/bash
set -e

# SSL certificate setup using Certbot (Let's Encrypt)

DOMAIN="${DOMAIN:-inika.example.com}"
EMAIL="${EMAIL:-admin@$DOMAIN}"
STAGING="${STAGING:-false}"

echo "=== SSL Certificate Setup for $DOMAIN ==="

# Create ssl directory
mkdir -p nginx/ssl

# Stop nginx temporarily for certbot
docker compose exec -T nginx nginx -s stop 2>/dev/null || true

# Run certbot
if [ "$STAGING" = "true" ]; then
    echo "Using staging server (for testing)..."
    certbot_params="--staging"
else
    certbot_params=""
fi

docker run --rm \
    -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
    -v "$(pwd)/nginx/conf.d:/etc/nginx/conf.d" \
    -v "/var/www/certbot:/var/www/certbot" \
    certbot/certbot:latest \
    certonly --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --domain "$DOMAIN" \
    --agree-tos \
    --non-interactive \
    $certbot_params

# Verify certificates
if [ -f "nginx/ssl/fullchain.pem" ]; then
    echo "SSL certificates installed successfully!"
    echo "Certificate expires: $(openssl x509 -enddate -noout -in nginx/ssl/fullchain.pem 2>/dev/null | cut -d= -f2)"
else
    echo "Failed to install certificates"
    exit 1
fi

# Restart nginx
docker compose up -d nginx

echo ""
echo "SSL setup complete! HTTPS should now be working."