-- Migration: Create swap proposals and proposal responses tables
-- Created: 2024-12-07
-- Description: Creates dedicated swap_proposals table and proposal_responses table for tracking proposal acceptance/rejection

-- Create swap_proposals table (separate from swaps table for better data modeling)
CREATE TABLE IF NOT EXISTS swap_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_swap_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    target_swap_id UUID REFERENCES swaps(id) ON DELETE CASCADE, -- For booking proposals
    proposer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proposal_type VARCHAR(20) NOT NULL CHECK (proposal_type IN ('booking', 'cash')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    
    -- Financial proposal fields
    cash_offer_amount DECIMAL(10,2) CHECK (cash_offer_amount >= 0),
    cash_offer_currency VARCHAR(3) DEFAULT 'USD',
    escrow_account_id VARCHAR(255),
    payment_method_id VARCHAR(255),
    
    -- Acceptance/Rejection tracking
    responded_at TIMESTAMP WITH TIME ZONE,
    responded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    
    -- Blockchain tracking
    blockchain_proposal_transaction_id VARCHAR(255),
    blockchain_response_transaction_id VARCHAR(255),
    
    -- Metadata
    message TEXT,
    conditions TEXT[] DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_different_swaps CHECK (source_swap_id != target_swap_id),
    CONSTRAINT check_different_users CHECK (proposer_id != target_user_id),
    CONSTRAINT check_expires_future CHECK (expires_at > NOW()),
    CONSTRAINT check_responded_after_created CHECK (responded_at IS NULL OR responded_at >= created_at),
    CONSTRAINT check_cash_proposal_fields CHECK (
        (proposal_type = 'cash' AND cash_offer_amount IS NOT NULL) OR 
        (proposal_type = 'booking' AND target_swap_id IS NOT NULL)
    ),
    CONSTRAINT check_response_fields CHECK (
        (status IN ('accepted', 'rejected') AND responded_at IS NOT NULL AND responded_by IS NOT NULL) OR
        (status IN ('pending', 'expired'))
    )
);

-- Create proposal_responses table for tracking response details
CREATE TABLE IF NOT EXISTS proposal_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES swap_proposals(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('accept', 'reject')),
    reason TEXT, -- Optional rejection reason
    
    -- Associated transactions
    swap_id UUID REFERENCES swaps(id) ON DELETE SET NULL, -- Created swap if accepted
    payment_transaction_id VARCHAR(255), -- Payment transaction if financial proposal
    blockchain_transaction_id VARCHAR(255) NOT NULL,
    
    -- Metadata
    response_data JSONB, -- Additional response metadata
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_proposal_response UNIQUE (proposal_id),
    CONSTRAINT check_rejection_reason CHECK (
        (action = 'reject' AND reason IS NOT NULL) OR 
        (action = 'accept')
    )
);

-- Create indexes for performance

-- Swap proposals indexes
CREATE INDEX idx_swap_proposals_source_swap ON swap_proposals(source_swap_id);
CREATE INDEX idx_swap_proposals_target_swap ON swap_proposals(target_swap_id);
CREATE INDEX idx_swap_proposals_proposer ON swap_proposals(proposer_id);
CREATE INDEX idx_swap_proposals_target_user ON swap_proposals(target_user_id);
CREATE INDEX idx_swap_proposals_status ON swap_proposals(status);
CREATE INDEX idx_swap_proposals_type ON swap_proposals(proposal_type);
CREATE INDEX idx_swap_proposals_expires ON swap_proposals(expires_at);
CREATE INDEX idx_swap_proposals_created ON swap_proposals(created_at DESC);
CREATE INDEX idx_swap_proposals_blockchain_proposal ON swap_proposals(blockchain_proposal_transaction_id);
CREATE INDEX idx_swap_proposals_blockchain_response ON swap_proposals(blockchain_response_transaction_id);

-- Composite indexes for common queries
CREATE INDEX idx_swap_proposals_proposer_status ON swap_proposals(proposer_id, status);
CREATE INDEX idx_swap_proposals_target_status ON swap_proposals(target_user_id, status);
CREATE INDEX idx_swap_proposals_source_status ON swap_proposals(source_swap_id, status);
CREATE INDEX idx_swap_proposals_type_status ON swap_proposals(proposal_type, status);

-- Partial indexes for active proposals
CREATE INDEX idx_swap_proposals_pending ON swap_proposals(target_user_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX idx_swap_proposals_cash_pending ON swap_proposals(cash_offer_amount DESC) WHERE proposal_type = 'cash' AND status = 'pending';

-- Proposal responses indexes
CREATE INDEX idx_proposal_responses_proposal ON proposal_responses(proposal_id);
CREATE INDEX idx_proposal_responses_responder ON proposal_responses(responder_id);
CREATE INDEX idx_proposal_responses_action ON proposal_responses(action);
CREATE INDEX idx_proposal_responses_swap ON proposal_responses(swap_id);
CREATE INDEX idx_proposal_responses_payment ON proposal_responses(payment_transaction_id);
CREATE INDEX idx_proposal_responses_blockchain ON proposal_responses(blockchain_transaction_id);
CREATE INDEX idx_proposal_responses_created ON proposal_responses(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_proposal_responses_responder_action ON proposal_responses(responder_id, action);
CREATE INDEX idx_proposal_responses_responder_created ON proposal_responses(responder_id, created_at DESC);

-- Create triggers to automatically update updated_at columns
CREATE TRIGGER update_swap_proposals_updated_at 
    BEFORE UPDATE ON swap_proposals 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE swap_proposals IS 'Stores swap proposals that can be accepted or rejected by target users';
COMMENT ON TABLE proposal_responses IS 'Tracks responses (accept/reject) to swap proposals with associated transaction details';

COMMENT ON COLUMN swap_proposals.proposal_type IS 'Type of proposal: booking (swap for another booking) or cash (payment offer)';
COMMENT ON COLUMN swap_proposals.cash_offer_amount IS 'Amount offered for cash proposals';
COMMENT ON COLUMN swap_proposals.escrow_account_id IS 'Escrow account holding funds for cash proposals';
COMMENT ON COLUMN swap_proposals.responded_by IS 'User who responded to the proposal (should match target_user_id)';
COMMENT ON COLUMN swap_proposals.blockchain_proposal_transaction_id IS 'Blockchain transaction ID for proposal creation';
COMMENT ON COLUMN swap_proposals.blockchain_response_transaction_id IS 'Blockchain transaction ID for proposal response';

COMMENT ON COLUMN proposal_responses.action IS 'Response action: accept or reject';
COMMENT ON COLUMN proposal_responses.swap_id IS 'ID of swap created if proposal was accepted';
COMMENT ON COLUMN proposal_responses.payment_transaction_id IS 'Payment transaction ID for financial proposals';
COMMENT ON COLUMN proposal_responses.blockchain_transaction_id IS 'Blockchain transaction ID for the response';
COMMENT ON COLUMN proposal_responses.response_data IS 'Additional metadata about the response';