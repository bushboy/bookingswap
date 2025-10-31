# Password Recovery System Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the password recovery system in production environments. It covers infrastructure setup, configuration, security hardening, monitoring, and troubleshooting.

## Prerequisites

### System Requirements

- **Node.js**: Version 18.x or higher
- **Database**: PostgreSQL 13+ or compatible
- **Email Service**: SMTP server or email service provider
- **SSL Certificate**: Valid SSL certificate for HTTPS
- **Memory**: Minimum 512MB RAM (1GB+ recommended)
- **Storage**: Minimum 1GB available disk space

### Required Access

- Database administrator access
- Email service provider credentials
- DNS management access (for email authentication)
- SSL certificate management
- Application server access

## Pre-Deployment Checklist

### 1. Infrastructure Preparation

- [ ] Database server is running and accessible
- [ ] Email service provider is configured
- [ ] SSL certificates are installed and valid
- [ ] Firewall rules allow necessary traffic
- [ ] Monitoring systems are in place
- [ ] Backup systems are configured

### 2. Security Preparation

- [ ] JWT secrets are generated (64+ characters)
- [ ] SMTP credentials are secured
- [ ] Environment variables are encrypted
- [ ] Access controls are configured
- [ ] Security scanning is completed
- [ ] Penetration testing is performed

### 3. Email Service Preparation

- [ ] SMTP server is configured and tested
- [ ] SPF records are configured
- [ ] DKIM signing is enabled
- [ ] DMARC policy is implemented
- [ ] Email templates are tested
- [ ] Delivery rates are verified

## Deployment Steps

### Step 1: Database Setup

#### 1.1 Create Password Reset Tokens Table

```sql
-- Connect to your database and run:
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token 
  ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id 
  ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at 
  ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_created_at 
  ON password_reset_tokens(created_at);
```

#### 1.2 Verify Database Permissions

```sql
-- Ensure application user has necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO your_app_user;
GRANT USAGE ON SEQUENCE password_reset_tokens_id_seq TO your_app_user;
```

### Step 2: Environment Configuration

#### 2.1 Production Environment Variables

Create a `.env.production` file with the following variables:

```bash
# Core Application Settings
NODE_ENV=production
PORT=3001
JWT_SECRET=your-very-secure-jwt-secret-at-least-64-characters-long-for-production-use
JWT_EXPIRES_IN=24h
FRONTEND_URL=https://your-domain.com

# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database
DATABASE_SSL=true
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# SMTP Configuration (Required)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM_EMAIL=noreply@your-domain.com
SMTP_FROM_NAME=Your Application Name

# Password Reset Security Settings
PASSWORD_RESET_TOKEN_EXPIRATION_HOURS=1
PASSWORD_RESET_MAX_REQUESTS_PER_HOUR=3
PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES=60
PASSWORD_RESET_RETENTION_DAYS=7

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=3
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# Monitoring and Logging
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
ENABLE_SECURITY_LOGGING=true
METRICS_ENABLED=true

# Security Headers
HELMET_ENABLED=true
CORS_ORIGIN=https://your-domain.com
TRUST_PROXY=true
```

#### 2.2 Secure Environment Variable Management

**Using Docker Secrets**:
```bash
# Create secrets
echo "your-jwt-secret" | docker secret create jwt_secret -
echo "your-smtp-password" | docker secret create smtp_password -

# Reference in docker-compose.yml
secrets:
  - jwt_secret
  - smtp_password
```

**Using Kubernetes Secrets**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: password-recovery-secrets
type: Opaque
data:
  jwt-secret: <base64-encoded-secret>
  smtp-password: <base64-encoded-password>
```

### Step 3: Email Service Configuration

#### 3.1 SMTP Provider Setup

**Gmail SMTP**:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use App Password, not regular password
```

**SendGrid**:
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**Amazon SES**:
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

#### 3.2 DNS Configuration for Email Authentication

**SPF Record**:
```dns
TXT @ "v=spf1 include:_spf.your-email-provider.com ~all"
```

**DKIM Record** (provided by your email service):
```dns
TXT selector._domainkey "v=DKIM1; k=rsa; p=your-public-key"
```

**DMARC Record**:
```dns
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@your-domain.com"
```

