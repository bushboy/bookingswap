#!/usr/bin/env node

/**
 * Command-line script to test authentication flow with real tokens
 * 
 * Usage:
 * npm run test:auth-flow -- --token="your-jwt-token-here"
 * npm run test:auth-flow -- --token="your-jwt-token-here" --user-id="expected-user-id"
 * npm run test:auth-flow -- --help
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
import { testAuthFlowWithRealToken, runSampleAuthFlowTests } from './test-auth-flow-with-real-tokens';
import { enhancedLogger } from '../utils/logger';

interface TestOptions {
    token?: string;
    userId?: string;
    endpoint?: string;
    help?: boolean;
    sample?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArguments(): TestOptions {
    const args = process.argv.slice(2);
    const options: TestOptions = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--sample') {
            options.sample = true;
        } else if (arg.startsWith('--token=')) {
            options.token = arg.split('=')[1];
        } else if (arg.startsWith('--user-id=')) {
            options.userId = arg.split('=')[1];
        } else if (arg.startsWith('--endpoint=')) {
            options.endpoint = arg.split('=')[1];
        } else if (arg === '--token' && i + 1 < args.length) {
            options.token = args[++i];
        } else if (arg === '--user-id' && i + 1 < args.length) {
            options.userId = args[++i];
        } else if (arg === '--endpoint' && i + 1 < args.length) {
            options.endpoint = args[++i];
        }
    }

    return options;
}

/**
 * Display help information
 */
function displayHelp(): void {
    console.log(`
🔍 Authentication Flow Test Script

This script tests the complete authentication flow from token extraction
through user data attachment, specifically validating that the getUserSwaps
method receives properly authenticated requests.

Usage:
  npm run test:auth-flow -- [options]

Options:
  --token <jwt-token>     JWT token to test (required unless using --sample)
  --user-id <user-id>     Expected user ID for validation (optional)
  --endpoint <endpoint>   API endpoint to test (default: /api/swaps)
  --sample               Run sample tests with mock data
  --help, -h             Display this help message

Examples:
  # Test with a real JWT token
  npm run test:auth-flow -- --token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

  # Test with token and expected user ID
  npm run test:auth-flow -- --token="your-token" --user-id="user-123"

  # Test different endpoint
  npm run test:auth-flow -- --token="your-token" --endpoint="/api/swaps/browse"

  # Run sample tests
  npm run test:auth-flow -- --sample

Environment Variables:
  JWT_SECRET             JWT secret for token verification
  DATABASE_URL           Database connection string
  NODE_ENV              Environment (development/production)

The script will:
1. Extract and validate the JWT token format
2. Process the token through the authentication middleware
3. Execute the getUserSwaps controller method
4. Validate end-to-end authentication flow
5. Provide detailed diagnostics and recommendations

Exit Codes:
  0 - Test passed successfully
  1 - Test failed or error occurred
  2 - Invalid arguments or configuration
`);
}

/**
 * Initialize services for testing
 */
async function initializeServices(): Promise<{
    authService: AuthService;
    userRepository: UserRepository;
    swapController: SwapController;
    authMiddleware: AuthMiddleware;
}> {
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

        // Initialize swap services (with minimal dependencies for testing)
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

        return {
            authService,
            userRepository,
            swapController,
            authMiddleware,
        };

    } catch (error) {
        console.error('❌ Failed to initialize services:', error);
        throw error;
    }
}

/**
 * Run the authentication flow test
 */
