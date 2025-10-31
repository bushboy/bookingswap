#!/usr/bin/env node

/**
 * Test script to verify booking API validation behavior
 * Tests all enabled booking types to identify validation issues
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || 'test-token';

// Test booking types from centralized config
const ENABLED_BOOKING_TYPES = [
    'hotel',
    'vacation_rental',
    'resort',
    'hostel',
    'bnb'
];

// Test data template
const createTestBookingData = (type) => ({
    type: type,
    title: `Test ${type} booking`,
    description: `A test booking for ${type} validation`,
    location: {
        city: 'New York',
        country: 'USA',
        coordinates: [40.7128, -74.0060]
    },
    dateRange: {
        checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days from now
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
        provider: 'test-provider',
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
            console.log(`   ✅ ${type}: SUCCESS - Booking created successfully`);
            console.log(`   📝 Booking ID: ${response.data.data.booking?.id}`);
            testResults.passed.push({
                type,
                status: 'success',
                bookingId: response.data.data.booking?.id,
                response: response.data
            });
        } else {
            console.log(`   ⚠️  ${type}: UNEXPECTED RESPONSE - Status ${response.status}`);
            console.log(`   📄 Response:`, JSON.stringify(response.data, null, 2));
            testResults.failed.push({
                type,
                status: 'unexpected_response',
                httpStatus: response.status,
                response: response.data
            });
        }

    } catch (error) {
        if (error.response) {
            // API returned an error response
            const status = error.response.status;
            const errorData = error.response.data;

            console.log(`   ❌ ${type}: FAILED - HTTP ${status}`);
            console.log(`   📄 Error:`, JSON.stringify(errorData, null, 2));

            testResults.failed.push({
                type,
                status: 'api_error',
                httpStatus: status,
                error: errorData
            });
        } else if (error.code === 'ECONNREFUSED') {
            console.log(`   🔌 ${type}: CONNECTION REFUSED - API server not running`);
            testResults.errors.push({
                type,
                status: 'connection_refused',
                error: 'API server not running or not accessible'
            });
        } else {
            console.log(`   💥 ${type}: NETWORK ERROR - ${error.message}`);
            testResults.errors.push({
                type,
                status: 'network_error',
                error: error.message
            });
        }
    }
}

/**
 * Test API health check
 */
async function testApiHealth() {
    console.log('🏥 Testing API health...');

    try {
        const response = await axios.get(`${API_BASE_URL}/api/bookings`, {
            timeout: 5000
        });

        console.log('   ✅ API is accessible');
        return true;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('   🔌 API server not running');
            console.log('   💡 Start the backend server with: npm run dev');
        } else {
            console.log(`   ❌ API health check failed: ${error.message}`);
        }
        return false;
    }
}

/**
 * Generate test report
 */
function generateReport() {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('========================');

    console.log(`\n✅ PASSED (${testResults.passed.length}):`);
    testResults.passed.forEach(result => {
        console.log(`   - ${result.type}: Booking created successfully`);
    });

    console.log(`\n❌ FAILED (${testResults.failed.length}):`);
    testResults.failed.forEach(result => {
        console.log(`   - ${result.type}: ${result.status} (HTTP ${result.httpStatus})`);
        if (result.error?.error?.message) {
            console.log(`     Error: ${result.error.error.message}`);
        }
    });

    console.log(`\n💥 ERRORS (${testResults.errors.length}):`);
    testResults.errors.forEach(result => {
        console.log(`   - ${result.type}: ${result.status}`);
        console.log(`     Error: ${result.error}`);
    });

    // Analysis
    console.log('\n🔍 ANALYSIS:');
    if (testResults.passed.length === ENABLED_BOOKING_TYPES.length) {
        console.log('   ✅ All booking types are working correctly');
    } else if (testResults.failed.length > 0) {
        console.log('   ⚠️  Some booking types are being rejected by the API');
        console.log('   🔧 This indicates a validation mismatch between frontend and backend');
    }

    if (testResults.errors.length > 0) {
        console.log('   🔌 Connection or network issues detected');
        console.log('   💡 Ensure the backend server is running and accessible');
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (testResults.failed.length > 0) {
        console.log('   1. Check API endpoint validation logic');
        console.log('   2. Verify booking validation schemas are using centralized config');
        console.log('   3. Ensure middleware is not blocking valid booking types');
    }

    if (testResults.errors.length > 0) {
        console.log('   1. Start the backend server: npm run dev');
        console.log('   2. Check API_BASE_URL configuration');
        console.log('   3. Verify authentication token if required');
    }
}

/**
 * Main test execution
 */
async function runTests() {
    console.log('🚀 Starting Booking API Validation Tests');
    console.log('=========================================');
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Testing booking types: ${ENABLED_BOOKING_TYPES.join(', ')}`);

    // Test API health first
    const isHealthy = await testApiHealth();
    if (!isHealthy) {
        console.log('\n⚠️  API health check failed. Continuing with tests anyway...');
    }

    // Test each booking type
    for (const type of ENABLED_BOOKING_TYPES) {
        await testBookingType(type);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Generate report
    generateReport();

    // Exit with appropriate code
    const hasFailures = testResults.failed.length > 0 || testResults.errors.length > 0;
    process.exit(hasFailures ? 1 : 0);
}

// Handle script execution
if (require.main === module) {
    runTests().catch(error => {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = {
    runTests,
    testBookingType,
    ENABLED_BOOKING_TYPES
};