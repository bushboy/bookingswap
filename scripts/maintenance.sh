#!/bin/bash

# Maintenance script for Booking Swap Platform
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
LOG_RETENTION_DAYS=${LOG_RETENTION_DAYS:-7}
COMPOSE_FILE="docker-compose.prod.yml"

echo -e "${BLUE}🔧 Starting maintenance tasks...${NC}"

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  backup          Create full system backup"
    echo "  cleanup         Clean up old files and unused resources"
    echo "  update          Update system and dependencies"
    echo "  health          Perform comprehensive health check"
    echo "  logs            Collect and analyze logs"
    echo "  optimize        Optimize database and cache"
    echo "  security        Run security checks"
    echo "  all             Run all maintenance tasks"
    echo ""
}

# Create backup
create_backup() {
    echo -e "${YELLOW}💾 Creating system backup...${NC}"
    
    BACKUP_DIR="backups/maintenance_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    echo "Backing up database..."
    docker-compose -f $COMPOSE_FILE exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > "$BACKUP_DIR/database.sql.gz"
    
    # Backup volumes
    echo "Backing up volumes..."
    docker run --rm -v booking-swap-platform_postgres_data:/data -v $(pwd)/$BACKUP_DIR:/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .
    docker run --rm -v booking-swap-platform_redis_data:/data -v $(pwd)/$BACKUP_DIR:/backup alpine tar czf /backup/redis_data.tar.gz -C /data .
    docker run --rm -v booking-swap-platform_prometheus_data:/data -v $(pwd)/$BACKUP_DIR:/backup alpine tar czf /backup/prometheus_data.tar.gz -C /data .
    docker run --rm -v booking-swap-platform_grafana_data:/data -v $(pwd)/$BACKUP_DIR:/backup alpine tar czf /backup/grafana_data.tar.gz -C /data .
    
    # Backup configuration
    echo "Backing up configuration..."
    cp -r monitoring "$BACKUP_DIR/"
    cp docker-compose.prod.yml "$BACKUP_DIR/"
    cp .env.production "$BACKUP_DIR/"
    
    # Create backup manifest
    echo "Creating backup manifest..."
    cat > "$BACKUP_DIR/manifest.txt" << EOF
Backup created: $(date)
Database size: $(du -h "$BACKUP_DIR/database.sql.gz" | cut -f1)
Postgres data: $(du -h "$BACKUP_DIR/postgres_data.tar.gz" | cut -f1)
Redis data: $(du -h "$BACKUP_DIR/redis_data.tar.gz" | cut -f1)
Prometheus data: $(du -h "$BACKUP_DIR/prometheus_data.tar.gz" | cut -f1)
Grafana data: $(du -h "$BACKUP_DIR/grafana_data.tar.gz" | cut -f1)
Total backup size: $(du -sh "$BACKUP_DIR" | cut -f1)
EOF
    
    echo -e "${GREEN}✅ Backup created: $BACKUP_DIR${NC}"
}

# Cleanup old files and resources
cleanup_system() {
    echo -e "${YELLOW}🧹 Cleaning up system...${NC}"
    
    # Clean up old backups
    echo "Removing backups older than $BACKUP_RETENTION_DAYS days..."
    find backups -type d -name "maintenance_*" -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
    find backups -type d -name "2*" -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
    
    # Clean up old logs
    echo "Removing logs older than $LOG_RETENTION_DAYS days..."
    find logs -name "*.log" -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null || true
    
    # Clean up Docker resources
    echo "Cleaning up Docker resources..."
    docker system prune -f
    docker volume prune -f
    docker image prune -f
    
    # Clean up temporary files
    echo "Cleaning up temporary files..."
    rm -rf /tmp/booking-swap-* 2>/dev/null || true
    
    echo -e "${GREEN}✅ System cleanup completed${NC}"
}

# Update system and dependencies
update_system() {
    echo -e "${YELLOW}🔄 Updating system...${NC}"
    
    # Pull latest images
    echo "Pulling latest Docker images..."
    docker-compose -f $COMPOSE_FILE pull
    
    # Update system packages (if running on Linux)
    if command -v apt-get &> /dev/null; then
        echo "Updating system packages..."
        sudo apt-get update && sudo apt-get upgrade -y
    elif command -v yum &> /dev/null; then
        echo "Updating system packages..."
        sudo yum update -y
    fi
    
    # Restart services with new images
    echo "Restarting services..."
    docker-compose -f $COMPOSE_FILE up -d
    
    echo -e "${GREEN}✅ System update completed${NC}"
}

# Comprehensive health check
health_check() {
    echo -e "${YELLOW}🏥 Performing health check...${NC}"
    
    # Check service status
    echo "Checking service status..."
    docker-compose -f $COMPOSE_FILE ps
    
    # Check health endpoints
    echo "Checking health endpoints..."
    
    # Backend health
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
    else
        echo -e "${RED}❌ Backend health check failed${NC}"
    fi
    
    # Frontend health
    if curl -f http://localhost:80/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend is healthy${NC}"
    else
        echo -e "${RED}❌ Frontend health check failed${NC}"
    fi
    
    # Database health
    if docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U $POSTGRES_USER > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is healthy${NC}"
    else
        echo -e "${RED}❌ Database health check failed${NC}"
    fi
    
    # Redis health
    if docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis is healthy${NC}"
    else
        echo -e "${RED}❌ Redis health check failed${NC}"
    fi
    
    # Check disk space
    echo "Checking disk space..."
    df -h
    
    # Check memory usage
    echo "Checking memory usage..."
    free -h
    
    # Check CPU usage
    echo "Checking CPU usage..."
    top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}'
    
    echo -e "${GREEN}✅ Health check completed${NC}"
}

