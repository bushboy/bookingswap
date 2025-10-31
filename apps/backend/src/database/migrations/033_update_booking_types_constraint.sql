-- Migration: Update booking types constraint to support accommodation types
-- Created: 2025-10-25
-- Description: Updates the booking type check constraint to support the new accommodation-focused types:
--              hotel, vacation_rental, resort, hostel, bnb
--              This replaces the old constraint that only allowed: hotel, event, flight, rental

-- Drop the old constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_type_check;

-- Add the new constraint with accommodation types
-- Note: We include all booking types for backward compatibility with existing data,
-- but the application layer will only allow creating new bookings with accommodation types
ALTER TABLE bookings ADD CONSTRAINT bookings_type_check 
    CHECK (type IN (
        -- Accommodation types (currently enabled)
        'hotel',
        'vacation_rental',
        'resort',
        'hostel',
        'bnb',
        -- Legacy types (for backward compatibility with existing bookings)
        'event',
        'flight',
        'rental',
        -- Additional event types (for future use)
        'concert',
        'sports',
        'theater'
    ));

-- Comment on the constraint for documentation
COMMENT ON CONSTRAINT bookings_type_check ON bookings IS 
    'Validates booking type. Currently enabled types: hotel, vacation_rental, resort, hostel, bnb. Legacy types (event, flight, rental) and future types (concert, sports, theater) are included for backward compatibility.';


