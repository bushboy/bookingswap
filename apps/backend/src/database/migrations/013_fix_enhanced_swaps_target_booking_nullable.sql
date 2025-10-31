-- Migration: Fix enhanced swaps target_booking_id constraint
-- Created: 2024-12-07
-- Description: Makes target_booking_id nullable for enhanced swaps to support auction mode where target is determined later

-- For enhanced swaps (especially auction mode), target_booking_id should be nullable
-- since the target booking is determined when proposals are made or auction winners are selected
ALTER TABLE swaps 
ALTER COLUMN target_booking_id DROP NOT NULL;

-- Update the constraint to allow null target_booking_id but still prevent same booking swaps when both are present
ALTER TABLE swaps DROP CONSTRAINT IF EXISTS check_different_bookings;
ALTER TABLE swaps ADD CONSTRAINT check_different_bookings CHECK (
    target_booking_id IS NULL 
    OR source_booking_id != target_booking_id
);

-- Add a comment to explain the nullable target_booking_id
COMMENT ON COLUMN swaps.target_booking_id IS 'Target booking ID - nullable for enhanced swaps in auction mode where target is determined through proposals';