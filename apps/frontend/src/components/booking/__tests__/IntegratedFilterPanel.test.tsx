import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntegratedFilterPanel, EnhancedBookingFilters } from '../IntegratedFilterPanel';

// Mock the UI components
jest.mock('@/components/ui', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Input: ({ label, value, onChange, placeholder, type, ...props }: any) => (
    <div>
      <label>{label}</label>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        {...props}
      />
    </div>
  ),
}));

// Mock design tokens
jest.mock('@/design-system/tokens', () => ({
  tokens: {
    colors: {
      neutral: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        900: '#111827',
      },
      primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        600: '#2563eb',
        700: '#1d4ed8',
      },
      success: {
        50: '#f0fdf4',
        200: '#bbf7d0',
        500: '#22c55e',
      },
      warning: {
        50: '#fffbeb',
        200: '#fed7aa',
        500: '#f59e0b',
      },
      error: {
        500: '#ef4444',
      },
    },
    spacing: {
      1: '0.25rem',
      2: '0.5rem',
      3: '0.75rem',
      4: '1rem',
      6: '1.5rem',
    },
    borderRadius: {
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      full: '9999px',
    },
    typography: {
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        lg: '1.125rem',
        xl: '1.25rem',
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
      },
    },
  },
}));

describe('IntegratedFilterPanel', () => {
  const defaultFilters: EnhancedBookingFilters = {};
  const mockOnChange = jest.fn();
  const mockOnReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (filters: EnhancedBookingFilters = defaultFilters) => {
    return render(
      <IntegratedFilterPanel
        filters={filters}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    );
  };

  describe('Basic Rendering', () => {
    it('should render the filter panel with all sections', () => {
      renderComponent();

      expect(screen.getByText('Filter Bookings')).toBeInTheDocument();
      expect(screen.getByText('Swap Filters')).toBeInTheDocument();
      expect(screen.getByText('Booking Type')).toBeInTheDocument();
      expect(screen.getByText('Location')).toBeInTheDocument();
      expect(screen.getByText('Date Range')).toBeInTheDocument();
      expect(screen.getByText('Price Range')).toBeInTheDocument();
      expect(screen.getByText('Booking Status')).toBeInTheDocument();
      expect(screen.getByText('Verification Status')).toBeInTheDocument();
    });

    it('should show reset button', () => {
      renderComponent();
      expect(screen.getByText('Reset All')).toBeInTheDocument();
    });

    it('should show filter summary', () => {
      renderComponent();
      expect(screen.getByText('No filters applied')).toBeInTheDocument();
    });
  });

  describe('Swap Filters', () => {
    it('should render swap availability toggle', () => {
      renderComponent();
      expect(screen.getByText('Available for swapping')).toBeInTheDocument();
    });

    it('should render cash acceptance toggle', () => {
      renderComponent();
      expect(screen.getByText('Accepts cash offers')).toBeInTheDocument();
    });

    it('should render auction mode toggle', () => {
      renderComponent();
      expect(screen.getByText('Auction mode active')).toBeInTheDocument();
    });

    it('should handle swap availability toggle change', async () => {
      const user = userEvent.setup();
      renderComponent();

      const swapToggle = screen.getByLabelText('Available for swapping');
      await user.click(swapToggle);

      expect(mockOnChange).toHaveBeenCalledWith({
        swapAvailable: true,
      });
    });

    it('should handle cash acceptance toggle change', async () => {
      const user = userEvent.setup();
      renderComponent();

      const cashToggle = screen.getByLabelText('Accepts cash offers');
      await user.click(cashToggle);

      expect(mockOnChange).toHaveBeenCalledWith({
        acceptsCash: true,
      });
    });

    it('should handle auction mode toggle change', async () => {
      const user = userEvent.setup();
      renderComponent();

      const auctionToggle = screen.getByLabelText('Auction mode active');
      await user.click(auctionToggle);

      expect(mockOnChange).toHaveBeenCalledWith({
        auctionMode: true,
      });
    });

    it('should show checked state for active swap filters', () => {
      const filtersWithSwap: EnhancedBookingFilters = {
        swapAvailable: true,
        acceptsCash: true,
        auctionMode: true,
      };

      renderComponent(filtersWithSwap);

      expect(screen.getByLabelText('Available for swapping')).toBeChecked();
      expect(screen.getByLabelText('Accepts cash offers')).toBeChecked();
      expect(screen.getByLabelText('Auction mode active')).toBeChecked();
    });
  });

  describe('Booking Type Filters', () => {
    it('should render all booking type options', () => {
      renderComponent();

      expect(screen.getByText('Hotel')).toBeInTheDocument();
      expect(screen.getByText('Event')).toBeInTheDocument();
      expect(screen.getByText('Flight')).toBeInTheDocument();
      expect(screen.getByText('Rental')).toBeInTheDocument();
    });

    it('should handle booking type selection', async () => {
      const user = userEvent.setup();
      renderComponent();

      const hotelCheckbox = screen.getByLabelText('Hotel');
      await user.click(hotelCheckbox);

      expect(mockOnChange).toHaveBeenCalledWith({
        type: ['hotel'],
      });
    });

    it('should handle multiple booking type selections', async () => {
      const user = userEvent.setup();
      const filtersWithType: EnhancedBookingFilters = {
        type: ['hotel'],
      };
      renderComponent(filtersWithType);

      const eventCheckbox = screen.getByLabelText('Event');
      await user.click(eventCheckbox);

      expect(mockOnChange).toHaveBeenCalledWith({
        type: ['hotel', 'event'],
      });
    });

    it('should handle booking type deselection', async () => {
      const user = userEvent.setup();
      const filtersWithType: EnhancedBookingFilters = {
        type: ['hotel', 'event'],
      };
      renderComponent(filtersWithType);

      const hotelCheckbox = screen.getByLabelText('Hotel');
      await user.click(hotelCheckbox);

      expect(mockOnChange).toHaveBeenCalledWith({
        type: ['event'],
      });
    });
  });

  describe('Location Filters', () => {
    it('should render location input fields', () => {
      renderComponent();

      expect(screen.getByLabelText('City')).toBeInTheDocument();
      expect(screen.getByLabelText('Country')).toBeInTheDocument();
      expect(screen.getByLabelText('Search Radius (km)')).toBeInTheDocument();
    });

    it('should handle city input change', async () => {
      const user = userEvent.setup();
      renderComponent();

      const cityInput = screen.getByLabelText('City');
      await user.type(cityInput, 'New York');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          location: {
            city: 'New York',
            country: undefined,
            radius: undefined,
          },
        });
      });
    });

    it('should handle country input change', async () => {
      const user = userEvent.setup();
      renderComponent();

      const countryInput = screen.getByLabelText('Country');
      await user.type(countryInput, 'United States');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          location: {
            city: undefined,
            country: 'United States',
            radius: undefined,
          },
        });
      });
    });

    it('should handle radius input change', async () => {
      const user = userEvent.setup();
      renderComponent();

      const radiusInput = screen.getByLabelText('Search Radius (km)');
      await user.type(radiusInput, '50');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          location: {
            city: undefined,
            country: undefined,
            radius: 50,
          },
        });
      });
    });
  });

  describe('Date Range Filters', () => {
    it('should render date input fields', () => {
      renderComponent();

      expect(screen.getByLabelText('Check-in Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Check-out Date')).toBeInTheDocument();
    });

    it('should handle date range input changes', async () => {
      const user = userEvent.setup();
      renderComponent();

      const startDateInput = screen.getByLabelText('Check-in Date');
      const endDateInput = screen.getByLabelText('Check-out Date');

      await user.type(startDateInput, '2024-12-01');
      await user.type(endDateInput, '2024-12-05');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          dateRange: {
            start: new Date('2024-12-01'),
            end: new Date('2024-12-05'),
            flexible: false,
          },
        });
      });
    });

    it('should handle flexible dates checkbox', async () => {
      const user = userEvent.setup();
      const filtersWithDates: EnhancedBookingFilters = {
        dateRange: {
          start: new Date('2024-12-01'),
          end: new Date('2024-12-05'),
          flexible: false,
        },
      };
      renderComponent(filtersWithDates);

      const flexibleCheckbox = screen.getByLabelText(
        'Flexible dates (allow overlapping bookings)'
      );
      await user.click(flexibleCheckbox);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          dateRange: {
            start: new Date('2024-12-01'),
            end: new Date('2024-12-05'),
            flexible: true,
          },
        });
      });
    });
  });

  describe('Price Range Filters', () => {
    it('should render price input fields', () => {
      renderComponent();

      expect(screen.getByLabelText('Min Price ($)')).toBeInTheDocument();
      expect(screen.getByLabelText('Max Price ($)')).toBeInTheDocument();
    });

    it('should handle price range input changes', async () => {
      const user = userEvent.setup();
      renderComponent();

      const minPriceInput = screen.getByLabelText('Min Price ($)');
      const maxPriceInput = screen.getByLabelText('Max Price ($)');

      await user.type(minPriceInput, '100');
      await user.type(maxPriceInput, '500');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          priceRange: {
            min: 500, // This will be the final value after typing both
            max: 500,
          },
        });
      });
    });
  });

  describe('Status Filters', () => {
    it('should render booking status options', () => {
      renderComponent();

      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.getByText('Locked')).toBeInTheDocument();
      expect(screen.getByText('Swapped')).toBeInTheDocument();
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });

    it('should handle status selection', async () => {
      const user = userEvent.setup();
      renderComponent();

      const availableCheckbox = screen.getByLabelText('Available');
      await user.click(availableCheckbox);

      expect(mockOnChange).toHaveBeenCalledWith({
        status: ['available'],
      });
    });
  });

  describe('Verification Status Filters', () => {
    it('should render verification status options', () => {
      renderComponent();

      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('should handle verification status selection', async () => {
      const user = userEvent.setup();
      renderComponent();

      const verifiedCheckbox = screen.getByLabelText('Verified');
      await user.click(verifiedCheckbox);

      expect(mockOnChange).toHaveBeenCalledWith({
        verificationStatus: ['verified'],
      });
    });
  });

  describe('Filter Summary', () => {
    it('should show active filter count in header', () => {
      const filtersWithMultiple: EnhancedBookingFilters = {
        type: ['hotel', 'event'],
        swapAvailable: true,
        acceptsCash: true,
      };

      renderComponent(filtersWithMultiple);

      expect(screen.getByText('4 active')).toBeInTheDocument();
    });

    it('should show detailed filter summary', () => {
      const filtersWithMultiple: EnhancedBookingFilters = {
        type: ['hotel'],
        swapAvailable: true,
        location: { city: 'New York' },
      };

      renderComponent(filtersWithMultiple);

      expect(screen.getByText('3 filters active:')).toBeInTheDocument();
      expect(screen.getByText('1 type')).toBeInTheDocument();
      expect(screen.getByText('location')).toBeInTheDocument();
      expect(screen.getByText('swap available')).toBeInTheDocument();
    });

    it('should show no filters message when no filters are active', () => {
      renderComponent();
      expect(screen.getByText('No filters applied')).toBeInTheDocument();
    });
  });

  describe('Section Expansion', () => {
    it('should toggle section expansion on header click', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Swap section should be expanded by default
      expect(screen.getByText('Available for swapping')).toBeInTheDocument();

      // Click to collapse
      const swapHeader = screen.getByText('Swap Filters');
      await user.click(swapHeader);

      // Should be collapsed (content not visible)
      expect(screen.queryByText('Available for swapping')).not.toBeInTheDocument();
    });

    it('should handle keyboard navigation for section headers', async () => {
      renderComponent();

      const swapHeader = screen.getByText('Swap Filters');
      
      // Focus and press Enter
      swapHeader.focus();
      fireEvent.keyDown(swapHeader, { key: 'Enter' });

      // Should toggle the section
      expect(screen.queryByText('Available for swapping')).not.toBeInTheDocument();
    });
  });

  describe('Reset Functionality', () => {
    it('should call onReset when reset button is clicked', async () => {
      const user = userEvent.setup();
      const filtersWithData: EnhancedBookingFilters = {
        type: ['hotel'],
        swapAvailable: true,
      };

      renderComponent(filtersWithData);

      const resetButton = screen.getByText('Reset All');
      await user.click(resetButton);

      expect(mockOnReset).toHaveBeenCalled();
    });

    it('should disable reset button when no filters are active', () => {
      renderComponent();

      const resetButton = screen.getByText('Reset All');
      expect(resetButton).toBeDisabled();
    });

    it('should enable reset button when filters are active', () => {
      const filtersWithData: EnhancedBookingFilters = {
        swapAvailable: true,
      };

      renderComponent(filtersWithData);

      const resetButton = screen.getByText('Reset All');
      expect(resetButton).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderComponent();

      const swapHeader = screen.getByText('Swap Filters');
      expect(swapHeader.closest('div')).toHaveAttribute('role', 'button');
      expect(swapHeader.closest('div')).toHaveAttribute('tabIndex', '0');
    });

    it('should support keyboard navigation', () => {
      renderComponent();

      const swapHeader = screen.getByText('Swap Filters');
      const headerElement = swapHeader.closest('div');
      
      expect(headerElement).toHaveAttribute('tabIndex', '0');
      
      // Test space key
      fireEvent.keyDown(headerElement!, { key: ' ' });
      expect(screen.queryByText('Available for swapping')).not.toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should handle complex filter combinations', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Enable multiple filters
      await user.click(screen.getByLabelText('Available for swapping'));
      await user.click(screen.getByLabelText('Hotel'));
      
      const cityInput = screen.getByLabelText('City');
      await user.type(cityInput, 'Paris');

      // Should have called onChange multiple times with cumulative filters
      expect(mockOnChange).toHaveBeenCalledWith({
        swapAvailable: true,
      });

      expect(mockOnChange).toHaveBeenCalledWith({
        swapAvailable: true,
        type: ['hotel'],
      });
    });

    it('should preserve existing filters when adding new ones', async () => {
      const user = userEvent.setup();
      const existingFilters: EnhancedBookingFilters = {
        type: ['hotel'],
        swapAvailable: true,
      };

      renderComponent(existingFilters);

      await user.click(screen.getByLabelText('Accepts cash offers'));

      expect(mockOnChange).toHaveBeenCalledWith({
        type: ['hotel'],
        swapAvailable: true,
        acceptsCash: true,
      });
    });
  });
});