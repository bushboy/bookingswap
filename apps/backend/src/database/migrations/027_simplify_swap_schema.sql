-- Migration: Simplify swap schema by removing redundant columns
-- Created: 2024-12-07
-- Description: Removes redundant foreign key relationships from swaps and swap_targets tables
--              to simplify the schema and derive relationships through existing booking connections

-- Step 1: Create backup tables for rollback safety
CREATE TABLE swaps_backup AS SELECT * FROM swaps;
CREATE TABLE swap_targets_backup AS SELECT * FROM swap_targets;

-- Add metadata to backup tables
COMMENT ON TABLE swaps_backup IS 'Backup of swaps table before schema simplification migration 027';
COMMENT ON TABLE swap_targets_backup IS 'Backup of swap_targets table before schema simplification migration 027';

-- Step 2: Create data integrity validation functions
CREATE OR REPLACE FUNCTION validate_swap_schema_integrity()
RETURNS TABLE(test_name text, passed boolean, details text) AS $
BEGIN
    -- Test 1: All swaps have valid source booking relationships
    RETURN QUERY
    SELECT 
        'source_booking_relationships'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' swaps with invalid source booking relationships') 
    FROM swaps s
    LEFT JOIN bookings b ON s.source_booking_id = b.id
    WHERE b.id IS NULL;
    
    -- Test 2: All swap_targets have valid source and target swap relationships
    RETURN QUERY
    SELECT 
        'swap_target_relationships'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' swap_targets with invalid swap relationships')
    FROM swap_targets st
    LEFT JOIN swaps ss ON st.source_swap_id = ss.id
    LEFT JOIN swaps ts ON st.target_swap_id = ts.id
    WHERE ss.id IS NULL OR ts.id IS NULL;
    
    -- Test 3: Verify proposer_id matches source booking user_id (before removal)
    RETURN QUERY
    SELECT 
        'proposer_consistency'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' swaps where proposer_id does not match source booking user_id')
    FROM swaps s
    JOIN bookings b ON s.source_booking_id = b.id
    WHERE s.proposer_id != b.user_id;
    
    -- Test 4: Verify target_booking_id consistency with targeting relationships (before removal)
    RETURN QUERY
    SELECT 
        'target_booking_consistency'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' swaps with inconsistent target_booking_id in targeting relationships')
    FROM swaps s
    LEFT JOIN swap_targets st ON s.id = st.source_swap_id
    LEFT JOIN swaps ts ON st.target_swap_id = ts.id
    WHERE s.target_booking_id IS NOT NULL 
    AND st.target_swap_id IS NOT NULL 
    AND s.target_booking_id != ts.source_booking_id;
    
    -- Test 5: Verify owner_id consistency with target booking relationships (before removal)
    RETURN QUERY
    SELECT 
        'owner_consistency'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' swaps where owner_id does not match target booking user_id')
    FROM swaps s
    LEFT JOIN bookings tb ON s.target_booking_id = tb.id
    WHERE s.target_booking_id IS NOT NULL 
    AND s.owner_id IS NOT NULL 
    AND s.owner_id != tb.user_id;
    
    -- Test 6: Verify proposal_id consistency in swap_targets (before removal)
    RETURN QUERY
    SELECT 
        'proposal_id_consistency'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' swap_targets where proposal_id does not match source_swap_id')
    FROM swap_targets st
    WHERE st.proposal_id != st.source_swap_id;
END;
$ LANGUAGE plpgsql;

-- Step 3: Run pre-migration validation
DO $
DECLARE
    validation_result RECORD;
    has_errors BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE 'Running pre-migration data integrity validation...';
    
    FOR validation_result IN SELECT * FROM validate_swap_schema_integrity() LOOP
        IF NOT validation_result.passed THEN
            RAISE WARNING 'Validation failed: % - %', validation_result.test_name, validation_result.details;
            has_errors := TRUE;
        ELSE
            RAISE NOTICE 'Validation passed: %', validation_result.test_name;
        END IF;
    END LOOP;
    
    IF has_errors THEN
        RAISE EXCEPTION 'Pre-migration validation failed. Please fix data integrity issues before proceeding.';
    END IF;
    
    RAISE NOTICE 'Pre-migration validation completed successfully.';
END;
$;

-- Step 4: Drop constraints that reference columns to be removed
ALTER TABLE swaps DROP CONSTRAINT IF EXISTS check_different_bookings;
ALTER TABLE swaps DROP CONSTRAINT IF EXISTS check_different_users;

