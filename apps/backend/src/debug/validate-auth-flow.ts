#!/usr/bin/env node

/**
 * Task 4: Test and validate authentication flow with real tokens
 * 
 * This script creates a comprehensive test to validate authentication with actual user tokens,
 * testing the complete flow from token extraction through user data attachment,
 * and verifying that getUserSwaps method receives properly authenticated requests.
 * 
 * Requirements addressed:
 * - 1.1: Authenticated users can access /swaps endpoint with valid tokens
 * - 1.4: Authentication middleware extracts and attaches user information
 * - 1.5: getUserSwaps controller has access to authenticated user data
 * - 2.3: Token validation succeeds and user data is attached to request
 */

import { AuthService } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { SwapController } from '../controllers/SwapController';
import { AuthMiddleware } from '../middleware/auth';
import { SwapProposalService, SwapResponseService } from '../services/swap';
import { SwapMatchingService } from '../services/swap/SwapMatchingService';
import { AuctionManagementService } from '../services/auction';
import { PaymentProcessingService } from '../services/payment';
import { createDatabasePool, getDatabaseConfig } from '../database/config';
import { AuthDebugUtils } from '../utils/authDebug';
import { enhancedLogger } from '../utils/logger';
import { Request, Response } from 'express';

interface AuthFlowValidationResult {
    testId: string;
    timestamp: Date;
    success: boolean;
    tokenProvided: boolean;
    steps: {
        tokenExtraction: {
            success: boolean;
            tokenFormat: 'JWT' | 'Invalid' | 'None';
            tokenLength: number;
            error?: string;
        };
        middlewareAuth: {
            success: boolean;
            userAttached: boolean;
            userId?: string;
            userEmail?: string;
            duration: number;
            error?: string;
        };
        controllerExecution: {
            success: boolean;
            responseStatus: number;
            userDataAvailable: boolean;
            swapsReturned: boolean;
            duration: number;
            error?: string;
        };
        endToEndValidation: {
            success: boolean;
            authFlowComplete: boolean;
            userDataCorrect: boolean;
            swapsAccessible: boolean;
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
 * Comprehensive Authentication Flow Validator
 */
export class AuthFlowValidator {
    private testCounter = 0;

    constructor(
        private authService: AuthService,
        private userRepository: UserRepository,
        private swapController: SwapController,
        private authMiddleware: AuthMiddleware,
        private debugUtils: AuthDebugUtils
    ) { }

    /**
     * Validate complete authentication flow with a real token
     */
    async validateAuthFlow(token?: string, expectedUserId?: string): Promise<AuthFlowValidationResult> {
        const testId = `auth-validation-${++this.testCounter}-${Date.now()}`;
        const startTime = Date.now();

        const result: AuthFlowValidationResult = {
            testId,
            timestamp: new Date(),
            success: false,
            tokenProvided: !!token,
            steps: {
                tokenExtraction: {
                    success: false,
                    tokenFormat: 'None',
                    tokenLength: 0,
                },
                middlewareAuth: {
                    success: false,
                    userAttached: false,
                    duration: 0,
                },
                controllerExecution: {
                    success: false,
                    responseStatus: 0,
                    userDataAvailable: false,
                    swapsReturned: false,
                    duration: 0,
                },
                endToEndValidation: {
                    success: false,
                    authFlowComplete: false,
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
            console.log(`🔍 Starting authentication flow validation (${testId})`);
            console.log(`Token provided: ${result.tokenProvided ? '✅' : '❌'}`);

            if (token) {
                console.log(`Token length: ${token.length} characters`);
            }

            if (expectedUserId) {
                console.log(`Expected user ID: ${expectedUserId}`);
            }

            console.log('');

            // Step 1: Token Extraction Validation
            await this.validateTokenExtraction(token, result);

            // Step 2: Middleware Authentication Test
            if (result.steps.tokenExtraction.success) {
                await this.validateMiddlewareAuth(token!, result);
            }

            // Step 3: Controller Execution Test
            if (result.steps.middlewareAuth.success) {
                await this.validateControllerExecution(token!, result);
            }

            // Step 4: End-to-End Validation
            this.validateEndToEnd(result, expectedUserId);

            // Calculate performance metrics
            result.performance.totalDuration = Date.now() - startTime;
            result.performance.middlewareDuration = result.steps.middlewareAuth.duration;
            result.performance.controllerDuration = result.steps.controllerExecution.duration;

            // Generate recommendations
            this.generateRecommendations(result);

            // Determine overall success
            result.success = result.steps.endToEndValidation.success;

            console.log(`\n📊 Validation completed in ${result.performance.totalDuration}ms`);
            console.log(`Overall result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);

            return result;

        } catch (error) {
            result.performance.totalDuration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';

            console.error(`❌ Validation failed: ${errorMessage}`);
            result.recommendations.push(`Validation execution failed: ${errorMessage}`);

            return result;
        }
    }

    /**
     * Step 1: Validate token extraction
     */
    private async validateTokenExtraction(token: string | undefined, result: AuthFlowValidationResult): Promise<void> {
        console.log('1️⃣ Validating token extraction...');

        try {
            if (!token) {
                result.steps.tokenExtraction.error = 'No token provided for testing';
                console.log('   ❌ No token provided');
                return;
            }

            result.steps.tokenExtraction.tokenLength = token.length;

            // Check if token looks like a JWT
            if (token.includes('.') && token.split('.').length === 3) {
                result.steps.tokenExtraction.tokenFormat = 'JWT';
                console.log('   ✅ Token format appears to be JWT');
            } else {
                result.steps.tokenExtraction.tokenFormat = 'Invalid';
                result.steps.tokenExtraction.error = 'Token does not appear to be a valid JWT';
                console.log('   ❌ Invalid token format');
                return;
            }

            // Use debug utils to analyze token structure
            const tokenAnalysis = this.debugUtils.analyzeToken(token);
            if (!tokenAnalysis.tokenStructure.isValid) {
                result.steps.tokenExtraction.error = `Token structure invalid: ${tokenAnalysis.validation.error}`;
                console.log(`   ❌ Token structure validation failed: ${tokenAnalysis.validation.error}`);
                return;
            }

            result.steps.tokenExtraction.success = true;
            console.log('   ✅ Token extraction validation passed');

        } catch (error) {
            result.steps.tokenExtraction.error = error instanceof Error ? error.message : 'Token extraction validation failed';
            console.log(`   ❌ Token extraction error: ${result.steps.tokenExtraction.error}`);
        }
    }

    /**
     * Step 2: Validate middleware authentication
     */
    private async validateMiddlewareAuth(token: string, result: AuthFlowValidationResult): Promise<void> {
        console.log('2️⃣ Validating middleware authentication...');
        const middlewareStart = Date.now();

        try {
            // Create mock request with the token
            const mockReq = this.createMockRequest(token);
            const mockRes = this.createMockResponse();

            // Test middleware execution
            const middlewarePromise = new Promise<void>((resolve, reject) => {
                const next = (error?: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                };

                // Execute authentication middleware
                const authHandler = this.authMiddleware.requireAuth();
                authHandler(mockReq, mockRes, next);
            });

            try {
                await middlewarePromise;

                // Check if user was attached
                result.steps.middlewareAuth.userAttached = !!mockReq.user;
                result.steps.middlewareAuth.success = !!mockReq.user;

                if (mockReq.user) {
                    result.steps.middlewareAuth.userId = mockReq.user.id;
                    result.steps.middlewareAuth.userEmail = mockReq.user.email;
                    console.log(`   ✅ User attached: ${mockReq.user.email} (${mockReq.user.id})`);
                } else {
                    result.steps.middlewareAuth.error = 'User not attached to request after middleware processing';
                    console.log('   ❌ User not attached to request');
                }

            } catch (error) {
                result.steps.middlewareAuth.error = error instanceof Error ? error.message : 'Middleware execution failed';
                console.log(`   ❌ Middleware error: ${result.steps.middlewareAuth.error}`);
            }

            result.steps.middlewareAuth.duration = Date.now() - middlewareStart;

        } catch (error) {
            result.steps.middlewareAuth.error = error instanceof Error ? error.message : 'Middleware validation failed';
            result.steps.middlewareAuth.duration = Date.now() - middlewareStart;
            console.log(`   ❌ Middleware validation error: ${result.steps.middlewareAuth.error}`);
        }
    }

    /**
     * Step 3: Validate controller execution
     */
    private async validateControllerExecution(token: string, result: AuthFlowValidationResult): Promise<void> {
        console.log('3️⃣ Validating controller execution...');
        const controllerStart = Date.now();

        try {
            // Create mock request with authenticated user
            const mockReq = this.createMockRequest(token);
            const mockRes = this.createMockResponse();

            // Simulate middleware having attached user data
            if (result.steps.middlewareAuth.userId) {
                try {
                    const user = await this.userRepository.findById(result.steps.middlewareAuth.userId);
                    if (user) {
                        mockReq.user = user;
                        result.steps.controllerExecution.userDataAvailable = true;
                        console.log(`   ✅ User data loaded for controller test`);
                    } else {
                        result.steps.controllerExecution.error = 'User not found in database';
                        console.log('   ❌ User not found in database');
                        return;
                    }
                } catch (error) {
                    result.steps.controllerExecution.error = 'Failed to load user for controller test';
                    console.log(`   ❌ Failed to load user: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    return;
                }
            }

            // Execute getUserSwaps method
            try {
                await this.swapController.getUserSwaps(mockReq, mockRes);

                result.steps.controllerExecution.responseStatus = mockRes.statusCode;

                if (mockRes.statusCode === 200) {
                    result.steps.controllerExecution.success = true;
                    result.steps.controllerExecution.swapsReturned = !!mockRes.responseData?.data?.swaps;
                    console.log(`   ✅ Controller returned 200 OK`);

                    if (result.steps.controllerExecution.swapsReturned) {
                        console.log(`   ✅ Swaps data returned successfully`);
                    } else {
                        console.log(`   ⚠️  No swaps data in response (may be empty)`);
                    }
                } else {
                    result.steps.controllerExecution.error = `Controller returned status ${mockRes.statusCode}`;
                    console.log(`   ❌ Controller returned ${mockRes.statusCode}`);

                    if (mockRes.responseData?.error) {
                        console.log(`   Error details: ${mockRes.responseData.error.message}`);
                    }
                }

            } catch (error) {
                result.steps.controllerExecution.error = error instanceof Error ? error.message : 'Controller execution failed';
                console.log(`   ❌ Controller execution error: ${result.steps.controllerExecution.error}`);
            }

            result.steps.controllerExecution.duration = Date.now() - controllerStart;

        } catch (error) {
            result.steps.controllerExecution.error = error instanceof Error ? error.message : 'Controller validation failed';
            result.steps.controllerExecution.duration = Date.now() - controllerStart;
            console.log(`   ❌ Controller validation error: ${result.steps.controllerExecution.error}`);
        }
    }

    /**
     * Step 4: End-to-end validation
     */
    private validateEndToEnd(result: AuthFlowValidationResult, expectedUserId?: string): void {
        console.log('4️⃣ Performing end-to-end validation...');

        // Check if authentication flow is complete
        result.steps.endToEndValidation.authFlowComplete =
            result.steps.tokenExtraction.success &&
            result.steps.middlewareAuth.success &&
            result.steps.middlewareAuth.userAttached;

        // Check if user data is correct
        if (expectedUserId && result.steps.middlewareAuth.userId) {
            result.steps.endToEndValidation.userDataCorrect =
                result.steps.middlewareAuth.userId === expectedUserId;
        } else {
            result.steps.endToEndValidation.userDataCorrect = true; // No specific validation required
        }

        // Check if swaps are accessible
        result.steps.endToEndValidation.swapsAccessible =
            result.steps.controllerExecution.success &&
            result.steps.controllerExecution.responseStatus === 200;

        // Overall end-to-end success
        result.steps.endToEndValidation.success =
            result.steps.endToEndValidation.authFlowComplete &&
            result.steps.endToEndValidation.userDataCorrect &&
            result.steps.endToEndValidation.swapsAccessible;

        console.log(`   Authentication flow complete: ${result.steps.endToEndValidation.authFlowComplete ? '✅' : '❌'}`);
        console.log(`   User data correct: ${result.steps.endToEndValidation.userDataCorrect ? '✅' : '❌'}`);
        console.log(`   Swaps accessible: ${result.steps.endToEndValidation.swapsAccessible ? '✅' : '❌'}`);
        console.log(`   End-to-end success: ${result.steps.endToEndValidation.success ? '✅' : '❌'}`);
    }

    /**
     * Generate recommendations based on validation results
     */
    private generateRecommendations(result: AuthFlowValidationResult): void {
        if (!result.tokenProvided) {
            result.recommendations.push('Provide a valid JWT token to test authentication flow');
            return;
        }

        if (!result.steps.tokenExtraction.success) {
            if (result.steps.tokenExtraction.tokenFormat === 'Invalid') {
                result.recommendations.push('Token format is invalid - ensure it is a proper JWT with 3 parts separated by dots');
            } else {
                result.recommendations.push('Token extraction failed - verify token structure and format');
            }
        }

        if (!result.steps.middlewareAuth.success) {
            if (result.steps.middlewareAuth.error?.includes('expired')) {
                result.recommendations.push('Token has expired - generate a new token for testing');
            } else if (result.steps.middlewareAuth.error?.includes('signature')) {
                result.recommendations.push('Token signature verification failed - check JWT_SECRET configuration');
            } else if (result.steps.middlewareAuth.error?.includes('User not found')) {
                result.recommendations.push('User associated with token not found - verify user exists in database');
            } else {
                result.recommendations.push('Middleware authentication failed - check AuthMiddleware configuration and JWT_SECRET');
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
            result.recommendations.push('✅ Authentication flow is working correctly - getUserSwaps receives properly authenticated requests');
        } else {
            result.recommendations.push('❌ Authentication flow has issues - review the failed steps above');
        }
    }

    /**
     * Create mock Express request
     */
    private createMockRequest(token: string): Request {
        return {
            headers: {
                authorization: `Bearer ${token}`,
                'x-request-id': `validation-${Date.now()}`,
            },
            path: '/api/swaps',
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
     * Create mock Express response
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
}

/**
 * Initialize services and run validation
 */
async function runAuthFlowValidation(token?: string, expectedUserId?: string): Promise<void> {
    console.log('🚀 Initializing Authentication Flow Validation...\n');

    try {
        // Initialize database connection
        const dbPool = createDatabasePool(getDatabaseConfig());
        const userRepository = new UserRepository(dbPool);

        // Initialize auth service
        const authService = new AuthService(
            userRepository,
            null as any, // WalletService not needed for this test
            undefined, // PasswordResetTokenRepository
            undefined, // EmailService
            process.env.JWT_SECRET || 'test-secret-for-validation',
            '24h'
        );

        // Initialize auth middleware
        const authMiddleware = new AuthMiddleware(authService, userRepository);

        // Initialize debug utils
        const debugUtils = new AuthDebugUtils(authService, userRepository);

        // Initialize swap services (minimal for testing)
        const swapProposalService = new SwapProposalService(
            userRepository,
            null as any, // BookingRepository
            null as any, // WalletService
            null as any, // BlockchainService
            null as any  // NotificationService
        );

        const swapResponseService = new SwapResponseService(
            swapProposalService,
            null as any, // BookingRepository
            null as any, // WalletService
            null as any, // BlockchainService
            null as any  // NotificationService
        );

        const swapMatchingService = new SwapMatchingService(
            null as any, // BookingRepository
            userRepository
        );

        const auctionService = new AuctionManagementService(
            null as any, // AuctionRepository
            null as any, // BidRepository
            null as any, // PaymentService
            null as any  // NotificationService
        );

        const paymentService = new PaymentProcessingService(
            null as any, // PaymentRepository
            null as any, // WalletService
            null as any  // NotificationService
        );

        // Initialize swap controller
        const swapController = new SwapController(
            swapProposalService,
            swapResponseService,
            swapMatchingService,
            auctionService,
            paymentService
        );

        console.log('✅ Services initialized successfully\n');

        // Create validator and run validation
        const validator = new AuthFlowValidator(
            authService,
            userRepository,
            swapController,
            authMiddleware,
            debugUtils
        );

        const result = await validator.validateAuthFlow(token, expectedUserId);

        // Display detailed results
        console.log('\n📋 Detailed Validation Results:');
        console.log('================================\n');

        console.log(`Test ID: ${result.testId}`);
        console.log(`Timestamp: ${result.timestamp.toISOString()}`);
        console.log(`Overall Success: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Total Duration: ${result.performance.totalDuration}ms\n`);

        // Performance breakdown
        console.log('⏱️  Performance Breakdown:');
        console.log(`Middleware Duration: ${result.performance.middlewareDuration}ms`);
        console.log(`Controller Duration: ${result.performance.controllerDuration}ms`);
        console.log(`Total Duration: ${result.performance.totalDuration}ms\n`);

        // Step details
        console.log('📝 Step Details:');
        console.log(`1. Token Extraction: ${result.steps.tokenExtraction.success ? '✅' : '❌'}`);
        console.log(`   Format: ${result.steps.tokenExtraction.tokenFormat}`);
        console.log(`   Length: ${result.steps.tokenExtraction.tokenLength}`);
        if (result.steps.tokenExtraction.error) {
            console.log(`   Error: ${result.steps.tokenExtraction.error}`);
        }

        console.log(`\n2. Middleware Auth: ${result.steps.middlewareAuth.success ? '✅' : '❌'}`);
        console.log(`   User Attached: ${result.steps.middlewareAuth.userAttached ? '✅' : '❌'}`);
        if (result.steps.middlewareAuth.userId) {
            console.log(`   User ID: ${result.steps.middlewareAuth.userId}`);
        }
        if (result.steps.middlewareAuth.userEmail) {
            console.log(`   User Email: ${result.steps.middlewareAuth.userEmail}`);
        }
        console.log(`   Duration: ${result.steps.middlewareAuth.duration}ms`);
        if (result.steps.middlewareAuth.error) {
            console.log(`   Error: ${result.steps.middlewareAuth.error}`);
        }

        console.log(`\n3. Controller Execution: ${result.steps.controllerExecution.success ? '✅' : '❌'}`);
        console.log(`   User Data Available: ${result.steps.controllerExecution.userDataAvailable ? '✅' : '❌'}`);
        console.log(`   Response Status: ${result.steps.controllerExecution.responseStatus}`);
        console.log(`   Swaps Returned: ${result.steps.controllerExecution.swapsReturned ? '✅' : '❌'}`);
        console.log(`   Duration: ${result.steps.controllerExecution.duration}ms`);
        if (result.steps.controllerExecution.error) {
            console.log(`   Error: ${result.steps.controllerExecution.error}`);
        }

        console.log(`\n4. End-to-End Validation: ${result.steps.endToEndValidation.success ? '✅' : '❌'}`);
        console.log(`   Auth Flow Complete: ${result.steps.endToEndValidation.authFlowComplete ? '✅' : '❌'}`);
        console.log(`   User Data Correct: ${result.steps.endToEndValidation.userDataCorrect ? '✅' : '❌'}`);
        console.log(`   Swaps Accessible: ${result.steps.endToEndValidation.swapsAccessible ? '✅' : '❌'}`);

        // Recommendations
        if (result.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            result.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec}`);
            });
        }

        console.log('\n================================');

        if (result.success) {
            console.log('🎉 Authentication flow validation completed successfully!');
            console.log('✅ The getUserSwaps method receives properly authenticated requests.');
            console.log('✅ Requirements 1.1, 1.4, 1.5, and 2.3 are satisfied.');
        } else {
            console.log('❌ Authentication flow validation failed.');
            console.log('Please review the recommendations above to fix the issues.');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Validation initialization failed:', error);
        process.exit(1);
    }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    // Parse arguments
    let token: string | undefined;
    let expectedUserId: string | undefined;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--token' && i + 1 < args.length) {
            token = args[++i];
        } else if (args[i] === '--user-id' && i + 1 < args.length) {
            expectedUserId = args[++i];
        } else if (args[i].startsWith('--token=')) {
            token = args[i].split('=')[1];
        } else if (args[i].startsWith('--user-id=')) {
            expectedUserId = args[i].split('=')[1];
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
🔍 Authentication Flow Validation Script

Usage:
  npm run test:auth-flow:validate [options]

Options:
  --token <jwt-token>     JWT token to test (optional - will test without token if not provided)
  --user-id <user-id>     Expected user ID for validation (optional)
  --help, -h             Display this help message

Examples:
  # Test with a real JWT token
  npm run test:auth-flow:validate -- --token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

  # Test with token and expected user ID
  npm run test:auth-flow:validate -- --token="your-token" --user-id="user-123"

  # Test without token (will show what happens with no authentication)
  npm run test:auth-flow:validate

This script validates:
1. Token extraction and format validation
2. Middleware authentication processing
3. Controller execution with authenticated requests
4. End-to-end authentication flow
`);
            process.exit(0);
        }
    }

    await runAuthFlowValidation(token, expectedUserId);
}

// Execute if run directly
if (require.main === module) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { runAuthFlowValidation, AuthFlowValidator };