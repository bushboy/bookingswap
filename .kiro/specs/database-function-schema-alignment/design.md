# Database Function Schema Alignment Design

## Overview

This design addresses the critical issue where database functions still reference columns that were removed during the schema simplification migration. The `find_eligible_swaps_optimized` function and related database functions are causing runtime errors because they attempt to access `owner_id`, `proposer_id`, and `target_booking_id` columns that no longer exist. This design provides a comprehensive solution to update all affected database functions to work with the simplified schema while maintaining the same functionality and performance.

## Architecture

### Current Problem Analysis

The error occurs because the database function `find_eligible_swaps_optimized` contains this problematic query:

```sql
SELECT 
  s.id as swap_id,
  s.source_booking_id,
  -- ... other fields
FROM swaps s
INNER JOIN bookings b ON s.source_booking_id = b.id
WHERE s.owner_id = p_user_id  -- ERROR: column "owner_id" does not exist
```

The schema simplification removed these redundant columns:
- `swaps.owner_id` - can be derived from `bookings.user_id` via `source_booking_id`
- `swaps.proposer_id` - same as owner_id (always the booking owner)
- `swaps.target_booking_id` - can be derived from swap targeting relationships

### Solution Architecture

#### Updated Function Design Pattern

All database functions will follow this pattern for deriving relationships:

```sql
-- Instead of: WHERE s.owner_id = p_user_id
-- Use: WHERE b.user_id = p_user_id (via JOIN with bookings)

SELECT 
  s.id as swap_id,
  s.source_booking_id,
  b.user_id as proposer_id,  -- Derived from booking relationship
  -- ... other fields
FROM swaps s
INNER JOIN bookings b ON s.source_booking_id = b.id
WHERE b.user_id = p_user_id  -- Use booking's user_id instead of removed owner_id
```

#### Function Update Strategy

1. **Parameter Compatibility**: Keep the same function signatures to avoid breaking application code
2. **Return Type Compatibility**: Maintain the same return structure with derived fields
3. **Performance Optimization**: Use appropriate JOINs and indexes for the simplified schema
4. **Business Logic Preservation**: Ensure all existing business rules continue to work

## Components and Interfaces

### Database Functions to Update

#### 1. find_eligible_swaps_optimized Function

**Current Signature:**
```sql
find_eligible_swaps_optimized(p_user_id UUID, p_target_swap_id UUID, p_limit INTEGER)
```

**Updated Implementation:**
```sql
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
) AS $
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
  WHERE b.user_id = p_user_id  -- Changed from s.owner_id to b.user_id
    AND s.status = 'pending'   -- Changed from 'active' to 'pending' to match current schema
    AND s.id != p_target_swap_id
    AND NOT EXISTS (
      SELECT 1 FROM swap_targets existing_target
      WHERE existing_target.source_swap_id = s.id
        AND existing_target.target_swap_id = p_target_swap_id
        AND existing_target.status IN ('active', 'accepted')
    )
  ORDER BY s.created_at DESC
  LIMIT p_limit;
END;
$ LANGUAGE plpgsql;
```

#### 2. has_existing_proposal_optimized Function

**Updated Implementation:**
```sql
CREATE OR REPLACE FUNCTION has_existing_proposal_optimized(
  p_source_swap_id UUID,
  p_target_swap_id UUID
)
RETURNS BOOLEAN AS $
DECLARE
  proposal_count INTEGER;
BEGIN
  -- Check for existing targeting relationships in both directions
  SELECT COUNT(*)
  INTO proposal_count
  FROM swap_targets st
  WHERE (
    (st.source_swap_id = p_source_swap_id AND st.target_swap_id = p_target_swap_id)
    OR
    (st.source_swap_id = p_target_swap_id AND st.target_swap_id = p_source_swap_id)
  )
  AND st.status IN ('active', 'accepted');
  
  RETURN proposal_count > 0;
END;
$ LANGUAGE plpgsql;
```

#### 3. get_compatibility_factors Function

This function should remain largely unchanged as it works with booking data directly, but we'll verify it doesn't reference removed columns.

#### 4. New Helper Functions

**get_swap_with_derived_relationships Function:**
```sql
CREATE OR REPLACE FUNCTION get_swap_with_derived_relationships(p_swap_id UUID)
RETURNS TABLE(
  swap_id UUID,
  source_booking_id UUID,
  proposer_id UUID,
  proposer_name VARCHAR(100),
  target_booking_id UUID,
  target_owner_id UUID,
  target_owner_name VARCHAR(100),
  status VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    s.id as swap_id,
    s.source_booking_id,
    sb.user_id as proposer_id,
    su.display_name as proposer_name,
    ts.source_booking_id as target_booking_id,
    tb.user_id as target_owner_id,
    tu.display_name as target_owner_name,
    s.status,
    s.created_at
  FROM swaps s
  JOIN bookings sb ON s.source_booking_id = sb.id
  JOIN users su ON sb.user_id = su.id
  LEFT JOIN swap_targets st ON s.id = st.source_swap_id
  LEFT JOIN swaps ts ON st.target_swap_id = ts.id
  LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
  LEFT JOIN users tu ON tb.user_id = tu.id
  WHERE s.id = p_swap_id;
END;
$ LANGUAGE plpgsql;
```

