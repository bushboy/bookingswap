#!/bin/bash

# Production Configuration Setup Script
# This script helps set up production environment configuration with feature flags

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-production}
INTERACTIVE=${INTERACTIVE:-true}
BACKUP_EXISTING=${BACKUP_EXISTING:-true}

echo -e "${GREEN}🚀 Production Configuration Setup for Feature Flags${NC}"
echo -e "${BLUE}📅 Started at: $(date)${NC}"
echo ""

# Feature flags configuration options
FEATURE_FLAG_PRESETS=(
    "simplified"    # All features disabled - recommended for initial deployment
    "cash-enabled"  # Only cash features enabled
    "full-features" # All features enabled
    "custom"        # User-defined configuration
)

# Logging function
log() {
    echo -e "$1"
}

# Create backup of existing configuration
create_config_backup() {
    if [ "$BACKUP_EXISTING" = "true" ]; then
        log "${YELLOW}📦 Creating backup of existing configuration...${NC}"
        
        local backup_dir="backups/config_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$backup_dir"
        
        # Backup existing environment files
        if [ -f "apps/frontend/.env.$ENVIRONMENT" ]; then
            cp "apps/frontend/.env.$ENVIRONMENT" "$backup_dir/frontend.env.backup"
            log "${GREEN}✅ Frontend environment backed up${NC}"
        fi
        
        if [ -f ".env.$ENVIRONMENT" ]; then
            cp ".env.$ENVIRONMENT" "$backup_dir/backend.env.backup"
            log "${GREEN}✅ Backend environment backed up${NC}"
        fi
        
        log "${GREEN}✅ Configuration backup created: $backup_dir${NC}"
    fi
}

# Validate production requirements
validate_production_requirements() {
    log "${YELLOW}🔍 Validating production requirements...${NC}"
    
    local validation_failed=false
    
    # Check required files exist
    if [ ! -f "apps/frontend/.env.example" ]; then
        log "${RED}❌ Frontend .env.example not found${NC}"
        validation_failed=true
    fi
    
    if [ ! -f "apps/backend/.env.example" ]; then
        log "${RED}❌ Backend .env.example not found${NC}"
        validation_failed=true
    fi
    
    # Check Docker is available
    if ! command -v docker &> /dev/null; then
        log "${RED}❌ Docker is not installed${NC}"
        validation_failed=true
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log "${RED}❌ Docker Compose is not installed${NC}"
        validation_failed=true
    fi
    
    # Check SSL certificate requirements
    if [ ! -d "ssl" ] && [ "$ENVIRONMENT" = "production" ]; then
        log "${YELLOW}⚠️  SSL certificate directory not found. You'll need SSL certificates for production.${NC}"
    fi
    
    if [ "$validation_failed" = "true" ]; then
        log "${RED}❌ Production requirements validation failed${NC}"
        exit 1
    fi
    
    log "${GREEN}✅ Production requirements validation passed${NC}"
}

