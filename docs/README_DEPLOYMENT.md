# Booking Swap Platform - Production Deployment

This document provides a quick overview of the production deployment setup for the Booking Swap Platform.

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 8GB RAM, 4 CPU cores minimum
- Valid SSL certificate
- Hedera mainnet account

### 1. Environment Setup
```bash
# Copy and configure environment
cp .env.production .env.prod
# Edit .env.prod with your production values
```

### 2. Deploy
```bash
# Linux/macOS
./scripts/deploy.sh production

# Windows
.\scripts\deploy.ps1 -Environment production
```

### 3. Verify
```bash
# Check health
curl http://localhost:3001/health
curl http://localhost:80/health

# Access monitoring
# Grafana: http://localhost:3000
# Prometheus: http://localhost:9090
```

## 📁 Deployment Files

### Docker Configuration
- `apps/backend/Dockerfile` - Production backend container
- `apps/frontend/Dockerfile` - Production frontend container
- `docker-compose.prod.yml` - Production services orchestration
- `apps/frontend/nginx.conf` - Nginx configuration with security headers

### Environment & Configuration
- `.env.production` - Production environment template
- `monitoring/` - Prometheus, Grafana, and Loki configurations
- `ssl/` - SSL certificate directory (create and add your certificates)

### Deployment Scripts
- `scripts/deploy.sh` - Linux/macOS deployment script
- `scripts/deploy.ps1` - Windows PowerShell deployment script
- `scripts/maintenance.sh` - Ongoing maintenance operations

### Documentation
- `docs/DEPLOYMENT.md` - Comprehensive deployment guide
- `docs/PRODUCTION_CHECKLIST.md` - Pre-deployment verification checklist

## 🏗️ Architecture

The production deployment includes:

### Core Services
- **Frontend**: React app with Nginx (Port 80/443)
- **Backend**: Node.js API server (Port 3001)
- **PostgreSQL**: Primary database (Port 5432)
- **Redis**: Cache and sessions (Port 6379)

### Monitoring Stack
- **Prometheus**: Metrics collection (Port 9090)
- **Grafana**: Dashboards and visualization (Port 3000)
- **Loki**: Log aggregation (Port 3100)
- **Promtail**: Log shipping agent

## 🔧 Maintenance

### Regular Tasks
```bash
# Full maintenance (backup, cleanup, health check, optimization)
./scripts/maintenance.sh all

# Individual tasks
./scripts/maintenance.sh backup
./scripts/maintenance.sh health
./scripts/maintenance.sh cleanup
./scripts/maintenance.sh optimize
```

### Monitoring
- **Grafana Dashboards**: System metrics, application performance, business KPIs
- **Alerts**: Configured for service downtime, high error rates, resource exhaustion
- **Logs**: Centralized logging with search and analysis capabilities

## 🔒 Security Features

### Application Security
- JWT-based authentication with Hedera wallet signatures
- Rate limiting and DDoS protection
- Input validation and sanitization
- CORS configuration
- Security headers (CSP, HSTS, etc.)

### Infrastructure Security
- Non-root containers
- Network isolation
- Encrypted data at rest
- SSL/TLS encryption
- Regular security updates

## 📊 Health Checks

### Endpoints
- `GET /health` - Overall system health
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### Monitored Components
- Database connectivity
- Redis connectivity
- Hedera blockchain connectivity
- External service availability
- Resource utilization

## 🔄 Backup & Recovery

### Automated Backups
- Database dumps before each deployment
- Volume snapshots
- Configuration backups
- Retention policy (30 days default)

### Recovery
```bash
# Automatic rollback on deployment failure
# Manual rollback available through deployment script
./scripts/deploy.sh production
# Choose 'y' when prompted for rollback
```

## 📈 Scaling

### Horizontal Scaling
```bash
# Scale backend instances
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
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

## 🆘 Troubleshooting

### Common Issues
1. **Service won't start**: Check logs with `docker-compose logs service-name`
2. **Database connection issues**: Verify credentials and network connectivity
3. **High memory usage**: Check `docker stats` and restart services if needed
4. **SSL certificate issues**: Verify certificate files and permissions

### Support
- Check `docs/DEPLOYMENT.md` for detailed troubleshooting
- Review monitoring dashboards for system health
- Analyze logs in Grafana/Loki for error patterns

## 📋 Pre-Deployment Checklist

Before deploying to production, ensure you've completed the `docs/PRODUCTION_CHECKLIST.md`:

- [ ] Infrastructure requirements met
- [ ] Security requirements satisfied
- [ ] All tests passing
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Documentation updated
- [ ] Team sign-off obtained

## 🎯 Success Metrics

Monitor these key metrics post-deployment:
- **Availability**: >99.9% uptime
- **Performance**: <500ms response time (95th percentile)
- **Error Rate**: <1% error rate
- **Resource Usage**: CPU <70%, Memory <80%, Disk <80%

---

For detailed information, see:
- [Complete Deployment Guide](docs/DEPLOYMENT.md)
- [Production Checklist](docs/PRODUCTION_CHECKLIST.md)
- [Security Testing Documentation](docs/SECURITY_TESTING.md)