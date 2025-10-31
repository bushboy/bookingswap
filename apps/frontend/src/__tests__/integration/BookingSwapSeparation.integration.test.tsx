import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders, createMockBooking } from '@/test/testUtils';
import { BookingEditForm } from '@/components/booking/BookingEditForm';
import { BookingSwapSpecificationPage } from '@/pages/BookingSwapSpecificationPage';
import { BookingCard } from '@/components/booking/BookingCard';

// Mock the navigation hooks
const mockNavigate = vi.fn();
const mockNavigateToReturnUrl = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ bookingId: 'test-booking-1' }),
    useLocation: () => ({ search: '?returnTo=/bookings' }),
  };
});

vi.mock('@/hooks/useBookingNavigation', () => ({
  useBookingNavigation: () => ({
    currentBookingId: 'test-booking-1',
    returnUrl: '/bookings',
    navigateToReturnUrl: mockNavigateToReturnUrl,
    canAccessSwapSpecification: vi.fn(() => Promise.resolve({ canAccess: true })),
  }),
  useBookingUrlParams: () => ({
    bookingId: 'test-booking-1',
    returnTo: '/bookings',
    isValid: true,
    validationErrors: [],
  }),
}));

// Mock other required hooks and services
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user1', username: 'testuser' },
    token: 'mock-token',
  }),
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({
    isConnected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

vi.mock('@/hooks/useBookingWithWallet', () => ({
  useBookingWithWallet: () => ({
    enableSwappingWithWallet: vi.fn(),
    canEnableSwapping: () => true,
  }),
}));

vi.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: false,
    isTablet: false,
  }),
}));

vi.mock('@/services/bookingService', () => ({
  bookingService: {
    getBooking: vi.fn(),
    updateBooking: vi.fn(),
  },
}));

vi.mock('@/services/UnifiedBookingService', () => ({
  unifiedBookingService: {
    getBookingsWithSwapInfo: vi.fn(() => Promise.resolve([])),
  },
}));