-- Step 5: Drop indexes for columns to be removed
DROP INDEX IF EXISTS idx_swaps_target_booking_id;
DROP INDEX IF EXISTS idx_swaps_proposer_id;
DROP INDEX IF EXISTS idx_swaps_owner_id;
DROP INDEX IF EXISTS idx_swaps_user_status;
DROP INDEX IF EXISTS idx_swaps_owner_status;
DROP INDEX IF EXISTS idx_swap_targets_proposal;

-- Drop composite indexes that include columns to be removed
DROP INDEX IF EXISTS idx_swaps_owner_targeted;

-- Step 6: Remove redundant columns from swaps table
ALTER TABLE swaps DROP COLUMN IF EXISTS target_booking_id;
ALTER TABLE swaps DROP COLUMN IF EXISTS proposer_id;
ALTER TABLE swaps DROP COLUMN IF EXISTS owner_id;

-- Step 7: Remove redundant proposal_id column from swap_targets table
ALTER TABLE swap_targets DROP COLUMN IF EXISTS proposal_id;

-- Step 8: Create optimized indexes for simplified schema
-- Core indexes for simplified schema
CREATE INDEX idx_swaps_source_booking_user ON swaps(source_booking_id);
CREATE INDEX idx_swaps_status_created ON swaps(status, created_at DESC);

-- Composite indexes for common derived queries
CREATE INDEX idx_bookings_user_swap_lookup ON bookings(user_id, id);
CREATE INDEX idx_swap_targets_relationships ON swap_targets(source_swap_id, target_swap_id, status);

-- Partial indexes for active relationships
CREATE INDEX idx_swap_targets_active ON swap_targets(target_swap_id) WHERE status = 'active';
CREATE INDEX idx_swaps_targeted ON swaps(is_targeted, target_count) WHERE is_targeted = true;

-- Enhanced indexes for targeting queries
CREATE INDEX idx_swap_targets_source_status ON swap_targets(source_swap_id, status);
CREATE INDEX idx_swap_targets_target_status ON swap_targets(target_swap_id, status);

-- Step 9: Update constraints for simplified schema
ALTER TABLE swaps ADD CONSTRAINT check_expires_future CHECK (expires_at > NOW());

