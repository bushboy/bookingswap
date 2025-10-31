const { bookingSchema } = require('./packages/shared/src/validation/booking.ts');
const { unifiedBookingSchema } = require('./packages/shared/src/validation/unified-booking.ts');

// Test booking schema with enabled types
console.log('Testing booking schema with enabled types:');
const enabledTypes = ['hotel', 'vacation_rental', 'resort', 'hostel', 'bnb'];
enabledTypes.forEach(type => {
    const testBooking = {
        id: 'test-123',
        userId: 'user-123',
        type: type,
        title: 'Test Booking',
        description: 'Test description',
        location: { city: 'Test City', country: 'Test Country' },
        dateRange: {
            checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
        },
        originalPrice: 100,
        swapValue: 90,
        providerDetails: {
            provider: 'Test Provider',
            confirmationNumber: 'TEST123',
            bookingReference: 'REF123'
        },
        verification: {
            status: 'pending',
            documents: ['doc1']
        },
        blockchain: {
            topicId: 'topic123'
        },
        status: 'available',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const { error } = bookingSchema.validate(testBooking);
    console.log(`${type}: ${error ? 'FAILED - ' + error.details[0].message : 'PASSED'}`);
});

// Test with disabled types
console.log('\nTesting booking schema with disabled types:');
const disabledTypes = ['event', 'flight', 'rental'];
disabledTypes.forEach(type => {
    const testBooking = {
        id: 'test-123',
        userId: 'user-123',
        type: type,
        title: 'Test Booking',
        description: 'Test description',
        location: { city: 'Test City', country: 'Test Country' },
        dateRange: {
            checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
        },
        originalPrice: 100,
        swapValue: 90,
        providerDetails: {
            provider: 'Test Provider',
            confirmationNumber: 'TEST123',
            bookingReference: 'REF123'
        },
        verification: {
            status: 'pending',
            documents: ['doc1']
        },
        blockchain: {
            topicId: 'topic123'
        },
        status: 'available',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const { error } = bookingSchema.validate(testBooking);
    console.log(`${type}: ${error ? 'FAILED - ' + error.details[0].message : 'PASSED'}`);
});