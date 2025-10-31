-- Create indexes for efficient querying

-- User table indexes
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_verification_level ON users(verification_level);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Booking table indexes (only create if they don't already exist)
CREATE INDEX IF NOT EXISTS idx_bookings_user_id_extra ON bookings(user_id) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_bookings_status_extra ON bookings(status) WHERE status != 'cancelled';
CREATE INDEX IF NOT EXISTS idx_bookings_type_extra ON bookings(type, status);
CREATE INDEX IF NOT EXISTS idx_bookings_verification_status_extra ON bookings(verification_status) WHERE verification_status = 'verified';
CREATE INDEX IF NOT EXISTS idx_bookings_city_extra ON bookings(city) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_bookings_country_extra ON bookings(country) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_bookings_check_in_date_extra ON bookings(check_in_date) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_bookings_check_out_date_extra ON bookings(check_out_date) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_bookings_swap_value_extra ON bookings(swap_value) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_bookings_created_at_extra ON bookings(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_status_type_extra ON bookings(status, type) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_bookings_status_city_extra ON bookings(status, city) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_bookings_status_dates_extra ON bookings(status, check_in_date, check_out_date) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_bookings_user_status_extra ON bookings(user_id, status);

-- Full-text search index for bookings (enhanced)
CREATE INDEX IF NOT EXISTS idx_bookings_search_extra ON bookings USING gin(
  to_tsvector('english', title || ' ' || description || ' ' || city || ' ' || country)
) WHERE status = 'available';

-- Geographic index for location-based searches (if PostGIS is available)
-- CREATE INDEX IF NOT EXISTS idx_bookings_location_geo ON bookings USING gist(
--   ST_GeogFromText('POINT(' || (location_coordinates::json->>1) || ' ' || (location_coordinates::json->>0) || ')')
-- ) WHERE location_coordinates IS NOT NULL;

-- Swap table indexes
CREATE INDEX IF NOT EXISTS idx_swaps_proposer_id ON swaps(proposer_id);
CREATE INDEX IF NOT EXISTS idx_swaps_owner_id ON swaps(owner_id);
CREATE INDEX IF NOT EXISTS idx_swaps_source_booking_id ON swaps(source_booking_id);
CREATE INDEX IF NOT EXISTS idx_swaps_target_booking_id ON swaps(target_booking_id);
CREATE INDEX IF NOT EXISTS idx_swaps_status ON swaps(status);
CREATE INDEX IF NOT EXISTS idx_swaps_expires_at ON swaps(expires_at);
CREATE INDEX IF NOT EXISTS idx_swaps_proposed_at ON swaps(proposed_at);
CREATE INDEX IF NOT EXISTS idx_swaps_created_at ON swaps(created_at);

-- Composite indexes for swap queries
CREATE INDEX IF NOT EXISTS idx_swaps_user_status ON swaps(proposer_id, status);
CREATE INDEX IF NOT EXISTS idx_swaps_owner_status ON swaps(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_swaps_status_expires ON swaps(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_swaps_booking_status ON swaps(source_booking_id, status);

-- Review table indexes (only create if they don't already exist)
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id_extra ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_user_id_extra ON reviews(reviewed_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_swap_id_extra ON reviews(swap_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating_extra ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at_extra ON reviews(created_at);