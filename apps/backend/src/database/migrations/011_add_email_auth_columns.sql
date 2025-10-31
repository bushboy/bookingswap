-- Migration: Add email authentication columns
-- Created: 2024-12-07
-- Description: Adds username and password_hash columns for email/password authentication

-- Add username column (unique, nullable for existing wallet users)
ALTER TABLE users 
ADD COLUMN username VARCHAR(50) UNIQUE;

-- Add password_hash column (nullable for existing wallet users)
ALTER TABLE users 
ADD COLUMN password_hash VARCHAR(255);

-- Create index for username lookups
CREATE INDEX idx_users_username ON users(username);

-- Make wallet_address nullable since we now support email/password users
ALTER TABLE users 
ALTER COLUMN wallet_address DROP NOT NULL;

-- Update the unique constraint on wallet_address to allow nulls
DROP INDEX idx_users_wallet_address;
CREATE UNIQUE INDEX idx_users_wallet_address_unique ON users(wallet_address) WHERE wallet_address IS NOT NULL;

-- Add constraint to ensure either wallet_address or (username AND password_hash) exists
ALTER TABLE users 
ADD CONSTRAINT check_auth_method 
CHECK (
    (wallet_address IS NOT NULL) OR 
    (username IS NOT NULL AND password_hash IS NOT NULL)
);