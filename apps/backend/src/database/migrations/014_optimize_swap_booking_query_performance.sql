-- Migration: Optimize swap booking query performance
-- Created: 2024-12-07
-- Description: Adds optimized indexes for the findByUserIdWithBookingDetails query

-- Composite index for the main query pattern: user swaps with booking details
-- This covers the WHERE clause (proposer_id OR owner_id) and ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_swaps_user_created_at_desc ON swaps(proposer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swaps_owner_created_at_desc ON swaps(owner_id, created_at DESC);

-- Composite index for bookings to optimize the LEFT JOIN operations
-- This helps when joining bookings table with swaps
CREATE INDEX IF NOT EXISTS idx_bookings_id_status ON bookings(id, status);

-- Partial index for active bookings (most common case)
-- This optimizes joins for available bookings
CREATE INDEX IF NOT EXISTS idx_bookings_active_details ON bookings(id, title, city, country, check_in_date, check_out_date, original_price, swap_value) 
WHERE status NOT IN ('cancelled');

-- Covering index for the complete swap query with booking details
-- This index includes all columns needed for the query to avoid table lookups
CREATE INDEX IF NOT EXISTS idx_swaps_user_booking_covering ON swaps(
    proposer_id, 
    owner_id, 
    created_at DESC, 
    id, 
    source_booking_id, 
    target_booking_id, 
    status
);

-- Index to optimize the UNION-like behavior of (proposer_id OR owner_id)
-- PostgreSQL can use these for better query planning
CREATE INDEX IF NOT EXISTS idx_swaps_all_user_participation ON swaps(
    GREATEST(proposer_id, owner_id), 
    LEAST(proposer_id, owner_id), 
    created_at DESC
);

-- Add statistics targets for better query planning
ALTER TABLE swaps ALTER COLUMN proposer_id SET STATISTICS 1000;
ALTER TABLE swaps ALTER COLUMN owner_id SET STATISTICS 1000;
ALTER TABLE swaps ALTER COLUMN created_at SET STATISTICS 1000;
ALTER TABLE bookings ALTER COLUMN id SET STATISTICS 1000;
ALTER TABLE bookings ALTER COLUMN status SET STATISTICS 1000;

-- Update table statistics to help query planner
ANALYZE swaps;
ANALYZE bookings;

-- Add comments for documentation
COMMENT ON INDEX idx_swaps_user_created_at_desc IS 'Optimizes user swap queries ordered by creation date for proposers';
COMMENT ON INDEX idx_swaps_owner_created_at_desc IS 'Optimizes user swap queries ordered by creation date for owners';
COMMENT ON INDEX idx_bookings_id_status IS 'Optimizes booking lookups with status checks';
COMMENT ON INDEX idx_bookings_active_details IS 'Covering index for active booking details to avoid table lookups';
COMMENT ON INDEX idx_swaps_user_booking_covering IS 'Covering index for complete swap queries with all needed columns';
COMMENT ON INDEX idx_swaps_all_user_participation IS 'Optimizes OR queries for user participation in swaps';