-- Migration: Create swap targeting tables
-- Created: 2024-12-07
-- Description: Creates tables for swap-to-swap targeting system to prevent multiple swaps per user

-- Create swap_targets table for managing targeting relationships
CREATE TABLE IF NOT EXISTS swap_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_swap_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    target_swap_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_source_swap UNIQUE(source_swap_id), -- One target per source swap
    CONSTRAINT check_different_swaps CHECK (source_swap_id != target_swap_id), -- Prevent self-targeting
    CONSTRAINT check_valid_status CHECK (status IN ('active', 'cancelled', 'accepted', 'rejected'))
);

-- Create swap_targeting_history table for audit trail
CREATE TABLE IF NOT EXISTS swap_targeting_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_swap_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
    target_swap_id UUID REFERENCES swaps(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'targeted', 'retargeted', 'removed', 'accepted', 'rejected', 'cancelled'
    )),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB,
    
    -- Constraints
    CONSTRAINT check_valid_action CHECK (action IN ('targeted', 'retargeted', 'removed', 'accepted', 'rejected', 'cancelled'))
);

-- Add targeting-related columns to existing swaps table
ALTER TABLE swaps ADD COLUMN IF NOT EXISTS is_targeted BOOLEAN DEFAULT FALSE;
ALTER TABLE swaps ADD COLUMN IF NOT EXISTS target_count INTEGER DEFAULT 0;
ALTER TABLE swaps ADD COLUMN IF NOT EXISTS last_targeted_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance

