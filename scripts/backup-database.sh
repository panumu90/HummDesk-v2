#!/bin/bash

###############################################################################
# Database Backup Script for HummDesk v2
#
# This script creates a backup of the PostgreSQL database.
#
# Usage:
#   ./scripts/backup-database.sh [environment]
#
# Example:
#   ./scripts/backup-database.sh dev
#   ./scripts/backup-database.sh production
###############################################################################

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
ENV="${1:-dev}"
COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ "$ENV" == "production" ]; then
    COMPOSE_FILE="docker-compose.production.yml"
fi

# Create backup directory
mkdir -p ${BACKUP_DIR}

echo -e "${BLUE}Creating database backup (${ENV})...${NC}"

# Check if postgres is running
if ! docker-compose -f ${COMPOSE_FILE} ps postgres | grep -q "Up"; then
    echo -e "${RED}Error: PostgreSQL container is not running${NC}"
    exit 1
fi

# Load environment variables
if [ -f ".env.production" ] && [ "$ENV" == "production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
elif [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

DB_NAME=${DB_NAME:-hummdesk_v2}
DB_USER=${DB_USER:-postgres}
BACKUP_FILE="${BACKUP_DIR}/hummdesk_${ENV}_${TIMESTAMP}.sql"

# Create backup
echo -e "${BLUE}Backing up database: ${DB_NAME}${NC}"
docker-compose -f ${COMPOSE_FILE} exec -T postgres pg_dump -U ${DB_USER} ${DB_NAME} > ${BACKUP_FILE}

# Compress backup
echo -e "${BLUE}Compressing backup...${NC}"
gzip ${BACKUP_FILE}
BACKUP_FILE="${BACKUP_FILE}.gz"

# Get file size
BACKUP_SIZE=$(du -h ${BACKUP_FILE} | cut -f1)

echo ""
echo -e "${GREEN}Database backup completed successfully!${NC}"
echo ""
echo -e "${BLUE}Backup Details:${NC}"
echo "  File: ${BACKUP_FILE}"
echo "  Size: ${BACKUP_SIZE}"
echo ""

# Keep only last 7 backups
echo -e "${BLUE}Cleaning up old backups (keeping last 7)...${NC}"
ls -t ${BACKUP_DIR}/hummdesk_${ENV}_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm
echo -e "${GREEN}Cleanup completed${NC}"

echo ""
echo -e "${BLUE}Existing backups:${NC}"
ls -lh ${BACKUP_DIR}/hummdesk_${ENV}_*.sql.gz 2>/dev/null || echo "No backups found"
