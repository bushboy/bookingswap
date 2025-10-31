#!/bin/bash

# Enhanced deployment script with feature flags support
# This script extends the base deployment with feature flag validation and management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
BACKUP_ENABLED=${BACKUP_ENABLED:-true}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}
FEATURE_FLAGS_VALIDATION=${FEATURE_FLAGS_VALIDATION:-true}

echo -e "${GREEN}🚀 Starting deployment with feature flags for environment: ${ENVIRONMENT}${NC}"

# Feature flags configuration
FEATURE_FLAGS=(
    "VITE_ENABLE_AUCTION_MODE"
    "VITE_ENABLE_CASH_SWAPS"
    "VITE_ENABLE_CASH_PROPOSALS"
)

# Validate feature flags configuration
validate_feature_flags() {
    echo -e "${YELLOW}🏁 Validating feature flags configuration...${NC}"
    
    # Check if environment file exists
    if [ ! -f "apps/frontend/.env.${ENVIRONMENT}" ]; then
        echo -e "${RED}❌ Frontend environment file not found: apps/frontend/.env.${ENVIRONMENT}${NC}"
        exit 1
    fi
    
    # Source the environment file
    source "apps/frontend/.env.${ENVIRONMENT}"
    
    # Validate each feature flag
    for flag in "${FEATURE_FLAGS[@]}"; do
        value=$(eval echo \$${flag})
        
        if [ -z "$value" ]; then
            echo -e "${YELLOW}⚠️  Feature flag ${flag} is not set, defaulting to 'false'${NC}"
            export ${flag}=false
        elif [ "$value" != "true" ] && [ "$value" != "false" ]; then
            echo -e "${RED}❌ Invalid value for ${flag}: ${value}. Must be 'true' or 'false'${NC}"
            exit 1
        else
            echo -e "${GREEN}✅ ${flag}=${value}${NC}"
        fi
    done
    
    # Display feature flags summary
    echo -e "${BLUE}📋 Feature Flags Summary:${NC}"
    echo -e "   Auction Mode: ${VITE_ENABLE_AUCTION_MODE}"
    echo -e "   Cash Swaps: ${VITE_ENABLE_CASH_SWAPS}"
    echo -e "   Cash Proposals: ${VITE_ENABLE_CASH_PROPOSALS}"
    
    # Warn if all features are enabled (might not be intended for initial deployment)
    if [ "$VITE_ENABLE_AUCTION_MODE" = "true" ] && [ "$VITE_ENABLE_CASH_SWAPS" = "true" ] && [ "$VITE_ENABLE_CASH_PROPOSALS" = "true" ]; then
        echo -e "${YELLOW}⚠️  All advanced features are enabled. This provides full functionality but may overwhelm new users.${NC}"
        read -p "Continue with all features enabled? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Deployment cancelled by user${NC}"
            exit 0
        fi
    fi
    
    # Recommend simplified UI for initial deployment
    if [ "$VITE_ENABLE_AUCTION_MODE" = "false" ] && [ "$VITE_ENABLE_CASH_SWAPS" = "false" ] && [ "$VITE_ENABLE_CASH_PROPOSALS" = "false" ]; then
        echo -e "${GREEN}✅ Simplified UI configuration detected - recommended for initial deployment${NC}"
    fi
    
    echo -e "${GREEN}✅ Feature flags validation passed${NC}"
}

