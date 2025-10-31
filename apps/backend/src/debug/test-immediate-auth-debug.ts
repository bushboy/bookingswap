#!/usr/bin/env ts-node

import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../../.env') });

import { AuthService } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { AuthMiddleware } from '../middleware/auth';
import { ImmediateAuthDebugger } from './immediate-auth-debug';
import { DatabaseConnection } from '../database/connection';
import { enhancedLogger } from '../utils/logger';

async function testImmediateAuthDebug() {
    console.log('🔍 Starting Immediate Authentication Debug Test');
    console.log('================================================');

    try {
        // Initialize database connection
        console.log('📊 Initializing database connection...');
        const db = new DatabaseConnection();
        await db.connect();

        // Initialize services
        console.log('🔧 Initializing services...');
        const authService = new AuthService();
        const userRepository = new UserRepository(db);
        const authMiddleware = new AuthMiddleware(authService, userRepository);

        // Initialize debugger
        const authDebugger = new ImmediateAuthDebugger(authService, userRepository, authMiddleware);

        console.log('✅ Services initialized successfully');
        console.log('');

        // Test 1: Check JWT configuration
        console.log('🔑 Test 1: JWT Configuration Check');
        console.log('----------------------------------');
        const jwtSecret = process.env.JWT_SECRET;
        console.log(`JWT_SECRET configured: ${!!jwtSecret}`);
        console.log(`JWT_SECRET length: ${jwtSecret?.length || 0}`);
        if (jwtSecret && jwtSecret.length >= 8) {
            console.log(`JWT_SECRET preview: ${jwtSecret.substring(0, 4)}...${jwtSecret.substring(jwtSecret.length - 4)}`);
        }
        console.log('');

        // Test 2: Test with sample tokens
        console.log('🧪 Test 2: Sample Token Tests');
        console.log('------------------------------');

        const testTokens = [
            {
                name: 'Missing Token',
                token: '',
            },
            {
                name: 'Invalid Format (no Bearer)',
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.invalid',
            },
            {
                name: 'Invalid JWT Structure',
                token: 'Bearer invalid.token',
            },
            {
                name: 'Valid Format (but likely invalid signature)',
                token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItaWQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNzM0NDU2MDAwLCJleHAiOjE3MzQ0NTk2MDB9.invalid_signature',
            },
        ];

        for (const testCase of testTokens) {
            console.log(`\n📝 Testing: ${testCase.name}`);
            console.log(`Token: ${testCase.token.substring(0, 50)}${testCase.token.length > 50 ? '...' : ''}`);

            try {
                const debugInfo = await authDebugger.debugTokenAuthentication(testCase.token);

                console.log(`Result: ${debugInfo.finalResult}`);
                console.log(`Auth Header Present: ${debugInfo.authHeader.present}`);
                console.log(`Token Format: ${debugInfo.token.format}`);
                console.log(`JWT Secret Configured: ${debugInfo.jwtConfig.secretConfigured}`);
                console.log(`Verification Attempted: ${debugInfo.verification.attempted}`);
                console.log(`Verification Success: ${debugInfo.verification.success}`);

                if (debugInfo.verification.error) {
                    console.log(`Verification Error: ${debugInfo.verification.error}`);
                }

                if (debugInfo.token.decodedPayload) {
                    console.log(`Decoded User ID: ${debugInfo.token.decodedPayload.userId}`);
                    console.log(`Token Expired: ${debugInfo.token.decodedPayload.isExpired}`);
                }

                console.log(`User Lookup Attempted: ${debugInfo.userLookup.attempted}`);
                console.log(`User Found: ${debugInfo.userLookup.userFound}`);

                if (debugInfo.userLookup.error) {
                    console.log(`User Lookup Error: ${debugInfo.userLookup.error}`);
                }

            } catch (error) {
                console.log(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        console.log('\n');
        console.log('🎯 Test 3: Authentication Flow Test');
        console.log('------------------------------------');

        // Test the full authentication flow with a sample token
        const sampleAuthHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItaWQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNzM0NDU2MDAwLCJleHAiOjE3MzQ0NTk2MDB9.test_signature';

        try {
            const flowResult = await authDebugger.testAuthenticationFlow(sampleAuthHeader);

            console.log(`Debug Result: ${flowResult.debugInfo.finalResult}`);
            console.log(`Middleware Result: ${flowResult.middlewareResult}`);

            if (flowResult.middlewareError) {
                console.log(`Middleware Error: ${flowResult.middlewareError}`);
            }

        } catch (error) {
            console.log(`❌ Flow test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        console.log('\n');
        console.log('📋 Instructions for Real Token Testing');
        console.log('======================================');
        console.log('To test with a real user token:');
        console.log('1. Login to the application and get a valid token');
        console.log('2. Use the debug endpoint: POST /api/debug/auth/analyze-token');
        console.log('3. Send the token in the request body: { "token": "Bearer your_token_here" }');
        console.log('4. Or use the test script with a real token:');
        console.log('   node -e "require(\'./test-immediate-auth-debug\').testRealToken(\'Bearer your_token\')"');
        console.log('');

        await db.disconnect();
        console.log('✅ Debug test completed successfully');

    } catch (error) {
        console.error('❌ Debug test failed:', error instanceof Error ? error.message : 'Unknown error');
        console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
        process.exit(1);
    }
}

// Function to test with a real token (can be called externally)
export async function testRealToken(authHeader: string) {
    console.log('🔍 Testing Real Token');
    console.log('====================');

    try {
        // Initialize database connection
        const db = new DatabaseConnection();
        await db.connect();

        // Initialize services
        const authService = new AuthService();
        const userRepository = new UserRepository(db);
        const authMiddleware = new AuthMiddleware(authService, userRepository);

        // Initialize debugger
        const authDebugger = new ImmediateAuthDebugger(authService, userRepository, authMiddleware);

        console.log(`Testing token: ${authHeader.substring(0, 50)}...`);

        const result = await authDebugger.testAuthenticationFlow(authHeader);

        console.log('\n📊 Debug Results:');
        console.log('=================');
        console.log(`Final Result: ${result.debugInfo.finalResult}`);
        console.log(`Middleware Result: ${result.middlewareResult}`);

        if (result.debugInfo.token.decodedPayload) {
            console.log(`User ID: ${result.debugInfo.token.decodedPayload.userId}`);
            console.log(`Email: ${result.debugInfo.token.decodedPayload.email}`);
            console.log(`Expires: ${result.debugInfo.token.decodedPayload.expiresAt}`);
            console.log(`Is Expired: ${result.debugInfo.token.decodedPayload.isExpired}`);
        }

        console.log(`JWT Secret Configured: ${result.debugInfo.jwtConfig.secretConfigured}`);
        console.log(`Verification Success: ${result.debugInfo.verification.success}`);
        console.log(`User Found: ${result.debugInfo.userLookup.userFound}`);

        if (result.debugInfo.verification.error) {
            console.log(`Verification Error: ${result.debugInfo.verification.error}`);
        }

        if (result.debugInfo.userLookup.error) {
            console.log(`User Lookup Error: ${result.debugInfo.userLookup.error}`);
        }

        if (result.middlewareError) {
            console.log(`Middleware Error: ${result.middlewareError}`);
        }

        await db.disconnect();

    } catch (error) {
        console.error('❌ Real token test failed:', error instanceof Error ? error.message : 'Unknown error');
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testImmediateAuthDebug().catch(console.error);
}