# Get feature flag configuration from user
get_feature_flag_config() {
    if [ "$INTERACTIVE" = "true" ]; then
        log "${BLUE}🏁 Feature Flag Configuration${NC}"
        log ""
        log "Choose a feature flag preset for your production deployment:"
        log ""
        log "1. ${GREEN}Simplified UI${NC} (Recommended for initial deployment)"
        log "   - Hides auction and cash swap features"
        log "   - Provides clean, simple user experience"
        log "   - Reduces user confusion and support burden"
        log ""
        log "2. ${YELLOW}Cash Features Enabled${NC}"
        log "   - Enables cash swap and proposal features"
        log "   - Keeps auction features hidden"
        log "   - Good for gradual feature rollout"
        log ""
        log "3. ${BLUE}Full Features${NC}"
        log "   - Enables all auction and cash swap features"
        log "   - Complete functionality available"
        log "   - May overwhelm new users"
        log ""
        log "4. ${YELLOW}Custom Configuration${NC}"
        log "   - Manually configure each feature flag"
        log "   - Advanced option for specific requirements"
        log ""
        
        read -p "Select preset (1-4): " -n 1 -r preset_choice
        echo ""
        
        case $preset_choice in
            1)
                FEATURE_PRESET="simplified"
                ;;
            2)
                FEATURE_PRESET="cash-enabled"
                ;;
            3)
                FEATURE_PRESET="full-features"
                ;;
            4)
                FEATURE_PRESET="custom"
                ;;
            *)
                log "${YELLOW}Invalid selection, defaulting to simplified UI${NC}"
                FEATURE_PRESET="simplified"
                ;;
        esac
    else
        # Non-interactive mode - default to simplified
        FEATURE_PRESET="simplified"
    fi
    
    # Set feature flag values based on preset
    case $FEATURE_PRESET in
        "simplified")
            VITE_ENABLE_AUCTION_MODE=false
            VITE_ENABLE_CASH_SWAPS=false
            VITE_ENABLE_CASH_PROPOSALS=false
            log "${GREEN}✅ Simplified UI configuration selected${NC}"
            ;;
        "cash-enabled")
            VITE_ENABLE_AUCTION_MODE=false
            VITE_ENABLE_CASH_SWAPS=true
            VITE_ENABLE_CASH_PROPOSALS=true
            log "${YELLOW}✅ Cash features enabled configuration selected${NC}"
            ;;
        "full-features")
            VITE_ENABLE_AUCTION_MODE=true
            VITE_ENABLE_CASH_SWAPS=true
            VITE_ENABLE_CASH_PROPOSALS=true
            log "${BLUE}✅ Full features configuration selected${NC}"
            ;;
        "custom")
            get_custom_feature_config
            ;;
    esac
    
    # Display selected configuration
    log ""
    log "${BLUE}📋 Selected Feature Flag Configuration:${NC}"
    log "   Auction Mode: ${VITE_ENABLE_AUCTION_MODE}"
    log "   Cash Swaps: ${VITE_ENABLE_CASH_SWAPS}"
    log "   Cash Proposals: ${VITE_ENABLE_CASH_PROPOSALS}"
    log ""
}

# Get custom feature flag configuration
get_custom_feature_config() {
    log "${YELLOW}🔧 Custom Feature Flag Configuration${NC}"
    
    # Auction Mode
    read -p "Enable Auction Mode? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        VITE_ENABLE_AUCTION_MODE=true
    else
        VITE_ENABLE_AUCTION_MODE=false
    fi
    
    # Cash Swaps
    read -p "Enable Cash Swaps? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        VITE_ENABLE_CASH_SWAPS=true
    else
        VITE_ENABLE_CASH_SWAPS=false
    fi
    
    # Cash Proposals
    read -p "Enable Cash Proposals? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        VITE_ENABLE_CASH_PROPOSALS=true
    else
        VITE_ENABLE_CASH_PROPOSALS=false
    fi
    
    log "${GREEN}✅ Custom configuration completed${NC}"
}

# Get production domain configuration
get_domain_config() {
    if [ "$INTERACTIVE" = "true" ]; then
        log "${BLUE}🌐 Production Domain Configuration${NC}"
        
        read -p "Enter your production domain (e.g., yourdomain.com): " PRODUCTION_DOMAIN
        
        if [ -z "$PRODUCTION_DOMAIN" ]; then
            log "${YELLOW}⚠️  No domain provided, using placeholder${NC}"
            PRODUCTION_DOMAIN="your-production-domain.com"
        fi
        
        log "${GREEN}✅ Domain configured: $PRODUCTION_DOMAIN${NC}"
    else
        PRODUCTION_DOMAIN="your-production-domain.com"
    fi
}