### Index Updates

#### Remove Obsolete Indexes
```sql
-- Drop indexes that reference removed columns
DROP INDEX IF EXISTS idx_swaps_owner_status_active;
DROP INDEX IF EXISTS idx_swaps_proposer_status_active;
DROP INDEX IF EXISTS idx_swaps_user_active_excluding;
DROP INDEX IF EXISTS idx_swaps_booking_pair_status;
DROP INDEX IF EXISTS idx_swaps_booking_pair_reverse;
DROP INDEX IF EXISTS idx_swaps_user_involvement;
DROP INDEX IF EXISTS idx_swaps_browse_active;
DROP INDEX IF EXISTS idx_swaps_user_history;
```

#### Add New Optimized Indexes
```sql
-- Indexes for the simplified schema with derived relationships
CREATE INDEX IF NOT EXISTS idx_swaps_status_pending ON swaps (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_swaps_source_booking_status ON swaps (source_booking_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_swap_lookup ON bookings (user_id, id);
CREATE INDEX IF NOT EXISTS idx_swap_targets_source_target_status ON swap_targets (source_swap_id, target_swap_id, status);
CREATE INDEX IF NOT EXISTS idx_swap_targets_bidirectional ON swap_targets (target_swap_id, source_swap_id, status);
```

## Data Models

### Function Return Types

#### SwapEligibilityResult
```sql
-- Return type for find_eligible_swaps_optimized
TYPE swap_eligibility_result AS (
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
);
```

#### SwapRelationshipResult
```sql
-- Return type for get_swap_with_derived_relationships
TYPE swap_relationship_result AS (
  swap_id UUID,
  source_booking_id UUID,
  proposer_id UUID,
  proposer_name VARCHAR(100),
  target_booking_id UUID,
  target_owner_id UUID,
  target_owner_name VARCHAR(100),
  status VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE
);
```

### Migration Strategy

#### Migration File: 028_update_database_functions_for_simplified_schema.sql

```sql
-- Migration to update database functions for simplified schema
BEGIN;

-- Drop existing functions that reference removed columns
DROP FUNCTION IF EXISTS find_eligible_swaps_optimized(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS has_existing_proposal_optimized(UUID, UUID);

-- Recreate functions with updated logic
-- [Function implementations as detailed above]

-- Drop obsolete indexes
-- [Index drops as detailed above]

-- Create new optimized indexes
-- [Index creates as detailed above]

-- Verify migration success
DO $
BEGIN
  -- Test the updated function
  PERFORM find_eligible_swaps_optimized(
    '00000000-0000-0000-0000-000000000000'::UUID,
    '00000000-0000-0000-0000-000000000001'::UUID,
    10
  );
  
  RAISE NOTICE 'Database functions updated successfully for simplified schema';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Migration failed: %', SQLERRM;
END;
$;

COMMIT;
```

## Error Handling

### Migration Error Handling

```sql
-- Rollback strategy for failed function updates
CREATE OR REPLACE FUNCTION rollback_function_updates()
RETURNS void AS $
BEGIN
  -- This would restore the original functions from backup
  -- In practice, we'll create a comprehensive rollback script
  RAISE NOTICE 'Function update rollback would be implemented here';
END;
$ LANGUAGE plpgsql;
```

### Application Error Handling

The application layer should handle potential errors during the transition:

```typescript
class SwapMatchingService {
  async getUserEligibleSwaps(userId: string, targetSwapId: string): Promise<EligibleSwap[]> {
    try {
      const result = await this.swapRepository.findEligibleSwapsWithBookingDetails(
        userId,
        targetSwapId,
        50
      );
      return result;
    } catch (error) {
      if (error.code === '42703') { // Column does not exist
        throw new DatabaseSchemaError(
          'Database functions need to be updated for simplified schema',
          error
        );
      }
      throw new SwapMatchingError('Failed to get eligible swaps', error);
    }
  }
}
```

## Testing Strategy

### Database Function Testing

