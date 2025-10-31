# Production Deployment Guide

This guide covers the complete production deployment process for the Booking Swap Platform.

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended) or Windows Server 2019+
- **CPU**: Minimum 4 cores, 8 cores recommended
- **Memory**: Minimum 8GB RAM, 16GB recommended
- **Storage**: Minimum 100GB SSD, 500GB recommended
- **Network**: Stable internet connection with sufficient bandwidth

### Software Requirements

- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Git**: For code deployment
- **curl**: For health checks (Linux) or PowerShell (Windows)

### External Services

- **Hedera Account**: Mainnet account with sufficient HBAR balance
- **Email Service**: API key for email notifications (SendGrid, AWS SES, etc.)
- **SMS Service**: API key for SMS notifications (Twilio, AWS SNS, etc.)
- **SSL Certificate**: Valid SSL certificate for HTTPS

## Environment Configuration

### 1. Clone Repository

```bash
git clone <repository-url>
cd booking-swap-platform
```

### 2. Configure Environment Variables

Copy the production environment template:

```bash
cp .env.production .env.prod
```

Edit `.env.prod` with your production values:

```bash
# Database Configuration
POSTGRES_DB=booking_swap_prod
POSTGRES_USER=booking_swap_user
POSTGRES_PASSWORD=your_secure_postgres_password_here

# Redis Configuration
REDIS_PASSWORD=your_secure_redis_password_here

# JWT Configuration
JWT_SECRET=your_very_secure_jwt_secret_here_minimum_32_characters

# Hedera Configuration
HEDERA_ACCOUNT_ID=0.0.your_account_id
HEDERA_PRIVATE_KEY=your_hedera_private_key_here
HEDERA_NETWORK=mainnet

# External Services
EMAIL_SERVICE_API_KEY=your_email_service_api_key
SMS_SERVICE_API_KEY=your_sms_service_api_key

# CORS Configuration
CORS_ORIGIN=https://your-domain.com

# Monitoring
GRAFANA_PASSWORD=your_secure_grafana_password
```

### 3. SSL Certificate Setup

Place your SSL certificates in the `ssl` directory:

```bash
mkdir -p ssl
cp your-certificate.pem ssl/cert.pem
cp your-private-key.pem ssl/key.pem
```

## Deployment Process

### Automated Deployment (Recommended)

#### Linux/macOS

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh production
```

#### Windows

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\deploy.ps1 -Environment production
```

### Manual Deployment

If you prefer manual control over the deployment process:

#### 1. Build Images

```bash
docker-compose -f docker-compose.prod.yml build --no-cache
```

#### 2. Start Services

```bash
docker-compose -f docker-compose.prod.yml up -d
```

#### 3. Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Health check
curl http://localhost:3001/health
curl http://localhost:80/health
```

## Service Architecture

The production deployment includes the following services:

### Core Services

- **Frontend**: React application served by Nginx (Port 80/443)
- **Backend**: Node.js API server (Port 3001)
- **PostgreSQL**: Primary database (Port 5432)
- **Redis**: Cache and session store (Port 6379)

### Monitoring Stack

- **Prometheus**: Metrics collection (Port 9090)
- **Grafana**: Monitoring dashboards (Port 3000)
- **Loki**: Log aggregation (Port 3100)
- **Promtail**: Log shipping agent

## Health Checks

The platform includes comprehensive health checks:

### Backend Health Endpoints

- `GET /health` - Overall system health
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### Frontend Health Endpoint

- `GET /health` - Nginx health check

### Service Dependencies

Health checks verify:
- Database connectivity
- Redis connectivity
- Hedera blockchain connectivity
- External service availability

## Monitoring and Alerting

### Grafana Dashboards

Access monitoring dashboards at `http://your-domain:3000`:

- **System Overview**: CPU, memory, disk usage
- **Application Metrics**: Request rates, response times, error rates
- **Database Performance**: Query performance, connection pools
- **Blockchain Metrics**: Transaction success rates, response times