# Collect and analyze logs
analyze_logs() {
    echo -e "${YELLOW}📋 Analyzing logs...${NC}"
    
    LOG_ANALYSIS_DIR="logs/analysis_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$LOG_ANALYSIS_DIR"
    
    # Collect service logs
    echo "Collecting service logs..."
    docker-compose -f $COMPOSE_FILE logs --tail=1000 backend > "$LOG_ANALYSIS_DIR/backend.log"
    docker-compose -f $COMPOSE_FILE logs --tail=1000 frontend > "$LOG_ANALYSIS_DIR/frontend.log"
    docker-compose -f $COMPOSE_FILE logs --tail=1000 postgres > "$LOG_ANALYSIS_DIR/postgres.log"
    docker-compose -f $COMPOSE_FILE logs --tail=1000 redis > "$LOG_ANALYSIS_DIR/redis.log"
    
    # Analyze error patterns
    echo "Analyzing error patterns..."
    grep -i "error\|exception\|fail" "$LOG_ANALYSIS_DIR"/*.log > "$LOG_ANALYSIS_DIR/errors.log" 2>/dev/null || echo "No errors found"
    
    # Generate log summary
    cat > "$LOG_ANALYSIS_DIR/summary.txt" << EOF
Log Analysis Summary - $(date)

Error Count by Service:
Backend: $(grep -c "error\|exception\|fail" "$LOG_ANALYSIS_DIR/backend.log" 2>/dev/null || echo 0)
Frontend: $(grep -c "error\|exception\|fail" "$LOG_ANALYSIS_DIR/frontend.log" 2>/dev/null || echo 0)
Database: $(grep -c "error\|exception\|fail" "$LOG_ANALYSIS_DIR/postgres.log" 2>/dev/null || echo 0)
Redis: $(grep -c "error\|exception\|fail" "$LOG_ANALYSIS_DIR/redis.log" 2>/dev/null || echo 0)

Top Error Messages:
$(grep -h "error\|exception\|fail" "$LOG_ANALYSIS_DIR"/*.log 2>/dev/null | sort | uniq -c | sort -nr | head -10 || echo "No errors found")
EOF
    
    echo -e "${GREEN}✅ Log analysis completed: $LOG_ANALYSIS_DIR${NC}"
}

# Optimize database and cache
optimize_performance() {
    echo -e "${YELLOW}⚡ Optimizing performance...${NC}"
    
    # Database optimization
    echo "Optimizing database..."
    docker-compose -f $COMPOSE_FILE exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "VACUUM ANALYZE;"
    docker-compose -f $COMPOSE_FILE exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "REINDEX DATABASE $POSTGRES_DB;"
    
    # Redis optimization
    echo "Optimizing Redis cache..."
    docker-compose -f $COMPOSE_FILE exec -T redis redis-cli FLUSHDB
    docker-compose -f $COMPOSE_FILE exec -T redis redis-cli MEMORY PURGE
    
    # Check database statistics
    echo "Database statistics:"
    docker-compose -f $COMPOSE_FILE exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
        SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup 
        FROM pg_stat_user_tables 
        ORDER BY n_live_tup DESC 
        LIMIT 10;"
    
    echo -e "${GREEN}✅ Performance optimization completed${NC}"
}

# Run security checks
security_check() {
    echo -e "${YELLOW}🔒 Running security checks...${NC}"
    
    # Check for security updates
    echo "Checking for security updates..."
    if command -v apt-get &> /dev/null; then
        apt list --upgradable 2>/dev/null | grep -i security || echo "No security updates available"
    fi
    
    # Check file permissions
    echo "Checking file permissions..."
    find . -name "*.sh" -not -perm 755 -exec chmod 755 {} \;
    find . -name ".env*" -not -perm 600 -exec chmod 600 {} \;
    
    # Check for exposed secrets
    echo "Checking for exposed secrets..."
    if command -v grep &> /dev/null; then
        grep -r "password\|secret\|key" --include="*.yml" --include="*.yaml" . | grep -v "your_" | grep -v "#" || echo "No exposed secrets found"
    fi
    
    # Check SSL certificate expiration
    echo "Checking SSL certificate..."
    if [ -f "ssl/cert.pem" ]; then
        openssl x509 -in ssl/cert.pem -noout -dates
    else
        echo "SSL certificate not found"
    fi
    
    echo -e "${GREEN}✅ Security check completed${NC}"
}

# Main function
main() {
    case "${1:-all}" in
        backup)
            create_backup
            ;;
        cleanup)
            cleanup_system
            ;;
        update)
            update_system
            ;;
        health)
            health_check
            ;;
        logs)
            analyze_logs
            ;;
        optimize)
            optimize_performance
            ;;
        security)
            security_check
            ;;
        all)
            create_backup
            cleanup_system
            health_check
            analyze_logs
            optimize_performance
            security_check
            echo -e "${GREEN}🎉 All maintenance tasks completed!${NC}"
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'echo -e "\n${RED}❌ Maintenance interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"