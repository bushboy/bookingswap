# Password Recovery API Documentation

## Overview

The Password Recovery API provides secure endpoints for users to reset their forgotten passwords through email verification. The API implements security best practices including rate limiting, secure token generation, and protection against email enumeration attacks.

## Base URL

```
Production: https://api.your-domain.com
Development: http://localhost:3001
```

## Authentication

Password recovery endpoints are public and do not require authentication. However, they are protected by rate limiting and other security measures.

## Rate Limiting

All password recovery endpoints are subject to rate limiting:

- **Per Email**: Maximum 3 requests per email address per hour
- **Per IP**: Maximum 10 requests per IP address per hour
- **Global**: Maximum 100 requests per minute across all clients

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 1640995200
```

## Endpoints

### 1. Request Password Reset

Initiates the password reset process by sending a reset email to the user.

**Endpoint**: `POST /api/auth/request-password-reset`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "resetBaseUrl": "https://your-app.com/auth/reset-password"
}
```

**Request Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | User's email address (must be valid email format) |
| `resetBaseUrl` | string | Yes | Base URL for password reset page (must be HTTPS in production) |

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Error Responses**:

**400 Bad Request** - Invalid input:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "category": "validation",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
```

**429 Too Many Requests** - Rate limit exceeded:
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

**500 Internal Server Error** - System error:
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An internal error occurred. Please try again later.",
    "category": "system"
  }
}
```

**Security Notes**:
- Always returns success message regardless of whether email exists (prevents email enumeration)
- Rate limited per email address and IP address
- Invalidates any existing unused tokens for the user
- Logs security events for monitoring

---

### 2. Validate Reset Token

Validates a password reset token before allowing the user to set a new password.

**Endpoint**: `POST /api/auth/validate-reset-token`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "token": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
}
```

**Request Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | Password reset token (64-character hex string) |

**Success Response** (200 OK):
```json
{
  "valid": true,
  "expiresAt": "2024-01-01T13:00:00.000Z",
  "timeRemaining": 2847
}
```

**Response Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `valid` | boolean | Whether the token is valid and unused |
| `expiresAt` | string | ISO 8601 timestamp when token expires |
| `timeRemaining` | number | Seconds until token expires |

**Error Responses**:

**400 Bad Request** - Invalid token format:
```json
{
  "error": {
    "code": "INVALID_TOKEN_FORMAT",
    "message": "Invalid token format",
    "category": "validation"
  }
}
```

**401 Unauthorized** - Invalid or expired token:
```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired reset token",
    "category": "authentication"
  }
}
```

**Security Notes**:
- Tokens are single-use and expire after 1 hour
- Generic error messages prevent token enumeration
- Validation does not consume the token

---

### 3. Reset Password

Completes the password reset process by setting a new password using a valid reset token.

**Endpoint**: `POST /api/auth/reset-password`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "token": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
  "newPassword": "NewSecurePassword123!"
}
```

**Request Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | Valid password reset token |
| `newPassword` | string | Yes | New password (must meet security requirements) |

**Password Requirements**:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter  
- At least one number
- At least one special character
- Cannot be a common password
- Cannot be the same as the current password

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Password has been reset successfully. Please log in with your new password."
}
```

**Error Responses**:

**400 Bad Request** - Invalid input:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Password does not meet security requirements",
    "category": "validation",
    "details": {
      "requirements": [
        "Must be at least 8 characters long",
        "Must contain at least one uppercase letter",
        "Must contain at least one number"
      ]
    }
  }
}
```

**401 Unauthorized** - Invalid or expired token:
```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired reset token",
    "category": "authentication"
  }
}
```

**409 Conflict** - Token already used:
```json
{
  "error": {
    "code": "TOKEN_ALREADY_USED",
    "message": "This reset token has already been used",
    "category": "authentication"
  }
}
```

**Security Notes**:
- Token is immediately invalidated after use
- All user sessions are invalidated after password reset
- Confirmation email is sent to user
- Password strength is validated server-side
- Logs security events for monitoring

---

## Error Handling

### Error Response Format

