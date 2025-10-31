-- Migration: Create swaps table
-- Created: 2024-12-07
-- Description: Creates the swaps table with all required fields for swap management

CREATE TABLE IF NOT EXISTS swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    target_booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    proposer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
    additional_payment DECIMAL(10,2) CHECK (additional_payment >= 0),
    conditions TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    blockchain_proposal_transaction_id VARCHAR(255) NOT NULL,
    blockchain_execution_transaction_id VARCHAR(255),
    blockchain_escrow_contract_id VARCHAR(255),
    proposed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_different_bookings CHECK (source_booking_id != target_booking_id),
    CONSTRAINT check_different_users CHECK (proposer_id != owner_id),
    CONSTRAINT check_expires_future CHECK (expires_at > NOW()),
    CONSTRAINT check_responded_after_proposed CHECK (responded_at IS NULL OR responded_at >= proposed_at),
    CONSTRAINT check_completed_after_responded CHECK (completed_at IS NULL OR (responded_at IS NOT NULL AND completed_at >= responded_at))
);

-- Create indexes for performance
CREATE INDEX idx_swaps_source_booking_id ON swaps(source_booking_id);
CREATE INDEX idx_swaps_target_booking_id ON swaps(target_booking_id);
CREATE INDEX idx_swaps_proposer_id ON swaps(proposer_id);
CREATE INDEX idx_swaps_owner_id ON swaps(owner_id);
CREATE INDEX idx_swaps_status ON swaps(status);
CREATE INDEX idx_swaps_expires_at ON swaps(expires_at);
CREATE INDEX idx_swaps_proposed_at ON swaps(proposed_at);
CREATE INDEX idx_swaps_blockchain_proposal_transaction_id ON swaps(blockchain_proposal_transaction_id);
CREATE INDEX idx_swaps_blockchain_execution_transaction_id ON swaps(blockchain_execution_transaction_id);

-- Composite indexes for common queries
CREATE INDEX idx_swaps_user_status ON swaps(proposer_id, status);
CREATE INDEX idx_swaps_owner_status ON swaps(owner_id, status);
CREATE INDEX idx_swaps_booking_status ON swaps(source_booking_id, status);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_swaps_updated_at 
    BEFORE UPDATE ON swaps 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();