# Check prerequisites (extends base function)
check_prerequisites() {
    echo -e "${YELLOW}📋 Checking prerequisites...${NC}"
    
    # Base prerequisites
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker daemon is not running${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    
    # Check environment files
    if [ ! -f ".env.${ENVIRONMENT}" ]; then
        echo -e "${RED}❌ Backend environment file .env.${ENVIRONMENT} not found${NC}"
        exit 1
    fi
    
    if [ ! -f "apps/frontend/.env.${ENVIRONMENT}" ]; then
        echo -e "${RED}❌ Frontend environment file apps/frontend/.env.${ENVIRONMENT} not found${NC}"
        exit 1
    fi
    
    # Validate feature flags if enabled
    if [ "$FEATURE_FLAGS_VALIDATION" = "true" ]; then
        validate_feature_flags
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Create backup with feature flags metadata
create_backup() {
    if [ "$BACKUP_ENABLED" = "true" ]; then
        echo -e "${YELLOW}💾 Creating backup with feature flags metadata...${NC}"
        
        # Create backup directory
        BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        
        # Save current feature flags configuration
        echo "# Feature flags at time of backup" > "$BACKUP_DIR/feature-flags.env"
        for flag in "${FEATURE_FLAGS[@]}"; do
            value=$(eval echo \$${flag})
            echo "${flag}=${value}" >> "$BACKUP_DIR/feature-flags.env"
        done
        
        # Save environment files
        cp "apps/frontend/.env.${ENVIRONMENT}" "$BACKUP_DIR/frontend.env" 2>/dev/null || true
        cp ".env.${ENVIRONMENT}" "$BACKUP_DIR/backend.env" 2>/dev/null || true
        
        # Backup database
        if docker-compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
            echo "Backing up database..."
            docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > "$BACKUP_DIR/database.sql"
        fi
        
        # Backup volumes
        echo "Backing up volumes..."
        docker run --rm -v booking-swap-platform_postgres_data:/data -v $(pwd)/$BACKUP_DIR:/backup alpine tar czf /backup/postgres_data.tar.gz -C /data . 2>/dev/null || true
        docker run --rm -v booking-swap-platform_redis_data:/data -v $(pwd)/$BACKUP_DIR:/backup alpine tar czf /backup/redis_data.tar.gz -C /data . 2>/dev/null || true
        
        echo -e "${GREEN}✅ Backup created in ${BACKUP_DIR}${NC}"
        echo -e "${BLUE}📋 Backup includes feature flags configuration${NC}"
    fi
}

# Enhanced deployment with feature flags
deploy() {
    echo -e "${YELLOW}🔨 Building and deploying services with feature flags...${NC}"
    
    # Copy environment files
    cp ".env.${ENVIRONMENT}" .env
    cp "apps/frontend/.env.${ENVIRONMENT}" apps/frontend/.env
    
    # Display deployment configuration
    echo -e "${BLUE}📋 Deployment Configuration:${NC}"
    echo -e "   Environment: ${ENVIRONMENT}"
    echo -e "   Auction Mode: ${VITE_ENABLE_AUCTION_MODE}"
    echo -e "   Cash Swaps: ${VITE_ENABLE_CASH_SWAPS}"
    echo -e "   Cash Proposals: ${VITE_ENABLE_CASH_PROPOSALS}"
    
    # Pull latest images
    echo -e "${YELLOW}📥 Pulling latest images...${NC}"
    docker-compose -f docker-compose.prod.yml pull
    
    # Build custom images with feature flags
    echo -e "${YELLOW}🔨 Building images with feature flags...${NC}"
    docker-compose -f docker-compose.prod.yml build --no-cache \
        --build-arg VITE_ENABLE_AUCTION_MODE=${VITE_ENABLE_AUCTION_MODE} \
        --build-arg VITE_ENABLE_CASH_SWAPS=${VITE_ENABLE_CASH_SWAPS} \
        --build-arg VITE_ENABLE_CASH_PROPOSALS=${VITE_ENABLE_CASH_PROPOSALS}
    
    # Stop existing services
    echo -e "${YELLOW}🛑 Stopping existing services...${NC}"
    docker-compose -f docker-compose.prod.yml down
    
    # Start services
    echo -e "${YELLOW}🚀 Starting services...${NC}"
    docker-compose -f docker-compose.prod.yml up -d
    
    echo -e "${GREEN}✅ Services deployed with feature flags${NC}"
}

# Enhanced health check with feature flags validation
health_check() {
    echo -e "${YELLOW}🏥 Performing health checks with feature flags validation...${NC}"
    
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
                
                # Validate feature flags are correctly applied
                if validate_deployed_feature_flags; then
                    echo -e "${GREEN}✅ Feature flags correctly applied${NC}"
                    echo -e "${GREEN}🎉 Deployment successful!${NC}"
                    return 0
                else
                    echo -e "${RED}❌ Feature flags validation failed${NC}"
                    return 1
                fi
            fi
        fi
        
        echo "Waiting for services to be healthy... (${elapsed}s/${timeout}s)"
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    echo -e "${RED}❌ Health check failed after ${timeout}s${NC}"
    show_deployment_status
    return 1
}

# Validate that deployed feature flags match configuration
validate_deployed_feature_flags() {
    echo -e "${YELLOW}🔍 Validating deployed feature flags...${NC}"
    
    # Wait for frontend to be fully ready
    sleep 5
    
    # Try to get feature flags from the deployed application
    local config_response
    config_response=$(curl -s http://localhost:80/config.js 2>/dev/null || echo "")
    
    if [ -z "$config_response" ]; then
        # If config.js doesn't exist, try to check environment through API
        config_response=$(curl -s http://localhost:3001/api/config 2>/dev/null || echo "")
    fi
    
    # Validate each feature flag
    local validation_passed=true
    
    for flag in "${FEATURE_FLAGS[@]}"; do
        expected_value=$(eval echo \$${flag})
        
        # Check if the flag appears in the response with the expected value
        if echo "$config_response" | grep -q "${flag}.*${expected_value}"; then
            echo -e "${GREEN}✅ ${flag}=${expected_value} correctly deployed${NC}"
        else
            echo -e "${RED}❌ ${flag} validation failed (expected: ${expected_value})${NC}"
            validation_passed=false
        fi
    done
    
    if [ "$validation_passed" = "true" ]; then
        return 0
    else
        echo -e "${RED}❌ Feature flags validation failed${NC}"
        echo -e "${YELLOW}📋 Response received:${NC}"
        echo "$config_response" | head -20
        return 1
    fi
}

# Show deployment status with feature flags
show_deployment_status() {
    echo -e "${YELLOW}📋 Deployment Status:${NC}"
    docker-compose -f docker-compose.prod.yml ps
    
    echo -e "${YELLOW}📋 Feature Flags Status:${NC}"
    for flag in "${FEATURE_FLAGS[@]}"; do
        value=$(eval echo \$${flag})
        echo -e "   ${flag}=${value}"
    done
    
    echo -e "${YELLOW}📋 Recent Logs:${NC}"
    docker-compose -f docker-compose.prod.yml logs --tail=20
}

# Enhanced rollback with feature flags restoration
rollback() {
    echo -e "${YELLOW}🔄 Rolling back deployment with feature flags restoration...${NC}"
    
    # Stop current services
    docker-compose -f docker-compose.prod.yml down
    
    # Restore from backup if available
    if [ -d "backups" ]; then
        LATEST_BACKUP=$(ls -t backups/ | head -n1)
        if [ -n "$LATEST_BACKUP" ]; then
            echo "Restoring from backup: $LATEST_BACKUP"
            
            # Restore feature flags configuration
            if [ -f "backups/$LATEST_BACKUP/feature-flags.env" ]; then
                echo -e "${BLUE}📋 Restoring feature flags configuration...${NC}"
                source "backups/$LATEST_BACKUP/feature-flags.env"
                
                # Update environment files
                if [ -f "backups/$LATEST_BACKUP/frontend.env" ]; then
                    cp "backups/$LATEST_BACKUP/frontend.env" "apps/frontend/.env.${ENVIRONMENT}"
                fi
                
                if [ -f "backups/$LATEST_BACKUP/backend.env" ]; then
                    cp "backups/$LATEST_BACKUP/backend.env" ".env.${ENVIRONMENT}"
                fi
                
                echo -e "${GREEN}✅ Feature flags configuration restored${NC}"
            fi
            
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
    
    echo -e "${GREEN}✅ Rollback completed with feature flags restoration${NC}"
}

# Feature flags management commands
manage_feature_flags() {
    local action=$1
    
    case $action in
        "enable-all")
            echo -e "${YELLOW}🔧 Enabling all features...${NC}"
            export VITE_ENABLE_AUCTION_MODE=true
            export VITE_ENABLE_CASH_SWAPS=true
            export VITE_ENABLE_CASH_PROPOSALS=true
            update_environment_files
            restart_frontend
            ;;
        "disable-all")
            echo -e "${YELLOW}🔧 Disabling all features...${NC}"
            export VITE_ENABLE_AUCTION_MODE=false
            export VITE_ENABLE_CASH_SWAPS=false
            export VITE_ENABLE_CASH_PROPOSALS=false
            update_environment_files
            restart_frontend
            ;;
        "status")
            echo -e "${BLUE}📋 Current Feature Flags Status:${NC}"
            for flag in "${FEATURE_FLAGS[@]}"; do
                value=$(eval echo \$${flag})
                echo -e "   ${flag}=${value}"
            done
            ;;
        *)
            echo -e "${YELLOW}Usage: $0 manage-flags [enable-all|disable-all|status]${NC}"
            ;;
    esac
}

