#!/bin/bash

# Feature Flags Rollback Script
# This script provides various rollback mechanisms for feature flags in production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-production}
BACKUP_DIR="backups"
LOG_FILE="rollback-$(date +%Y%m%d_%H%M%S).log"

# Feature flags
FEATURE_FLAGS=(
    "VITE_ENABLE_AUCTION_MODE"
    "VITE_ENABLE_CASH_SWAPS"
    "VITE_ENABLE_CASH_PROPOSALS"
)

# Logging function
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Create backup of current configuration
create_config_backup() {
    log "${YELLOW}📦 Creating configuration backup...${NC}"
    
    local backup_timestamp=$(date +%Y%m%d_%H%M%S)
    local config_backup_dir="$BACKUP_DIR/config_$backup_timestamp"
    
    mkdir -p "$config_backup_dir"
    
    # Backup current environment files
    if [ -f "apps/frontend/.env.$ENVIRONMENT" ]; then
        cp "apps/frontend/.env.$ENVIRONMENT" "$config_backup_dir/frontend.env"
        log "${GREEN}✅ Frontend environment backed up${NC}"
    fi
    
    if [ -f ".env.$ENVIRONMENT" ]; then
        cp ".env.$ENVIRONMENT" "$config_backup_dir/backend.env"
        log "${GREEN}✅ Backend environment backed up${NC}"
    fi
    
    # Save current feature flag values
    echo "# Feature flags backup - $backup_timestamp" > "$config_backup_dir/feature-flags.env"
    for flag in "${FEATURE_FLAGS[@]}"; do
        value=$(eval echo \${flag:-false})
        echo "${flag}=${value}" >> "$config_backup_dir/feature-flags.env"
    done
    
    # Save Docker Compose configuration
    if [ -f "docker-compose.prod.yml" ]; then
        cp "docker-compose.prod.yml" "$config_backup_dir/docker-compose.yml"
    fi
    
    log "${GREEN}✅ Configuration backup created: $config_backup_dir${NC}"
    echo "$config_backup_dir"
}

# Restore configuration from backup
restore_config_backup() {
    local backup_dir=$1
    
    if [ ! -d "$backup_dir" ]; then
        log "${RED}❌ Backup directory not found: $backup_dir${NC}"
        return 1
    fi
    
    log "${YELLOW}🔄 Restoring configuration from backup: $backup_dir${NC}"
    
    # Restore environment files
    if [ -f "$backup_dir/frontend.env" ]; then
        cp "$backup_dir/frontend.env" "apps/frontend/.env.$ENVIRONMENT"
        log "${GREEN}✅ Frontend environment restored${NC}"
    fi
    
    if [ -f "$backup_dir/backend.env" ]; then
        cp "$backup_dir/backend.env" ".env.$ENVIRONMENT"
        log "${GREEN}✅ Backend environment restored${NC}"
    fi
    
    # Restore feature flags
    if [ -f "$backup_dir/feature-flags.env" ]; then
        source "$backup_dir/feature-flags.env"
        log "${GREEN}✅ Feature flags restored${NC}"
        
        # Display restored values
        log "${BLUE}📋 Restored Feature Flags:${NC}"
        for flag in "${FEATURE_FLAGS[@]}"; do
            value=$(eval echo \${flag})
            log "   ${flag}=${value}"
        done
    fi
    
    log "${GREEN}✅ Configuration restoration completed${NC}"
}

# Set feature flags to safe defaults (all disabled)
set_safe_defaults() {
    log "${YELLOW}🛡️ Setting feature flags to safe defaults (all disabled)...${NC}"
    
    export VITE_ENABLE_AUCTION_MODE=false
    export VITE_ENABLE_CASH_SWAPS=false
    export VITE_ENABLE_CASH_PROPOSALS=false
    
    update_environment_files
    
    log "${GREEN}✅ Safe defaults applied${NC}"
}

# Update environment files with current feature flag values
update_environment_files() {
    log "${YELLOW}📝 Updating environment files...${NC}"
    
    local frontend_env="apps/frontend/.env.$ENVIRONMENT"
    
    # Ensure environment file exists
    if [ ! -f "$frontend_env" ]; then
        log "${YELLOW}⚠️  Frontend environment file not found, creating from template...${NC}"
        cp "apps/frontend/.env.example" "$frontend_env"
    fi
    
    # Update each feature flag
    for flag in "${FEATURE_FLAGS[@]}"; do
        local value=$(eval echo \${flag})
        
        # Update or add the flag in the environment file
        if grep -q "^${flag}=" "$frontend_env" 2>/dev/null; then
            # Update existing flag
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sed -i '' "s/^${flag}=.*/${flag}=${value}/" "$frontend_env"
            else
                # Linux
                sed -i "s/^${flag}=.*/${flag}=${value}/" "$frontend_env"
            fi
        else
            # Add new flag
            echo "${flag}=${value}" >> "$frontend_env"
        fi
        
        log "${GREEN}✅ Updated ${flag}=${value}${NC}"
    done
    
    log "${GREEN}✅ Environment files updated${NC}"
}

