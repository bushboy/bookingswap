/**
 * Unit test for booking validation middleware
 * Tests the validation logic without requiring a running server
 */

import { createBookingSchema, ENABLED_BOOKING_TYPES } from './packages/shared/dist/index.js';

// Test data template
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
        checkIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        checkOut: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000)  // 35 days from now
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
 * Test validation for a specific booking type
 */
function testBookingTypeValidation(type) {
    console.log(`\n🧪 Testing validation for booking type: ${type}`);

    try {
        const bookingData = createTestBookingData(type);

        console.log(`   📤 Validating data:`, {
            type: bookingData.type,
            title: bookingData.title,
            location: bookingData.location.city + ', ' + bookingData.location.country
        });

        // Validate using the create booking schema (used by API endpoint)
        const { error, value } = createBookingSchema.validate(bookingData, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            console.log(`   ❌ VALIDATION FAILED: ${type}`);
            console.log(`   📝 Validation errors:`);

            error.details.forEach((detail, index) => {
                console.log(`      ${index + 1}. Field: ${detail.path.join('.')}`);
                console.log(`         Message: ${detail.message}`);
                console.log(`         Value: ${detail.context?.value}`);
            });

            testResults.failed.push({
                type,
                errors: error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                    value: detail.context?.value
                }))
            });
        } else {
            console.log(`   ✅ VALIDATION PASSED: ${type}`);
            console.log(`   📋 Validated type: ${value.type}`);
            console.log(`   📅 Date range: ${value.dateRange.checkIn.toISOString().split('T')[0]} to ${value.dateRange.checkOut.toISOString().split('T')[0]}`);

            testResults.passed.push({
                type,
                validatedData: {
                    type: value.type,
                    title: value.title,
                    dateRange: value.dateRange
                }
            });
        }

    } catch (error) {
        console.log(`   ❌ ERROR: Exception during validation for ${type}`);
        console.log(`   🔍 Error:`, error.message);

        testResults.errors.push({
            type,
            error: error.message
        });
    }
}

/**
 * Test validation for invalid booking type
 */
function testInvalidBookingTypeValidation() {
    console.log(`\n🧪 Testing validation for invalid booking type: invalid_type`);

    try {
        const bookingData = createTestBookingData('invalid_type');

        const { error, value } = createBookingSchema.validate(bookingData, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            console.log(`   ✅ VALIDATION CORRECTLY REJECTED: invalid_type`);
            console.log(`   📝 Validation errors:`);

            error.details.forEach((detail, index) => {
                console.log(`      ${index + 1}. Field: ${detail.path.join('.')}`);
                console.log(`         Message: ${detail.message}`);
                console.log(`         Value: ${detail.context?.value}`);
            });

            testResults.passed.push({
                type: 'invalid_type',
                validationWorking: true,
                errors: error.details
            });
        } else {
            console.log(`   ❌ VALIDATION INCORRECTLY ACCEPTED: invalid_type`);
            console.log(`   📋 Accepted value:`, value);

            testResults.failed.push({
                type: 'invalid_type',
                error: 'Invalid type was incorrectly accepted by validation',
                acceptedValue: value
            });
        }

    } catch (error) {
        console.log(`   ❌ ERROR: Exception during validation for invalid_type`);
        console.log(`   🔍 Error:`, error.message);

        testResults.errors.push({
            type: 'invalid_type',
            error: error.message
        });
    }
}

/**
 * Print comprehensive test results
 */
function printTestResults() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 BOOKING VALIDATION MIDDLEWARE TEST RESULTS');
    console.log('='.repeat(80));

    console.log(`\n✅ PASSED TESTS: ${testResults.passed.length}`);
    testResults.passed.forEach(result => {
        if (result.validationWorking) {
            console.log(`   🔒 ${result.type}: Validation correctly rejected invalid type`);
        } else {
            console.log(`   📝 ${result.type}: Validation passed successfully`);
        }
    });

    console.log(`\n❌ FAILED TESTS: ${testResults.failed.length}`);
    testResults.failed.forEach(result => {
        console.log(`   💥 ${result.type}: ${result.error || 'Validation failed'}`);
        if (result.errors && result.errors.length > 0) {
            result.errors.forEach(err => {
                console.log(`      - ${err.field}: ${err.message}`);
            });
        }
    });

    console.log(`\n🔌 ERROR TESTS: ${testResults.errors.length}`);
    testResults.errors.forEach(result => {
        console.log(`   ⚠️  ${result.type}: ${result.error}`);
    });

    // Summary
    const totalTests = testResults.passed.length + testResults.failed.length + testResults.errors.length;
    const successRate = totalTests > 0 ? ((testResults.passed.length / totalTests) * 100).toFixed(1) : 0;

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Expected: All 5 accommodation types should pass validation, invalid type should fail`);

    // Configuration check
    console.log(`\n🔧 CONFIGURATION CHECK:`);
    console.log(`   Enabled booking types: ${ENABLED_BOOKING_TYPES.join(', ')}`);
    console.log(`   Total enabled types: ${ENABLED_BOOKING_TYPES.length}`);

    // Recommendations
    if (testResults.failed.length > 0) {
        console.log(`\n🔧 RECOMMENDATIONS:`);
        console.log(`   1. Check validation schema in packages/shared/src/validation/booking.ts`);
        console.log(`   2. Verify centralized configuration in packages/shared/src/config/booking-types.ts`);
        console.log(`   3. Ensure getBookingTypeValidationValues() returns correct types`);
        console.log(`   4. Check if validation message is properly configured`);
    }
}

/**
 * Main test execution
 */
function runValidationMiddlewareTest() {
    console.log('🚀 Starting Booking Validation Middleware Unit Test');
    console.log(`📅 Test Date: ${new Date().toISOString()}`);
    console.log(`🔧 Testing validation schema directly`);

    // Test all enabled booking types
    console.log(`\n📋 Testing ${ENABLED_BOOKING_TYPES.length} enabled booking types:`);
    for (const type of ENABLED_BOOKING_TYPES) {
        testBookingTypeValidation(type);
    }

    // Test invalid booking type
    testInvalidBookingTypeValidation();

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
runValidationMiddlewareTest();