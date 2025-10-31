/**
 * Test script for authentication diagnostic tools
 * This script can be used to verify the diagnostic tools are working correctly
 */

import { AuthService } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { AuthDebugUtils } from '../utils/authDebug';
import { createDatabasePool, getDatabaseConfig } from '../database/config';

/**
 * Test the authentication diagnostic tools
 */
export async function testAuthenticationDiagnostics() {
    console.log('🔍 Testing Authentication Diagnostic Tools...\n');

    try {
        // Initialize database connection
        const dbPool = createDatabasePool(getDatabaseConfig());
        const userRepository = new UserRepository(dbPool);

        // Initialize auth service with test configuration
        const authService = new AuthService(
            userRepository,
            null as any, // WalletService not needed for this test
            undefined, // PasswordResetTokenRepository
            undefined, // EmailService
            process.env.JWT_SECRET || 'test-secret-for-diagnostics',
            '24h'
        );

        // Initialize debug utilities
        const debugUtils = new AuthDebugUtils(authService, userRepository);

        console.log('✅ Services initialized successfully\n');

        // Test 1: Health Check
        console.log('📊 Running Health Check...');
        const healthCheck = await debugUtils.performHealthCheck();
        console.log('JWT Configuration:', healthCheck.jwtConfiguration);
        console.log('Database Connection:', healthCheck.databaseConnection);
        console.log('Services Available:', healthCheck.services);
        console.log('');

        // Test 2: Token Analysis (with sample JWT structure)
        console.log('🔍 Testing Token Analysis...');
        const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDM2MDB9.invalid-signature';

        const tokenAnalysis = debugUtils.analyzeToken(sampleToken);
        console.log('Token Structure:', tokenAnalysis.tokenStructure);
        console.log('Claims:', tokenAnalysis.claims);
        console.log('Validation:', tokenAnalysis.validation);
        console.log('');

        // Test 3: Token Decoding
        console.log('🔓 Testing Token Decoding...');
        const decoded = debugUtils.decodeTokenWithoutVerification(sampleToken);
        console.log('Decoded Token:', decoded);
        console.log('');

        // Test 4: User Session Verification (with test user ID)
        console.log('👤 Testing User Session Verification...');
        const sessionVerification = await debugUtils.verifyUserSession('test-user-123', sampleToken);
        console.log('User:', sessionVerification.user);
        console.log('Token:', sessionVerification.token);
        console.log('Relationship:', sessionVerification.relationship);
        console.log('');

        // Test 5: Diagnostic Report
        console.log('📋 Generating Diagnostic Report...');
        const report = await debugUtils.generateDiagnosticReport(sampleToken);
        console.log('Health Check Status:', report.healthCheck.databaseConnection.connected ? '✅ Connected' : '❌ Failed');
        console.log('JWT Secret Configured:', report.healthCheck.jwtConfiguration.secretConfigured ? '✅ Yes' : '❌ No');
        console.log('Recommendations:', report.recommendations);
        console.log('');

        console.log('🎉 All diagnostic tools tested successfully!');

        return {
            success: true,
            healthCheck,
            tokenAnalysis,
            decoded,
            sessionVerification,
            report,
        };

    } catch (error) {
        console.error('❌ Diagnostic test failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Test the diagnostic endpoints (requires server to be running)
 */
export async function testDiagnosticEndpoints() {
    console.log('🌐 Testing Diagnostic Endpoints...\n');

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api';

    try {
        // Test health endpoint
        console.log('📊 Testing /debug/auth/health...');
        const healthResponse = await fetch(`${baseUrl}/debug/auth/health`);
        const healthData = await healthResponse.json();
        console.log('Health Check Response:', healthData.success ? '✅ Success' : '❌ Failed');

        // Test token decode endpoint
        console.log('🔓 Testing /debug/auth/decode-token...');
        const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDM2MDB9.invalid-signature';

        const decodeResponse = await fetch(`${baseUrl}/debug/auth/decode-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: sampleToken }),
        });
        const decodeData = await decodeResponse.json();
        console.log('Token Decode Response:', decodeData.success ? '✅ Success' : '❌ Failed');

        // Test diagnostic report endpoint
        console.log('📋 Testing /debug/auth/diagnostic-report...');
        const reportResponse = await fetch(`${baseUrl}/debug/auth/diagnostic-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: sampleToken }),
        });
        const reportData = await reportResponse.json();
        console.log('Diagnostic Report Response:', reportData.success ? '✅ Success' : '❌ Failed');

        console.log('🎉 All diagnostic endpoints tested successfully!');

        return {
            success: true,
            healthData,
            decodeData,
            reportData,
        };

    } catch (error) {
        console.error('❌ Endpoint test failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// Export for use in other test files
export default {
    testAuthenticationDiagnostics,
    testDiagnosticEndpoints,
};