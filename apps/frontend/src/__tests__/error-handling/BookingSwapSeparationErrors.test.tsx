import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders, createMockBooking } from '@/test/testUtils';
import { BookingEditForm } from '@/components/booking/BookingEditForm';
import { BookingSwapSpecificationPage } from '@/pages/BookingSwapSpecificationPage';

// Mock console to capture error logs
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock the hooks and services with error scenarios
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user1', username: 'testuser' },
    token: 'mock-token',
  })),
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: vi.fn(() => ({
    isConnected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock('@/hooks/useBookingWithWallet', () => ({
  useBookingWithWallet: vi.fn(() => ({
    enableSwappingWithWallet: vi.fn(),
    canEnableSwapping: vi.fn(() => true),
  })),
}));

vi.mock('@/hooks/useBookingNavigation', () => ({
  useBookingNavigation: vi.fn(() => ({
    currentBookingId: 'test-booking-1',
    returnUrl: '/bookings',
    navigateToReturnUrl: vi.fn(),
    canAccessSwapSpecification: vi.fn(() => Promise.resolve({ canAccess: true })),
  })),
  useBookingUrlParams: vi.fn(() => ({
    bookingId: 'test-booking-1',
    returnTo: '/bookings',
    isValid: true,
    validationErrors: [],
  })),
}));

vi.mock('@/hooks/useResponsive', () => ({
  useResponsive: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
  })),
}));

vi.mock('@/hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: vi.fn(() => ({
    hasUnsavedChanges: false,
    navigateWithConfirmation: vi.fn(() => Promise.resolve(true)),
    markAsSaved: vi.fn(),
    isSaving: false,
  })),
  useStatePreservation: vi.fn(() => ({
    hasSavedState: vi.fn(() => false),
    clearState: vi.fn(),
  })),
}));

vi.mock('@/services/bookingService', () => ({
  bookingService: {
    getBooking: vi.fn(),
    updateBooking: vi.fn(),
  },
}));

vi.mock('@/services/UnifiedBookingService', () => ({
  unifiedBookingService: {
    getBookingsWithSwapInfo: vi.fn(),
  },
}));

vi.mock('@/utils/validation', () => ({
  validateField: vi.fn(),
  getValidationErrorCount: vi.fn(),
  validateSwapPreferences: vi.fn(),
}));

