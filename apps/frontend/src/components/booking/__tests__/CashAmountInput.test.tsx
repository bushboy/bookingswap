import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CashAmountInput } from '../CashAmountInput';

describe('CashAmountInput', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with label and dollar icon', () => {
    render(
      <CashAmountInput
        label="Minimum Cash Amount"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByLabelText('Minimum Cash Amount')).toBeInTheDocument();
    expect(screen.getByText('$')).toBeInTheDocument();
  });

  it('should call onChange with numeric value', () => {
    render(
      <CashAmountInput
        label="Amount"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText('Amount');
    fireEvent.change(input, { target: { value: '100.50' } });
    
    expect(mockOnChange).toHaveBeenCalledWith(100.50);
  });

  it('should call onChange with undefined for empty input', () => {
    render(
      <CashAmountInput
        label="Amount"
        value={100}
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText('Amount');
    fireEvent.change(input, { target: { value: '' } });
    
    expect(mockOnChange).toHaveBeenCalledWith(undefined);
  });

  it('should validate minimum amount', () => {
    render(
      <CashAmountInput
        label="Amount"
        value={50}
        minAmount={100}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Amount must be at least $100')).toBeInTheDocument();
  });

  it('should validate maximum amount', () => {
    render(
      <CashAmountInput
        label="Amount"
        value={1500}
        maxAmount={1000}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Amount must not exceed $1000')).toBeInTheDocument();
  });

  it('should display custom error message', () => {
    render(
      <CashAmountInput
        label="Amount"
        error="Custom error message"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('should display helper text when no error', () => {
    render(
      <CashAmountInput
        label="Amount"
        helperText="Enter the minimum amount you will accept"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Enter the minimum amount you will accept')).toBeInTheDocument();
  });

  it('should not accept negative values', () => {
    render(
      <CashAmountInput
        label="Amount"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText('Amount');
    fireEvent.change(input, { target: { value: '-50' } });
    
    expect(mockOnChange).not.toHaveBeenCalledWith(-50);
  });
});