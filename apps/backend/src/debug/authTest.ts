/**
 * Authentication Debug Test Script
 * 
 * This script demonstrates the enhanced authentication debugging capabilities
 * and can be used to test the authentication flow with real tokens.
 */

import { AuthService } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { AuthDebugUtils } from '../utils/authDebug';
import { enhancedLogger } from '../utils/logger';

/**
 * Test the authentication debugging utilities
 */
export async function testAuthenticationDebugging(
    authService: AuthService,
    userRepository: UserRepository,
    testToken?: string
) {
    try {
        enhancedLogger.info('Starting authentication debugging test', {
            category: 'authentication_debug',
            hasTestToken: !!testToken,
        });

        // Initialize debug utilities
        const debugUtils = new AuthDebugUtils(authService, userRepository);

        // 1. Perform health check
        console.log('\n=== Authentication Health Check ===');
        const healthCheck = await debugUtils.performHealthCheck();
        console.log('JWT Configuration:', healthCheck.jwtConfiguration);
        console.log('Database Connection:', healthCheck.databaseConnection);
        console.log('Services Available:', healthCheck.services);

        // 2. Test token analysis if token provided
        if (testToken) {
            console.log('\n=== Token Analysis ===');
            const tokenAnalysis = await debugUtils.validateTokenWithDebug(testToken);
            console.log('Token Structure:', tokenAnalysis.tokenStructure);
            console.log('Claims:', tokenAnalysis.claims);
            console.log('Validation:', tokenAnalysis.validation);
            console.log('User:', tokenAnalysis.user);

            // 3. Test authentication flow
            console.log('\n=== Authentication Flow Test ===');
            const flowTest = await debugUtils.testAuthenticationFlow(testToken);
            console.log('Success:', flowTest.success);
            console.log('Steps:', flowTest.steps);
            if (flowTest.user) {
                console.log('User:', flowTest.user);
            }
            if (flowTest.error) {
                console.log('Error:', flowTest.error);
            }
        }

        // 4. Generate diagnostic report
        console.log('\n=== Diagnostic Report ===');
        const report = await debugUtils.generateDiagnosticReport(testToken);
        console.log('Recommendations:', report.recommendations);

        enhancedLogger.info('Authentication debugging test completed', {
            category: 'authentication_debug',
            healthCheckPassed: healthCheck.databaseConnection.connected,
            recommendationsCount: report.recommendations.length,
        });

        return {
            success: true,
            healthCheck,
            tokenAnalysis: testToken ? await debugUtils.validateTokenWithDebug(testToken) : undefined,
            flowTest: testToken ? await debugUtils.testAuthenticationFlow(testToken) : undefined,
            report,
        };

    } catch (error) {
        enhancedLogger.error('Authentication debugging test failed', {
            category: 'authentication_debug',
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        console.error('Authentication debugging test failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Test authentication middleware debugging with a mock request
 */
export function testAuthMiddlewareDebugging(
    authService: AuthService,
    userRepository: UserRepository,
    testToken?: string
) {
    const { AuthMiddleware } = require('../middleware/auth');
    const middleware = new AuthMiddleware(authService, userRepository);

    // Mock request object
    const mockReq = {
        headers: {
            authorization: testToken ? `Bearer ${testToken}` : undefined,
        },
        path: '/api/swaps',
        method: 'GET',
        ip: '127.0.0.1',
    };

    console.log('\n=== Authentication Middleware Debug ===');

    // Test debug authentication method
    const debugInfo = middleware.debugAuthentication(mockReq);
    console.log('Debug Info:', debugInfo);

    // Test token format validation
    if (testToken) {
        const isValidFormat = middleware.validateTokenFormat(`Bearer ${testToken}`);
        console.log('Token Format Valid:', isValidFormat);

        // Test token decoding
        const decodeResult = middleware.debugDecodeToken(testToken);
        console.log('Token Decode Result:', decodeResult);
    }

    // Test JWT secret validation
    const jwtSecretValid = middleware.validateJwtSecret();
    console.log('JWT Secret Valid:', jwtSecretValid);

    return {
        debugInfo,
        tokenFormatValid: testToken ? middleware.validateTokenFormat(`Bearer ${testToken}`) : undefined,
        jwtSecretValid,
    };
}

/**
 * Example usage function
 */
export async function runAuthenticationDebugExample() {
    console.log('Authentication Debug Example');
    console.log('This would normally be called with actual AuthService and UserRepository instances');
    console.log('Example token analysis for a sample JWT structure...');

    // Example of what the debug output would look like
    const exampleDebugInfo = {
        hasAuthHeader: true,
        tokenFormat: 'Bearer',
        tokenLength: 150,
        verificationResult: 'success',
        userFound: true,
        step: 'complete',
        jwtSecretConfigured: true,
        tokenPayload: {
            userId: 'user-123',
            email: 'user@example.com',
            iat: Math.floor(Date.now() / 1000) - 3600,
            exp: Math.floor(Date.now() / 1000) + 3600,
        },
    };

    console.log('Example Debug Info:', exampleDebugInfo);

    return exampleDebugInfo;
}