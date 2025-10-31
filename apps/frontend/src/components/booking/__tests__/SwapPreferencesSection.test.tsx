import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SwapPreferencesSection } from '../SwapPreferencesSection';
import { SwapPreferencesData } from '@booking-swap/shared';

describe('SwapPreferencesSection', () => {
  const mockOnToggle = jest.fn();
  const mockOnChange = jest.fn();
  const eventDate = new Date('2024-12-01');
  const errors = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render collapsed when disabled', () => {
    render(
      <SwapPreferencesSection
        enabled={false}
        onToggle={mockOnToggle}
        onChange={mockOnChange}
        errors={errors}
        eventDate={eventDate}
      />
    );

    expect(screen.getByLabelText('Make available for swapping')).not.toBeChecked();
    expect(screen.queryByText('Payment Types Accepted')).not.toBeInTheDocument();
  });

  it('should expand when enabled', () => {
    const preferences: SwapPreferencesData = {
      paymentTypes: ['booking'],
      acceptanceStrategy: 'first-match',
      swapConditions: [],
    };

    render(
      <SwapPreferencesSection
        enabled={true}
        onToggle={mockOnToggle}
        preferences={preferences}
        onChange={mockOnChange}
        errors={errors}
        eventDate={eventDate}
      />
    );

    expect(screen.getByLabelText('Make available for swapping')).toBeChecked();
    expect(screen.getByText('Payment Types Accepted')).toBeInTheDocument();
    expect(screen.getByText('Deal Acceptance Strategy')).toBeInTheDocument();
  });

  it('should call onToggle when checkbox is clicked', () => {
    render(
      <SwapPreferencesSection
        enabled={false}
        onToggle={mockOnToggle}
        onChange={mockOnChange}
        errors={errors}
        eventDate={eventDate}
      />
    );

    fireEvent.click(screen.getByLabelText('Make available for swapping'));
    expect(mockOnToggle).toHaveBeenCalledWith(true);
  });

  it('should show cash amount inputs when cash payment is selected', () => {
    const preferences: SwapPreferencesData = {
      paymentTypes: ['booking', 'cash'],
      acceptanceStrategy: 'first-match',
      swapConditions: [],
    };

    render(
      <SwapPreferencesSection
        enabled={true}
        onToggle={mockOnToggle}
        preferences={preferences}
        onChange={mockOnChange}
        errors={errors}
        eventDate={eventDate}
      />
    );

    expect(screen.getByLabelText('Minimum Cash Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum Cash Amount (Optional)')).toBeInTheDocument();
  });

  it('should show auction end date picker when auction strategy is selected', () => {
    const futureEventDate = new Date('2024-12-15'); // More than a week from now
    const preferences: SwapPreferencesData = {
      paymentTypes: ['booking'],
      acceptanceStrategy: 'auction',
      swapConditions: [],
    };

    render(
      <SwapPreferencesSection
        enabled={true}
        onToggle={mockOnToggle}
        preferences={preferences}
        onChange={mockOnChange}
        errors={errors}
        eventDate={futureEventDate}
      />
    );

    expect(screen.getByLabelText('Auction End Date')).toBeInTheDocument();
  });

  it('should disable auction mode for last-minute events', () => {
    const lastMinuteEventDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    const preferences: SwapPreferencesData = {
      paymentTypes: ['booking'],
      acceptanceStrategy: 'first-match',
      swapConditions: [],
    };

    render(
      <SwapPreferencesSection
        enabled={true}
        onToggle={mockOnToggle}
        preferences={preferences}
        onChange={mockOnChange}
        errors={errors}
        eventDate={lastMinuteEventDate}
      />
    );

    const auctionRadio = screen.getByDisplayValue('auction');
    expect(auctionRadio).toBeDisabled();
    expect(screen.getByText(/Auction mode is not available for events within one week/)).toBeInTheDocument();
  });

  it('should update preferences when payment types change', () => {
    const preferences: SwapPreferencesData = {
      paymentTypes: ['booking'],
      acceptanceStrategy: 'first-match',
      swapConditions: [],
    };

    render(
      <SwapPreferencesSection
        enabled={true}
        onToggle={mockOnToggle}
        preferences={preferences}
        onChange={mockOnChange}
        errors={errors}
        eventDate={eventDate}
      />
    );

    fireEvent.click(screen.getByLabelText('Cash Offers'));
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...preferences,
      paymentTypes: ['booking', 'cash'],
    });
  });

  it('should display validation errors', () => {
    const errorsWithMessages = {
      paymentTypes: 'At least one payment type must be selected',
      minCashAmount: 'Minimum cash amount is required',
    };

    render(
      <SwapPreferencesSection
        enabled={true}
        onToggle={mockOnToggle}
        onChange={mockOnChange}
        errors={errorsWithMessages}
        eventDate={eventDate}
      />
    );

    expect(screen.getByText('At least one payment type must be selected')).toBeInTheDocument();
  });

  it('should allow collapsing and expanding when enabled', () => {
    const preferences: SwapPreferencesData = {
      paymentTypes: ['booking'],
      acceptanceStrategy: 'first-match',
      swapConditions: [],
    };

    render(
      <SwapPreferencesSection
        enabled={true}
        onToggle={mockOnToggle}
        preferences={preferences}
        onChange={mockOnChange}
        errors={errors}
        eventDate={eventDate}
      />
    );

    // Should be expanded by default when enabled
    expect(screen.getByText('Payment Types Accepted')).toBeInTheDocument();

    // Click collapse button
    const collapseButton = screen.getByText('−');
    fireEvent.click(collapseButton);

    // Content should be hidden
    expect(screen.queryByText('Payment Types Accepted')).not.toBeInTheDocument();

    // Click expand button
    const expandButton = screen.getByText('+');
    fireEvent.click(expandButton);

    // Content should be visible again
    expect(screen.getByText('Payment Types Accepted')).toBeInTheDocument();
  });
});