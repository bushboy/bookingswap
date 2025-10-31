# Production Deployment Guide for Feature Flags

This guide provides step-by-step instructions for deploying the Booking Swap application to production with feature flags for hiding auction and cash swap functionality.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Production Environment Setup](#production-environment-setup)
- [Deployment Process](#deployment-process)
- [Feature Flag Management](#feature-flag-management)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring and Validation](#monitoring-and-validation)
- [Emergency Procedures](#emergency-procedures)

## Pre-Deployment Checklist

### 1. Infrastructure Requirements

- [ ] **Database**: PostgreSQL 13+ instance with sufficient resources
- [ ] **Cache**: Redis 6+ instance for session management
- [ ] **SSL Certificates**: Valid SSL certificates for HTTPS
- [ ] **Domain**: DNS records configured for production domain
- [ ] **Load Balancer**: Configured if using multiple instances
- [ ] **Monitoring**: Prometheus/Grafana setup for metrics
- [ ] **Backup**: Automated backup system configured

### 2. Security Requirements

- [ ] **JWT Secret**: Strong, unique JWT secret (minimum 32 characters)
- [ ] **Database Credentials**: Secure, unique database credentials
- [ ] **Hedera Account**: Mainnet Hedera account with sufficient HBAR balance
- [ ] **API Keys**: All external API keys validated for production
- [ ] **CORS Configuration**: Proper CORS origins set for production domain
- [ ] **Rate Limiting**: Rate limiting configured for API endpoints

### 3. Environment Configuration

- [ ] **Frontend Environment**: `apps/frontend/.env.production` configured
- [ ] **Backend Environment**: `.env.production` configured
- [ ] **Feature Flags**: Set to appropriate values for initial deployment
- [ ] **Docker Configuration**: Production docker-compose files ready
- [ ] **Nginx Configuration**: Web server configuration for SSL and routing

## Production Environment Setup

### 1. Frontend Production Environment

Update `apps/frontend/.env.production`:

```bash
# API Configuration - Update with your production domain
VITE_API_BASE_URL=https://your-production-domain.com/api
VITE_WS_URL=https://your-production-domain.com

# Hedera Mainnet Configuration
VITE_HEDERA_NETWORK=mainnet
VITE_HEDERA_MIRROR_NODE_URL=https://mainnet.mirrornode.hedera.com

# Feature Flags - Start with simplified UI (RECOMMENDED)
VITE_ENABLE_AUCTION_MODE=false
VITE_ENABLE_CASH_SWAPS=false
VITE_ENABLE_CASH_PROPOSALS=false

# Production Security Settings
VITE_WS_DEBUG_MODE=false
VITE_WS_LOG_LEVEL=error

# WebSocket Configuration
VITE_WS_RECONNECT_ATTEMPTS=10
VITE_WS_RECONNECT_INTERVAL=5000
VITE_WS_CONNECTION_TIMEOUT=10000
VITE_WS_HEARTBEAT_INTERVAL=30000
VITE_WS_HEARTBEAT_TIMEOUT=5000

# Fallback Configuration
VITE_ENABLE_FALLBACK=true
VITE_FALLBACK_POLLING_INTERVAL=30000

# WalletConnect - Update with your production project ID
VITE_WALLET_CONNECT_PROJECT_ID=your_production_wallet_connect_project_id
```

### 2. Backend Production Environment

Update `.env.production`:

```bash
# Server Configuration
NODE_ENV=production
PORT=3001

# Database Configuration - Use secure credentials
DATABASE_URL=postgresql://prod_user:secure_password@db_host:5432/prod_db
REDIS_URL=redis://redis_host:6379

# JWT Configuration - Use strong secret
JWT_SECRET=your_very_secure_production_jwt_secret_minimum_32_chars
JWT_EXPIRES_IN=24h

# Hedera Mainnet Configuration
HEDERA_NETWORK=mainnet
HEDERA_ACCOUNT_ID=0.0.your_mainnet_account
HEDERA_PRIVATE_KEY=your_mainnet_private_key
HEDERA_TOPIC_ID=0.0.your_mainnet_topic

# Security Configuration
BCRYPT_ROUNDS=12
SESSION_TIMEOUT=3600000
CORS_ORIGIN=https://your-production-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
```

### 3. Docker Production Configuration

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile.prod
      args:
        - VITE_ENABLE_AUCTION_MODE=${VITE_ENABLE_AUCTION_MODE:-false}
        - VITE_ENABLE_CASH_SWAPS=${VITE_ENABLE_CASH_SWAPS:-false}
        - VITE_ENABLE_CASH_PROPOSALS=${VITE_ENABLE_CASH_PROPOSALS:-false}
    ports:
      - "80:80"
      - "443:443"
    environment:
      - VITE_ENABLE_AUCTION_MODE=${VITE_ENABLE_AUCTION_MODE:-false}
      - VITE_ENABLE_CASH_SWAPS=${VITE_ENABLE_CASH_SWAPS:-false}
      - VITE_ENABLE_CASH_PROPOSALS=${VITE_ENABLE_CASH_PROPOSALS:-false}
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile.prod
    ports:
      - "3001:3001"
      - "9090:9090"  # Metrics port
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - HEDERA_NETWORK=${HEDERA_NETWORK}
      - HEDERA_ACCOUNT_ID=${HEDERA_ACCOUNT_ID}
      - HEDERA_PRIVATE_KEY=${HEDERA_PRIVATE_KEY}
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
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## Deployment Process

### 1. Initial Deployment (Recommended: Simplified UI)

```bash
#!/bin/bash
# scripts/deploy-production.sh

set -e

echo "🚀 Starting production deployment with simplified UI..."

# Set feature flags for simplified UI (recommended for initial deployment)
export VITE_ENABLE_AUCTION_MODE=false
export VITE_ENABLE_CASH_SWAPS=false
export VITE_ENABLE_CASH_PROPOSALS=false

# Validate environment configuration
./scripts/validate-production-config.sh

# Create backup before deployment
./scripts/create-backup.sh

# Deploy services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Validate deployment
./scripts/validate-deployment.sh

echo "✅ Production deployment completed successfully!"
echo "📊 Monitor at: https://your-domain.com/monitoring"
echo "🔍 Logs at: https://your-domain.com/logs"
```

### 2. Deployment Validation Script

Create `scripts/validate-deployment.sh`:

```bash
#!/bin/bash
# scripts/validate-deployment.sh

set -e

echo "🔍 Validating production deployment..."

# Check service health
echo "Checking backend health..."
if curl -f https://your-domain.com/api/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
    exit 1
fi

echo "Checking frontend health..."
if curl -f https://your-domain.com/health > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend health check failed"
    exit 1
fi

# Validate feature flags
echo "Validating feature flags..."
FRONTEND_CONFIG=$(curl -s https://your-domain.com/config.js 2>/dev/null || echo "")

if echo "$FRONTEND_CONFIG" | grep -q "ENABLE_AUCTION_MODE.*false"; then
    echo "✅ Auction mode correctly disabled"
else
    echo "❌ Auction mode configuration error"
    exit 1
fi

if echo "$FRONTEND_CONFIG" | grep -q "ENABLE_CASH_SWAPS.*false"; then
    echo "✅ Cash swaps correctly disabled"
else
    echo "❌ Cash swaps configuration error"
    exit 1
fi

if echo "$FRONTEND_CONFIG" | grep -q "ENABLE_CASH_PROPOSALS.*false"; then
    echo "✅ Cash proposals correctly disabled"
else
    echo "❌ Cash proposals configuration error"
    exit 1
fi

# Test API endpoints
echo "Testing API endpoints..."
if curl -X POST https://your-domain.com/api/swaps \
    -H "Content-Type: application/json" \
    -d '{"test": true}' > /dev/null 2>&1; then
    echo "✅ API endpoints accessible"
else
    echo "⚠️  API endpoints may require authentication"
fi

echo "🎉 Deployment validation completed successfully!"
```

## Feature Flag Management

### 1. Runtime Feature Flag Changes

You can change feature flags without redeploying the entire application:

```bash
#!/bin/bash
# scripts/update-feature-flags.sh

FEATURE_ACTION=${1:-"disable-all"}

case $FEATURE_ACTION in
    "disable-all")
        echo "🔧 Disabling all advanced features..."
        export VITE_ENABLE_AUCTION_MODE=false
        export VITE_ENABLE_CASH_SWAPS=false
        export VITE_ENABLE_CASH_PROPOSALS=false
        ;;
    "enable-cash")
        echo "🔧 Enabling cash features only..."
        export VITE_ENABLE_AUCTION_MODE=false
        export VITE_ENABLE_CASH_SWAPS=true
        export VITE_ENABLE_CASH_PROPOSALS=true
        ;;
    "enable-all")
        echo "🔧 Enabling all features..."
        export VITE_ENABLE_AUCTION_MODE=true
        export VITE_ENABLE_CASH_SWAPS=true
        export VITE_ENABLE_CASH_PROPOSALS=true
        ;;
    *)
        echo "Usage: $0 [disable-all|enable-cash|enable-all]"
        exit 1
        ;;
esac

# Update environment file
cat > apps/frontend/.env.production << EOF
# Updated $(date)
VITE_ENABLE_AUCTION_MODE=${VITE_ENABLE_AUCTION_MODE}
VITE_ENABLE_CASH_SWAPS=${VITE_ENABLE_CASH_SWAPS}
VITE_ENABLE_CASH_PROPOSALS=${VITE_ENABLE_CASH_PROPOSALS}
# ... other production settings
EOF

# Restart only frontend service
docker-compose -f docker-compose.prod.yml restart frontend

# Wait for restart
sleep 15

# Validate changes
./scripts/validate-deployment.sh

echo "✅ Feature flags updated successfully!"
```

### 2. Gradual Feature Rollout Strategy

```bash
# Week 1: Deploy with simplified UI
./scripts/update-feature-flags.sh disable-all

# Week 2: Enable cash features after user feedback
./scripts/update-feature-flags.sh enable-cash

# Week 3: Enable all features after cash features are stable
./scripts/update-feature-flags.sh enable-all
```

## Rollback Procedures

### 1. Feature-Level Rollback (Instant)

If specific features cause issues:

```bash
#!/bin/bash
# scripts/emergency-disable-features.sh

echo "🚨 Emergency: Disabling all advanced features"

# Immediately disable all advanced features
export VITE_ENABLE_AUCTION_MODE=false
export VITE_ENABLE_CASH_SWAPS=false
export VITE_ENABLE_CASH_PROPOSALS=false

# Update production environment
./scripts/update-feature-flags.sh disable-all

echo "✅ Emergency feature rollback completed"
```

### 2. Full Application Rollback

If the entire deployment needs to be rolled back:

```bash
#!/bin/bash
# scripts/emergency-rollback.sh

echo "🚨 Emergency: Complete application rollback"

# Stop current services
docker-compose -f docker-compose.prod.yml down

# Restore from latest backup
LATEST_BACKUP=$(ls -t backups/ | head -n1)
if [ -n "$LATEST_BACKUP" ]; then
    echo "Restoring from backup: $LATEST_BACKUP"
    ./scripts/restore-backup.sh "$LATEST_BACKUP"
fi

# Start services with previous configuration
docker-compose -f docker-compose.prod.yml up -d

# Validate restoration
sleep 30
./scripts/validate-deployment.sh

echo "✅ Emergency rollback completed"
```

## Monitoring and Validation

### 1. Health Check Endpoints

Ensure these endpoints are monitored:

- `https://your-domain.com/health` - Frontend health
- `https://your-domain.com/api/health` - Backend health
- `https://your-domain.com/api/metrics` - Application metrics

### 2. Feature Flag Monitoring

Create monitoring alerts for:

```yaml
# monitoring/feature-flag-alerts.yaml
groups:
- name: feature-flags
  rules:
  - alert: FeatureFlagMismatch
    expr: feature_flag_config_error > 0
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "Feature flag configuration error"
      description: "Feature flag {{ $labels.flag }} has configuration issues"

  - alert: UnexpectedFeatureUsage
    expr: rate(feature_usage_total{feature="auction",enabled="false"}[5m]) > 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Disabled feature is being used"
      description: "Feature {{ $labels.feature }} is disabled but still being accessed"
```

### 3. User Experience Monitoring

Monitor key metrics:

- Swap creation success rate
- Proposal creation success rate
- User session duration
- Error rates by feature area
- User feedback and support tickets

## Emergency Procedures

### 1. Complete Service Outage

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check logs for errors
docker-compose -f docker-compose.prod.yml logs --tail=50

# Restart all services
docker-compose -f docker-compose.prod.yml restart

# If restart fails, full rollback
./scripts/emergency-rollback.sh
```

### 2. Database Issues

```bash
# Check database connectivity
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Restore from backup if needed
./scripts/restore-database.sh $(ls -t backups/ | head -n1)
```

### 3. Feature Flag Configuration Issues

```bash
# Reset to safe defaults
./scripts/emergency-disable-features.sh

# Validate configuration
./scripts/validate-deployment.sh

# Check frontend logs for errors
docker-compose -f docker-compose.prod.yml logs frontend
```

## Post-Deployment Checklist

- [ ] **Health Checks**: All services passing health checks
- [ ] **Feature Flags**: Validated to be working as expected
- [ ] **SSL Certificates**: HTTPS working correctly
- [ ] **Database**: Connections working and data accessible
- [ ] **Monitoring**: Alerts configured and working
- [ ] **Backups**: Automated backups running successfully
- [ ] **Performance**: Response times within acceptable limits
- [ ] **User Testing**: Basic user flows tested and working

## Support and Troubleshooting

### Common Issues

1. **Feature flags not taking effect**: Restart frontend service and clear browser cache
2. **Backend API errors**: Check backend logs and database connectivity
3. **SSL certificate issues**: Verify certificate validity and nginx configuration
4. **Database connection issues**: Check database credentials and network connectivity

### Emergency Contacts

- **DevOps Team**: For infrastructure and deployment issues
- **Backend Team**: For API and database issues
- **Frontend Team**: For UI and feature flag issues
- **Security Team**: For security-related concerns

### Useful Commands

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f [service_name]

# Check feature flag status
curl -s https://your-domain.com/config.js | grep ENABLE

# Test API health
curl -f https://your-domain.com/api/health

# Monitor resource usage
docker stats
```

This production deployment guide ensures a smooth rollout of the feature flags system while maintaining the ability to quickly respond to any issues that may arise.