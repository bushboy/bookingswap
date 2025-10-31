-- Migration: Update payment_transactions schema for foreign key fix
-- Created: 2024-12-07
-- Description: Ensures proper foreign key constraints and adds metadata columns for payment transactions

-- Ensure proposal_id allows NULL values (should already be the case, but making it explicit)
-- This is critical for direct swap scenarios where no auction proposal exists
ALTER TABLE payment_transactions 
ALTER COLUMN proposal_id DROP NOT NULL;

-- Add comment to clarify the nullable proposal_id behavior
COMMENT ON COLUMN payment_transactions.proposal_id IS 'References auction_proposals.id for auction-based swaps. NULL for direct swaps without auction proposals.';

-- Verify and document all foreign key constraints
-- These should already exist from previous migrations, but we document them here for clarity

-- Ensure swap_id foreign key constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payment_transactions_swap_id_fkey' 
        AND table_name = 'payment_transactions'
    ) THEN
        ALTER TABLE payment_transactions 
        ADD CONSTRAINT payment_transactions_swap_id_fkey 
        FOREIGN KEY (swap_id) REFERENCES swaps(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure proposal_id foreign key constraint exists (nullable)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payment_transactions_proposal_id_fkey' 
        AND table_name = 'payment_transactions'
    ) THEN
        ALTER TABLE payment_transactions 
        ADD CONSTRAINT payment_transactions_proposal_id_fkey 
        FOREIGN KEY (proposal_id) REFERENCES auction_proposals(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure payer_id foreign key constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payment_transactions_payer_id_fkey' 
        AND table_name = 'payment_transactions'
    ) THEN
        ALTER TABLE payment_transactions 
        ADD CONSTRAINT payment_transactions_payer_id_fkey 
        FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure recipient_id foreign key constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payment_transactions_recipient_id_fkey' 
        AND table_name = 'payment_transactions'
    ) THEN
        ALTER TABLE payment_transactions 
        ADD CONSTRAINT payment_transactions_recipient_id_fkey 
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add metadata columns for tracking offer mode and validation details
-- These columns support debugging and auditing as required by the design

-- Add offer_mode column to track auction vs direct swap scenarios
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS offer_mode VARCHAR(20) CHECK (offer_mode IN ('auction', 'direct')) DEFAULT 'direct';

-- Add validation_metadata column for debugging and auditing
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS validation_metadata JSONB DEFAULT '{}';

-- Add created_via column to track how the transaction was created
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS created_via VARCHAR(30) CHECK (created_via IN ('auction_proposal', 'direct_cash_offer', 'booking_exchange')) DEFAULT 'direct_cash_offer';

-- Update the status enum to include 'rolled_back' status
ALTER TABLE payment_transactions 
DROP CONSTRAINT IF EXISTS payment_transactions_status_check;

ALTER TABLE payment_transactions 
ADD CONSTRAINT payment_transactions_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'rolled_back'));

-- Add indexes for the new columns to support efficient queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_offer_mode ON payment_transactions(offer_mode);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_via ON payment_transactions(created_via);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_validation_metadata ON payment_transactions USING GIN (validation_metadata);

-- Add composite index for common validation queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_mode_status ON payment_transactions(offer_mode, status);

-- Add comments for the new columns
COMMENT ON COLUMN payment_transactions.offer_mode IS 'Tracks whether this transaction was created for an auction-based swap or direct swap. Values: auction, direct';
COMMENT ON COLUMN payment_transactions.validation_metadata IS 'JSON metadata for debugging and auditing validation results, rollback information, and transaction context';
COMMENT ON COLUMN payment_transactions.created_via IS 'Tracks the method used to create this transaction. Values: auction_proposal, direct_cash_offer, booking_exchange';

-- Add constraint to ensure consistency between offer_mode and proposal_id
ALTER TABLE payment_transactions 
ADD CONSTRAINT check_offer_mode_proposal_consistency 
CHECK (
    (offer_mode = 'auction' AND proposal_id IS NOT NULL) OR
    (offer_mode = 'direct' AND proposal_id IS NULL)
);

-- Update table comment to reflect the enhanced schema
COMMENT ON TABLE payment_transactions IS 'Tracks all payment transactions for swap offers. Supports both auction-based swaps (with proposal_id) and direct swaps (proposal_id NULL). Includes metadata for validation tracking and debugging.';