-- Step 10: Create helper functions for derived relationships
CREATE OR REPLACE FUNCTION get_swap_with_relationships(swap_id_param UUID)
RETURNS TABLE(
    id UUID,
    source_booking_id UUID,
    status VARCHAR(20),
    proposer_id UUID,
    proposer_name VARCHAR(255),
    target_booking_id UUID,
    target_owner_id UUID,
    target_owner_name VARCHAR(255),
    is_targeting BOOLEAN,
    targeting_created_at TIMESTAMP WITH TIME ZONE
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.source_booking_id,
        s.status,
        sb.user_id as proposer_id,
        su.display_name as proposer_name,
        ts.source_booking_id as target_booking_id,
        tb.user_id as target_owner_id,
        tu.display_name as target_owner_name,
        (st.id IS NOT NULL) as is_targeting,
        st.created_at as targeting_created_at
    FROM swaps s
    JOIN bookings sb ON s.source_booking_id = sb.id
    JOIN users su ON sb.user_id = su.id
    LEFT JOIN swap_targets st ON s.id = st.source_swap_id AND st.status = 'active'
    LEFT JOIN swaps ts ON st.target_swap_id = ts.id
    LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
    LEFT JOIN users tu ON tb.user_id = tu.id
    WHERE s.id = swap_id_param;
END;
$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_swaps_with_relationships(user_id_param UUID)
RETURNS TABLE(
    id UUID,
    source_booking_id UUID,
    status VARCHAR(20),
    proposer_id UUID,
    proposer_name VARCHAR(255),
    target_booking_id UUID,
    target_owner_id UUID,
    target_owner_name VARCHAR(255),
    is_targeting BOOLEAN,
    targeting_created_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.source_booking_id,
        s.status,
        sb.user_id as proposer_id,
        su.display_name as proposer_name,
        ts.source_booking_id as target_booking_id,
        tb.user_id as target_owner_id,
        tu.display_name as target_owner_name,
        (st.id IS NOT NULL) as is_targeting,
        st.created_at as targeting_created_at,
        s.created_at
    FROM swaps s
    JOIN bookings sb ON s.source_booking_id = sb.id
    JOIN users su ON sb.user_id = su.id
    LEFT JOIN swap_targets st ON s.id = st.source_swap_id AND st.status = 'active'
    LEFT JOIN swaps ts ON st.target_swap_id = ts.id
    LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
    LEFT JOIN users tu ON tb.user_id = tu.id
    WHERE sb.user_id = user_id_param
    ORDER BY s.created_at DESC;
END;
$ LANGUAGE plpgsql;

-- Step 11: Create post-migration validation function
CREATE OR REPLACE FUNCTION validate_simplified_schema_integrity()
RETURNS TABLE(test_name text, passed boolean, details text) AS $
BEGIN
    -- Test 1: All swaps still have valid source booking relationships
    RETURN QUERY
    SELECT 
        'simplified_source_booking_relationships'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' swaps with invalid source booking relationships after simplification') 
    FROM swaps s
    LEFT JOIN bookings b ON s.source_booking_id = b.id
    WHERE b.id IS NULL;
    
    -- Test 2: All swap_targets still have valid relationships
    RETURN QUERY
    SELECT 
        'simplified_swap_target_relationships'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' swap_targets with invalid relationships after simplification')
    FROM swap_targets st
    LEFT JOIN swaps ss ON st.source_swap_id = ss.id
    LEFT JOIN swaps ts ON st.target_swap_id = ts.id
    WHERE ss.id IS NULL OR ts.id IS NULL;
    
    -- Test 3: Verify derived proposer relationships work correctly
    RETURN QUERY
    SELECT 
        'derived_proposer_relationships'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' swaps where proposer cannot be derived from booking relationship')
    FROM swaps s
    LEFT JOIN bookings b ON s.source_booking_id = b.id
    LEFT JOIN users u ON b.user_id = u.id
    WHERE u.id IS NULL;
    
    -- Test 4: Verify targeting relationships work without proposal_id
    RETURN QUERY
    SELECT 
        'targeting_without_proposal_id'::text,
        COUNT(*) = 0,
        CONCAT('Found ', COUNT(*), ' swap_targets that cannot derive relationships without proposal_id')
    FROM swap_targets st
    LEFT JOIN swaps ss ON st.source_swap_id = ss.id
    LEFT JOIN swaps ts ON st.target_swap_id = ts.id
    LEFT JOIN bookings sb ON ss.source_booking_id = sb.id
    LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
    WHERE sb.id IS NULL OR tb.id IS NULL;
    
    -- Test 5: Verify helper functions work correctly
    RETURN QUERY
    SELECT 
        'helper_function_integrity'::text,
        COUNT(*) > 0,
        CONCAT('Helper functions returned data for ', COUNT(*), ' swaps')
    FROM get_user_swaps_with_relationships((SELECT user_id FROM bookings LIMIT 1));
END;
$ LANGUAGE plpgsql;

-- Step 12: Run post-migration validation
DO $
DECLARE
    validation_result RECORD;
    has_errors BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE 'Running post-migration data integrity validation...';
    
    FOR validation_result IN SELECT * FROM validate_simplified_schema_integrity() LOOP
        IF NOT validation_result.passed THEN
            RAISE WARNING 'Post-migration validation failed: % - %', validation_result.test_name, validation_result.details;
            has_errors := TRUE;
        ELSE
            RAISE NOTICE 'Post-migration validation passed: %', validation_result.test_name;
        END IF;
    END LOOP;
    
    IF has_errors THEN
        RAISE EXCEPTION 'Post-migration validation failed. Schema simplification may have introduced issues.';
    END IF;
    
    RAISE NOTICE 'Post-migration validation completed successfully.';
END;
$;

