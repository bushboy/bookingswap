-- Migration: Add swap completion tracking columns and audit table
-- Created: 2024-12-07
-- Description: Adds completion tracking fields to swaps and bookings tables, creates swap completion audit table

-- Add completion tracking columns to swaps table
ALTER TABLE swaps ADD COLUMN IF NOT EXISTS completion_transaction_id VARCHAR(255);
ALTER TABLE swaps ADD COLUMN IF NOT EXISTS related_swap_completions TEXT[] DEFAULT '{}';
ALTER TABLE swaps ADD COLUMN IF NOT EXISTS blockchain_completion_id VARCHAR(255);
ALTER TABLE swaps ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add completion tracking columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS swapped_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS swap_transaction_id VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS swap_completion_id VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS related_booking_swaps TEXT[] DEFAULT '{}';

-- Add completion audit ID to swap proposals table
ALTER TABLE swap_proposals ADD COLUMN IF NOT EXISTS completion_audit_id UUID;

-- Create swap completion audit table
CREATE TABLE IF NOT EXISTS swap_completion_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES swap_proposals(id) ON DELETE CASCADE,
    completion_type VARCHAR(20) NOT NULL CHECK (completion_type IN ('booking_exchange', 'cash_payment')),
    initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Entities involved
    affected_swaps TEXT[] NOT NULL DEFAULT '{}',
    affected_bookings TEXT[] NOT NULL DEFAULT '{}',
    
    -- Transaction details
    database_transaction_id VARCHAR(255) NOT NULL,
    blockchain_transaction_id VARCHAR(255),
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'completed', 'failed', 'rolled_back')),
    error_details TEXT,
    
    -- Validation results (stored as JSONB for flexibility)
    pre_validation_result JSONB,
    post_validation_result JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for completion tracking

-- Swaps completion indexes
CREATE INDEX IF NOT EXISTS idx_swaps_completion_transaction ON swaps(completion_transaction_id);
CREATE INDEX IF NOT EXISTS idx_swaps_blockchain_completion ON swaps(blockchain_completion_id);
CREATE INDEX IF NOT EXISTS idx_swaps_completed_by ON swaps(completed_by);
CREATE INDEX IF NOT EXISTS idx_swaps_completed_at ON swaps(completed_at);

-- Bookings completion indexes
CREATE INDEX IF NOT EXISTS idx_bookings_swapped_at ON bookings(swapped_at);
CREATE INDEX IF NOT EXISTS idx_bookings_swap_transaction ON bookings(swap_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bookings_original_owner ON bookings(original_owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_swap_completion ON bookings(swap_completion_id);

-- Swap proposals completion index
CREATE INDEX IF NOT EXISTS idx_swap_proposals_completion_audit ON swap_proposals(completion_audit_id);

-- Swap completion audits indexes
CREATE INDEX IF NOT EXISTS idx_completion_audits_proposal ON swap_completion_audits(proposal_id);
CREATE INDEX IF NOT EXISTS idx_completion_audits_initiated_by ON swap_completion_audits(initiated_by);
CREATE INDEX IF NOT EXISTS idx_completion_audits_status ON swap_completion_audits(status);
CREATE INDEX IF NOT EXISTS idx_completion_audits_type ON swap_completion_audits(completion_type);
CREATE INDEX IF NOT EXISTS idx_completion_audits_completed_at ON swap_completion_audits(completed_at);
CREATE INDEX IF NOT EXISTS idx_completion_audits_blockchain ON swap_completion_audits(blockchain_transaction_id);
CREATE INDEX IF NOT EXISTS idx_completion_audits_database_tx ON swap_completion_audits(database_transaction_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_completion_audits_status_type ON swap_completion_audits(status, completion_type);
CREATE INDEX IF NOT EXISTS idx_completion_audits_initiated_status ON swap_completion_audits(initiated_by, status);

-- GIN indexes for array columns
CREATE INDEX IF NOT EXISTS idx_swaps_related_completions_gin ON swaps USING gin(related_swap_completions);
CREATE INDEX IF NOT EXISTS idx_bookings_related_swaps_gin ON bookings USING gin(related_booking_swaps);
CREATE INDEX IF NOT EXISTS idx_completion_audits_affected_swaps_gin ON swap_completion_audits USING gin(affected_swaps);
CREATE INDEX IF NOT EXISTS idx_completion_audits_affected_bookings_gin ON swap_completion_audits USING gin(affected_bookings);

-- Create trigger to automatically update updated_at for completion audits
CREATE TRIGGER update_swap_completion_audits_updated_at 
    BEFORE UPDATE ON swap_completion_audits 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraint for completion audit reference in swap proposals
ALTER TABLE swap_proposals ADD CONSTRAINT fk_swap_proposals_completion_audit 
    FOREIGN KEY (completion_audit_id) REFERENCES swap_completion_audits(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON COLUMN swaps.completion_transaction_id IS 'Database transaction ID used for atomic completion updates';
COMMENT ON COLUMN swaps.related_swap_completions IS 'Array of other swap IDs completed in the same transaction';
COMMENT ON COLUMN swaps.blockchain_completion_id IS 'Blockchain transaction ID for completion record';
COMMENT ON COLUMN swaps.completed_by IS 'User who initiated the completion workflow';

COMMENT ON COLUMN bookings.swapped_at IS 'Timestamp when booking was marked as swapped';
COMMENT ON COLUMN bookings.swap_transaction_id IS 'Transaction ID of the swap completion that affected this booking';
COMMENT ON COLUMN bookings.original_owner_id IS 'Original owner before swap (for ownership transfer tracking)';
COMMENT ON COLUMN bookings.swap_completion_id IS 'Completion audit ID for tracking';
COMMENT ON COLUMN bookings.related_booking_swaps IS 'Array of other booking IDs swapped in the same transaction';

COMMENT ON TABLE swap_completion_audits IS 'Audit trail for swap completion operations with validation results';
COMMENT ON COLUMN swap_completion_audits.completion_type IS 'Type of completion: booking_exchange or cash_payment';
COMMENT ON COLUMN swap_completion_audits.affected_swaps IS 'Array of swap IDs affected by this completion';
COMMENT ON COLUMN swap_completion_audits.affected_bookings IS 'Array of booking IDs affected by this completion';
COMMENT ON COLUMN swap_completion_audits.database_transaction_id IS 'Database transaction ID for atomic operations';
COMMENT ON COLUMN swap_completion_audits.pre_validation_result IS 'JSON validation results before completion';
COMMENT ON COLUMN swap_completion_audits.post_validation_result IS 'JSON validation results after completion';