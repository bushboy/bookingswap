const { Pool } = require('pg');

// Simple database check without backend dependencies
async function checkDatabase() {
    const pool = new Pool({
        user: 'postgres',
        host: 'localhost',
        database: 'booking_swap',
        password: 'password',
        port: 5432,
    });

    try {
        console.log('🔍 Checking database for swap targeting data...\n');

        // Check swaps table
        const swapsResult = await pool.query('SELECT COUNT(*) as count FROM swaps');
        console.log(`📋 Total swaps: ${swapsResult.rows[0].count}`);

        // Check swap_targets table
        const targetsResult = await pool.query('SELECT COUNT(*) as count FROM swap_targets');
        console.log(`🎯 Total targeting relationships: ${targetsResult.rows[0].count}`);

        // Check if tables exist
        const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('swaps', 'swap_targets', 'bookings', 'users')
      ORDER BY table_name
    `);

        console.log('\n📊 Available tables:');
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        // Sample data from swaps if any exist
        if (parseInt(swapsResult.rows[0].count) > 0) {
            const sampleSwaps = await pool.query(`
        SELECT id, owner_id, status, created_at 
        FROM swaps 
        ORDER BY created_at DESC 
        LIMIT 3
      `);

            console.log('\n📝 Sample swaps:');
            sampleSwaps.rows.forEach(swap => {
                console.log(`  - ${swap.id} (Owner: ${swap.owner_id}, Status: ${swap.status})`);
            });
        }

        // Sample data from swap_targets if any exist
        if (parseInt(targetsResult.rows[0].count) > 0) {
            const sampleTargets = await pool.query(`
        SELECT id, source_swap_id, target_swap_id, status 
        FROM swap_targets 
        ORDER BY created_at DESC 
        LIMIT 3
      `);

            console.log('\n🎯 Sample targeting relationships:');
            sampleTargets.rows.forEach(target => {
                console.log(`  - ${target.source_swap_id} → ${target.target_swap_id} (${target.status})`);
            });
        }

    } catch (error) {
        console.error('❌ Database error:', error.message);
    } finally {
        await pool.end();
    }
}

checkDatabase();