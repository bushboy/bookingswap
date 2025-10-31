import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SwapTimeline } from '../SwapTimeline';
import { SwapWithBookings, SwapEvent } from '../../../services/swapService';

// Mock data
const mockSwap: SwapWithBookings = {
  id: 'swap-1',
  sourceBookingId: 'booking-1',
  targetBookingId: 'booking-2',
  proposerId: 'user-1',
  ownerId: 'user-2',
  status: 'pending',
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
    type: 'hotel',
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
    verification: { status: 'verified', documents: [] },
    blockchain: {
      transactionId: 'tx123',
      consensusTimestamp: '123',
      topicId: 'topic123',
    },
    status: 'available',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  targetBooking: {
    id: 'booking-2',
    userId: 'user-2',
    type: 'event',
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
    verification: { status: 'verified', documents: [] },
    blockchain: {
      transactionId: 'tx456',
      consensusTimestamp: '456',
      topicId: 'topic456',
    },
    status: 'available',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  proposer: {
    id: 'user-1',
    walletAddress: '0x123',
    profile: { displayName: 'John Doe', bio: 'Test', avatar: 'avatar1.jpg' },
    verification: { level: 'verified', verifiedAt: new Date() },
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
    verification: { level: 'verified', verifiedAt: new Date() },
    preferences: {
      notifications: { email: true, push: true, sms: false },
      privacy: { showProfile: true, showBookings: true },
    },
    swapCriteria: { maxAdditionalPayment: 200, preferredLocations: ['London'] },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  createdAt: new Date('2024-05-15'),
  updatedAt: new Date('2024-05-16'),
};

const mockEvents: SwapEvent[] = [
  {
    id: 'event-1',
    swapId: 'swap-1',
    type: 'created',
    userId: 'user-1',
    data: {},
    timestamp: new Date('2024-05-15T10:00:00Z'),
  },
  {
    id: 'event-2',
    swapId: 'swap-1',
    type: 'proposed',
    userId: 'user-2',
    data: { message: 'Counter-proposal with additional terms' },
    timestamp: new Date('2024-05-15T14:30:00Z'),
  },
  {
    id: 'event-3',
    swapId: 'swap-1',
    type: 'accepted',
    userId: 'user-1',
    data: {},
    timestamp: new Date('2024-05-16T09:15:00Z'),
  },
];

describe('SwapTimeline', () => {
  beforeEach(() => {
    // Mock Date.now to have consistent timestamps in tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-16T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders timeline with events', () => {
    render(<SwapTimeline swap={mockSwap} events={mockEvents} />);

    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('3 events')).toBeInTheDocument();
  });

  it('displays events in chronological order (newest first)', () => {
    render(<SwapTimeline swap={mockSwap} events={mockEvents} />);

    const eventTitles = screen.getAllByText(/^(created|proposed|accepted)$/i);
    expect(eventTitles[0]).toHaveTextContent('accepted');
    expect(eventTitles[1]).toHaveTextContent('proposed');
    expect(eventTitles[2]).toHaveTextContent('created');
  });

  it('shows event descriptions', () => {
    render(<SwapTimeline swap={mockSwap} events={mockEvents} />);

    expect(screen.getByText('Swap proposal was created')).toBeInTheDocument();
    expect(
      screen.getByText('Counter-proposal was submitted')
    ).toBeInTheDocument();
    expect(screen.getByText('Swap proposal was accepted')).toBeInTheDocument();
  });

  it('displays relative timestamps', () => {
    render(<SwapTimeline swap={mockSwap} events={mockEvents} />);

    // The accepted event is from 09:15, current time is 12:00, so ~2-3 hours ago
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('shows current status', () => {
    render(<SwapTimeline swap={mockSwap} events={mockEvents} />);

    expect(screen.getByText('Current Status')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('displays additional event data', () => {
    render(<SwapTimeline swap={mockSwap} events={mockEvents} />);

    expect(
      screen.getByText('Counter-proposal with additional terms')
    ).toBeInTheDocument();
  });

  it('shows latest update indicator', () => {
    render(<SwapTimeline swap={mockSwap} events={mockEvents} />);

    expect(screen.getByText('Latest update')).toBeInTheDocument();
  });

  it('handles empty events list', () => {
    render(<SwapTimeline swap={mockSwap} events={[]} />);

    expect(screen.getByText('No events yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Timeline events will appear here as the swap progresses'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('0 events')).toBeInTheDocument();
  });

  it('displays rejected event with reason', () => {
    const rejectedEvent: SwapEvent = {
      id: 'event-4',
      swapId: 'swap-1',
      type: 'rejected',
      userId: 'user-2',
      data: { reason: 'Dates do not work for me' },
      timestamp: new Date('2024-05-16T11:00:00Z'),
    };

    render(<SwapTimeline swap={mockSwap} events={[rejectedEvent]} />);

    expect(
      screen.getByText('Swap proposal was rejected: Dates do not work for me')
    ).toBeInTheDocument();
  });

  it('formats timestamps correctly for different time periods', () => {
    const recentEvents: SwapEvent[] = [
      {
        id: 'event-recent',
        swapId: 'swap-1',
        type: 'created',
        userId: 'user-1',
        data: {},
        timestamp: new Date('2024-05-16T11:59:00Z'), // 1 minute ago
      },
      {
        id: 'event-old',
        swapId: 'swap-1',
        type: 'proposed',
        userId: 'user-2',
        data: {},
        timestamp: new Date('2024-05-10T12:00:00Z'), // 6 days ago
      },
    ];

    render(<SwapTimeline swap={mockSwap} events={recentEvents} />);

    expect(screen.getByText('1m ago')).toBeInTheDocument();
    expect(screen.getByText('6d ago')).toBeInTheDocument();
  });

  it('shows completed event correctly', () => {
    const completedEvent: SwapEvent = {
      id: 'event-completed',
      swapId: 'swap-1',
      type: 'completed',
      userId: 'system',
      data: { transactionId: 'tx123456' },
      timestamp: new Date('2024-05-16T11:30:00Z'),
    };

    render(<SwapTimeline swap={mockSwap} events={[completedEvent]} />);

    expect(
      screen.getByText('Swap was completed successfully')
    ).toBeInTheDocument();
    expect(screen.getByText('tx123456')).toBeInTheDocument();
  });

  it('shows cancelled event correctly', () => {
    const cancelledEvent: SwapEvent = {
      id: 'event-cancelled',
      swapId: 'swap-1',
      type: 'cancelled',
      userId: 'user-1',
      data: {},
      timestamp: new Date('2024-05-16T11:30:00Z'),
    };

    render(<SwapTimeline swap={mockSwap} events={[cancelledEvent]} />);

    expect(screen.getByText('Swap was cancelled')).toBeInTheDocument();
  });
});
