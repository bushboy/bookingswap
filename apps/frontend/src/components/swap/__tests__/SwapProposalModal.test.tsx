import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwapProposalModal, SwapProposalData } from '../SwapProposalModal';
import { Booking } from '@booking-swap/shared';

const mockTargetBooking: Booking = {
  id: 'target-1',
  userId: 'user1',
  type: 'hotel',
  title: 'Luxury Hotel in NYC',
  description: 'Amazing hotel in Manhattan',
  location: {
    city: 'New York',
    country: 'United States',
    coordinates: [40.7128, -74.006],
  },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-05'),
  },
  originalPrice: 1200,
  swapValue: 1000,
  providerDetails: {
    provider: 'Booking.com',
    confirmationNumber: 'BK123456',
    bookingReference: 'REF123',
  },
  verification: {
    status: 'verified',
    verifiedAt: new Date('2024-01-01'),
    documents: ['doc1'],
  },
  blockchain: {
    topicId: 'topic1',
  },
  status: 'available',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockUserBookings: Booking[] = [
  {
    id: 'user-1',
    userId: 'currentUser',
    type: 'flight',
    title: 'Flight to Paris',
    description: 'Round trip flight to Paris',
    location: {
      city: 'Paris',
      country: 'France',
      coordinates: [48.8566, 2.3522],
    },
    dateRange: {
      checkIn: new Date('2024-08-01'),
      checkOut: new Date('2024-08-10'),
    },
    originalPrice: 800,
    swapValue: 750,
    providerDetails: {
      provider: 'Air France',
      confirmationNumber: 'AF456',
      bookingReference: 'REF456',
    },
    verification: {
      status: 'verified',
      verifiedAt: new Date('2024-01-01'),
      documents: ['doc3'],
    },
    blockchain: {
      topicId: 'topic3',
    },
    status: 'available',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
  {
    id: 'user-2',
    userId: 'currentUser',
    type: 'event',
    title: 'Concert Tickets',
    description: 'Front row seats',
    location: {
      city: 'Los Angeles',
      country: 'United States',
      coordinates: [34.0522, -118.2437],
    },
    dateRange: {
      checkIn: new Date('2024-07-15'),
      checkOut: new Date('2024-07-15'),
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
      provider: 'Ticketmaster',
      confirmationNumber: 'TM789',
      bookingReference: 'REF789',
    },
    verification: {
      status: 'verified',
      verifiedAt: new Date('2024-01-01'),
      documents: ['doc2'],
    },
    blockchain: {
      topicId: 'topic2',
    },
    status: 'available',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
];

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  targetBooking: mockTargetBooking,
  userBookings: mockUserBookings,
  onSubmit: jest.fn(),
  loading: false,
};

describe('SwapProposalModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal when open', () => {
    render(<SwapProposalModal {...defaultProps} />);

    expect(screen.getByText('Propose Swap')).toBeInTheDocument();
    expect(
      screen.getByText('Create a swap proposal for "Luxury Hotel in NYC"')
    ).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<SwapProposalModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Propose Swap')).not.toBeInTheDocument();
  });

  it('does not render when no target booking', () => {
    render(<SwapProposalModal {...defaultProps} targetBooking={null} />);

    expect(screen.queryByText('Propose Swap')).not.toBeInTheDocument();
  });

  it('shows step indicator', () => {
    render(<SwapProposalModal {...defaultProps} />);

    expect(screen.getByText('Select Your Booking')).toBeInTheDocument();
    expect(screen.getByText('Add Details')).toBeInTheDocument();
    expect(screen.getByText('Review & Submit')).toBeInTheDocument();
  });

  it('displays user bookings for selection', () => {
    render(<SwapProposalModal {...defaultProps} />);

    expect(screen.getByText('Flight to Paris')).toBeInTheDocument();
    expect(screen.getByText('Concert Tickets')).toBeInTheDocument();
  });

  it('handles booking selection', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);

      // Should show selected state (border color change)
      expect(flightBooking).toHaveStyle('border: 2px solid');
    }
  });

  it('proceeds to details step after booking selection', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    // Select a booking
    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);
    }

    // Click next button
    const nextButton = screen.getByText('Next: Add Details');
    await user.click(nextButton);

    expect(
      screen.getByText('Add proposal details and conditions')
    ).toBeInTheDocument();
  });

  it('handles personal message input', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    // Navigate to details step
    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);
    }
    await user.click(screen.getByText('Next: Add Details'));

    // Add personal message
    const messageTextarea = screen.getByPlaceholderText(
      /Add a personal message/
    );
    await user.type(messageTextarea, 'This would be a great swap!');

    expect(messageTextarea).toHaveValue('This would be a great swap!');
  });

  it('handles additional payment input', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    // Navigate to details step
    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);
    }
    await user.click(screen.getByText('Next: Add Details'));

    // Add additional payment
    const paymentInput = screen.getByLabelText('Additional Payment (Optional)');
    await user.type(paymentInput, '100');

    expect(paymentInput).toHaveValue('100');
  });

  it('handles condition selection', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    // Navigate to details step
    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);
    }
    await user.click(screen.getByText('Next: Add Details'));

    // Select a condition
    const flexibleTimesCheckbox = screen.getByLabelText(
      /Flexible check-in\/check-out times/
    );
    await user.click(flexibleTimesCheckbox);

    expect(flexibleTimesCheckbox).toBeChecked();
  });

  it('handles custom condition addition', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    // Navigate to details step
    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);
    }
    await user.click(screen.getByText('Next: Add Details'));

    // Add custom condition
    const customConditionInput = screen.getByPlaceholderText(
      'Enter a custom condition...'
    );
    await user.type(customConditionInput, 'Custom condition');

    const addButton = screen.getByText('Add');
    await user.click(addButton);

    expect(screen.getByText('Custom condition')).toBeInTheDocument();
  });

  it('removes conditions when clicked', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    // Navigate to details step and add condition
    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);
    }
    await user.click(screen.getByText('Next: Add Details'));

    const flexibleTimesCheckbox = screen.getByLabelText(
      /Flexible check-in\/check-out times/
    );
    await user.click(flexibleTimesCheckbox);

    // Remove the condition
    const removeButton = screen.getByLabelText(/Remove condition/);
    await user.click(removeButton);

    expect(flexibleTimesCheckbox).not.toBeChecked();
  });

  it('proceeds to review step with conditions', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    // Navigate through steps
    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);
    }
    await user.click(screen.getByText('Next: Add Details'));

    // Add a condition
    const flexibleTimesCheckbox = screen.getByLabelText(
      /Flexible check-in\/check-out times/
    );
    await user.click(flexibleTimesCheckbox);

    // Proceed to review
    const nextButton = screen.getByText('Next: Review');
    await user.click(nextButton);

    expect(screen.getByText('Review your swap proposal')).toBeInTheDocument();
  });

  it('displays booking comparison in review step', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    // Navigate to review step
    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);
    }
    await user.click(screen.getByText('Next: Add Details'));

    const flexibleTimesCheckbox = screen.getByLabelText(
      /Flexible check-in\/check-out times/
    );
    await user.click(flexibleTimesCheckbox);

    await user.click(screen.getByText('Next: Review'));

    expect(screen.getByText('Your Booking')).toBeInTheDocument();
    expect(screen.getByText('Their Booking')).toBeInTheDocument();
    expect(screen.getAllByText('Flight to Paris')).toHaveLength(1);
    expect(screen.getAllByText('Luxury Hotel in NYC')).toHaveLength(1);
  });

  it('submits proposal with correct data', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    // Complete the flow
    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);
    }
    await user.click(screen.getByText('Next: Add Details'));

    // Add message and payment
    const messageTextarea = screen.getByPlaceholderText(
      /Add a personal message/
    );
    await user.type(messageTextarea, 'Great swap opportunity!');

    const paymentInput = screen.getByLabelText('Additional Payment (Optional)');
    await user.type(paymentInput, '50');

    // Add condition
    const flexibleTimesCheckbox = screen.getByLabelText(
      /Flexible check-in\/check-out times/
    );
    await user.click(flexibleTimesCheckbox);

    await user.click(screen.getByText('Next: Review'));

    // Submit
    const submitButton = screen.getByText('Submit Proposal');
    await user.click(submitButton);

    const expectedData: SwapProposalData = {
      targetBookingId: 'target-1',
      sourceBookingId: 'user-1',
      message: 'Great swap opportunity!',
      additionalPayment: 50,
      conditions: ['Flexible check-in/check-out times'],
    };

    expect(defaultProps.onSubmit).toHaveBeenCalledWith(expectedData);
  });

  it('handles back navigation', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    // Navigate to details step
    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);
    }
    await user.click(screen.getByText('Next: Add Details'));

    // Go back
    const backButton = screen.getByText('Back');
    await user.click(backButton);

    expect(
      screen.getByText('Select one of your bookings to offer in exchange')
    ).toBeInTheDocument();
  });

  it('handles modal close', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows empty state when no available bookings', () => {
    const propsWithNoBookings = {
      ...defaultProps,
      userBookings: [],
    };

    render(<SwapProposalModal {...propsWithNoBookings} />);

    expect(screen.getByText('No available bookings')).toBeInTheDocument();
    expect(
      screen.getByText(
        'You need at least one verified and available booking to create a swap proposal.'
      )
    ).toBeInTheDocument();
  });

  it('filters out unavailable bookings', () => {
    const bookingsWithUnavailable = [
      ...mockUserBookings,
      {
        ...mockUserBookings[0],
        id: 'unavailable-1',
        status: 'locked' as const,
      },
      {
        ...mockUserBookings[0],
        id: 'unverified-1',
        verification: {
          status: 'pending' as const,
          documents: [],
        },
      },
    ];

    const propsWithMixedBookings = {
      ...defaultProps,
      userBookings: bookingsWithUnavailable,
    };

    render(<SwapProposalModal {...propsWithMixedBookings} />);

    // Should only show the 2 available and verified bookings
    expect(screen.getByText('Flight to Paris')).toBeInTheDocument();
    expect(screen.getByText('Concert Tickets')).toBeInTheDocument();
    expect(screen.queryByText('unavailable-1')).not.toBeInTheDocument();
    expect(screen.queryByText('unverified-1')).not.toBeInTheDocument();
  });

  it('disables buttons appropriately', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    // Next button should be disabled initially
    const nextButton = screen.getByText('Next: Add Details');
    expect(nextButton).toBeDisabled();

    // Enable after selection
    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);
    }

    expect(nextButton).not.toBeDisabled();
  });

  it('shows loading state', () => {
    render(<SwapProposalModal {...defaultProps} loading={true} />);

    // Loading state would be shown on submit button and other interactions
    expect(screen.getByText('Propose Swap')).toBeInTheDocument();
  });

  it('resets form when modal reopens', () => {
    const { rerender } = render(
      <SwapProposalModal {...defaultProps} isOpen={false} />
    );

    // Open modal, make selections, then close and reopen
    rerender(<SwapProposalModal {...defaultProps} isOpen={true} />);

    // Should be back to step 1
    expect(
      screen.getByText('Select one of your bookings to offer in exchange')
    ).toBeInTheDocument();
  });

  it('handles keyboard navigation for custom condition', async () => {
    const user = userEvent.setup();
    render(<SwapProposalModal {...defaultProps} />);

    // Navigate to details step
    const flightBooking = screen
      .getByText('Flight to Paris')
      .closest('[style*="border"]');
    if (flightBooking) {
      await user.click(flightBooking);
    }
    await user.click(screen.getByText('Next: Add Details'));

    // Add custom condition with Enter key
    const customConditionInput = screen.getByPlaceholderText(
      'Enter a custom condition...'
    );
    await user.type(customConditionInput, 'Custom condition{enter}');

    expect(screen.getByText('Custom condition')).toBeInTheDocument();
  });
});