// Mock UI components with more realistic behavior
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
  SwapPreferencesSection: ({ enabled, onToggle, preferences, onChange }: any) => (
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
        <select
          value={preferences.acceptanceStrategy}
          onChange={(e) => onChange({ ...preferences, acceptanceStrategy: e.target.value })}
          data-testid="acceptance-strategy-select"
        >
          <option value="first-match">First Match</option>
          <option value="auction">Auction</option>
        </select>
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

describe('Booking-Swap Separation Integration Tests', () => {
  const mockBooking = createMockBooking({
    id: 'test-booking-1',
    title: 'Test Hotel Booking',
    description: 'A nice hotel in Paris',
    location: { city: 'Paris', country: 'France' },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(require('@/services/bookingService').bookingService.getBooking).mockResolvedValue(mockBooking);
  });

  describe('Navigation Between Separated Interfaces', () => {
    it('navigates from booking edit to swap specification', async () => {
      const user = userEvent.setup();
      const mockOnNavigateToSwapSpec = vi.fn();

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
      await user.click(enableSwappingButton);

      expect(mockOnNavigateToSwapSpec).toHaveBeenCalledWith(mockBooking, false);
    });

    it('navigates back from swap specification to bookings', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('← Back to Bookings')).toBeInTheDocument();
      });

      const backButton = screen.getByText('← Back to Bookings');
      await user.click(backButton);

      expect(mockNavigateToReturnUrl).toHaveBeenCalledWith('/bookings');
    });

    it('preserves booking context when navigating to swap specification', async () => {
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('📋 Booking Context')).toBeInTheDocument();
        expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
        expect(screen.getByText('A nice hotel in Paris')).toBeInTheDocument();
      });
    });

    it('handles URL-based navigation to swap specification', async () => {
      render(
        <MemoryRouter initialEntries={['/bookings/test-booking-1/swap-specification']}>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Swap Specification')).toBeInTheDocument();
        expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
      });
    });
  });

  describe('State Preservation During Navigation', () => {
    it('preserves unsaved booking changes when navigating to swap specification', async () => {
      const user = userEvent.setup();
      const mockOnNavigateToSwapSpec = vi.fn();

      // Mock unsaved changes
      const mockUseUnsavedChanges = vi.fn(() => ({
        hasUnsavedChanges: true,
        navigateWithConfirmation: vi.fn(() => Promise.resolve(true)),
        markAsSaved: vi.fn(),
        isSaving: false,
      }));
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useUnsavedChanges).mockImplementation(mockUseUnsavedChanges);

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
      await user.click(enableSwappingButton);

      // Should call navigation with unsaved changes flag
      expect(mockOnNavigateToSwapSpec).toHaveBeenCalledWith(mockBooking, true);
    });

    it('preserves swap preferences when navigating back to bookings', async () => {
      const user = userEvent.setup();

      // Mock unsaved changes in swap preferences
      const mockUseUnsavedChanges = vi.fn(() => ({
        hasUnsavedChanges: true,
        navigateWithConfirmation: vi.fn(() => Promise.resolve(true)),
        markAsSaved: vi.fn(),
        isSaving: false,
      }));
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useUnsavedChanges).mockImplementation(mockUseUnsavedChanges);

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('← Back to Bookings')).toBeInTheDocument();
      });

      const backButton = screen.getByText('← Back to Bookings');
      await user.click(backButton);

      // Should prompt for unsaved changes
      const mockNavigateWithConfirmation = mockUseUnsavedChanges().navigateWithConfirmation;
      expect(mockNavigateWithConfirmation).toHaveBeenCalledWith('/bookings');
    });

    it('clears preserved state on successful operations', async () => {
      const mockClearState = vi.fn();
      const mockStatePreservation = {
        hasSavedState: vi.fn(() => false),
        clearState: mockClearState,
      };
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useStatePreservation).mockReturnValue(mockStatePreservation);

      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();

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
        expect(mockClearState).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling During Navigation', () => {
    it('handles booking access errors gracefully', async () => {
      vi.mocked(require('@/hooks/useBookingNavigation').useBookingNavigation).mockReturnValue({
        currentBookingId: 'test-booking-1',
        returnUrl: '/bookings',
        navigateToReturnUrl: mockNavigateToReturnUrl,
        canAccessSwapSpecification: vi.fn(() => Promise.resolve({ 
          canAccess: false, 
          reason: 'Booking not found' 
        })),
      });

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Booking')).toBeInTheDocument();
        expect(screen.getByText('Booking not found')).toBeInTheDocument();
        expect(screen.getByText('Return to Bookings')).toBeInTheDocument();
      });
    });

    it('handles network errors during navigation', async () => {
      vi.mocked(require('@/services/bookingService').bookingService.getBooking)
        .mockRejectedValue(new Error('Network error'));

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Booking')).toBeInTheDocument();
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('provides recovery options on errors', async () => {
      const user = userEvent.setup();
      
      vi.mocked(require('@/services/bookingService').bookingService.getBooking)
        .mockRejectedValue(new Error('Network error'));

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
  });

  describe('Data Consistency Between Interfaces', () => {
    it('maintains booking data consistency across interfaces', async () => {
      // First render booking edit form
      const { rerender } = render(
        <BookingEditForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onNavigateToSwapSpec={vi.fn()}
          booking={mockBooking}
        />
      );

      // Verify booking data is displayed
      expect(screen.getByDisplayValue('Test Hotel Booking')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A nice hotel in Paris')).toBeInTheDocument();

      // Switch to swap specification page
      rerender(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      // Verify same booking data is displayed in read-only context
      await waitFor(() => {
        expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
        expect(screen.getByText('A nice hotel in Paris')).toBeInTheDocument();
      });
    });

    it('handles concurrent updates gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock a booking update during navigation
      const updatedBooking = { ...mockBooking, title: 'Updated Hotel Booking' };
      vi.mocked(require('@/services/bookingService').bookingService.getBooking)
        .mockResolvedValueOnce(mockBooking)
        .mockResolvedValueOnce(updatedBooking);

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
      });

      // Simulate a refresh or re-navigation
      const backButton = screen.getByText('← Back to Bookings');
      await user.click(backButton);

      // Should handle the updated booking data
      expect(mockNavigateToReturnUrl).toHaveBeenCalled();
    });
  });

  describe('User Experience Flow', () => {
    it('completes full edit-then-swap workflow', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnNavigateToSwapSpec = vi.fn();

      // Start with booking edit
      const { rerender } = render(
        <BookingEditForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
          booking={mockBooking}
        />
      );

      // Make a booking change
      const titleInput = screen.getByTestId('input-title');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Hotel Booking');

      // Save booking changes
      const saveButton = screen.getByText('Update Booking');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });

      // Navigate to swap specification
      const enableSwappingButton = screen.getByText('🔄 Enable Swapping');
      await user.click(enableSwappingButton);

      expect(mockOnNavigateToSwapSpec).toHaveBeenCalledWith(mockBooking, false);

      // Switch to swap specification page
      rerender(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('swap-preferences-section')).toBeInTheDocument();
      });

      // Enable swapping
      const swapToggle = screen.getByTestId('swap-enabled-toggle');
      await user.click(swapToggle);

      // Configure swap preferences
      const strategySelect = screen.getByTestId('acceptance-strategy-select');
      await user.selectOptions(strategySelect, 'auction');

      // Save swap configuration
      const saveSwapButton = screen.getByText('🔄 Enable Swapping');
      await user.click(saveSwapButton);

      // Should navigate back with success
      await waitFor(() => {
        expect(mockNavigateToReturnUrl).toHaveBeenCalledWith('/bookings', {
          message: 'Swapping enabled successfully',
          type: 'success',
        });
      });
    });

    it('handles edit-only workflow without swap creation', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={vi.fn()}
          booking={mockBooking}
        />
      );

      // Make booking changes
      const titleInput = screen.getByTestId('input-title');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Hotel Booking');

      // Save and close
      const saveButton = screen.getByText('Update Booking');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });

      // Should not navigate to swap specification
      expect(screen.queryByTestId('swap-preferences-section')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility During Navigation', () => {
    it('maintains focus management during navigation', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('← Back to Bookings')).toBeInTheDocument();
      });

      // Focus should be manageable
      const backButton = screen.getByText('← Back to Bookings');
      backButton.focus();
      expect(document.activeElement).toBe(backButton);

      // Tab navigation should work
      await user.tab();
      expect(document.activeElement).not.toBe(backButton);
    });

    it('announces navigation changes to screen readers', async () => {
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Check for live regions or announcements
        const pageHeader = screen.getByText('Swap Specification');
        expect(pageHeader).toBeInTheDocument();
      });

      // Page should have proper heading structure
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('provides clear navigation context', async () => {
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should have breadcrumb navigation
        expect(screen.getByTestId('breadcrumb-navigation')).toBeInTheDocument();
        
        // Should have clear page context
        expect(screen.getByText('📋 Booking Context')).toBeInTheDocument();
      });
    });
  });
});