# Restart services to apply changes
restart_services() {
    local service=${1:-frontend}
    
    log "${YELLOW}🔄 Restarting $service service...${NC}"
    
    if command -v docker-compose &> /dev/null; then
        if [ "$service" = "all" ]; then
            docker-compose -f docker-compose.prod.yml restart
        else
            docker-compose -f docker-compose.prod.yml restart "$service"
        fi
    else
        log "${RED}❌ Docker Compose not found${NC}"
        return 1
    fi
    
    # Wait for service to be ready
    log "${YELLOW}⏳ Waiting for service to be ready...${NC}"
    sleep 15
    
    log "${GREEN}✅ Service restart completed${NC}"
}

# Validate that changes have been applied
validate_rollback() {
    log "${YELLOW}🔍 Validating rollback...${NC}"
    
    # Check if services are running
    if ! docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log "${RED}❌ Services are not running${NC}"
        return 1
    fi
    
    # Check frontend health
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:80/health > /dev/null 2>&1; then
            log "${GREEN}✅ Frontend is healthy${NC}"
            break
        else
            log "${YELLOW}⏳ Waiting for frontend... (attempt $attempt/$max_attempts)${NC}"
            sleep 5
            ((attempt++))
        fi
    done
    
    if [ $attempt -gt $max_attempts ]; then
        log "${RED}❌ Frontend health check failed${NC}"
        return 1
    fi
    
    # Validate feature flags are correctly applied
    local config_response
    config_response=$(curl -s http://localhost:80/config.js 2>/dev/null || echo "")
    
    if [ -z "$config_response" ]; then
        log "${YELLOW}⚠️  Could not retrieve frontend configuration${NC}"
        return 0  # Don't fail validation for this
    fi
    
    # Check each feature flag
    local validation_passed=true
    
    for flag in "${FEATURE_FLAGS[@]}"; do
        local expected_value=$(eval echo \${flag})
        
        if echo "$config_response" | grep -q "${flag}.*${expected_value}"; then
            log "${GREEN}✅ ${flag}=${expected_value} correctly applied${NC}"
        else
            log "${RED}❌ ${flag} validation failed (expected: ${expected_value})${NC}"
            validation_passed=false
        fi
    done
    
    if [ "$validation_passed" = "true" ]; then
        log "${GREEN}🎉 Rollback validation passed!${NC}"
        return 0
    else
        log "${RED}❌ Rollback validation failed${NC}"
        return 1
    fi
}

# Show current feature flag status
show_status() {
    log "${BLUE}📋 Current Feature Flags Status:${NC}"
    
    # Try to get from environment
    for flag in "${FEATURE_FLAGS[@]}"; do
        local value=$(eval echo \${flag:-"not set"})
        log "   ${flag}=${value}"
    done
    
    # Try to get from running application
    log "${BLUE}📋 Running Application Status:${NC}"
    local config_response
    config_response=$(curl -s http://localhost:80/config.js 2>/dev/null || echo "")
    
    if [ -n "$config_response" ]; then
        for flag in "${FEATURE_FLAGS[@]}"; do
            if echo "$config_response" | grep -q "$flag"; then
                local app_value=$(echo "$config_response" | grep "$flag" | sed 's/.*=\([^;]*\).*/\1/' | tr -d ' ')
                log "   ${flag}=${app_value} (running app)"
            fi
        done
    else
        log "${YELLOW}⚠️  Could not retrieve running application status${NC}"
    fi
}

# List available backups
list_backups() {
    log "${BLUE}📋 Available Configuration Backups:${NC}"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log "${YELLOW}⚠️  No backup directory found${NC}"
        return
    fi
    
    local config_backups=$(find "$BACKUP_DIR" -name "config_*" -type d | sort -r)
    
    if [ -z "$config_backups" ]; then
        log "${YELLOW}⚠️  No configuration backups found${NC}"
        return
    fi
    
    echo "$config_backups" | while read -r backup; do
        local backup_name=$(basename "$backup")
        local backup_date=$(echo "$backup_name" | sed 's/config_//' | sed 's/_/ /')
        
        log "   $backup_name (created: $backup_date)"
        
        # Show feature flags from backup
        if [ -f "$backup/feature-flags.env" ]; then
            while IFS='=' read -r key value; do
                if [[ $key =~ ^VITE_ENABLE_ ]]; then
                    log "     $key=$value"
                fi
            done < "$backup/feature-flags.env"
        fi
        log ""
    done
}

# Emergency rollback - disable all features immediately
emergency_rollback() {
    log "${RED}🚨 EMERGENCY ROLLBACK: Disabling all advanced features${NC}"
    
    # Create backup first
    local backup_dir=$(create_config_backup)
    
    # Set safe defaults
    set_safe_defaults
    
    # Restart frontend service
    restart_services frontend
    
    # Validate changes
    if validate_rollback; then
        log "${GREEN}✅ Emergency rollback completed successfully${NC}"
        log "${BLUE}📦 Configuration backed up to: $backup_dir${NC}"
    else
        log "${RED}❌ Emergency rollback validation failed${NC}"
        log "${YELLOW}🔄 Attempting to restore from backup...${NC}"
        restore_config_backup "$backup_dir"
        restart_services frontend
    fi
}

# Gradual rollback - disable features one by one
gradual_rollback() {
    local feature_to_disable=$1
    
    if [ -z "$feature_to_disable" ]; then
        log "${YELLOW}Available features to disable:${NC}"
        log "  auction - Disable auction mode features"
        log "  cash-swaps - Disable cash swap creation features"
        log "  cash-proposals - Disable cash proposal features"
        log "  all - Disable all features"
        return
    fi
    
    # Create backup first
    local backup_dir=$(create_config_backup)
    
    case $feature_to_disable in
        "auction")
            log "${YELLOW}🔧 Disabling auction mode features...${NC}"
            export VITE_ENABLE_AUCTION_MODE=false
            ;;
        "cash-swaps")
            log "${YELLOW}🔧 Disabling cash swap features...${NC}"
            export VITE_ENABLE_CASH_SWAPS=false
            ;;
        "cash-proposals")
            log "${YELLOW}🔧 Disabling cash proposal features...${NC}"
            export VITE_ENABLE_CASH_PROPOSALS=false
            ;;
        "all")
            log "${YELLOW}🔧 Disabling all advanced features...${NC}"
            export VITE_ENABLE_AUCTION_MODE=false
            export VITE_ENABLE_CASH_SWAPS=false
            export VITE_ENABLE_CASH_PROPOSALS=false
            ;;
        *)
            log "${RED}❌ Unknown feature: $feature_to_disable${NC}"
            return 1
            ;;
    esac
    
    # Apply changes
    update_environment_files
    restart_services frontend
    
    # Validate changes
    if validate_rollback; then
        log "${GREEN}✅ Gradual rollback completed successfully${NC}"
        log "${BLUE}📦 Configuration backed up to: $backup_dir${NC}"
    else
        log "${RED}❌ Gradual rollback validation failed${NC}"
        log "${YELLOW}🔄 Attempting to restore from backup...${NC}"
        restore_config_backup "$backup_dir"
        restart_services frontend
    fi
}

