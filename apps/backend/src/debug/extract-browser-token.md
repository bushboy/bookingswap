# How to Extract Token from Browser for Debugging

## Step 1: Open Browser Developer Tools
1. Open the browser where you're getting the 401 error
2. Press F12 or right-click → Inspect
3. Go to the **Network** tab

## Step 2: Reproduce the Error
1. Refresh the page or navigate to the swaps page
2. Look for the failed request to `/api/swaps` (should show 401 status)

## Step 3: Extract the Token
1. Click on the failed `/api/swaps` request
2. In the **Headers** section, look for **Request Headers**
3. Find the `Authorization` header
4. Copy the entire value (should start with "Bearer ")

## Step 4: Test the Token
Run this command with your actual token:

```bash
node src/debug/quick-jwt-test.js "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_actual_token_here"
```

## Alternative: Extract from localStorage
1. In browser console, run:
```javascript
console.log('Token:', localStorage.getItem('token'));
```
2. Copy the token value
3. Test with:
```bash
node src/debug/quick-jwt-test.js "Bearer your_token_from_localStorage"
```

## What to Look For

### ✅ Good Token
- Verification successful
- User ID matches your user
- Not expired

### ❌ Bad Token - Signature Error
```
❌ Provided token verification failed: invalid signature
💡 This suggests the token was signed with a different secret
```
**Solution:** Token was created with different JWT_SECRET. User needs to login again.

### ❌ Bad Token - Expired
```
❌ Provided token verification failed: jwt expired
💡 The token has expired - user needs to login again
```
**Solution:** User needs to login again.

### ❌ Bad Token - Malformed
```
❌ Provided token verification failed: jwt malformed
💡 The token format is invalid
```
**Solution:** Token is corrupted. User needs to login again.

## Quick Fix
If the token verification fails, the quickest fix is:
1. **Logout and login again** - This will generate a new token with the current JWT_SECRET
2. **Clear browser storage** - Remove old tokens that might be cached
3. **Check for multiple JWT_SECRET values** - Ensure frontend and backend use the same secret