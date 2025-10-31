import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentTypeSelector } from '../PaymentTypeSelector';

describe('PaymentTypeSelector', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render both payment type options', () => {
    render(
      <PaymentTypeSelector
        selected={['booking']}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByLabelText('Booking Exchange')).toBeInTheDocument();
    expect(screen.getByLabelText('Cash Offers')).toBeInTheDocument();
  });

  it('should show selected payment types as checked', () => {
    render(
      <PaymentTypeSelector
        selected={['booking', 'cash']}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByLabelText('Booking Exchange')).toBeChecked();
    expect(screen.getByLabelText('Cash Offers')).toBeChecked();
  });

  it('should call onChange when payment type is toggled', () => {
    render(
      <PaymentTypeSelector
        selected={['booking']}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Cash Offers'));
    expect(mockOnChange).toHaveBeenCalledWith(['booking', 'cash']);
  });

  it('should not allow removing the last payment type', () => {
    render(
      <PaymentTypeSelector
        selected={['booking']}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Booking Exchange'));
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should allow removing a payment type when multiple are selected', () => {
    render(
      <PaymentTypeSelector
        selected={['booking', 'cash']}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Cash Offers'));
    expect(mockOnChange).toHaveBeenCalledWith(['booking']);
  });

  it('should display error message when provided', () => {
    render(
      <PaymentTypeSelector
        selected={[]}
        onChange={mockOnChange}
        error="At least one payment type must be selected"
      />
    );

    expect(screen.getByText('At least one payment type must be selected')).toBeInTheDocument();
  });
});