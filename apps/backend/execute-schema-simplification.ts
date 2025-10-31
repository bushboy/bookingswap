import { Pool } from 'pg';
import { parse } from 'pg-connection-string';

async function executeSchemaSimplification() {
    // Parse database configuration
    let poolConfig;

    if (process.env.DATABASE_URL) {
        const parsed = parse(process.env.DATABASE_URL);
        poolConfig = {
            host: parsed.host || 'localhost',
            port: parseInt(parsed.port || '5432'),
            database: parsed.database || 'booking_swap_db',
            user: parsed.user || 'postgres',
            password: parsed.password || 'password',
        };
    } else {
        poolConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'booking_swap_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
        };
    }

    const pool = new Pool(poolConfig);

    try {
        console.log('Starting schema simplification migration...');

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Step 1: Create backup tables
            console.log('Step 1: Creating backup tables...');
            await client.query('CREATE TABLE swaps_backup AS SELECT * FROM swaps');
            await client.query('CREATE TABLE swap_targets_backup AS SELECT * FROM swap_targets');
            await client.query("COMMENT ON TABLE swaps_backup IS 'Backup of swaps table before schema simplification migration 027'");
            await client.query("COMMENT ON TABLE swap_targets_backup IS 'Backup of swap_targets table before schema simplification migration 027'");
            console.log('✓ Backup tables created');

            // Step 2: Create validation function
            console.log('Step 2: Creating validation functions...');
            await client.query(`
        CREATE OR REPLACE FUNCTION validate_swap_schema_integrity()
        RETURNS TABLE(test_name text, passed boolean, details text) AS $$
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
        END;
        $$ LANGUAGE plpgsql;
      `);
            console.log('✓ Validation function created');

            // Step 3: Run pre-migration validation
            console.log('Step 3: Running pre-migration validation...');
            const validationResult = await client.query('SELECT * FROM validate_swap_schema_integrity()');

            let hasErrors = false;
            for (const row of validationResult.rows) {
                if (!row.passed) {
                    console.log(`  ✗ ${row.test_name}: ${row.details}`);
                    hasErrors = true;
                } else {
                    console.log(`  ✓ ${row.test_name}: passed`);
                }
            }

            if (hasErrors) {
                throw new Error('Pre-migration validation failed. Please fix data integrity issues before proceeding.');
            }

            // Step 4: Drop constraints and indexes
            console.log('Step 4: Dropping constraints and indexes...');
            await client.query('ALTER TABLE swaps DROP CONSTRAINT IF EXISTS check_different_bookings');
            await client.query('ALTER TABLE swaps DROP CONSTRAINT IF EXISTS check_different_users');
            await client.query('DROP INDEX IF EXISTS idx_swaps_target_booking_id');
            await client.query('DROP INDEX IF EXISTS idx_swaps_proposer_id');
            await client.query('DROP INDEX IF EXISTS idx_swaps_owner_id');
            await client.query('DROP INDEX IF EXISTS idx_swaps_user_status');
            await client.query('DROP INDEX IF EXISTS idx_swaps_owner_status');
            await client.query('DROP INDEX IF EXISTS idx_swap_targets_proposal');
            await client.query('DROP INDEX IF EXISTS idx_swaps_owner_targeted');
            console.log('✓ Constraints and indexes dropped');

            // Step 5: Handle dependent views before removing columns
            console.log('Step 5: Handling dependent views...');

            // Drop the materialized view that depends on target_booking_id
            await client.query('DROP MATERIALIZED VIEW IF EXISTS popular_bookings');
            console.log('  ✓ Dropped popular_bookings materialized view');

            // Drop the view that depends on target_booking_id
            await client.query('DROP VIEW IF EXISTS swap_matching_performance');
            console.log('  ✓ Dropped swap_matching_performance view');

            // Step 5a: Remove redundant columns
            console.log('Step 5a: Removing redundant columns...');
            await client.query('ALTER TABLE swaps DROP COLUMN IF EXISTS target_booking_id');
            await client.query('ALTER TABLE swaps DROP COLUMN IF EXISTS proposer_id');
            await client.query('ALTER TABLE swaps DROP COLUMN IF EXISTS owner_id');
            await client.query('ALTER TABLE swap_targets DROP COLUMN IF EXISTS proposal_id');
            console.log('✓ Redundant columns removed');

            // Step 5b: Recreate views with simplified schema
            console.log('Step 5b: Recreating views with simplified schema...');

            // Recreate swap_matching_performance view with derived relationships
            await client.query(`
                CREATE VIEW swap_matching_performance AS
                SELECT 'total_active_swaps'::text AS metric_name,
                    count(*) AS metric_value,
                    'count'::text AS unit
                FROM swaps
                WHERE ((swaps.status)::text = 'active'::text)
                UNION ALL
                SELECT 'total_pending_proposals'::text AS metric_name,
                    count(*) AS metric_value,
                    'count'::text AS unit
                FROM swaps
                WHERE ((swaps.status)::text = 'pending'::text)
                UNION ALL
                SELECT 'avg_proposals_per_swap'::text AS metric_name,
                    COALESCE(avg(proposal_stats.proposal_count), (0)::numeric) AS metric_value,
                    'count'::text AS unit
                FROM ( 
                    SELECT s1.id,
                        count(st.target_swap_id) AS proposal_count
                    FROM swaps s1
                    LEFT JOIN swap_targets st ON st.source_swap_id = s1.id AND st.status = 'active'
                    WHERE ((s1.status)::text = 'active'::text)
                    GROUP BY s1.id
                ) proposal_stats
                UNION ALL
                SELECT 'compatibility_cache_size'::text AS metric_name,
                    count(*) AS metric_value,
                    'entries'::text AS unit
                FROM swap_compatibility_cache
                UNION ALL
                SELECT 'eligible_swaps_cache_size'::text AS metric_name,
                    count(*) AS metric_value,
                    'entries'::text AS unit
                FROM eligible_swaps_cache;
            `);
            console.log('  ✓ Recreated swap_matching_performance view');

            // Recreate popular_bookings materialized view with derived relationships
            await client.query(`
                CREATE MATERIALIZED VIEW popular_bookings AS
                SELECT b.id,
                    b.user_id,
                    b.type,
                    b.title,
                    b.description,
                    b.city,
                    b.country,
                    b.coordinates,
                    b.check_in_date,
                    b.check_out_date,
                    b.original_price,
                    b.swap_value,
                    b.provider_name,
                    b.confirmation_number,
                    b.booking_reference,
                    b.verification_status,
                    b.verification_documents,
                    b.verified_at,
                    b.blockchain_transaction_id,
                    b.blockchain_consensus_timestamp,
                    b.blockchain_topic_id,
                    b.status,
                    b.created_at,
                    b.updated_at,
                    b.search_vector,
                    b.city_normalized,
                    b.country_normalized,
                    count(DISTINCT s.id) + count(DISTINCT st.source_swap_id) AS proposal_count,
                    GREATEST(max(s.created_at), max(st.created_at)) AS latest_proposal_date
                FROM bookings b
                LEFT JOIN swaps s ON s.source_booking_id = b.id
                LEFT JOIN swap_targets st ON st.target_swap_id = (
                    SELECT s2.id FROM swaps s2 WHERE s2.source_booking_id = b.id LIMIT 1
                )
                WHERE ((b.status)::text = 'available'::text) 
                AND (b.created_at > (now() - '30 days'::interval))
                GROUP BY b.id
                ORDER BY (count(DISTINCT s.id) + count(DISTINCT st.source_swap_id)) DESC, b.created_at DESC;
            `);
            console.log('  ✓ Recreated popular_bookings materialized view');

            // Refresh the materialized view
            await client.query('REFRESH MATERIALIZED VIEW popular_bookings');
            console.log('  ✓ Refreshed popular_bookings materialized view');

            // Step 6: Create optimized indexes
            console.log('Step 6: Creating optimized indexes...');
            await client.query('CREATE INDEX IF NOT EXISTS idx_swaps_source_booking_user ON swaps(source_booking_id)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_swaps_status_created ON swaps(status, created_at DESC)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_user_swap_lookup ON bookings(user_id, id)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_swap_targets_relationships ON swap_targets(source_swap_id, target_swap_id, status)');
            await client.query("CREATE INDEX IF NOT EXISTS idx_swap_targets_active ON swap_targets(target_swap_id) WHERE status = 'active'");
            await client.query('CREATE INDEX IF NOT EXISTS idx_swaps_targeted ON swaps(is_targeted, target_count) WHERE is_targeted = true');
            await client.query('CREATE INDEX IF NOT EXISTS idx_swap_targets_source_status ON swap_targets(source_swap_id, status)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_swap_targets_target_status ON swap_targets(target_swap_id, status)');
            console.log('✓ Optimized indexes created');

            // Step 7: Add new constraints
            console.log('Step 7: Adding new constraints...');
            await client.query('ALTER TABLE swaps DROP CONSTRAINT IF EXISTS check_expires_future');
            await client.query('ALTER TABLE swaps ADD CONSTRAINT check_expires_future CHECK (expires_at > NOW())');
            console.log('✓ New constraints added');

            // Step 8: Create helper functions
            console.log('Step 8: Creating helper functions...');
            await client.query(`
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
        ) AS $$
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
        $$ LANGUAGE plpgsql;
      `);

            await client.query(`
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
        ) AS $$
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
        $$ LANGUAGE plpgsql;
      `);
            console.log('✓ Helper functions created');

            // Step 9: Create post-migration validation function
            console.log('Step 9: Creating post-migration validation function...');
            await client.query(`
        CREATE OR REPLACE FUNCTION validate_simplified_schema_integrity()
        RETURNS TABLE(test_name text, passed boolean, details text) AS $$
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
        END;
        $$ LANGUAGE plpgsql;
      `);
            console.log('✓ Post-migration validation function created');

            // Step 10: Run post-migration validation
            console.log('Step 10: Running post-migration validation...');
            const postValidationResult = await client.query('SELECT * FROM validate_simplified_schema_integrity()');

            hasErrors = false;
            for (const row of postValidationResult.rows) {
                if (!row.passed) {
                    console.log(`  ✗ ${row.test_name}: ${row.details}`);
                    hasErrors = true;
                } else {
                    console.log(`  ✓ ${row.test_name}: passed`);
                }
            }

            if (hasErrors) {
                throw new Error('Post-migration validation failed. Schema simplification may have introduced issues.');
            }

            // Step 11: Create rollback function
            console.log('Step 11: Creating rollback function...');
            await client.query(`
        CREATE OR REPLACE FUNCTION rollback_schema_simplification()
        RETURNS void AS $$
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
            
            RAISE NOTICE 'Schema simplification rollback completed successfully.';
        END;
        $$ LANGUAGE plpgsql;
      `);
            console.log('✓ Rollback function created');

            // Step 12: Record migration as executed
            console.log('Step 12: Recording migration...');
            await client.query(
                'INSERT INTO migrations (id, filename) VALUES ($1, $2)',
                ['027_simplify_swap_schema', '027_simplify_swap_schema.sql']
            );

            await client.query('COMMIT');
            console.log('✓ Schema simplification migration completed successfully!');

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('✗ Migration failed:', error);
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Schema simplification failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

executeSchemaSimplification()
    .then(() => {
        console.log('\n=== Schema Simplification Complete ===');
        console.log('Removed columns: swaps.target_booking_id, swaps.proposer_id, swaps.owner_id, swap_targets.proposal_id');
        console.log('Created helper functions for derived relationships');
        console.log('Backup tables created: swaps_backup, swap_targets_backup');
        console.log('Use rollback_schema_simplification() function if rollback is needed');
        process.exit(0);
    });