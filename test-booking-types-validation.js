#!/usr/bin/env node

/**
 * Test script to validate booking types API behavior
 * This script tests each booking type to see which ones are accepted by the API
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN; // You'll need to provide this

// Booking types to test
const BOOKING_TYPES = [
    'hotel',
    'vacation_rental',
    'resort',
    'hostel',
    'bnb',
    // Test invalid types too
    'flight',
    'event',
    'rental',
    'invalid_type'
];

// Test booking data template
const createTestBookingData = (type) => ({
    type: type,
    title: `Test ${type} Booking`,
    description: `This is a test booking for type: ${type}`,
    location: {
        city: 'New York',
        country: 'USA'
    },
    dateRange: {
        checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days from now
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
        provider: 'Test Provider',
        confirmationNumber: `TEST-${type.toUpperCase()}-123`,
        bookingReference: `REF-${type.toUpperCase()}-456`
    }
});

// Test results storage
const testResults = [];

async function testBookingType(type) {
    console.log(`\n🧪 Testing booking type: ${type}`);

    try {
        const bookingData = createTestBookingData(type);

        const response = await axios.post(`${API_BASE_URL}/bookings`, bookingData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': TEST_USER_TOKEN ? `Bearer ${TEST_USER_TOKEN}` : undefined
            },
            timeout: 10000
        });

        console.log(`✅ SUCCESS: ${type} - Status: ${response.status}`);
        testResults.push({
            type,
            success: true,
            status: response.status,
            data: response.data,
            error: null
        });

        // Clean up - delete the test booking if it was created
        if (response.data?.data?.booking?.id) {
            try {
                await axios.delete(`${API_BASE_URL}/bookings/${response.data.data.booking.id}`, {
                    headers: {
                        'Authorization': TEST_USER_TOKEN ? `Bearer ${TEST_USER_TOKEN}` : undefined
                    }
                });
                console.log(`🗑️  Cleaned up test booking: ${response.data.data.booking.id}`);
            } catch (deleteError) {
                console.log(`⚠️  Could not clean up test booking: ${deleteError.message}`);
            }
        }

    } catch (error) {
        const status = error.response?.status;
        const errorData = error.response?.data;

        console.log(`❌ FAILED: ${type} - Status: ${status}`);
        console.log(`   Error: ${errorData?.error?.message || error.message}`);

        testResults.push({
            type,
            success: false,
            status,
            data: errorData,
            error: error.message
        });
    }
}

async function runAllTests() {
    console.log('🚀 Starting booking types validation test...');
    console.log(`📡 API Base URL: ${API_BASE_URL}`);
    console.log(`🔑 Using auth token: ${TEST_USER_TOKEN ? 'Yes' : 'No (testing without auth)'}`);

    // Test each booking type
    for (const type of BOOKING_TYPES) {
        await testBookingType(type);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Generate report
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('========================');

    const successful = testResults.filter(r => r.success);
    const failed = testResults.filter(r => !r.success);

    console.log(`✅ Successful: ${successful.length}`);
    successful.forEach(result => {
        console.log(`   - ${result.type}`);
    });

    console.log(`❌ Failed: ${failed.length}`);
    failed.forEach(result => {
        console.log(`   - ${result.type}: ${result.data?.error?.message || result.error}`);
    });

    // Detailed analysis
    console.log('\n🔍 DETAILED ANALYSIS');
    console.log('====================');

    const validTypes = ['hotel', 'vacation_rental', 'resort', 'hostel', 'bnb'];
    const invalidTypes = ['flight', 'event', 'rental', 'invalid_type'];

    const validTypeResults = testResults.filter(r => validTypes.includes(r.type));
    const invalidTypeResults = testResults.filter(r => invalidTypes.includes(r.type));

    console.log('\nValid accommodation types (should succeed):');
    validTypeResults.forEach(result => {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        console.log(`   ${result.type}: ${status}`);
        if (!result.success) {
            console.log(`      Error: ${result.data?.error?.message || result.error}`);
        }
    });

    console.log('\nInvalid/disabled types (should fail):');
    invalidTypeResults.forEach(result => {
        const status = !result.success ? '✅ CORRECTLY REJECTED' : '❌ INCORRECTLY ACCEPTED';
        console.log(`   ${result.type}: ${status}`);
        if (result.success) {
            console.log(`      Warning: This type should have been rejected!`);
        }
    });

    // Check for the specific issue mentioned
    const hotelResult = testResults.find(r => r.type === 'hotel');
    const otherValidResults = testResults.filter(r => validTypes.includes(r.type) && r.type !== 'hotel');

    console.log('\n🎯 ISSUE ANALYSIS');
    console.log('=================');

    if (hotelResult?.success && otherValidResults.some(r => !r.success)) {
        console.log('❗ CONFIRMED: Only hotel bookings are accepted, other accommodation types are rejected');
        console.log('   This matches the reported issue.');
    } else if (validTypeResults.every(r => r.success)) {
        console.log('✅ All accommodation types are accepted - issue may be resolved or environment-specific');
    } else if (validTypeResults.every(r => !r.success)) {
        console.log('❌ No booking types are accepted - possible authentication or API issue');
    } else {
        console.log('🤔 Mixed results - issue may be intermittent or configuration-dependent');
    }

    // Save detailed results to file
    const fs = require('fs');
    const reportData = {
        timestamp: new Date().toISOString(),
        apiBaseUrl: API_BASE_URL,
        hasAuthToken: !!TEST_USER_TOKEN,
        results: testResults,
        summary: {
            total: testResults.length,
            successful: successful.length,
            failed: failed.length,
            validTypesAccepted: validTypeResults.filter(r => r.success).length,
            validTypesTotal: validTypeResults.length,
            invalidTypesRejected: invalidTypeResults.filter(r => !r.success).length,
            invalidTypesTotal: invalidTypeResults.length
        }
    };

    fs.writeFileSync('booking-types-test-report.json', JSON.stringify(reportData, null, 2));
    console.log('\n💾 Detailed report saved to: booking-types-test-report.json');
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Usage: node test-booking-types-validation.js [options]

Environment Variables:
  API_BASE_URL      Base URL for the API (default: http://localhost:3001/api)
  TEST_USER_TOKEN   JWT token for authentication (optional)

Options:
  --help, -h        Show this help message

Examples:
  node test-booking-types-validation.js
  API_BASE_URL=https://api.example.com/api node test-booking-types-validation.js
  TEST_USER_TOKEN=your-jwt-token node test-booking-types-validation.js
`);
    process.exit(0);
}

// Run the tests
runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
});