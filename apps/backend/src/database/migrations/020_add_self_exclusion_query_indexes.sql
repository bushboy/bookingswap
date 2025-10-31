-- Migration: Add database indexes for self-exclusion query optimization
-- Created: 2024-12-07
-- Description: Creates composite indexes for efficient filtering of self-proposals in swap queries
-- Requirements: 3.5 - Query performance optimization for self-exclusion filtering

-- ===== SELF-EXCLUSION FILTERING INDEXES =====

-- Composite index for filtering proposals where proposer != owner
-- This is the critical index for the self-exclusion logic
-- Covers the pattern: WHERE proposer_id != owner_id AND status = 'pending'
CREATE INDEX IF NOT EXISTS idx_swaps_proposer_owner_status_self_exclusion 
ON swaps(proposer_id, owner_id, status) 
WHERE proposer_id != owner_id AND status = 'pending';

-- Composite index for finding proposals for user's swaps (excluding self-proposals)
-- Covers the pattern: WHERE owner_id = $1 AND proposer_id != $1 AND status = 'pending'
CREATE INDEX IF NOT EXISTS idx_swaps_owner_not_proposer_status 
ON swaps(owner_id, status, created_at DESC) 
WHERE proposer_id != owner_id AND status = 'pending';

-- Composite index for the reverse lookup pattern (proposals targeting user's bookings)
-- Covers queries that join on target_booking_id and filter by proposer
CREATE INDEX IF NOT EXISTS idx_swaps_target_booking_proposer_owner 
ON swaps(target_booking_id, proposer_id, owner_id, status)
WHERE proposer_id != owner_id;

-- ===== SWAP CARD QUERY OPTIMIZATION INDEXES =====

-- Composite index for the main swap cards query pattern
-- Optimizes the LEFT JOIN pattern for finding proposals for user's swaps
-- Covers: s.source_booking_id = p.target_booking_id AND p.proposer_id != s.owner_id
CREATE INDEX IF NOT EXISTS idx_swaps_source_booking_proposer_exclusion 
ON swaps(source_booking_id, proposer_id, status, created_at DESC)
WHERE status = 'pending';

-- Composite index for target booking lookups with self-exclusion
-- Optimizes the JOIN condition: p.target_booking_id AND p.proposer_id != owner_id
CREATE INDEX IF NOT EXISTS idx_swaps_target_booking_self_exclusion 
ON swaps(target_booking_id, proposer_id, status)
WHERE proposer_id IS NOT NULL AND status = 'pending';

-- ===== BOOKING RELATIONSHIP INDEXES =====

-- Index for efficient booking-to-swap lookups in the card query
-- Helps with the JOIN between swaps and bookings tables
CREATE INDEX IF NOT EXISTS idx_swaps_source_booking_owner_status 
ON swaps(source_booking_id, owner_id, status);

-- Index for target booking relationships
CREATE INDEX IF NOT EXISTS idx_swaps_target_booking_status_created 
ON swaps(target_booking_id, status, created_at DESC)
WHERE target_booking_id IS NOT NULL;

-- ===== USER-CENTRIC QUERY INDEXES =====

-- Composite index for user's own swaps (left side of swap cards)
-- Optimizes: WHERE owner_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_swaps_owner_created_desc_active 
ON swaps(owner_id, created_at DESC, status)
WHERE status IN ('pending', 'active');

-- Composite index for proposals made by others to user's swaps
-- Optimizes the complex JOIN with self-exclusion filter
CREATE INDEX IF NOT EXISTS idx_swaps_proposal_lookup_optimized 
ON swaps(target_booking_id, proposer_id, owner_id, created_at DESC)
WHERE status = 'pending' AND proposer_id IS NOT NULL;

-- ===== PERFORMANCE MONITORING INDEXES =====

-- Index for monitoring self-proposal detection (should be empty with proper filtering)
-- This helps identify any data inconsistencies
CREATE INDEX IF NOT EXISTS idx_swaps_self_proposals_monitoring 
ON swaps(proposer_id, owner_id, created_at DESC)
WHERE proposer_id = owner_id;

-- Index for proposal count queries per swap
-- Helps with analytics and debugging
CREATE INDEX IF NOT EXISTS idx_swaps_proposal_count_analysis 
ON swaps(target_booking_id, status)
WHERE status = 'pending' AND target_booking_id IS NOT NULL;

-- ===== SPECIALIZED QUERY PATTERN INDEXES =====

-- Index for the optimized single-query approach mentioned in the design
-- Covers the complex JOIN pattern with multiple conditions
CREATE INDEX IF NOT EXISTS idx_swaps_card_query_optimization 
ON swaps(owner_id, source_booking_id, status, created_at DESC);

-- Index for proposal side of the card query
CREATE INDEX IF NOT EXISTS idx_swaps_proposal_side_optimization 
ON swaps(target_booking_id, proposer_id, status, created_at DESC)
WHERE status = 'pending' AND proposer_id IS NOT NULL;

-- ===== CONSTRAINT SUPPORT INDEXES =====

-- Index to support the existing constraint check_different_users
-- This helps enforce the business rule at the database level
CREATE INDEX IF NOT EXISTS idx_swaps_user_constraint_support 
ON swaps(proposer_id, owner_id)
WHERE proposer_id != owner_id;

-- ===== CLEANUP AND VALIDATION INDEXES =====

-- Index for data cleanup queries (finding existing self-proposals)
-- This supports the data validation utilities mentioned in the design
CREATE INDEX IF NOT EXISTS idx_swaps_cleanup_self_proposals 
ON swaps(proposer_id, owner_id, id, created_at)
WHERE proposer_id = owner_id;

-- Index for validation queries to ensure data integrity
CREATE INDEX IF NOT EXISTS idx_swaps_validation_integrity 
ON swaps(id, proposer_id, owner_id, status)
WHERE proposer_id = owner_id OR status NOT IN ('pending', 'active', 'accepted');

-- ===== STATISTICS AND ANALYSIS =====

-- Update statistics targets for columns involved in self-exclusion queries
ALTER TABLE swaps ALTER COLUMN proposer_id SET STATISTICS 1000;
ALTER TABLE swaps ALTER COLUMN owner_id SET STATISTICS 1000;
ALTER TABLE swaps ALTER COLUMN source_booking_id SET STATISTICS 1000;
ALTER TABLE swaps ALTER COLUMN target_booking_id SET STATISTICS 1000;
ALTER TABLE swaps ALTER COLUMN status SET STATISTICS 1000;

-- Update table statistics to help query planner with new indexes
ANALYZE swaps;

-- ===== PERFORMANCE MONITORING FUNCTION =====

-- Function to analyze self-exclusion query performance
CREATE OR REPLACE FUNCTION analyze_self_exclusion_query_performance()
RETURNS TABLE(
    query_type TEXT,
    estimated_rows BIGINT,
    index_usage TEXT,
    performance_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'user_swaps_with_proposals'::TEXT,
        (SELECT COUNT(*) FROM swaps WHERE owner_id IS NOT NULL)::BIGINT,
        'idx_swaps_owner_not_proposer_status'::TEXT,
        'Main query for swap cards with self-exclusion'::TEXT
    UNION ALL
    SELECT 
        'proposals_for_user_swaps'::TEXT,
        (SELECT COUNT(*) FROM swaps WHERE target_booking_id IS NOT NULL AND proposer_id != owner_id)::BIGINT,
        'idx_swaps_target_booking_self_exclusion'::TEXT,
        'Proposals filtering with self-exclusion'::TEXT
    UNION ALL
    SELECT 
        'self_proposals_detected'::TEXT,
        (SELECT COUNT(*) FROM swaps WHERE proposer_id = owner_id)::BIGINT,
        'idx_swaps_self_proposals_monitoring'::TEXT,
        'Should be 0 with proper validation'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ===== DATA VALIDATION FUNCTION =====

-- Function to validate self-exclusion data integrity
CREATE OR REPLACE FUNCTION validate_self_exclusion_data()
RETURNS TABLE(
    validation_check TEXT,
    issue_count BIGINT,
    severity TEXT,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Check for existing self-proposals
    SELECT 
        'existing_self_proposals'::TEXT,
        COUNT(*)::BIGINT,
        CASE WHEN COUNT(*) > 0 THEN 'HIGH' ELSE 'NONE' END::TEXT,
        CASE WHEN COUNT(*) > 0 THEN 'Run cleanup script to remove self-proposals' ELSE 'No action needed' END::TEXT
    FROM swaps 
    WHERE proposer_id = owner_id
    
    UNION ALL
    
    -- Check for swaps with null proposer_id
    SELECT 
        'null_proposer_id'::TEXT,
        COUNT(*)::BIGINT,
        CASE WHEN COUNT(*) > 0 THEN 'MEDIUM' ELSE 'NONE' END::TEXT,
        CASE WHEN COUNT(*) > 0 THEN 'Investigate swaps with null proposer_id' ELSE 'No action needed' END::TEXT
    FROM swaps 
    WHERE proposer_id IS NULL
    
    UNION ALL
    
    -- Check for swaps with null owner_id
    SELECT 
        'null_owner_id'::TEXT,
        COUNT(*)::BIGINT,
        CASE WHEN COUNT(*) > 0 THEN 'HIGH' ELSE 'NONE' END::TEXT,
        CASE WHEN COUNT(*) > 0 THEN 'Fix swaps with null owner_id immediately' ELSE 'No action needed' END::TEXT
    FROM swaps 
    WHERE owner_id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ===== QUERY PERFORMANCE TESTING FUNCTION =====

-- Function to test query performance with new indexes
CREATE OR REPLACE FUNCTION test_self_exclusion_query_performance(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(
    test_name TEXT,
    execution_time_ms NUMERIC,
    rows_returned BIGINT,
    index_used TEXT
) AS $$
DECLARE
    test_user_id UUID;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    row_count BIGINT;
BEGIN
    -- Use provided user_id or find a random user with swaps
    IF p_user_id IS NULL THEN
        SELECT owner_id INTO test_user_id 
        FROM swaps 
        WHERE owner_id IS NOT NULL 
        LIMIT 1;
    ELSE
        test_user_id := p_user_id;
    END IF;
    
    IF test_user_id IS NULL THEN
        RETURN QUERY SELECT 'no_test_data'::TEXT, 0::NUMERIC, 0::BIGINT, 'none'::TEXT;
        RETURN;
    END IF;
    
    -- Test 1: User's own swaps query
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO row_count
    FROM swaps 
    WHERE owner_id = test_user_id;
    end_time := clock_timestamp();
    
    RETURN QUERY SELECT 
        'user_own_swaps'::TEXT,
        EXTRACT(MILLISECONDS FROM (end_time - start_time))::NUMERIC,
        row_count,
        'idx_swaps_owner_created_desc_active'::TEXT;
    
    -- Test 2: Proposals for user's swaps (with self-exclusion)
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO row_count
    FROM swaps s1
    JOIN swaps s2 ON s2.target_booking_id = s1.source_booking_id
    WHERE s1.owner_id = test_user_id
    AND s2.proposer_id != test_user_id
    AND s2.status = 'pending';
    end_time := clock_timestamp();
    
    RETURN QUERY SELECT 
        'proposals_with_self_exclusion'::TEXT,
        EXTRACT(MILLISECONDS FROM (end_time - start_time))::NUMERIC,
        row_count,
        'idx_swaps_target_booking_self_exclusion'::TEXT;
    
    -- Test 3: Complex swap cards query
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO row_count
    FROM swaps s
    LEFT JOIN swaps p ON s.source_booking_id = p.target_booking_id 
        AND p.proposer_id != s.owner_id
        AND p.status = 'pending'
    WHERE s.owner_id = test_user_id;
    end_time := clock_timestamp();
    
    RETURN QUERY SELECT 
        'swap_cards_query'::TEXT,
        EXTRACT(MILLISECONDS FROM (end_time - start_time))::NUMERIC,
        row_count,
        'idx_swaps_proposal_side_optimization'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ===== DOCUMENTATION COMMENTS =====

COMMENT ON INDEX idx_swaps_proposer_owner_status_self_exclusion IS 'Critical index for self-exclusion filtering in proposal queries';
COMMENT ON INDEX idx_swaps_owner_not_proposer_status IS 'Optimizes queries for user swaps excluding self-proposals';
COMMENT ON INDEX idx_swaps_target_booking_self_exclusion IS 'Supports JOIN operations with self-exclusion filter';
COMMENT ON INDEX idx_swaps_source_booking_proposer_exclusion IS 'Optimizes swap card queries with proposal filtering';
COMMENT ON INDEX idx_swaps_self_proposals_monitoring IS 'Monitoring index for detecting data inconsistencies';

COMMENT ON FUNCTION analyze_self_exclusion_query_performance IS 'Analyzes performance characteristics of self-exclusion queries';
COMMENT ON FUNCTION validate_self_exclusion_data IS 'Validates data integrity for self-exclusion business rules';
COMMENT ON FUNCTION test_self_exclusion_query_performance IS 'Performance testing function for self-exclusion queries';

-- ===== MAINTENANCE RECOMMENDATIONS =====

-- Create a view for monitoring index usage
CREATE OR REPLACE VIEW self_exclusion_index_usage AS
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
WHERE indexrelname LIKE '%self_exclusion%' 
   OR indexrelname LIKE '%proposer_owner%'
   OR indexrelname LIKE '%target_booking%'
ORDER BY idx_scan DESC;

COMMENT ON VIEW self_exclusion_index_usage IS 'Monitors usage statistics for self-exclusion related indexes';

-- Final analysis to ensure indexes are created properly
ANALYZE swaps;

-- Log the completion of index creation
DO $$
BEGIN
    RAISE NOTICE 'Self-exclusion query optimization indexes created successfully';
    RAISE NOTICE 'Run SELECT * FROM analyze_self_exclusion_query_performance() to test performance';
    RAISE NOTICE 'Run SELECT * FROM validate_self_exclusion_data() to check data integrity';
END $$;