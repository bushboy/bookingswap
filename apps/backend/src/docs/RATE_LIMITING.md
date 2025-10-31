# Rate Limiting Middleware

This document describes the comprehensive rate limiting middleware implemented for password reset endpoints.

## Overview

The rate limiting middleware provides protection against abuse and denial of service attacks on password reset endpoints. It implements both per-IP and per-email rate limiting with exponential backoff for repeated attempts.

## Features

- **Per-IP Rate Limiting**: Limits requests based on client IP address
- **Per-Email Rate Limiting**: Limits password reset requests per email address
- **Exponential Backoff**: Increases delay for repeated attempts
- **Redis Support**: Uses Redis for distributed rate limiting when available
- **Fallback Support**: Falls back to in-memory storage when Redis is unavailable
- **Configurable Limits**: Different limits for different endpoints
- **Security Headers**: Provides standard rate limit headers
- **Comprehensive Logging**: Logs security events for monitoring

## Configuration

### Environment Variables

- `REDIS_URL`: Redis connection URL (optional, defaults to `redis://localhost:6379`)
- `NODE_ENV`: Set to `test` to disable Redis in test environment

### Rate Limit Configurations

The middleware uses different configurations for different endpoints:

#### Password Reset Request
- **Window**: 1 hour (3600 seconds)
- **IP Limit**: 5 requests per IP per hour
- **Email Limit**: 3 requests per email per hour
- **Exponential Backoff**: Enabled

#### Password Reset Completion
- **Window**: 15 minutes (900 seconds)
- **IP Limit**: 5 requests per IP per 15 minutes
- **Exponential Backoff**: Enabled

#### Token Validation
- **Window**: 15 minutes (900 seconds)
- **IP Limit**: 10 requests per IP per 15 minutes
- **Exponential Backoff**: Enabled

## Usage

The middleware is automatically applied to password reset endpoints in the auth routes:

```typescript
import { 
  passwordResetRateLimit, 
  passwordResetCompletionRateLimit, 
  tokenValidationRateLimit 
} from '../middleware/rateLimiting';

// Apply to routes
router.post('/request-password-reset', passwordResetRateLimit, authController.requestPasswordReset);
router.post('/reset-password', passwordResetCompletionRateLimit, authController.resetPassword);
router.post('/validate-reset-token', tokenValidationRateLimit, authController.validatePasswordResetToken);
```

## Response Headers

The middleware sets the following headers on all responses:

- `X-RateLimit-Limit`: Maximum number of requests allowed
- `X-RateLimit-Remaining`: Number of requests remaining in current window
- `X-RateLimit-Reset`: ISO timestamp when the rate limit window resets
- `Retry-After`: Seconds to wait before retrying (only on 429 responses)

## Error Responses

When rate limits are exceeded, the middleware returns a 429 status code with the following format:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many password reset requests. Please try again later.",
    "category": "rate_limit",
    "retryAfter": 3600
  }
}
```

## Exponential Backoff

When exponential backoff is enabled, the delay increases exponentially with each attempt:

- 1st violation: 1 second delay
- 2nd violation: 2 seconds delay
- 3rd violation: 4 seconds delay
- 4th violation: 8 seconds delay
- Maximum delay: 1 hour

## Redis Integration

### Benefits of Redis
- **Distributed Rate Limiting**: Works across multiple server instances
- **Persistence**: Rate limit counters survive server restarts
- **Performance**: Optimized for high-throughput operations

### Fallback Behavior
When Redis is unavailable, the middleware automatically falls back to express-rate-limit with in-memory storage.

## Security Considerations

### Email Enumeration Prevention
The middleware applies rate limiting even for non-existent email addresses to prevent email enumeration attacks.

### IP-based Protection
IP-based rate limiting prevents abuse from single sources, even when using different email addresses.

### Logging
All rate limit violations are logged with the following information:
- Endpoint name
- IP address
- Whether IP or email limits were exceeded
- Retry-after time

## Monitoring

### Metrics to Monitor
- Rate limit violation frequency
- Most frequently rate-limited IPs
- Exponential backoff trigger rates
- Redis connection health

### Log Analysis
Rate limit events are logged with structured data for easy analysis:

```json
{
  "level": "warn",
  "message": "Rate limit exceeded",
  "endpoint": "passwordResetRequest",
  "ip": "192.168.1.1",
  "ipBlocked": true,
  "emailBlocked": false,
  "retryAfterSeconds": 3600
}
```

## Testing

### Unit Tests
Run unit tests for the rate limiting middleware:

```bash
npm run test -- src/middleware/__tests__/rateLimiting.test.ts
```

### Integration Tests
Run integration tests to verify middleware integration:

```bash
npm run test -- src/__tests__/rate-limiting-integration.test.ts
```

## Utility Functions

### Reset Rate Limits
```typescript
import { resetRateLimit } from '../middleware/rateLimiting';

// Reset rate limit for a specific key
await resetRateLimit('ip:192.168.1.1', 'passwordResetRequest');
```

### Check Rate Limit Status
```typescript
import { getRateLimitStatus } from '../middleware/rateLimiting';

// Get current rate limit status
const status = await getRateLimitStatus('ip:192.168.1.1', 'passwordResetRequest');
console.log(`Count: ${status.count}, Remaining: ${status.remaining}`);
```

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**
   - Check Redis server availability
   - Verify REDIS_URL environment variable
   - Monitor Redis logs for connection issues

2. **Rate Limits Not Working**
   - Verify middleware is applied to routes
   - Check if Redis is properly connected
   - Review rate limit configurations

3. **False Positives**
   - Consider adjusting rate limit thresholds
   - Review IP detection logic for proxy environments
   - Check for shared IP addresses (NAT, corporate networks)

### Debug Mode
Set log level to debug to see detailed rate limiting information:

```bash
LOG_LEVEL=debug npm start
```

## Performance Considerations

- Redis operations are optimized using pipelines
- Rate limit checks add minimal latency (~1-2ms)
- Memory usage is minimal with Redis storage
- Fallback mode uses more memory for in-process storage

## Future Enhancements

- Geographic rate limiting
- User-agent based rate limiting
- Dynamic rate limit adjustment
- Rate limit bypass for trusted IPs
- Integration with external threat intelligence