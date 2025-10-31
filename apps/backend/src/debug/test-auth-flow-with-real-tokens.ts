/**
 * Test Authentication Flow with Real Tokens
 * 
 * This script validates the complete authentication flow from token extraction
 * through user data attachment, specifically testing the getUserSwaps method
 * with properly authenticated requests.
 * 
 * Task 4: Test and validate authentication flow with real tokens
 * - Create test script to validate authentication with actual user tokens
 * - Test the complete flow from token extraction through user data attachment
 * - Verify that getUserSwaps method receives properly authenticated requests
 */

import { Request, Response } from 'express';
import { AuthService } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { SwapController } from '../controllers/SwapController';
import { AuthMiddleware } from '../middleware/auth';
import { AuthDebugUtils } from '../utils/authDebug';
import { enhancedLogger } from '../utils/logger';

export interface AuthFlowTestConfig {
    token: string;
    expectedUserId?: string;
    expectedEmail?: string;
    testEndpoint?: string;
}

export interface AuthFlowTestResult {
    success: boolean;
    testId: string;
    timestamp: Date;
    config: AuthFlowTestConfig;
    steps: {
        tokenExtraction: {
            success: boolean;
            tokenPresent: boolean;
            tokenFormat: string;
            tokenLength: number;
            error?: string;
        };
        middlewareProcessing: {
            success: boolean;
            debugInfo?: any;
            userAttached: boolean;
            error?: string;
        };
        controllerExecution: {
            success: boolean;
            userDataAvailable: boolean;
            responseStatus?: number;
            responseData?: any;
            error?: string;
        };
        endToEndValidation: {
            success: boolean;
            authenticationComplete: boolean;
            userDataCorrect: boolean;
            swapsAccessible: boolean;
            error?: string;
        };
    };
    performance: {
        totalDuration: number;
        middlewareDuration: number;
        controllerDuration: number;
    };
    recommendations: string[];
}

/**
 * Comprehensive Authentication Flow Tester
 */
export class AuthFlowTester {
    private testCounter = 0;

    constructor(
        private authService: AuthService,
        private userRepository: UserRepository,
        private swapController: SwapController,
        private authMiddleware: AuthMiddleware,
        private debugUtils: AuthDebugUtils
    ) { }

    /**
     * Test complete authentication flow with a real token
     */
    async testAuthenticationFlow(config: AuthFlowTestConfig): Promise<AuthFlowTestResult> {
        const testId = `auth-flow-test-${++this.testCounter}-${Date.now()}`;
        const startTime = Date.now();

        const result: AuthFlowTestResult = {
            success: false,
            testId,
            timestamp: new Date(),
            config,
            steps: {
                tokenExtraction: {
                    success: false,
                    tokenPresent: false,
                    tokenFormat: 'none',
                    tokenLength: 0,
                },
                middlewareProcessing: {
                    success: false,
                    userAttached: false,
                },
                controllerExecution: {
                    success: false,
                    userDataAvailable: false,
                },
                endToEndValidation: {
                    success: false,
                    authenticationComplete: false,
                    userDataCorrect: false,
                    swapsAccessible: false,
                },
            },
            performance: {
                totalDuration: 0,
                middlewareDuration: 0,
                controllerDuration: 0,
            },
            recommendations: [],
        };

        try {
            enhancedLogger.info('Starting authentication flow test', {
                category: 'authentication_test',
                testId,
                hasToken: !!config.token,
                endpoint: config.testEndpoint || '/api/swaps',
            });

            // Step 1: Token Extraction Test
            await this.testTokenExtraction(config, result);

            // Step 2: Middleware Processing Test
            if (result.steps.tokenExtraction.success) {
                await this.testMiddlewareProcessing(config, result);
            }

            // Step 3: Controller Execution Test
            if (result.steps.middlewareProcessing.success) {
                await this.testControllerExecution(config, result);
            }

            // Step 4: End-to-End Validation
            if (result.steps.controllerExecution.success) {
                await this.testEndToEndValidation(config, result);
            }

            // Calculate performance metrics
            result.performance.totalDuration = Date.now() - startTime;

            // Determine overall success
            result.success = result.steps.endToEndValidation.success;

            // Generate recommendations
            this.generateRecommendations(result);

            enhancedLogger.info('Authentication flow test completed', {
                category: 'authentication_test',
                testId,
                success: result.success,
                duration: result.performance.totalDuration,
                recommendationsCount: result.recommendations.length,
            });

            return result;

        } catch (error) {
            result.performance.totalDuration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown test error';

            enhancedLogger.error('Authentication flow test failed', {
                category: 'authentication_test',
                testId,
                error: errorMessage,
                duration: result.performance.totalDuration,
            });

            result.recommendations.push(`Test execution failed: ${errorMessage}`);
            return result;
        }
    }

