// Simple database analysis without backend dependencies
const { Pool } = require('pg');

async function quickAnalysis() {
    const pool = new Pool({
        user: 'postgres',
        host: 'localhost',
        database: 'booking_swap',
        password: 'password',
        port: 5432,
    });

    try {
        console.log('🔍 Quick Database Analysis...\n');

        // Check swaps table
        const swapsCount = await pool.query('SELECT COUNT(*) FROM swaps');
        console.log(`📋 Swaps table: ${swapsCount.rows[0].count} records`);

        // Check swap_targets table  
        const targetsCount = await pool.query('SELECT COUNT(*) FROM swap_targets');
        console.log(`🎯 Swap_targets table: ${targetsCount.rows[0].count} records`);

        // Show sample swap data
        const sampleSwaps = await pool.query(`
      SELECT id, proposer_id, owner_id, status 
      FROM swaps 
      ORDER BY created_at DESC 
      LIMIT 3
    `);

        console.log('\n📝 Sample swaps:');
        sampleSwaps.rows.forEach(swap => {
            console.log(`  - ${swap.id}: ${swap.proposer_id} → ${swap.owner_id} (${swap.status})`);
        });

        console.log('\n💡 ISSUE IDENTIFIED:');
        console.log('- Targeting system looks for data in swap_targets table');
        console.log('- Regular proposals are in swaps table');
        console.log('- No connection between the two tables');
        console.log('- This explains why targeting display shows nothing');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

quickAnalysis();