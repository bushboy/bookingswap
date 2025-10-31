import { Pool } from 'pg';
import { parse } from 'pg-connection-string';

async function checkDatabaseStatus() {
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
        console.log('Checking database connection...');

        // Test connection
        const client = await pool.connect();
        console.log('✓ Database connection successful');

        // Check if swaps table exists and its structure
        console.log('\nChecking swaps table structure...');
        const swapsResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'swaps' 
      ORDER BY ordinal_position;
    `);

        if (swapsResult.rows.length > 0) {
            console.log('Swaps table columns:');
            swapsResult.rows.forEach(row => {
                console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
            });
        } else {
            console.log('Swaps table does not exist');
        }

        // Check if swap_targets table exists and its structure
        console.log('\nChecking swap_targets table structure...');
        const swapTargetsResult = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'swap_targets' 
      ORDER BY ordinal_position;
    `);

        if (swapTargetsResult.rows.length > 0) {
            console.log('Swap_targets table columns:');
            swapTargetsResult.rows.forEach(row => {
                console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
            });
        } else {
            console.log('Swap_targets table does not exist');
        }

        // Check executed migrations
        console.log('\nChecking executed migrations...');
        try {
            const migrationsResult = await client.query('SELECT id, executed_at FROM migrations ORDER BY id');
            console.log('Executed migrations:');
            migrationsResult.rows.forEach(row => {
                console.log(`  - ${row.id} (${row.executed_at})`);
            });
        } catch (error) {
            console.log('Migrations table does not exist or is not accessible');
        }

        // Check if the redundant columns still exist
        console.log('\nChecking for redundant columns...');
        const redundantColumns = ['target_booking_id', 'proposer_id', 'owner_id'];
        for (const column of redundantColumns) {
            const columnResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'swaps' AND column_name = $1;
      `, [column]);

            if (columnResult.rows.length > 0) {
                console.log(`  ✗ ${column} still exists in swaps table`);
            } else {
                console.log(`  ✓ ${column} has been removed from swaps table`);
            }
        }

        // Check swap_targets for proposal_id
        const proposalIdResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'swap_targets' AND column_name = 'proposal_id';
    `);

        if (proposalIdResult.rows.length > 0) {
            console.log(`  ✗ proposal_id still exists in swap_targets table`);
        } else {
            console.log(`  ✓ proposal_id has been removed from swap_targets table`);
        }

        client.release();

    } catch (error) {
        console.error('Database check failed:', error);
    } finally {
        await pool.end();
    }
}

checkDatabaseStatus();