#!/bin/bash
# SSL certificate setup - run AFTER deploy.sh and domain is configured

set -e

DOMAIN="${1:-yourdomain.com}"
EMAIL="${2:-admin@yourdomain.com}"

echo "=== Setting up SSL for $DOMAIN ==="

# Stop nginx temporarily
systemctl stop nginx

# Obtain certificate
certbot certonly --standalone -d $DOMAIN --preferred-challenges http-01 -m $EMAIL --agree-tos -n

# Update nginx config with real domain
sed -i "s/yourdomain.com/$DOMAIN/g" /etc/nginx/sites-available/inika.conf

# Start nginx
systemctl start nginx
systemctl restart inika

echo "=== SSL Setup Complete ==="
echo "Certificate location: /etc/letsencrypt/live/$DOMAIN"
echo "Add to crontab for auto-renewal:"
echo "0 0 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'"