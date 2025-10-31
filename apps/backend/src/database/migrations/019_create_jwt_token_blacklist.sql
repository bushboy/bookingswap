-- Migration: 019_create_jwt_token_blacklist
-- Created: 2024-01-01
-- Description: Creates jwt_token_blacklist table for JWT token invalidation and session management

CREATE TABLE IF NOT EXISTS jwt_token_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jwt_token_blacklist_token_id ON jwt_token_blacklist(token_id);
CREATE INDEX IF NOT EXISTS idx_jwt_token_blacklist_user_id ON jwt_token_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_jwt_token_blacklist_expires_at ON jwt_token_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_jwt_token_blacklist_user_created ON jwt_token_blacklist(user_id, created_at);

-- Add comment to table
COMMENT ON TABLE jwt_token_blacklist IS 'Stores blacklisted JWT tokens and user session invalidation records';
COMMENT ON COLUMN jwt_token_blacklist.token_id IS 'JWT token identifier (jti claim) or special session invalidation identifier';
COMMENT ON COLUMN jwt_token_blacklist.reason IS 'Reason for blacklisting (e.g., password reset, logout, security breach)';