### Alert Rules

Configured alerts for:
- High error rates (>10% for 5 minutes)
- High response times (>2s 95th percentile)
- Service downtime
- Resource exhaustion (CPU >80%, Memory >90%, Disk >90%)
- Blockchain transaction failures

### Log Management

Centralized logging with Loki:
- Application logs from all services
- System logs
- Access logs
- Error logs with stack traces

## Backup and Recovery

### Automated Backups

The deployment script creates backups before each deployment:
- Database dump
- Volume snapshots
- Configuration files

### Manual Backup

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d_%H%M%S)

# Backup database
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backups/$(date +%Y%m%d_%H%M%S)/database.sql

# Backup volumes
docker run --rm -v booking-swap-platform_postgres_data:/data -v $(pwd)/backups/$(date +%Y%m%d_%H%M%S):/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .
```

### Recovery Process

```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Restore database
docker-compose -f docker-compose.prod.yml up -d postgres
sleep 10
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < backups/BACKUP_DATE/database.sql

# Restore volumes
docker run --rm -v booking-swap-platform_postgres_data:/data -v $(pwd)/backups/BACKUP_DATE:/backup alpine tar xzf /backup/postgres_data.tar.gz -C /data

# Restart services
docker-compose -f docker-compose.prod.yml up -d
```

## Security Considerations

### Network Security

- All services run in isolated Docker network
- Only necessary ports exposed to host
- Nginx configured with security headers
- Rate limiting enabled

### Data Security

- Database passwords encrypted
- JWT secrets properly secured
- Hedera private keys encrypted at rest
- SSL/TLS encryption for all external communication

### Access Control

- Non-root users in containers
- Minimal container privileges
- Regular security updates
- Monitoring for suspicious activity

## Scaling

### Horizontal Scaling

To scale the application:

```bash
# Scale backend instances
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Scale with load balancer
# Add nginx load balancer configuration
```

### Vertical Scaling

Update resource limits in `docker-compose.prod.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
```

## Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs service-name

# Check resource usage
docker stats

# Check disk space
df -h
```

#### Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Check connection from backend
docker-compose -f docker-compose.prod.yml exec backend nc -zv postgres 5432
```

#### High Memory Usage

```bash
# Check memory usage by service
docker stats --no-stream

# Restart specific service
docker-compose -f docker-compose.prod.yml restart service-name
```

### Performance Optimization

#### Database Optimization

- Regular VACUUM and ANALYZE
- Index optimization
- Connection pooling tuning

#### Cache Optimization

- Redis memory optimization
- Cache hit rate monitoring
- TTL tuning

#### Application Optimization

- Response compression
- Static asset caching
- Database query optimization

## Maintenance

### Regular Tasks

- **Daily**: Monitor system health and alerts
- **Weekly**: Review performance metrics and logs
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Capacity planning and scaling review

### Update Process

```bash
# Pull latest code
git pull origin main

# Run deployment with backup
./scripts/deploy.sh production

# Verify deployment
curl http://localhost:3001/health
```

### Rollback Process

```bash
# Automatic rollback during deployment failure
# Manual rollback
./scripts/deploy.sh production
# Choose 'y' when prompted for rollback
```

## Support and Monitoring

### Key Metrics to Monitor

- **Availability**: Service uptime >99.9%
- **Performance**: Response time <500ms 95th percentile
- **Error Rate**: <1% error rate
- **Resource Usage**: CPU <70%, Memory <80%, Disk <80%

### Contact Information

- **Operations Team**: ops@bookingswap.com
- **Development Team**: dev@bookingswap.com
- **Emergency Contact**: +1-XXX-XXX-XXXX

### Documentation Updates

This documentation should be updated whenever:
- New services are added
- Configuration changes are made
- New monitoring or alerting is implemented
- Security procedures are updated