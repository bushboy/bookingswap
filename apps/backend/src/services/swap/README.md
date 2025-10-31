# SwapExpirationService Configuration

The SwapExpirationService automatically processes expired swap proposals to maintain system integrity. This document describes the configuration options available for the service.

## Environment Variables

The following environment variables can be used to configure the SwapExpirationService:

### Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SWAP_EXPIRATION_ENABLED` | `true` | Enable/disable the SwapExpirationService |
| `SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES` | `5` | How often to check for expired swaps (1-1440 minutes) |

### Timing Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SWAP_EXPIRATION_STARTUP_DELAY_MS` | `10000` | Delay before starting service after app startup (0-300000ms) |
| `SWAP_EXPIRATION_SHUTDOWN_TIMEOUT_MS` | `30000` | Maximum time to wait for graceful shutdown (1000-300000ms) |

### Monitoring Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SWAP_EXPIRATION_ENABLE_DETAILED_LOGGING` | `false` | Enable detailed logging for debugging |
| `SWAP_EXPIRATION_ENABLE_METRICS` | `true` | Enable performance metrics collection |

## Configuration Examples

### Development Environment
```bash
# Fast feedback for development
SWAP_EXPIRATION_ENABLED=true
SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES=1
SWAP_EXPIRATION_STARTUP_DELAY_MS=5000
SWAP_EXPIRATION_SHUTDOWN_TIMEOUT_MS=15000
SWAP_EXPIRATION_ENABLE_DETAILED_LOGGING=true
SWAP_EXPIRATION_ENABLE_METRICS=true
```

### Production Environment
```bash
# Optimized for production stability
SWAP_EXPIRATION_ENABLED=true
SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES=5
SWAP_EXPIRATION_STARTUP_DELAY_MS=30000
SWAP_EXPIRATION_SHUTDOWN_TIMEOUT_MS=60000
SWAP_EXPIRATION_ENABLE_DETAILED_LOGGING=false
SWAP_EXPIRATION_ENABLE_METRICS=true
```

### Test Environment
```bash
# Disabled for most tests
SWAP_EXPIRATION_ENABLED=false
```

## Configuration Validation

The service validates all configuration values on startup:

- **Check Interval**: Must be between 1 and 1440 minutes (24 hours)
- **Startup Delay**: Must be between 0 and 300000ms (5 minutes)
- **Shutdown Timeout**: Must be between 1000ms (1 second) and 300000ms (5 minutes)

Invalid configurations will prevent the application from starting.

## Feature Flag

The service can be completely disabled by setting `SWAP_EXPIRATION_ENABLED=false`. This is useful for:

- Testing environments where automatic expiration is not desired
- Maintenance periods where manual control is preferred
- Debugging scenarios where service interference should be avoided

## Environment-Specific Behavior

### Development
- Shorter check intervals are recommended for faster feedback
- Detailed logging is helpful for debugging
- Shorter startup delays for faster development cycles

### Production
- Longer check intervals reduce database load
- Detailed logging is disabled to reduce log volume
- Longer startup delays ensure system stability
- Adequate shutdown timeouts prevent data loss

### Test
- Service is disabled by default unless explicitly enabled
- When enabled, uses minimal intervals for fast test execution

## Health Monitoring

The service is automatically included in the application's health check system at `/health`. The health check reports:

- Service running status
- Last check timestamp
- Total checks performed
- Total swaps processed
- Recent errors (if any)

## Troubleshooting

### Service Not Starting
1. Check that `SWAP_EXPIRATION_ENABLED=true`
2. Verify configuration values are within valid ranges
3. Check application logs for configuration validation errors

### Performance Issues
1. Increase `SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES` to reduce database load
2. Monitor health check endpoint for service performance metrics
3. Enable detailed logging temporarily for debugging

### Shutdown Issues
1. Increase `SWAP_EXPIRATION_SHUTDOWN_TIMEOUT_MS` if graceful shutdown times out
2. Check logs for shutdown error messages
3. Verify no long-running operations are blocking shutdown

## Integration with Other Services

The SwapExpirationService depends on:
- **SwapProposalService**: For processing expired proposals
- **Database**: For querying and updating swap statuses
- **Notification Services**: For sending expiration notifications

Ensure these dependencies are properly configured and healthy for the service to function correctly.