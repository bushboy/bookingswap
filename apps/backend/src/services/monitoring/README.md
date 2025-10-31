# Password Recovery Monitoring System

This monitoring system provides comprehensive tracking, logging, and alerting for the password recovery functionality. It includes structured logging, security event tracking, performance metrics, and email delivery monitoring.

## Features

### 1. Structured Logging
- All password reset operations are logged with structured data
- Privacy-conscious email masking (e.g., `te***@example.com`)
- Request context tracking (IP, User-Agent, duration)
- Categorized logging for easy filtering and analysis

### 2. Security Event Logging
- Failed token validation attempts
- Rate limiting violations
- Suspicious activity detection
- Email enumeration attempt prevention
- Severity-based event classification

### 3. Metrics Collection
- Password reset request success/failure rates
- Email delivery success/failure rates
- Token generation and usage statistics
- Rate limiting hit counts
- Security violation counts

### 4. Email Delivery Monitoring
- SMTP delivery status tracking
- Email provider performance metrics
- Delivery duration monitoring
- Failed delivery error tracking

### 5. Rate Limiting with Monitoring
- Per-email and per-IP rate limiting
- Configurable limits and time windows
- Automatic cleanup of expired entries
- Security event generation for violations

## Components

### PasswordRecoveryMonitor
The main monitoring service that tracks all password recovery operations.

```typescript
import { PasswordRecoveryMonitor } from '../services/monitoring/PasswordRecoveryMonitor';

const monitor = PasswordRecoveryMonitor.getInstance();

// Log a password reset request
monitor.logPasswordResetRequest({
  email: 'user@example.com',
  userId: 'user-123',
  success: true,
  duration: 150,
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
});

// Get current metrics
const metrics = monitor.getMetrics();
console.log('Success rate:', metrics.requestsSuccessful / metrics.requestsTotal);
```

### PasswordResetRateLimit
Rate limiting middleware with integrated monitoring.

```typescript
import { PasswordResetRateLimit } from '../middleware/passwordResetRateLimit';

const rateLimiter = new PasswordResetRateLimit({
  emailLimit: 3,        // 3 requests per email per hour
  ipLimit: 10,          // 10 requests per IP per hour
  windowMs: 60 * 60 * 1000, // 1 hour window
});

// Use as Express middleware
app.use('/api/auth/request-password-reset', rateLimiter.middleware());
```

### MonitoringController
REST API endpoints for accessing monitoring data.

```typescript
import { MonitoringController } from '../controllers/MonitoringController';

const controller = new MonitoringController();

// Setup routes
app.get('/api/monitoring/password-recovery/metrics', controller.getPasswordRecoveryMetrics);
app.get('/api/monitoring/password-recovery/events', controller.getPasswordRecoveryEvents);
app.get('/api/monitoring/password-recovery/security', controller.getPasswordRecoverySecurityEvents);
```

## Integration

### 1. AuthService Integration
The AuthService automatically logs all password recovery operations:

```typescript
// Password reset request
const result = await authService.initiatePasswordReset(email, resetBaseUrl, {
  ip: req.ip,
  userAgent: req.get('User-Agent'),
});

// Password reset completion
const result = await authService.resetPassword(token, newPassword, {
  ip: req.ip,
  userAgent: req.get('User-Agent'),
});
```

### 2. EmailService Integration
The EmailService automatically tracks email delivery:

```typescript
// Email delivery is automatically monitored
await emailService.sendPasswordResetEmail(emailData);
// Logs success/failure, duration, and provider information
```

### 3. Controller Integration
Controllers pass request context for comprehensive logging:

```typescript
// In AuthController
const result = await this.authService.initiatePasswordReset(email, resetBaseUrl, {
  ip: req.ip,
  userAgent: req.get('User-Agent'),
});
```

## Monitoring Endpoints

### GET /api/monitoring/password-recovery/metrics
Returns current password recovery metrics.

```json
{
  "success": true,
  "data": {
    "metrics": {
      "requestsTotal": 150,
      "requestsSuccessful": 142,
      "requestsFailed": 8,
      "emailsSent": 140,
      "emailsFailed": 2,
      "tokensGenerated": 142,
      "tokensUsed": 89,
      "rateLimitHits": 12,
      "securityViolations": 3
    },
    "successRates": {
      "requestSuccessRate": 0.947,
      "emailDeliveryRate": 0.986,
      "tokenUsageRate": 0.627,
      "overallSuccessRate": 0.585
    },
    "alerts": [
      "Low token usage rate: 62.7%"
    ]
  }
}
```

