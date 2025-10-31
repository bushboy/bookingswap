-- Migration: Update booking verification default to verified
-- Created: 2025-01-28
-- Description: Updates existing bookings with 'pending' verification status to 'verified' and changes the default for new bookings

-- Update existing bookings with 'pending' status to 'verified'
UPDATE bookings 
SET verification_status = 'verified', 
    verified_at = NOW()
WHERE verification_status = 'pending';

-- Update the default value for the verification_status column
ALTER TABLE bookings 
ALTER COLUMN verification_status SET DEFAULT 'verified';

-- Add a comment to document the change
COMMENT ON COLUMN bookings.verification_status IS 'Verification status: verified (default), pending, or failed';
