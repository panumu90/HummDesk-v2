#!/bin/bash

###############################################################################
# Database Migration Script for HummDesk v2
#
# This script runs database migrations in the Docker environment.
#
# Usage:
#   ./scripts/db-migrate.sh [environment]
#
# Example:
#   ./scripts/db-migrate.sh dev
#   ./scripts/db-migrate.sh production
###############################################################################

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
ENV="${1:-dev}"
COMPOSE_FILE="docker-compose.yml"

if [ "$ENV" == "production" ]; then
    COMPOSE_FILE="docker-compose.production.yml"
fi

echo -e "${BLUE}Running database migrations (${ENV})...${NC}"

# Check if postgres is running
if ! docker-compose -f ${COMPOSE_FILE} ps postgres | grep -q "Up"; then
    echo -e "${RED}Error: PostgreSQL container is not running${NC}"
    echo "Start it with: docker-compose -f ${COMPOSE_FILE} up -d postgres"
    exit 1
fi

# Run init.sql (creates database and extensions)
echo -e "${BLUE}Running init.sql...${NC}"
docker-compose -f ${COMPOSE_FILE} exec -T postgres psql -U postgres -f /docker-entrypoint-initdb.d/01-init.sql || true

# Run schema.sql (creates tables and indexes)
echo -e "${BLUE}Running schema.sql...${NC}"
docker-compose -f ${COMPOSE_FILE} exec -T postgres psql -U postgres -d ${DB_NAME:-hummdesk_v2} -f /docker-entrypoint-initdb.d/02-schema.sql

echo ""
echo -e "${GREEN}Database migrations completed successfully!${NC}"
echo ""

# Show database info
echo -e "${BLUE}Database Information:${NC}"
docker-compose -f ${COMPOSE_FILE} exec postgres psql -U postgres -d ${DB_NAME:-hummdesk_v2} -c "\dt"

echo ""
echo -e "${BLUE}Database Extensions:${NC}"
docker-compose -f ${COMPOSE_FILE} exec postgres psql -U postgres -d ${DB_NAME:-hummdesk_v2} -c "\dx"
