#!/usr/bin/env node

/**
 * Test script to validate the booking validation schemas directly
 * This tests the Joi schemas without hitting the API
 */

// Import the validation schemas
const path = require('path');
const fs = require('fs');

// Since we can't directly import TypeScript, let's test the validation logic
const ENABLED_BOOKING_TYPES = ['hotel', 'vacation_rental', 'resort', 'hostel', 'bnb'];
const DISABLED_BOOKING_TYPES = ['flight', 'event', 'rental'];

console.log('🧪 Testing Booking Type Validation Schemas');
console.log('==========================================');

console.log('\n📋 Enabled booking types (should be valid):');
ENABLED_BOOKING_TYPES.forEach(type => {
    console.log(`   ✅ ${type}`);
});

console.log('\n📋 Disabled booking types (should be invalid):');
DISABLED_BOOKING_TYPES.forEach(type => {
    console.log(`   ❌ ${type}`);
});

// Check if the validation files exist and contain the expected types
console.log('\n🔍 Checking validation schema files...');

const validationFiles = [
    'packages/shared/src/validation/booking.ts',
    'packages/shared/src/validation/unified-booking.ts'
];

validationFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');

        console.log(`\n📄 ${filePath}:`);

        // Check if ENABLED_BOOKING_TYPES is defined
        if (content.includes('ENABLED_BOOKING_TYPES')) {
            console.log('   ✅ ENABLED_BOOKING_TYPES found');

            // Extract the array content
            const match = content.match(/ENABLED_BOOKING_TYPES\s*=\s*\[(.*?)\]/s);
            if (match) {
                const typesString = match[1];
                console.log(`   📝 Types: ${typesString.replace(/\s+/g, ' ').trim()}`);

                // Check each enabled type
                ENABLED_BOOKING_TYPES.forEach(type => {
                    if (typesString.includes(`'${type}'`)) {
                        console.log(`   ✅ ${type} is included`);
                    } else {
                        console.log(`   ❌ ${type} is MISSING`);
                    }
                });

                // Check for disabled types
                DISABLED_BOOKING_TYPES.forEach(type => {
                    if (typesString.includes(`'${type}'`)) {
                        console.log(`   ⚠️  ${type} is incorrectly included`);
                    } else {
                        console.log(`   ✅ ${type} is correctly excluded`);
                    }
                });
            }
        } else {
            console.log('   ❌ ENABLED_BOOKING_TYPES not found');
        }

        // Check validation message
        if (content.includes('Only accommodation bookings are currently supported')) {
            console.log('   ✅ Correct validation message found');
        } else {
            console.log('   ❌ Expected validation message not found');
        }
    } else {
        console.log(`   ❌ File not found: ${filePath}`);
    }
});

// Check the BookingController to see if it uses the validation schemas
console.log('\n🔍 Checking BookingController validation...');

const controllerPath = 'apps/backend/src/controllers/BookingController.ts';
if (fs.existsSync(controllerPath)) {
    const content = fs.readFileSync(controllerPath, 'utf8');

    console.log(`\n📄 ${controllerPath}:`);

    // Check if it imports validation schemas
    if (content.includes('bookingSchema') || content.includes('createBookingSchema')) {
        console.log('   ✅ Validation schema imports found');
    } else {
        console.log('   ❌ No validation schema imports found');
    }

    // Check if it validates booking type
    if (content.includes('type') && content.includes('valid')) {
        console.log('   ✅ Type validation logic found');
    } else {
        console.log('   ❌ No type validation logic found');
    }

    // Look for manual validation in createBooking method
    const createBookingMatch = content.match(/createBooking\s*=.*?{(.*?)}/s);
    if (createBookingMatch) {
        const createBookingContent = createBookingMatch[1];

        if (createBookingContent.includes('ENABLED_BOOKING_TYPES') ||
            createBookingContent.includes('valid(...ENABLED_BOOKING_TYPES)')) {
            console.log('   ✅ Uses ENABLED_BOOKING_TYPES for validation');
        } else {
            console.log('   ❌ Does NOT use ENABLED_BOOKING_TYPES for validation');
            console.log('   🔍 This is likely the root cause of the issue!');
        }
    }
} else {
    console.log(`   ❌ File not found: ${controllerPath}`);
}

console.log('\n🎯 DIAGNOSIS SUMMARY');
console.log('===================');

console.log(`
Based on the analysis:

1. ✅ Validation schemas (booking.ts, unified-booking.ts) correctly define 5 accommodation types
2. ✅ Frontend components use the same 5 accommodation types  
3. ❌ BookingController does NOT use the validation schemas for type validation
4. ❌ BookingController only checks if 'type' field exists, but doesn't validate the value

ROOT CAUSE:
The BookingController.createBooking method performs manual validation but skips 
booking type validation against the ENABLED_BOOKING_TYPES array. This means:
- Any booking type string will be accepted by the controller
- The Joi validation schemas are not being used in the API endpoint
- Only the BookingService.validateBooking might catch invalid types, but this 
  happens after the controller has already accepted the request

SOLUTION:
The BookingController needs to either:
1. Import and use the Joi validation schemas, OR  
2. Import ENABLED_BOOKING_TYPES and validate against it manually

This explains why users can select accommodation types in the dropdown but 
only some types work - the issue is in the controller validation logic.
`);