    /**
     * Test token extraction step
     */
    private async testTokenExtraction(config: AuthFlowTestConfig, result: AuthFlowTestResult): Promise<void> {
        try {
            const token = config.token;

            result.steps.tokenExtraction.tokenPresent = !!token;
            result.steps.tokenExtraction.tokenLength = token ? token.length : 0;

            if (!token) {
                result.steps.tokenExtraction.error = 'No token provided';
                return;
            }

            // Validate token format
            if (token.includes('.') && token.split('.').length === 3) {
                result.steps.tokenExtraction.tokenFormat = 'JWT';
            } else {
                result.steps.tokenExtraction.tokenFormat = 'Invalid';
                result.steps.tokenExtraction.error = 'Token does not appear to be a valid JWT';
                return;
            }

            // Test token structure using debug utils
            const tokenAnalysis = this.debugUtils.analyzeToken(token);
            if (!tokenAnalysis.tokenStructure.isValid) {
                result.steps.tokenExtraction.error = `Invalid token structure: ${tokenAnalysis.validation.error}`;
                return;
            }

            result.steps.tokenExtraction.success = true;

        } catch (error) {
            result.steps.tokenExtraction.error = error instanceof Error ? error.message : 'Token extraction test failed';
        }
    }

    /**
     * Test middleware processing step
     */
    private async testMiddlewareProcessing(config: AuthFlowTestConfig, result: AuthFlowTestResult): Promise<void> {
        const middlewareStart = Date.now();

        try {
            // Create mock request and response objects
            const mockReq = this.createMockRequest(config);
            const mockRes = this.createMockResponse();

            // Test middleware debug functionality first
            const debugInfo = this.authMiddleware.debugAuthentication(mockReq);
            result.steps.middlewareProcessing.debugInfo = debugInfo;

            // Test middleware execution
            let middlewareCompleted = false;
            let middlewareError: any = null;

            const middlewarePromise = new Promise<void>((resolve, reject) => {
                const next = (error?: any) => {
                    if (error) {
                        middlewareError = error;
                        reject(error);
                    } else {
                        middlewareCompleted = true;
                        resolve();
                    }
                };

                // Execute the authentication middleware
                const authHandler = this.authMiddleware.requireAuth();
                authHandler(mockReq, mockRes, next);
            });

            try {
                await middlewarePromise;

                // Check if user was attached to request
                result.steps.middlewareProcessing.userAttached = !!mockReq.user;
                result.steps.middlewareProcessing.success = middlewareCompleted && !!mockReq.user;

                if (!mockReq.user) {
                    result.steps.middlewareProcessing.error = 'User not attached to request after middleware processing';
                }

            } catch (error) {
                result.steps.middlewareProcessing.error = error instanceof Error ? error.message : 'Middleware execution failed';
            }

            result.performance.middlewareDuration = Date.now() - middlewareStart;

        } catch (error) {
            result.steps.middlewareProcessing.error = error instanceof Error ? error.message : 'Middleware processing test failed';
            result.performance.middlewareDuration = Date.now() - middlewareStart;
        }
    }

    /**
     * Test controller execution step
     */
    private async testControllerExecution(config: AuthFlowTestConfig, result: AuthFlowTestResult): Promise<void> {
        const controllerStart = Date.now();

        try {
            // Create mock request with authenticated user
            const mockReq = this.createMockRequest(config);

            // Simulate middleware having attached user data
            if (config.expectedUserId) {
                // For testing, we'll simulate the user being attached
                try {
                    const user = await this.userRepository.findById(config.expectedUserId);
                    if (user) {
                        mockReq.user = user;
                        result.steps.controllerExecution.userDataAvailable = true;
                    }
                } catch (error) {
                    result.steps.controllerExecution.error = 'Failed to load user for controller test';
                    return;
                }
            }

            const mockRes = this.createMockResponse();

            // Test getUserSwaps method specifically
            try {
                await this.swapController.getUserSwaps(mockReq, mockRes);

                // Check response
                if (mockRes.statusCode === 200 || mockRes.statusCode === 201) {
                    result.steps.controllerExecution.success = true;
                    result.steps.controllerExecution.responseStatus = mockRes.statusCode;
                    result.steps.controllerExecution.responseData = mockRes.responseData;
                } else {
                    result.steps.controllerExecution.error = `Controller returned status ${mockRes.statusCode}`;
                    result.steps.controllerExecution.responseStatus = mockRes.statusCode;
                }

            } catch (error) {
                result.steps.controllerExecution.error = error instanceof Error ? error.message : 'Controller execution failed';
            }

            result.performance.controllerDuration = Date.now() - controllerStart;

        } catch (error) {
            result.steps.controllerExecution.error = error instanceof Error ? error.message : 'Controller execution test failed';
            result.performance.controllerDuration = Date.now() - controllerStart;
        }
    }

