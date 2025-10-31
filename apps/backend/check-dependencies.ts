import { Pool } from 'pg';
import { parse } from 'pg-connection-string';

async function checkDependencies() {
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
        console.log('Checking database dependencies...');

        const client = await pool.connect();

        // Check for views that depend on the columns we want to drop
        console.log('\nChecking views and materialized views...');
        const viewsResult = await client.query(`
      SELECT 
        schemaname,
        viewname,
        definition
      FROM pg_views 
      WHERE definition ILIKE '%target_booking_id%' 
         OR definition ILIKE '%proposer_id%' 
         OR definition ILIKE '%owner_id%'
         OR definition ILIKE '%proposal_id%'
      ORDER BY viewname;
    `);

        console.log('Views that reference columns to be dropped:');
        for (const row of viewsResult.rows) {
            console.log(`\n--- View: ${row.schemaname}.${row.viewname} ---`);
            console.log(row.definition);
        }

        // Check for materialized views
        const matViewsResult = await client.query(`
      SELECT 
        schemaname,
        matviewname,
        definition
      FROM pg_matviews 
      WHERE definition ILIKE '%target_booking_id%' 
         OR definition ILIKE '%proposer_id%' 
         OR definition ILIKE '%owner_id%'
         OR definition ILIKE '%proposal_id%'
      ORDER BY matviewname;
    `);

        console.log('\nMaterialized views that reference columns to be dropped:');
        for (const row of matViewsResult.rows) {
            console.log(`\n--- Materialized View: ${row.schemaname}.${row.matviewname} ---`);
            console.log(row.definition);
        }

        // Check for functions that might depend on these columns
        console.log('\nChecking functions...');
        const functionsResult = await client.query(`
      SELECT 
        n.nspname as schema_name,
        p.proname as function_name,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE pg_get_functiondef(p.oid) ILIKE '%target_booking_id%' 
         OR pg_get_functiondef(p.oid) ILIKE '%proposer_id%' 
         OR pg_get_functiondef(p.oid) ILIKE '%owner_id%'
         OR pg_get_functiondef(p.oid) ILIKE '%proposal_id%'
      ORDER BY function_name;
    `);

        console.log('Functions that reference columns to be dropped:');
        for (const row of functionsResult.rows) {
            console.log(`\n--- Function: ${row.schema_name}.${row.function_name} ---`);
            console.log(row.definition.substring(0, 500) + '...');
        }

        client.release();

    } catch (error) {
        console.error('Dependency check failed:', error);
    } finally {
        await pool.end();
    }
}

checkDependencies();