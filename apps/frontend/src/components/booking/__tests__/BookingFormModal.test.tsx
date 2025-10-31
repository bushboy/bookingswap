import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingFormModal } from '../BookingFormModal';
import { Booking, BookingType, BookingStatus } from '@booking-swap/shared';

const mockBooking: Booking = {
  id: '1',
  userId: 'user1',
  type: 'hotel' as BookingType,
  title: 'Luxury Hotel Paris',
  description: 'Beautiful hotel in the heart of Paris',
  location: { city: 'Paris', country: 'France' },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-05'),
  },
  originalPrice: 500,
  swapValue: 450,
  providerDetails: {
    provider: 'Booking.com',
    confirmationNumber: 'ABC123',
    bookingReference: 'REF123',
  },
  verification: { status: 'verified', documents: [] },
  blockchain: { topicId: 'topic1' },
  status: 'available' as BookingStatus,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
};

describe('BookingFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create booking form when no booking provided', () => {
    render(<BookingFormModal {...defaultProps} />);

    expect(screen.getByText('Create New Booking')).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toHaveValue('');
    expect(screen.getByText('Create Booking')).toBeInTheDocument();
  });

  it('renders edit booking form when booking provided', () => {
    render(<BookingFormModal {...defaultProps} booking={mockBooking} />);

    expect(screen.getByText('Edit Booking')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Luxury Hotel Paris')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('Beautiful hotel in the heart of Paris')
    ).toBeInTheDocument();
    expect(screen.getByText('Update Booking')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<BookingFormModal {...defaultProps} />);

    // Try to submit empty form
    const submitButton = screen.getByText('Create Booking');
    await user.click(submitButton);

    // Should show validation errors
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(screen.getByText('City is required')).toBeInTheDocument();
  });

  it('validates price fields correctly', async () => {
    const user = userEvent.setup();
    render(<BookingFormModal {...defaultProps} />);

    // Fill required fields
    await user.type(screen.getByLabelText(/title/i), 'Test Hotel');
    await user.type(
      screen.getByLabelText(/description/i),
      'Test description for hotel'
    );
    await user.type(screen.getByLabelText(/location/i), 'Paris, France');
    await user.type(screen.getByLabelText(/provider/i), 'Booking.com');
    await user.type(screen.getByLabelText(/confirmation number/i), 'ABC123');

    // Set invalid prices
    const originalPriceInput = screen.getByLabelText(/original price/i);
    const swapValueInput = screen.getByLabelText(/swap value/i);

    await user.clear(originalPriceInput);
    await user.type(originalPriceInput, '0');
    await user.clear(swapValueInput);
    await user.type(swapValueInput, '0');

    const submitButton = screen.getByText('Create Booking');
    await user.click(submitButton);

    expect(
      screen.getByText('Original price must be greater than 0')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Swap value must be greater than 0')
    ).toBeInTheDocument();
  });

  it('validates date fields correctly', async () => {
    const user = userEvent.setup();
    render(<BookingFormModal {...defaultProps} />);

    // Fill required fields
    await user.type(screen.getByLabelText(/title/i), 'Test Hotel');
    await user.type(
      screen.getByLabelText(/description/i),
      'Test description for hotel'
    );
    await user.type(screen.getByLabelText(/location/i), 'Paris, France');
    await user.type(screen.getByLabelText(/provider/i), 'Booking.com');
    await user.type(screen.getByLabelText(/confirmation number/i), 'ABC123');
    await user.type(screen.getByLabelText(/original price/i), '100');
    await user.type(screen.getByLabelText(/swap value/i), '90');

    // Set invalid dates (past date)
    const checkInInput = screen.getByLabelText(/check-in date/i);
    const checkOutInput = screen.getByLabelText(/check-out date/i);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await user.clear(checkInInput);
    await user.type(checkInInput, yesterday.toISOString().split('T')[0]);

    const submitButton = screen.getByText('Create Booking');
    await user.click(submitButton);

    expect(
      screen.getByText('Check-in date cannot be in the past')
    ).toBeInTheDocument();
  });

  it('shows location suggestions', async () => {
    const user = userEvent.setup();
    render(<BookingFormModal {...defaultProps} />);

    const locationInput = screen.getByLabelText(/location/i);
    await user.type(locationInput, 'Par');

    // Should show Paris suggestion
    expect(screen.getByText('📍 Paris, France')).toBeInTheDocument();
  });

  it('selects location from suggestions', async () => {
    const user = userEvent.setup();
    render(<BookingFormModal {...defaultProps} />);

    const locationInput = screen.getByLabelText(/location/i);
    await user.type(locationInput, 'Par');

    // Click on Paris suggestion
    const parisSuggestion = screen.getByText('📍 Paris, France');
    await user.click(parisSuggestion);

    expect(locationInput).toHaveValue('Paris, France');
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    render(<BookingFormModal {...defaultProps} />);

    // Fill all required fields
    await user.selectOptions(screen.getByLabelText(/booking type/i), 'hotel');
    await user.type(screen.getByLabelText(/title/i), 'Test Hotel');
    await user.type(
      screen.getByLabelText(/description/i),
      'Test description for hotel booking'
    );
    await user.type(screen.getByLabelText(/location/i), 'Paris, France');
    await user.type(screen.getByLabelText(/original price/i), '500');
    await user.type(screen.getByLabelText(/swap value/i), '450');
    await user.type(screen.getByLabelText(/provider/i), 'Booking.com');
    await user.type(screen.getByLabelText(/confirmation number/i), 'ABC123');

    const submitButton = screen.getByText('Create Booking');
    await user.click(submitButton);

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'hotel',
          title: 'Test Hotel',
          description: 'Test description for hotel booking',
          location: { city: 'Paris', country: 'France' },
          originalPrice: 500,
          swapValue: 450,
          providerDetails: {
            provider: 'Booking.com',
            confirmationNumber: 'ABC123',
            bookingReference: '',
          },
        })
      );
    });
  });

  it('closes modal on cancel', async () => {
    const user = userEvent.setup();
    render(<BookingFormModal {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes modal on escape key', async () => {
    const user = userEvent.setup();
    render(<BookingFormModal {...defaultProps} />);

    await user.keyboard('{Escape}');

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows loading state during submission', () => {
    render(<BookingFormModal {...defaultProps} loading={true} />);

    const submitButton = screen.getByText('Create Booking');
    expect(submitButton).toBeDisabled();
  });

  it('handles file upload', async () => {
    const user = userEvent.setup();
    render(<BookingFormModal {...defaultProps} />);

    // Find file upload area
    const fileUpload = screen.getByText(/click to upload/i);
    expect(fileUpload).toBeInTheDocument();

    // File upload functionality would be tested in FileUpload component tests
  });

  it('clears form when switching from edit to create', () => {
    const { rerender } = render(
      <BookingFormModal {...defaultProps} booking={mockBooking} />
    );

    // Should show booking data
    expect(screen.getByDisplayValue('Luxury Hotel Paris')).toBeInTheDocument();

    // Switch to create mode
    rerender(<BookingFormModal {...defaultProps} booking={undefined} />);

    // Should clear form
    expect(screen.getByLabelText(/title/i)).toHaveValue('');
  });
});
