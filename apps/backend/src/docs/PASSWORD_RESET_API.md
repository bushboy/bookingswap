# Password Reset API Documentation

## Overview

The password reset functionality allows users to securely reset their passwords via email verification. This implementation follows security best practices including:

- Secure token generation using crypto.randomBytes
- Token expiration (1 hour)
- Single-use tokens
- Rate limiting protection
- Email obfuscation for security

## API Endpoints

### 1. Request Password Reset

**POST** `/api/auth/request-password-reset`

Initiates the password reset process by sending a reset link to the user's email.

#### Request Body
```json
{
  "email": "user@example.com",
  "resetBaseUrl": "https://yourapp.com/auth/reset-password"
}
```

#### Response (Success)
```json
{
  "success": true,
  "message": "Password reset link has been sent to your email address."
}
```

#### Response (Error)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "\"email\" must be a valid email",
    "category": "validation"
  }
}
```

#### Security Notes
- Always returns success message even for non-existent emails
- Wallet-only users (no email/password) are handled securely
- Rate limiting should be implemented at the API gateway level

---

### 2. Validate Reset Token

**POST** `/api/auth/validate-reset-token`

Validates if a password reset token is valid and not expired.

#### Request Body
```json
{
  "token": "abc123def456..."
}
```

#### Response (Valid Token)
```json
{
  "valid": true,
  "expiresAt": "2024-12-07T15:30:00.000Z"
}
```

#### Response (Invalid Token)
```json
{
  "valid": false
}
```

---

### 3. Reset Password

**POST** `/api/auth/reset-password`

Resets the user's password using a valid reset token.

#### Request Body
```json
{
  "token": "abc123def456...",
  "newPassword": "NewSecurePassword123"
}
```

#### Response (Success)
```json
{
  "success": true,
  "message": "Password has been reset successfully."
}
```

#### Response (Error)
```json
{
  "error": {
    "code": "PASSWORD_RESET_FAILED",
    "message": "Invalid or expired reset token.",
    "category": "authentication"
  }
}
```

#### Password Requirements
- Minimum 6 characters
- At least one lowercase letter
- At least one uppercase letter  
- At least one number

---

## Email Template

The password reset email includes:

- Personalized greeting with user's display name
- Clear call-to-action button
- Plain text URL as fallback
- Expiration time (60 minutes)
- Security warnings
- Professional HTML styling

### Email Preview (Development)

In development mode, emails are sent via Ethereal Email and preview URLs are logged to the console.

---

## Database Schema

### password_reset_tokens Table

```sql
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### Indexes
- `idx_password_reset_tokens_user_id` - For user lookups
- `idx_password_reset_tokens_token` - For token validation
- `idx_password_reset_tokens_expires_at` - For cleanup operations

---

## Security Features

### Token Security
- 32-byte cryptographically secure random tokens
- Tokens are hashed before storage (optional enhancement)
- Single-use tokens (marked as used after password reset)
- 1-hour expiration time
- Automatic cleanup of expired tokens

### Email Security
- No user enumeration (same response for valid/invalid emails)
- Wallet-only users handled securely
- Professional email templates with security warnings

### Rate Limiting (Recommended)
Implement rate limiting at the API gateway level:
- 5 requests per email per hour for password reset requests
- 10 requests per IP per hour for token validation
- 3 attempts per token for password reset

---

## Frontend Integration

### React Components

1. **PasswordResetRequest** - Email input form
2. **PasswordReset** - New password form with token validation

### Usage Example

```tsx
import { PasswordResetRequest, PasswordReset } from '@/components/auth';

// For requesting reset
<PasswordResetRequest 
  onSuccess={(email) => console.log('Reset sent to:', email)}
  onBack={() => router.push('/login')}
/>

// For resetting password (with token from URL)
<PasswordReset 
  onSuccess={() => router.push('/login')}
/>
```

---

## Environment Configuration

### Required Environment Variables

```env
# Email Service (Production)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password
SMTP_FROM_EMAIL=noreply@yourapp.com
SMTP_FROM_NAME=Your App Name

# Email Service (Development)
ETHEREAL_USER=ethereal.user@ethereal.email
ETHEREAL_PASS=ethereal.pass

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

---

## Testing

### Unit Tests
- AuthService password reset methods
- Email service functionality
- Token repository operations
- Input validation

### Integration Tests
- End-to-end password reset flow
- Email delivery verification
- Token expiration handling
- Security edge cases

### Manual Testing Checklist
- [ ] Request reset for valid email
- [ ] Request reset for invalid email
- [ ] Validate fresh token
- [ ] Validate expired token
- [ ] Reset password with valid token
- [ ] Reset password with invalid token
- [ ] Reset password with weak password
- [ ] Verify email delivery in development
- [ ] Test token single-use behavior

---

## Monitoring and Logging

### Key Metrics to Monitor
- Password reset request rate
- Email delivery success rate
- Token validation attempts
- Failed reset attempts
- Token expiration rates

### Log Events
- Password reset requested (with user ID, not email)
- Reset email sent successfully
- Token validation attempts
- Password reset completed
- Failed reset attempts with reasons

---

## Deployment Notes

### Database Migration
Run the migration to create the password_reset_tokens table:
```bash
psql -d your_database -f apps/backend/src/database/migrations/018_add_password_reset_tokens.sql
```

### Dependencies
Install required packages:
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

### Email Service Setup
1. Configure SMTP settings for production
2. Set up Ethereal Email for development/testing
3. Verify email service connection on startup

### Security Considerations
1. Implement rate limiting at API gateway
2. Monitor for abuse patterns
3. Set up email delivery monitoring
4. Regular cleanup of expired tokens
5. Consider implementing CAPTCHA for high-volume scenarios