-- swap_targets table indexes
CREATE INDEX idx_swap_targets_source ON swap_targets(source_swap_id);
CREATE INDEX idx_swap_targets_target ON swap_targets(target_swap_id);
CREATE INDEX idx_swap_targets_proposal ON swap_targets(proposal_id);
CREATE INDEX idx_swap_targets_status ON swap_targets(status);
CREATE INDEX idx_swap_targets_created ON swap_targets(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_swap_targets_target_status ON swap_targets(target_swap_id, status);
CREATE INDEX idx_swap_targets_source_status ON swap_targets(source_swap_id, status);

-- swap_targeting_history table indexes
CREATE INDEX idx_swap_targeting_history_source ON swap_targeting_history(source_swap_id);
CREATE INDEX idx_swap_targeting_history_target ON swap_targeting_history(target_swap_id) WHERE target_swap_id IS NOT NULL;
CREATE INDEX idx_swap_targeting_history_action ON swap_targeting_history(action);
CREATE INDEX idx_swap_targeting_history_timestamp ON swap_targeting_history(timestamp DESC);

-- Composite indexes for audit queries
CREATE INDEX idx_swap_targeting_history_source_timestamp ON swap_targeting_history(source_swap_id, timestamp DESC);
CREATE INDEX idx_swap_targeting_history_source_action ON swap_targeting_history(source_swap_id, action);

-- Enhanced swaps table indexes for targeting
CREATE INDEX IF NOT EXISTS idx_swaps_is_targeted ON swaps(is_targeted) WHERE is_targeted = true;
CREATE INDEX IF NOT EXISTS idx_swaps_target_count ON swaps(target_count) WHERE target_count > 0;
CREATE INDEX IF NOT EXISTS idx_swaps_last_targeted ON swaps(last_targeted_at DESC) WHERE last_targeted_at IS NOT NULL;

-- Composite indexes for targeting queries
CREATE INDEX IF NOT EXISTS idx_swaps_targeted_status ON swaps(is_targeted, status) WHERE is_targeted = true;
CREATE INDEX IF NOT EXISTS idx_swaps_owner_targeted ON swaps(owner_id, is_targeted) WHERE is_targeted = true;

-- Create triggers to automatically update updated_at columns
CREATE TRIGGER update_swap_targets_updated_at 
    BEFORE UPDATE ON swap_targets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to update targeting statistics on swaps table
CREATE OR REPLACE FUNCTION update_swap_targeting_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update target count and targeting status for the target swap
    IF TG_OP = 'INSERT' THEN
        -- Increment target count and set targeting flags
        UPDATE swaps 
        SET 
            target_count = target_count + 1,
            is_targeted = true,
            last_targeted_at = NOW(),
            updated_at = NOW()
        WHERE id = NEW.target_swap_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement target count and update targeting flags
        UPDATE swaps 
        SET 
            target_count = GREATEST(target_count - 1, 0),
            is_targeted = CASE 
                WHEN target_count - 1 <= 0 THEN false 
                ELSE true 
            END,
            updated_at = NOW()
        WHERE id = OLD.target_swap_id;
        
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle status changes
        IF OLD.status = 'active' AND NEW.status != 'active' THEN
            -- Targeting became inactive, decrement count
            UPDATE swaps 
            SET 
                target_count = GREATEST(target_count - 1, 0),
                is_targeted = CASE 
                    WHEN target_count - 1 <= 0 THEN false 
                    ELSE true 
                END,
                updated_at = NOW()
            WHERE id = OLD.target_swap_id;
        ELSIF OLD.status != 'active' AND NEW.status = 'active' THEN
            -- Targeting became active, increment count
            UPDATE swaps 
            SET 
                target_count = target_count + 1,
                is_targeted = true,
                last_targeted_at = NOW(),
                updated_at = NOW()
            WHERE id = NEW.target_swap_id;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update targeting statistics
CREATE TRIGGER update_targeting_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON swap_targets
    FOR EACH ROW
    EXECUTE FUNCTION update_swap_targeting_stats();

-- Create function to prevent circular targeting
CREATE OR REPLACE FUNCTION prevent_circular_targeting()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the target swap is already targeting the source swap (direct circular)
    IF EXISTS (
        SELECT 1 FROM swap_targets 
        WHERE source_swap_id = NEW.target_swap_id 
        AND target_swap_id = NEW.source_swap_id 
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Circular targeting detected: target swap is already targeting source swap';
    END IF;
    
    -- Check for indirect circular targeting (A->B->A)
    -- This is a simplified check; for more complex chains, a recursive CTE would be needed
    IF EXISTS (
        WITH RECURSIVE targeting_chain AS (
            -- Base case: direct targets of the new target
            SELECT target_swap_id as chain_target, 1 as depth
            FROM swap_targets 
            WHERE source_swap_id = NEW.target_swap_id 
            AND status = 'active'
            
            UNION ALL
            
            -- Recursive case: follow the chain
            SELECT st.target_swap_id, tc.depth + 1
            FROM swap_targets st
            JOIN targeting_chain tc ON st.source_swap_id = tc.chain_target
            WHERE st.status = 'active' 
            AND tc.depth < 5  -- Limit recursion depth
        )
        SELECT 1 FROM targeting_chain 
        WHERE chain_target = NEW.source_swap_id
    ) THEN
        RAISE EXCEPTION 'Circular targeting detected: would create targeting loop';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent circular targeting
CREATE TRIGGER prevent_circular_targeting_trigger
    BEFORE INSERT OR UPDATE ON swap_targets
    FOR EACH ROW
    EXECUTE FUNCTION prevent_circular_targeting();

-- Add comments for documentation
COMMENT ON TABLE swap_targets IS 'Manages targeting relationships between swaps for the swap-to-swap targeting system';
COMMENT ON TABLE swap_targeting_history IS 'Audit trail for all targeting actions and status changes';

COMMENT ON COLUMN swap_targets.source_swap_id IS 'The swap that is doing the targeting';
COMMENT ON COLUMN swap_targets.target_swap_id IS 'The swap being targeted';
COMMENT ON COLUMN swap_targets.proposal_id IS 'The proposal created from this targeting relationship';
COMMENT ON COLUMN swap_targets.status IS 'Current status of the targeting relationship';

COMMENT ON COLUMN swap_targeting_history.action IS 'Type of targeting action that occurred';
COMMENT ON COLUMN swap_targeting_history.metadata IS 'Additional data related to the targeting action';

COMMENT ON COLUMN swaps.is_targeted IS 'Whether this swap is currently being targeted by other swaps';
COMMENT ON COLUMN swaps.target_count IS 'Number of active targeting relationships for this swap';
COMMENT ON COLUMN swaps.last_targeted_at IS 'Timestamp of the most recent targeting action';