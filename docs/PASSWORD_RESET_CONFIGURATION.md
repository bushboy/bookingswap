# Password Reset Configuration Guide

This document provides comprehensive configuration guidance for the password reset system in the Booking Swap Platform.

## Overview

The password reset system requires proper configuration of email services and security settings to function correctly. This guide covers all necessary environment variables and their recommended values for different deployment environments.

## Required Environment Variables

### Core Application Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Application environment (`development`, `test`, `production`) |
| `PORT` | No | `3001` | Server port number |
| `JWT_SECRET` | Yes | - | JWT signing secret (minimum 32 characters, 64+ recommended for production) |
| `JWT_EXPIRES_IN` | No | `24h` | JWT token expiration time (format: `24h`, `30m`, `7d`) |
| `FRONTEND_URL` | No | `http://localhost:3000` | Frontend application URL for CORS and reset links |

### Email Service Configuration

#### Production SMTP Settings (Required in Production)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | Yes* | - | SMTP server hostname |
| `SMTP_PORT` | Yes* | `587` | SMTP server port (587 for STARTTLS, 465 for SSL) |
| `SMTP_SECURE` | No | `false` | Use SSL/TLS (`true` for port 465, `false` for port 587) |
| `SMTP_USER` | Yes* | - | SMTP authentication username |
| `SMTP_PASS` | Yes* | - | SMTP authentication password |
| `SMTP_FROM_EMAIL` | No | `noreply@bookingswap.com` | Sender email address |
| `SMTP_FROM_NAME` | No | `Booking Swap Platform` | Sender display name |

*Required only in production environment

#### Development Email Settings (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ETHEREAL_USER` | No | `ethereal.user@ethereal.email` | Ethereal Email username for development |
| `ETHEREAL_PASS` | No | `ethereal.pass` | Ethereal Email password for development |

### Password Reset Security Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PASSWORD_RESET_TOKEN_EXPIRATION_HOURS` | No | `1` | Token expiration time in hours (0.1-24) |
| `PASSWORD_RESET_MAX_REQUESTS_PER_HOUR` | No | `3` | Maximum reset requests per email per hour (1-100) |
| `PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES` | No | `60` | Cleanup job interval in minutes (1-1440) |
| `PASSWORD_RESET_RETENTION_DAYS` | No | `7` | Token retention period in days (0-30) |

## Environment-Specific Configuration

### Development Environment

```bash
# Core settings
NODE_ENV=development
PORT=3001
JWT_SECRET=your-development-jwt-secret-at-least-32-characters-long
JWT_EXPIRES_IN=24h
FRONTEND_URL=http://localhost:3000

# Email settings (optional - uses Ethereal Email by default)
ETHEREAL_USER=your-ethereal-username
ETHEREAL_PASS=your-ethereal-password
SMTP_FROM_EMAIL=noreply@localhost
SMTP_FROM_NAME=Booking Swap Dev

# Password reset settings (optional - uses defaults)
PASSWORD_RESET_TOKEN_EXPIRATION_HOURS=1
PASSWORD_RESET_MAX_REQUESTS_PER_HOUR=5
PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES=30
PASSWORD_RESET_RETENTION_DAYS=1
```

### Production Environment

```bash
# Core settings
NODE_ENV=production
PORT=3001
JWT_SECRET=your-very-secure-jwt-secret-at-least-64-characters-long-for-production
JWT_EXPIRES_IN=24h
FRONTEND_URL=https://your-domain.com

# SMTP settings (required)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM_EMAIL=noreply@your-domain.com
SMTP_FROM_NAME=Your App Name

# Password reset settings (security-focused)
PASSWORD_RESET_TOKEN_EXPIRATION_HOURS=1
PASSWORD_RESET_MAX_REQUESTS_PER_HOUR=3
PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES=60
PASSWORD_RESET_RETENTION_DAYS=7
```

## Configuration Validation

The application performs automatic configuration validation on startup and will:

1. **Validate all required environment variables**
2. **Test email service connectivity**
3. **Check security settings compliance**
4. **Provide warnings for suboptimal configurations**
5. **Fail to start if critical configuration is missing**

### Validation Errors

The application will exit with an error if:
- Required environment variables are missing
- Values are outside acceptable ranges
- Email format is invalid
- JWT secret is too short
- URL formats are invalid

### Validation Warnings

The application will log warnings for:
- Suboptimal security settings
- Missing optional configurations
- Development-specific issues
- Production security recommendations

## Email Provider Examples

### Gmail SMTP

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### SendGrid SMTP

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### Amazon SES

```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

### Mailgun SMTP

```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-smtp-username
SMTP_PASS=your-mailgun-smtp-password
```

## Security Recommendations

### Production Security

1. **JWT Secret**: Use a cryptographically secure secret of at least 64 characters
2. **HTTPS**: Always use HTTPS for frontend URLs in production
3. **SMTP Security**: Use STARTTLS (port 587) or SSL (port 465)
4. **Rate Limiting**: Keep password reset requests to 3-5 per hour maximum
5. **Token Expiration**: Use short expiration times (1-2 hours maximum)

### Email Security

1. **SPF Records**: Configure SPF records for your domain
2. **DKIM**: Enable DKIM signing if supported by your email provider
3. **DMARC**: Implement DMARC policy for email authentication
4. **Dedicated IP**: Consider using a dedicated IP for transactional emails

## Monitoring and Troubleshooting

### Configuration Validation Endpoint

The application provides a configuration summary endpoint for monitoring:

```bash
GET /api/monitoring/config-summary
```

### Common Issues

1. **Email Not Sending**
   - Check SMTP credentials and connectivity
   - Verify firewall settings allow SMTP traffic
   - Check email provider rate limits

2. **Configuration Validation Failures**
   - Review application logs for specific validation errors
   - Ensure all required environment variables are set
   - Verify value formats and ranges

3. **Token Expiration Issues**
   - Check `PASSWORD_RESET_TOKEN_EXPIRATION_HOURS` setting
   - Verify system clock synchronization
   - Review cleanup job configuration

### Logging

The application logs configuration validation results and email delivery status:

```bash
# View configuration validation logs
docker logs your-container | grep "Configuration validation"

# View email delivery logs
docker logs your-container | grep "Password reset email"
```

## Testing Configuration

### Development Testing

1. **Start the application** - Configuration validation runs automatically
2. **Check logs** - Review validation results and warnings
3. **Test email delivery** - Use Ethereal Email preview URLs in development
4. **Verify endpoints** - Test password reset flow end-to-end

### Production Testing

1. **Pre-deployment validation** - Run configuration validation in staging
2. **Email connectivity test** - Verify SMTP connection before deployment
3. **End-to-end testing** - Test complete password reset flow
4. **Monitoring setup** - Configure alerts for email delivery failures

## Migration Guide

### Upgrading from Previous Versions

If upgrading from a version without configuration validation:

1. **Review current environment variables** against this guide
2. **Add missing required variables** for your environment
3. **Update deprecated settings** if any
4. **Test configuration** in staging before production deployment

### Environment Variable Changes

No breaking changes to existing environment variables. All new variables have sensible defaults.

## Support

For configuration issues:

1. **Check application logs** for validation errors and warnings
2. **Review this documentation** for correct variable formats
3. **Test email connectivity** using your SMTP provider's tools
4. **Contact support** with specific error messages and configuration details (excluding sensitive values)