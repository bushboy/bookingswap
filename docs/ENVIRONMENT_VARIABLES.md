# Environment Variables Documentation

This document provides comprehensive information about environment variables used in the Booking Swap application, with special focus on the feature flags system for hiding auction and cash swap functionality.

## Table of Contents

- [Quick Start](#quick-start)
- [Feature Flags System](#feature-flags-system)
- [Frontend Environment Variables](#frontend-environment-variables)
- [Backend Environment Variables](#backend-environment-variables)
- [Production Configuration](#production-configuration)
- [Development Setup](#development-setup)
- [Troubleshooting](#troubleshooting)

## Quick Start

1. **Frontend Setup:**
   ```bash
   cd apps/frontend
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Backend Setup:**
   ```bash
   cd apps/backend
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Feature Flags (Default - Simplified UI):**
   ```bash
   # In apps/frontend/.env
   VITE_ENABLE_AUCTION_MODE=false
   VITE_ENABLE_CASH_SWAPS=false
   VITE_ENABLE_CASH_PROPOSALS=false
   ```

## Feature Flags System

The feature flags system allows temporary hiding of auction and cash swap functionality while preserving all backend capabilities.

### Overview

| Feature Flag | Controls | Default | Impact When Disabled |
|--------------|----------|---------|---------------------|
| `VITE_ENABLE_AUCTION_MODE` | Auction acceptance strategy UI | `false` | Only "First Match" acceptance available |
| `VITE_ENABLE_CASH_SWAPS` | Cash payment options in swap creation | `false` | Only "Booking Exchange" payment type shown |
| `VITE_ENABLE_CASH_PROPOSALS` | Cash offer functionality in proposals | `false` | Only booking exchange proposals allowed |

### Key Principles

1. **UI-Only Impact**: Feature flags only affect frontend visibility
2. **Backend Preservation**: All API endpoints and functionality remain intact
3. **Data Integrity**: Existing auction and cash swap data continues to work
4. **Easy Rollback**: Features can be restored by changing environment variables
5. **No Code Changes**: Re-enabling requires only configuration updates

### Usage Examples

#### Simplified UI (Default)
```bash
# Hide all advanced features - recommended for initial rollout
VITE_ENABLE_AUCTION_MODE=false
VITE_ENABLE_CASH_SWAPS=false
VITE_ENABLE_CASH_PROPOSALS=false
```

#### Gradual Feature Rollout
```bash
# Enable only cash swaps first
VITE_ENABLE_AUCTION_MODE=false
VITE_ENABLE_CASH_SWAPS=true
VITE_ENABLE_CASH_PROPOSALS=true
```

#### Full Feature Set
```bash
# Enable all features
VITE_ENABLE_AUCTION_MODE=true
VITE_ENABLE_CASH_SWAPS=true
VITE_ENABLE_CASH_PROPOSALS=true
```

## Frontend Environment Variables

### Required Variables

| Variable | Description | Example | Notes |
|----------|-------------|---------|-------|
| `VITE_WALLET_CONNECT_PROJECT_ID` | WalletConnect Cloud project ID | `abc123...` | Get from https://cloud.walletconnect.com/ |
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3001/api` | Must match backend server |

### Feature Flags (Frontend)

| Variable | Description | Default | Values |
|----------|-------------|---------|--------|
| `VITE_ENABLE_AUCTION_MODE` | Show auction acceptance strategy options | `false` | `true`, `false` |
| `VITE_ENABLE_CASH_SWAPS` | Show cash payment options in swap creation | `false` | `true`, `false` |
| `VITE_ENABLE_CASH_PROPOSALS` | Show cash offer functionality | `false` | `true`, `false` |

### WebSocket Configuration

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `VITE_WS_URL` | WebSocket server URL | `http://localhost:3001` | Usually same as backend |
| `VITE_WS_RECONNECT_ATTEMPTS` | Max reconnection attempts | `10` | Set to 0 to disable |
| `VITE_WS_RECONNECT_INTERVAL` | Reconnection delay (ms) | `5000` | Exponential backoff |
| `VITE_WS_CONNECTION_TIMEOUT` | Connection timeout (ms) | `10000` | Initial connection |
| `VITE_WS_HEARTBEAT_INTERVAL` | Heartbeat interval (ms) | `30000` | Keep-alive pings |
| `VITE_WS_HEARTBEAT_TIMEOUT` | Heartbeat timeout (ms) | `5000` | Ping response timeout |

### Hedera Configuration

| Variable | Description | Example | Networks |
|----------|-------------|---------|----------|
| `VITE_HEDERA_NETWORK` | Hedera network | `testnet` | `testnet`, `mainnet`, `previewnet` |
| `VITE_HEDERA_MIRROR_NODE_URL` | Mirror node URL | `https://testnet.mirrornode.hedera.com` | Network-specific |

### Debug Configuration

| Variable | Description | Default | Values |
|----------|-------------|---------|--------|
| `VITE_WS_DEBUG_MODE` | Enable WebSocket debugging | `false` | `true`, `false` |
| `VITE_WS_LOG_LEVEL` | Logging level | `warn` | `error`, `warn`, `info`, `debug` |

## Backend Environment Variables

### Required Variables

| Variable | Description | Example | Notes |
|----------|-------------|---------|-------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` | Required for data persistence |
| `JWT_SECRET` | JWT signing secret | `your-secret-key-here` | Min 32 characters recommended |
| `HEDERA_ACCOUNT_ID` | Hedera account ID | `0.0.123456` | Format: 0.0.number |
| `HEDERA_PRIVATE_KEY` | Hedera private key | `302e020100...` | DER encoded |

### Server Configuration

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `PORT` | Server port | `3001` | Must be available |
| `NODE_ENV` | Node environment | `development` | `development`, `production`, `test` |

### Feature Flags (Backend)

**Important**: The backend does NOT use feature flags. All functionality remains active regardless of frontend settings.

- All API endpoints continue to work
- Auction and cash swap processing remains functional
- Existing data is preserved and accessible
- No backend configuration changes needed for feature hiding

## Production Configuration

### Environment Files

1. **Frontend Production** (`apps/frontend/.env.production`):
   ```bash
   # API Configuration
   VITE_API_BASE_URL=https://your-domain.com/api
   VITE_WS_URL=https://your-domain.com
   
   # Hedera Mainnet
   VITE_HEDERA_NETWORK=mainnet
   VITE_HEDERA_MIRROR_NODE_URL=https://mainnet.mirrornode.hedera.com
   
   # Feature Flags - Start with simplified UI
   VITE_ENABLE_AUCTION_MODE=false
   VITE_ENABLE_CASH_SWAPS=false
   VITE_ENABLE_CASH_PROPOSALS=false
   
   # Production Security
   VITE_WS_DEBUG_MODE=false
   VITE_WS_LOG_LEVEL=error
   ```

2. **Backend Production** (`.env.production`):
   ```bash
   # Server
   NODE_ENV=production
   PORT=3001
   
   # Database (use secure credentials)
   DATABASE_URL=postgresql://prod_user:secure_password@db_host:5432/prod_db
   REDIS_URL=redis://redis_host:6379
   
   # JWT (use strong secret)
   JWT_SECRET=your_very_secure_production_jwt_secret_minimum_32_chars
   
   # Hedera Mainnet
   HEDERA_NETWORK=mainnet
   HEDERA_ACCOUNT_ID=0.0.your_mainnet_account
   HEDERA_PRIVATE_KEY=your_mainnet_private_key
   ```

### Deployment Strategy

1. **Initial Deployment** (Simplified UI):
   ```bash
   # Deploy with all advanced features hidden
   VITE_ENABLE_AUCTION_MODE=false
   VITE_ENABLE_CASH_SWAPS=false
   VITE_ENABLE_CASH_PROPOSALS=false
   ```

2. **Gradual Rollout**:
   ```bash
   # Phase 1: Enable cash features
   VITE_ENABLE_CASH_SWAPS=true
   VITE_ENABLE_CASH_PROPOSALS=true
   
   # Phase 2: Enable auction features
   VITE_ENABLE_AUCTION_MODE=true
   ```

3. **Quick Rollback**:
   ```bash
   # Instantly hide features if issues arise
   VITE_ENABLE_AUCTION_MODE=false
   VITE_ENABLE_CASH_SWAPS=false
   VITE_ENABLE_CASH_PROPOSALS=false
   ```

## Development Setup

### Local Development

1. **Clone and Setup**:
   ```bash
   git clone <repository>
   cd booking-swap
   
   # Frontend
   cd apps/frontend
   cp .env.example .env
   
   # Backend  
   cd ../backend
   cp .env.example .env
   ```

2. **Configure Feature Flags**:
   ```bash
   # For testing simplified UI (recommended)
   echo "VITE_ENABLE_AUCTION_MODE=false" >> apps/frontend/.env
   echo "VITE_ENABLE_CASH_SWAPS=false" >> apps/frontend/.env
   echo "VITE_ENABLE_CASH_PROPOSALS=false" >> apps/frontend/.env
   
   # For testing full features
   echo "VITE_ENABLE_AUCTION_MODE=true" >> apps/frontend/.env
   echo "VITE_ENABLE_CASH_SWAPS=true" >> apps/frontend/.env
   echo "VITE_ENABLE_CASH_PROPOSALS=true" >> apps/frontend/.env
   ```

3. **Start Services**:
   ```bash
   # Start backend
   cd apps/backend && npm run dev
   
   # Start frontend (in another terminal)
   cd apps/frontend && npm run dev
   ```

### Testing Different Configurations

```bash
# Test simplified UI
export VITE_ENABLE_AUCTION_MODE=false
export VITE_ENABLE_CASH_SWAPS=false
export VITE_ENABLE_CASH_PROPOSALS=false
npm run dev

# Test full features
export VITE_ENABLE_AUCTION_MODE=true
export VITE_ENABLE_CASH_SWAPS=true
export VITE_ENABLE_CASH_PROPOSALS=true
npm run dev
```

## Troubleshooting

### Common Issues

1. **Feature Flags Not Working**:
   ```bash
   # Check environment variables are loaded
   console.log(import.meta.env.VITE_ENABLE_AUCTION_MODE)
   
   # Restart development server after .env changes
   npm run dev
   ```

2. **Features Still Visible**:
   - Ensure environment variables start with `VITE_`
   - Check for typos in variable names
   - Verify `.env` file is in correct location
   - Clear browser cache and restart dev server

3. **Backend Errors**:
   - Backend doesn't use feature flags
   - All API endpoints should work regardless of frontend flags
   - Check backend logs for actual errors

### Validation Commands

```bash
# Check frontend environment loading
cd apps/frontend
npm run build # Should show environment variables

# Check backend environment
cd apps/backend  
node -e "console.log(process.env.NODE_ENV)"

# Test feature flag parsing
node -e "
const flags = {
  ENABLE_AUCTION_MODE: process.env.VITE_ENABLE_AUCTION_MODE === 'true',
  ENABLE_CASH_SWAPS: process.env.VITE_ENABLE_CASH_SWAPS === 'true',
  ENABLE_CASH_PROPOSALS: process.env.VITE_ENABLE_CASH_PROPOSALS === 'true'
};
console.log('Feature Flags:', flags);
"
```

### Debug Mode

Enable debug mode to troubleshoot feature flag issues:

```bash
# In apps/frontend/.env
VITE_WS_DEBUG_MODE=true
VITE_WS_LOG_LEVEL=debug

# Check browser console for feature flag values
# Look for: "Feature Flags Loaded: { ENABLE_AUCTION_MODE: false, ... }"
```

## Security Considerations

1. **Environment Variables**:
   - Never commit `.env` files to version control
   - Use `.env.example` for templates only
   - Store production secrets securely (e.g., AWS Secrets Manager)

2. **Feature Flags**:
   - Frontend flags are visible to users (not security-sensitive)
   - Backend functionality remains protected by existing authentication
   - Feature hiding is for UX, not security

3. **Production Deployment**:
   - Use environment-specific configuration
   - Validate all required variables before deployment
   - Monitor for configuration drift

## Support

For additional help:

1. Check the [main README](../README.md) for general setup
2. Review [deployment documentation](./DEPLOYMENT.md) for production setup
3. See [troubleshooting guide](../TROUBLESHOOTING.md) for common issues
4. Contact the development team for feature flag questions