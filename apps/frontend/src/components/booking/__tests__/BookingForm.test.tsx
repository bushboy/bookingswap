import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BookingForm } from '../BookingForm';

describe('BookingForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders all form fields', () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/booking type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/check-in date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/check-out date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/original price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/swap value/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmation number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/booking reference/i)).toBeInTheDocument();
  });

  it('shows validation errors for required fields', async () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByRole('button', {
      name: /list booking for swap/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/description is required/i)).toBeInTheDocument();
      expect(screen.getByText(/city is required/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates price fields', async () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);

    const originalPriceInput = screen.getByLabelText(/original price/i);
    const swapValueInput = screen.getByLabelText(/swap value/i);
    const submitButton = screen.getByRole('button', {
      name: /list booking for swap/i,
    });

    fireEvent.change(originalPriceInput, { target: { value: '0' } });
    fireEvent.change(swapValueInput, { target: { value: '0' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/original price must be greater than 0/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/swap value must be greater than 0/i)
      ).toBeInTheDocument();
    });
  });

  it('validates date range', async () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);

    const checkInInput = screen.getByLabelText(/check-in date/i);
    const checkOutInput = screen.getByLabelText(/check-out date/i);
    const submitButton = screen.getByRole('button', {
      name: /list booking for swap/i,
    });

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split('T')[0];

    fireEvent.change(checkInInput, { target: { value: today } });
    fireEvent.change(checkOutInput, { target: { value: yesterday } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/check-out date must be after check-in date/i)
      ).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);

    // Fill in all required fields
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Hotel' },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'A nice hotel' },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: 'Paris' },
    });
    fireEvent.change(screen.getByLabelText(/country/i), {
      target: { value: 'France' },
    });
    fireEvent.change(screen.getByLabelText(/original price/i), {
      target: { value: '200' },
    });
    fireEvent.change(screen.getByLabelText(/swap value/i), {
      target: { value: '180' },
    });
    fireEvent.change(screen.getByLabelText(/provider/i), {
      target: { value: 'Booking.com' },
    });
    fireEvent.change(screen.getByLabelText(/confirmation number/i), {
      target: { value: 'ABC123' },
    });

    const tomorrow = new Date(Date.now() + 86400000)
      .toISOString()
      .split('T')[0];
    const dayAfter = new Date(Date.now() + 172800000)
      .toISOString()
      .split('T')[0];

    fireEvent.change(screen.getByLabelText(/check-in date/i), {
      target: { value: tomorrow },
    });
    fireEvent.change(screen.getByLabelText(/check-out date/i), {
      target: { value: dayAfter },
    });

    const submitButton = screen.getByRole('button', {
      name: /list booking for swap/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Hotel',
          description: 'A nice hotel',
          location: { city: 'Paris', country: 'France' },
          originalPrice: 200,
          swapValue: 180,
          providerDetails: expect.objectContaining({
            provider: 'Booking.com',
            confirmationNumber: 'ABC123',
          }),
        })
      );
    });
  });

  it('shows loading state', () => {
    render(<BookingForm onSubmit={mockOnSubmit} loading={true} />);

    const submitButton = screen.getByRole('button', {
      name: /list booking for swap/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it('clears errors when user starts typing', async () => {
    render(<BookingForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByRole('button', {
      name: /list booking for swap/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Test' } });

    expect(screen.queryByText(/title is required/i)).not.toBeInTheDocument();
  });
});
