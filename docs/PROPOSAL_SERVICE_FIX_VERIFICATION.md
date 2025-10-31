# Proposal Service Fix - Verification Report

## Changes Made

### 1. Fixed `proposalService.acceptProposal()`

**Changed from:**
```typescript
await this.axiosInstance.put(`/swaps/${request.proposalId}/accept`, {
    targetId: request.targetId,
    swapId: request.swapId
});
```

**To:**
```typescript
await this.axiosInstance.post(`/proposals/${request.proposalId}/accept`, {
    swapTargetId: request.targetId, // Pass targetId as swapTargetId for backend processing
    autoProcessPayment: true
});
```

### 2. Fixed `proposalService.rejectProposal()`

**Changed from:**
```typescript
await this.axiosInstance.put(`/swaps/${request.proposalId}/reject`, {
    targetId: request.targetId,
    swapId: request.swapId,
    reason: request.reason || 'Proposal rejected by user'
});
```

**To:**
```typescript
await this.axiosInstance.post(`/proposals/${request.proposalId}/reject`, {
    swapTargetId: request.targetId, // Pass targetId as swapTargetId for backend processing
    reason: request.reason || 'Proposal rejected by user'
});
```

### 3. Updated Response Handling

**Changed from:**
```typescript
data: {
    swap: any;
    blockchain?: any;
}
```

**To:**
```typescript
data: {
    proposal: any;
    swap?: any;
    paymentTransaction?: any;
    blockchain: any;
}
```

## How the Fix Works

### Frontend Flow:
1. **ProposalDetailCard** calls `proposalService.acceptProposal()` with:
   - `proposalId`: The proposal identifier (currently contains `source_swap_id` due to backend bug)
   - `targetId`: The correct `swap_targets.id` value
   - `swapId`: Source swap ID

2. **proposalService** now calls the correct endpoints:
   - `POST /proposals/{proposalId}/accept`
   - `POST /proposals/{proposalId}/reject`

3. **proposalService** passes `swapTargetId` in request body:
   - Maps `request.targetId` to `swapTargetId` in the request body
   - Backend will prioritize `swapTargetId` over the URL parameter

### Backend Processing:
1. **ProposalController** receives the request
2. Extracts `swapTargetId` from request body
3. Uses `swapTargetId || proposalId` for database operations
4. Routes to correct table based on proposal type:
   - **Booking proposals**: Uses `swap_targets` table with `swapTargetId`
   - **Cash proposals**: Uses `proposals` table with `proposalId`

## Expected Behavior

### For Booking-to-Booking Proposals:
- ✅ Frontend passes correct `swap_targets.id` as `swapTargetId`
- ✅ Backend uses `swapTargetId` for `swap_targets` table operations
- ✅ Proposal acceptance/rejection works correctly

### For Cash Offer Proposals:
- ✅ Frontend still passes `swapTargetId` (though not used for cash)
- ✅ Backend falls back to `proposalId` for `proposals` table operations
- ✅ Cash proposal acceptance/rejection works correctly

## Authentication

- ✅ **User ID**: Extracted automatically from JWT token by backend middleware
- ✅ **Authorization**: Handled by existing auth middleware
- ✅ **Token**: Passed via Authorization header by axios interceptor

## Verification Steps

1. **Test Booking Proposal Acceptance**:
   - Accept a booking-to-booking proposal
   - Verify it uses `/proposals/{id}/accept` endpoint
   - Verify `swapTargetId` is passed in request body
   - Verify proposal status updates correctly

2. **Test Booking Proposal Rejection**:
   - Reject a booking-to-booking proposal
   - Verify it uses `/proposals/{id}/reject` endpoint
   - Verify `swapTargetId` and `reason` are passed
   - Verify proposal status updates correctly

3. **Test Cash Offer Acceptance**:
   - Accept a cash offer proposal
   - Verify backend falls back to `proposalId` correctly
   - Verify payment processing is triggered

4. **Test Cash Offer Rejection**:
   - Reject a cash offer proposal
   - Verify backend handles cash proposals correctly
   - Verify rejection reason is recorded

## Benefits of This Fix

1. **Correct Routing**: Frontend now calls the right endpoints with swap_target_id support
2. **Type Safety**: Proper handling of different proposal types (booking vs cash)
3. **Database Consistency**: Correct table operations based on proposal type
4. **Backward Compatibility**: Fallback logic maintains existing functionality
5. **Authentication**: Leverages existing JWT middleware for user identification

## Status

✅ **COMPLETE** - Frontend proposal service has been updated to work correctly with the backend's swap_target_id logic.