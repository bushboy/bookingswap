-- Migration: Create users table
-- Created: 2024-12-07
-- Description: Creates the users table with all required fields for user management

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_accept_max_payment DECIMAL(10,2),
    auto_accept_locations TEXT[],
    auto_accept_booking_types TEXT[],
    verification_level VARCHAR(20) NOT NULL DEFAULT 'basic' CHECK (verification_level IN ('basic', 'verified', 'premium')),
    verification_documents TEXT[] NOT NULL DEFAULT '{}',
    verified_at TIMESTAMP WITH TIME ZONE,
    reputation_score DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (reputation_score >= 0 AND reputation_score <= 5),
    completed_swaps INTEGER NOT NULL DEFAULT 0,
    cancelled_swaps INTEGER NOT NULL DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verification_level ON users(verification_level);
CREATE INDEX idx_users_reputation_score ON users(reputation_score);
CREATE INDEX idx_users_last_active_at ON users(last_active_at);

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();