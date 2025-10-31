// Enhanced test data specifically for user swaps display enhancement testing

export const enhancedSwapTestData = {
    completeSwap: {
        id: 'swap-complete-001',
        sourceBookingId: 'booking-hotel-001',
        targetBookingId: 'booking-event-002',
        status: 'pending',
        proposerId: 'user-alice-123',
        ownerId: 'user-bob-456',
        createdAt: '2024-01-15T10:00:00Z',
        terms: {
            conditions: ['Valid ID required', 'Non-refundable after acceptance'],
            expiresAt: '2024-12-31T23:59:59Z',
        },
        sourceBooking: {
            id: 'booking-hotel-001',
            title: 'Luxury Hotel Suite in Paris',
            location: {
                city: 'Paris',
                country: 'France',
            },
            dateRange: {
                checkIn: '2024-12-20T00:00:00Z',
                checkOut: '2024-12-25T00:00:00Z',
            },
            originalPrice: 1200,
            swapValue: 1000,
        },
        targetBooking: {
            id: 'booking-event-002',
            title: 'Concert Tickets - The Beatles Tribute',
            location: {
                city: 'London',
                country: 'UK',
            },
            dateRange: {
                checkIn: '2024-12-22T00:00:00Z',
                checkOut: '2024-12-22T00:00:00Z',
            },
            originalPrice: 800,
            swapValue: 900,
        },
    },

    auctionSwap: {
        id: 'swap-auction-001',
        sourceBookingId: 'booking-hotel-003',
        targetBookingId: null,
        status: 'pending',
        proposerId: 'user-alice-123',
        ownerId: 'user-alice-123',
        createdAt: '2024-01-16T14:30:00Z',
        acceptanceStrategy: {
            type: 'auction',
        },
        auctionId: 'auction-001',
        sourceBooking: {
            id: 'booking-hotel-003',
            title: 'Beach Resort Villa',
            location: {
                city: 'Miami',
                country: 'USA',
            },
            dateRange: {
                checkIn: '2024-07-01T00:00:00Z',
                checkOut: '2024-07-07T00:00:00Z',
            },
            originalPrice: 2500,
            swapValue: 2200,
        },
        targetBooking: null,
    },

    incompleteDataSwap: {
        id: 'swap-incomplete-001',
        sourceBookingId: 'booking-incomplete-001',
        targetBookingId: 'booking-incomplete-002',
        status: 'accepted',
        proposerId: 'user-alice-123',
        ownerId: 'user-bob-456',
        createdAt: '2024-01-10T09:15:00Z',
        acceptedAt: '2024-01-12T16:45:00Z',
        sourceBooking: {
            id: 'booking-incomplete-001',
            title: null, // Missing title
            location: {
                city: null, // Missing city
                country: 'Spain',
            },
            dateRange: {
                checkIn: '2024-08-15T00:00:00Z',
                checkOut: null, // Missing checkout date
            },
            originalPrice: null, // Missing price
            swapValue: 800,
        },
        targetBooking: {
            id: 'booking-incomplete-002',
            title: 'Mountain Cabin Retreat',
            location: {
                city: 'Aspen',
                country: null, // Missing country
            },
            dateRange: {
                checkIn: '2024-08-15T00:00:00Z',
                checkOut: '2024-08-20T00:00:00Z',
            },
            originalPrice: 1500,
            swapValue: 1400,
        },
    },

    edgeCaseSwap: {
        id: 'swap-edge-case-001',
        sourceBookingId: 'booking-edge-001',
        targetBookingId: 'booking-edge-002',
        status: 'pending',
        proposerId: 'user-alice-123',
        ownerId: 'user-bob-456',
        createdAt: '2024-01-15T10:00:00Z',
        sourceBooking: {
            id: 'booking-edge-001',
            title: 'Same Day Event',
            location: {
                city: 'New York',
                country: 'USA',
            },
            dateRange: {
                checkIn: '2024-12-31T00:00:00Z',
                checkOut: '2024-12-31T00:00:00Z', // Same day
            },
            originalPrice: 500,
            swapValue: 500,
        },
        targetBooking: {
            id: 'booking-edge-002',
            title: 'Long Stay Booking',
            location: {
                city: 'Tokyo',
                country: 'Japan',
            },
            dateRange: {
                checkIn: '2024-01-01T00:00:00Z',
                checkOut: '2024-12-31T00:00:00Z', // Year-long stay
            },
            originalPrice: 50000,
            swapValue: 45000,
        },
    },
};

export const formatTestHelpers = {
    formatLocation: (city: string | null, country: string | null): string => {
        if (!city && !country) return 'Unknown location';
        if (!city) return `Unknown, ${country}`;
        if (!country) return `${city}, Unknown`;
        return `${city}, ${country}`;
    },

    formatDateRange: (checkIn: string | null, checkOut: string | null): string => {
        if (!checkIn && !checkOut) return 'Unknown dates';
        if (!checkIn) return `Unknown - ${new Date(checkOut!).toLocaleDateString()}`;
        if (!checkOut) return `${new Date(checkIn).toLocaleDateString()} - Unknown dates`;

        const checkInDate = new Date(checkIn).toLocaleDateString();
        const checkOutDate = new Date(checkOut).toLocaleDateString();
        return `${checkInDate} - ${checkOutDate}`;
    },

    formatCurrency: (amount: number | null): string => {
        if (!amount) return 'Price unavailable';
        return amount.toLocaleString();
    },

    validateConsistentFormatting: {
        location: /📍 .+, .+/,
        dateRange: /📅 \d{1,2}\/\d{1,2}\/\d{4} - \d{1,2}\/\d{1,2}\/\d{4}/,
        currency: /💰 \d{1,3}(,\d{3})*/,
    },
};