#!/bin/bash

###############################################################################
# Log Viewer Script for HummDesk v2
#
# This script provides easy access to container logs.
#
# Usage:
#   ./scripts/logs.sh [service] [environment]
#
# Example:
#   ./scripts/logs.sh                    # All services (dev)
#   ./scripts/logs.sh backend            # Backend only
#   ./scripts/logs.sh frontend production # Frontend in production
###############################################################################

set -euo pipefail

# Configuration
SERVICE="${1:-}"
ENV="${2:-dev}"
COMPOSE_FILE="docker-compose.yml"

if [ "$ENV" == "production" ]; then
    COMPOSE_FILE="docker-compose.production.yml"
fi

# Colors
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$SERVICE" ]; then
    echo -e "${BLUE}Showing logs for all services (${ENV})...${NC}"
    echo "Press Ctrl+C to stop"
    echo ""
    docker-compose -f ${COMPOSE_FILE} logs -f
else
    echo -e "${BLUE}Showing logs for ${SERVICE} (${ENV})...${NC}"
    echo "Press Ctrl+C to stop"
    echo ""
    docker-compose -f ${COMPOSE_FILE} logs -f ${SERVICE}
fi