All error responses follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "category": "error_category",
    "details": {
      // Additional error-specific details
    }
  }
}
```

### Error Categories

| Category | Description | HTTP Status |
|----------|-------------|-------------|
| `validation` | Input validation errors | 400 |
| `authentication` | Token validation errors | 401 |
| `rate_limit` | Rate limiting errors | 429 |
| `system` | Internal server errors | 500 |

### Common Error Codes

| Code | Category | Description |
|------|----------|-------------|
| `VALIDATION_ERROR` | validation | Invalid input data |
| `INVALID_EMAIL_FORMAT` | validation | Email format is invalid |
| `INVALID_TOKEN_FORMAT` | validation | Token format is invalid |
| `INVALID_TOKEN` | authentication | Token is invalid or expired |
| `TOKEN_ALREADY_USED` | authentication | Token has been used |
| `RATE_LIMIT_EXCEEDED` | rate_limit | Too many requests |
| `INTERNAL_ERROR` | system | Internal server error |

## Security Considerations

### Token Security
- Tokens are cryptographically secure (32 random bytes, hex-encoded)
- Tokens expire after 1 hour
- Tokens are single-use only
- Tokens are invalidated when new reset is requested

### Email Security
- No email enumeration (consistent responses)
- Reset links use HTTPS in production
- Email templates include security warnings
- Confirmation emails sent after password reset

### Rate Limiting
- Multiple layers of rate limiting (per-email, per-IP, global)
- Exponential backoff for repeated violations
- Rate limit information in response headers

### Input Validation
- Comprehensive server-side validation
- SQL injection prevention
- XSS protection
- CSRF protection (if applicable)

## Monitoring and Logging

### Security Events Logged
- Password reset requests (successful and failed)
- Token validation attempts
- Rate limit violations
- Password reset completions
- Suspicious activity patterns

### Metrics Available
- Password reset request rate
- Success/failure ratios
- Token usage patterns
- Email delivery rates
- Rate limiting triggers

### Health Check Endpoint

**Endpoint**: `GET /api/auth/password-reset/health`

**Response** (200 OK):
```json
{
  "status": "healthy",
  "emailService": "connected",
  "database": "connected",
  "rateLimit": "operational"
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
interface PasswordResetClient {
  requestReset(email: string, resetBaseUrl: string): Promise<void>;
  validateToken(token: string): Promise<{ valid: boolean; expiresAt: string }>;
  resetPassword(token: string, newPassword: string): Promise<void>;
}

class PasswordResetAPI implements PasswordResetClient {
  constructor(private baseUrl: string) {}

  async requestReset(email: string, resetBaseUrl: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, resetBaseUrl })
    });

    if (!response.ok) {
      throw new Error(`Password reset request failed: ${response.statusText}`);
    }
  }

  async validateToken(token: string): Promise<{ valid: boolean; expiresAt: string }> {
    const response = await fetch(`${this.baseUrl}/api/auth/validate-reset-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      throw new Error(`Token validation failed: ${response.statusText}`);
    }

    return response.json();
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });

    if (!response.ok) {
      throw new Error(`Password reset failed: ${response.statusText}`);
    }
  }
}
```

### cURL Examples

**Request Password Reset**:
```bash
curl -X POST https://api.your-domain.com/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "resetBaseUrl": "https://your-app.com/auth/reset-password"
  }'
```

**Validate Token**:
```bash
curl -X POST https://api.your-domain.com/api/auth/validate-reset-token \
  -H "Content-Type: application/json" \
  -d '{
    "token": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
  }'
```

**Reset Password**:
```bash
curl -X POST https://api.your-domain.com/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    "newPassword": "NewSecurePassword123!"
  }'
```

## Testing

### Test Endpoints (Development Only)

**Clear Rate Limits** (Development only):
```
DELETE /api/auth/password-reset/test/rate-limits
```

**Generate Test Token** (Development only):
```
POST /api/auth/password-reset/test/generate-token
```

### Integration Testing

The API provides comprehensive test coverage including:
- Unit tests for all endpoints
- Integration tests for complete flows
- Security tests for rate limiting and validation
- Performance tests for load handling

## Changelog

### Version 1.0.0
- Initial release with core password reset functionality
- Rate limiting implementation
- Security hardening
- Comprehensive error handling

## Support

For API support:
- Check application logs for detailed error information
- Review rate limiting headers in responses
- Verify email service configuration
- Contact support with request/response details (excluding sensitive data)