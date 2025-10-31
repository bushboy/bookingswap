-- Performance Optimization Migration
-- This migration adds indexes, optimizes existing tables, and creates performance-related structures

-- Add full-text search capabilities
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS city_normalized text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS country_normalized text;

-- Update normalized columns
UPDATE bookings SET 
  city_normalized = lower(city),
  country_normalized = lower(country)
WHERE city_normalized IS NULL OR country_normalized IS NULL;

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_bookings_search_vector ON bookings USING gin(search_vector);

-- Create normalized location indexes
CREATE INDEX IF NOT EXISTS idx_bookings_city_normalized ON bookings (city_normalized);
CREATE INDEX IF NOT EXISTS idx_bookings_country_normalized ON bookings (country_normalized);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_bookings_status_type ON bookings (status, type);
CREATE INDEX IF NOT EXISTS idx_bookings_status_created ON bookings (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_user_status ON bookings (user_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_price_range ON bookings (swap_value) WHERE status = 'available';

-- Create date range indexes for booking searches
CREATE INDEX IF NOT EXISTS idx_bookings_date_range ON bookings (check_in_date, check_out_date) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_bookings_check_in ON bookings (check_in_date) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_bookings_check_out ON bookings (check_out_date) WHERE status = 'available';

-- Create spatial index for geographic searches (requires PostGIS)
-- CREATE INDEX IF NOT EXISTS idx_bookings_coordinates ON bookings USING gist(coordinates) WHERE coordinates IS NOT NULL;

-- Optimize swaps table indexes
CREATE INDEX IF NOT EXISTS idx_swaps_proposer_status ON swaps (proposer_id, status);
CREATE INDEX IF NOT EXISTS idx_swaps_owner_status ON swaps (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_swaps_status_created ON swaps (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swaps_booking_ids ON swaps (source_booking_id, target_booking_id);

-- Create index for expired proposals (using expires_at column)
CREATE INDEX IF NOT EXISTS idx_swaps_expired ON swaps (expires_at) WHERE status = 'pending';

-- Optimize users table
CREATE INDEX IF NOT EXISTS idx_users_wallet_address_extra ON users (wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_verification_level_extra ON users (verification_level);

-- Create partial indexes for active records
CREATE INDEX IF NOT EXISTS idx_bookings_active ON bookings (created_at DESC) WHERE status IN ('available', 'locked');
CREATE INDEX IF NOT EXISTS idx_swaps_active ON swaps (created_at DESC) WHERE status IN ('pending', 'accepted');

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_booking_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.city, '') || ' ' ||
    COALESCE(NEW.country, '') || ' ' ||
    COALESCE(NEW.type, '')
  );
  NEW.city_normalized := lower(NEW.city);
  NEW.country_normalized := lower(NEW.country);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS trigger_update_booking_search_vector ON bookings;
CREATE TRIGGER trigger_update_booking_search_vector
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_search_vector();

-- Update existing records with search vectors
UPDATE bookings SET 
  search_vector = to_tsvector('english', 
    COALESCE(title, '') || ' ' ||
    COALESCE(description, '') || ' ' ||
    COALESCE(city, '') || ' ' ||
    COALESCE(country, '') || ' ' ||
    COALESCE(type, '')
  ),
  city_normalized = lower(city),
  country_normalized = lower(country)
WHERE search_vector IS NULL;

-- Create materialized view for popular bookings
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_bookings AS
SELECT 
  b.*,
  COUNT(s.id) as proposal_count,
  MAX(s.created_at) as latest_proposal_date
FROM bookings b
LEFT JOIN swaps s ON (s.source_booking_id = b.id OR s.target_booking_id = b.id)
WHERE b.status = 'available'
  AND b.created_at > NOW() - INTERVAL '30 days'
GROUP BY b.id
ORDER BY proposal_count DESC, b.created_at DESC;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_popular_bookings_proposal_count ON popular_bookings (proposal_count DESC);

-- Create function to refresh popular bookings view
CREATE OR REPLACE FUNCTION refresh_popular_bookings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW popular_bookings;
END;
$$ LANGUAGE plpgsql;

-- Create statistics table for performance monitoring
CREATE TABLE IF NOT EXISTS performance_stats (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_performance_stats_metric_time ON performance_stats (metric_name, recorded_at DESC);

-- Create function to log query performance
CREATE OR REPLACE FUNCTION log_query_performance(
  query_name TEXT,
  execution_time_ms NUMERIC,
  row_count INTEGER DEFAULT NULL,
  additional_metadata JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO performance_stats (metric_name, metric_value, metadata)
  VALUES (
    query_name,
    execution_time_ms,
    jsonb_build_object(
      'row_count', row_count,
      'additional_metadata', additional_metadata
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Create table for caching frequently accessed data
CREATE TABLE IF NOT EXISTS cache_entries (
  cache_key VARCHAR(255) PRIMARY KEY,
  cache_value JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_entries_expires ON cache_entries (expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_entries_access_count ON cache_entries (access_count DESC);

-- Create function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cache_entries WHERE expires_at < CURRENT_TIMESTAMP;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create aggregated statistics view
CREATE VIEW booking_statistics AS
SELECT 
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN status = 'available' THEN 1 END) as available_bookings,
  COUNT(CASE WHEN status = 'swapped' THEN 1 END) as swapped_bookings,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
  AVG(swap_value) as avg_swap_value,
  COUNT(CASE WHEN created_at > CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as bookings_last_week,
  COUNT(CASE WHEN created_at > CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as bookings_last_month
FROM bookings;

CREATE VIEW swap_statistics AS
SELECT 
  COUNT(*) as total_swaps,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_swaps,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_swaps,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_swaps,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_swaps,
  AVG(EXTRACT(EPOCH FROM completed_at - proposed_at)) as avg_completion_time_seconds
FROM swaps
WHERE completed_at IS NOT NULL AND proposed_at IS NOT NULL;

-- Create function to analyze table performance
CREATE OR REPLACE FUNCTION analyze_table_performance(table_name TEXT)
RETURNS TABLE(
  table_size TEXT,
  index_size TEXT,
  row_count BIGINT,
  seq_scan BIGINT,
  seq_tup_read BIGINT,
  idx_scan BIGINT,
  idx_tup_fetch BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_size_pretty(pg_total_relation_size(table_name::regclass)) as table_size,
    pg_size_pretty(pg_indexes_size(table_name::regclass)) as index_size,
    schemaname,
    relname,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch
  FROM pg_stat_user_tables 
  WHERE relname = table_name;
END;
$$ LANGUAGE plpgsql;

-- Set up automatic statistics collection
-- This would typically be done via cron or a scheduler
-- For now, we create the structure

-- Enable query plan logging for slow queries
-- ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries taking more than 1 second
-- ALTER SYSTEM SET log_statement_stats = on;
-- ALTER SYSTEM SET log_checkpoints = on;

-- Create indexes for blockchain-related queries
CREATE INDEX IF NOT EXISTS idx_bookings_blockchain_tx ON bookings (blockchain_transaction_id) WHERE blockchain_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_swaps_blockchain_proposal ON swaps (blockchain_proposal_transaction_id) WHERE blockchain_proposal_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_swaps_blockchain_execution ON swaps (blockchain_execution_transaction_id) WHERE blockchain_execution_transaction_id IS NOT NULL;

-- Create function to get database performance metrics
CREATE OR REPLACE FUNCTION get_performance_metrics()
RETURNS TABLE(
  metric_name TEXT,
  metric_value NUMERIC,
  unit TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'total_bookings'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT
  FROM bookings
  UNION ALL
  SELECT 
    'active_bookings'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT
  FROM bookings WHERE status = 'available'
  UNION ALL
  SELECT 
    'total_swaps'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT
  FROM swaps
  UNION ALL
  SELECT 
    'pending_swaps'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT
  FROM swaps WHERE status = 'pending'
  UNION ALL
  SELECT 
    'database_size'::TEXT,
    pg_database_size(current_database())::NUMERIC,
    'bytes'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON INDEX idx_bookings_search_vector IS 'Full-text search index for booking titles, descriptions, and locations';
COMMENT ON INDEX idx_bookings_status_type IS 'Composite index for filtering by status and type';
COMMENT ON INDEX idx_bookings_date_range IS 'Index for date range queries on available bookings';
COMMENT ON MATERIALIZED VIEW popular_bookings IS 'Cached view of popular bookings based on proposal activity';
COMMENT ON FUNCTION update_booking_search_vector() IS 'Automatically updates search vector when booking data changes';
COMMENT ON TABLE performance_stats IS 'Stores performance metrics for monitoring and optimization';

-- Commit the transaction
COMMIT;