#!/bin/bash

###############################################################################
# HummDesk v2 Production Deployment Script
#
# This script automates the deployment of HummDesk v2 to production.
# It builds Docker images, pushes them to registry, and deploys with zero-downtime.
#
# Usage:
#   ./scripts/deploy.sh [VERSION]
#
# Example:
#   ./scripts/deploy.sh v2.1.0
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="hummdesk-v2"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-docker.io}"
DOCKER_NAMESPACE="${DOCKER_NAMESPACE:-hummdesk}"
VERSION="${1:-latest}"
COMPOSE_FILE="docker-compose.production.yml"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    if [ ! -f ".env.production" ]; then
        log_error ".env.production file not found"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

load_env_vars() {
    log_info "Loading environment variables..."
    export $(cat .env.production | grep -v '^#' | xargs)
    log_success "Environment variables loaded"
}

build_images() {
    log_info "Building Docker images..."

    # Build backend
    log_info "Building backend image..."
    docker build -t ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/hummdesk-backend:${VERSION} ./backend
    docker tag ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/hummdesk-backend:${VERSION} \
               ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/hummdesk-backend:latest

    # Build frontend
    log_info "Building frontend image..."
    docker build -t ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/hummdesk-frontend:${VERSION} ./frontend
    docker tag ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/hummdesk-frontend:${VERSION} \
               ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/hummdesk-frontend:latest

    log_success "Docker images built successfully"
}

push_images() {
    log_info "Pushing images to registry..."

    # Login to registry
    if [ -n "${DOCKER_USERNAME:-}" ] && [ -n "${DOCKER_PASSWORD:-}" ]; then
        echo "${DOCKER_PASSWORD}" | docker login ${DOCKER_REGISTRY} -u ${DOCKER_USERNAME} --password-stdin
    fi

    # Push backend
    docker push ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/hummdesk-backend:${VERSION}
    docker push ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/hummdesk-backend:latest

    # Push frontend
    docker push ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/hummdesk-frontend:${VERSION}
    docker push ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/hummdesk-frontend:latest

    log_success "Images pushed to registry"
}

run_database_migrations() {
    log_info "Running database migrations..."

    # Check if postgres is running
    if docker-compose -f ${COMPOSE_FILE} ps postgres | grep -q "Up"; then
        docker-compose -f ${COMPOSE_FILE} exec -T postgres psql -U ${DB_USER:-postgres} -d ${DB_NAME:-hummdesk_v2} -f /docker-entrypoint-initdb.d/02-schema.sql
        log_success "Database migrations completed"
    else
        log_warning "Postgres container not running, skipping migrations"
    fi
}

backup_database() {
    log_info "Creating database backup..."

    BACKUP_DIR="./backups"
    mkdir -p ${BACKUP_DIR}

    BACKUP_FILE="${BACKUP_DIR}/db_backup_$(date +%Y%m%d_%H%M%S).sql"

    if docker-compose -f ${COMPOSE_FILE} ps postgres | grep -q "Up"; then
        docker-compose -f ${COMPOSE_FILE} exec -T postgres pg_dump -U ${DB_USER:-postgres} ${DB_NAME:-hummdesk_v2} > ${BACKUP_FILE}
        log_success "Database backup created: ${BACKUP_FILE}"
    else
        log_warning "Postgres container not running, skipping backup"
    fi
}

deploy_services() {
    log_info "Deploying services..."

    # Pull latest images
    VERSION=${VERSION} docker-compose -f ${COMPOSE_FILE} pull

    # Deploy with zero-downtime
    VERSION=${VERSION} docker-compose -f ${COMPOSE_FILE} up -d --no-deps --build --force-recreate

    log_success "Services deployed"
}

health_check() {
    log_info "Running health checks..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        log_info "Health check attempt $attempt/$max_attempts..."

        # Check backend health
        if curl -f -s http://localhost/api/health > /dev/null 2>&1; then
            log_success "Backend is healthy"
            return 0
        fi

        sleep 10
        attempt=$((attempt + 1))
    done

    log_error "Health checks failed after $max_attempts attempts"
    return 1
}

cleanup() {
    log_info "Cleaning up..."

    # Remove old images
    docker image prune -af --filter "until=72h"

    # Remove unused volumes
    docker volume prune -f

    log_success "Cleanup completed"
}

rollback() {
    log_error "Deployment failed, initiating rollback..."

    # Get previous version
    PREVIOUS_VERSION=$(docker images ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/hummdesk-backend --format "{{.Tag}}" | grep -v latest | head -n 2 | tail -n 1)

    if [ -n "${PREVIOUS_VERSION}" ]; then
        log_warning "Rolling back to version: ${PREVIOUS_VERSION}"
        VERSION=${PREVIOUS_VERSION} docker-compose -f ${COMPOSE_FILE} up -d --no-deps
        log_success "Rollback completed"
    else
        log_error "No previous version found for rollback"
        exit 1
    fi
}

main() {
    log_info "Starting deployment of ${PROJECT_NAME} version ${VERSION}..."
    echo ""

    # Trap errors and rollback
    trap rollback ERR

    check_prerequisites
    load_env_vars

    # Create backup before deployment
    backup_database

    # Build and push images
    build_images

    # Optionally push to registry (comment out for local deployments)
    # push_images

    # Run migrations
    run_database_migrations

    # Deploy services
    deploy_services

    # Health check
    if health_check; then
        log_success "Deployment successful!"
        cleanup
    else
        log_error "Deployment failed health checks"
        exit 1
    fi

    echo ""
    log_success "=========================================="
    log_success "HummDesk v2 ${VERSION} deployed successfully!"
    log_success "=========================================="
    echo ""
    log_info "Access your application at:"
    log_info "  Frontend: https://your-domain.com"
    log_info "  API:      https://your-domain.com/api"
    log_info "  MinIO:    http://localhost:9001"
    echo ""
}

# Run main function
main "$@"