# Update environment files with current feature flags
update_environment_files() {
    echo -e "${YELLOW}📝 Updating environment files...${NC}"
    
    # Update frontend environment file
    local frontend_env="apps/frontend/.env.${ENVIRONMENT}"
    
    for flag in "${FEATURE_FLAGS[@]}"; do
        value=$(eval echo \$${flag})
        
        # Update or add the flag in the environment file
        if grep -q "^${flag}=" "$frontend_env" 2>/dev/null; then
            sed -i "s/^${flag}=.*/${flag}=${value}/" "$frontend_env"
        else
            echo "${flag}=${value}" >> "$frontend_env"
        fi
    done
    
    echo -e "${GREEN}✅ Environment files updated${NC}"
}

# Restart only frontend service (feature flags don't affect backend)
restart_frontend() {
    echo -e "${YELLOW}🔄 Restarting frontend service...${NC}"
    docker-compose -f docker-compose.prod.yml restart frontend
    
    # Wait for service to be ready
    sleep 10
    
    # Validate the restart
    if curl -f http://localhost:80/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend restarted successfully${NC}"
        validate_deployed_feature_flags
    else
        echo -e "${RED}❌ Frontend restart failed${NC}"
        return 1
    fi
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
    case "${1:-deploy}" in
        "deploy")
            check_prerequisites
            create_backup
            
            if deploy && health_check; then
                cleanup
                echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
                echo -e "${GREEN}📊 Access monitoring at: http://localhost:3000${NC}"
                echo -e "${GREEN}🔍 Access logs at: http://localhost:3100${NC}"
                
                # Show final feature flags status
                echo -e "${BLUE}📋 Final Feature Flags Status:${NC}"
                manage_feature_flags "status"
            else
                echo -e "${RED}❌ Deployment failed${NC}"
                read -p "Do you want to rollback? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    rollback
                fi
                exit 1
            fi
            ;;
        "manage-flags")
            shift
            manage_feature_flags "$@"
            ;;
        "validate-flags")
            validate_deployed_feature_flags
            ;;
        "rollback")
            rollback
            ;;
        *)
            echo -e "${YELLOW}Usage: $0 [deploy|manage-flags|validate-flags|rollback] [options]${NC}"
            echo -e "${YELLOW}Examples:${NC}"
            echo -e "  $0 deploy production"
            echo -e "  $0 manage-flags enable-all"
            echo -e "  $0 manage-flags disable-all"
            echo -e "  $0 manage-flags status"
            echo -e "  $0 validate-flags"
            echo -e "  $0 rollback"
            ;;
    esac
}

# Handle script interruption
trap 'echo -e "\n${RED}❌ Deployment interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"