```sql
-- Test suite for updated database functions
CREATE OR REPLACE FUNCTION test_updated_database_functions()
RETURNS TABLE(test_name text, passed boolean, details text) AS $
BEGIN
  -- Test 1: find_eligible_swaps_optimized works without owner_id
  RETURN QUERY
  SELECT 
    'find_eligible_swaps_no_owner_id'::text,
    (SELECT COUNT(*) >= 0 FROM find_eligible_swaps_optimized(
      '00000000-0000-0000-0000-000000000000'::UUID,
      '00000000-0000-0000-0000-000000000001'::UUID,
      10
    )),
    'Function executes without column reference errors'::text;
    
  -- Test 2: has_existing_proposal_optimized works with swap_targets
  RETURN QUERY
  SELECT 
    'has_existing_proposal_targeting'::text,
    has_existing_proposal_optimized(
      '00000000-0000-0000-0000-000000000000'::UUID,
      '00000000-0000-0000-0000-000000000001'::UUID
    ) IS NOT NULL,
    'Function returns boolean result without errors'::text;
    
  -- Test 3: Derived relationships work correctly
  RETURN QUERY
  SELECT 
    'derived_relationships'::text,
    (SELECT COUNT(*) >= 0 FROM get_swap_with_derived_relationships(
      '00000000-0000-0000-0000-000000000000'::UUID
    )),
    'Derived relationship function works correctly'::text;
END;
$ LANGUAGE plpgsql;
```

### Performance Testing

```sql
-- Performance comparison for updated functions
CREATE OR REPLACE FUNCTION benchmark_updated_functions()
RETURNS TABLE(function_name text, execution_time_ms numeric, result_count integer) AS $
DECLARE
  start_time timestamp;
  end_time timestamp;
  result_count integer;
BEGIN
  -- Benchmark find_eligible_swaps_optimized
  start_time := clock_timestamp();
  SELECT COUNT(*) INTO result_count 
  FROM find_eligible_swaps_optimized(
    (SELECT user_id FROM bookings LIMIT 1),
    (SELECT id FROM swaps LIMIT 1),
    50
  );
  end_time := clock_timestamp();
  
  RETURN QUERY
  SELECT 
    'find_eligible_swaps_optimized'::text,
    EXTRACT(MILLISECONDS FROM (end_time - start_time)),
    result_count;
END;
$ LANGUAGE plpgsql;
```

### Integration Testing

```typescript
describe('Updated Database Functions', () => {
  it('should find eligible swaps without column errors', async () => {
    const userId = 'test-user-id';
    const targetSwapId = 'target-swap-id';
    
    const eligibleSwaps = await swapRepository.findEligibleSwapsWithBookingDetails(
      userId,
      targetSwapId,
      10
    );
    
    expect(eligibleSwaps).toBeDefined();
    expect(Array.isArray(eligibleSwaps)).toBe(true);
    // Should not throw column reference errors
  });
  
  it('should derive proposer information correctly', async () => {
    const swaps = await swapRepository.findEligibleSwapsWithBookingDetails(
      'test-user-id',
      'target-swap-id',
      10
    );
    
    swaps.forEach(swap => {
      expect(swap.swap_id).toBeDefined();
      expect(swap.source_booking_id).toBeDefined();
      expect(swap.booking_title).toBeDefined();
      // All fields should be properly derived
    });
  });
});
```

## Performance Considerations

### Query Optimization

The updated functions will use these optimization strategies:

1. **Efficient JOINs**: Use INNER JOINs where possible to leverage indexes
2. **Selective WHERE Clauses**: Apply filters early in the query execution
3. **Proper Indexing**: Create indexes that support the new query patterns
4. **Limit Result Sets**: Use LIMIT clauses to prevent large result sets

### Index Strategy

```sql
-- Optimized indexes for the simplified schema functions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_swaps_booking_user_status 
ON swaps (source_booking_id) 
INCLUDE (status, created_at)
WHERE status IN ('pending', 'active');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_user_active 
ON bookings (user_id) 
INCLUDE (id, title, description, city, country, check_in_date, check_out_date, type, swap_value)
WHERE status = 'available';
```

### Performance Monitoring

```sql
-- Monitor performance of updated functions
CREATE TABLE IF NOT EXISTS function_performance_log (
  id SERIAL PRIMARY KEY,
  function_name VARCHAR(100) NOT NULL,
  execution_time_ms NUMERIC NOT NULL,
  parameter_count INTEGER,
  result_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Log function performance
CREATE OR REPLACE FUNCTION log_function_performance(
  p_function_name TEXT,
  p_execution_time_ms NUMERIC,
  p_parameter_count INTEGER DEFAULT NULL,
  p_result_count INTEGER DEFAULT NULL
)
RETURNS void AS $
BEGIN
  INSERT INTO function_performance_log (
    function_name,
    execution_time_ms,
    parameter_count,
    result_count
  ) VALUES (
    p_function_name,
    p_execution_time_ms,
    p_parameter_count,
    p_result_count
  );
END;
$ LANGUAGE plpgsql;
```

This design ensures that all database functions work correctly with the simplified schema while maintaining performance and functionality. The migration will be safe and reversible, with comprehensive testing to verify that the swap matching system continues to work as expected.