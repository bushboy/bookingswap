// Test data for E2E tests

export const testUsers = {
  alice: {
    id: 'user-alice-123',
    walletAddress: '0.0.123456',
    profile: {
      displayName: 'Alice Johnson',
      email: 'alice@example.com',
      preferences: {
        notifications: true,
      },
    },
    verification: {
      level: 'verified' as const,
      verifiedAt: new Date('2024-01-01'),
    },
    reputation: {
      score: 4.8,
      completedSwaps: 15,
      cancelledSwaps: 1,
      reviews: [],
    },
    createdAt: new Date('2023-06-01'),
    lastActiveAt: new Date(),
  },
  bob: {
    id: 'user-bob-456',
    walletAddress: '0.0.789012',
    profile: {
      displayName: 'Bob Smith',
      email: 'bob@example.com',
      preferences: {
        notifications: true,
      },
    },
    verification: {
      level: 'verified' as const,
      verifiedAt: new Date('2024-01-15'),
    },
    reputation: {
      score: 4.6,
      completedSwaps: 8,
      cancelledSwaps: 0,
      reviews: [],
    },
    createdAt: new Date('2023-08-15'),
    lastActiveAt: new Date(),
  },
} as const;

export const testBookings = {
  hotelBooking: {
    id: 'booking-hotel-001',
    userId: testUsers.alice.id,
    type: 'hotel' as const,
    title: 'Luxury Hotel Suite in Paris',
    description: 'Beautiful suite with Eiffel Tower view',
    location: {
      city: 'Paris',
      country: 'France',
      coordinates: [48.8566, 2.3522] as [number, number],
    },
    dateRange: {
      checkIn: new Date('2024-12-20'),
      checkOut: new Date('2024-12-25'),
    },
    originalPrice: 1200,
    swapValue: 1000,
    providerDetails: {
      provider: 'Booking.com',
      confirmationNumber: 'BK123456789',
      bookingReference: 'REF-PARIS-001',
    },
    verification: {
      status: 'verified' as const,
      verifiedAt: new Date('2024-01-10'),
      documents: ['ipfs-hash-1', 'ipfs-hash-2'],
    },
    blockchain: {
      transactionId: 'tx-001',
      consensusTimestamp: '1704067200.123456789',
      topicId: 'topic-001',
    },
    status: 'available' as const,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
  },
  eventBooking: {
    id: 'booking-event-002',
    userId: testUsers.bob.id,
    type: 'event' as const,
    title: 'Concert Tickets - The Beatles Tribute',
    description: '2 VIP tickets for Beatles tribute concert',
    location: {
      city: 'London',
      country: 'UK',
      coordinates: [51.5074, -0.1278] as [number, number],
    },
    dateRange: {
      checkIn: new Date('2024-12-22'),
      checkOut: new Date('2024-12-22'),
    },
    originalPrice: 800,
    swapValue: 900,
    providerDetails: {
      provider: 'Ticketmaster',
      confirmationNumber: 'TM987654321',
      bookingReference: 'REF-LONDON-002',
    },
    verification: {
      status: 'verified' as const,
      verifiedAt: new Date('2024-01-12'),
      documents: ['ipfs-hash-3'],
    },
    blockchain: {
      transactionId: 'tx-002',
      consensusTimestamp: '1704153600.987654321',
      topicId: 'topic-002',
    },
    status: 'available' as const,
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date('2024-01-12'),
  },
} as const;

export const testSwap = {
  id: 'swap-001',
  sourceBookingId: testBookings.eventBooking.id,
  targetBookingId: testBookings.hotelBooking.id,
  proposerId: testUsers.bob.id,
  ownerId: testUsers.alice.id,
  status: 'pending' as const,
  terms: {
    additionalPayment: 100,
    conditions: ['Non-refundable after acceptance', 'Valid ID required'],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  },
  blockchain: {
    proposalTransactionId: 'tx-proposal-001',
  },
  timeline: {
    proposedAt: new Date(),
  },
} as const;

export const mockHederaResponses = {
  submitTransaction: {
    transactionId: '0.0.123456@1704067200.123456789',
    consensusTimestamp: '1704067200.123456789',
    receipt: {
      status: 'SUCCESS',
      topicId: '0.0.654321',
    },
  },
  queryTransaction: {
    transactionId: '0.0.123456@1704067200.123456789',
    consensusTimestamp: '1704067200.123456789',
    receipt: {
      status: 'SUCCESS',
    },
    record: {
      transactionHash: 'hash123',
      transactionFee: '0.001',
    },
  },
};