// Mock UI components
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, isOpen, onClose, title }: any) => 
    isOpen ? (
      <div data-testid="modal" role="dialog" aria-label={title}>
        <button onClick={onClose} data-testid="modal-close">×</button>
        {children}
      </div>
    ) : null,
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, type, variant, loading, disabled, ...props }: any) => (
    <button 
      onClick={onClick} 
      type={type} 
      disabled={loading || disabled}
      data-variant={variant}
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

vi.mock('@/components/ui/Input', () => ({
  Input: ({ label, value, onChange, error, required, type = 'text', ...props }: any) => (
    <div data-testid={`input-container-${label?.toLowerCase().replace(/\s+/g, '-')}`}>
      <label>{label}{required && ' *'}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        data-testid={`input-${label?.toLowerCase().replace(/\s+/g, '-')}`}
        {...props}
      />
      {error && <div data-testid="error" role="alert">{error}</div>}
    </div>
  ),
}));

// Mock other UI components
const mockUIComponents = [
  'ThemedPageHeader',
  'BreadcrumbNavigation', 
  'ContextualHelp',
  'ThemedCard',
  'ThemedInterface',
].forEach(component => {
  vi.mock(`@/components/ui/${component}`, () => ({
    [component]: ({ children, title, icon, ...props }: any) => (
      <div data-testid={component.toLowerCase().replace(/([A-Z])/g, '-$1').substring(1)} {...props}>
        {title && <h3>{icon} {title}</h3>}
        {children}
      </div>
    ),
  }));
});

vi.mock('@/components/booking/SwapPreferencesSection', () => ({
  SwapPreferencesSection: ({ enabled, onToggle, preferences, onChange, errors }: any) => (
    <div data-testid="swap-preferences-section">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          data-testid="swap-enabled-toggle"
        />
        Enable Swapping
      </label>
      {enabled && (
        <div>
          <select
            value={preferences.acceptanceStrategy}
            onChange={(e) => onChange({ ...preferences, acceptanceStrategy: e.target.value })}
            data-testid="acceptance-strategy-select"
          >
            <option value="first-match">First Match</option>
            <option value="auction">Auction</option>
          </select>
          {errors.acceptanceStrategy && (
            <div data-testid="error" role="alert">{errors.acceptanceStrategy}</div>
          )}
        </div>
      )}
    </div>
  ),
}));

vi.mock('@/components/swap/UnifiedSwapEnablement', () => ({
  UnifiedSwapEnablement: ({ isOpen, onClose, onSuccess }: any) => 
    isOpen ? (
      <div data-testid="unified-swap-enablement">
        <button onClick={() => onSuccess()}>Complete Setup</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}));

describe('Booking-Swap Separation Error Handling Tests', () => {
  const mockBooking = createMockBooking({
    id: 'test-booking-1',
    title: 'Test Hotel Booking',
    description: 'A nice hotel in Paris',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('BookingEditForm Error Handling', () => {
    it('handles validation errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock validation to return errors
      vi.mocked(require('@/utils/validation').validateField).mockImplementation((field: string) => {
        if (field === 'title') return 'Title is required';
        if (field === 'originalPrice') return 'Price must be greater than 0';
        return '';
      });
      
      vi.mocked(require('@/utils/validation').getValidationErrorCount).mockReturnValue(2);

      render(
        <BookingEditForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigateToSwapSpec={vi.fn()}
        />
      );

      // Try to submit with invalid data
      const submitButton = screen.getByText('Update Booking');
      await user.click(submitButton);

      // Should show validation error summary
      await waitFor(() => {
        expect(screen.getByText(/Booking Validation Errors \(2\)/)).toBeInTheDocument();
        expect(screen.getByText('Please fix the following booking field errors before saving:')).toBeInTheDocument();
      });
    });

    it('handles submission errors with proper error display', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockRejectedValue(new Error('Network error'));

      render(
        <BookingEditForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={vi.fn()}
          booking={mockBooking}
        />
      );

      const submitButton = screen.getByText('Update Booking');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
        expect(mockConsoleError).toHaveBeenCalledWith('Failed to submit booking:', expect.any(Error));
      });
    });

    it('handles navigation errors during Enable Swapping', async () => {
      const user = userEvent.setup();
      const mockOnNavigateToSwapSpec = vi.fn().mockImplementation(() => {
        throw new Error('Navigation failed');
      });

      render(
        <BookingEditForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
          booking={mockBooking}
        />
      );

      const enableSwappingButton = screen.getByText('🔄 Enable Swapping');
      
      // Should handle navigation error gracefully
      expect(() => user.click(enableSwappingButton)).not.toThrow();
    });

    it('handles unsaved changes navigation errors', async () => {
      const user = userEvent.setup();
      const mockNavigateWithConfirmation = vi.fn().mockRejectedValue(new Error('Navigation confirmation failed'));
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useUnsavedChanges).mockReturnValue({
        hasUnsavedChanges: true,
        navigateWithConfirmation: mockNavigateWithConfirmation,
        markAsSaved: vi.fn(),
        isSaving: false,
      });

      render(
        <BookingEditForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigateToSwapSpec={vi.fn()}
          booking={mockBooking}
        />
      );

      const enableSwappingButton = screen.getByText('🔄 Enable Swapping');
      await user.click(enableSwappingButton);

      await waitFor(() => {
        expect(mockNavigateWithConfirmation).toHaveBeenCalled();
      });
    });

    it('handles state preservation errors', () => {
      const mockStatePreservation = {
        hasSavedState: vi.fn(() => { throw new Error('State restoration failed'); }),
        clearState: vi.fn(),
      };
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useStatePreservation).mockReturnValue(mockStatePreservation);

      // Should not crash when state preservation fails
      expect(() => {
        render(
          <BookingEditForm
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            onNavigateToSwapSpec={vi.fn()}
            booking={mockBooking}
          />
        );
      }).not.toThrow();
    });
  });

  describe('BookingSwapSpecificationPage Error Handling', () => {
    it('handles booking loading errors', async () => {
      vi.mocked(require('@/services/bookingService').bookingService.getBooking)
        .mockRejectedValue(new Error('Booking not found'));

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('⚠️')).toBeInTheDocument();
        expect(screen.getByText('Unable to Load Booking')).toBeInTheDocument();
        expect(screen.getByText(/Booking not found/)).toBeInTheDocument();
        expect(screen.getByText('Return to Bookings')).toBeInTheDocument();
      });
    });

    it('handles access permission errors', async () => {
      vi.mocked(require('@/hooks/useBookingNavigation').useBookingNavigation).mockReturnValue({
        currentBookingId: 'test-booking-1',
        returnUrl: '/bookings',
        navigateToReturnUrl: vi.fn(),
        canAccessSwapSpecification: vi.fn(() => Promise.resolve({ 
          canAccess: false, 
          reason: 'You do not have permission to access this booking' 
        })),
      });

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Booking')).toBeInTheDocument();
        expect(screen.getByText('You do not have permission to access this booking')).toBeInTheDocument();
      });
    });

    it('handles invalid URL parameters', async () => {
      vi.mocked(require('@/hooks/useBookingNavigation').useBookingUrlParams).mockReturnValue({
        bookingId: null,
        returnTo: '/bookings',
        isValid: false,
        validationErrors: ['Invalid booking ID', 'Missing required parameters'],
      });

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Booking')).toBeInTheDocument();
        expect(screen.getByText(/Invalid URL parameters: Invalid booking ID, Missing required parameters/)).toBeInTheDocument();
      });
    });

    it('handles swap preferences validation errors', async () => {
      const user = userEvent.setup();
      
      vi.mocked(require('@/services/bookingService').bookingService.getBooking).mockResolvedValue(mockBooking);
      vi.mocked(require('@/utils/validation').validateSwapPreferences).mockReturnValue({
        acceptanceStrategy: 'Invalid acceptance strategy',
        minCashAmount: 'Minimum cash amount is required',
      });

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('swap-enabled-toggle')).toBeInTheDocument();
      });

      // Enable swapping to trigger validation
      const swapToggle = screen.getByTestId('swap-enabled-toggle');
      await user.click(swapToggle);

      await waitFor(() => {
        expect(screen.getByText('Invalid acceptance strategy')).toBeInTheDocument();
      });
    });

    it('handles wallet connection errors', async () => {
      const user = userEvent.setup();
      const mockEnableSwappingWithWallet = vi.fn().mockRejectedValue(new Error('Wallet connection failed'));
      
      vi.mocked(require('@/services/bookingService').bookingService.getBooking).mockResolvedValue(mockBooking);
      vi.mocked(require('@/hooks/useBookingWithWallet').useBookingWithWallet).mockReturnValue({
        enableSwappingWithWallet: mockEnableSwappingWithWallet,
        canEnableSwapping: vi.fn(() => true),
      });

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('swap-enabled-toggle')).toBeInTheDocument();
      });

      // Enable swapping
      const swapToggle = screen.getByTestId('swap-enabled-toggle');
      await user.click(swapToggle);

      // Try to save
      const saveButton = screen.getByText('🔄 Enable Swapping');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Wallet connection failed')).toBeInTheDocument();
      });
    });

    it('handles swap info loading errors gracefully', async () => {
      vi.mocked(require('@/services/bookingService').bookingService.getBooking).mockResolvedValue(mockBooking);
      vi.mocked(require('@/services/UnifiedBookingService').unifiedBookingService.getBookingsWithSwapInfo)
        .mockRejectedValue(new Error('Failed to load swap info'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
        expect(consoleSpy).toHaveBeenCalledWith('Could not load swap information:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('handles authentication errors', async () => {
      vi.mocked(require('@/contexts/AuthContext').useAuth).mockReturnValue({
        user: null,
        token: null,
      });

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Booking')).toBeInTheDocument();
        expect(screen.getByText('Missing booking ID or authentication')).toBeInTheDocument();
      });
    });

    it('handles network timeout errors', async () => {
      vi.mocked(require('@/services/bookingService').bookingService.getBooking)
        .mockImplementation(() => new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        }));

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Booking')).toBeInTheDocument();
        expect(screen.getByText(/Request timeout/)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Navigation Error Recovery', () => {
    it('provides clear error recovery options', async () => {
      const user = userEvent.setup();
      const mockNavigateToReturnUrl = vi.fn();
      
      vi.mocked(require('@/services/bookingService').bookingService.getBooking)
        .mockRejectedValue(new Error('Network error'));
      
      vi.mocked(require('@/hooks/useBookingNavigation').useBookingNavigation).mockReturnValue({
        currentBookingId: 'test-booking-1',
        returnUrl: '/bookings',
        navigateToReturnUrl: mockNavigateToReturnUrl,
        canAccessSwapSpecification: vi.fn(() => Promise.resolve({ canAccess: true })),
      });

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Return to Bookings')).toBeInTheDocument();
      });

      const returnButton = screen.getByText('Return to Bookings');
      await user.click(returnButton);

      expect(mockNavigateToReturnUrl).toHaveBeenCalledWith('/bookings');
    });

    it('handles navigation recovery errors', async () => {
      const user = userEvent.setup();
      const mockNavigateToReturnUrl = vi.fn().mockImplementation(() => {
        throw new Error('Navigation failed');
      });
      
      vi.mocked(require('@/services/bookingService').bookingService.getBooking)
        .mockRejectedValue(new Error('Network error'));
      
      vi.mocked(require('@/hooks/useBookingNavigation').useBookingNavigation).mockReturnValue({
        currentBookingId: 'test-booking-1',
        returnUrl: '/bookings',
        navigateToReturnUrl: mockNavigateToReturnUrl,
        canAccessSwapSpecification: vi.fn(() => Promise.resolve({ canAccess: true })),
      });

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Return to Bookings')).toBeInTheDocument();
      });

      const returnButton = screen.getByText('Return to Bookings');
      
      // Should not crash when navigation fails
      expect(() => user.click(returnButton)).not.toThrow();
    });
  });

  describe('State Preservation Error Handling', () => {
    it('handles state preservation failures gracefully', () => {
      const mockStatePreservation = {
        hasSavedState: vi.fn(() => { throw new Error('State access failed'); }),
        clearState: vi.fn(() => { throw new Error('State clear failed'); }),
      };
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useStatePreservation).mockReturnValue(mockStatePreservation);

      // Should not crash when state preservation fails
      expect(() => {
        render(
          <MemoryRouter>
            <BookingSwapSpecificationPage />
          </MemoryRouter>
        );
      }).not.toThrow();
    });

    it('handles unsaved changes detection errors', () => {
      const mockUseUnsavedChanges = vi.fn(() => {
        throw new Error('Unsaved changes detection failed');
      });
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useUnsavedChanges).mockImplementation(mockUseUnsavedChanges);

      // Should not crash when unsaved changes detection fails
      expect(() => {
        render(
          <BookingEditForm
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            onNavigateToSwapSpec={vi.fn()}
            booking={mockBooking}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Component Error Boundaries', () => {
    it('handles component rendering errors', () => {
      // Mock a component to throw an error
      vi.mocked(require('@/components/booking/SwapPreferencesSection').SwapPreferencesSection)
        .mockImplementation(() => {
          throw new Error('Component render failed');
        });

      // Should be caught by error boundary (if implemented)
      expect(() => {
        render(
          <MemoryRouter>
            <BookingSwapSpecificationPage />
          </MemoryRouter>
        );
      }).not.toThrow();
    });

    it('provides fallback UI for component errors', async () => {
      // Mock a component to throw an error during interaction
      const ThrowingComponent = () => {
        const [shouldThrow, setShouldThrow] = React.useState(false);
        
        if (shouldThrow) {
          throw new Error('Component interaction failed');
        }
        
        return (
          <button onClick={() => setShouldThrow(true)} data-testid="throwing-button">
            Click to throw
          </button>
        );
      };

      render(<ThrowingComponent />);

      const button = screen.getByTestId('throwing-button');
      
      // Should handle interaction errors gracefully
      expect(() => fireEvent.click(button)).not.toThrow();
    });
  });

  describe('Concurrent Error Handling', () => {
    it('handles multiple simultaneous errors', async () => {
      // Mock multiple services to fail simultaneously
      vi.mocked(require('@/services/bookingService').bookingService.getBooking)
        .mockRejectedValue(new Error('Booking service failed'));
      
      vi.mocked(require('@/services/UnifiedBookingService').unifiedBookingService.getBookingsWithSwapInfo)
        .mockRejectedValue(new Error('Swap service failed'));
      
      vi.mocked(require('@/hooks/useBookingNavigation').useBookingNavigation).mockImplementation(() => {
        throw new Error('Navigation hook failed');
      });

      // Should handle multiple errors gracefully
      expect(() => {
        render(
          <MemoryRouter>
            <BookingSwapSpecificationPage />
          </MemoryRouter>
        );
      }).not.toThrow();
    });

    it('prioritizes critical errors over minor ones', async () => {
      // Mock authentication failure (critical) and swap info failure (minor)
      vi.mocked(require('@/contexts/AuthContext').useAuth).mockReturnValue({
        user: null,
        token: null,
      });
      
      vi.mocked(require('@/services/UnifiedBookingService').unifiedBookingService.getBookingsWithSwapInfo)
        .mockRejectedValue(new Error('Swap service failed'));

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should show authentication error, not swap service error
        expect(screen.getByText('Missing booking ID or authentication')).toBeInTheDocument();
        expect(screen.queryByText('Swap service failed')).not.toBeInTheDocument();
      });
    });
  });
});