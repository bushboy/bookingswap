# Authentication System

This directory contains the authentication and user management system for the Booking Swap Platform backend.

## Overview

The authentication system provides secure wallet-based authentication using Hedera blockchain signatures, JWT tokens for session management, and comprehensive user management capabilities.

## Components

### AuthService

The core authentication service that handles:
- Wallet signature verification
- JWT token generation and validation
- User creation and authentication
- Challenge message generation
- Token refresh functionality

**Key Methods:**
- `authenticateWithWallet(signatureData)` - Authenticate user with wallet signature
- `generateToken(user)` - Generate JWT token for user
- `verifyToken(token)` - Verify and decode JWT token
- `generateChallengeMessage(walletAddress)` - Generate challenge for wallet signing
- `refreshTokenIfNeeded(token)` - Refresh token if close to expiration

### AuthMiddleware

Express middleware for handling authentication and authorization:
- JWT token validation
- User context injection
- Authorization checks (verification level, reputation, ownership)
- Automatic token refresh

**Key Methods:**
- `authenticate(options)` - Main authentication middleware
- `requireAuth()` - Require valid authentication
- `optionalAuth()` - Optional authentication
- `requireVerificationLevel(level)` - Require minimum verification level
- `requireMinimumReputation(score)` - Require minimum reputation score
- `requireOwnership(param)` - Ensure user can only access own resources

## Authentication Flow

### 1. Challenge Generation
```http
POST /api/auth/challenge
Content-Type: application/json

{
  "walletAddress": "0.0.123456"
}
```

Response:
```json
{
  "message": "Sign this message to authenticate with Booking Swap Platform:\nWallet: 0.0.123456\nTimestamp: 1694123456789\nNonce: abc123\n\nThis request will not trigger any blockchain transaction or cost any fees.",
  "walletAddress": "0.0.123456"
}
```

### 2. Wallet Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "message": "Challenge message from step 1",
  "signature": "wallet_signature_of_message",
  "publicKey": "user_public_key",
  "walletAddress": "0.0.123456"
}
```

Response:
```json
{
  "user": {
    "id": "user-123",
    "walletAddress": "0.0.123456",
    "profile": { ... },
    "verification": { ... },
    "reputation": { ... }
  },
  "token": "jwt_token",
  "expiresAt": "2024-01-01T12:00:00.000Z"
}
```

### 3. Authenticated Requests
```http
GET /api/users/profile
Authorization: Bearer jwt_token
```

## User Management

### Profile Management
- Get user profile: `GET /api/users/profile`
- Update profile: `PUT /api/users/profile`

### Dashboard and Statistics
- Get dashboard: `GET /api/users/dashboard`
- Get statistics: `GET /api/users/statistics`
- Get transaction history: `GET /api/users/history`

## Security Features

### JWT Token Security
- Configurable expiration time (default: 24 hours)
- Automatic token refresh when close to expiration
- Secure secret key management
- Token payload includes user ID and wallet address

### Wallet Signature Verification
- Integration with Hedera wallet services
- Challenge-response authentication
- No private key storage on server
- Signature verification using public key

### Authorization Levels
- **Basic**: Default level for new users
- **Verified**: Users who have completed verification
- **Premium**: Users with premium verification status

### Rate Limiting
- Global rate limiting (100 requests per 15 minutes per IP)
- Additional rate limiting can be applied per endpoint

## Error Handling

The system provides comprehensive error handling with standardized error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "category": "error_category"
  }
}
```

### Error Categories
- `authentication` - Authentication failures
- `authorization` - Authorization failures
- `validation` - Input validation errors
- `user_management` - User management errors

## Environment Variables

Required environment variables:
- `JWT_SECRET` - Secret key for JWT token signing
- `JWT_EXPIRES_IN` - Token expiration time (default: "24h")
- `HEDERA_ACCOUNT_ID` - Hedera account ID
- `HEDERA_PRIVATE_KEY` - Hedera private key
- `HEDERA_NETWORK` - Hedera network (testnet/mainnet)

## Testing

The authentication system includes comprehensive tests:
- Unit tests for AuthService
- Unit tests for AuthMiddleware
- Unit tests for controllers
- Integration tests for complete authentication flow

Run tests:
```bash
npm run test:unit
```

## Usage Examples

### Basic Authentication Setup
```typescript
import { AuthService } from './services/auth/AuthService';
import { AuthMiddleware } from './middleware/auth';

const authService = new AuthService(userRepository, walletService);
const authMiddleware = new AuthMiddleware(authService, userRepository);

// Protect routes
app.use('/api/users', authMiddleware.requireAuth());

// Require specific verification level
app.use('/api/premium', authMiddleware.requireVerificationLevel('premium'));

// Require minimum reputation
app.use('/api/trusted', authMiddleware.requireMinimumReputation(150));
```

### Custom Authorization
```typescript
// Ensure users can only access their own bookings
app.get('/api/bookings/:userId', 
  authMiddleware.requireAuth(),
  authMiddleware.requireOwnership('userId'),
  bookingController.getUserBookings
);
```

## Best Practices

1. **Always use HTTPS** in production
2. **Rotate JWT secrets** regularly
3. **Monitor authentication failures** for security threats
4. **Implement proper logging** for audit trails
5. **Use environment variables** for sensitive configuration
6. **Validate all inputs** before processing
7. **Implement rate limiting** to prevent abuse
8. **Keep tokens short-lived** and implement refresh logic