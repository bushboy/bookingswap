-- Migration: Optimize foreign key validation indexes
-- Created: 2024-12-07
-- Description: Adds optimized indexes for the single-query foreign key validation method

-- Additional composite indexes for optimized foreign key validation queries

-- Optimize payment_transactions foreign key lookups
-- This index helps with NULL proposal_id queries (direct swaps)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_proposal_null 
ON payment_transactions(swap_id, payer_id, recipient_id) 
WHERE proposal_id IS NULL;

-- This index helps with non-NULL proposal_id queries (auction swaps)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_proposal_not_null 
ON payment_transactions(swap_id, proposal_id, payer_id, recipient_id) 
WHERE proposal_id IS NOT NULL;

-- Optimize auction_proposals with swap relationship lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auction_proposals_swap_relationship 
ON auction_proposals(id, auction_id) 
WHERE status != 'deleted';

-- Optimize swap_auctions for active auction lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_swap_auctions_active_by_swap 
ON swap_auctions(swap_id, id, status) 
WHERE status = 'active';

-- Optimize swaps table for validation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_swaps_validation_lookup 
ON swaps(id, status, acceptance_strategy, payment_types, owner_id) 
WHERE status NOT IN ('deleted', 'completed', 'cancelled');

-- Optimize users table for payer/recipient validation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_validation 
ON users(id) 
WHERE status != 'deleted';

-- Composite index for the complex validation query joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auction_proposals_full_validation 
ON auction_proposals(id, status, auction_id) 
WHERE status != 'deleted';

-- Index for swap auction relationship validation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_swap_auctions_proposal_validation 
ON swap_auctions(id, swap_id, status);

-- Partial index for payment_transactions foreign key constraint validation
-- This helps quickly identify constraint violations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_constraint_check 
ON payment_transactions(proposal_id, swap_id, payer_id, recipient_id) 
WHERE status IN ('pending', 'processing');

-- Index to optimize the single validation query's LEFT JOINs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auction_proposals_by_id_with_auction 
ON auction_proposals(id, auction_id, status) 
WHERE status != 'deleted';

-- Performance monitoring indexes
-- These help identify slow foreign key validation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_created_for_monitoring 
ON payment_transactions(created_at, swap_id, proposal_id) 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Add comments for documentation
COMMENT ON INDEX idx_payment_transactions_proposal_null IS 'Optimizes direct swap payment transaction validation queries';
COMMENT ON INDEX idx_payment_transactions_proposal_not_null IS 'Optimizes auction swap payment transaction validation queries';
COMMENT ON INDEX idx_auction_proposals_swap_relationship IS 'Optimizes proposal-swap relationship validation';
COMMENT ON INDEX idx_swap_auctions_active_by_swap IS 'Optimizes active auction lookup for validation';
COMMENT ON INDEX idx_swaps_validation_lookup IS 'Optimizes swap existence and status validation';
COMMENT ON INDEX idx_users_active_validation IS 'Optimizes user existence validation for payer/recipient';
COMMENT ON INDEX idx_auction_proposals_full_validation IS 'Optimizes auction proposal validation queries';
COMMENT ON INDEX idx_swap_auctions_proposal_validation IS 'Optimizes swap auction relationship validation';
COMMENT ON INDEX idx_payment_transactions_constraint_check IS 'Helps identify foreign key constraint violations quickly';
COMMENT ON INDEX idx_auction_proposals_by_id_with_auction IS 'Optimizes proposal lookup with auction relationship';
COMMENT ON INDEX idx_payment_transactions_created_for_monitoring IS 'Helps monitor recent payment transaction creation performance';