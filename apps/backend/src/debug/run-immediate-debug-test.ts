#!/usr/bin/env ts-node

/**
 * Quick test script for immediate authentication debugging
 * Usage: 
 *   npm run debug:immediate
 *   or
 *   ts-node src/debug/run-immediate-debug-test.ts
 */

import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../../.env') });

import { testImmediateAuthDebug, testRealToken } from './test-immediate-auth-debug';

async function main() {
    const args = process.argv.slice(2);

    if (args.length > 0 && args[0].startsWith('Bearer ')) {
        // Test with provided token
        console.log('🔍 Testing with provided token...');
        await testRealToken(args[0]);
    } else if (args.length > 0) {
        // Test with provided token (add Bearer prefix if missing)
        console.log('🔍 Testing with provided token (adding Bearer prefix)...');
        await testRealToken(`Bearer ${args[0]}`);
    } else {
        // Run general debug tests
        console.log('🔍 Running immediate authentication debug tests...');
        await testImmediateAuthDebug();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Debug test failed:', error);
        process.exit(1);
    });
}