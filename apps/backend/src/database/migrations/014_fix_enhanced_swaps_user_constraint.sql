-- Migration: Fix enhanced swaps user constraint
-- Created: 2024-12-07
-- Description: Updates the check_different_users constraint to allow same user for enhanced swaps where user offers their own booking

-- For enhanced swaps, the user creates a swap offering their own booking
-- In this case, proposer_id and owner_id can be the same user
-- We can identify enhanced swaps by the presence of payment_types and acceptance_strategy columns

-- Drop the existing constraint
ALTER TABLE swaps DROP CONSTRAINT IF EXISTS check_different_users;

-- Add updated constraint that allows same user for enhanced swaps (identified by having payment_types)
-- Traditional swaps won't have payment_types column populated, so they still require different users
ALTER TABLE swaps ADD CONSTRAINT check_different_users CHECK (
    (payment_types IS NOT NULL) OR (proposer_id != owner_id)
);

-- Add a comment to explain the constraint logic
COMMENT ON CONSTRAINT check_different_users ON swaps IS 'Ensures different users for traditional swaps, but allows same user for enhanced swaps where user offers their own booking';