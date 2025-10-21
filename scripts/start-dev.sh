#!/bin/bash

###############################################################################
# HummDesk v2 Development Environment Start Script
#
# This script starts the development environment with hot reload.
#
# Usage:
#   ./scripts/start-dev.sh
###############################################################################

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Starting HummDesk v2 Development Environment...${NC}"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    if [ -f "backend/.env.example" ]; then
        echo -e "${YELLOW}Creating .env file from backend/.env.example...${NC}"
        cp backend/.env.example .env
        echo -e "${YELLOW}Please edit .env file with your settings${NC}"
    else
        echo -e "${YELLOW}Warning: No .env file found${NC}"
    fi
fi

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start services
echo -e "${BLUE}Starting Docker containers...${NC}"
docker-compose up -d

echo ""
echo -e "${GREEN}=========================================="
echo -e "HummDesk v2 Development Environment Started!"
echo -e "==========================================${NC}"
echo ""
echo -e "${BLUE}Services:${NC}"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:5000"
echo "  PostgreSQL: localhost:5432"
echo "  Redis:     localhost:6379"
echo "  MinIO:     http://localhost:9001"
echo ""
echo -e "${BLUE}Commands:${NC}"
echo "  View logs:     docker-compose logs -f"
echo "  Stop services: docker-compose down"
echo "  Restart:       docker-compose restart"
echo ""
echo -e "${YELLOW}Tip: Run 'docker-compose logs -f backend frontend' to follow logs${NC}"
