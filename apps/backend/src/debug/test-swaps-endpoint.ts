/**
 * HTTP Endpoint Test for /swaps with Real Tokens
 * 
 * This script tests the actual /swaps endpoint over HTTP to validate
 * the complete authentication flow in a real server environment.
 */

import fetch from 'node-fetch';
import { enhancedLogger } from '../utils/logger';

export interface SwapsEndpointTestConfig {
    baseUrl: string;
    token: string;
    endpoint?: string;
    method?: string;
    timeout?: number;
}

export interface SwapsEndpointTestResult {
    success: boolean;
    testId: string;
    timestamp: Date;
    config: SwapsEndpointTestConfig;
    request: {
        url: string;
        method: string;
        headers: Record<string, string>;
        timestamp: Date;
    };
    response: {
        status: number;
        statusText: string;
        headers: Record<string, string>;
        body: any;
        timestamp: Date;
        duration: number;
    };
    authentication: {
        tokenSent: boolean;
        authHeaderFormat: string;
        serverRecognizedAuth: boolean;
        userDataReturned: boolean;
    };
    validation: {
        expectedStatus: number;
        actualStatus: number;
        statusMatches: boolean;
        hasSwapsData: boolean;
        hasUserInfo: boolean;
        errorDetails?: string;
    };
    recommendations: string[];
}

/**
 * Test the /swaps endpoint with a real token over HTTP
 */
export async function testSwapsEndpointWithToken(config: SwapsEndpointTestConfig): Promise<SwapsEndpointTestResult> {
    const testId = `swaps-endpoint-test-${Date.now()}`;
    const startTime = Date.now();

    const result: SwapsEndpointTestResult = {
        success: false,
        testId,
        timestamp: new Date(),
        config,
        request: {
            url: '',
            method: config.method || 'GET',
            headers: {},
            timestamp: new Date(),
        },
        response: {
            status: 0,
            statusText: '',
            headers: {},
            body: null,
            timestamp: new Date(),
            duration: 0,
        },
        authentication: {
            tokenSent: false,
            authHeaderFormat: 'none',
            serverRecognizedAuth: false,
            userDataReturned: false,
        },
        validation: {
            expectedStatus: 200,
            actualStatus: 0,
            statusMatches: false,
            hasSwapsData: false,
            hasUserInfo: false,
        },
        recommendations: [],
    };

    try {
        enhancedLogger.info('Starting swaps endpoint test', {
            category: 'endpoint_test',
            testId,
            baseUrl: config.baseUrl,
            endpoint: config.endpoint || '/api/swaps',
        });

        // Prepare request
        const endpoint = config.endpoint || '/api/swaps';
        const url = `${config.baseUrl}${endpoint}`;
        const method = config.method || 'GET';

        result.request.url = url;
        result.request.method = method;
        result.request.timestamp = new Date();

        // Prepare headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'AuthFlow-Test-Script/1.0',
        };

        if (config.token) {
            headers['Authorization'] = `Bearer ${config.token}`;
            result.authentication.tokenSent = true;
            result.authentication.authHeaderFormat = 'Bearer';
        }

        result.request.headers = headers;

        // Make the request
        const requestStart = Date.now();

        const fetchOptions: any = {
            method,
            headers,
            timeout: config.timeout || 10000,
        };

        const response = await fetch(url, fetchOptions);

        const requestEnd = Date.now();
        result.response.duration = requestEnd - requestStart;
        result.response.timestamp = new Date(requestEnd);

        // Process response
        result.response.status = response.status;
        result.response.statusText = response.statusText;
        result.validation.actualStatus = response.status;

        // Extract response headers
        response.headers.forEach((value, key) => {
            result.response.headers[key] = value;
        });

        // Parse response body
        try {
            const responseText = await response.text();
            if (responseText) {
                result.response.body = JSON.parse(responseText);
            }
        } catch (error) {
            result.response.body = { error: 'Failed to parse response body' };
        }

        // Analyze authentication
        result.authentication.serverRecognizedAuth = result.response.status !== 401;

        if (result.response.body) {
            // Check if response contains user-specific data
            result.authentication.userDataReturned =
                result.response.body.data?.swaps !== undefined ||
                result.response.body.success === true;
        }

        // Validate response
        result.validation.statusMatches = result.response.status === result.validation.expectedStatus;

        if (result.response.status === 200 && result.response.body?.success) {
            result.validation.hasSwapsData = Array.isArray(result.response.body.data?.swaps);
            result.validation.hasUserInfo = true;
            result.success = true;
        } else if (result.response.status === 401) {
            result.validation.errorDetails = 'Authentication failed - 401 Unauthorized';
        } else if (result.response.status >= 500) {
            result.validation.errorDetails = 'Server error - check server logs';
        } else {
            result.validation.errorDetails = `Unexpected status: ${result.response.status}`;
        }

        // Generate recommendations
        generateEndpointTestRecommendations(result);

        enhancedLogger.info('Swaps endpoint test completed', {
            category: 'endpoint_test',
            testId,
            success: result.success,
            status: result.response.status,
            duration: result.response.duration,
        });

        return result;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.validation.errorDetails = errorMessage;
        result.recommendations.push(`Request failed: ${errorMessage}`);

        enhancedLogger.error('Swaps endpoint test failed', {
            category: 'endpoint_test',
            testId,
            error: errorMessage,
        });

        return result;
    }
}

/**
 * Generate recommendations based on endpoint test results
 */