-- Step 13: Create rollback function for emergency use
CREATE OR REPLACE FUNCTION rollback_schema_simplification()
RETURNS void AS $
BEGIN
    RAISE NOTICE 'Starting schema simplification rollback...';
    
    -- Drop simplified schema objects
    DROP FUNCTION IF EXISTS get_swap_with_relationships(UUID);
    DROP FUNCTION IF EXISTS get_user_swaps_with_relationships(UUID);
    DROP FUNCTION IF EXISTS validate_simplified_schema_integrity();
    
    -- Drop new indexes
    DROP INDEX IF EXISTS idx_swaps_source_booking_user;
    DROP INDEX IF EXISTS idx_swaps_status_created;
    DROP INDEX IF EXISTS idx_bookings_user_swap_lookup;
    DROP INDEX IF EXISTS idx_swap_targets_relationships;
    DROP INDEX IF EXISTS idx_swap_targets_active;
    DROP INDEX IF EXISTS idx_swaps_targeted;
    DROP INDEX IF EXISTS idx_swap_targets_source_status;
    DROP INDEX IF EXISTS idx_swap_targets_target_status;
    
    -- Restore tables from backup
    DROP TABLE IF EXISTS swaps CASCADE;
    DROP TABLE IF EXISTS swap_targets CASCADE;
    
    ALTER TABLE swaps_backup RENAME TO swaps;
    ALTER TABLE swap_targets_backup RENAME TO swap_targets;
    
    -- Recreate original indexes
    CREATE INDEX idx_swaps_source_booking_id ON swaps(source_booking_id);
    CREATE INDEX idx_swaps_target_booking_id ON swaps(target_booking_id);
    CREATE INDEX idx_swaps_proposer_id ON swaps(proposer_id);
    CREATE INDEX idx_swaps_owner_id ON swaps(owner_id);
    CREATE INDEX idx_swaps_status ON swaps(status);
    CREATE INDEX idx_swaps_expires_at ON swaps(expires_at);
    CREATE INDEX idx_swaps_proposed_at ON swaps(proposed_at);
    CREATE INDEX idx_swaps_blockchain_proposal_transaction_id ON swaps(blockchain_proposal_transaction_id);
    CREATE INDEX idx_swaps_blockchain_execution_transaction_id ON swaps(blockchain_execution_transaction_id);
    CREATE INDEX idx_swaps_user_status ON swaps(proposer_id, status);
    CREATE INDEX idx_swaps_owner_status ON swaps(owner_id, status);
    CREATE INDEX idx_swaps_booking_status ON swaps(source_booking_id, status);
    
    -- Recreate swap_targets indexes
    CREATE INDEX idx_swap_targets_source ON swap_targets(source_swap_id);
    CREATE INDEX idx_swap_targets_target ON swap_targets(target_swap_id);
    CREATE INDEX idx_swap_targets_proposal ON swap_targets(proposal_id);
    CREATE INDEX idx_swap_targets_status ON swap_targets(status);
    CREATE INDEX idx_swap_targets_created ON swap_targets(created_at DESC);
    CREATE INDEX idx_swap_targets_target_status ON swap_targets(target_swap_id, status);
    CREATE INDEX idx_swap_targets_source_status ON swap_targets(source_swap_id, status);
    
    -- Recreate original constraints
    ALTER TABLE swaps ADD CONSTRAINT check_different_bookings CHECK (source_booking_id != target_booking_id);
    ALTER TABLE swaps ADD CONSTRAINT check_different_users CHECK (proposer_id != owner_id);
    ALTER TABLE swaps ADD CONSTRAINT check_expires_future CHECK (expires_at > NOW());
    ALTER TABLE swaps ADD CONSTRAINT check_responded_after_proposed CHECK (responded_at IS NULL OR responded_at >= proposed_at);
    ALTER TABLE swaps ADD CONSTRAINT check_completed_after_responded CHECK (completed_at IS NULL OR (responded_at IS NOT NULL AND completed_at >= responded_at));
    
    -- Recreate triggers
    CREATE TRIGGER update_swaps_updated_at 
        BEFORE UPDATE ON swaps 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
        
    CREATE TRIGGER update_swap_targets_updated_at 
        BEFORE UPDATE ON swap_targets 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    
    RAISE NOTICE 'Schema simplification rollback completed successfully.';
END;
$ LANGUAGE plpgsql;

-- Step 14: Add documentation comments
COMMENT ON FUNCTION validate_swap_schema_integrity() IS 'Validates data integrity before schema simplification migration';
COMMENT ON FUNCTION validate_simplified_schema_integrity() IS 'Validates data integrity after schema simplification migration';
COMMENT ON FUNCTION get_swap_with_relationships(UUID) IS 'Helper function to get swap with all derived relationships';
COMMENT ON FUNCTION get_user_swaps_with_relationships(UUID) IS 'Helper function to get user swaps with all derived relationships';
COMMENT ON FUNCTION rollback_schema_simplification() IS 'Emergency rollback function to restore original schema from backup tables';

-- Final success message
DO $
BEGIN
    RAISE NOTICE '=== Migration 027: Schema Simplification Completed Successfully ===';
    RAISE NOTICE 'Removed columns: swaps.target_booking_id, swaps.proposer_id, swaps.owner_id, swap_targets.proposal_id';
    RAISE NOTICE 'Created helper functions for derived relationships';
    RAISE NOTICE 'Backup tables created: swaps_backup, swap_targets_backup';
    RAISE NOTICE 'Use rollback_schema_simplification() function if rollback is needed';
END;
$;