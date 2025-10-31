-- Migration 030: Fix expires_future constraint to allow expired dates for non-pending swaps
-- This fixes the issue where expired swaps cannot be cancelled due to the constraint

-- Drop the existing constraint that prevents all swaps from having past expiration dates
ALTER TABLE swaps DROP CONSTRAINT IF EXISTS check_expires_future;

-- Add a new constraint that only requires future expiration dates for pending swaps
-- Cancelled, completed, or rejected swaps can have past expiration dates
ALTER TABLE swaps ADD CONSTRAINT check_expires_future_pending_only 
  CHECK (
    status != 'pending' OR expires_at > NOW()
  );

-- Add comment explaining the constraint logic
COMMENT ON CONSTRAINT check_expires_future_pending_only ON swaps IS 
  'Only pending swaps must have future expiration dates. Cancelled, completed, or rejected swaps can have past expiration dates.';