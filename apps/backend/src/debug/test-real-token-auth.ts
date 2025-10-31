#!/usr/bin/env node

/**
 * Task 4 Implementation: Test and validate authentication flow with real tokens
 * 
 * This script creates a test to validate authentication with actual user tokens,
 * testing the complete flow from token extraction through user data attachment,
 * and verifying that getUserSwaps method receives properly authenticated requests.
 * 
 * Requirements addressed:
 * - 1.1: WHEN a user makes a GET request to /swaps with a valid authentication token 
 *        THEN the system SHALL return the user's swaps data with a 200 status code
 * - 1.4: WHEN the authentication middleware processes a valid token 
 *        THEN the system SHALL extract and attach user information to the request object
 * - 1.5: WHEN the getUserSwaps controller method is called 
 *        THEN the system SHALL have access to authenticated user data from the request
 * - 2.3: WHEN token validation succeeds 
 *        THEN the system SHALL attach user data to the request object for downstream controllers
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

interface TestResult {
    testName: string;
    success: boolean;
    duration: number;
    details: string;
    error?: string;
}

interface AuthFlowTestSuite {
    testId: string;
    timestamp: Date;
    overallSuccess: boolean;
    totalDuration: number;
    tests: TestResult[];
    summary: {
        passed: number;
        failed: number;
        total: number;
    };
    requirements: {
        req_1_1: boolean; // Valid token returns 200 with swaps data
        req_1_4: boolean; // Middleware extracts and attaches user info
        req_1_5: boolean; // getUserSwaps has access to user data
        req_2_3: boolean; // Token validation attaches user data
    };
}

/**
 * Real Token Authentication Flow Tester
 */
export class RealTokenAuthTester {
    private services: {
        authService: AuthService;
        userRepository: UserRepository;
        swapController: SwapController;
        authMiddleware: AuthMiddleware;
        debugUtils: AuthDebugUtils;
    } | null = null;

