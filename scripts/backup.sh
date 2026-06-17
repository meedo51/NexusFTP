#!/bin/bash
# ============================================================
# NexusFTP Backup Script
# Backs up Docker volumes and cleans up old backups
# ============================================================

BACKUP_DIR="/backups/nexusftp"
RETENTION_DAYS=30

mkdir -p ${BACKUP_DIR}
DATE=$(date +%Y%m%d_%H%M%S)

echo "[$(date)] Starting backup..." >> ${BACKUP_DIR}/backup.log

# Backup data volume
docker run --rm \
    -v nexusftp-data:/data \
    -v ${BACKUP_DIR}:/backup \
    alpine tar czf /backup/data_${DATE}.tar.gz -C /data . 2>/dev/null

if [ $? -eq 0 ]; then
    echo "[$(date)] Data backup: data_${DATE}.tar.gz" >> ${BACKUP_DIR}/backup.log
else
    echo "[$(date)] WARNING: Data backup failed" >> ${BACKUP_DIR}/backup.log
fi

# Backup logs volume
docker run --rm \
    -v nexusftp-logs:/logs \
    -v ${BACKUP_DIR}:/backup \
    alpine tar czf /backup/logs_${DATE}.tar.gz -C /logs . 2>/dev/null

if [ $? -eq 0 ]; then
    echo "[$(date)] Logs backup: logs_${DATE}.tar.gz" >> ${BACKUP_DIR}/backup.log
else
    echo "[$(date)] WARNING: Logs backup failed" >> ${BACKUP_DIR}/backup.log
fi

# Cleanup old backups
OLD_COUNT=$(find ${BACKUP_DIR} -name "*.tar.gz" -mtime +${RETENTION_DAYS} | wc -l)
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup complete. Cleaned up ${OLD_COUNT} old backup(s)." >> ${BACKUP_DIR}/backup.log
