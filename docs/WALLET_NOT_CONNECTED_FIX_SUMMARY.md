# Wallet Not Connected Error Fix

## Problem Summary

When users attempted to create a proposal immediately after connecting their wallet, they received a "wallet not connected" error from the endpoint:
```
POST http://localhost:3001/api/swaps/{swapId}/proposals
```

**Error Response:**
```json
{
  "error": {
    "code": "WALLET_NOT_CONNECTED",
    "message": "Wallet connection required. Please connect your wallet before creating a proposal.",
    "category": "validation"
  }
}
```

## Root Cause Analysis

The issue was a **race condition** between wallet connection and proposal creation:

1. **User connects wallet** → Frontend stores wallet address in Redux state
2. **Frontend calls `userService.updateWallet()`** → Async database update begins (in background)
3. **User immediately creates proposal** → Backend checks `req.user.walletAddress` from database
4. **Database hasn't updated yet** → `walletAddress` is still `null`
5. **Backend returns error** → "WALLET_NOT_CONNECTED"

### Code Flow Before Fix

```
Frontend: Wallet Connected → updateWallet() → [Database Update Pending]
                                                         ↓
User: Creates Proposal → Backend checks DB → walletAddress = null → ERROR
```

### Why This Happened

The authentication middleware fetches the user from the database on each request:

```typescript
// apps/backend/src/middleware/auth.ts (line 403)
user = await this.userRepository.findById(tokenPayload.userId);
```

The wallet validation code only checked the database value:

```typescript
// apps/backend/src/controllers/SwapController.ts (line 2323 - BEFORE FIX)
const userWalletAddress = req.user?.walletAddress;
if (!userWalletAddress) {
  // Returns error even though frontend has wallet connected
}
```

## Solution Implemented

### Changes Made

#### 1. Frontend Type Updates
**File:** `apps/frontend/src/types/api.ts`

Added `walletAddress` field to proposal request interface:

```typescript
export interface CreateProposalRequest {
  sourceSwapId?: string;
  message?: string;
  conditions: string[];
  agreedToTerms: boolean;
  cashOffer?: {
    amount: number;
    currency: string;
  };
  walletAddress?: string; // NEW: prevents race conditions
}
```

**File:** `apps/frontend/src/services/swapService.ts`

Updated ProposalData interface:

```typescript
export interface ProposalData {
  bookingId: string;
  message?: string;
  additionalPayment?: number;
  conditions: string[];
  walletAddress?: string; // NEW: wallet address to use for the proposal
}
```

**File:** `packages/shared/src/types/swap-matching.ts`

Updated shared type definition:

```typescript
export interface CreateProposalFromBrowseRequest {
  targetSwapId: string;
  sourceSwapId?: string;
  proposerId: string;
  message?: string;
  conditions: string[];
  agreedToTerms: boolean;
  cashOffer?: {
    amount: number;
    currency: string;
  };
  walletAddress?: string; // NEW: prevents race conditions
}
```

#### 2. Backend Controller Updates
**File:** `apps/backend/src/controllers/SwapController.ts`

Updated `createProposal` method (line 2285-2345):

```typescript
const {
  sourceSwapId,
  bookingId,
  message,
  conditions,
  agreedToTerms,
  walletAddress, // NOW ACCEPTS from request body
} = req.body;

// WALLET VALIDATION: Check if user has a wallet connected
// Accept wallet address from request body (for newly connected wallets) 
// or user record (for persisted wallets)
// This prevents race conditions when wallet is connected but database hasn't updated yet
const userWalletAddress = walletAddress || req.user?.walletAddress;

if (!userWalletAddress) {
  res.status(400).json({
    error: {
      code: 'WALLET_NOT_CONNECTED',
      message: 'Wallet connection required. Please connect your wallet before creating a proposal.',
      category: 'validation',
    },
  });
  return;
}

// Log wallet address source for debugging
logger.debug('Proposal wallet validation', {
  userId,
  walletFromRequest: !!walletAddress,
  walletFromUser: !!req.user?.walletAddress,
  walletAddress: userWalletAddress.substring(0, 10) + '...'
});
```

