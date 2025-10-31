import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineProposalForm } from '../InlineProposalForm';
import { BookingWithSwapInfo } from '@booking-swap/shared';

// Mock the auth context
const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

// Mock the booking service
const mockBookingService = {
  getAvailableBookings: jest.fn(),
};
jest.mock('@/services/bookingService', () => ({
  bookingService: mockBookingService,
}));

const mockBooking: BookingWithSwapInfo = {
  id: 'booking-1',
  title: 'Test Hotel Booking',
  description: 'A nice hotel in Paris',
  type: 'hotel',
  location: {
    city: 'Paris',
    country: 'France',
    address: '123 Test Street',
    coordinates: { lat: 48.8566, lng: 2.3522 },
  },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-05'),
  },
  originalPrice: 500,
  swapValue: 450,
  providerDetails: {
    provider: 'Test Hotel',
    confirmationNumber: 'ABC123',
    bookingReference: 'REF456',
  },
  status: 'available',
  verification: {
    status: 'verified',
    verifiedAt: new Date().toISOString(),
  },
  userId: 'user-2',
  createdAt: new Date().toISOString(),
  swapInfo: {
    swapId: 'swap-1',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 100,
    maxCashAmount: 600,
    hasActiveProposals: true,
    activeProposalCount: 2,
    swapConditions: [],
  },
};

describe('InlineProposalForm Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: 'mock-token',
      user: { id: 'user-1', name: 'Test User' },
      isAuthenticated: true,
    });
    mockBookingService.getAvailableBookings.mockResolvedValue([]);
  });

  it('should render and handle basic interactions', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();

    render(
      <InlineProposalForm
        booking={mockBooking}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    // Should render the form
    expect(screen.getByText('Make a Proposal')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Send Proposal')).toBeInTheDocument();

    // Should show proposal type selector
    await waitFor(() => {
      expect(screen.getByText('Proposal Type')).toBeInTheDocument();
    });

    // Cancel should work
    const user = userEvent.setup();
    await user.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('should handle cash proposal submission', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();
    const user = userEvent.setup();

    render(
      <InlineProposalForm
        booking={mockBooking}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByText('Proposal Type')).toBeInTheDocument();
    });

    // Switch to cash proposal
    await user.click(screen.getByLabelText('Make cash offer'));

    // Enter cash amount
    const cashInput = screen.getByLabelText('Cash Offer Amount');
    await user.clear(cashInput);
    await user.type(cashInput, '200');

    // Enter message
    const messageInput = screen.getByPlaceholderText('Add a message to your proposal (optional)');
    await user.type(messageInput, 'Interested in this booking!');

    // Submit
    await user.click(screen.getByText('Send Proposal'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        type: 'cash',
        cashAmount: 200,
        message: 'Interested in this booking!',
      });
    });
  });

  it('should validate cash amounts correctly', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    const user = userEvent.setup();

    render(
      <InlineProposalForm
        booking={mockBooking}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByText('Proposal Type')).toBeInTheDocument();
    });

    // Switch to cash proposal
    await user.click(screen.getByLabelText('Make cash offer'));

    // Enter amount below minimum
    const cashInput = screen.getByLabelText('Cash Offer Amount');
    await user.clear(cashInput);
    await user.type(cashInput, '50');

    // Should show validation error
    expect(screen.getByText('Amount must be at least $100')).toBeInTheDocument();

    // Submit button should be disabled
    const submitButton = screen.getByText('Send Proposal');
    expect(submitButton).toBeDisabled();
  });

  it('should show appropriate message when no bookings available', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();

    render(
      <InlineProposalForm
        booking={mockBooking}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    // Wait for bookings to load
    await waitFor(() => {
      expect(screen.getByText('No available bookings found')).toBeInTheDocument();
    });

    expect(screen.getByText('You need an available booking to propose a swap')).toBeInTheDocument();
  });
});