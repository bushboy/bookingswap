# Feature Flags Deployment Guide

This guide provides comprehensive instructions for deploying the Booking Swap application with feature flags for hiding auction and cash swap functionality.

## Table of Contents

- [Overview](#overview)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Production Environment Setup](#production-environment-setup)
- [Deployment Strategies](#deployment-strategies)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring and Validation](#monitoring-and-validation)
- [Troubleshooting](#troubleshooting)

## Overview

The feature flags system allows you to control the visibility of auction and cash swap features without code changes. This enables:

- **Simplified Initial Rollout**: Deploy with complex features hidden
- **Gradual Feature Enablement**: Enable features incrementally
- **Quick Rollback**: Instantly hide features if issues arise
- **A/B Testing**: Test different feature sets with different user groups

### Feature Flags Available

| Flag | Controls | Recommended Initial Value |
|------|----------|---------------------------|
| `VITE_ENABLE_AUCTION_MODE` | Auction acceptance strategy UI | `false` |
| `VITE_ENABLE_CASH_SWAPS` | Cash payment options in swap creation | `false` |
| `VITE_ENABLE_CASH_PROPOSALS` | Cash offer functionality in proposals | `false` |

## Pre-Deployment Checklist

### 1. Environment Files Preparation

- [ ] **Frontend Production Environment** (`apps/frontend/.env.production`):
  ```bash
  # Feature Flags - Start with simplified UI
  VITE_ENABLE_AUCTION_MODE=false
  VITE_ENABLE_CASH_SWAPS=false
  VITE_ENABLE_CASH_PROPOSALS=false
  
  # API Configuration
  VITE_API_BASE_URL=https://your-production-domain.com/api
  VITE_WS_URL=https://your-production-domain.com
  
  # Hedera Mainnet Configuration
  VITE_HEDERA_NETWORK=mainnet
  VITE_HEDERA_MIRROR_NODE_URL=https://mainnet.mirrornode.hedera.com
  
  # Production Security Settings
  VITE_WS_DEBUG_MODE=false
  VITE_WS_LOG_LEVEL=error
  ```

- [ ] **Backend Production Environment** (`.env.production`):
  ```bash
  # Server Configuration
  NODE_ENV=production
  PORT=3001
  
  # Database (use secure credentials)
  DATABASE_URL=postgresql://prod_user:secure_password@db_host:5432/prod_db
  REDIS_URL=redis://redis_host:6379
  
  # JWT (use strong secret - minimum 32 characters)
  JWT_SECRET=your_very_secure_production_jwt_secret_minimum_32_chars
  JWT_EXPIRES_IN=24h
  
  # Hedera Mainnet Configuration
  HEDERA_NETWORK=mainnet
  HEDERA_ACCOUNT_ID=0.0.your_mainnet_account
  HEDERA_PRIVATE_KEY=your_mainnet_private_key
  HEDERA_TOPIC_ID=0.0.your_mainnet_topic
  
  # Logging
  LOG_LEVEL=info
  ```

### 2. Security Validation

- [ ] **JWT Secret**: Generate a strong, unique JWT secret (minimum 32 characters)
- [ ] **Database Credentials**: Use secure, unique database credentials
- [ ] **Hedera Keys**: Ensure mainnet Hedera account has sufficient HBAR balance
- [ ] **API Keys**: Validate all external API keys are production-ready
- [ ] **CORS Configuration**: Set appropriate CORS origins for production domain

### 3. Infrastructure Readiness

- [ ] **Database**: PostgreSQL instance running and accessible
- [ ] **Redis**: Redis instance running for caching and sessions
- [ ] **SSL Certificates**: Valid SSL certificates for HTTPS
- [ ] **Domain Configuration**: DNS records pointing to production servers
- [ ] **Load Balancer**: Configured if using multiple instances
- [ ] **Monitoring**: Monitoring and alerting systems in place

## Production Environment Setup

### 1. Initial Deployment (Simplified UI)

Deploy with all advanced features hidden to provide a clean, simple user experience:

```bash
# Frontend Feature Flags
VITE_ENABLE_AUCTION_MODE=false
VITE_ENABLE_CASH_SWAPS=false
VITE_ENABLE_CASH_PROPOSALS=false
```

**Benefits of Starting Simple:**
- Reduced user confusion
- Lower support burden
- Easier testing and validation
- Gradual user education opportunity

### 2. Environment Variable Management

#### Using Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  frontend:
    build: ./apps/frontend
    environment:
      - VITE_ENABLE_AUCTION_MODE=${VITE_ENABLE_AUCTION_MODE:-false}
      - VITE_ENABLE_CASH_SWAPS=${VITE_ENABLE_CASH_SWAPS:-false}
      - VITE_ENABLE_CASH_PROPOSALS=${VITE_ENABLE_CASH_PROPOSALS:-false}
      - VITE_API_BASE_URL=${VITE_API_BASE_URL}
      - VITE_WS_URL=${VITE_WS_URL}
    ports:
      - "80:80"
      - "443:443"
```

#### Using Kubernetes

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  template:
    spec:
      containers:
      - name: frontend
        image: booking-swap/frontend:latest
        env:
        - name: VITE_ENABLE_AUCTION_MODE
          valueFrom:
            configMapKeyRef:
              name: feature-flags
              key: enable-auction-mode
        - name: VITE_ENABLE_CASH_SWAPS
          valueFrom:
            configMapKeyRef:
              name: feature-flags
              key: enable-cash-swaps
        - name: VITE_ENABLE_CASH_PROPOSALS
          valueFrom:
            configMapKeyRef:
              name: feature-flags
              key: enable-cash-proposals
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: feature-flags
data:
  enable-auction-mode: "false"
  enable-cash-swaps: "false"
  enable-cash-proposals: "false"
```

## Deployment Strategies

### Strategy 1: Big Bang Deployment (Recommended for Initial Launch)

Deploy all services at once with simplified UI:

```bash
# 1. Deploy with simplified UI
./scripts/deploy.sh production

# 2. Validate deployment
curl -f https://your-domain.com/health
curl -f https://your-domain.com/api/health

# 3. Monitor for 24-48 hours before enabling features
```

### Strategy 2: Blue-Green Deployment

Deploy to a parallel environment, test, then switch:

```bash
# 1. Deploy to green environment
ENVIRONMENT=green ./scripts/deploy.sh

# 2. Test green environment
./scripts/test-deployment.sh green

# 3. Switch traffic to green
./scripts/switch-traffic.sh green

# 4. Keep blue as rollback option
```

### Strategy 3: Canary Deployment

Gradually roll out to a subset of users:

```bash
# 1. Deploy to canary environment (10% traffic)
CANARY_PERCENTAGE=10 ./scripts/deploy-canary.sh

# 2. Monitor metrics and user feedback
./scripts/monitor-canary.sh

# 3. Gradually increase traffic
CANARY_PERCENTAGE=50 ./scripts/deploy-canary.sh
CANARY_PERCENTAGE=100 ./scripts/deploy-canary.sh
```

### Strategy 4: Gradual Feature Rollout

Enable features incrementally after initial deployment:

```bash
# Week 1: Deploy with simplified UI
VITE_ENABLE_AUCTION_MODE=false
VITE_ENABLE_CASH_SWAPS=false
VITE_ENABLE_CASH_PROPOSALS=false

# Week 2: Enable cash features
VITE_ENABLE_CASH_SWAPS=true
VITE_ENABLE_CASH_PROPOSALS=true

# Week 3: Enable auction features
VITE_ENABLE_AUCTION_MODE=true
```

## Rollback Procedures

### Immediate Feature Rollback (No Deployment Required)

If issues arise with specific features, you can instantly hide them:

```bash
# 1. Update environment variables
export VITE_ENABLE_AUCTION_MODE=false
export VITE_ENABLE_CASH_SWAPS=false
export VITE_ENABLE_CASH_PROPOSALS=false

# 2. Restart frontend service
docker-compose -f docker-compose.prod.yml restart frontend

# 3. Validate changes (should take effect immediately)
curl -f https://your-domain.com/health
```

### Full Application Rollback

If major issues require complete rollback:

```bash
# 1. Run rollback script
./scripts/rollback.sh

# 2. Restore from backup if needed
./scripts/restore-backup.sh $(ls -t backups/ | head -n1)

# 3. Validate rollback
./scripts/validate-deployment.sh
```

### Database Rollback Considerations

**Important**: Feature flags do NOT require database changes:

- ✅ **Safe**: Hiding features through environment variables
- ✅ **Safe**: All existing data remains intact
- ✅ **Safe**: Backend APIs continue to function normally
- ❌ **Avoid**: Database schema changes for feature hiding

## Monitoring and Validation

### 1. Deployment Validation

Create a validation script to verify feature flags are working:

```bash
#!/bin/bash
# scripts/validate-feature-flags.sh

echo "🔍 Validating feature flags deployment..."

# Check if frontend is serving correct configuration
FRONTEND_CONFIG=$(curl -s https://your-domain.com/config.js)

# Validate auction mode is disabled
if echo "$FRONTEND_CONFIG" | grep -q "ENABLE_AUCTION_MODE.*false"; then
    echo "✅ Auction mode correctly disabled"
else
    echo "❌ Auction mode configuration error"
    exit 1
fi

# Validate cash swaps are disabled
if echo "$FRONTEND_CONFIG" | grep -q "ENABLE_CASH_SWAPS.*false"; then
    echo "✅ Cash swaps correctly disabled"
else
    echo "❌ Cash swaps configuration error"
    exit 1
fi

# Validate cash proposals are disabled
if echo "$FRONTEND_CONFIG" | grep -q "ENABLE_CASH_PROPOSALS.*false"; then
    echo "✅ Cash proposals correctly disabled"
else
    echo "❌ Cash proposals configuration error"
    exit 1
fi

echo "🎉 Feature flags validation passed!"
```

### 2. User Experience Validation

Test the simplified UI to ensure it works as expected:

```bash
# Test swap creation (should only show booking exchange)
curl -X POST https://your-domain.com/api/swaps \
  -H "Content-Type: application/json" \
  -d '{
    "paymentTypes": {"bookingExchange": true, "cashPayment": false},
    "acceptanceStrategy": {"type": "first_match"}
  }'

# Test proposal creation (should only allow booking exchanges)
curl -X POST https://your-domain.com/api/proposals \
  -H "Content-Type: application/json" \
  -d '{
    "type": "booking_exchange",
    "swapId": "test-swap-id"
  }'
```

### 3. Monitoring Metrics

Set up monitoring for feature flag effectiveness:

```yaml
# monitoring/feature-flags-dashboard.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: feature-flags-dashboard
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "Feature Flags Monitoring",
        "panels": [
          {
            "title": "Feature Flag Status",
            "type": "stat",
            "targets": [
              {
                "expr": "feature_flag_enabled{flag=\"auction_mode\"}",
                "legendFormat": "Auction Mode"
              },
              {
                "expr": "feature_flag_enabled{flag=\"cash_swaps\"}",
                "legendFormat": "Cash Swaps"
              }
            ]
          },
          {
            "title": "User Actions by Feature",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(user_actions_total{action=\"create_swap\"}[5m])",
                "legendFormat": "Swap Creation"
              },
              {
                "expr": "rate(user_actions_total{action=\"create_proposal\"}[5m])",
                "legendFormat": "Proposal Creation"
              }
            ]
          }
        ]
      }
    }
```

### 4. Alerting Rules

Set up alerts for feature flag issues:

```yaml
# monitoring/feature-flags-alerts.yaml
groups:
- name: feature-flags
  rules:
  - alert: FeatureFlagMismatch
    expr: feature_flag_config_error > 0
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "Feature flag configuration error detected"
      description: "Feature flag {{ $labels.flag }} has configuration mismatch"

  - alert: UnexpectedFeatureUsage
    expr: rate(feature_usage_total{feature="auction",enabled="false"}[5m]) > 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Disabled feature is being used"
      description: "Feature {{ $labels.feature }} is disabled but still being used"
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Feature Flags Not Taking Effect

**Symptoms:**
- Features still visible after setting flags to `false`
- Environment variables not being read

**Solutions:**
```bash
# Check environment variables are loaded
docker-compose -f docker-compose.prod.yml exec frontend env | grep VITE_

# Restart frontend service
docker-compose -f docker-compose.prod.yml restart frontend

# Clear browser cache
# Instruct users to hard refresh (Ctrl+F5)

# Verify build includes correct environment
docker-compose -f docker-compose.prod.yml exec frontend cat /usr/share/nginx/html/config.js
```

#### 2. Backend Errors After Feature Flag Changes

**Symptoms:**
- API errors when creating swaps or proposals
- 500 errors in backend logs

**Investigation:**
```bash
# Check backend logs
docker-compose -f docker-compose.prod.yml logs backend

# Verify backend is not using feature flags (it shouldn't)
docker-compose -f docker-compose.prod.yml exec backend env | grep -i feature

# Test API endpoints directly
curl -X POST https://your-domain.com/api/health
```

**Solution:**
- Backend should NOT use feature flags
- All API endpoints should work regardless of frontend flags
- If backend errors occur, they're likely unrelated to feature flags

#### 3. Inconsistent UI State

**Symptoms:**
- Some features hidden, others still visible
- Mixed state in user interface

**Solutions:**
```bash
# Check for cached JavaScript files
curl -I https://your-domain.com/static/js/main.js

# Verify all environment variables are set
docker-compose -f docker-compose.prod.yml exec frontend env | grep VITE_ENABLE

# Force cache invalidation
# Update cache-busting parameters in build
```

#### 4. Rollback Issues

**Symptoms:**
- Cannot restore previous functionality
- Features not re-enabling when flags set to `true`

**Solutions:**
```bash
# Verify environment variables
echo $VITE_ENABLE_AUCTION_MODE
echo $VITE_ENABLE_CASH_SWAPS
echo $VITE_ENABLE_CASH_PROPOSALS

# Restart services after environment changes
docker-compose -f docker-compose.prod.yml restart

# Check for typos in environment variable names
grep -r "VITE_ENABLE" apps/frontend/src/
```

### Emergency Procedures

#### Complete Feature Rollback

If all features need to be immediately hidden:

```bash
#!/bin/bash
# scripts/emergency-disable-features.sh

echo "🚨 Emergency: Disabling all advanced features"

# Update environment
export VITE_ENABLE_AUCTION_MODE=false
export VITE_ENABLE_CASH_SWAPS=false
export VITE_ENABLE_CASH_PROPOSALS=false

# Update production environment file
cat > apps/frontend/.env.production << EOF
VITE_ENABLE_AUCTION_MODE=false
VITE_ENABLE_CASH_SWAPS=false
VITE_ENABLE_CASH_PROPOSALS=false
# ... other production settings
EOF

# Restart frontend
docker-compose -f docker-compose.prod.yml restart frontend

# Validate changes
sleep 10
curl -f https://your-domain.com/health

echo "✅ Emergency rollback completed"
```

#### Complete Application Rollback

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

### Support Contacts

For deployment issues:

1. **Feature Flag Issues**: Check environment variables and restart frontend
2. **Backend Issues**: Review backend logs (feature flags don't affect backend)
3. **Database Issues**: Use backup restoration procedures
4. **Infrastructure Issues**: Contact DevOps team

### Useful Commands

```bash
# Check current feature flag status
curl -s https://your-domain.com/config.js | grep ENABLE

# Monitor deployment logs
docker-compose -f docker-compose.prod.yml logs -f

# Test API health
curl -f https://your-domain.com/api/health

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View environment variables
docker-compose -f docker-compose.prod.yml exec frontend env | grep VITE_
docker-compose -f docker-compose.prod.yml exec backend env | grep -v VITE_
```

This deployment guide ensures a smooth rollout of the feature flags system while maintaining the ability to quickly respond to any issues that may arise.