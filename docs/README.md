# Booking Swap Platform

A decentralized booking swap platform built on Hedera blockchain that enables secure peer-to-peer booking exchanges.

## Project Structure

This is a monorepo containing:

- `apps/backend` - Node.js/Express API server with comprehensive testing suite
- `apps/frontend` - React frontend application with Vite build system
- `packages/shared` - Shared types and utilities
- `docs/` - Comprehensive documentation including deployment and security guides
- `tests/` - E2E, integration, load, and security testing suites
- `monitoring/` - Prometheus, Grafana, and Loki configuration for production monitoring

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL database
- Redis cache
- Docker and Docker Compose (for production deployment)
- Hedera testnet/mainnet account

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

3. Start development servers:

```bash
npm run dev
```

## Available Scripts

### Development
- `npm run dev` - Start both frontend and backend in development mode
- `npm run dev:backend` - Start only backend server
- `npm run dev:frontend` - Start only frontend application

### Building
- `npm run build` - Build all packages
- `npm run build:backend` - Build backend only
- `npm run build:frontend` - Build frontend only

### Testing
- `npm run test` - Run all tests across packages
- `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:e2e` - Run end-to-end tests with Playwright
- `npm run test:load` - Run load tests with k6
- `npm run test:security` - Run security tests
- `npm run test:all` - Run complete test suite

### Code Quality
- `npm run lint` - Lint all packages
- `npm run lint:fix` - Auto-fix linting issues
- `npm run lint:security` - Security-focused linting
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Development

The project uses:

- **TypeScript** for type safety across all packages
- **ESLint + Prettier** for code formatting and quality
- **Husky** for Git hooks and pre-commit validation
- **Vitest** for unit and integration testing
- **Playwright** for end-to-end testing
- **k6** for load testing
- **Workspaces** for monorepo management
- **Docker** for containerized deployment
- **Hedera SDK** for blockchain integration

### Feature Flags

The application includes a feature flag system for gradual rollout:

- `VITE_ENABLE_AUCTION_MODE` - Controls auction acceptance strategy UI
- `VITE_ENABLE_CASH_SWAPS` - Controls cash payment options
- `VITE_ENABLE_CASH_PROPOSALS` - Controls cash offer functionality

See [Environment Variables Documentation](docs/ENVIRONMENT_VARIABLES.md) for complete configuration details.

## Key Features

- **Decentralized Booking Swaps** - Secure peer-to-peer booking exchanges on Hedera blockchain
- **Personal Booking Management** - Simplified status-based filtering for booking lifecycle management
- **Real-time Updates** - WebSocket integration for live swap proposals and status updates
- **Comprehensive Testing** - Full test coverage including E2E, integration, load, and security tests
- **Production Monitoring** - Integrated Prometheus, Grafana, and Loki for observability
- **Feature Flag System** - Gradual rollout capabilities for new features

### Architecture Highlights

The My Bookings page uses a simplified status-based filtering approach optimized for personal booking management rather than browsing. This design focuses on booking lifecycle stages (active, with swaps, completed, expired) instead of complex search filters, providing a cleaner mobile experience and reduced cognitive load.

## Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) - Complete production deployment instructions
- [Environment Variables](docs/ENVIRONMENT_VARIABLES.md) - Configuration and feature flags
- [Production Checklist](docs/PRODUCTION_CHECKLIST.md) - Pre-deployment verification
- [Security Testing](docs/SECURITY_TESTING.md) - Security validation procedures
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions

## Production Deployment

For production deployment, use the automated deployment scripts:

```bash
# Linux/macOS
./scripts/deploy.sh production

# Windows
.\scripts\deploy.ps1 -Environment production
```

See the [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions.
