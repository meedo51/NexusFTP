#!/bin/bash
# ============================================================
# NexusFTP Production Deployment Script
# Deploys to VPS at 187.77.183.14:3434 with domain ifpt.xus.me
# ============================================================

set -e

# Configuration
DOMAIN="ifpt.xus.me"
IP="187.77.183.14"
PORT="3434"
APP_DIR="/opt/nexusftp"
SSL_DIR="/etc/nginx/ssl"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║      NexusFTP Production Deployment         ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
info "Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { error "Docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { error "Docker Compose is required but not installed."; exit 1; }

ok "Docker: $(docker --version)"
ok "Docker Compose: $(docker-compose --version)"

# Step 1: Create application directory
info "Creating application directory structure..."
mkdir -p ${APP_DIR}/{data,logs,ssl,scripts}

# Step 2: Copy application files
info "Copying application files..."
if [ -d ".git" ]; then
    git pull origin main
else
    # Assume files are already in place via rsync/scp
    warn "Not a git repository. Ensure files are manually synced."
fi

# Step 3: Generate secrets
info "Generating security secrets..."
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "dev-secret-$(date +%s)")
PORT=${PORT}

# Step 4: Create .env file
info "Creating environment configuration..."
cat > .env << EOF
# NexusFTP Production Configuration
NODE_ENV=production
PORT=${PORT}
JWT_SECRET=${JWT_SECRET}
CORS_ORIGINS=https://${DOMAIN}:${PORT},http://${DOMAIN}:${PORT},http://localhost:${PORT}
FTP_TIMEOUT=30000
SFTP_TIMEOUT=30000
TRASH_RETENTION_DAYS=30
DATA_DIR=/app/data
LOG_DIR=/app/logs
LOG_LEVEL=info
EOF

ok "Environment file created"

# Step 5: Setup SSL with Let's Encrypt
info "Setting up SSL certificate..."
if command -v certbot &> /dev/null; then
    certbot certonly --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} 2>/dev/null || \
    warn "SSL certificate setup failed. You can manually run: certbot certonly --nginx -d ${DOMAIN}"
    
    # Copy certificates
    if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
        cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${SSL_DIR}/
        cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${SSL_DIR}/
        ok "SSL certificates installed"
    fi
else
    warn "Certbot not installed. SSL setup skipped."
    warn "Install with: apt-get install -y certbot python3-certbot-nginx"
fi

# Step 6: Build and start Docker containers
info "Building and starting Docker containers..."
docker-compose down 2>/dev/null || true
docker-compose up -d --build

# Step 7: Wait for services
info "Waiting for services to become healthy..."
sleep 15

# Step 8: Verify health
info "Verifying deployment..."
HEALTH_URL="http://localhost:${PORT}/health"
for i in 1 2 3 4 5; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${HEALTH_URL} 2>/dev/null || echo "000")
    if [ "${STATUS}" = "200" ]; then
        ok "Health check passed (HTTP ${STATUS})"
        break
    fi
    warn "Health check attempt ${i}/5 returned HTTP ${STATUS}, retrying..."
    sleep 3
done

# Step 9: Setup cron for SSL renewal
info "Setting up SSL renewal cron..."
(crontab -l 2>/dev/null | grep -v certbot; echo "0 0 * * * /usr/bin/certbot renew --quiet --nginx 2>/dev/null || true") | crontab -
ok "SSL renewal cron job added"

# Step 10: Setup backup cron
info "Setting up backup cron..."
cat > ${APP_DIR}/scripts/backup.sh << 'BACKUP_SCRIPT'
#!/bin/bash
# NexusFTP Backup Script
BACKUP_DIR="/backups/nexusftp"
APP_DIR="/opt/nexusftp"
RETENTION_DAYS=30

mkdir -p ${BACKUP_DIR}
DATE=$(date +%Y%m%d_%H%M%S)

echo "[$(date)] Starting backup..." >> ${BACKUP_DIR}/backup.log

# Backup volumes
docker run --rm -v nexusftp-data:/data -v ${BACKUP_DIR}:/backup alpine tar czf /backup/data_${DATE}.tar.gz -C /data .
docker run --rm -v nexusftp-logs:/logs -v ${BACKUP_DIR}:/backup alpine tar czf /backup/logs_${DATE}.tar.gz -C /logs .

# Cleanup old backups
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup complete: data_${DATE}.tar.gz, logs_${DATE}.tar.gz" >> ${BACKUP_DIR}/backup.log
BACKUP_SCRIPT

chmod +x ${APP_DIR}/scripts/backup.sh
(crontab -l 2>/dev/null | grep -v backup; echo "0 2 * * * ${APP_DIR}/scripts/backup.sh") | crontab -
ok "Backup cron job added (daily at 2 AM, 30-day retention)"

# Summary
echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║         Deployment Complete!                 ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
echo -e "  ${CYAN}Application:${NC}  https://${DOMAIN}:${PORT}"
echo -e "  ${CYAN}Health Check:${NC} https://${DOMAIN}:${PORT}/health"
echo -e "  ${CYAN}Backup:${NC}       Daily at 2 AM (${APP_DIR}/scripts/backup.sh)"
echo -e "  ${CYAN}SSL Renewal:${NC}  Daily at midnight"
echo ""
echo "  Useful commands:"
echo "    docker-compose logs -f       # View logs"
echo "    docker-compose restart       # Restart services"
echo "    docker-compose down          # Stop services"
echo "    docker-compose up -d --build # Rebuild and restart"
echo "    ${APP_DIR}/scripts/backup.sh  # Manual backup"
echo ""