# Get security configuration
get_security_config() {
    if [ "$INTERACTIVE" = "true" ]; then
        log "${BLUE}🔐 Security Configuration${NC}"
        
        # JWT Secret
        read -p "Generate new JWT secret? (Y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "CHANGE_THIS_TO_A_VERY_SECURE_PRODUCTION_JWT_SECRET_MINIMUM_32_CHARACTERS")
            log "${GREEN}✅ JWT secret generated${NC}"
        else
            JWT_SECRET="CHANGE_THIS_TO_A_VERY_SECURE_PRODUCTION_JWT_SECRET_MINIMUM_32_CHARACTERS"
            log "${YELLOW}⚠️  Using placeholder JWT secret - CHANGE THIS BEFORE DEPLOYMENT${NC}"
        fi
        
        # Database credentials
        read -p "Enter database username (default: prod_booking_swap_user): " DB_USER
        DB_USER=${DB_USER:-prod_booking_swap_user}
        
        read -p "Enter database host (default: your-db-host): " DB_HOST
        DB_HOST=${DB_HOST:-your-db-host}
        
        read -p "Enter database name (default: booking_swap_prod_db): " DB_NAME
        DB_NAME=${DB_NAME:-booking_swap_prod_db}
        
        log "${GREEN}✅ Security configuration completed${NC}"
    else
        JWT_SECRET="CHANGE_THIS_TO_A_VERY_SECURE_PRODUCTION_JWT_SECRET_MINIMUM_32_CHARACTERS"
        DB_USER="prod_booking_swap_user"
        DB_HOST="your-db-host"
        DB_NAME="booking_swap_prod_db"
    fi
}

# Create production frontend environment file
create_frontend_env() {
    log "${YELLOW}📝 Creating frontend production environment...${NC}"
    
    local frontend_env="apps/frontend/.env.$ENVIRONMENT"
    
    cat > "$frontend_env" << EOF
# Frontend Production Environment Configuration
# Generated on $(date)

# =============================================================================
# API CONFIGURATION
# =============================================================================
VITE_API_BASE_URL=https://${PRODUCTION_DOMAIN}/api

# =============================================================================
# WEBSOCKET CONFIGURATION
# =============================================================================
VITE_WS_URL=https://${PRODUCTION_DOMAIN}
VITE_WS_RECONNECT_ATTEMPTS=10
VITE_WS_RECONNECT_INTERVAL=5000
VITE_WS_CONNECTION_TIMEOUT=15000
VITE_WS_HEARTBEAT_INTERVAL=30000
VITE_WS_HEARTBEAT_TIMEOUT=10000

# =============================================================================
# FALLBACK CONFIGURATION
# =============================================================================
VITE_ENABLE_FALLBACK=true
VITE_FALLBACK_POLLING_INTERVAL=30000

# =============================================================================
# PRODUCTION SECURITY CONFIGURATION
# =============================================================================
VITE_WS_DEBUG_MODE=false
VITE_WS_LOG_LEVEL=error

# =============================================================================
# HEDERA MAINNET CONFIGURATION
# =============================================================================
VITE_HEDERA_NETWORK=mainnet
VITE_HEDERA_MIRROR_NODE_URL=https://mainnet.mirrornode.hedera.com

# =============================================================================
# WALLET CONNECT PRODUCTION CONFIGURATION
# =============================================================================
VITE_WALLET_CONNECT_PROJECT_ID=your_production_wallet_connect_project_id_here

# =============================================================================
# FEATURE FLAGS CONFIGURATION - PRODUCTION
# =============================================================================
# Configuration: ${FEATURE_PRESET}
VITE_ENABLE_AUCTION_MODE=${VITE_ENABLE_AUCTION_MODE}
VITE_ENABLE_CASH_SWAPS=${VITE_ENABLE_CASH_SWAPS}
VITE_ENABLE_CASH_PROPOSALS=${VITE_ENABLE_CASH_PROPOSALS}

# =============================================================================
# ROLLBACK INSTRUCTIONS
# =============================================================================
# To disable features instantly:
# 1. Change any flag above from 'true' to 'false'
# 2. Restart frontend: docker-compose -f docker-compose.prod.yml restart frontend
# 3. Changes take effect immediately without code deployment
# =============================================================================
EOF
    
    log "${GREEN}✅ Frontend environment created: $frontend_env${NC}"
}

