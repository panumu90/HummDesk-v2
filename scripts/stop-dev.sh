#!/bin/bash

###############################################################################
# HummDesk v2 Development Environment Stop Script
#
# Usage:
#   ./scripts/stop-dev.sh [--clean]
#
# Options:
#   --clean    Remove volumes and networks (full cleanup)
###############################################################################

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

CLEAN="${1:-}"

echo -e "${BLUE}Stopping HummDesk v2 Development Environment...${NC}"

if [ "$CLEAN" == "--clean" ]; then
    echo -e "${RED}Performing full cleanup (removing volumes)...${NC}"
    docker-compose down -v --remove-orphans
    echo -e "${GREEN}Full cleanup completed${NC}"
else
    docker-compose down --remove-orphans
    echo -e "${GREEN}Services stopped${NC}"
fi

echo ""
echo -e "${BLUE}To start again, run: ./scripts/start-dev.sh${NC}"
