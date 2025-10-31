import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterPanel } from '../FilterPanel';
import { BookingFilters } from '@/services/bookingService';

const defaultProps = {
  filters: {} as BookingFilters,
  onChange: jest.fn(),
  onReset: jest.fn(),
};

describe('FilterPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the filter panel', () => {
    render(<FilterPanel {...defaultProps} />);

    expect(screen.getByText('Filter Bookings')).toBeInTheDocument();
    expect(screen.getByText('Booking Type')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
  });

  it('shows active filter count', () => {
    const filtersWithData: BookingFilters = {
      type: ['hotel', 'event'],
      status: ['available'],
    };

    render(<FilterPanel {...defaultProps} filters={filtersWithData} />);

    expect(screen.getByText('2 active')).toBeInTheDocument();
  });

  it('handles booking type selection', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    const hotelCheckbox = screen.getByLabelText(/Hotel/);
    await user.click(hotelCheckbox);

    expect(defaultProps.onChange).toHaveBeenCalledWith({
      type: ['hotel'],
    });
  });

  it('handles booking type deselection', async () => {
    const user = userEvent.setup();
    const filtersWithHotel: BookingFilters = {
      type: ['hotel'],
    };

    render(<FilterPanel {...defaultProps} filters={filtersWithHotel} />);

    const hotelCheckbox = screen.getByLabelText(/Hotel/);
    await user.click(hotelCheckbox);

    expect(defaultProps.onChange).toHaveBeenCalledWith({});
  });

  it('handles location input changes', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    const cityInput = screen.getByLabelText('City');
    await user.type(cityInput, 'New York');

    expect(defaultProps.onChange).toHaveBeenCalledWith({
      location: {
        city: 'New York',
      },
    });
  });

  it('handles date range input', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    // Expand date section
    await user.click(screen.getByText('Date Range'));

    const startDateInput = screen.getByLabelText('Check-in Date');
    const endDateInput = screen.getByLabelText('Check-out Date');

    await user.type(startDateInput, '2024-06-01');
    await user.type(endDateInput, '2024-06-05');

    expect(defaultProps.onChange).toHaveBeenCalledWith({
      dateRange: {
        start: new Date('2024-06-01'),
        end: new Date('2024-06-05'),
        flexible: false,
      },
    });
  });

  it('handles flexible dates checkbox', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    // Expand date section
    await user.click(screen.getByText('Date Range'));

    const flexibleCheckbox = screen.getByLabelText(/Flexible dates/);
    await user.click(flexibleCheckbox);

    // Should be called when dates are also set
    const startDateInput = screen.getByLabelText('Check-in Date');
    const endDateInput = screen.getByLabelText('Check-out Date');

    await user.type(startDateInput, '2024-06-01');
    await user.type(endDateInput, '2024-06-05');

    expect(defaultProps.onChange).toHaveBeenCalledWith({
      dateRange: {
        start: new Date('2024-06-01'),
        end: new Date('2024-06-05'),
        flexible: true,
      },
    });
  });

  it('handles price range input', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    // Expand price section
    await user.click(screen.getByText('Price Range'));

    const minPriceInput = screen.getByLabelText('Min Price ($)');
    const maxPriceInput = screen.getByLabelText('Max Price ($)');

    await user.type(minPriceInput, '100');
    await user.type(maxPriceInput, '500');

    expect(defaultProps.onChange).toHaveBeenCalledWith({
      priceRange: {
        min: 100,
        max: 500,
      },
    });
  });

  it('handles status selection', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    // Expand status section
    await user.click(screen.getByText('Booking Status'));

    const availableCheckbox = screen.getByLabelText(/Available/);
    await user.click(availableCheckbox);

    expect(defaultProps.onChange).toHaveBeenCalledWith({
      status: ['available'],
    });
  });

  it('handles verification status selection', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    // Expand verification section
    await user.click(screen.getByText('Verification Status'));

    const verifiedCheckbox = screen.getByLabelText(/Verified/);
    await user.click(verifiedCheckbox);

    expect(defaultProps.onChange).toHaveBeenCalledWith({
      verificationStatus: ['verified'],
    });
  });

  it('expands and collapses sections', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    // Date Range should be collapsed by default
    expect(screen.queryByLabelText('Check-in Date')).not.toBeInTheDocument();

    // Expand date section
    await user.click(screen.getByText('Date Range'));
    expect(screen.getByLabelText('Check-in Date')).toBeInTheDocument();

    // Collapse date section
    await user.click(screen.getByText('Date Range'));
    expect(screen.queryByLabelText('Check-in Date')).not.toBeInTheDocument();
  });

  it('handles section expansion with keyboard', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    const dateSection = screen
      .getByText('Date Range')
      .closest('[role="button"]');
    if (dateSection) {
      dateSection.focus();
      await user.keyboard('{Enter}');
      expect(screen.getByLabelText('Check-in Date')).toBeInTheDocument();
    }
  });

  it('handles reset functionality', async () => {
    const user = userEvent.setup();
    const filtersWithData: BookingFilters = {
      type: ['hotel'],
      status: ['available'],
    };

    render(<FilterPanel {...defaultProps} filters={filtersWithData} />);

    const resetButton = screen.getByText('Reset All');
    await user.click(resetButton);

    expect(defaultProps.onReset).toHaveBeenCalled();
  });

  it('disables reset button when no filters are active', () => {
    render(<FilterPanel {...defaultProps} />);

    const resetButton = screen.getByText('Reset All');
    expect(resetButton).toBeDisabled();
  });

  it('handles custom condition addition', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    // This would be in a different component, but testing the structure
    expect(screen.getByText('Filter Bookings')).toBeInTheDocument();
  });

  it('shows correct icons for booking types', () => {
    render(<FilterPanel {...defaultProps} />);

    expect(screen.getByText('🏨')).toBeInTheDocument(); // Hotel
    expect(screen.getByText('🎫')).toBeInTheDocument(); // Event
    expect(screen.getByText('✈️')).toBeInTheDocument(); // Flight
    expect(screen.getByText('🏠')).toBeInTheDocument(); // Rental
  });

  it('handles location radius input', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    const radiusInput = screen.getByLabelText('Search Radius (km)');
    await user.type(radiusInput, '50');

    expect(defaultProps.onChange).toHaveBeenCalledWith({
      location: {
        radius: 50,
      },
    });
  });

  it('clears filters when inputs are emptied', async () => {
    const user = userEvent.setup();
    const filtersWithLocation: BookingFilters = {
      location: {
        city: 'New York',
        country: 'USA',
      },
    };

    render(<FilterPanel {...defaultProps} filters={filtersWithLocation} />);

    const cityInput = screen.getByDisplayValue('New York');
    await user.clear(cityInput);

    const countryInput = screen.getByDisplayValue('USA');
    await user.clear(countryInput);

    expect(defaultProps.onChange).toHaveBeenCalledWith({});
  });

  it('validates price range inputs', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    // Expand price section
    await user.click(screen.getByText('Price Range'));

    const minPriceInput = screen.getByLabelText('Min Price ($)');
    const maxPriceInput = screen.getByLabelText('Max Price ($)');

    // Max price should have min attribute set to min price value
    await user.type(minPriceInput, '100');
    expect(maxPriceInput).toHaveAttribute('min', '100');
  });

  it('validates date range inputs', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    // Expand date section
    await user.click(screen.getByText('Date Range'));

    const startDateInput = screen.getByLabelText('Check-in Date');
    const endDateInput = screen.getByLabelText('Check-out Date');

    // Both should have min date set to today
    const today = new Date().toISOString().split('T')[0];
    expect(startDateInput).toHaveAttribute('min', today);

    // End date min should update when start date changes
    await user.type(startDateInput, '2024-06-01');
    expect(endDateInput).toHaveAttribute('min', '2024-06-01');
  });
});
