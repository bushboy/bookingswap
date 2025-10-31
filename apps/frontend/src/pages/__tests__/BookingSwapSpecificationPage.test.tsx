import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingSwapSpecificationPage } from '../BookingSwapSpecificationPage';
import { renderWithProviders, createMockBooking } from '@/test/testUtils';
import { MemoryRouter } from 'react-router-dom';

// Mock the hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({ bookingId: 'test-booking-1' })),
    useNavigate: vi.fn(() => vi.fn()),
    useLocation: vi.fn(() => ({ search: '?returnTo=/bookings' })),
  };
});

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
    getBooking: vi.fn(() => Promise.resolve(createMockBooking({
      id: 'test-booking-1',
      title: 'Test Hotel Booking',
      description: 'A nice hotel in Paris',
    }))),
  },
}));

vi.mock('@/services/UnifiedBookingService', () => ({
  unifiedBookingService: {
    getBookingsWithSwapInfo: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('@/utils/validation', () => ({
  validateSwapPreferences: vi.fn(() => ({})),
}));

// Mock UI components
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, variant, loading, disabled, ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={loading || disabled}
      data-variant={variant}
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

vi.mock('@/components/ui/ThemedPageHeader', () => ({
  ThemedPageHeader: ({ title, subtitle, icon }: any) => (
    <div data-testid="themed-page-header">
      <h1>{icon} {title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

vi.mock('@/components/ui/BreadcrumbNavigation', () => ({
  BreadcrumbNavigation: ({ items, onNavigate }: any) => (
    <nav data-testid="breadcrumb-navigation">
      {items.map((item: any, index: number) => (
        <button key={index} onClick={() => onNavigate(item.path)}>
          {item.label}
        </button>
      ))}
    </nav>
  ),
}));

vi.mock('@/components/ui/ContextualHelp', () => ({
  ContextualHelp: ({ title, content }: any) => (
    <div data-testid="contextual-help">
      <h3>{title}</h3>
      <p>{content}</p>
    </div>
  ),
}));

vi.mock('@/components/ui/ThemedCard', () => ({
  ThemedCard: ({ children, title, icon, variant }: any) => (
    <div data-testid="themed-card" data-variant={variant}>
      {title && <h3>{icon} {title}</h3>}
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/ThemedInterface', () => ({
  ThemedInterface: ({ children }: any) => <div data-testid="themed-interface">{children}</div>,
}));

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
  UnifiedSwapEnablement: ({ isOpen, onClose, onSuccess, booking }: any) => 
    isOpen ? (
      <div data-testid="unified-swap-enablement">
        <h2>Unified Swap Enablement</h2>
        <p>Booking: {booking?.title}</p>
        <button onClick={() => onSuccess({ paymentTypes: ['booking'], acceptanceStrategy: 'first-match' })}>
          Enable Swapping
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}));

describe('BookingSwapSpecificationPage - Swap-Specific Logic Tests', () => {
  const mockBooking = createMockBooking({
    id: 'test-booking-1',
    title: 'Test Hotel Booking',
    description: 'A nice hotel in Paris',
    location: { city: 'Paris', country: 'France' },
    dateRange: {
      checkIn: new Date('2024-12-01'),
      checkOut: new Date('2024-12-05'),
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mocks to default values
    vi.mocked(require('@/services/bookingService').bookingService.getBooking).mockResolvedValue(mockBooking);
    vi.mocked(require('@/services/UnifiedBookingService').unifiedBookingService.getBookingsWithSwapInfo).mockResolvedValue([]);
  });

  describe('Swap-Specific Interface', () => {
    it('renders swap-focused page header', async () => {
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('themed-page-header')).toBeInTheDocument();
        expect(screen.getByText(/Swap Specification/)).toBeInTheDocument();
      });
    });

    it('displays booking context in read-only format', async () => {
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('📋 Booking Context')).toBeInTheDocument();
        expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
        expect(screen.getByText('A nice hotel in Paris')).toBeInTheDocument();
        expect(screen.getByText('Paris, France')).toBeInTheDocument();
      });
    });

    it('shows swap-focused contextual help', async () => {
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('contextual-help')).toBeInTheDocument();
      });
    });

    it('uses swap theme styling', async () => {
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('themed-interface')).toBeInTheDocument();
      });
    });
  });

  describe('Swap Preferences Management', () => {
    it('renders swap preferences section', async () => {
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('swap-preferences-section')).toBeInTheDocument();
      });
    });

    it('handles swap preferences changes', async () => {
      const user = userEvent.setup();
      
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

      expect(swapToggle).toBeChecked();

      // Change acceptance strategy
      const strategySelect = screen.getByTestId('acceptance-strategy-select');
      await user.selectOptions(strategySelect, 'auction');

      expect(strategySelect).toHaveValue('auction');
    });

    it('validates swap preferences on change', async () => {
      const mockValidateSwapPreferences = vi.fn(() => ({
        acceptanceStrategy: 'Invalid strategy',
      }));
      vi.mocked(require('@/utils/validation').validateSwapPreferences).mockImplementation(mockValidateSwapPreferences);

      const user = userEvent.setup();
      
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
        expect(screen.getByText('Invalid strategy')).toBeInTheDocument();
      });
    });

    it('loads existing swap preferences when available', async () => {
      const mockBookingWithSwap = {
        id: 'test-booking-1',
        swapInfo: {
          paymentTypes: ['booking', 'cash'],
          acceptanceStrategy: 'auction',
          minCashAmount: 50,
          maxCashAmount: 200,
          swapConditions: ['flexible-dates'],
        },
      };

      vi.mocked(require('@/services/UnifiedBookingService').unifiedBookingService.getBookingsWithSwapInfo)
        .mockResolvedValue([mockBookingWithSwap]);

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('swap-enabled-toggle')).toBeChecked();
        expect(screen.getByTestId('acceptance-strategy-select')).toHaveValue('auction');
      });
    });
  });

  describe('Wallet Integration', () => {
    it('shows wallet connected status', async () => {
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('✅ Wallet Connected')).toBeInTheDocument();
        expect(screen.getByText(/Your Hedera wallet is connected/)).toBeInTheDocument();
      });
    });

    it('shows wallet required warning when not connected', async () => {
      vi.mocked(require('@/hooks/useWallet').useWallet).mockReturnValue({
        isConnected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
      });

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('⚠️ Wallet Required')).toBeInTheDocument();
        expect(screen.getByText(/Connect your Hedera wallet/)).toBeInTheDocument();
      });
    });

    it('shows guided setup button when wallet not connected', async () => {
      vi.mocked(require('@/hooks/useWallet').useWallet).mockReturnValue({
        isConnected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
      });

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('🚀 Use Guided Setup')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation and Breadcrumbs', () => {
    it('renders breadcrumb navigation', async () => {
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-navigation')).toBeInTheDocument();
      });
    });

    it('handles back navigation', async () => {
      const mockNavigateToReturnUrl = vi.fn();
      vi.mocked(require('@/hooks/useBookingNavigation').useBookingNavigation).mockReturnValue({
        currentBookingId: 'test-booking-1',
        returnUrl: '/bookings',
        navigateToReturnUrl: mockNavigateToReturnUrl,
        canAccessSwapSpecification: vi.fn(() => Promise.resolve({ canAccess: true })),
      });

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

    it('handles breadcrumb navigation', async () => {
      const mockNavigateToReturnUrl = vi.fn();
      vi.mocked(require('@/hooks/useBookingNavigation').useBookingNavigation).mockReturnValue({
        currentBookingId: 'test-booking-1',
        returnUrl: '/bookings',
        navigateToReturnUrl: mockNavigateToReturnUrl,
        canAccessSwapSpecification: vi.fn(() => Promise.resolve({ canAccess: true })),
      });

      const user = userEvent.setup();
      
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-navigation')).toBeInTheDocument();
      });

      // Click on breadcrumb item (assuming first button is "Bookings")
      const breadcrumbButtons = screen.getAllByRole('button');
      const bookingsButton = breadcrumbButtons.find(btn => btn.textContent === 'Bookings');
      
      if (bookingsButton) {
        await user.click(bookingsButton);
        expect(mockNavigateToReturnUrl).toHaveBeenCalled();
      }
    });
  });

  describe('Unified Swap Enablement Integration', () => {
    it('opens unified swap enablement modal', async () => {
      vi.mocked(require('@/hooks/useWallet').useWallet).mockReturnValue({
        isConnected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
      });

      const user = userEvent.setup();
      
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('🚀 Use Guided Setup')).toBeInTheDocument();
      });

      // Enable swapping first
      const swapToggle = screen.getByTestId('swap-enabled-toggle');
      await user.click(swapToggle);

      const guidedSetupButton = screen.getByText('🚀 Use Guided Setup');
      await user.click(guidedSetupButton);

      expect(screen.getByTestId('unified-swap-enablement')).toBeInTheDocument();
    });

    it('handles unified swap enablement success', async () => {
      const mockNavigateToReturnUrl = vi.fn();
      vi.mocked(require('@/hooks/useBookingNavigation').useBookingNavigation).mockReturnValue({
        currentBookingId: 'test-booking-1',
        returnUrl: '/bookings',
        navigateToReturnUrl: mockNavigateToReturnUrl,
        canAccessSwapSpecification: vi.fn(() => Promise.resolve({ canAccess: true })),
      });

      vi.mocked(require('@/hooks/useWallet').useWallet).mockReturnValue({
        isConnected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
      });

      const user = userEvent.setup();
      
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('🚀 Use Guided Setup')).toBeInTheDocument();
      });

      // Enable swapping and open guided setup
      const swapToggle = screen.getByTestId('swap-enabled-toggle');
      await user.click(swapToggle);

      const guidedSetupButton = screen.getByText('🚀 Use Guided Setup');
      await user.click(guidedSetupButton);

      // Complete guided setup
      const enableButton = screen.getByText('Enable Swapping');
      await user.click(enableButton);

      expect(mockNavigateToReturnUrl).toHaveBeenCalledWith('/bookings', {
        message: 'Swapping enabled successfully',
        type: 'success',
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error when booking cannot be loaded', async () => {
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
      });
    });

    it('shows error when access is denied', async () => {
      vi.mocked(require('@/hooks/useBookingNavigation').useBookingNavigation).mockReturnValue({
        currentBookingId: 'test-booking-1',
        returnUrl: '/bookings',
        navigateToReturnUrl: vi.fn(),
        canAccessSwapSpecification: vi.fn(() => Promise.resolve({ 
          canAccess: false, 
          reason: 'Access denied' 
        })),
      });

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Booking')).toBeInTheDocument();
        expect(screen.getByText('Access denied')).toBeInTheDocument();
      });
    });

    it('handles swap submission errors', async () => {
      const mockEnableSwappingWithWallet = vi.fn().mockRejectedValue(new Error('Wallet error'));
      vi.mocked(require('@/hooks/useBookingWithWallet').useBookingWithWallet).mockReturnValue({
        enableSwappingWithWallet: mockEnableSwappingWithWallet,
        canEnableSwapping: vi.fn(() => true),
      });

      const user = userEvent.setup();
      
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
        expect(screen.getByText('Wallet error')).toBeInTheDocument();
      });
    });
  });

  describe('Unsaved Changes Handling', () => {
    it('detects unsaved swap preference changes', async () => {
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
        expect(screen.getByText('Unsaved Swap Changes')).toBeInTheDocument();
        expect(screen.getByText(/You have unsaved swap preference changes/)).toBeInTheDocument();
      });
    });

    it('prompts user before navigation with unsaved changes', async () => {
      const mockNavigateWithConfirmation = vi.fn(() => Promise.resolve(true));
      const mockUseUnsavedChanges = vi.fn(() => ({
        hasUnsavedChanges: true,
        navigateWithConfirmation: mockNavigateWithConfirmation,
        markAsSaved: vi.fn(),
        isSaving: false,
      }));
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useUnsavedChanges).mockImplementation(mockUseUnsavedChanges);

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

      expect(mockNavigateWithConfirmation).toHaveBeenCalledWith('/bookings');
    });
  });

  describe('Loading States', () => {
    it('shows loading state while fetching booking data', () => {
      vi.mocked(require('@/services/bookingService').bookingService.getBooking)
        .mockReturnValue(new Promise(() => {})); // Never resolves

      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Loading booking details...')).toBeInTheDocument();
    });

    it('shows loading state during swap submission', async () => {
      const user = userEvent.setup();
      
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

      // Mock loading state
      const mockUseUnsavedChanges = vi.fn(() => ({
        hasUnsavedChanges: true,
        navigateWithConfirmation: vi.fn(() => Promise.resolve(true)),
        markAsSaved: vi.fn(),
        isSaving: true,
      }));
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useUnsavedChanges).mockImplementation(mockUseUnsavedChanges);

      // Re-render to apply the loading state
      render(
        <MemoryRouter>
          <BookingSwapSpecificationPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });
  });
});