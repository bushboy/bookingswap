import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SwapCard } from '../SwapCard';

// Simple mock data
const mockSwap = {
  id: 'swap-1',
  sourceBookingId: 'booking-1',
  targetBookingId: 'booking-2',
  proposerId: 'user-1',
  ownerId: 'user-2',
  status: 'pending' as const,
  terms: {
    additionalPayment: 50,
    conditions: ['Test condition'],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  blockchain: {
    proposalTransactionId: 'tx789',
  },
  timeline: {
    proposedAt: new Date('2024-05-15'),
  },
  sourceBooking: {
    id: 'booking-1',
    userId: 'user-1',
    type: 'hotel' as const,
    title: 'Test Hotel',
    description: 'Test description',
    location: { city: 'Paris', country: 'France' },
    dateRange: {
      checkIn: new Date('2024-06-01'),
      checkOut: new Date('2024-06-05'),
    },
    originalPrice: 800,
    swapValue: 750,
    providerDetails: {
      provider: 'Test',
      confirmationNumber: '123',
      bookingReference: 'REF',
    },
    verification: { status: 'verified' as const, documents: [] },
    blockchain: {
      transactionId: 'tx123',
      consensusTimestamp: '123',
      topicId: 'topic123',
    },
    status: 'available' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  targetBooking: {
    id: 'booking-2',
    userId: 'user-2',
    type: 'event' as const,
    title: 'Test Event',
    description: 'Test description',
    location: { city: 'London', country: 'UK' },
    dateRange: {
      checkIn: new Date('2024-06-10'),
      checkOut: new Date('2024-06-10'),
    },
    originalPrice: 600,
    swapValue: 700,
    providerDetails: {
      provider: 'Test',
      confirmationNumber: '456',
      bookingReference: 'REF2',
    },
    verification: { status: 'verified' as const, documents: [] },
    blockchain: {
      transactionId: 'tx456',
      consensusTimestamp: '456',
      topicId: 'topic456',
    },
    status: 'available' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  proposer: {
    id: 'user-1',
    walletAddress: '0x123',
    profile: { displayName: 'John Doe', bio: 'Test', avatar: 'avatar1.jpg' },
    verification: { level: 'verified' as const, verifiedAt: new Date() },
    preferences: {
      notifications: { email: true, push: true, sms: false },
      privacy: { showProfile: true, showBookings: true },
    },
    swapCriteria: { maxAdditionalPayment: 100, preferredLocations: ['Paris'] },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  owner: {
    id: 'user-2',
    walletAddress: '0x456',
    profile: { displayName: 'Jane Smith', bio: 'Test', avatar: 'avatar2.jpg' },
    verification: { level: 'verified' as const, verifiedAt: new Date() },
    preferences: {
      notifications: { email: true, push: true, sms: false },
      privacy: { showProfile: true, showBookings: true },
    },
    swapCriteria: { maxAdditionalPayment: 200, preferredLocations: ['London'] },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SwapCard Simple Test', () => {
  it('renders without crashing', () => {
    const { container } = render(<SwapCard swap={mockSwap} userRole="owner" />);

    expect(container).toBeTruthy();
  });
});