# Create production backend environment file
create_backend_env() {
    log "${YELLOW}📝 Creating backend production environment...${NC}"
    
    local backend_env=".env.$ENVIRONMENT"
    
    cat > "$backend_env" << EOF
# Backend Production Environment Configuration
# Generated on $(date)

# =============================================================================
# SERVER CONFIGURATION
# =============================================================================
PORT=3001
NODE_ENV=production

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
DATABASE_URL=postgresql://${DB_USER}:CHANGE_THIS_SECURE_PASSWORD@${DB_HOST}:5432/${DB_NAME}
REDIS_URL=redis://:CHANGE_THIS_REDIS_PASSWORD@your-redis-host:6379

# =============================================================================
# JWT AUTHENTICATION CONFIGURATION
# =============================================================================
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h

# =============================================================================
# HEDERA BLOCKCHAIN CONFIGURATION - MAINNET
# =============================================================================
HEDERA_NETWORK=mainnet
HEDERA_ACCOUNT_ID=0.0.YOUR_MAINNET_ACCOUNT_ID
HEDERA_PRIVATE_KEY=YOUR_MAINNET_PRIVATE_KEY_HERE
HEDERA_TOPIC_ID=0.0.YOUR_MAINNET_TOPIC_ID

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================
BCRYPT_ROUNDS=12
SESSION_TIMEOUT=3600000
CORS_ORIGIN=https://${PRODUCTION_DOMAIN}

# =============================================================================
# RATE LIMITING CONFIGURATION
# =============================================================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================
LOG_LEVEL=info
STRUCTURED_LOGGING=true

# =============================================================================
# MONITORING AND METRICS
# =============================================================================
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_ENABLED=true

# =============================================================================
# BACKUP CONFIGURATION
# =============================================================================
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30

# =============================================================================
# FEATURE FLAGS BACKEND NOTES
# =============================================================================
# IMPORTANT: Backend does NOT use feature flags for API functionality.
# All auction and cash swap functionality remains fully operational.
# Frontend flags control only UI visibility.
# =============================================================================
EOF
    
    log "${GREEN}✅ Backend environment created: $backend_env${NC}"
}

