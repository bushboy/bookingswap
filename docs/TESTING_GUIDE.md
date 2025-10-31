# Booking Swap Platform - Testing Guide

This guide covers database configuration and commands needed to run the Booking Swap Platform in testing environments.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL database
- Redis cache
- Docker & Docker Compose (recommended)

## Database Configuration

### Option 1: Using Docker (Recommended)

The easiest way to set up the testing environment is using Docker Compose:

```bash
# Start PostgreSQL and Redis services
docker-compose up postgres redis -d

# Verify services are running
docker-compose ps
```

This will start:
- PostgreSQL on port 5432 (database: `booking_swap_dev`, user: `postgres`, password: `postgres`)
- Redis on port 6379

### Option 2: Local Installation

If you prefer local installations:

#### PostgreSQL Setup
```bash
# Create test database
createdb booking_swap_test
createdb booking_swap_dev

# Create user (if needed)
createuser -s postgres
```

#### Redis Setup
```bash
# Start Redis server
redis-server

# Or with specific configuration
redis-server --port 6379 --databases 16
```

## Environment Configuration

### Backend Environment Setup

1. **Development Environment:**
```bash
cd apps/backend
cp .env.example .env

# Edit .env with your database configuration:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/booking_swap_dev
# REDIS_URL=redis://localhost:6379
```

2. **Test Environment:**
```bash
# The .env.test file is already configured for testing
# It uses separate test databases to avoid conflicts
```

### Frontend Environment Setup

```bash
cd apps/frontend
cp .env.example .env
# Configure frontend environment variables as needed
```

## Database Migration and Setup

### Run Database Migrations

```bash
# Install dependencies first
npm install

# Run database migrations
cd apps/backend
npm run migrate

# Verify migration status
npm run migrate
```

The migration system will:
- Create a `migrations` table to track executed migrations
- Run all pending SQL migrations in order
- Create tables for users, bookings, swaps, reviews, notifications, and admin features

### Available Migration Commands

```bash
# Run pending migrations
npm run migrate

# Rollback a specific migration (marks as not executed)
npm run migrate:rollback [migration_id]
```

## Starting the Platform

### Development Mode

```bash
# Start all services (backend + frontend)
npm run dev

# Or start services individually:
npm run dev:backend    # Backend API on port 3001
npm run dev:frontend   # Frontend on port 3000
```

### Using Docker Compose

```bash
# Start all services including database
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f
```

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run backend unit tests only
cd apps/backend && npm run test:unit

# Run tests in watch mode
cd apps/backend && npm run test:watch
```

### Integration Tests

```bash
# Run integration tests (requires test database)
npm run test:integration

# Backend integration tests
cd apps/backend && npm run test:integration
```

### End-to-End Tests

```bash
# Run E2E tests (requires both frontend and backend running)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode
npm run test:e2e:headed
```

### Security Tests

```bash
# Run all security tests
npm run test:security

# Run specific security test suites
npm run test:security:backend
npm run test:security:frontend

# Run security linting
npm run lint:security
```

### Load Tests

```bash
# Run load tests (requires k6)
npm run test:load

# Install k6 if not available:
# Windows: choco install k6
# macOS: brew install k6
# Linux: See https://k6.io/docs/getting-started/installation/
```

### Run All Tests

```bash
# Run complete test suite
npm run test:all
```

## Test Database Management

### Test Database Configuration

The test environment uses separate databases:
- **Test DB**: `booking_swap_test`
- **Redis Test DB**: Database 1 (instead of default 0)
- **Key Prefix**: `booking-swap-test:`

### Resetting Test Data

```bash
# Drop and recreate test database
dropdb booking_swap_test
createdb booking_swap_test

# Re-run migrations
cd apps/backend
DB_NAME=booking_swap_test npm run migrate
```

### Test Data Seeding

```bash
# If seed scripts exist, run them after migration
# (Check apps/backend/scripts/ for seed files)
```

## Monitoring and Health Checks

### Health Check Endpoints

```bash
# Check backend health
curl http://localhost:3001/health

# Check readiness
curl http://localhost:3001/health/ready

# Check liveness
curl http://localhost:3001/health/live
```

### Service Status

```bash
# Check Docker services
docker-compose ps

# View service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
docker-compose logs redis
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check if PostgreSQL is running
   docker-compose ps postgres
   
   # Check database logs
   docker-compose logs postgres
   
   # Verify connection
   psql -h localhost -U postgres -d booking_swap_dev
   ```

2. **Redis Connection Failed**
   ```bash
   # Check Redis status
   docker-compose ps redis
   
   # Test Redis connection
   redis-cli ping
   ```

3. **Migration Errors**
   ```bash
   # Check migration table
   psql -h localhost -U postgres -d booking_swap_dev -c "SELECT * FROM migrations;"
   
   # Reset migrations (caution: drops all data)
   dropdb booking_swap_dev
   createdb booking_swap_dev
   npm run migrate
   ```

4. **Port Conflicts**
   ```bash
   # Check what's using ports
   netstat -an | findstr :3001
   netstat -an | findstr :5432
   netstat -an | findstr :6379
   
   # Kill processes if needed
   taskkill /PID [process_id] /F
   ```

5. **Test Failures**
   ```bash
   # Run tests with verbose output
   cd apps/backend && npm run test:unit -- --reporter=verbose
   
   # Run specific test file
   cd apps/backend && npx vitest run src/__tests__/auth-integration.test.ts
   ```

### Environment Variables Check

```bash
# Verify environment variables are loaded
cd apps/backend
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"
```

## Performance Testing

### Load Testing with k6

```bash
# Basic load test
npm run test:load

# Custom load test scenarios
k6 run tests/load/load-test.js --vus 10 --duration 30s
```

### Database Performance

```bash
# Check database performance
psql -h localhost -U postgres -d booking_swap_dev -c "
  SELECT schemaname,tablename,attname,n_distinct,correlation 
  FROM pg_stats 
  WHERE schemaname = 'public';
"
```

## Continuous Integration

### GitHub Actions Setup

The project includes CI/CD workflows that:
- Run all test suites
- Check code quality
- Perform security scans
- Build Docker images

### Local CI Simulation

```bash
# Run the same checks as CI
npm run lint
npm run format:check
npm run test:all
npm run build
```

## Additional Resources

- [Deployment Guide](README_DEPLOYMENT.md) - Production deployment
- [Security Testing](docs/SECURITY_TESTING.md) - Security test procedures
- [Production Checklist](docs/PRODUCTION_CHECKLIST.md) - Pre-deployment verification

## Quick Start Commands

```bash
# Complete setup from scratch
git clone [repository]
cd booking-swap-platform
npm install
docker-compose up postgres redis -d
cd apps/backend && npm run migrate
cd ../..
npm run dev

# Run tests
npm run test:unit
npm run test:integration
npm run test:e2e
```

This should get your testing environment up and running with all necessary database configurations and services.