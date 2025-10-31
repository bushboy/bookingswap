-- Migration: Create bookings table
-- Created: 2024-12-07
-- Description: Creates the bookings table with all required fields for booking management

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('hotel', 'event', 'flight', 'rental')),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    coordinates POINT, -- PostgreSQL point type for lat/lng
    check_in_date TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out_date TIMESTAMP WITH TIME ZONE NOT NULL,
    original_price DECIMAL(10,2) NOT NULL CHECK (original_price > 0),
    swap_value DECIMAL(10,2) NOT NULL CHECK (swap_value > 0),
    provider_name VARCHAR(100) NOT NULL,
    confirmation_number VARCHAR(100) NOT NULL,
    booking_reference VARCHAR(100), -- Optional field
    verification_status VARCHAR(20) NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('pending', 'verified', 'failed')),
    verification_documents TEXT[] NOT NULL DEFAULT '{}',
    verified_at TIMESTAMP WITH TIME ZONE,
    blockchain_transaction_id VARCHAR(255),
    blockchain_consensus_timestamp VARCHAR(255),
    blockchain_topic_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'locked', 'swapped', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_dates CHECK (check_out_date > check_in_date)
);

-- Create indexes for performance
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_type ON bookings(type);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_city ON bookings(city);
CREATE INDEX idx_bookings_country ON bookings(country);
CREATE INDEX idx_bookings_check_in_date ON bookings(check_in_date);
CREATE INDEX idx_bookings_check_out_date ON bookings(check_out_date);
CREATE INDEX idx_bookings_swap_value ON bookings(swap_value);
CREATE INDEX idx_bookings_verification_status ON bookings(verification_status);
CREATE INDEX idx_bookings_blockchain_transaction_id ON bookings(blockchain_transaction_id);

-- Create spatial index for coordinates if using PostGIS
-- CREATE INDEX idx_bookings_coordinates ON bookings USING GIST(coordinates);

-- Full-text search index for title and description
CREATE INDEX idx_bookings_search ON bookings USING gin(to_tsvector('english', title || ' ' || description));

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_bookings_updated_at 
    BEFORE UPDATE ON bookings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();