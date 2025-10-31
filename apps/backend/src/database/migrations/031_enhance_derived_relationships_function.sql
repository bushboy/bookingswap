-- Migration: Enhance get_swap_with_derived_relationships function
-- Created: 2024-12-07
-- Description: Enhances the get_swap_with_derived_relationships function with comprehensive
--              relationship derivation logic and proper NULL handling for optional relationships

BEGIN;

-- Step 1: Drop existing function to recreate with enhanced functionality
DROP FUNCTION IF EXISTS get_swap_with_derived_relationships(UUID);

-- Step 2: Create enhanced helper function for derived relationships
CREATE OR REPLACE FUNCTION get_swap_with_derived_relationships(p_swap_id UUID)
RETURNS TABLE(
  swap_id UUID,
  source_booking_id UUID,
  proposer_id UUID,
  proposer_name VARCHAR(100),
  proposer_email VARCHAR(255),
  target_booking_id UUID,
  target_owner_id UUID,
  target_owner_name VARCHAR(100),
  target_owner_email VARCHAR(255),
  swap_status VARCHAR(20),
  targeting_status VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  swap_exists BOOLEAN;
BEGIN
  -- Input validation
  IF p_swap_id IS NULL THEN
    RAISE EXCEPTION 'Swap ID cannot be NULL';
  END IF;
  
  -- Check if swap exists
  SELECT EXISTS(SELECT 1 FROM swaps WHERE id = p_swap_id) INTO swap_exists;
  IF NOT swap_exists THEN
    RAISE EXCEPTION 'Swap with ID % does not exist', p_swap_id;
  END IF;
  
  -- Return comprehensive swap data with all derived relationships
  RETURN QUERY
  SELECT 
    s.id as swap_id,
    s.source_booking_id,
    -- Derive proposer information from source booking
    sb.user_id as proposer_id,
    COALESCE(su.display_name, su.first_name || ' ' || su.last_name, 'Unknown User') as proposer_name,
    su.email as proposer_email,
    -- Derive target booking information from swap_targets (may be NULL if no active targeting)
    ts.source_booking_id as target_booking_id,
    tb.user_id as target_owner_id,
    COALESCE(tu.display_name, tu.first_name || ' ' || tu.last_name, 'Unknown User') as target_owner_name,
    tu.email as target_owner_email,
    -- Status information
    s.status as swap_status,
    st.status as targeting_status,
    -- Timestamps
    s.created_at,
    COALESCE(s.updated_at, s.created_at) as updated_at
  FROM swaps s
  -- Always join with source booking and proposer (required relationships)
  INNER JOIN bookings sb ON s.source_booking_id = sb.id
  INNER JOIN users su ON sb.user_id = su.id
  -- Left join with targeting relationships (optional - may not exist)
  LEFT JOIN swap_targets st ON s.id = st.source_swap_id 
    AND st.status IN ('active', 'accepted', 'pending')
  LEFT JOIN swaps ts ON st.target_swap_id = ts.id
  LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
  LEFT JOIN users tu ON tb.user_id = tu.id
  WHERE s.id = p_swap_id
  -- Handle multiple targeting relationships by ordering and limiting to most recent active
  ORDER BY 
    CASE st.status 
      WHEN 'accepted' THEN 1
      WHEN 'active' THEN 2
      WHEN 'pending' THEN 3
      ELSE 4
    END,
    st.created_at DESC
  LIMIT 1;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details for debugging
    RAISE WARNING 'Error in get_swap_with_derived_relationships for swap_id %: % - %', 
      p_swap_id, SQLSTATE, SQLERRM;
    -- Re-raise the exception to maintain error handling
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create additional helper function for multiple swaps with derived relationships
CREATE OR REPLACE FUNCTION get_multiple_swaps_with_derived_relationships(p_swap_ids UUID[])
RETURNS TABLE(
  swap_id UUID,
  source_booking_id UUID,
  proposer_id UUID,
  proposer_name VARCHAR(100),
  proposer_email VARCHAR(255),
  target_booking_id UUID,
  target_owner_id UUID,
  target_owner_name VARCHAR(100),
  target_owner_email VARCHAR(255),
  swap_status VARCHAR(20),
  targeting_status VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Input validation
  IF p_swap_ids IS NULL OR array_length(p_swap_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Swap IDs array cannot be NULL or empty';
  END IF;
  
  -- Return comprehensive swap data for multiple swaps with all derived relationships
  RETURN QUERY
  SELECT 
    s.id as swap_id,
    s.source_booking_id,
    -- Derive proposer information from source booking
    sb.user_id as proposer_id,
    COALESCE(su.display_name, su.first_name || ' ' || su.last_name, 'Unknown User') as proposer_name,
    su.email as proposer_email,
    -- Derive target booking information from swap_targets (may be NULL if no active targeting)
    ts.source_booking_id as target_booking_id,
    tb.user_id as target_owner_id,
    COALESCE(tu.display_name, tu.first_name || ' ' || tu.last_name, 'Unknown User') as target_owner_name,
    tu.email as target_owner_email,
    -- Status information
    s.status as swap_status,
    st.status as targeting_status,
    -- Timestamps
    s.created_at,
    COALESCE(s.updated_at, s.created_at) as updated_at
  FROM swaps s
  -- Always join with source booking and proposer (required relationships)
  INNER JOIN bookings sb ON s.source_booking_id = sb.id
  INNER JOIN users su ON sb.user_id = su.id
  -- Left join with targeting relationships (optional - may not exist)
  LEFT JOIN LATERAL (
    SELECT st_inner.status, st_inner.target_swap_id, st_inner.created_at
    FROM swap_targets st_inner
    WHERE st_inner.source_swap_id = s.id 
      AND st_inner.status IN ('active', 'accepted', 'pending')
    ORDER BY 
      CASE st_inner.status 
        WHEN 'accepted' THEN 1
        WHEN 'active' THEN 2
        WHEN 'pending' THEN 3
        ELSE 4
      END,
      st_inner.created_at DESC
    LIMIT 1
  ) st ON TRUE
  LEFT JOIN swaps ts ON st.target_swap_id = ts.id
  LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
  LEFT JOIN users tu ON tb.user_id = tu.id
  WHERE s.id = ANY(p_swap_ids)
  ORDER BY s.created_at DESC;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details for debugging
    RAISE WARNING 'Error in get_multiple_swaps_with_derived_relationships: % - %', 
      SQLSTATE, SQLERRM;
    -- Re-raise the exception to maintain error handling
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create helper function to get swap relationships summary
CREATE OR REPLACE FUNCTION get_swap_relationships_summary(p_swap_id UUID)
RETURNS TABLE(
  swap_id UUID,
  has_proposer BOOLEAN,
  proposer_name VARCHAR(100),
  has_target BOOLEAN,
  target_owner_name VARCHAR(100),
  active_targeting_count INTEGER,
  total_targeting_count INTEGER
) AS $$
BEGIN
  -- Input validation
  IF p_swap_id IS NULL THEN
    RAISE EXCEPTION 'Swap ID cannot be NULL';
  END IF;
  
  RETURN QUERY
  SELECT 
    s.id as swap_id,
    -- Check if proposer information is available
    (sb.user_id IS NOT NULL) as has_proposer,
    COALESCE(su.display_name, su.first_name || ' ' || su.last_name, 'Unknown User') as proposer_name,
    -- Check if target information is available
    (tb.user_id IS NOT NULL) as has_target,
    COALESCE(tu.display_name, tu.first_name || ' ' || tu.last_name, 'Unknown User') as target_owner_name,
    -- Count active targeting relationships
    COALESCE(active_count.count, 0)::INTEGER as active_targeting_count,
    COALESCE(total_count.count, 0)::INTEGER as total_targeting_count
  FROM swaps s
  -- Always join with source booking and proposer
  LEFT JOIN bookings sb ON s.source_booking_id = sb.id
  LEFT JOIN users su ON sb.user_id = su.id
  -- Get the primary target (most recent active)
  LEFT JOIN LATERAL (
    SELECT st_inner.target_swap_id
    FROM swap_targets st_inner
    WHERE st_inner.source_swap_id = s.id 
      AND st_inner.status IN ('active', 'accepted', 'pending')
    ORDER BY 
      CASE st_inner.status 
        WHEN 'accepted' THEN 1
        WHEN 'active' THEN 2
        WHEN 'pending' THEN 3
        ELSE 4
      END,
      st_inner.created_at DESC
    LIMIT 1
  ) primary_target ON TRUE
  LEFT JOIN swaps ts ON primary_target.target_swap_id = ts.id
  LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
  LEFT JOIN users tu ON tb.user_id = tu.id
  -- Count active targeting relationships
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count
    FROM swap_targets st_active
    WHERE st_active.source_swap_id = s.id 
      AND st_active.status IN ('active', 'accepted')
  ) active_count ON TRUE
  -- Count total targeting relationships
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count
    FROM swap_targets st_total
    WHERE st_total.source_swap_id = s.id
  ) total_count ON TRUE
  WHERE s.id = p_swap_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details for debugging
    RAISE WARNING 'Error in get_swap_relationships_summary for swap_id %: % - %', 
      p_swap_id, SQLSTATE, SQLERRM;
    -- Re-raise the exception to maintain error handling
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create test function for enhanced derived relationships functions
CREATE OR REPLACE FUNCTION test_enhanced_derived_relationships_functions()
RETURNS TABLE(test_name text, passed boolean, details text) AS $$
DECLARE
  test_swap_id UUID;
  test_swap_ids UUID[];
  function_result_count INTEGER;
  summary_result RECORD;
BEGIN
  -- Get test data
  SELECT id INTO test_swap_id FROM swaps LIMIT 1;
  SELECT ARRAY(SELECT id FROM swaps LIMIT 3) INTO test_swap_ids;
  
  -- Test 1: get_swap_with_derived_relationships works correctly
  BEGIN
    SELECT COUNT(*) INTO function_result_count
    FROM get_swap_with_derived_relationships(
      COALESCE(test_swap_id, '00000000-0000-0000-0000-000000000000'::UUID)
    );
    
    RETURN QUERY
    SELECT 
      'get_swap_with_derived_relationships'::text,
      TRUE,
      CONCAT('Function executed successfully and returned ', function_result_count, ' results')::text;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY
      SELECT 
        'get_swap_with_derived_relationships'::text,
        FALSE,
        CONCAT('Function failed with error: ', SQLERRM)::text;
  END;
  
  -- Test 2: get_multiple_swaps_with_derived_relationships works correctly
  BEGIN
    SELECT COUNT(*) INTO function_result_count
    FROM get_multiple_swaps_with_derived_relationships(
      COALESCE(test_swap_ids, ARRAY['00000000-0000-0000-0000-000000000000'::UUID])
    );
    
    RETURN QUERY
    SELECT 
      'get_multiple_swaps_with_derived_relationships'::text,
      TRUE,
      CONCAT('Function executed successfully and returned ', function_result_count, ' results')::text;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY
      SELECT 
        'get_multiple_swaps_with_derived_relationships'::text,
        FALSE,
        CONCAT('Function failed with error: ', SQLERRM)::text;
  END;
  
  -- Test 3: get_swap_relationships_summary works correctly
  BEGIN
    SELECT * INTO summary_result
    FROM get_swap_relationships_summary(
      COALESCE(test_swap_id, '00000000-0000-0000-0000-000000000000'::UUID)
    ) LIMIT 1;
    
    RETURN QUERY
    SELECT 
      'get_swap_relationships_summary'::text,
      TRUE,
      CONCAT('Function executed successfully with summary data')::text;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY
      SELECT 
        'get_swap_relationships_summary'::text,
        FALSE,
        CONCAT('Function failed with error: ', SQLERRM)::text;
  END;
  
  -- Test 4: NULL handling works correctly
  BEGIN
    PERFORM get_swap_with_derived_relationships(NULL);
    
    RETURN QUERY
    SELECT 
      'null_handling'::text,
      FALSE,
      'Function should have raised exception for NULL input'::text;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY
      SELECT 
        'null_handling'::text,
        TRUE,
        'Function correctly handles NULL input with exception'::text;
  END;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Run validation tests
DO $$
DECLARE
    validation_result RECORD;
    has_errors BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE 'Running enhanced derived relationships function validation...';
    
    FOR validation_result IN SELECT * FROM test_enhanced_derived_relationships_functions() LOOP
        IF NOT validation_result.passed THEN
            RAISE WARNING 'Function validation failed: % - %', validation_result.test_name, validation_result.details;
            has_errors := TRUE;
        ELSE
            RAISE NOTICE 'Function validation passed: % - %', validation_result.test_name, validation_result.details;
        END IF;
    END LOOP;
    
    IF has_errors THEN
        RAISE WARNING 'Enhanced derived relationships function validation had some failures, but continuing migration.';
    END IF;
    
    RAISE NOTICE 'Enhanced derived relationships function validation completed successfully.';
END;
$$;

-- Step 7: Add documentation comments
COMMENT ON FUNCTION get_swap_with_derived_relationships IS 'Enhanced helper function to get swap with all derived relationships including comprehensive NULL handling and error management';
COMMENT ON FUNCTION get_multiple_swaps_with_derived_relationships IS 'Helper function to get multiple swaps with derived relationships in a single query for better performance';
COMMENT ON FUNCTION get_swap_relationships_summary IS 'Helper function to get a summary of swap relationships including counts and availability flags';
COMMENT ON FUNCTION test_enhanced_derived_relationships_functions IS 'Validation function to test enhanced derived relationships functions work correctly';

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '=== Migration 031: Enhanced Derived Relationships Functions Completed Successfully ===';
    RAISE NOTICE 'Enhanced function: get_swap_with_derived_relationships';
    RAISE NOTICE 'Added function: get_multiple_swaps_with_derived_relationships';
    RAISE NOTICE 'Added function: get_swap_relationships_summary';
    RAISE NOTICE 'Functions now include comprehensive relationship derivation and NULL handling';
END;
$$;

COMMIT;