    /**
     * Test end-to-end validation
     */
    private async testEndToEndValidation(config: AuthFlowTestConfig, result: AuthFlowTestResult): Promise<void> {
        try {
            // Validate authentication was complete
            result.steps.endToEndValidation.authenticationComplete =
                result.steps.tokenExtraction.success &&
                result.steps.middlewareProcessing.success &&
                result.steps.middlewareProcessing.userAttached;

            // Validate user data is correct
            if (config.expectedUserId && result.steps.middlewareProcessing.debugInfo?.tokenPayload?.userId) {
                result.steps.endToEndValidation.userDataCorrect =
                    result.steps.middlewareProcessing.debugInfo.tokenPayload.userId === config.expectedUserId;
            } else {
                result.steps.endToEndValidation.userDataCorrect = true; // No specific validation required
            }

            // Validate swaps are accessible
            result.steps.endToEndValidation.swapsAccessible =
                result.steps.controllerExecution.success &&
                (result.steps.controllerExecution.responseStatus === 200 ||
                    result.steps.controllerExecution.responseStatus === 201);

            // Overall validation success
            result.steps.endToEndValidation.success =
                result.steps.endToEndValidation.authenticationComplete &&
                result.steps.endToEndValidation.userDataCorrect &&
                result.steps.endToEndValidation.swapsAccessible;

        } catch (error) {
            result.steps.endToEndValidation.error = error instanceof Error ? error.message : 'End-to-end validation failed';
        }
    }

    /**
     * Generate recommendations based on test results
     */
    private generateRecommendations(result: AuthFlowTestResult): void {
        if (!result.steps.tokenExtraction.success) {
            if (!result.steps.tokenExtraction.tokenPresent) {
                result.recommendations.push('Provide a valid JWT token for testing');
            } else if (result.steps.tokenExtraction.tokenFormat === 'Invalid') {
                result.recommendations.push('Token format is invalid - ensure it is a proper JWT with 3 parts separated by dots');
            }
        }

        if (!result.steps.middlewareProcessing.success) {
            if (result.steps.middlewareProcessing.error?.includes('expired')) {
                result.recommendations.push('Token has expired - generate a new token');
            } else if (result.steps.middlewareProcessing.error?.includes('signature')) {
                result.recommendations.push('Token signature verification failed - check JWT secret configuration');
            } else if (result.steps.middlewareProcessing.error?.includes('User not found')) {
                result.recommendations.push('User associated with token not found - verify user exists in database');
            } else {
                result.recommendations.push('Middleware processing failed - check authentication middleware configuration');
            }
        }

        if (!result.steps.controllerExecution.success) {
            if (result.steps.controllerExecution.responseStatus === 401) {
                result.recommendations.push('Controller returned 401 - authentication not properly passed through middleware');
            } else if (result.steps.controllerExecution.responseStatus === 500) {
                result.recommendations.push('Controller returned 500 - check server logs for internal errors');
            } else {
                result.recommendations.push('Controller execution failed - verify SwapController.getUserSwaps implementation');
            }
        }

        if (result.performance.totalDuration > 5000) {
            result.recommendations.push('Authentication flow is slow - consider optimizing database queries or token verification');
        }

        if (result.success) {
            result.recommendations.push('✅ Authentication flow is working correctly with the provided token');
        }
    }

    /**
     * Create mock Express request object
     */
    private createMockRequest(config: AuthFlowTestConfig): Request {
        return {
            headers: {
                authorization: config.token ? `Bearer ${config.token}` : undefined,
                'x-request-id': `test-${Date.now()}`,
            },
            path: config.testEndpoint || '/api/swaps',
            method: 'GET',
            ip: '127.0.0.1',
            query: {},
            params: {},
            body: {},
            user: undefined,
            tokenPayload: undefined,
        } as any;
    }

