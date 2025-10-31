#!/usr/bin/env node

/**
 * Direct validation middleware testing
 * Tests the validation middleware functions directly without HTTP layer
 */

import { validateBookingCreation } from './apps/backend/dist/middleware/bookingValidation.js';

// All enabled booking types from centralized config
const ENABLED_BOOKING_TYPES = [
    'hotel',
    'vacation_rental',
    'resort',
    'hostel',
    'bnb'
];

// Test booking data template - matches what the frontend would send
const createTestBookingData = (type) => ({
    type,
    title: `Test ${type.replace('_', ' ')} Booking`,
    description: `A test booking for ${type} accommodation type validation`,
    location: {
        city: 'New York',
        country: 'USA',
        coordinates: [-74.006, 40.7128]
    },
    dateRange: {
        checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days from now
    },
    originalPrice: 200,
    swapValue: 180,
    providerDetails: {
        provider: 'Test Provider',
        confirmationNumber: `TEST-${type.toUpperCase()}-${Date.now()}`,
        bookingReference: `REF-${type}-${Math.random().toString(36).substring(2, 9)}`
    }
});

// Test results storage
const testResults = {
    passed: [],
    failed: [],
    errors: []
};

/**
 * Mock Express request object
 */
function createMockRequest(bookingData) {
    return {
        body: bookingData,
        user: { id: 'test-user-id' },
        id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };
}

/**
 * Mock Express response object
 */
function createMockResponse() {
    const res = {
        statusCode: null,
        responseData: null,
        status: function (code) {
            this.statusCode = code;
            return this;
        },
        json: function (data) {
            this.responseData = data;
            return this;
        }
    };
    return res;
}

/**
 * Test validation middleware for a specific booking type
 */
async function testBookingTypeValidation(type) {
    console.log(`\n🧪 Testing validation middleware for booking type: ${type}`);

    try {
        const bookingData = createTestBookingData(type);
        const req = createMockRequest(bookingData);
        const res = createMockResponse();

        let nextCalled = false;
        const next = () => {
            nextCalled = true;
        };

        console.log(`   📋 Booking type: ${type}`);
        console.log(`   📤 Running validateBookingCreation middleware`);

        // Run the validation middleware
        validateBookingCreation(req, res, next);

        // Check the results
        if (nextCalled) {
            console.log(`   ✅ SUCCESS: ${type} validation passed`);
            console.log(`   📋 Validated data type: ${req.body.type}`);

            testResults.passed.push({
                type,
                message: 'Validation middleware passed',
                validatedType: req.body.type
            });
        } else if (res.statusCode) {
            console.log(`   ❌ FAILED: ${type} - Validation error (status: ${res.statusCode})`);
            console.log(`   📄 Error response:`, JSON.stringify(res.responseData, null, 2));

            // Check if it's a booking type validation error
            const errorMessage = res.responseData?.error?.message || '';
            const errorDetails = res.responseData?.error?.details || [];

            const isTypeValidationError = errorDetails.some(detail =>
                detail.field === 'type' || detail.field.includes('type')
            ) || errorMessage.toLowerCase().includes('booking type') ||
                errorMessage.toLowerCase().includes('accommodation');

            testResults.failed.push({
                type,
                status: res.statusCode,
                message: 'Validation middleware failed',
                isTypeError: isTypeValidationError,
                error: res.responseData,
                errors: errorDetails
            });
        } else {
            console.log(`   ❓ UNKNOWN: ${type} - Middleware didn't call next() or set response`);
            testResults.errors.push({
                type,
                message: 'Middleware behavior unclear - no next() call or response set'
            });
        }

    } catch (error) {
        console.log(`   💥 ERROR: ${type} - Middleware test failed`);
        console.log(`   📄 Error:`, error.message);

        testResults.errors.push({
            type,
            message: error.message,
            stack: error.stack
        });
    }
}

/**
 * Test invalid booking type
 */