    /**
     * Initialize all required services
     */
    async initializeServices(): Promise<void> {
        console.log('🔧 Initializing services for authentication flow testing...');

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
                process.env.JWT_SECRET || 'test-secret-for-auth-flow-testing',
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

            this.services = {
                authService,
                userRepository,
                swapController,
                authMiddleware,
                debugUtils,
            };

            console.log('✅ Services initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize services:', error);
            throw error;
        }
    }

    /**
     * Run comprehensive authentication flow test suite
     */
    async runTestSuite(token?: string, expectedUserId?: string): Promise<AuthFlowTestSuite> {
        if (!this.services) {
            throw new Error('Services not initialized. Call initializeServices() first.');
        }

        const testId = `auth-flow-test-${Date.now()}`;
        const startTime = Date.now();

        const testSuite: AuthFlowTestSuite = {
            testId,
            timestamp: new Date(),
            overallSuccess: false,
            totalDuration: 0,
            tests: [],
            summary: {
                passed: 0,
                failed: 0,
                total: 0,
            },
            requirements: {
                req_1_1: false,
                req_1_4: false,
                req_1_5: false,
                req_2_3: false,
            },
        };

        console.log(`\n🧪 Running Authentication Flow Test Suite (${testId})`);
        console.log('='.repeat(60));

        try {
            // Test 1: Token Format Validation
            const tokenFormatTest = await this.testTokenFormat(token);
            testSuite.tests.push(tokenFormatTest);

            // Test 2: Token Extraction by Middleware
            const tokenExtractionTest = await this.testTokenExtraction(token);
            testSuite.tests.push(tokenExtractionTest);

            // Test 3: Middleware Authentication Processing
            const middlewareAuthTest = await this.testMiddlewareAuthentication(token);
            testSuite.tests.push(middlewareAuthTest);

            // Test 4: User Data Attachment
            const userDataTest = await this.testUserDataAttachment(token);
            testSuite.tests.push(userDataTest);

            // Test 5: Controller Access to User Data
            const controllerAccessTest = await this.testControllerUserAccess(token);
            testSuite.tests.push(controllerAccessTest);

            // Test 6: getUserSwaps Method Execution
            const getUserSwapsTest = await this.testGetUserSwapsExecution(token);
            testSuite.tests.push(getUserSwapsTest);

            // Test 7: End-to-End Authentication Flow
            const endToEndTest = await this.testEndToEndFlow(token, expectedUserId);
            testSuite.tests.push(endToEndTest);

            // Calculate summary
            testSuite.summary.total = testSuite.tests.length;
            testSuite.summary.passed = testSuite.tests.filter(t => t.success).length;
            testSuite.summary.failed = testSuite.summary.total - testSuite.summary.passed;
            testSuite.overallSuccess = testSuite.summary.failed === 0;

            // Evaluate requirements
            this.evaluateRequirements(testSuite);

            testSuite.totalDuration = Date.now() - startTime;

            return testSuite;

        } catch (error) {
            testSuite.totalDuration = Date.now() - startTime;
            console.error('❌ Test suite execution failed:', error);
            throw error;
        }
    }

    /**
     * Test 1: Token Format Validation
     */
    private async testTokenFormat(token?: string): Promise<TestResult> {
        const testName = 'Token Format Validation';
        const startTime = Date.now();

        console.log(`\n1️⃣ ${testName}...`);

        try {
            if (!token) {
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'No token provided for testing',
                    error: 'Token is required for authentication flow testing',
                };
            }

            // Check JWT format (3 parts separated by dots)
            const parts = token.split('.');
            if (parts.length !== 3) {
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: `Token has ${parts.length} parts, expected 3`,
                    error: 'Invalid JWT format',
                };
            }

            // Use debug utils to analyze token
            const analysis = this.services!.debugUtils.analyzeToken(token);
            if (!analysis.tokenStructure.isValid) {
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'Token structure analysis failed',
                    error: analysis.validation.error,
                };
            }

            console.log('   ✅ Token format is valid JWT');
            return {
                testName,
                success: true,
                duration: Date.now() - startTime,
                details: `Valid JWT with ${token.length} characters`,
            };

        } catch (error) {
            console.log('   ❌ Token format validation failed');
            return {
                testName,
                success: false,
                duration: Date.now() - startTime,
                details: 'Token format validation error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Test 2: Token Extraction by Middleware
     */
    private async testTokenExtraction(token?: string): Promise<TestResult> {
        const testName = 'Token Extraction by Middleware';
        const startTime = Date.now();

        console.log(`\n2️⃣ ${testName}...`);

        try {
            if (!token) {
                console.log('   ❌ No token to extract');
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'No token provided',
                    error: 'Cannot test token extraction without a token',
                };
            }

            // Test middleware's token extraction logic
            const authHeader = `Bearer ${token}`;
            const isValidFormat = this.services!.authMiddleware.validateTokenFormat(authHeader);

            if (!isValidFormat) {
                console.log('   ❌ Middleware rejected token format');
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'Middleware validateTokenFormat returned false',
                    error: 'Token format not accepted by middleware',
                };
            }

            console.log('   ✅ Middleware accepts token format');
            return {
                testName,
                success: true,
                duration: Date.now() - startTime,
                details: 'Middleware successfully validates token format',
            };

        } catch (error) {
            console.log('   ❌ Token extraction test failed');
            return {
                testName,
                success: false,
                duration: Date.now() - startTime,
                details: 'Token extraction test error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Test 3: Middleware Authentication Processing
     */
    private async testMiddlewareAuthentication(token?: string): Promise<TestResult> {
        const testName = 'Middleware Authentication Processing';
        const startTime = Date.now();

        console.log(`\n3️⃣ ${testName}...`);

        try {
            if (!token) {
                console.log('   ❌ No token for middleware authentication');
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'No token provided',
                    error: 'Cannot test middleware authentication without a token',
                };
            }

            // Create mock request and response
            const mockReq = this.createMockRequest(token);
            const mockRes = this.createMockResponse();

            // Test middleware execution
            let middlewareSuccess = false;
            let middlewareError: any = null;

            const middlewarePromise = new Promise<void>((resolve, reject) => {
                const next = (error?: any) => {
                    if (error) {
                        middlewareError = error;
                        reject(error);
                    } else {
                        middlewareSuccess = true;
                        resolve();
                    }
                };

                const authHandler = this.services!.authMiddleware.requireAuth();
                authHandler(mockReq, mockRes, next);
            });

            try {
                await middlewarePromise;

                if (middlewareSuccess) {
                    console.log('   ✅ Middleware authentication succeeded');
                    return {
                        testName,
                        success: true,
                        duration: Date.now() - startTime,
                        details: 'Middleware processed authentication successfully',
                    };
                } else {
                    console.log('   ❌ Middleware authentication failed');
                    return {
                        testName,
                        success: false,
                        duration: Date.now() - startTime,
                        details: 'Middleware did not call next() successfully',
                        error: 'Middleware authentication failed',
                    };
                }

            } catch (error) {
                console.log('   ❌ Middleware threw error');
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'Middleware threw an error during authentication',
                    error: error instanceof Error ? error.message : 'Unknown middleware error',
                };
            }

        } catch (error) {
            console.log('   ❌ Middleware authentication test failed');
            return {
                testName,
                success: false,
                duration: Date.now() - startTime,
                details: 'Middleware authentication test error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Test 4: User Data Attachment (Requirement 1.4 & 2.3)
     */
    private async testUserDataAttachment(token?: string): Promise<TestResult> {
        const testName = 'User Data Attachment to Request';
        const startTime = Date.now();

        console.log(`\n4️⃣ ${testName}...`);

        try {
            if (!token) {
                console.log('   ❌ No token for user data attachment test');
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'No token provided',
                    error: 'Cannot test user data attachment without a token',
                };
            }

            // Create mock request and response
            const mockReq = this.createMockRequest(token);
            const mockRes = this.createMockResponse();

            // Execute middleware and check if user is attached
            const middlewarePromise = new Promise<void>((resolve, reject) => {
                const next = (error?: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                };

                const authHandler = this.services!.authMiddleware.requireAuth();
                authHandler(mockReq, mockRes, next);
            });

            try {
                await middlewarePromise;

                // Check if user data was attached
                if (mockReq.user) {
                    console.log(`   ✅ User data attached: ${mockReq.user.email} (${mockReq.user.id})`);
                    return {
                        testName,
                        success: true,
                        duration: Date.now() - startTime,
                        details: `User data successfully attached - ID: ${mockReq.user.id}, Email: ${mockReq.user.email}`,
                    };
                } else {
                    console.log('   ❌ User data not attached to request');
                    return {
                        testName,
                        success: false,
                        duration: Date.now() - startTime,
                        details: 'Middleware completed but user data not attached to request object',
                        error: 'req.user is undefined after middleware processing',
                    };
                }

            } catch (error) {
                console.log('   ❌ Middleware failed during user data attachment');
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'Middleware failed during execution',
                    error: error instanceof Error ? error.message : 'Unknown middleware error',
                };
            }

        } catch (error) {
            console.log('   ❌ User data attachment test failed');
            return {
                testName,
                success: false,
                duration: Date.now() - startTime,
                details: 'User data attachment test error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Test 5: Controller Access to User Data (Requirement 1.5)
     */
    private async testControllerUserAccess(token?: string): Promise<TestResult> {
        const testName = 'Controller Access to User Data';
        const startTime = Date.now();

        console.log(`\n5️⃣ ${testName}...`);

        try {
            if (!token) {
                console.log('   ❌ No token for controller access test');
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'No token provided',
                    error: 'Cannot test controller access without a token',
                };
            }

            // First, get user data through middleware
            const mockReq = this.createMockRequest(token);
            const mockRes = this.createMockResponse();

            const middlewarePromise = new Promise<void>((resolve, reject) => {
                const next = (error?: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                };

                const authHandler = this.services!.authMiddleware.requireAuth();
                authHandler(mockReq, mockRes, next);
            });

            try {
                await middlewarePromise;

                if (!mockReq.user) {
                    console.log('   ❌ No user data available for controller');
                    return {
                        testName,
                        success: false,
                        duration: Date.now() - startTime,
                        details: 'Middleware did not attach user data',
                        error: 'req.user is undefined - controller cannot access user data',
                    };
                }

                // Test that controller can access user data
                const userId = mockReq.user.id;
                const userEmail = mockReq.user.email;

                if (userId && userEmail) {
                    console.log(`   ✅ Controller can access user data: ${userEmail} (${userId})`);
                    return {
                        testName,
                        success: true,
                        duration: Date.now() - startTime,
                        details: `Controller has access to user data - ID: ${userId}, Email: ${userEmail}`,
                    };
                } else {
                    console.log('   ❌ User data incomplete');
                    return {
                        testName,
                        success: false,
                        duration: Date.now() - startTime,
                        details: 'User data attached but missing required fields',
                        error: 'User object missing id or email fields',
                    };
                }

            } catch (error) {
                console.log('   ❌ Middleware failed during controller access test');
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'Middleware failed during execution',
                    error: error instanceof Error ? error.message : 'Unknown middleware error',
                };
            }

        } catch (error) {
            console.log('   ❌ Controller access test failed');
            return {
                testName,
                success: false,
                duration: Date.now() - startTime,
                details: 'Controller access test error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Test 6: getUserSwaps Method Execution (Requirement 1.1)
     */
    private async testGetUserSwapsExecution(token?: string): Promise<TestResult> {
        const testName = 'getUserSwaps Method Execution';
        const startTime = Date.now();

        console.log(`\n6️⃣ ${testName}...`);

        try {
            if (!token) {
                console.log('   ❌ No token for getUserSwaps test');
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'No token provided',
                    error: 'Cannot test getUserSwaps without a token',
                };
            }

            // Set up authenticated request
            const mockReq = this.createMockRequest(token);
            const mockRes = this.createMockResponse();

            // First authenticate through middleware
            const middlewarePromise = new Promise<void>((resolve, reject) => {
                const next = (error?: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                };

                const authHandler = this.services!.authMiddleware.requireAuth();
                authHandler(mockReq, mockRes, next);
            });

            try {
                await middlewarePromise;

                if (!mockReq.user) {
                    console.log('   ❌ Authentication failed - no user data');
                    return {
                        testName,
                        success: false,
                        duration: Date.now() - startTime,
                        details: 'Authentication failed - user not attached',
                        error: 'Cannot test getUserSwaps without authenticated user',
                    };
                }

                // Execute getUserSwaps method
                await this.services!.swapController.getUserSwaps(mockReq, mockRes);

                // Check response
                if (mockRes.statusCode === 200) {
                    console.log('   ✅ getUserSwaps returned 200 OK');
                    return {
                        testName,
                        success: true,
                        duration: Date.now() - startTime,
                        details: `getUserSwaps executed successfully with status 200`,
                    };
                } else {
                    console.log(`   ❌ getUserSwaps returned ${mockRes.statusCode}`);
                    return {
                        testName,
                        success: false,
                        duration: Date.now() - startTime,
                        details: `getUserSwaps returned status ${mockRes.statusCode}`,
                        error: mockRes.responseData?.error?.message || 'Non-200 response from getUserSwaps',
                    };
                }

            } catch (error) {
                console.log('   ❌ getUserSwaps execution failed');
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'getUserSwaps method threw an error',
                    error: error instanceof Error ? error.message : 'Unknown getUserSwaps error',
                };
            }

        } catch (error) {
            console.log('   ❌ getUserSwaps test failed');
            return {
                testName,
                success: false,
                duration: Date.now() - startTime,
                details: 'getUserSwaps test error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Test 7: End-to-End Authentication Flow
     */
    private async testEndToEndFlow(token?: string, expectedUserId?: string): Promise<TestResult> {
        const testName = 'End-to-End Authentication Flow';
        const startTime = Date.now();

        console.log(`\n7️⃣ ${testName}...`);

        try {
            if (!token) {
                console.log('   ❌ No token for end-to-end test');
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'No token provided',
                    error: 'Cannot test end-to-end flow without a token',
                };
            }

            // Complete flow: token -> middleware -> controller -> response
            const mockReq = this.createMockRequest(token);
            const mockRes = this.createMockResponse();

            // Step 1: Middleware authentication
            const middlewarePromise = new Promise<void>((resolve, reject) => {
                const next = (error?: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                };

                const authHandler = this.services!.authMiddleware.requireAuth();
                authHandler(mockReq, mockRes, next);
            });

            await middlewarePromise;

            // Step 2: Verify user attachment
            if (!mockReq.user) {
                console.log('   ❌ End-to-end: User not attached');
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'End-to-end flow failed at user attachment step',
                    error: 'User data not attached to request',
                };
            }

            // Step 3: Verify expected user (if provided)
            if (expectedUserId && mockReq.user.id !== expectedUserId) {
                console.log(`   ❌ End-to-end: Wrong user ID (expected ${expectedUserId}, got ${mockReq.user.id})`);
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'End-to-end flow failed at user validation step',
                    error: `Expected user ID ${expectedUserId}, but got ${mockReq.user.id}`,
                };
            }

            // Step 4: Execute controller
            await this.services!.swapController.getUserSwaps(mockReq, mockRes);

            // Step 5: Verify response
            if (mockRes.statusCode === 200) {
                console.log('   ✅ End-to-end authentication flow successful');
                return {
                    testName,
                    success: true,
                    duration: Date.now() - startTime,
                    details: `Complete flow successful: token -> middleware -> user attachment -> controller -> 200 response`,
                };
            } else {
                console.log(`   ❌ End-to-end: Controller returned ${mockRes.statusCode}`);
                return {
                    testName,
                    success: false,
                    duration: Date.now() - startTime,
                    details: 'End-to-end flow failed at controller response step',
                    error: `Controller returned ${mockRes.statusCode} instead of 200`,
                };
            }

        } catch (error) {
            console.log('   ❌ End-to-end test failed');
            return {
                testName,
                success: false,
                duration: Date.now() - startTime,
                details: 'End-to-end test error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Evaluate requirements based on test results
     */
    private evaluateRequirements(testSuite: AuthFlowTestSuite): void {
        // Requirement 1.1: Valid token returns 200 with swaps data
        const getUserSwapsTest = testSuite.tests.find(t => t.testName === 'getUserSwaps Method Execution');
        testSuite.requirements.req_1_1 = getUserSwapsTest?.success || false;

        // Requirement 1.4: Middleware extracts and attaches user info
        const userDataTest = testSuite.tests.find(t => t.testName === 'User Data Attachment to Request');
        testSuite.requirements.req_1_4 = userDataTest?.success || false;

        // Requirement 1.5: getUserSwaps has access to user data
        const controllerAccessTest = testSuite.tests.find(t => t.testName === 'Controller Access to User Data');
        testSuite.requirements.req_1_5 = controllerAccessTest?.success || false;

        // Requirement 2.3: Token validation attaches user data
        testSuite.requirements.req_2_3 = userDataTest?.success || false;
    }

    /**
     * Create mock Express request
     */
    private createMockRequest(token: string): Request {
        return {
            headers: {
                authorization: `Bearer ${token}`,
                'x-request-id': `test-${Date.now()}`,
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

    /**
     * Display test results
     */
    displayResults(testSuite: AuthFlowTestSuite): void {
        console.log('\n📊 Test Results Summary');
        console.log('='.repeat(60));
        console.log(`Test ID: ${testSuite.testId}`);
        console.log(`Timestamp: ${testSuite.timestamp.toISOString()}`);
        console.log(`Overall Success: ${testSuite.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Total Duration: ${testSuite.totalDuration}ms`);
        console.log(`Tests: ${testSuite.summary.passed}/${testSuite.summary.total} passed`);

        console.log('\n📋 Individual Test Results:');
        testSuite.tests.forEach((test, index) => {
            const status = test.success ? '✅' : '❌';
            console.log(`${index + 1}. ${status} ${test.testName} (${test.duration}ms)`);
            if (test.error) {
                console.log(`   Error: ${test.error}`);
            }
            console.log(`   Details: ${test.details}`);
        });

        console.log('\n🎯 Requirements Validation:');
        console.log(`Req 1.1 - Valid token returns 200 with swaps: ${testSuite.requirements.req_1_1 ? '✅' : '❌'}`);
        console.log(`Req 1.4 - Middleware extracts user info: ${testSuite.requirements.req_1_4 ? '✅' : '❌'}`);
        console.log(`Req 1.5 - getUserSwaps has user data access: ${testSuite.requirements.req_1_5 ? '✅' : '❌'}`);
        console.log(`Req 2.3 - Token validation attaches user data: ${testSuite.requirements.req_2_3 ? '✅' : '❌'}`);

        console.log('\n' + '='.repeat(60));

        if (testSuite.overallSuccess) {
            console.log('🎉 All tests passed! Authentication flow is working correctly.');
            console.log('✅ The getUserSwaps method receives properly authenticated requests.');
        } else {
            console.log('❌ Some tests failed. Review the results above to identify issues.');
        }
    }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    let token: string | undefined;
    let expectedUserId: string | undefined;

    // Parse command line arguments
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
🧪 Real Token Authentication Flow Tester

This script tests the complete authentication flow from token extraction
through user data attachment, verifying that getUserSwaps receives
properly authenticated requests.

Usage:
  npm run test:real-token-auth [options]

Options:
  --token <jwt-token>     JWT token to test (optional)
  --user-id <user-id>     Expected user ID for validation (optional)
  --help, -h             Display this help message

Examples:
  # Test with a real JWT token
  npm run test:real-token-auth -- --token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

  # Test with token and expected user ID
  npm run test:real-token-auth -- --token="your-token" --user-id="user-123"

  # Test without token (will show what happens with no authentication)
  npm run test:real-token-auth

Requirements tested:
- 1.1: Valid token returns 200 with swaps data
- 1.4: Middleware extracts and attaches user info
- 1.5: getUserSwaps has access to user data
- 2.3: Token validation attaches user data
`);
            process.exit(0);
        }
    }

    console.log('🚀 Starting Real Token Authentication Flow Test');
    console.log('Task 4: Test and validate authentication flow with real tokens');
    console.log('');

    try {
        const tester = new RealTokenAuthTester();
        await tester.initializeServices();

        const testSuite = await tester.runTestSuite(token, expectedUserId);
        tester.displayResults(testSuite);

        if (testSuite.overallSuccess) {
            process.exit(0);
        } else {
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

