import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SwapProposalForm } from '../SwapProposalForm';
import { paymentService } from '../../../services/paymentService';

// Mock the payment service
vi.mock('../../../services/paymentService', () => ({
  paymentService: {
    getPaymentMethods: vi.fn(),
  },
}));

// Mock the auth context
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      username: 'testuser',
      email: 'test@example.com',
      verificationLevel: 'verified',
      createdAt: '2024-01-01',
    },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
  }),
}));

// Mock the PaymentMethodSelector component
vi.mock('../../payment/PaymentMethodSelector', () => ({
  PaymentMethodSelector: ({ paymentMethods, selectedMethodId, onSelect, error }: any) => (
    <div>
      <select
        data-testid="payment-method-selector"
        value={selectedMethodId}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="">Select payment method</option>
        {paymentMethods.map((method: any) => (
          <option key={method.id} value={method.id}>
            {method.displayName}
          </option>
        ))}
      </select>
      {error && <div role="alert">{error}</div>}
    </div>
  ),
}));

// Mock booking data
const mockTargetBooking = {
  id: 'booking-1',
  userId: 'user-2',
  type: 'hotel' as const,
  title: 'Luxury Hotel in Paris',
  description: 'Beautiful hotel in the heart of Paris',
  location: {
    city: 'Paris',
    country: 'France',
    coordinates: [48.8566, 2.3522] as [number, number],
  },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-05'),
  },
  originalPrice: 800,
  swapValue: 750,
  providerDetails: {
    provider: 'Booking.com',
    confirmationNumber: 'BK123456',
    bookingReference: 'REF789',
  },
  verification: {
    status: 'verified' as const,
    verifiedAt: new Date(),
    documents: [],
  },
  blockchain: {
    topicId: 'topic-1',
  },
  status: 'available' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserBookings = [
  {
    id: 'booking-2',
    userId: 'user-1',
    type: 'hotel' as const,
    title: 'Beach Resort in Miami',
    description: 'Oceanfront resort with amazing views',
    location: {
      city: 'Miami',
      country: 'USA',
      coordinates: [25.7617, -80.1918] as [number, number],
    },
    dateRange: {
      checkIn: new Date('2024-06-10'),
      checkOut: new Date('2024-06-15'),
    },
    originalPrice: 900,
    swapValue: 850,
    providerDetails: {
      provider: 'Expedia',
      confirmationNumber: 'EX789012',
      bookingReference: 'REF456',
    },
    verification: {
      status: 'verified' as const,
      verifiedAt: new Date(),
      documents: [],
    },
    blockchain: {
      topicId: 'topic-2',
    },
    status: 'available' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockTargetSwap = {
  id: 'swap-1',
  sourceBooking: mockTargetBooking,
  swapType: 'cash' as const,
  cashDetails: {
    minAmount: 500,
    maxAmount: 1000,
    preferredAmount: 750,
    currency: 'USD',
  },
};

const mockPaymentMethods = [
  {
    id: 'pm-1',
    type: 'credit_card' as const,
    displayName: 'Visa ending in 1234',
    isVerified: true,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('SwapProposalForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (paymentService.getPaymentMethods as any).mockResolvedValue(mockPaymentMethods);
  });

  describe('Bookings Table Context', () => {
    it('should display pre-filled booking when launched from bookings table', () => {
      render(
        <SwapProposalForm
          targetBooking={mockTargetBooking}
          context="bookings-table"
          preFilledBooking={mockUserBookings[0]}
          userBookings={mockUserBookings}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText('Your booking to offer:')).toBeInTheDocument();
      expect(screen.getByText('Pre-selected from your bookings')).toBeInTheDocument();
      expect(screen.getByText('Beach Resort in Miami')).toBeInTheDocument();
    });

    it('should submit booking proposal with pre-filled booking', async () => {
      const mockOnSubmit = vi.fn();
      
      render(
        <SwapProposalForm
          targetBooking={mockTargetBooking}
          context="bookings-table"
          preFilledBooking={mockUserBookings[0]}
          userBookings={mockUserBookings}
          onSubmit={mockOnSubmit}
          onCancel={vi.fn()}
        />
      );

      // Fill in message
      const messageInput = screen.getByPlaceholderText(/Add a personal message/);
      fireEvent.change(messageInput, { target: { value: 'Great swap opportunity!' } });

      // Submit form
      const submitButton = screen.getByText('Send Booking Proposal');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          type: 'booking',
          sourceBookingId: 'booking-2',
          additionalPayment: 0,
          conditions: [],
          expiresAt: expect.any(Date),
          message: 'Great swap opportunity!',
        });
      });
    });
  });

  describe('Browse/Search Context', () => {
    it('should show booking selection dropdown when launched from browse', () => {
      render(
        <SwapProposalForm
          targetBooking={mockTargetBooking}
          context="browse-search"
          userBookings={mockUserBookings}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText('Select your booking to offer:')).toBeInTheDocument();
      expect(screen.getByText('Search bookings...')).toBeInTheDocument();
    });

    it('should allow booking selection from dropdown', async () => {
      render(
        <SwapProposalForm
          targetBooking={mockTargetBooking}
          context="browse-search"
          userBookings={mockUserBookings}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Click on a booking to select it
      const bookingCard = screen.getByText('Beach Resort in Miami');
      fireEvent.click(bookingCard.closest('div')!);

      // Verify booking is selected (should show in preview)
      expect(screen.getByText('Ready to send booking proposal for Beach Resort in Miami')).toBeInTheDocument();
    });
  });

  describe('Cash Proposals', () => {
    it('should show cash proposal option when target swap supports cash', async () => {
      render(
        <SwapProposalForm
          targetSwap={mockTargetSwap}
          context="browse-search"
          userBookings={mockUserBookings}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText('Choose Proposal Type:')).toBeInTheDocument();
      expect(screen.getByText('Cash Offer')).toBeInTheDocument();
      expect(screen.getByText('💰 Cash Swap Available')).toBeInTheDocument();
    });

    it('should switch to cash proposal form when cash option is selected', async () => {
      render(
        <SwapProposalForm
          targetSwap={mockTargetSwap}
          context="browse-search"
          userBookings={mockUserBookings}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Click on cash offer option
      const cashOfferButton = screen.getByText('Cash Offer');
      fireEvent.click(cashOfferButton);

      await waitFor(() => {
        expect(screen.getByText('💰 Make Cash Offer')).toBeInTheDocument();
        expect(screen.getByLabelText('Cash Offer Amount')).toBeInTheDocument();
        expect(screen.getByText('Payment Method')).toBeInTheDocument();
      });
    });

    it('should load payment methods for cash proposals', async () => {
      render(
        <SwapProposalForm
          targetSwap={mockTargetSwap}
          context="browse-search"
          userBookings={mockUserBookings}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Switch to cash proposal
      const cashOfferButton = screen.getByText('Cash Offer');
      fireEvent.click(cashOfferButton);

      await waitFor(() => {
        expect(paymentService.getPaymentMethods).toHaveBeenCalledWith('user-1');
      });
    });

    it('should validate cash amount within allowed range', async () => {
      render(
        <SwapProposalForm
          targetSwap={mockTargetSwap}
          context="browse-search"
          userBookings={mockUserBookings}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Switch to cash proposal
      const cashOfferButton = screen.getByText('Cash Offer');
      fireEvent.click(cashOfferButton);

      await waitFor(async () => {
        const amountInput = screen.getByLabelText('Cash Offer Amount');
        
        // Test amount below minimum
        fireEvent.change(amountInput, { target: { value: '400' } });
        
        // Fill in message to avoid message validation error
        const messageInput = screen.getByPlaceholderText(/Add a personal message/);
        fireEvent.change(messageInput, { target: { value: 'Test message' } });
        
        // Try to submit
        const submitButton = screen.getByText('Send Cash Offer');
        fireEvent.click(submitButton);
        
        expect(screen.getByText('Minimum amount is $500')).toBeInTheDocument();
      });
    });

    it('should submit cash proposal with correct data', async () => {
      const mockOnSubmit = vi.fn();
      
      render(
        <SwapProposalForm
          targetSwap={mockTargetSwap}
          context="browse-search"
          userBookings={mockUserBookings}
          onSubmit={mockOnSubmit}
          onCancel={vi.fn()}
        />
      );

      // Switch to cash proposal
      const cashOfferButton = screen.getByText('Cash Offer');
      fireEvent.click(cashOfferButton);

      await waitFor(async () => {
        // Fill in cash amount
        const amountInput = screen.getByLabelText('Cash Offer Amount');
        fireEvent.change(amountInput, { target: { value: '750' } });

        // Select payment method
        const paymentMethodSelector = screen.getByTestId('payment-method-selector');
        fireEvent.change(paymentMethodSelector, { target: { value: 'pm-1' } });

        // Fill in message
        const messageInput = screen.getByPlaceholderText(/Add a personal message/);
        fireEvent.change(messageInput, { target: { value: 'Fair cash offer!' } });

        // Submit form
        const submitButton = screen.getByText('Send Cash Offer');
        fireEvent.click(submitButton);

        expect(mockOnSubmit).toHaveBeenCalledWith({
          type: 'cash',
          cashAmount: 750,
          paymentMethodId: 'pm-1',
          conditions: [],
          expiresAt: expect.any(Date),
          message: 'Fair cash offer!',
        });
      });
    });
  });

  describe('Validation', () => {
    it('should require message for all proposal types', async () => {
      render(
        <SwapProposalForm
          targetBooking={mockTargetBooking}
          context="bookings-table"
          preFilledBooking={mockUserBookings[0]}
          userBookings={mockUserBookings}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Try to submit without message
      const submitButton = screen.getByText('Send Booking Proposal');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please include a message with your proposal')).toBeInTheDocument();
      });
    });

    it('should validate expiration date is in the future', async () => {
      render(
        <SwapProposalForm
          targetBooking={mockTargetBooking}
          context="bookings-table"
          preFilledBooking={mockUserBookings[0]}
          userBookings={mockUserBookings}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Set expiration date in the past
      const expirationInput = screen.getByLabelText('Proposal expires on');
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      fireEvent.change(expirationInput, { 
        target: { value: pastDate.toISOString().slice(0, 16) } 
      });

      // Fill in message
      const messageInput = screen.getByPlaceholderText(/Add a personal message/);
      fireEvent.change(messageInput, { target: { value: 'Test message' } });

      // Try to submit
      const submitButton = screen.getByText('Send Booking Proposal');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Expiration date must be in the future')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and ARIA attributes', () => {
      render(
        <SwapProposalForm
          targetBooking={mockTargetBooking}
          context="bookings-table"
          preFilledBooking={mockUserBookings[0]}
          userBookings={mockUserBookings}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/Message to the booking owner/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Proposal expires on/)).toBeInTheDocument();
    });

    it('should announce form validation errors', async () => {
      render(
        <SwapProposalForm
          targetBooking={mockTargetBooking}
          context="bookings-table"
          preFilledBooking={mockUserBookings[0]}
          userBookings={mockUserBookings}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Try to submit without message
      const submitButton = screen.getByText('Send Booking Proposal');
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByText('Please include a message with your proposal');
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });
  });
});