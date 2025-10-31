#!/usr/bin/env node

/**
 * Direct validation schema testing
 * Tests the validation schemas directly without going through HTTP layer
 */

// Import the validation schemas
import { createBookingSchema } from './packages/shared/dist/validation/booking.js';

// All enabled booking types from centralized config
const ENABLED_BOOKING_TYPES = [
    'hotel',
    'vacation_rental',
    'resort',
    'hostel',
    'bnb'
];

// Test booking data template
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
        checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days from now
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
 * Test validation schema for a specific booking type
 */
function testBookingTypeValidation(type) {
    console.log(`\n🧪 Testing validation schema for booking type: ${type}`);

    try {
        const bookingData = createTestBookingData(type);

        console.log(`   📋 Booking type: ${type}`);
        console.log(`   📤 Validating against createBookingSchema`);

        // Validate using the schema
        const { error, value } = createBookingSchema.validate(bookingData, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            console.log(`   ❌ FAILED: ${type} - Validation error`);
            console.log(`   📄 Error details:`);

            error.details.forEach(detail => {
                console.log(`      • Field: ${detail.path.join('.')}`);
                console.log(`      • Message: ${detail.message}`);
                console.log(`      • Value: ${JSON.stringify(detail.context?.value)}`);
            });

            // Check if it's a booking type validation error
            const isTypeValidationError = error.details.some(detail =>
                detail.path.includes('type')
            );

            testResults.failed.push({
                type,
                message: 'Validation schema failed',
                isTypeError: isTypeValidationError,
                errors: error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                    value: detail.context?.value
                }))
            });
        } else {
            console.log(`   ✅ SUCCESS: ${type} validation passed`);
            console.log(`   📋 Validated data type: ${value.type}`);

            testResults.passed.push({
                type,
                message: 'Validation schema passed',
                validatedType: value.type
            });
        }

    } catch (error) {
        console.log(`   💥 ERROR: ${type} - Schema test failed`);
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
function testInvalidBookingTypeValidation() {
    console.log(`\n🧪 Testing validation schema for invalid booking type: invalid_type`);

    try {
        const bookingData = createTestBookingData('invalid_type');

        const { error, value } = createBookingSchema.validate(bookingData, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            console.log(`   ✅ SUCCESS: Invalid type correctly rejected`);
            console.log(`   📄 Error message:`, error.details[0]?.message);

            const typeError = error.details.find(detail => detail.path.includes('type'));
            if (typeError) {
                console.log(`   📋 Type validation message: ${typeError.message}`);
            }
        } else {
            console.log(`   ❌ FAILED: Invalid type not rejected`);
            console.log(`   📄 Validated data:`, JSON.stringify(value, null, 2));
        }

    } catch (error) {
        console.log(`   💥 ERROR: Schema test failed - ${error.message}`);
    }
}

/**
 * Print test summary
 */
function printTestSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SCHEMA TEST SUMMARY');
    console.log('='.repeat(60));

    console.log(`\n✅ PASSED TESTS: ${testResults.passed.length}`);
    testResults.passed.forEach(result => {
        console.log(`   • ${result.type}: ${result.message}`);
    });

    console.log(`\n❌ FAILED TESTS: ${testResults.failed.length}`);
    testResults.failed.forEach(result => {
        console.log(`   • ${result.type}: ${result.message}`);
        if (result.isTypeError) {
            console.log(`     → This is a booking type validation error`);
        }
        result.errors.forEach(err => {
            console.log(`     → ${err.field}: ${err.message}`);
        });
    });

    console.log(`\n💥 ERROR TESTS: ${testResults.errors.length}`);
    testResults.errors.forEach(result => {
        console.log(`   • ${result.type}: ${result.message}`);
    });

    // Analysis
    console.log('\n📈 ANALYSIS:');

    const totalTests = ENABLED_BOOKING_TYPES.length;
    const successfulTests = testResults.passed.length;
    const failedValidationTests = testResults.failed.length;
    const typeValidationFailures = testResults.failed.filter(r => r.isTypeError).length;

    console.log(`   • Total booking types tested: ${totalTests}`);
    console.log(`   • Successful validations: ${successfulTests} (${Math.round(successfulTests / totalTests * 100)}%)`);
    console.log(`   • Failed validations: ${failedValidationTests}`);
    console.log(`   • Type validation failures: ${typeValidationFailures}`);

    if (testResults.errors.length > 0) {
        console.log(`   • Schema loading errors: ${testResults.errors.length}`);
        console.log(`   ⚠️  Check if the shared package is built correctly`);
    }

    if (failedValidationTests === 0 && testResults.errors.length === 0) {
        console.log('\n🎉 ALL VALIDATION SCHEMAS PASSED!');
        console.log('   The validation schemas correctly accept all enabled booking types.');
    } else if (typeValidationFailures > 0) {
        console.log('\n⚠️  BOOKING TYPE VALIDATION ISSUES DETECTED!');
        console.log('   Some booking types are being rejected by the validation schemas.');
    }
}

/**
 * Main test execution
 */
async function runTests() {
    console.log('🚀 Starting Direct Validation Schema Tests');
    console.log(`📋 Testing ${ENABLED_BOOKING_TYPES.length} booking types: ${ENABLED_BOOKING_TYPES.join(', ')}`);

    // Test each enabled booking type
    for (const type of ENABLED_BOOKING_TYPES) {
        testBookingTypeValidation(type);
    }

    // Test invalid booking type
    testInvalidBookingTypeValidation();

    // Print summary
    printTestSummary();
}

// Run tests
runTests().catch(error => {
    console.error('💥 Test execution failed:', error.message);
    process.exit(1);
});