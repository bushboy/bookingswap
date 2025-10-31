-- Migration: Make booking_reference optional
-- Created: 2024-12-07
-- Description: Removes NOT NULL constraint from booking_reference field as it should be optional

-- Make booking_reference nullable
ALTER TABLE bookings 
ALTER COLUMN booking_reference DROP NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN bookings.booking_reference IS 'Optional booking reference number from provider';

