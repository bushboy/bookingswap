# Database Constraint Fix for Expired Swaps

## Problem
The SwapExpirationService was failing to cancel expired swaps due to a database constraint violation. The `check_expires_future` constraint required all swaps to have `expires_at > NOW()`, which prevented expired swaps from being updated to 'cancelled' status.

## Root Cause
The constraint was too restrictive - it should only apply to pending swaps, not cancelled or completed swaps.

## Solution

### 1. Database Migration (030_fix_expires_future_constraint.sql)
- Drops the old `check_expires_future` constraint
- Adds a new `check_expires_future_pending_only` constraint that only applies to pending swaps
- Allows cancelled, completed, or rejected swaps to have past expiration dates

### 2. Code Workaround (SwapRepository.updateStatus)
- Added error handling for the constraint violation
- Implements a temporary workaround that sets `expires_at` to a future date when cancelling expired swaps
- This workaround ensures the service continues working even before the migration is applied

## How to Apply

### Option 1: Run the Migration (Recommended)
```sql
-- Apply the migration file
\i src/database/migrations/030_fix_expires_future_constraint.sql
```

### Option 2: Manual SQL Commands
```sql
-- Drop the old constraint
ALTER TABLE swaps DROP CONSTRAINT IF EXISTS check_expires_future;

-- Add the new constraint
ALTER TABLE swaps ADD CONSTRAINT check_expires_future_pending_only 
  CHECK (status != 'pending' OR expires_at > NOW());
```

## Verification
After applying the fix:
1. The SwapExpirationService should successfully cancel expired swaps
2. No more "check_expires_future" constraint violations in the logs
3. Expired swaps will have status='cancelled' and their original expires_at date

## Rollback
If needed, you can rollback by restoring the original constraint:
```sql
ALTER TABLE swaps DROP CONSTRAINT IF EXISTS check_expires_future_pending_only;
ALTER TABLE swaps ADD CONSTRAINT check_expires_future CHECK (expires_at > NOW());
```

Note: This will prevent the SwapExpirationService from working until expired swaps are manually cleaned up.