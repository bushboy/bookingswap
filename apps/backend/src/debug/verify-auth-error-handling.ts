/**
 * Verification script for enhanced authentication error handling
 * This script tests the various error scenarios and validates the error responses
 */

import { AuthMiddleware, AUTH_ERROR_CODES } from '../middleware/auth';

// Mock implementations for testing
class MockAuthService {
    async verifyToken(token: string) {
        if (token.includes('expired')) {
            throw new Error('Token expired');
        }
        if (token.includes('blacklisted')) {
            throw new Error('Token blacklisted');
        }
        if (token.includes('invalid-signature')) {
            throw new Error('Invalid signature');
        }
        if (token.includes('valid')) {
            return {
                userId: '123',
                email: 'test@example.com',
                username: 'testuser',
                iat: Date.now() / 1000,
                exp: (Date.now() / 1000) + 3600,
            };
        }
        throw new Error('Generic verification error');
    }

    async refreshTokenIfNeeded(token: string) {
        return null;
    }
}

class MockUserRepository {
    async findById(userId: string) {
        if (userId === 'nonexistent') {
            return null;
        }
        if (userId === 'db-error') {
            throw new Error('Database connection failed');
        }
        return {
            id: userId,
            email: 'test@example.com',
            username: 'testuser',
            verification: { level: 'verified' as const },
            reputation: { score: 100 },
        };
    }

    async updateLastActive(userId: string) {
        // Mock implementation
    }
}

// Mock Express request/response objects
function createMockRequest(authHeader?: string) {
    return {
        headers: authHeader ? { authorization: authHeader } : {},
        path: '/test',
        method: 'GET',
        ip: '127.0.0.1',
        params: {},
    } as any;
}

function createMockResponse() {
    const response = {
        statusCode: 200,
        responseData: null,
        headers: {} as any,
        status: function (code: number) {
            this.statusCode = code;
            return this;
        },
        json: function (data: any) {
            this.responseData = data;
            return this;
        },
        setHeader: function (name: string, value: string) {
            this.headers[name] = value;
        },
        getHeader: function (name: string) {
            return this.headers[name];
        },
    };
    return response as any;
}

async function testErrorScenario(
    scenario: string,
    authHeader: string | undefined,
    expectedErrorCode: string,
    expectedStatus: number
) {
    console.log(`\n🧪 Testing: ${scenario}`);

    const authMiddleware = new AuthMiddleware(
        new MockAuthService() as any,
        new MockUserRepository() as any
    );

    const req = createMockRequest(authHeader);
    const res = createMockResponse();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const middleware = authMiddleware.authenticate({ required: true });

    try {
        await middleware(req, res, next);

        if (res.responseData?.error) {
            const error = res.responseData.error;
            console.log(`   ✅ Status: ${res.statusCode} (expected: ${expectedStatus})`);
            console.log(`   ✅ Error Code: ${error.code} (expected: ${expectedErrorCode})`);
            console.log(`   ✅ Message: ${error.message}`);
            console.log(`   ✅ Category: ${error.category}`);

            if (error.debugInfo) {
                console.log(`   ✅ Debug Step: ${error.debugInfo.step}`);
                console.log(`   ✅ Debug Details: ${error.debugInfo.details}`);
            }

            // Validate response structure
            if (res.statusCode === expectedStatus && error.code === expectedErrorCode) {
                console.log(`   ✅ Test PASSED`);
                return true;
            } else {
                console.log(`   ❌ Test FAILED - Status or error code mismatch`);
                return false;
            }
        } else if (nextCalled) {
            console.log(`   ✅ Authentication successful - next() called`);
            return true;
        } else {
            console.log(`   ❌ Test FAILED - No error response and next() not called`);
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Test FAILED - Unexpected error: ${error}`);
        return false;
    }
}

async function runVerificationTests() {
    console.log('🚀 Starting Authentication Error Handling Verification\n');

    // Set development environment for debug info
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'test-secret';

    const tests = [
        {
            scenario: 'Missing Authorization Header',
            authHeader: undefined,
            expectedErrorCode: AUTH_ERROR_CODES.MISSING_TOKEN.code,
            expectedStatus: AUTH_ERROR_CODES.MISSING_TOKEN.httpStatus,
        },
        {
            scenario: 'Invalid Authorization Format (Basic instead of Bearer)',
            authHeader: 'Basic sometoken',
            expectedErrorCode: AUTH_ERROR_CODES.MISSING_TOKEN.code,
            expectedStatus: AUTH_ERROR_CODES.MISSING_TOKEN.httpStatus,
        },
        {
            scenario: 'Invalid JWT Format',
            authHeader: 'Bearer invalid-token',
            expectedErrorCode: AUTH_ERROR_CODES.INVALID_TOKEN_FORMAT.code,
            expectedStatus: AUTH_ERROR_CODES.INVALID_TOKEN_FORMAT.httpStatus,
        },
        {
            scenario: 'Expired Token',
            authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.expired',
            expectedErrorCode: AUTH_ERROR_CODES.TOKEN_EXPIRED.code,
            expectedStatus: AUTH_ERROR_CODES.TOKEN_EXPIRED.httpStatus,
        },
        {
            scenario: 'Blacklisted Token',
            authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.blacklisted',
            expectedErrorCode: AUTH_ERROR_CODES.TOKEN_BLACKLISTED.code,
            expectedStatus: AUTH_ERROR_CODES.TOKEN_BLACKLISTED.httpStatus,
        },
        {
            scenario: 'Invalid Signature',
            authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.invalid-signature',
            expectedErrorCode: AUTH_ERROR_CODES.JWT_SECRET_ERROR.code,
            expectedStatus: AUTH_ERROR_CODES.JWT_SECRET_ERROR.httpStatus,
        },
        {
            scenario: 'Valid Token with Successful Authentication',
            authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.valid',
            expectedErrorCode: '', // No error expected
            expectedStatus: 200,
        },
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    for (const test of tests) {
        const passed = await testErrorScenario(
            test.scenario,
            test.authHeader,
            test.expectedErrorCode,
            test.expectedStatus
        );
        if (passed) passedTests++;
    }

    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);

    if (passedTests === totalTests) {
        console.log('🎉 All authentication error handling tests PASSED!');
        console.log('\n✅ Enhanced error handling implementation is working correctly:');
        console.log('   • Proper error categorization and messaging');
        console.log('   • Specific error codes for different failure scenarios');
        console.log('   • Structured error responses with debug information');
        console.log('   • Correct HTTP status codes for each error type');
    } else {
        console.log('❌ Some tests failed. Please review the implementation.');
    }
}

// Run the verification if this script is executed directly
if (require.main === module) {
    runVerificationTests().catch(console.error);
}

export { runVerificationTests };