### Step 4: Application Deployment

#### 4.1 Docker Deployment

**Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

EXPOSE 3001

CMD ["npm", "start"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    secrets:
      - jwt_secret
      - smtp_password
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
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: your_database
      POSTGRES_USER: your_user
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:

secrets:
  jwt_secret:
    external: true
  smtp_password:
    external: true
```

#### 4.2 Kubernetes Deployment

**deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: password-recovery-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: password-recovery-app
  template:
    metadata:
      labels:
        app: password-recovery-app
    spec:
      containers:
      - name: app
        image: your-registry/password-recovery:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: password-recovery-secrets
              key: jwt-secret
        - name: SMTP_PASS
          valueFrom:
            secretKeyRef:
              name: password-recovery-secrets
              key: smtp-password
        envFrom:
        - configMapRef:
            name: password-recovery-config
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Step 5: SSL/TLS Configuration

#### 5.1 Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location /api/auth/password-reset {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Rate limiting
        limit_req zone=password_reset burst=5 nodelay;
    }
}

# Rate limiting zone
http {
    limit_req_zone $binary_remote_addr zone=password_reset:10m rate=3r/h;
}
```

### Step 6: Monitoring and Logging

#### 6.1 Application Monitoring

**Health Check Endpoints**:
```javascript
// Add to your application
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  });
});

app.get('/ready', async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1');
    
    // Check email service
    await emailService.verify();
    
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

#### 6.2 Logging Configuration

**Winston Logger Setup**:
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

#### 6.3 Metrics Collection

**Prometheus Metrics**:
```javascript
const promClient = require('prom-client');

const passwordResetRequests = new promClient.Counter({
  name: 'password_reset_requests_total',
  help: 'Total number of password reset requests',
  labelNames: ['status', 'method']
});

const passwordResetDuration = new promClient.Histogram({
  name: 'password_reset_duration_seconds',
  help: 'Duration of password reset operations',
  labelNames: ['operation']
});
```

### Step 7: Security Hardening

#### 7.1 Firewall Configuration

```bash
# Allow only necessary ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw allow 587/tcp   # SMTP (if using local SMTP)
ufw deny 3001/tcp   # Block direct access to app port
ufw enable
```

#### 7.2 Application Security

**Security Middleware**:
```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: 'Too many password reset requests',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/password-reset', passwordResetLimiter);
```

### Step 8: Testing Deployment

#### 8.1 Smoke Tests

```bash
#!/bin/bash
# smoke-test.sh

BASE_URL="https://your-domain.com"
EMAIL="test@example.com"

echo "Testing password reset request..."
curl -X POST "$BASE_URL/api/auth/request-password-reset" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"resetBaseUrl\":\"$BASE_URL/reset\"}" \
  -w "HTTP Status: %{http_code}\n"

echo "Testing health endpoint..."
curl "$BASE_URL/health" -w "HTTP Status: %{http_code}\n"

echo "Testing rate limiting..."
for i in {1..5}; do
  curl -X POST "$BASE_URL/api/auth/request-password-reset" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"resetBaseUrl\":\"$BASE_URL/reset\"}" \
    -w "Request $i - HTTP Status: %{http_code}\n"
done
```

#### 8.2 Integration Tests

```javascript
// integration-test.js
const request = require('supertest');
const app = require('../app');

describe('Password Recovery Integration', () => {
  test('Complete password reset flow', async () => {
    // Request password reset
    const resetResponse = await request(app)
      .post('/api/auth/request-password-reset')
      .send({
        email: 'test@example.com',
        resetBaseUrl: 'https://test.com/reset'
      })
      .expect(200);

    expect(resetResponse.body.success).toBe(true);

    // Validate token (would need actual token from email)
    // Reset password (would need actual token)
    // Verify password was changed
  });
});
```

## Post-Deployment Verification

### 1. Functional Testing

- [ ] Password reset request works
- [ ] Email delivery is successful
- [ ] Token validation works correctly
- [ ] Password reset completion works
- [ ] Rate limiting is enforced
- [ ] Error handling works properly

### 2. Security Testing

- [ ] HTTPS is enforced
- [ ] Rate limiting prevents abuse
- [ ] Email enumeration is prevented
- [ ] Tokens are secure and expire
- [ ] Sessions are invalidated after reset
- [ ] Security headers are present

### 3. Performance Testing

- [ ] Response times are acceptable
- [ ] Database queries are optimized
- [ ] Email sending is performant
- [ ] Memory usage is stable
- [ ] CPU usage is reasonable

### 4. Monitoring Verification

- [ ] Health checks are working
- [ ] Logs are being generated
- [ ] Metrics are being collected
- [ ] Alerts are configured
- [ ] Dashboards are functional

## Maintenance and Operations

### Daily Operations

1. **Monitor application health**
2. **Check email delivery rates**
3. **Review security logs**
4. **Monitor rate limiting metrics**
5. **Verify database performance**

### Weekly Operations

1. **Review password reset statistics**
2. **Check SSL certificate expiration**
3. **Update security patches**
4. **Review and rotate logs**
5. **Test backup and recovery**

### Monthly Operations

1. **Security audit and review**
2. **Performance optimization review**
3. **Update dependencies**
4. **Review and update documentation**
5. **Disaster recovery testing**

## Troubleshooting

### Common Issues

#### Email Not Sending

**Symptoms**: Users not receiving password reset emails

**Diagnosis**:
```bash
# Check application logs
docker logs your-container | grep "email"

# Test SMTP connection
telnet your-smtp-host 587

# Check email service status
curl -X GET "$BASE_URL/api/auth/password-reset/health"
```

**Solutions**:
1. Verify SMTP credentials
2. Check firewall rules for SMTP ports
3. Verify email service provider status
4. Check DNS records (SPF, DKIM, DMARC)

#### Rate Limiting Issues

**Symptoms**: Users getting rate limited unexpectedly

**Diagnosis**:
```bash
# Check rate limiting logs
docker logs your-container | grep "rate limit"

# Check Redis/cache status
redis-cli ping
```

**Solutions**:
1. Adjust rate limiting thresholds
2. Check for proxy/load balancer IP forwarding
3. Verify rate limiting cache is working
4. Review rate limiting configuration

#### Database Performance

**Symptoms**: Slow password reset operations

**Diagnosis**:
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE query LIKE '%password_reset_tokens%'
ORDER BY mean_time DESC;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'password_reset_tokens';
```

**Solutions**:
1. Add missing indexes
2. Optimize database queries
3. Increase database connection pool
4. Consider database scaling

### Emergency Procedures

#### Disable Password Reset

```bash
# Temporarily disable password reset
export PASSWORD_RESET_ENABLED=false

# Or use feature flag
curl -X POST "$ADMIN_URL/api/admin/feature-flags" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"passwordReset": false}'
```

#### Clear Rate Limits

```bash
# Clear all rate limits (emergency only)
redis-cli FLUSHDB

# Or clear specific user rate limits
redis-cli DEL "rate_limit:email:user@example.com"
```

#### Emergency Token Cleanup

```sql
-- Remove all expired tokens (emergency cleanup)
DELETE FROM password_reset_tokens 
WHERE expires_at < NOW();

-- Remove all tokens for specific user (if compromised)
DELETE FROM password_reset_tokens 
WHERE user_id = 'user-uuid';
```

## Rollback Procedures

### Application Rollback

```bash
# Docker rollback
docker service update --rollback your-service

# Kubernetes rollback
kubectl rollout undo deployment/password-recovery-app

# Manual rollback
git checkout previous-stable-tag
docker build -t your-app:rollback .
docker service update --image your-app:rollback your-service
```

### Database Rollback

```sql
-- Rollback database changes (if needed)
DROP TABLE IF EXISTS password_reset_tokens;
-- Restore from backup if necessary
```

## Support and Escalation

### Support Contacts

- **Level 1**: Application support team
- **Level 2**: DevOps/Infrastructure team  
- **Level 3**: Security team
- **Emergency**: On-call engineer

### Escalation Criteria

- **P1**: Complete service outage
- **P2**: Degraded performance affecting users
- **P3**: Security incident
- **P4**: Non-critical issues

### Documentation Updates

Keep this deployment guide updated with:
- Configuration changes
- New security requirements
- Performance optimizations
- Lessons learned from incidents
- Updated contact information