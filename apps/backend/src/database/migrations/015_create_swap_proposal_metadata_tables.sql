-- Migration: Create swap proposal metadata tracking tables
-- Created: 2024-12-07
-- Description: Creates tables for tracking browse-initiated proposals, compatibility scores, and proposal history

-- Create swap_compatibility_scores table for caching compatibility analysis
CREATE TABLE IF NOT EXISTS swap_compatibility_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_swap_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    target_swap_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    analysis JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_different_swaps CHECK (source_swap_id != target_swap_id),
    CONSTRAINT unique_swap_pair UNIQUE (source_swap_id, target_swap_id)
);

-- Create swap_proposal_metadata table for tracking browse-initiated proposals
CREATE TABLE IF NOT EXISTS swap_proposal_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    source_swap_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    target_swap_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    proposer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    compatibility_score DECIMAL(5,2) CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
    created_from_browse BOOLEAN NOT NULL DEFAULT true,
    proposal_source VARCHAR(20) NOT NULL DEFAULT 'browse' CHECK (proposal_source IN ('browse', 'direct', 'auction')),
    blockchain_transaction_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_different_proposal_swaps CHECK (source_swap_id != target_swap_id),
    CONSTRAINT check_different_proposal_users CHECK (proposer_id != target_owner_id),
    CONSTRAINT unique_proposal_metadata UNIQUE (proposal_id)
);

-- Create swap_proposal_history table for tracking proposal lifecycle events
CREATE TABLE IF NOT EXISTS swap_proposal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'proposal_created', 'proposal_viewed', 'proposal_accepted', 
        'proposal_rejected', 'proposal_expired', 'proposal_withdrawn',
        'compatibility_analyzed', 'notification_sent'
    )),
    event_data JSONB,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_event_data_not_null CHECK (event_data IS NOT NULL)
);

-- Create indexes for performance

-- Compatibility scores indexes
CREATE INDEX idx_swap_compatibility_scores_source ON swap_compatibility_scores(source_swap_id);
CREATE INDEX idx_swap_compatibility_scores_target ON swap_compatibility_scores(target_swap_id);
CREATE INDEX idx_swap_compatibility_scores_score ON swap_compatibility_scores(score DESC);
CREATE INDEX idx_swap_compatibility_scores_updated ON swap_compatibility_scores(updated_at DESC);

-- Proposal metadata indexes
CREATE INDEX idx_swap_proposal_metadata_proposal ON swap_proposal_metadata(proposal_id);
CREATE INDEX idx_swap_proposal_metadata_source ON swap_proposal_metadata(source_swap_id);
CREATE INDEX idx_swap_proposal_metadata_target ON swap_proposal_metadata(target_swap_id);
CREATE INDEX idx_swap_proposal_metadata_proposer ON swap_proposal_metadata(proposer_id);
CREATE INDEX idx_swap_proposal_metadata_owner ON swap_proposal_metadata(target_owner_id);
CREATE INDEX idx_swap_proposal_metadata_source_type ON swap_proposal_metadata(proposal_source);
CREATE INDEX idx_swap_proposal_metadata_browse ON swap_proposal_metadata(created_from_browse) WHERE created_from_browse = true;
CREATE INDEX idx_swap_proposal_metadata_compatibility ON swap_proposal_metadata(compatibility_score DESC) WHERE compatibility_score IS NOT NULL;
CREATE INDEX idx_swap_proposal_metadata_blockchain ON swap_proposal_metadata(blockchain_transaction_id);

-- Proposal history indexes
CREATE INDEX idx_swap_proposal_history_proposal ON swap_proposal_history(proposal_id);
CREATE INDEX idx_swap_proposal_history_event_type ON swap_proposal_history(event_type);
CREATE INDEX idx_swap_proposal_history_user ON swap_proposal_history(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_swap_proposal_history_created ON swap_proposal_history(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_swap_proposal_metadata_proposer_created ON swap_proposal_metadata(proposer_id, created_at DESC);
CREATE INDEX idx_swap_proposal_metadata_owner_created ON swap_proposal_metadata(target_owner_id, created_at DESC);
CREATE INDEX idx_swap_proposal_history_proposal_event ON swap_proposal_history(proposal_id, event_type);
CREATE INDEX idx_swap_proposal_history_proposal_created ON swap_proposal_history(proposal_id, created_at DESC);

-- Create triggers to automatically update updated_at columns
CREATE TRIGGER update_swap_compatibility_scores_updated_at 
    BEFORE UPDATE ON swap_compatibility_scores 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swap_proposal_metadata_updated_at 
    BEFORE UPDATE ON swap_proposal_metadata 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE swap_compatibility_scores IS 'Caches compatibility analysis results between swap pairs for performance optimization';
COMMENT ON TABLE swap_proposal_metadata IS 'Stores metadata for browse-initiated proposals including compatibility scores and source tracking';
COMMENT ON TABLE swap_proposal_history IS 'Tracks all lifecycle events for swap proposals for audit and analytics purposes';

COMMENT ON COLUMN swap_compatibility_scores.score IS 'Compatibility score from 0-100, higher scores indicate better compatibility';
COMMENT ON COLUMN swap_compatibility_scores.analysis IS 'Full compatibility analysis result including factor breakdowns and recommendations';
COMMENT ON COLUMN swap_proposal_metadata.created_from_browse IS 'Indicates if the proposal was created from the browse page interface';
COMMENT ON COLUMN swap_proposal_metadata.proposal_source IS 'Source of the proposal: browse (browse page), direct (direct message), auction (auction system)';
COMMENT ON COLUMN swap_proposal_history.event_type IS 'Type of event that occurred in the proposal lifecycle';
COMMENT ON COLUMN swap_proposal_history.event_data IS 'Additional data related to the event, structure varies by event type';