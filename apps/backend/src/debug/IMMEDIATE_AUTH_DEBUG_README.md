# Immediate Authentication Debugging

This implementation provides comprehensive debugging tools to identify and resolve the 401 Unauthorized error on the `/swaps` endpoint.

## 🚨 Problem Description

Users are getting 401 Unauthorized errors when accessing the `/swaps` endpoint even with valid authentication tokens after login. This prevents authenticated users from viewing their swap data.

## 🔍 Debugging Tools Implemented

### 1. ImmediateAuthDebugger Class (`immediate-auth-debug.ts`)

A comprehensive debugging class that analyzes every step of the authentication process:

- **Token Extraction**: Validates Authorization header format
- **JWT Configuration**: Checks JWT_SECRET configuration
- **Token Format**: Validates JWT structure (3 parts separated by dots)
- **Token Decoding**: Decodes token payload without verification for analysis
- **Token Verification**: Tests JWT signature and expiration
- **User Lookup**: Verifies user exists in database
- **Request Attachment**: Confirms user data is attached to request

### 2. Debug API Endpoints

Added to existing `/api/debug/auth/` routes:

#### `POST /api/debug/auth/immediate-analyze`
Analyzes a token comprehensively and provides actionable recommendations.

**Request:**
```json
{
  "token": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "debugInfo": {
    "timestamp": "2024-12-17T...",
    "authHeader": { "present": true, "format": "Bearer", "length": 200 },
    "token": { "format": "valid_jwt", "decodedPayload": {...} },
    "jwtConfig": { "secretConfigured": true, "secretLength": 32 },
    "verification": { "success": true, "payload": {...} },
    "userLookup": { "userFound": true, "userId": "..." },
    "finalResult": "success"
  },
  "recommendations": [...]
}
```

#### `POST /api/debug/auth/immediate-flow-test`
Tests the complete authentication flow including middleware execution.

**Request:**
```json
{
  "authHeader": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `GET /api/debug/auth/immediate-state`
Checks the current request's authentication state (uses optional auth middleware).

### 3. Enhanced Logging

Added temporary debug logging to `getUserSwaps` method in `SwapController.ts`:

- Logs all authentication-related request details
- Identifies exactly where authentication fails
- Provides request ID for tracking
- Logs user attachment status

### 4. Test Scripts

#### `test-immediate-auth-debug.ts`
Comprehensive test script that validates:
- JWT configuration
- Sample token formats
- Authentication flow testing
- Database connectivity

**Usage:**
```bash
ts-node src/debug/test-immediate-auth-debug.ts
# or with a real token:
ts-node src/debug/test-immediate-auth-debug.ts "Bearer your_token_here"
```

#### `test-swaps-endpoint-immediate.ts`
Direct endpoint testing script:
- Tests `/api/swaps` with and without authentication
- Uses debug endpoints to analyze tokens
- Provides comprehensive test results

**Usage:**
```bash
ts-node src/debug/test-swaps-endpoint-immediate.ts "Bearer your_token_here"
```

#### `run-immediate-debug-test.ts`
Quick runner script for immediate testing.

## 🛠️ How to Use

### Step 1: Test Without Token
```bash
# Test basic functionality
ts-node src/debug/run-immediate-debug-test.ts
```

### Step 2: Test With Real Token
1. Login to the application and get a valid token
2. Test with the token:
```bash
ts-node src/debug/run-immediate-debug-test.ts "Bearer your_token_here"
```

### Step 3: Use API Endpoints
```bash
# Analyze a specific token
curl -X POST http://localhost:3001/api/debug/auth/immediate-analyze \
  -H "Content-Type: application/json" \
  -d '{"token": "Bearer your_token_here"}'

# Test authentication flow
curl -X POST http://localhost:3001/api/debug/auth/immediate-flow-test \
  -H "Content-Type: application/json" \
  -d '{"authHeader": "Bearer your_token_here"}'

# Check current auth state
curl -X GET http://localhost:3001/api/debug/auth/immediate-state \
  -H "Authorization: Bearer your_token_here"
```

### Step 4: Test Swaps Endpoint Directly
```bash
ts-node src/debug/test-swaps-endpoint-immediate.ts "Bearer your_token_here"
```

## 🔧 Common Issues and Solutions

### Issue 1: JWT_SECRET Not Configured
**Symptoms:** `secretConfigured: false` in debug output
**Solution:** Set `JWT_SECRET` environment variable

### Issue 2: Token Format Invalid
**Symptoms:** `tokenFormat: "invalid_jwt"` or `"malformed"`
**Solution:** Ensure token has 3 parts separated by dots

### Issue 3: Token Expired
**Symptoms:** `isExpired: true` in decoded payload
**Solution:** User needs to login again

### Issue 4: JWT Signature Verification Failed
**Symptoms:** `verificationResult: "failed"` with signature error
**Solution:** Check JWT_SECRET matches the one used to sign tokens

### Issue 5: User Not Found
**Symptoms:** `userFound: false` in debug output
**Solution:** User may have been deleted; check database

### Issue 6: Database Connection Issues
**Symptoms:** Database errors in user lookup
**Solution:** Check database connectivity and configuration

## 📊 Debug Output Interpretation

### Success Flow
```
finalResult: "success"
authHeader.present: true
token.format: "valid_jwt"
verification.success: true
userLookup.userFound: true
```

### Common Failure Patterns

#### Missing Token
```
finalResult: "failed"
authHeader.present: false
```

#### Invalid Token Format
```
finalResult: "failed"
authHeader.present: true
token.format: "invalid_jwt"
```

#### Expired Token
```
finalResult: "failed"
verification.success: false
verification.error: "Token expired"
```

#### User Not Found
```
finalResult: "failed"
verification.success: true
userLookup.userFound: false
```

## 🚀 Next Steps After Debugging

1. **Identify Root Cause**: Use debug output to pinpoint exact failure point
2. **Fix Configuration**: Address JWT_SECRET or database issues
3. **Update Frontend**: Ensure proper token handling and refresh logic
4. **Remove Debug Logging**: Clean up temporary logging after issue is resolved
5. **Monitor**: Set up proper monitoring to prevent future issues

## 📝 Files Modified/Created

### Created:
- `src/debug/immediate-auth-debug.ts` - Main debugging class
- `src/debug/test-immediate-auth-debug.ts` - Comprehensive test script
- `src/debug/test-swaps-endpoint-immediate.ts` - Endpoint testing script
- `src/debug/run-immediate-debug-test.ts` - Quick runner script
- `src/debug/IMMEDIATE_AUTH_DEBUG_README.md` - This documentation

### Modified:
- `src/routes/debug.ts` - Added immediate debugging endpoints
- `src/controllers/SwapController.ts` - Added temporary debug logging to getUserSwaps

## ⚠️ Important Notes

1. **Debug routes are only available in non-production environments**
2. **Temporary debug logging should be removed after issue resolution**
3. **Debug endpoints provide detailed information - use carefully**
4. **All debug activities are logged for security monitoring**

## 🔒 Security Considerations

- Debug endpoints are disabled in production
- Sensitive token information is masked in logs
- Debug activities are monitored and logged
- JWT secrets are never exposed in debug output (only length and preview)