#!/usr/bin/env ts-node

/**
 * Test the /swaps endpoint directly with authentication debugging
 * This script will help identify exactly where the 401 error is occurring
 */

import { config } from 'dotenv';
import path from 'path';
import axios from 'axios';

// Load environment variables
config({ path: path.join(__dirname, '../../.env') });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

interface TestResult {
    endpoint: string;
    method: string;
    status: number;
    success: boolean;
    data?: any;
    error?: string;
    headers?: any;
}

async function testSwapsEndpoint(authToken?: string): Promise<TestResult[]> {
    const results: TestResult[] = [];

    console.log('🔍 Testing /swaps endpoint with immediate debugging');
    console.log('==================================================');
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Auth Token: ${authToken ? `${authToken.substring(0, 30)}...` : 'None provided'}`);
    console.log('');

    // Test 1: GET /api/swaps without token
    console.log('📝 Test 1: GET /api/swaps (no auth)');
    try {
        const response = await axios.get(`${API_BASE_URL}/api/swaps`, {
            validateStatus: () => true, // Don't throw on 4xx/5xx
        });

        results.push({
            endpoint: '/api/swaps',
            method: 'GET',
            status: response.status,
            success: response.status === 200,
            data: response.data,
            headers: response.headers,
        });

        console.log(`Status: ${response.status}`);
        console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
    } catch (error) {
        results.push({
            endpoint: '/api/swaps',
            method: 'GET',
            status: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        console.log(`❌ Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('');

    // Test 2: GET /api/swaps with token (if provided)
    if (authToken) {
        console.log('📝 Test 2: GET /api/swaps (with auth)');
        try {
            const response = await axios.get(`${API_BASE_URL}/api/swaps`, {
                headers: {
                    'Authorization': authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                validateStatus: () => true, // Don't throw on 4xx/5xx
            });

            results.push({
                endpoint: '/api/swaps',
                method: 'GET (with auth)',
                status: response.status,
                success: response.status === 200,
                data: response.data,
                headers: response.headers,
            });

            console.log(`Status: ${response.status}`);
            console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);

            // Check for new token in response headers
            if (response.headers['x-new-token']) {
                console.log(`🔄 New token provided: ${response.headers['x-new-token'].substring(0, 30)}...`);
            }

        } catch (error) {
            results.push({
                endpoint: '/api/swaps',
                method: 'GET (with auth)',
                status: 0,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            console.log(`❌ Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        console.log('');
    }

    // Test 3: Use debug endpoint to analyze the token
    if (authToken) {
        console.log('📝 Test 3: Debug token analysis');
        try {
            const response = await axios.post(`${API_BASE_URL}/api/debug/auth/immediate-analyze`, {
                token: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`,
            }, {
                validateStatus: () => true,
            });

            console.log(`Debug Analysis Status: ${response.status}`);
            console.log(`Debug Analysis Result: ${JSON.stringify(response.data, null, 2)}`);

        } catch (error) {
            console.log(`❌ Debug analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        console.log('');
    }

    // Test 4: Test authentication flow
    if (authToken) {
        console.log('📝 Test 4: Debug authentication flow');
        try {
            const response = await axios.post(`${API_BASE_URL}/api/debug/auth/immediate-flow-test`, {
                authHeader: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`,
            }, {
                validateStatus: () => true,
            });

            console.log(`Flow Test Status: ${response.status}`);
            console.log(`Flow Test Result: ${JSON.stringify(response.data, null, 2)}`);

        } catch (error) {
            console.log(`❌ Flow test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        console.log('');
    }

    // Test 5: Check current authentication state
    console.log('📝 Test 5: Check current auth state');
    try {
        const headers: any = {
            'Content-Type': 'application/json',
        };

        if (authToken) {
            headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
        }

        const response = await axios.get(`${API_BASE_URL}/api/debug/auth/immediate-state`, {
            headers,
            validateStatus: () => true,
        });

        console.log(`Auth State Status: ${response.status}`);
        console.log(`Auth State Result: ${JSON.stringify(response.data, null, 2)}`);

    } catch (error) {
        console.log(`❌ Auth state check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return results;
}

async function main() {
    const args = process.argv.slice(2);
    let authToken: string | undefined;

    if (args.length > 0) {
        authToken = args[0];
        console.log(`Using provided token: ${authToken.substring(0, 30)}...`);
    } else {
        console.log('No token provided. Testing without authentication.');
        console.log('Usage: ts-node test-swaps-endpoint-immediate.ts "Bearer your_token_here"');
    }

    console.log('');

    const results = await testSwapsEndpoint(authToken);

    console.log('');
    console.log('📊 Test Summary');
    console.log('===============');

    results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.method} ${result.endpoint}: ${result.success ? '✅' : '❌'} (${result.status})`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
    });

    console.log('');
    console.log('💡 Next Steps:');
    console.log('- If you see 401 errors, check the debug analysis results above');
    console.log('- Look for specific error messages in the authentication flow test');
    console.log('- Check if JWT_SECRET is properly configured');
    console.log('- Verify the token is not expired');
    console.log('- Ensure the user exists in the database');
}

if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}

export { testSwapsEndpoint };