function generateEndpointTestRecommendations(result: SwapsEndpointTestResult): void {
    if (result.response.status === 401) {
        if (!result.authentication.tokenSent) {
            result.recommendations.push('No authentication token was sent - provide a valid JWT token');
        } else {
            result.recommendations.push('Authentication failed - check if token is valid and not expired');
            result.recommendations.push('Verify JWT secret configuration matches between client and server');
            result.recommendations.push('Check if user associated with token exists in database');
        }
    } else if (result.response.status === 403) {
        result.recommendations.push('Access forbidden - user may not have permission to access swaps');
    } else if (result.response.status === 404) {
        result.recommendations.push('Endpoint not found - verify the /api/swaps route is properly configured');
    } else if (result.response.status >= 500) {
        result.recommendations.push('Server error - check server logs for detailed error information');
        result.recommendations.push('Verify database connectivity and service dependencies');
    } else if (result.response.status === 200 && !result.validation.hasSwapsData) {
        result.recommendations.push('Request succeeded but no swaps data returned - user may have no swaps');
    }

    if (result.response.duration > 5000) {
        result.recommendations.push('Request took longer than 5 seconds - consider performance optimization');
    }

    if (result.success) {
        result.recommendations.push('✅ Endpoint test passed - authentication and swaps access working correctly');
    }
}

/**
 * Test multiple endpoints with the same token
 */
export async function testMultipleEndpoints(
    baseConfig: Omit<SwapsEndpointTestConfig, 'endpoint'>,
    endpoints: string[]
): Promise<SwapsEndpointTestResult[]> {
    const results: SwapsEndpointTestResult[] = [];

    for (const endpoint of endpoints) {
        const config = { ...baseConfig, endpoint };
        const result = await testSwapsEndpointWithToken(config);
        results.push(result);

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
}

/**
 * Command-line interface for endpoint testing
 */
export async function runEndpointTestCLI(): Promise<void> {
    const args = process.argv.slice(2);

    let token = '';
    let baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    let endpoint = '/api/swaps';

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--token=')) {
            token = arg.split('=')[1];
        } else if (arg.startsWith('--url=')) {
            baseUrl = arg.split('=')[1];
        } else if (arg.startsWith('--endpoint=')) {
            endpoint = arg.split('=')[1];
        } else if (arg === '--token' && i + 1 < args.length) {
            token = args[++i];
        } else if (arg === '--url' && i + 1 < args.length) {
            baseUrl = args[++i];
        } else if (arg === '--endpoint' && i + 1 < args.length) {
            endpoint = args[++i];
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
🌐 Swaps Endpoint Test Script

Usage:
  node test-swaps-endpoint.js [options]

Options:
  --token <jwt-token>     JWT token to test (required)
  --url <base-url>        Base URL (default: http://localhost:3001)
  --endpoint <endpoint>   Endpoint to test (default: /api/swaps)
  --help, -h             Show this help

Examples:
  node test-swaps-endpoint.js --token="your-jwt-token"
  node test-swaps-endpoint.js --token="token" --url="https://api.example.com"
  node test-swaps-endpoint.js --token="token" --endpoint="/api/swaps/browse"
`);
            process.exit(0);
        }
    }

    if (!token) {
        console.error('❌ Error: JWT token is required. Use --token option.');
        console.log('Use --help for usage information.');
        process.exit(1);
    }

    console.log('🌐 Testing Swaps Endpoint...\n');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Token length: ${token.length} characters\n`);

    try {
        const result = await testSwapsEndpointWithToken({
            baseUrl,
            token,
            endpoint,
        });

        // Display results
        console.log('📊 Test Results:');
        console.log('================\n');

        console.log(`Test ID: ${result.testId}`);
        console.log(`Success: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Request URL: ${result.request.url}`);
        console.log(`Response Status: ${result.response.status} ${result.response.statusText}`);
        console.log(`Response Time: ${result.response.duration}ms\n`);

        console.log('Authentication Analysis:');
        console.log(`Token Sent: ${result.authentication.tokenSent ? '✅' : '❌'}`);
        console.log(`Server Recognized Auth: ${result.authentication.serverRecognizedAuth ? '✅' : '❌'}`);
        console.log(`User Data Returned: ${result.authentication.userDataReturned ? '✅' : '❌'}\n`);

        console.log('Response Validation:');
        console.log(`Expected Status: ${result.validation.expectedStatus}`);
        console.log(`Actual Status: ${result.validation.actualStatus}`);
        console.log(`Status Matches: ${result.validation.statusMatches ? '✅' : '❌'}`);
        console.log(`Has Swaps Data: ${result.validation.hasSwapsData ? '✅' : '❌'}\n`);

        if (result.response.body) {
            console.log('Response Body:');
            console.log(JSON.stringify(result.response.body, null, 2));
            console.log('');
        }

        if (result.recommendations.length > 0) {
            console.log('💡 Recommendations:');
            result.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec}`);
            });
            console.log('');
        }

        console.log('================');

        if (result.success) {
            console.log('🎉 Endpoint test completed successfully!');
            process.exit(0);
        } else {
            console.log('❌ Endpoint test failed.');
            if (result.validation.errorDetails) {
                console.log(`Error: ${result.validation.errorDetails}`);
            }
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    }
}

// Export for use in other modules
export default {
    testSwapsEndpointWithToken,
    testMultipleEndpoints,
    runEndpointTestCLI,
};

// Execute CLI if run directly
if (require.main === module) {
    runEndpointTestCLI().catch(console.error);
}