async function testInvalidBookingTypeValidation() {
    console.log(`\n🧪 Testing validation middleware for invalid booking type: invalid_type`);

    try {
        const bookingData = createTestBookingData('invalid_type');
        const req = createMockRequest(bookingData);
        const res = createMockResponse();

        let nextCalled = false;
        const next = () => {
            nextCalled = true;
        };

        // Run the validation middleware
        validateBookingCreation(req, res, next);

        if (!nextCalled && res.statusCode === 400) {
            console.log(`   ✅ SUCCESS: Invalid type correctly rejected (status: 400)`);
            console.log(`   📄 Error message:`, res.responseData?.error?.message);

            // Check if the error message mentions booking types
            const errorMessage = res.responseData?.error?.message || '';
            const errorDetails = res.responseData?.error?.details || [];

            const hasTypeError = errorDetails.some(detail =>
                detail.field === 'type' || detail.field.includes('type')
            ) || errorMessage.toLowerCase().includes('accommodation');

            if (hasTypeError) {
                console.log(`   📋 Booking type validation working correctly`);
            }
        } else if (nextCalled) {
            console.log(`   ❌ FAILED: Invalid type not rejected - middleware called next()`);
        } else {
            console.log(`   ❓ UNKNOWN: Unexpected middleware behavior`);
            console.log(`   📄 Response:`, JSON.stringify(res.responseData, null, 2));
        }

    } catch (error) {
        console.log(`   💥 ERROR: Middleware test failed - ${error.message}`);
    }
}

/**
 * Print test summary
 */
function printTestSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION MIDDLEWARE TEST SUMMARY');
    console.log('='.repeat(60));

    console.log(`\n✅ PASSED TESTS: ${testResults.passed.length}`);
    testResults.passed.forEach(result => {
        console.log(`   • ${result.type}: ${result.message}`);
    });

    console.log(`\n❌ FAILED TESTS: ${testResults.failed.length}`);
    testResults.failed.forEach(result => {
        console.log(`   • ${result.type}: ${result.message} (${result.status})`);
        if (result.isTypeError) {
            console.log(`     → This is a booking type validation error ⚠️`);
        }
        if (result.errors && result.errors.length > 0) {
            result.errors.forEach(err => {
                console.log(`     → ${err.field}: ${err.message}`);
            });
        }
    });

    console.log(`\n💥 ERROR TESTS: ${testResults.errors.length}`);
    testResults.errors.forEach(result => {
        console.log(`   • ${result.type}: ${result.message}`);
    });

    // Analysis
    console.log('\n📈 ANALYSIS:');

    const totalTests = ENABLED_BOOKING_TYPES.length;
    const successfulTests = testResults.passed.length;
    const typeValidationFailures = testResults.failed.filter(r => r.isTypeError).length;
    const otherValidationFailures = testResults.failed.filter(r => !r.isTypeError).length;

    console.log(`   • Total booking types tested: ${totalTests}`);
    console.log(`   • Successful validations: ${successfulTests} (${Math.round(successfulTests / totalTests * 100)}%)`);
    console.log(`   • Type validation failures: ${typeValidationFailures}`);
    console.log(`   • Other validation failures: ${otherValidationFailures}`);

    if (testResults.errors.length > 0) {
        console.log(`   • Middleware loading errors: ${testResults.errors.length}`);
        console.log(`   ⚠️  Check if the backend is built correctly`);
    }

    // Determine overall status
    if (successfulTests === totalTests && typeValidationFailures === 0) {
        console.log('\n🎉 BOOKING TYPE VALIDATION IS WORKING CORRECTLY!');
        console.log('   • All enabled booking types pass validation middleware');
        console.log('   • No booking types are being rejected due to type validation');
        console.log('   • The validation middleware correctly accepts all enabled accommodation types');
    } else if (typeValidationFailures > 0) {
        console.log('\n⚠️  BOOKING TYPE VALIDATION ISSUES DETECTED!');
        console.log('   • Some enabled booking types are being rejected by validation middleware');
        console.log('   • This indicates a mismatch between frontend options and backend validation');
    } else if (otherValidationFailures > 0) {
        console.log('\n⚠️  OTHER VALIDATION ISSUES DETECTED');
        console.log('   • Booking types are accepted but other validation errors exist');
        console.log('   • This might be due to missing or incorrect field formats');
    }
}

/**
 * Main test execution
 */
async function runTests() {
    console.log('🚀 Starting Direct Validation Middleware Tests');
    console.log(`📋 Testing ${ENABLED_BOOKING_TYPES.length} booking types: ${ENABLED_BOOKING_TYPES.join(', ')}`);
    console.log(`🔍 This test directly calls the validation middleware functions`);

    // Test each enabled booking type
    for (const type of ENABLED_BOOKING_TYPES) {
        await testBookingTypeValidation(type);
    }

    // Test invalid booking type
    await testInvalidBookingTypeValidation();

    // Print summary
    printTestSummary();
}

// Run tests
runTests().catch(error => {
    console.error('💥 Test execution failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
});