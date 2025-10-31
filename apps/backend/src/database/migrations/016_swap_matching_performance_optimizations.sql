-- Swap Matching Performance Optimizations Migration
-- This migration adds indexes and optimizations specifically for swap matching functionality

-- ===== SWAP MATCHING INDEXES =====

-- Indexes for finding eligible swaps
CREATE INDEX IF NOT EXISTS idx_swaps_owner_status_active ON swaps (owner_id, status) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_swaps_proposer_status_active ON swaps (proposer_id, status) 
  WHERE status = 'active';

-- Composite index for eligibility queries (user's active swaps excluding specific swap)
CREATE INDEX IF NOT EXISTS idx_swaps_user_active_excluding ON swaps (owner_id, status, id) 
  WHERE status = 'active';

-- Index for checking existing proposals between swaps
CREATE INDEX IF NOT EXISTS idx_swaps_booking_pair_status ON swaps (source_booking_id, target_booking_id, status)
  WHERE status IN ('pending', 'accepted');

-- Index for reverse booking pair lookups
CREATE INDEX IF NOT EXISTS idx_swaps_booking_pair_reverse ON swaps (target_booking_id, source_booking_id, status)
  WHERE status IN ('pending', 'accepted');

-- ===== COMPATIBILITY ANALYSIS INDEXES =====

-- Indexes for booking details used in compatibility analysis
CREATE INDEX IF NOT EXISTS idx_bookings_location_compatibility ON bookings (city, country, status)
  WHERE status = 'available';

CREATE INDEX IF NOT EXISTS idx_bookings_date_compatibility ON bookings (check_in_date, check_out_date, status)
  WHERE status = 'available';

CREATE INDEX IF NOT EXISTS idx_bookings_price_compatibility ON bookings (swap_value, status)
  WHERE status = 'available' AND swap_value IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_type_compatibility ON bookings (type, status)
  WHERE status = 'available' AND type IS NOT NULL;

-- Composite index for multi-factor compatibility queries
CREATE INDEX IF NOT EXISTS idx_bookings_compatibility_factors ON bookings 
  (city, country, type, status)
  WHERE status = 'available';

-- ===== PROPOSAL LOOKUP OPTIMIZATIONS =====

-- Index for finding proposals by swap pairs (for duplicate checking)
CREATE INDEX IF NOT EXISTS idx_swaps_source_target_status ON swaps (source_booking_id, target_booking_id, status);

-- Index for finding user's proposals (both as proposer and target)
CREATE INDEX IF NOT EXISTS idx_swaps_user_involvement ON swaps (proposer_id, owner_id, status);

-- Index for proposal expiration queries
CREATE INDEX IF NOT EXISTS idx_swaps_expires_pending ON swaps (expires_at, status)
  WHERE status = 'pending';

-- ===== SEARCH AND BROWSE OPTIMIZATIONS =====

-- Index for browse page queries (excluding user's own swaps)
CREATE INDEX IF NOT EXISTS idx_swaps_browse_active ON swaps (status, created_at DESC, owner_id)
  WHERE status = 'active';

-- Index for filtering swaps by creation date and status
CREATE INDEX IF NOT EXISTS idx_swaps_status_created_desc ON swaps (status, created_at DESC);

-- Index for user's swap history
CREATE INDEX IF NOT EXISTS idx_swaps_user_history ON swaps (owner_id, created_at DESC);

-- ===== PERFORMANCE MONITORING TABLES =====

-- Table for storing compatibility analysis cache
CREATE TABLE IF NOT EXISTS swap_compatibility_cache (
  id SERIAL PRIMARY KEY,
  source_swap_id UUID NOT NULL,
  target_swap_id UUID NOT NULL,
  compatibility_score NUMERIC(5,2) NOT NULL,
  analysis_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(source_swap_id, target_swap_id)
);

-- Indexes for compatibility cache
CREATE INDEX IF NOT EXISTS idx_compatibility_cache_source ON swap_compatibility_cache (source_swap_id);
CREATE INDEX IF NOT EXISTS idx_compatibility_cache_target ON swap_compatibility_cache (target_swap_id);
CREATE INDEX IF NOT EXISTS idx_compatibility_cache_expires ON swap_compatibility_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_compatibility_cache_score ON swap_compatibility_cache (compatibility_score DESC);

-- Table for storing eligible swaps cache
CREATE TABLE IF NOT EXISTS eligible_swaps_cache (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  target_swap_id UUID NOT NULL,
  eligible_swap_ids UUID[] NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(user_id, target_swap_id)
);

-- Indexes for eligible swaps cache
CREATE INDEX IF NOT EXISTS idx_eligible_swaps_cache_user ON eligible_swaps_cache (user_id);
CREATE INDEX IF NOT EXISTS idx_eligible_swaps_cache_target ON eligible_swaps_cache (target_swap_id);
CREATE INDEX IF NOT EXISTS idx_eligible_swaps_cache_expires ON eligible_swaps_cache (expires_at);

-- Table for proposal metadata (browse-initiated proposals)
CREATE TABLE IF NOT EXISTS swap_proposal_metadata (
  id SERIAL PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES swaps(id) ON DELETE CASCADE,
  source_swap_id UUID NOT NULL,
  target_swap_id UUID NOT NULL,
  compatibility_score NUMERIC(5,2),
  proposal_source VARCHAR(50) DEFAULT 'browse',
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(proposal_id)
);

-- Indexes for proposal metadata
CREATE INDEX IF NOT EXISTS idx_proposal_metadata_proposal ON swap_proposal_metadata (proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_metadata_source_swap ON swap_proposal_metadata (source_swap_id);
CREATE INDEX IF NOT EXISTS idx_proposal_metadata_target_swap ON swap_proposal_metadata (target_swap_id);
CREATE INDEX IF NOT EXISTS idx_proposal_metadata_source_type ON swap_proposal_metadata (proposal_source);
CREATE INDEX IF NOT EXISTS idx_proposal_metadata_score ON swap_proposal_metadata (compatibility_score DESC);

-- ===== QUERY OPTIMIZATION FUNCTIONS =====

-- Function to find eligible swaps with optimized query
DROP FUNCTION IF EXISTS find_eligible_swaps_optimized(UUID, UUID, INTEGER);
CREATE OR REPLACE FUNCTION find_eligible_swaps_optimized(
  p_user_id UUID,
  p_target_swap_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  swap_id UUID,
  source_booking_id UUID,
  booking_title VARCHAR(200),
  booking_description TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  check_in_date TIMESTAMP WITH TIME ZONE,
  check_out_date TIMESTAMP WITH TIME ZONE,
  booking_type VARCHAR(20),
  estimated_value DECIMAL(10,2),
  swap_status VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as swap_id,
    s.source_booking_id,
    COALESCE(b.title, 'Untitled Booking') as booking_title,
    COALESCE(b.description, '') as booking_description,
    COALESCE(b.city, '') as city,
    COALESCE(b.country, '') as country,
    b.check_in_date,
    b.check_out_date,
    COALESCE(b.type, '') as booking_type,
    COALESCE(b.swap_value, 0) as estimated_value,
    s.status as swap_status,
    s.created_at
  FROM swaps s
  INNER JOIN bookings b ON s.source_booking_id = b.id
  WHERE s.owner_id = p_user_id
    AND s.status = 'active'
    AND s.id != p_target_swap_id
    AND NOT EXISTS (
      SELECT 1 FROM swaps existing_swap
      WHERE (
        (existing_swap.source_booking_id = s.source_booking_id
         AND existing_swap.target_booking_id = (SELECT target_swap.source_booking_id FROM swaps target_swap WHERE target_swap.id = p_target_swap_id))
        OR
        (existing_swap.source_booking_id = (SELECT target_swap.source_booking_id FROM swaps target_swap WHERE target_swap.id = p_target_swap_id)
         AND existing_swap.target_booking_id = s.source_booking_id)
      )
      AND existing_swap.status IN ('pending', 'accepted')
    )
  ORDER BY s.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to check for existing proposals between swaps (optimized)
CREATE OR REPLACE FUNCTION has_existing_proposal_optimized(
  p_source_swap_id UUID,
  p_target_swap_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_source_booking_id UUID;
  v_target_booking_id UUID;
  proposal_count INTEGER;
BEGIN
  -- Get booking IDs for both swaps
  SELECT s1.source_booking_id, s2.source_booking_id
  INTO v_source_booking_id, v_target_booking_id
  FROM swaps s1, swaps s2
  WHERE s1.id = p_source_swap_id AND s2.id = p_target_swap_id;
  
  -- Check for existing proposals in both directions
  SELECT COUNT(*)
  INTO proposal_count
  FROM swaps
  WHERE (
    (swaps.source_booking_id = v_source_booking_id AND swaps.target_booking_id = v_target_booking_id)
    OR
    (swaps.source_booking_id = v_target_booking_id AND swaps.target_booking_id = v_source_booking_id)
  )
  AND status IN ('pending', 'accepted');
  
  RETURN proposal_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to get compatibility factors for analysis
CREATE OR REPLACE FUNCTION get_compatibility_factors(
  p_source_booking_id UUID,
  p_target_booking_id UUID
)
RETURNS TABLE(
  source_city TEXT,
  source_country TEXT,
  target_city TEXT,
  target_country TEXT,
  source_check_in TIMESTAMP WITH TIME ZONE,
  source_check_out TIMESTAMP WITH TIME ZONE,
  target_check_in TIMESTAMP WITH TIME ZONE,
  target_check_out TIMESTAMP WITH TIME ZONE,
  source_price NUMERIC,
  target_price NUMERIC,
  source_type TEXT,
  target_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b1.city as source_city,
    b1.country as source_country,
    b2.city as target_city,
    b2.country as target_country,
    b1.check_in_date as source_check_in,
    b1.check_out_date as source_check_out,
    b2.check_in_date as target_check_in,
    b2.check_out_date as target_check_out,
    b1.swap_value as source_price,
    b2.swap_value as target_price,
    b1.type as source_type,
    b2.type as target_type
  FROM bookings b1, bookings b2
  WHERE b1.id = p_source_booking_id AND b2.id = p_target_booking_id;
END;
$$ LANGUAGE plpgsql;

-- ===== BATCH PROCESSING FUNCTIONS =====

-- Function for batch compatibility analysis
CREATE OR REPLACE FUNCTION batch_analyze_compatibility(
  p_swap_pairs JSONB
)
RETURNS TABLE(
  source_swap_id UUID,
  target_swap_id UUID,
  compatibility_data JSONB
) AS $$
DECLARE
  pair JSONB;
BEGIN
  FOR pair IN SELECT jsonb_array_elements(p_swap_pairs)
  LOOP
    RETURN QUERY
    SELECT 
      (pair->>'sourceSwapId')::UUID,
      (pair->>'targetSwapId')::UUID,
      get_compatibility_factors(
        (SELECT source_booking_id FROM swaps WHERE id = (pair->>'sourceSwapId')::UUID),
        (SELECT source_booking_id FROM swaps WHERE id = (pair->>'targetSwapId')::UUID)
      )::JSONB;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ===== CACHE MANAGEMENT FUNCTIONS =====

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_swap_matching_cache()
RETURNS TABLE(
  compatibility_deleted INTEGER,
  eligible_swaps_deleted INTEGER
) AS $$
DECLARE
  comp_deleted INTEGER;
  eligible_deleted INTEGER;
BEGIN
  -- Clean compatibility cache
  DELETE FROM swap_compatibility_cache WHERE expires_at < CURRENT_TIMESTAMP;
  GET DIAGNOSTICS comp_deleted = ROW_COUNT;
  
  -- Clean eligible swaps cache
  DELETE FROM eligible_swaps_cache WHERE expires_at < CURRENT_TIMESTAMP;
  GET DIAGNOSTICS eligible_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT comp_deleted, eligible_deleted;
END;
$$ LANGUAGE plpgsql;

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_swap_matching_cache_stats()
RETURNS TABLE(
  compatibility_cache_size BIGINT,
  eligible_swaps_cache_size BIGINT,
  compatibility_hit_rate NUMERIC,
  cache_memory_usage TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM swap_compatibility_cache) as compatibility_cache_size,
    (SELECT COUNT(*) FROM eligible_swaps_cache) as eligible_swaps_cache_size,
    -- Hit rate would need to be calculated based on access logs
    0.0 as compatibility_hit_rate,
    pg_size_pretty(
      pg_total_relation_size('swap_compatibility_cache') + 
      pg_total_relation_size('eligible_swaps_cache') +
      pg_total_relation_size('swap_proposal_metadata')
    ) as cache_memory_usage;
END;
$$ LANGUAGE plpgsql;

-- ===== PERFORMANCE MONITORING =====

-- View for swap matching performance metrics
CREATE OR REPLACE VIEW swap_matching_performance AS
SELECT 
  'total_active_swaps' as metric_name,
  COUNT(*) as metric_value,
  'count' as unit
FROM swaps WHERE status = 'active'
UNION ALL
SELECT 
  'total_pending_proposals' as metric_name,
  COUNT(*) as metric_value,
  'count' as unit
FROM swaps WHERE status = 'pending'
UNION ALL
SELECT 
  'avg_proposals_per_swap' as metric_name,
  COALESCE(AVG(proposal_count), 0) as metric_value,
  'count' as unit
FROM (
  SELECT 
    s1.id,
    COUNT(s2.id) as proposal_count
  FROM swaps s1
  LEFT JOIN swaps s2 ON s2.target_booking_id = s1.source_booking_id
  WHERE s1.status = 'active'
  GROUP BY s1.id
) proposal_stats
UNION ALL
SELECT 
  'compatibility_cache_size' as metric_name,
  COUNT(*) as metric_value,
  'entries' as unit
FROM swap_compatibility_cache
UNION ALL
SELECT 
  'eligible_swaps_cache_size' as metric_name,
  COUNT(*) as metric_value,
  'entries' as unit
FROM eligible_swaps_cache;

-- ===== QUERY PERFORMANCE LOGGING =====

-- Table for logging slow queries
CREATE TABLE IF NOT EXISTS swap_matching_query_log (
  id SERIAL PRIMARY KEY,
  query_type VARCHAR(100) NOT NULL,
  execution_time_ms NUMERIC NOT NULL,
  parameters JSONB,
  result_count INTEGER,
  user_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for query log analysis
CREATE INDEX IF NOT EXISTS idx_query_log_type_time ON swap_matching_query_log (query_type, execution_time_ms DESC);
CREATE INDEX IF NOT EXISTS idx_query_log_created ON swap_matching_query_log (created_at DESC);

-- Function to log query performance
CREATE OR REPLACE FUNCTION log_swap_matching_query(
  p_query_type TEXT,
  p_execution_time_ms NUMERIC,
  p_parameters JSONB DEFAULT NULL,
  p_result_count INTEGER DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO swap_matching_query_log (
    query_type,
    execution_time_ms,
    parameters,
    result_count,
    user_id
  ) VALUES (
    p_query_type,
    p_execution_time_ms,
    p_parameters,
    p_result_count,
    p_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- ===== MAINTENANCE PROCEDURES =====

-- Function to analyze and optimize swap matching tables
CREATE OR REPLACE FUNCTION optimize_swap_matching_tables()
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
BEGIN
  -- Analyze tables to update statistics
  ANALYZE swaps;
  ANALYZE bookings;
  ANALYZE swap_compatibility_cache;
  ANALYZE eligible_swaps_cache;
  ANALYZE swap_proposal_metadata;
  
  result := 'Analyzed swap matching tables. ';
  
  -- Clean expired cache entries
  PERFORM clean_swap_matching_cache();
  result := result || 'Cleaned expired cache entries. ';
  
  -- Vacuum tables if needed (this would typically be done by autovacuum)
  -- VACUUM ANALYZE swaps;
  -- VACUUM ANALYZE bookings;
  
  result := result || 'Optimization completed.';
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ===== COMMENTS FOR DOCUMENTATION =====

COMMENT ON INDEX idx_swaps_owner_status_active IS 'Optimized index for finding user''s active swaps';
COMMENT ON INDEX idx_swaps_booking_pair_status IS 'Index for checking existing proposals between booking pairs';
COMMENT ON INDEX idx_bookings_compatibility_factors IS 'Composite index for multi-factor compatibility analysis';
COMMENT ON TABLE swap_compatibility_cache IS 'Cache table for storing compatibility analysis results';
COMMENT ON TABLE eligible_swaps_cache IS 'Cache table for storing eligible swaps for users';
COMMENT ON TABLE swap_proposal_metadata IS 'Metadata table for browse-initiated proposals';
COMMENT ON FUNCTION find_eligible_swaps_optimized IS 'Optimized function for finding eligible swaps with single query';
COMMENT ON FUNCTION clean_swap_matching_cache IS 'Maintenance function to clean expired cache entries';
COMMENT ON VIEW swap_matching_performance IS 'Performance metrics view for swap matching functionality';

-- Commit the transaction
COMMIT;