# Create Docker Compose production configuration
create_docker_compose_config() {
    log "${YELLOW}📝 Creating Docker Compose production configuration...${NC}"
    
    cat > "docker-compose.prod.yml" << EOF
version: '3.8'

services:
  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile.prod
      args:
        - VITE_ENABLE_AUCTION_MODE=\${VITE_ENABLE_AUCTION_MODE:-false}
        - VITE_ENABLE_CASH_SWAPS=\${VITE_ENABLE_CASH_SWAPS:-false}
        - VITE_ENABLE_CASH_PROPOSALS=\${VITE_ENABLE_CASH_PROPOSALS:-false}
    ports:
      - "80:80"
      - "443:443"
    environment:
      - VITE_ENABLE_AUCTION_MODE=\${VITE_ENABLE_AUCTION_MODE:-false}
      - VITE_ENABLE_CASH_SWAPS=\${VITE_ENABLE_CASH_SWAPS:-false}
      - VITE_ENABLE_CASH_PROPOSALS=\${VITE_ENABLE_CASH_PROPOSALS:-false}
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile.prod
    ports:
      - "3001:3001"
      - "9090:9090"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=\${DATABASE_URL}
      - REDIS_URL=\${REDIS_URL}
      - JWT_SECRET=\${JWT_SECRET}
      - HEDERA_NETWORK=\${HEDERA_NETWORK}
      - HEDERA_ACCOUNT_ID=\${HEDERA_ACCOUNT_ID}
      - HEDERA_PRIVATE_KEY=\${HEDERA_PRIVATE_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=\${POSTGRES_DB}
      - POSTGRES_USER=\${POSTGRES_USER}
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass \${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: booking-swap-production
EOF
    
    log "${GREEN}✅ Docker Compose production configuration created${NC}"
}

# Create deployment validation script
create_validation_script() {
    log "${YELLOW}📝 Creating deployment validation script...${NC}"
    
    cat > "scripts/validate-production-deployment.sh" << 'EOF'
#!/bin/bash

# Production Deployment Validation Script
# Validates that production deployment is working correctly with feature flags

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN=${DOMAIN:-localhost}
TIMEOUT=${TIMEOUT:-300}

echo -e "${GREEN}🔍 Validating production deployment...${NC}"

# Check service health
validate_backend_health() {
    echo -e "${YELLOW}Checking backend health...${NC}"
    
    local url="https://${DOMAIN}/api/health"
    if [ "$DOMAIN" = "localhost" ]; then
        url="http://localhost:3001/health"
    fi
    
    if curl -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Backend health check failed${NC}"
        return 1
    fi
}

validate_frontend_health() {
    echo -e "${YELLOW}Checking frontend health...${NC}"
    
    local url="https://${DOMAIN}/health"
    if [ "$DOMAIN" = "localhost" ]; then
        url="http://localhost:80/health"
    fi
    
    if curl -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend is healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Frontend health check failed${NC}"
        return 1
    fi
}

# Validate feature flags
validate_feature_flags() {
    echo -e "${YELLOW}Validating feature flags configuration...${NC}"
    
    local config_url="https://${DOMAIN}/config.js"
    if [ "$DOMAIN" = "localhost" ]; then
        config_url="http://localhost:80/config.js"
    fi
    
    local config_response
    config_response=$(curl -s "$config_url" 2>/dev/null || echo "")
    
    if [ -z "$config_response" ]; then
        echo -e "${YELLOW}⚠️  Could not retrieve frontend configuration${NC}"
        return 0
    fi
    
    # Check each feature flag
    local flags=("VITE_ENABLE_AUCTION_MODE" "VITE_ENABLE_CASH_SWAPS" "VITE_ENABLE_CASH_PROPOSALS")
    local validation_passed=true
    
    for flag in "${flags[@]}"; do
        if echo "$config_response" | grep -q "$flag"; then
            local value=$(echo "$config_response" | grep "$flag" | sed 's/.*=\([^;]*\).*/\1/' | tr -d ' ')
            echo -e "${GREEN}✅ ${flag}=${value}${NC}"
        else
            echo -e "${YELLOW}⚠️  ${flag} not found in configuration${NC}"
        fi
    done
    
    return 0
}

# Test API endpoints
test_api_endpoints() {
    echo -e "${YELLOW}Testing API endpoints...${NC}"
    
    local api_url="https://${DOMAIN}/api"
    if [ "$DOMAIN" = "localhost" ]; then
        api_url="http://localhost:3001/api"
    fi
    
    # Test health endpoint
    if curl -f "${api_url}/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API health endpoint accessible${NC}"
    else
        echo -e "${RED}❌ API health endpoint failed${NC}"
        return 1
    fi
    
    # Test other endpoints (may require authentication)
    local endpoints=("swaps" "proposals" "users")
    for endpoint in "${endpoints[@]}"; do
        local status_code
        status_code=$(curl -s -o /dev/null -w "%{http_code}" "${api_url}/${endpoint}" || echo "000")
        
        if [ "$status_code" = "200" ] || [ "$status_code" = "401" ] || [ "$status_code" = "403" ]; then
            echo -e "${GREEN}✅ API ${endpoint} endpoint accessible (${status_code})${NC}"
        else
            echo -e "${YELLOW}⚠️  API ${endpoint} endpoint returned ${status_code}${NC}"
        fi
    done
    
    return 0
}

# Main validation
main() {
    local validation_failed=false
    
    echo -e "${BLUE}📋 Production Deployment Validation Report${NC}"
    echo -e "${BLUE}📅 $(date)${NC}"
    echo -e "${BLUE}🌐 Domain: ${DOMAIN}${NC}"
    echo ""
    
    # Wait for services to be ready
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
    sleep 10
    
    # Run validations
    if ! validate_backend_health; then
        validation_failed=true
    fi
    
    if ! validate_frontend_health; then
        validation_failed=true
    fi
    
    validate_feature_flags
    test_api_endpoints
    
    echo ""
    if [ "$validation_failed" = "true" ]; then
        echo -e "${RED}❌ Production deployment validation failed${NC}"
        echo -e "${YELLOW}📋 Check the logs for more details:${NC}"
        echo -e "   docker-compose -f docker-compose.prod.yml logs"
        exit 1
    else
        echo -e "${GREEN}🎉 Production deployment validation passed!${NC}"
        echo -e "${BLUE}📊 Monitor your deployment at:${NC}"
        echo -e "   Frontend: https://${DOMAIN}"
        echo -e "   API: https://${DOMAIN}/api/health"
        echo -e "   Metrics: https://${DOMAIN}:9090"
    fi
}

main "$@"
EOF
    
    chmod +x "scripts/validate-production-deployment.sh"
    log "${GREEN}✅ Deployment validation script created${NC}"
}

# Create quick deployment script
create_deployment_script() {
    log "${YELLOW}📝 Creating quick deployment script...${NC}"
    
    cat > "scripts/deploy-production-quick.sh" << 'EOF'
#!/bin/bash

# Quick Production Deployment Script with Feature Flags
# This script provides a streamlined deployment process

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT=${ENVIRONMENT:-production}
BACKUP_ENABLED=${BACKUP_ENABLED:-true}

echo -e "${GREEN}🚀 Quick Production Deployment${NC}"
echo -e "${BLUE}📅 $(date)${NC}"

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    source ".env.${ENVIRONMENT}"
fi

if [ -f "apps/frontend/.env.${ENVIRONMENT}" ]; then
    source "apps/frontend/.env.${ENVIRONMENT}"
fi

# Display deployment configuration
echo -e "${BLUE}📋 Deployment Configuration:${NC}"
echo -e "   Environment: ${ENVIRONMENT}"
echo -e "   Auction Mode: ${VITE_ENABLE_AUCTION_MODE:-false}"
echo -e "   Cash Swaps: ${VITE_ENABLE_CASH_SWAPS:-false}"
echo -e "   Cash Proposals: ${VITE_ENABLE_CASH_PROPOSALS:-false}"
echo ""

# Create backup
if [ "$BACKUP_ENABLED" = "true" ]; then
    echo -e "${YELLOW}📦 Creating backup...${NC}"
    ./scripts/create-backup.sh || echo -e "${YELLOW}⚠️  Backup script not found, continuing...${NC}"
fi

# Copy environment files
echo -e "${YELLOW}📝 Setting up environment...${NC}"
cp ".env.${ENVIRONMENT}" .env
cp "apps/frontend/.env.${ENVIRONMENT}" apps/frontend/.env

# Deploy services
echo -e "${YELLOW}🔨 Deploying services...${NC}"
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Wait for services
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 30

# Validate deployment
echo -e "${YELLOW}🔍 Validating deployment...${NC}"
if ./scripts/validate-production-deployment.sh; then
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    
    # Display access information
    echo -e "${BLUE}📊 Access Information:${NC}"
    echo -e "   Application: http://localhost (or your domain)"
    echo -e "   API Health: http://localhost:3001/health"
    echo -e "   Metrics: http://localhost:9090"
    
    # Display feature flag status
    echo -e "${BLUE}🏁 Feature Flags Status:${NC}"
    echo -e "   Auction Mode: ${VITE_ENABLE_AUCTION_MODE:-false}"
    echo -e "   Cash Swaps: ${VITE_ENABLE_CASH_SWAPS:-false}"
    echo -e "   Cash Proposals: ${VITE_ENABLE_CASH_PROPOSALS:-false}"
    
    # Rollback instructions
    echo -e "${YELLOW}🔄 Quick Rollback Instructions:${NC}"
    echo -e "   To disable features: ./scripts/rollback-feature-flags.sh emergency"
    echo -e "   To restore backup: ./scripts/rollback-feature-flags.sh restore [backup_dir]"
    
else
    echo -e "${RED}❌ Deployment validation failed${NC}"
    read -p "Do you want to rollback? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🔄 Rolling back deployment...${NC}"
        ./scripts/rollback-feature-flags.sh emergency
    fi
    exit 1
fi
EOF
    
    chmod +x "scripts/deploy-production-quick.sh"
    log "${GREEN}✅ Quick deployment script created${NC}"
}

# Generate deployment documentation
generate_deployment_docs() {
    log "${YELLOW}📝 Generating deployment documentation...${NC}"
    
    cat > "docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md" << EOF
# Production Deployment Checklist

This checklist ensures a successful production deployment with feature flags.

## Pre-Deployment Checklist

### Infrastructure
- [ ] PostgreSQL 13+ database instance ready
- [ ] Redis 6+ cache instance ready  
- [ ] SSL certificates obtained and configured
- [ ] DNS records pointing to production servers
- [ ] Load balancer configured (if applicable)
- [ ] Monitoring and alerting systems ready

### Security
- [ ] Strong JWT secret generated (minimum 32 characters)
- [ ] Database credentials secured and unique
- [ ] Hedera mainnet account configured with sufficient HBAR
- [ ] All API keys updated to production values
- [ ] CORS origins configured for production domain
- [ ] Rate limiting configured

### Configuration
- [ ] Frontend environment file configured (\`apps/frontend/.env.production\`)
- [ ] Backend environment file configured (\`.env.production\`)
- [ ] Feature flags set to desired values
- [ ] Docker Compose production file ready
- [ ] Nginx configuration prepared

## Deployment Process

### 1. Final Configuration Review
\`\`\`bash
# Review configuration files
cat apps/frontend/.env.production
cat .env.production

# Validate feature flag settings
echo "Auction Mode: \$VITE_ENABLE_AUCTION_MODE"
echo "Cash Swaps: \$VITE_ENABLE_CASH_SWAPS"  
echo "Cash Proposals: \$VITE_ENABLE_CASH_PROPOSALS"
\`\`\`

### 2. Create Backup
\`\`\`bash
# Create backup of current system
./scripts/create-backup.sh
\`\`\`

### 3. Deploy Services
\`\`\`bash
# Quick deployment
./scripts/deploy-production-quick.sh

# Or use enhanced deployment script
./scripts/deploy-with-feature-flags.sh production
\`\`\`

### 4. Validate Deployment
\`\`\`bash
# Run validation checks
./scripts/validate-production-deployment.sh

# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs --tail=50
\`\`\`

## Post-Deployment Checklist

### Immediate Validation
- [ ] All services are running and healthy
- [ ] Frontend accessible via HTTPS
- [ ] Backend API responding to health checks
- [ ] Feature flags correctly applied
- [ ] SSL certificates working
- [ ] Database connections established

### Feature Flag Validation
- [ ] Auction mode features hidden/shown as expected
- [ ] Cash swap features hidden/shown as expected  
- [ ] Cash proposal features hidden/shown as expected
- [ ] UI displays correctly with current configuration
- [ ] No JavaScript errors in browser console

### Functional Testing
- [ ] User registration/login working
- [ ] Swap creation working (with visible features only)
- [ ] Proposal creation working (with visible features only)
- [ ] WebSocket connections established
- [ ] Real-time updates functioning

### Performance and Monitoring
- [ ] Response times within acceptable limits
- [ ] Memory and CPU usage normal
- [ ] Database performance acceptable
- [ ] Monitoring dashboards showing data
- [ ] Alerts configured and working

## Feature Flag Management

### Current Configuration
Feature flags configured during setup:
- Auction Mode: ${VITE_ENABLE_AUCTION_MODE}
- Cash Swaps: ${VITE_ENABLE_CASH_SWAPS}
- Cash Proposals: ${VITE_ENABLE_CASH_PROPOSALS}

### Changing Feature Flags
\`\`\`bash
# Disable all features (emergency)
./scripts/rollback-feature-flags.sh emergency

# Enable specific features
./scripts/update-feature-flags.sh enable-cash

# Enable all features
./scripts/update-feature-flags.sh enable-all
\`\`\`

### Rollback Procedures
\`\`\`bash
# Quick feature rollback (no deployment needed)
./scripts/rollback-feature-flags.sh emergency

# Full application rollback
./scripts/rollback-feature-flags.sh restore [backup_directory]

# Restore from specific backup
ls backups/
./scripts/rollback-feature-flags.sh restore backups/config_YYYYMMDD_HHMMSS
\`\`\`

## Troubleshooting

### Common Issues

1. **Feature flags not taking effect**
   - Restart frontend service: \`docker-compose -f docker-compose.prod.yml restart frontend\`
   - Clear browser cache
   - Check environment variables are loaded

2. **SSL certificate issues**
   - Verify certificate files in \`ssl/\` directory
   - Check nginx configuration
   - Validate certificate expiration

3. **Database connection issues**
   - Check database credentials in \`.env.production\`
   - Verify database server is accessible
   - Check firewall rules

4. **Backend API errors**
   - Check backend logs: \`docker-compose -f docker-compose.prod.yml logs backend\`
   - Verify environment variables
   - Check database connectivity

### Emergency Contacts
- DevOps Team: [contact information]
- Backend Team: [contact information]  
- Frontend Team: [contact information]
- Security Team: [contact information]

### Useful Commands
\`\`\`bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f [service]

# Check feature flag status
curl -s https://yourdomain.com/config.js | grep ENABLE

# Test API health
curl -f https://yourdomain.com/api/health

# Monitor resource usage
docker stats
\`\`\`

## Success Criteria

Deployment is considered successful when:
- [ ] All services are running and healthy
- [ ] Feature flags are correctly applied
- [ ] Core user flows are working
- [ ] Performance is within acceptable limits
- [ ] Monitoring is collecting data
- [ ] Rollback procedures are tested and ready

## Next Steps

After successful deployment:
1. Monitor system performance and user feedback
2. Plan gradual feature flag rollout if using simplified UI
3. Schedule regular backups and maintenance
4. Review and update monitoring alerts
5. Document any lessons learned for future deployments
EOF
    
    log "${GREEN}✅ Deployment checklist created${NC}"
}

# Display summary and next steps
display_summary() {
    log ""
    log "${GREEN}🎉 Production Configuration Setup Complete!${NC}"
    log ""
    log "${BLUE}📋 Files Created:${NC}"
    log "   ✅ apps/frontend/.env.production - Frontend production environment"
    log "   ✅ .env.production - Backend production environment"
    log "   ✅ docker-compose.prod.yml - Production Docker configuration"
    log "   ✅ scripts/validate-production-deployment.sh - Deployment validation"
    log "   ✅ scripts/deploy-production-quick.sh - Quick deployment script"
    log "   ✅ docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md - Deployment checklist"
    log ""
    log "${BLUE}🏁 Feature Flags Configuration:${NC}"
    log "   Auction Mode: ${VITE_ENABLE_AUCTION_MODE}"
    log "   Cash Swaps: ${VITE_ENABLE_CASH_SWAPS}"
    log "   Cash Proposals: ${VITE_ENABLE_CASH_PROPOSALS}"
    log ""
    log "${YELLOW}⚠️  IMPORTANT: Before deploying to production:${NC}"
    log "   1. Update placeholder values in environment files:"
    log "      - Production domain URLs"
    log "      - Database credentials"
    log "      - Hedera mainnet account details"
    log "      - WalletConnect project ID"
    log "      - SSL certificate paths"
    log ""
    log "   2. Secure sensitive credentials:"
    log "      - Generate strong database passwords"
    log "      - Secure Hedera private keys"
    log "      - Validate JWT secret strength"
    log ""
    log "${GREEN}🚀 Next Steps:${NC}"
    log "   1. Review and update configuration files"
    log "   2. Set up SSL certificates in ssl/ directory"
    log "   3. Configure production database and Redis"
    log "   4. Test deployment in staging environment"
    log "   5. Deploy to production: ./scripts/deploy-production-quick.sh"
    log ""
    log "${BLUE}📚 Documentation:${NC}"
    log "   - Deployment checklist: docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md"
    log "   - Environment variables: docs/ENVIRONMENT_VARIABLES.md"
    log "   - Feature flags guide: docs/FEATURE_FLAGS_DEPLOYMENT.md"
    log ""
    log "${YELLOW}🔄 Rollback Options:${NC}"
    log "   - Emergency feature disable: ./scripts/rollback-feature-flags.sh emergency"
    log "   - Restore configuration: ./scripts/rollback-feature-flags.sh restore [backup_dir]"
    log ""
}

# Main execution
main() {
    # Create necessary directories
    mkdir -p backups scripts docs ssl nginx
    
    # Run setup steps
    validate_production_requirements
    create_config_backup
    get_feature_flag_config
    get_domain_config
    get_security_config
    
    # Create configuration files
    create_frontend_env
    create_backend_env
    create_docker_compose_config
    
    # Create deployment scripts and documentation
    create_validation_script
    create_deployment_script
    generate_deployment_docs
    
    # Display summary
    display_summary
}

# Handle script interruption
trap 'echo -e "\n${RED}❌ Setup interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"