    /**
     * Create mock Express response object
     */
    private createMockResponse(): Response & { statusCode: number; responseData: any } {
        let statusCode = 200;
        let responseData: any = null;

        return {
            status: (code: number) => {
                statusCode = code;
                return {
                    json: (data: any) => {
                        responseData = data;
                        return {} as any;
                    },
                } as any;
            },
            json: (data: any) => {
                responseData = data;
                return {} as any;
            },
            setHeader: () => { },
            getHeader: () => undefined,
            get statusCode() { return statusCode; },
            get responseData() { return responseData; },
        } as any;
    }

    /**
     * Test multiple tokens in batch
     */
    async testMultipleTokens(configs: AuthFlowTestConfig[]): Promise<AuthFlowTestResult[]> {
        const results: AuthFlowTestResult[] = [];

        for (const config of configs) {
            const result = await this.testAuthenticationFlow(config);
            results.push(result);

            // Add delay between tests to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return results;
    }

    /**
     * Generate test report summary
     */
    generateTestReport(results: AuthFlowTestResult[]): {
        summary: {
            totalTests: number;
            successfulTests: number;
            failedTests: number;
            averageDuration: number;
        };
        issues: string[];
        recommendations: string[];
    } {
        const summary = {
            totalTests: results.length,
            successfulTests: results.filter(r => r.success).length,
            failedTests: results.filter(r => !r.success).length,
            averageDuration: results.reduce((sum, r) => sum + r.performance.totalDuration, 0) / results.length,
        };

        const issues: string[] = [];
        const recommendations: string[] = [];

        results.forEach((result, index) => {
            if (!result.success) {
                issues.push(`Test ${index + 1} (${result.testId}): ${result.steps.endToEndValidation.error || 'Failed'}`);
            }
            recommendations.push(...result.recommendations);
        });

        // Remove duplicate recommendations
        const uniqueRecommendations = [...new Set(recommendations)];

        return {
            summary,
            issues,
            recommendations: uniqueRecommendations,
        };
    }
}

/**
 * Standalone test function for easy execution
 */
export async function testAuthFlowWithRealToken(
    authService: AuthService,
    userRepository: UserRepository,
    swapController: SwapController,
    authMiddleware: AuthMiddleware,
    token: string,
    expectedUserId?: string
): Promise<AuthFlowTestResult> {
    const debugUtils = new AuthDebugUtils(authService, userRepository);
    const tester = new AuthFlowTester(authService, userRepository, swapController, authMiddleware, debugUtils);

    return await tester.testAuthenticationFlow({
        token,
        expectedUserId,
        testEndpoint: '/api/swaps',
    });
}

/**
 * Test with sample tokens (for demonstration)
 */
export async function runSampleAuthFlowTests(
    authService: AuthService,
    userRepository: UserRepository,
    swapController: SwapController,
    authMiddleware: AuthMiddleware
): Promise<void> {
    console.log('🔍 Running Sample Authentication Flow Tests...\n');

    const debugUtils = new AuthDebugUtils(authService, userRepository);
    const tester = new AuthFlowTester(authService, userRepository, swapController, authMiddleware, debugUtils);

    // Sample test configurations (would normally use real tokens)
    const sampleConfigs: AuthFlowTestConfig[] = [
        {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDM2MDB9.invalid-signature',
            expectedUserId: 'test-user-123',
            testEndpoint: '/api/swaps',
        },
    ];

    try {
        const results = await tester.testMultipleTokens(sampleConfigs);
        const report = tester.generateTestReport(results);

        console.log('📊 Test Results Summary:');
        console.log(`Total Tests: ${report.summary.totalTests}`);
        console.log(`Successful: ${report.summary.successfulTests}`);
        console.log(`Failed: ${report.summary.failedTests}`);
        console.log(`Average Duration: ${report.summary.averageDuration.toFixed(2)}ms\n`);

        if (report.issues.length > 0) {
            console.log('❌ Issues Found:');
            report.issues.forEach(issue => console.log(`  - ${issue}`));
            console.log('');
        }

        if (report.recommendations.length > 0) {
            console.log('💡 Recommendations:');
            report.recommendations.forEach(rec => console.log(`  - ${rec}`));
            console.log('');
        }

        console.log('✅ Sample authentication flow tests completed');

    } catch (error) {
        console.error('❌ Sample tests failed:', error);
    }
}

export default {
    AuthFlowTester,
    testAuthFlowWithRealToken,
    runSampleAuthFlowTests,
};