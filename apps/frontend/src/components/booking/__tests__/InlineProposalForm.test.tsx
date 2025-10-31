import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineProposalForm } from '../InlineProposalForm';
import { BookingWithSwapInfo, InlineProposalData, Booking } from '@booking-swap/shared';

// Mock dependencies
const mockBookingService = {
  getAvailableBookings: jest.fn(),
};

const mockUseAuth = jest.fn();

jest.mock('@/services/bookingService', () => ({
  bookingService: mockBookingService,
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

// Mock data
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

const mockUserBookings: Booking[] = [
  {
    id: 'user-booking-1',
    title: 'My Hotel in Rome',
    description: 'Great location',
    type: 'hotel',
    location: {
      city: 'Rome',
      country: 'Italy',
      address: '456 Rome Street',
      coordinates: { lat: 41.9028, lng: 12.4964 },
    },
    dateRange: {
      checkIn: new Date('2024-07-01'),
      checkOut: new Date('2024-07-05'),
    },
    originalPrice: 400,
    swapValue: 380,
    providerDetails: {
      provider: 'Rome Hotel',
      confirmationNumber: 'ROM123',
      bookingReference: 'ROMREF456',
    },
    status: 'available',
    verification: {
      status: 'verified',
      verifiedAt: new Date().toISOString(),
    },
    userId: 'user-1',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-booking-2',
    title: 'Barcelona Apartment',
    description: 'Modern apartment',
    type: 'rental',
    location: {
      city: 'Barcelona',
      country: 'Spain',
      address: '789 Barcelona Ave',
      coordinates: { lat: 41.3851, lng: 2.1734 },
    },
    dateRange: {
      checkIn: new Date('2024-08-01'),
      checkOut: new Date('2024-08-07'),
    },
    originalPrice: 300,
    swapValue: 280,
    providerDetails: {
      provider: 'Airbnb',
      confirmationNumber: 'BCN789',
      bookingReference: 'BCNREF123',
    },
    status: 'available',
    verification: {
      status: 'verified',
      verifiedAt: new Date().toISOString(),
    },
    userId: 'user-1',
    createdAt: new Date().toISOString(),
  },
];

const defaultProps = {
  booking: mockBooking,
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

describe('InlineProposalForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: 'mock-token',
      user: { id: 'user-1', name: 'Test User' },
      isAuthenticated: true,
      login: jest.fn(),
      logout: jest.fn(),
    });
    mockBookingService.getAvailableBookings.mockResolvedValue(mockUserBookings);
  });

  describe('Rendering', () => {
    it('should render the form with correct title', async () => {
      render(<InlineProposalForm {...defaultProps} />);
      
      expect(screen.getByText('Make a Proposal')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Send Proposal')).toBeInTheDocument();
    });

    it('should show proposal type selector when both payment types are available', async () => {
      render(<InlineProposalForm {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Proposal Type')).toBeInTheDocument();
        expect(screen.getByText('Swap with my booking')).toBeInTheDocument();
        expect(screen.getByText('Make cash offer')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching user bookings', () => {
      mockBookingService.getAvailableBookings.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockUserBookings), 1000))
      );
      
      render(<InlineProposalForm {...defaultProps} />);
      
      expect(screen.getByText('Loading your bookings...')).toBeInTheDocument();
    });
  });

  describe('Proposal Type Selection', () => {
    it('should allow switching between booking and cash proposals', async () => {
      const user = userEvent.setup();
      render(<InlineProposalForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Proposal Type')).toBeInTheDocument();
      });

      // Should default to booking proposal
      expect(screen.getByLabelText('Swap with my booking')).toBeChecked();

      // Switch to cash proposal
      await user.click(screen.getByLabelText('Make cash offer'));
      expect(screen.getByLabelText('Make cash offer')).toBeChecked();
      expect(screen.getByText('Cash Offer Amount')).toBeInTheDocument();
    });

    it('should disable booking option when no user bookings available', async () => {
      mockBookingService.getAvailableBookings.mockResolvedValue([]);
      
      render(<InlineProposalForm {...defaultProps} />);

      await waitFor(() => {
        const bookingOption = screen.getByLabelText('Swap with my booking');
        expect(bookingOption).toBeDisabled();
      });
    });

    it('should disable cash option when not accepted by booking', async () => {
      const bookingWithoutCash = {
        ...mockBooking,
        swapInfo: {
          ...mockBooking.swapInfo!,
          paymentTypes: ['booking'] as ('booking' | 'cash')[],
        },
      };

      render(<InlineProposalForm {...defaultProps} booking={bookingWithoutCash} />);

      await waitFor(() => {
        const cashOption = screen.getByLabelText('Make cash offer');
        expect(cashOption).toBeDisabled();
      });
    });
  });

  describe('Booking Selection', () => {
    it('should display user bookings in dropdown', async () => {
      render(<InlineProposalForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Select Your Booking')).toBeInTheDocument();
      });

      const select = screen.getByDisplayValue('Choose a booking to swap...');
      expect(select).toBeInTheDocument();

      // Check that user bookings are in the dropdown
      expect(screen.getByText(/My Hotel in Rome/)).toBeInTheDocument();
      expect(screen.getByText(/Barcelona Apartment/)).toBeInTheDocument();
    });

    it('should show message when no bookings available', async () => {
      mockBookingService.getAvailableBookings.mockResolvedValue([]);
      
      render(<InlineProposalForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No available bookings found')).toBeInTheDocument();
        expect(screen.getByText('You need an available booking to propose a swap')).toBeInTheDocument();
      });
    });

    it('should allow selecting a booking', async () => {
      const user = userEvent.setup();
      render(<InlineProposalForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Select Your Booking')).toBeInTheDocument();
      });

      const select = screen.getByDisplayValue('Choose a booking to swap...');
      await user.selectOptions(select, 'user-booking-1');

      expect(select).toHaveValue('user-booking-1');
    });
  });

  describe('Cash Offer Input', () => {
    it('should show cash input when cash proposal is selected', async () => {
      const user = userEvent.setup();
      render(<InlineProposalForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Proposal Type')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Make cash offer'));

      expect(screen.getByText('Cash Offer Amount')).toBeInTheDocument();
      expect(screen.getByText('Range: $100 - $600')).toBeInTheDocument();
    });

    it('should validate minimum cash amount', async () => {
      const user = userEvent.setup();
      render(<InlineProposalForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Proposal Type')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Make cash offer'));
      
      const cashInput = screen.getByLabelText('Cash Offer Amount');
      await user.clear(cashInput);
      await user.type(cashInput, '50');

      expect(screen.getByText('Amount must be at least $100')).toBeInTheDocument();
    });

    it('should validate maximum cash amount', async () => {
      const user = userEvent.setup();
      render(<InlineProposalForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Proposal Type')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Make cash offer'));
      
      const cashInput = screen.getByLabelText('Cash Offer Amount');
      await user.clear(cashInput);
      await user.type(cashInput, '700');

      expect(screen.getByText('Amount must not exceed $600')).toBeInTheDocument();
    });
  });

  describe('Message Input', () => {
    it('should allow entering a message', async () => {
      const user = userEvent.setup();
      render(<InlineProposalForm {...defaultProps} />);

      const messageInput = screen.getByPlaceholderText('Add a message to your proposal (optional)');
      await user.type(messageInput, 'This is a test message');

      expect(messageInput).toHaveValue('This is a test message');
    });

    it('should show character count', async () => {
      const user = userEvent.setup();
      render(<InlineProposalForm {...defaultProps} />);

      const messageInput = screen.getByPlaceholderText('Add a message to your proposal (optional)');
      await user.type(messageInput, 'Test');

      expect(screen.getByText('4/500')).toBeInTheDocument();
    });

    it('should validate message length', async () => {
      const user = userEvent.setup();
      render(<InlineProposalForm {...defaultProps} />);

      const messageInput = screen.getByPlaceholderText('Add a message to your proposal (optional)');
      const longMessage = 'a'.repeat(501);
      await user.type(messageInput, longMessage);

      expect(screen.getByText('Message must be less than 500 characters')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should submit booking proposal with correct data', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<InlineProposalForm {...defaultProps} onSubmit={onSubmit} />);

      await waitFor(() => {
        expect(screen.getByText('Select Your Booking')).toBeInTheDocument();
      });

      // Select a booking
      const select = screen.getByDisplayValue('Choose a booking to swap...');
      await user.selectOptions(select, 'user-booking-1');

      // Add a message
      const messageInput = screen.getByPlaceholderText('Add a message to your proposal (optional)');
      await user.type(messageInput, 'Interested in swapping!');

      // Submit
      await user.click(screen.getByText('Send Proposal'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          type: 'booking',
          selectedBookingId: 'user-booking-1',
          message: 'Interested in swapping!',
        });
      });
    });

    it('should submit cash proposal with correct data', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<InlineProposalForm {...defaultProps} onSubmit={onSubmit} />);

      await waitFor(() => {
        expect(screen.getByText('Proposal Type')).toBeInTheDocument();
      });

      // Switch to cash proposal
      await user.click(screen.getByLabelText('Make cash offer'));

      // Set cash amount
      const cashInput = screen.getByLabelText('Cash Offer Amount');
      await user.clear(cashInput);
      await user.type(cashInput, '200');

      // Add a message
      const messageInput = screen.getByPlaceholderText('Add a message to your proposal (optional)');
      await user.type(messageInput, 'Cash offer!');

      // Submit
      await user.click(screen.getByText('Send Proposal'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          type: 'cash',
          cashAmount: 200,
          message: 'Cash offer!',
        });
      });
    });

    it('should prevent submission with invalid booking proposal', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();
      
      render(<InlineProposalForm {...defaultProps} onSubmit={onSubmit} />);

      await waitFor(() => {
        expect(screen.getByText('Send Proposal')).toBeInTheDocument();
      });

      // Try to submit without selecting a booking
      const submitButton = screen.getByText('Send Proposal');
      expect(submitButton).toBeDisabled();

      await user.click(submitButton);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should prevent submission with invalid cash amount', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();
      
      render(<InlineProposalForm {...defaultProps} onSubmit={onSubmit} />);

      await waitFor(() => {
        expect(screen.getByText('Proposal Type')).toBeInTheDocument();
      });

      // Switch to cash proposal
      await user.click(screen.getByLabelText('Make cash offer'));

      // Set invalid cash amount (below minimum)
      const cashInput = screen.getByLabelText('Cash Offer Amount');
      await user.clear(cashInput);
      await user.type(cashInput, '50');

      // Submit button should be disabled
      const submitButton = screen.getByText('Send Proposal');
      expect(submitButton).toBeDisabled();
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      render(<InlineProposalForm {...defaultProps} onSubmit={onSubmit} />);

      await waitFor(() => {
        expect(screen.getByText('Proposal Type')).toBeInTheDocument();
      });

      // Switch to cash and set valid amount
      await user.click(screen.getByLabelText('Make cash offer'));
      const cashInput = screen.getByLabelText('Cash Offer Amount');
      await user.clear(cashInput);
      await user.type(cashInput, '200');

      // Submit
      await user.click(screen.getByText('Send Proposal'));

      // Should show loading state
      expect(screen.getByText('Send Proposal')).toBeInTheDocument();
      const submitButton = screen.getByText('Send Proposal');
      expect(submitButton).toBeDisabled();
    });

    it('should handle submission errors', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn().mockRejectedValue(new Error('Submission failed'));
      
      render(<InlineProposalForm {...defaultProps} onSubmit={onSubmit} />);

      await waitFor(() => {
        expect(screen.getByText('Proposal Type')).toBeInTheDocument();
      });

      // Switch to cash and set valid amount
      await user.click(screen.getByLabelText('Make cash offer'));
      const cashInput = screen.getByLabelText('Cash Offer Amount');
      await user.clear(cashInput);
      await user.type(cashInput, '200');

      // Submit
      await user.click(screen.getByText('Send Proposal'));

      await waitFor(() => {
        expect(screen.getByText('Submission failed')).toBeInTheDocument();
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();
      
      render(<InlineProposalForm {...defaultProps} onCancel={onCancel} />);

      await user.click(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalled();
    });

    it('should call onCancel when close button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();
      
      render(<InlineProposalForm {...defaultProps} onCancel={onCancel} />);

      await user.click(screen.getByText('✕'));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', async () => {
      render(<InlineProposalForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Swap with my booking')).toBeInTheDocument();
        expect(screen.getByLabelText('Make cash offer')).toBeInTheDocument();
      });
    });

    it('should associate error messages with form fields', async () => {
      const user = userEvent.setup();
      render(<InlineProposalForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Proposal Type')).toBeInTheDocument();
      });

      // Switch to cash and enter invalid amount
      await user.click(screen.getByLabelText('Make cash offer'));
      const cashInput = screen.getByLabelText('Cash Offer Amount');
      await user.clear(cashInput);
      await user.type(cashInput, '50');

      expect(screen.getByText('Amount must be at least $100')).toBeInTheDocument();
    });
  });
});