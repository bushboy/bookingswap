#!/bin/bash

# Production deployment script for Booking Swap Platform
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
BACKUP_ENABLED=${BACKUP_ENABLED:-true}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}

echo -e "${GREEN}🚀 Starting deployment for environment: ${ENVIRONMENT}${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}📋 Checking prerequisites...${NC}"
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker daemon is not running${NC}"
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    
    # Check if environment file exists
    if [ ! -f ".env.${ENVIRONMENT}" ]; then
        echo -e "${RED}❌ Environment file .env.${ENVIRONMENT} not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Create backup
create_backup() {
    if [ "$BACKUP_ENABLED" = "true" ]; then
        echo -e "${YELLOW}💾 Creating backup...${NC}"
        
        # Create backup directory
        BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        
        # Backup database
        if docker-compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
            echo "Backing up database..."
            docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > "$BACKUP_DIR/database.sql"
        fi
        
        # Backup volumes
        echo "Backing up volumes..."
        docker run --rm -v booking-swap-platform_postgres_data:/data -v $(pwd)/$BACKUP_DIR:/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .
        docker run --rm -v booking-swap-platform_redis_data:/data -v $(pwd)/$BACKUP_DIR:/backup alpine tar czf /backup/redis_data.tar.gz -C /data .
        
        echo -e "${GREEN}✅ Backup created in ${BACKUP_DIR}${NC}"
    fi
}

# Build and deploy
deploy() {
    echo -e "${YELLOW}🔨 Building and deploying services...${NC}"
    
    # Copy environment file
    cp ".env.${ENVIRONMENT}" .env
    
    # Pull latest images
    docker-compose -f docker-compose.prod.yml pull
    
    # Build custom images
    docker-compose -f docker-compose.prod.yml build --no-cache
    
    # Stop existing services
    docker-compose -f docker-compose.prod.yml down
    
    # Start services
    docker-compose -f docker-compose.prod.yml up -d
    
    echo -e "${GREEN}✅ Services deployed${NC}"
}

# Health check
health_check() {
    echo -e "${YELLOW}🏥 Performing health checks...${NC}"
    
    local timeout=$HEALTH_CHECK_TIMEOUT
    local interval=10
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        # Check backend health
        if curl -f http://localhost:3001/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend is healthy${NC}"
            
            # Check frontend health
            if curl -f http://localhost:80/health > /dev/null 2>&1; then
                echo -e "${GREEN}✅ Frontend is healthy${NC}"
                echo -e "${GREEN}🎉 Deployment successful!${NC}"
                return 0
            fi
        fi
        
        echo "Waiting for services to be healthy... (${elapsed}s/${timeout}s)"
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    echo -e "${RED}❌ Health check failed after ${timeout}s${NC}"
    echo -e "${YELLOW}📋 Service status:${NC}"
    docker-compose -f docker-compose.prod.yml ps
    
    echo -e "${YELLOW}📋 Service logs:${NC}"
    docker-compose -f docker-compose.prod.yml logs --tail=50
    
    return 1
}

# Rollback function
rollback() {
    echo -e "${YELLOW}🔄 Rolling back deployment...${NC}"
    
    # Stop current services
    docker-compose -f docker-compose.prod.yml down
    
    # Restore from backup if available
    if [ -d "backups" ]; then
        LATEST_BACKUP=$(ls -t backups/ | head -n1)
        if [ -n "$LATEST_BACKUP" ]; then
            echo "Restoring from backup: $LATEST_BACKUP"
            
            # Restore database
            if [ -f "backups/$LATEST_BACKUP/database.sql" ]; then
                docker-compose -f docker-compose.prod.yml up -d postgres
                sleep 10
                docker-compose -f docker-compose.prod.yml exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < "backups/$LATEST_BACKUP/database.sql"
            fi
            
            # Restore volumes
            if [ -f "backups/$LATEST_BACKUP/postgres_data.tar.gz" ]; then
                docker run --rm -v booking-swap-platform_postgres_data:/data -v $(pwd)/backups/$LATEST_BACKUP:/backup alpine tar xzf /backup/postgres_data.tar.gz -C /data
            fi
            
            if [ -f "backups/$LATEST_BACKUP/redis_data.tar.gz" ]; then
                docker run --rm -v booking-swap-platform_redis_data:/data -v $(pwd)/backups/$LATEST_BACKUP:/backup alpine tar xzf /backup/redis_data.tar.gz -C /data
            fi
        fi
    fi
    
    echo -e "${GREEN}✅ Rollback completed${NC}"
}

# Cleanup function
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Main deployment flow
main() {
    check_prerequisites
    create_backup
    
    if deploy && health_check; then
        cleanup
        echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
        echo -e "${GREEN}📊 Access monitoring at: http://localhost:3000${NC}"
        echo -e "${GREEN}🔍 Access logs at: http://localhost:3100${NC}"
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        read -p "Do you want to rollback? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rollback
        fi
        exit 1
    fi
}

# Handle script interruption
trap 'echo -e "\n${RED}❌ Deployment interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"