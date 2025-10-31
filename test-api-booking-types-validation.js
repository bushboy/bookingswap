/**
 * Comprehensive API validation test for all enabled booking types
 * Tests the booking creation endpoint with each of the 5 accommodation types
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || 'test-token';

// All enabled booking types from centralized configuration
const ENABLED_BOOKING_TYPES = [
    'hotel',
    'vacation_rental',
    'resort',
    'hostel',
    'bnb'
];

// Test booking data template
const createTestBookingData = (type) => ({
    type: type,
    title: `Test ${type.replace('_', ' ')} Booking`,
    description: `A test booking for ${type} accommodation type validation`,
    location: {
        city: 'Test City',
        country: 'Test Country',
        coordinates: [40.7128, -74.0060]
    },
    dateRange: {
        checkIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        checkOut: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString()  // 35 days from now
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
        provider: 'Test Provider',
        confirmationNumber: `TEST-${type.toUpperCase()}-${Date.now()}`,
        bookingReference: `REF-${type}-${Math.random().toString(36).substr(2, 9)}`
    }
});

// Test results storage
const testResults = {
    passed: [],
    failed: [],
    errors: []
};

/**
 * Test booking creation for a specific type
 */
async function testBookingType(type) {
    console.log(`\n🧪 Testing booking type: ${type}`);

    try {
        const bookingData = createTestBookingData(type);

        console.log(`   📤 Sending request with data:`, {
            type: bookingData.type,
            title: bookingData.title,
            location: bookingData.location,
            dateRange: bookingData.dateRange
        });

        const response = await axios.post(
            `${API_BASE_URL}/api/bookings`,
            bookingData,
            {
                headers: {
                    'Authorization': `Bearer ${TEST_USER_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        if (response.status === 201 && response.data.success) {
            console.log(`   ✅ SUCCESS: ${type} booking created successfully`);
            console.log(`   📋 Booking ID: ${response.data.data.booking?.id}`);
            console.log(`   🔗 Blockchain TX: ${response.data.data.blockchain?.transactionId}`);

            testResults.passed.push({
                type,
                status: response.status,
                bookingId: response.data.data.booking?.id,
                transactionId: response.data.data.blockchain?.transactionId
            });
        } else {
            console.log(`   ❌ FAILED: Unexpected response for ${type}`);
            console.log(`   📊 Status: ${response.status}`);
            console.log(`   📄 Response:`, response.data);

            testResults.failed.push({
                type,
                status: response.status,
                error: 'Unexpected response format',
                response: response.data
            });
        }

    } catch (error) {
        console.log(`   ❌ ERROR: Failed to create ${type} booking`);

        if (error.response) {
            console.log(`   📊 Status: ${error.response.status}`);
            console.log(`   📄 Error Response:`, error.response.data);

            // Check if it's a validation error
            if (error.response.status === 400 && error.response.data.error) {
                const errorData = error.response.data.error;
                console.log(`   🔍 Error Code: ${errorData.code}`);
                console.log(`   💬 Error Message: ${errorData.message}`);

                if (errorData.details) {
                    console.log(`   📝 Validation Details:`, errorData.details);
                }
            }

            testResults.failed.push({
                type,
                status: error.response.status,
                error: error.response.data.error || error.response.data,
                isValidationError: error.response.status === 400
            });
        } else {
            console.log(`   🔌 Network/Connection Error:`, error.message);

            testResults.errors.push({
                type,
                error: error.message,
                isNetworkError: true
            });
        }
    }
}

/**
 * Test invalid booking type to verify validation works
 */
async function testInvalidBookingType() {
    console.log(`\n🧪 Testing invalid booking type: invalid_type`);

    try {
        const bookingData = createTestBookingData('invalid_type');

        const response = await axios.post(
            `${API_BASE_URL}/api/bookings`,
            bookingData,
            {
                headers: {
                    'Authorization': `Bearer ${TEST_USER_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        console.log(`   ❌ UNEXPECTED: Invalid type was accepted`);
        console.log(`   📊 Status: ${response.status}`);
        console.log(`   📄 Response:`, response.data);

        testResults.failed.push({
            type: 'invalid_type',
            status: response.status,
            error: 'Invalid type was unexpectedly accepted',
            response: response.data
        });

    } catch (error) {
        if (error.response && error.response.status === 400) {
            console.log(`   ✅ SUCCESS: Invalid type correctly rejected`);
            console.log(`   📊 Status: ${error.response.status}`);
            console.log(`   💬 Error Message: ${error.response.data.error?.message}`);

            testResults.passed.push({
                type: 'invalid_type',
                status: error.response.status,
                validationWorking: true,
                error: error.response.data.error
            });
        } else {
            console.log(`   ❌ ERROR: Unexpected error for invalid type`);
            console.log(`   🔌 Error:`, error.message);

            testResults.errors.push({
                type: 'invalid_type',
                error: error.message,
                isNetworkError: !error.response
            });
        }
    }
}

/**
 * Print comprehensive test results
 */
function printTestResults() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 BOOKING TYPES VALIDATION TEST RESULTS');
    console.log('='.repeat(80));

    console.log(`\n✅ PASSED TESTS: ${testResults.passed.length}`);
    testResults.passed.forEach(result => {
        if (result.validationWorking) {
            console.log(`   🔒 ${result.type}: Validation correctly rejected invalid type`);
        } else {
            console.log(`   📝 ${result.type}: Successfully created (ID: ${result.bookingId})`);
        }
    });

    console.log(`\n❌ FAILED TESTS: ${testResults.failed.length}`);
    testResults.failed.forEach(result => {
        console.log(`   💥 ${result.type}: ${result.error?.message || result.error || 'Unknown error'}`);
        if (result.isValidationError) {
            console.log(`      🔍 This appears to be a validation error - check if type is properly configured`);
        }
    });

    console.log(`\n🔌 ERROR TESTS: ${testResults.errors.length}`);
    testResults.errors.forEach(result => {
        console.log(`   ⚠️  ${result.type}: ${result.error}`);
        if (result.isNetworkError) {
            console.log(`      🌐 Network/connection issue - check if API server is running`);
        }
    });

    // Summary
    const totalTests = testResults.passed.length + testResults.failed.length + testResults.errors.length;
    const successRate = totalTests > 0 ? ((testResults.passed.length / totalTests) * 100).toFixed(1) : 0;

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Expected: All 5 accommodation types should pass, invalid type should fail`);

    // Recommendations
    if (testResults.failed.length > 0) {
        console.log(`\n🔧 RECOMMENDATIONS:`);

        const validationFailures = testResults.failed.filter(r => r.isValidationError);
        if (validationFailures.length > 0) {
            console.log(`   1. Check validation schema in packages/shared/src/validation/booking.ts`);
            console.log(`   2. Verify centralized configuration in packages/shared/src/config/booking-types.ts`);
            console.log(`   3. Ensure middleware is properly importing and using the schemas`);
        }

        const serverErrors = testResults.failed.filter(r => !r.isValidationError);
        if (serverErrors.length > 0) {
            console.log(`   4. Check server logs for internal errors`);
            console.log(`   5. Verify database connectivity and booking service functionality`);
        }
    }

    if (testResults.errors.length > 0) {
        console.log(`\n🔧 CONNECTION ISSUES:`);
        console.log(`   1. Ensure API server is running on ${API_BASE_URL}`);
        console.log(`   2. Check authentication token is valid`);
        console.log(`   3. Verify network connectivity`);
    }
}

/**
 * Main test execution
 */
async function runBookingTypesValidationTest() {
    console.log('🚀 Starting Booking Types API Validation Test');
    console.log(`📡 API Base URL: ${API_BASE_URL}`);
    console.log(`🔑 Using Test Token: ${TEST_USER_TOKEN ? 'Yes' : 'No'}`);
    console.log(`📅 Test Date: ${new Date().toISOString()}`);

    // Test all enabled booking types
    for (const type of ENABLED_BOOKING_TYPES) {
        await testBookingType(type);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Test invalid booking type
    await testInvalidBookingType();

    // Print results
    printTestResults();

    // Exit with appropriate code
    const hasFailures = testResults.failed.length > 0 || testResults.errors.length > 0;
    process.exit(hasFailures ? 1 : 0);
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

// Run the test
if (require.main === module) {
    runBookingTypesValidationTest();
}

module.exports = {
    runBookingTypesValidationTest,
    testBookingType,
    testInvalidBookingType,
    ENABLED_BOOKING_TYPES
};