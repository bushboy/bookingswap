# Authentication Diagnostic Tools

This directory contains comprehensive diagnostic tools for troubleshooting authentication issues in the Booking Swap Platform.

## Overview

The authentication diagnostic tools provide:

1. **Token Validation Utility** - Decode and analyze JWT tokens without verification
2. **Authentication Health Check** - Validate system configuration and connectivity
3. **User Session Diagnostics** - Verify token-user relationships
4. **Debug Endpoints** - HTTP endpoints for testing authentication flow

## Components

### AuthDebugUtils Class

Located in `../utils/authDebug.ts`, this class provides:

- `performHealthCheck()` - Check JWT configuration and database connectivity
- `analyzeToken(token)` - Analyze JWT token structure and claims
- `decodeTokenWithoutVerification(token)` - Decode token without signature verification
- `validateTokenWithDebug(token)` - Comprehensive token validation with debug info
- `testAuthenticationFlow(token)` - Test complete authentication flow
- `verifyUserSession(userId, token?)` - Verify user session and token relationship
- `generateDiagnosticReport(token?)` - Generate comprehensive diagnostic report

### Debug Routes

Located in `../routes/debug.ts`, provides HTTP endpoints:

- `GET /api/debug/auth/health` - Authentication system health check
- `POST /api/debug/auth/decode-token` - Decode JWT token structure
- `POST /api/debug/auth/analyze-token` - Comprehensive token analysis
- `POST /api/debug/auth/test-flow` - Test authentication flow
- `GET /api/debug/auth/current-user` - Debug current request authentication
- `POST /api/debug/auth/verify-session` - Verify user session
- `POST /api/debug/auth/diagnostic-report` - Generate diagnostic report

## Usage Examples

### 1. Health Check

```bash
curl -X GET http://localhost:3001/api/debug/auth/health
```

### 2. Token Analysis

```bash
curl -X POST http://localhost:3001/api/debug/auth/analyze-token \
  -H "Content-Type: application/json" \
  -d '{"token": "your-jwt-token-here"}'
```

### 3. Test Authentication Flow

```bash
curl -X POST http://localhost:3001/api/debug/auth/test-flow \
  -H "Content-Type: application/json" \
  -d '{"token": "your-jwt-token-here"}'
```

### 4. Current User Debug

```bash
curl -X GET http://localhost:3001/api/debug/auth/current-user \
  -H "Authorization: Bearer your-jwt-token-here"
```

### 5. User Session Verification

```bash
curl -X POST http://localhost:3001/api/debug/auth/verify-session \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-id", "token": "jwt-token"}'
```

### 6. Comprehensive Diagnostic Report

```bash
curl -X POST http://localhost:3001/api/debug/auth/diagnostic-report \
  -H "Content-Type: application/json" \
  -d '{"token": "your-jwt-token-here"}'
```

## Programmatic Usage

```typescript
import { AuthDebugUtils } from '../utils/authDebug';
import { AuthService } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';

// Initialize debug utilities
const debugUtils = new AuthDebugUtils(authService, userRepository);

// Perform health check
const healthCheck = await debugUtils.performHealthCheck();
console.log('Database connected:', healthCheck.databaseConnection.connected);
console.log('JWT configured:', healthCheck.jwtConfiguration.secretConfigured);

// Analyze a token
const tokenAnalysis = await debugUtils.validateTokenWithDebug(token);
console.log('Token valid:', tokenAnalysis.validation.signatureValid);
console.log('User exists:', tokenAnalysis.user.exists);

// Test authentication flow
const flowTest = await debugUtils.testAuthenticationFlow(token);
console.log('Authentication successful:', flowTest.success);
```

## Troubleshooting Common Issues

### 1. 401 Unauthorized Errors

Use the diagnostic report to identify the issue:

```bash
curl -X POST http://localhost:3001/api/debug/auth/diagnostic-report \
  -H "Content-Type: application/json" \
  -d '{"token": "failing-token"}'
```

Check the recommendations in the response for specific fixes.

### 2. Token Format Issues

Use token decode to check structure:

```bash
curl -X POST http://localhost:3001/api/debug/auth/decode-token \
  -H "Content-Type: application/json" \
  -d '{"token": "malformed-token"}'
```

### 3. User Not Found Errors

Verify user session:

```bash
curl -X POST http://localhost:3001/api/debug/auth/verify-session \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-id", "token": "token"}'
```

### 4. JWT Configuration Issues

Check health status:

```bash
curl -X GET http://localhost:3001/api/debug/auth/health
```

Look for JWT configuration warnings in the response.

## Security Notes

- Debug endpoints are only available in non-production environments
- Sensitive information is masked in debug outputs
- All debug activities are logged for security monitoring
- Debug endpoints should not be exposed in production deployments

## Testing

Run the diagnostic test suite:

```typescript
import { testAuthenticationDiagnostics } from './testDiagnostics';

const results = await testAuthenticationDiagnostics();
console.log('Test results:', results);
```

## Integration

The diagnostic tools are automatically integrated into the main application when the server starts. No additional configuration is required.

The tools are initialized in `../index.ts` and available through the `/api/debug` routes.