Updated `createProposalFromBrowse` method (line 2508-2538) with identical logic.

### How It Works Now

```
Frontend: Wallet Connected → State Updated → Wallet Address Available
                                                         ↓
User: Creates Proposal → Sends walletAddress in request body
                                                         ↓
Backend: Checks request.walletAddress FIRST → Database walletAddress SECOND
                                                         ↓
        If EITHER exists → Validation PASSES → Proposal Created ✓
```

### Benefits

1. **Eliminates Race Condition**: Proposal can be created immediately after wallet connection
2. **Backward Compatible**: Still works with persisted wallet addresses from database
3. **Failover Logic**: Uses request body wallet if available, falls back to database
4. **Debug Logging**: Logs source of wallet address for troubleshooting

## Frontend Integration

The frontend (`MakeProposalModal.tsx` line 379) already includes wallet address:

```typescript
const effectiveWalletAddress = walletAddress || user?.walletAddress;

const apiProposalData: CreateProposalRequest = {
  sourceSwapId: selectedSwap.id,
  message: formData.message,
  conditions: formData.conditions || ['Standard swap exchange'],
  agreedToTerms: formData.agreedToTerms,
  walletAddress: effectiveWalletAddress || undefined, // Included in request
};
```

## Testing Recommendations

### Manual Testing Steps

1. **Test Immediate Proposal After Wallet Connection:**
   ```
   a. Clear local storage
   b. Login to application
   c. Connect wallet (HashPack/Blade/etc.)
   d. Immediately click to make a proposal (within 1-2 seconds)
   e. EXPECTED: Proposal created successfully
   f. BEFORE FIX: Would get "wallet not connected" error
   ```

2. **Test With Persisted Wallet:**
   ```
   a. Login with account that has wallet already connected
   b. Create proposal
   c. EXPECTED: Works as before (uses database wallet)
   ```

3. **Test Without Wallet:**
   ```
   a. Login without connecting wallet
   b. Attempt to create proposal
   c. EXPECTED: "Wallet connection required" error (correct behavior)
   ```

### Debug Logging

The backend now logs wallet address source:

```javascript
logger.debug('Proposal wallet validation', {
  userId,
  walletFromRequest: true/false,    // Was wallet in request body?
  walletFromUser: true/false,        // Was wallet in database?
  walletAddress: '0.0.12345...'     // Which address was used
});
```

Check backend logs to verify the fix is working.

## Files Modified

### Backend
- `apps/backend/src/controllers/SwapController.ts`
  - Updated `createProposal()` method
  - Updated `createProposalFromBrowse()` method

### Frontend
- `apps/frontend/src/types/api.ts`
  - Added `walletAddress` to `CreateProposalRequest`
- `apps/frontend/src/services/swapService.ts`
  - Added `walletAddress` to `ProposalData`

### Shared
- `packages/shared/src/types/swap-matching.ts`
  - Added `walletAddress` to `CreateProposalFromBrowseRequest`

## Additional Notes

### Why Not Just Wait for Database Update?

We could have added a delay or retry logic in the frontend, but:
- **Poor UX**: Users shouldn't wait for background processes
- **Unreliable**: Database latency varies
- **Unnecessary**: Frontend already has the wallet address

### Security Considerations

The wallet address is still validated:
- Format validation (Hedera account ID pattern)
- Balance checks (for cash swaps)
- Cannot impersonate other users (userId from authenticated token)

### Future Improvements

Consider updating the user record synchronously when wallet connects:
```typescript
// In WalletContext.tsx
await updateUserWalletAddress(accountInfo.accountId);
// Wait for completion before allowing proposals
```

This would eliminate the need to send wallet address in each request, but the current fix provides immediate relief without breaking changes.

## Verification

To verify the fix is working:

1. Check backend logs for debug messages showing wallet source
2. Monitor proposal creation success rate
3. Test with newly connected wallets

## Impact

- **User Impact**: Immediate - users can create proposals right after wallet connection
- **Breaking Changes**: None - fully backward compatible
- **Performance Impact**: Negligible - one additional field in request body

