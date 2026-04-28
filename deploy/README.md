# Inika Bot - Production Deployment Guide

## Quick Start

### 1. On fresh server, run setup:
```bash
sudo ./deploy/setup-server.sh
```

### 2. Edit configuration:
```bash
# Update domain in nginx config
nano nginx/inika-ssl.conf  # replace yourdomain.com

# Add your API keys
cp backend/.env.example backend/.env
nano backend/.env
```

### 3. Deploy:
```bash
sudo ./deploy/deploy.sh
```

### 4. Setup SSL:
```bash
sudo ./deploy/setup-ssl.sh yourdomain.com admin@yourdomain.com
```

## What gets deployed

| Component | Location | Purpose |
|-----------|----------|---------|
| Backend | /opt/inika-bot | Python FastAPI app |
| venv | /opt/inika-bot/.venv | Python packages |
| Data | /opt/inika-bot/data | Tenant databases |
| Logs | journalctl -u inika | Service logs |
| Nginx | /etc/nginx/sites-available/inika.conf | Reverse proxy |

## Useful Commands

```bash
# Check service status
sudo systemctl status inika

# View logs
sudo journalctl -u inika -f

# Restart service
sudo systemctl restart inika

# Rollback deployment
cd /opt/inika-bot && git pull && sudo systemctl restart inika

# SSL auto-renewal (add to crontab)
sudo crontab -e
# Add: 0 0 * * * certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

## Security Features

- Systemd hardening (ProtectSystem, PrivateTmp, NoNewPrivileges)
- Non-root user (www-data)
- Firewall (UFW) with only 22, 80, 443
- HTTPS with TLS 1.2/1.3
- Security headers (X-Frame-Options, CSP, etc.)
- WebSocket timeout protection

## Monitoring

Health endpoint: `https://yourdomain.com/health`

Response:
```json
{
  "status": "ok",
  "checks": {
    "database": {"status": "ok"},
    "system": {"memory_percent": 65.4},
    "api_keys": {"OPENROUTER_API_KEY": {"status": "ok"}}
  }
}
```