### GET /api/monitoring/password-recovery/events
Returns recent password recovery events.

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "type": "request",
        "userId": "user-123",
        "email": "te***@example.com",
        "success": true,
        "timestamp": "2024-01-15T10:30:00Z"
      }
    ],
    "count": 50
  }
}
```

### GET /api/monitoring/password-recovery/security
Returns security events.

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "type": "rate_limit_exceeded",
        "severity": "medium",
        "email": "sp***@example.com",
        "ip": "192.168.1.100",
        "details": {
          "limitType": "email",
          "currentCount": 5,
          "limit": 3
        },
        "timestamp": "2024-01-15T10:25:00Z"
      }
    ],
    "count": 10
  }
}
```

## Configuration

### Environment Variables

```bash
# Rate limiting configuration
PASSWORD_RESET_EMAIL_LIMIT=3
PASSWORD_RESET_IP_LIMIT=10
PASSWORD_RESET_WINDOW_MS=3600000

# Logging configuration
LOG_LEVEL=info
NODE_ENV=production

# Email configuration (affects monitoring)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_FROM_EMAIL=noreply@example.com
```

### Rate Limiting Configuration

```typescript
const rateLimiter = new PasswordResetRateLimit({
  emailLimit: 3,                    // Max requests per email
  ipLimit: 10,                      // Max requests per IP
  windowMs: 60 * 60 * 1000,        // Time window (1 hour)
  skipSuccessfulRequests: false,    // Count successful requests
  skipFailedRequests: false,        // Count failed requests
});
```

## Alerting

The monitoring system generates alerts based on configurable thresholds:

- **Low Success Rate**: Request success rate < 80%
- **Email Delivery Issues**: Email delivery rate < 90%
- **High Security Violations**: > 10 security violations
- **Excessive Rate Limiting**: > 20 rate limit hits

### Custom Alerting Integration

```typescript
import { PasswordRecoveryMonitor } from '../services/monitoring/PasswordRecoveryMonitor';

function checkAndSendAlerts() {
  const monitor = PasswordRecoveryMonitor.getInstance();
  const report = monitor.generateReport();
  
  if (report.alerts.length > 0) {
    // Send to your alerting system
    sendToSlack(report.alerts);
    sendToPagerDuty(report.alerts);
    sendEmailAlert(report.alerts);
  }
}

// Run every 5 minutes
setInterval(checkAndSendAlerts, 5 * 60 * 1000);
```

## Security Considerations

### 1. Privacy Protection
- Email addresses are masked in logs (`te***@example.com`)
- Sensitive data is never logged in plain text
- Token values are truncated for debugging

### 2. Rate Limiting
- Prevents brute force attacks
- Configurable per-email and per-IP limits
- Automatic cleanup of expired entries

### 3. Security Event Tracking
- Failed authentication attempts
- Suspicious activity patterns
- Rate limiting violations
- Invalid token usage

### 4. Audit Trail
- Complete audit trail of all password recovery operations
- Request context tracking (IP, User-Agent)
- Timestamped events for forensic analysis

## Performance Considerations

### 1. Memory Management
- Event history is limited to 1000 entries per type
- Automatic cleanup of expired rate limit entries
- Efficient data structures for fast lookups

### 2. Async Operations
- Non-blocking logging operations
- Background cleanup tasks
- Minimal impact on request processing

### 3. Monitoring Overhead
- Lightweight metric collection
- Structured logging for efficient parsing
- Optional performance metric integration

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check event history limits
   - Verify cleanup intervals
   - Monitor rate limit store sizes

2. **Missing Metrics**
   - Ensure proper service integration
   - Check logging configuration
   - Verify singleton instance usage

3. **Rate Limiting Issues**
   - Check configuration values
   - Verify time window settings
   - Monitor cleanup operations

### Debug Information

```typescript
// Get rate limiter status
const status = rateLimiter.getStatus();
console.log('Rate limiter status:', status);

// Get monitoring metrics
const metrics = monitor.getMetrics();
console.log('Current metrics:', metrics);

// Get recent events for debugging
const events = monitor.getRecentEvents(10);
console.log('Recent events:', events);
```

## Testing

The monitoring system includes comprehensive tests:

```bash
# Run monitoring tests
npm test -- password-recovery-monitoring.test.ts

# Run with coverage
npm test -- password-recovery-monitoring.test.ts --coverage
```

Test coverage includes:
- Metric tracking accuracy
- Event logging functionality
- Rate limiting behavior
- Security event generation
- API endpoint responses
- Integration with services

## Future Enhancements

1. **Real-time Dashboards**
   - WebSocket-based real-time updates
   - Grafana dashboard integration
   - Custom visualization components

2. **Advanced Analytics**
   - Trend analysis and forecasting
   - Anomaly detection algorithms
   - User behavior pattern analysis

3. **Enhanced Alerting**
   - Machine learning-based alert thresholds
   - Multi-channel notification support
   - Alert correlation and deduplication

4. **Compliance Features**
   - GDPR compliance tools
   - Data retention policies
   - Audit report generation