async function runTest(options: TestOptions): Promise<void> {
    try {
        console.log('🚀 Initializing Authentication Flow Test...\n');

        // Initialize services
        const services = await initializeServices();
        console.log('✅ Services initialized successfully\n');

        if (options.sample) {
            // Run sample tests
            console.log('🧪 Running sample authentication flow tests...\n');
            await runSampleAuthFlowTests(
                services.authService,
                services.userRepository,
                services.swapController,
                services.authMiddleware
            );
            return;
        }

        if (!options.token) {
            console.error('❌ Error: JWT token is required. Use --token option or --sample for sample tests.');
            console.log('Use --help for usage information.');
            process.exit(2);
        }

        console.log('🔍 Testing authentication flow with provided token...\n');
        console.log(`Token length: ${options.token.length} characters`);
        if (options.userId) {
            console.log(`Expected user ID: ${options.userId}`);
        }
        if (options.endpoint) {
            console.log(`Test endpoint: ${options.endpoint}`);
        }
        console.log('');

        // Run the test
        const result = await testAuthFlowWithRealToken(
            services.authService,
            services.userRepository,
            services.swapController,
            services.authMiddleware,
            options.token,
            options.userId
        );

        // Display results
        console.log('📊 Test Results:');
        console.log('================\n');

        console.log(`Test ID: ${result.testId}`);
        console.log(`Overall Success: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Total Duration: ${result.performance.totalDuration}ms\n`);

        // Step-by-step results
        console.log('Step Results:');
        console.log(`1. Token Extraction: ${result.steps.tokenExtraction.success ? '✅' : '❌'}`);
        if (result.steps.tokenExtraction.error) {
            console.log(`   Error: ${result.steps.tokenExtraction.error}`);
        }
        console.log(`   Token Format: ${result.steps.tokenExtraction.tokenFormat}`);
        console.log(`   Token Length: ${result.steps.tokenExtraction.tokenLength}`);

        console.log(`\n2. Middleware Processing: ${result.steps.middlewareProcessing.success ? '✅' : '❌'}`);
        if (result.steps.middlewareProcessing.error) {
            console.log(`   Error: ${result.steps.middlewareProcessing.error}`);
        }
        console.log(`   User Attached: ${result.steps.middlewareProcessing.userAttached ? '✅' : '❌'}`);
        console.log(`   Duration: ${result.performance.middlewareDuration}ms`);

        console.log(`\n3. Controller Execution: ${result.steps.controllerExecution.success ? '✅' : '❌'}`);
        if (result.steps.controllerExecution.error) {
            console.log(`   Error: ${result.steps.controllerExecution.error}`);
        }
        console.log(`   User Data Available: ${result.steps.controllerExecution.userDataAvailable ? '✅' : '❌'}`);
        if (result.steps.controllerExecution.responseStatus) {
            console.log(`   Response Status: ${result.steps.controllerExecution.responseStatus}`);
        }
        console.log(`   Duration: ${result.performance.controllerDuration}ms`);

        console.log(`\n4. End-to-End Validation: ${result.steps.endToEndValidation.success ? '✅' : '❌'}`);
        if (result.steps.endToEndValidation.error) {
            console.log(`   Error: ${result.steps.endToEndValidation.error}`);
        }
        console.log(`   Authentication Complete: ${result.steps.endToEndValidation.authenticationComplete ? '✅' : '❌'}`);
        console.log(`   User Data Correct: ${result.steps.endToEndValidation.userDataCorrect ? '✅' : '❌'}`);
        console.log(`   Swaps Accessible: ${result.steps.endToEndValidation.swapsAccessible ? '✅' : '❌'}`);

        // Recommendations
        if (result.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            result.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec}`);
            });
        }

        // Debug information
        if (result.steps.middlewareProcessing.debugInfo) {
            console.log('\n🔍 Debug Information:');
            const debug = result.steps.middlewareProcessing.debugInfo;
            console.log(`JWT Secret Configured: ${debug.jwtSecretConfigured ? '✅' : '❌'}`);
            console.log(`Token Verification Result: ${debug.verificationResult}`);
            console.log(`User Found: ${debug.userFound ? '✅' : '❌'}`);
            if (debug.tokenPayload) {
                console.log(`Token User ID: ${debug.tokenPayload.userId}`);
                console.log(`Token Email: ${debug.tokenPayload.email}`);
            }
        }

        console.log('\n================');

        if (result.success) {
            console.log('🎉 Authentication flow test completed successfully!');
            console.log('The getUserSwaps method should receive properly authenticated requests.');
            process.exit(0);
        } else {
            console.log('❌ Authentication flow test failed.');
            console.log('Review the recommendations above to fix the issues.');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Test execution failed:', error);

        if (error instanceof Error) {
            console.error('Error details:', error.message);
            if (error.stack) {
                console.error('Stack trace:', error.stack);
            }
        }

        process.exit(1);
    }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
    const options = parseArguments();

    if (options.help) {
        displayHelp();
        process.exit(0);
    }

    // Set up logging
    enhancedLogger.info('Starting authentication flow test script', {
        category: 'authentication_test',
        hasToken: !!options.token,
        hasSample: !!options.sample,
    });

    try {
        await runTest(options);
    } catch (error) {
        enhancedLogger.error('Authentication flow test script failed', {
            category: 'authentication_test',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

// Execute if run directly
if (require.main === module) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { main as runAuthFlowTestScript };