# Main function
main() {
    local action=${1:-help}
    
    log "${GREEN}🔄 Feature Flags Rollback Script${NC}"
    log "${BLUE}📅 Started at: $(date)${NC}"
    log "${BLUE}📝 Log file: $LOG_FILE${NC}"
    log ""
    
    case $action in
        "emergency")
            emergency_rollback
            ;;
        "gradual")
            gradual_rollback "$2"
            ;;
        "restore")
            if [ -z "$2" ]; then
                log "${RED}❌ Please specify backup directory${NC}"
                list_backups
                exit 1
            fi
            restore_config_backup "$2"
            restart_services frontend
            validate_rollback
            ;;
        "safe-defaults")
            create_config_backup
            set_safe_defaults
            restart_services frontend
            validate_rollback
            ;;
        "status")
            show_status
            ;;
        "list-backups")
            list_backups
            ;;
        "validate")
            validate_rollback
            ;;
        "help"|*)
            log "${YELLOW}Usage: $0 [action] [options]${NC}"
            log ""
            log "${YELLOW}Actions:${NC}"
            log "  emergency                    - Immediately disable all features"
            log "  gradual [feature]           - Disable specific feature (auction|cash-swaps|cash-proposals|all)"
            log "  restore [backup_dir]        - Restore from specific backup"
            log "  safe-defaults               - Set all features to safe defaults (disabled)"
            log "  status                      - Show current feature flag status"
            log "  list-backups               - List available configuration backups"
            log "  validate                   - Validate current configuration"
            log "  help                       - Show this help message"
            log ""
            log "${YELLOW}Examples:${NC}"
            log "  $0 emergency                # Emergency rollback - disable all features"
            log "  $0 gradual auction          # Disable only auction features"
            log "  $0 gradual all              # Disable all features gradually"
            log "  $0 restore config_20241027_143022  # Restore from specific backup"
            log "  $0 status                   # Check current status"
            ;;
    esac
    
    log ""
    log "${BLUE}📅 Completed at: $(date)${NC}"
}

# Handle script interruption
trap 'log "\n${RED}❌ Rollback script interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"