import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderWithProviders,
  createMockBooking,
  createMockUser,
} from '../../../test/testUtils';
import { EnhancedSwapCreationModal } from '../EnhancedSwapCreationModal';
import { RootState } from '../../../store';
import * as swapThunks from '../../../store/thunks/swapThunks';

// Mock the thunks
vi.mock('../../../store/thunks/swapThunks', () => ({
  createEnhancedSwapThunk: vi.fn(),
}));

describe('EnhancedSwapCreationModal', () => {
  const mockBooking = createMockBooking({
    id: 'booking-123',
    title: 'Paris Hotel',
    dateRange: {
      checkIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      checkOut: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000), // 34 days from now
    },
  });

  const mockUser = createMockUser({ id: 'user-123' });

  const defaultProps = {
    booking: mockBooking,
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  const initialState: Partial<RootState> = {
    auth: {
      user: {
        id: mockUser.id,
        walletAddress: '0x123',
        displayName: mockUser.profile.firstName,
        email: mockUser.email,
        verificationLevel: 'verified' as const,
      },
      isAuthenticated: true,
      walletConnected: true,
      loading: false,
      error: null,
    },
    swaps: {
      swaps: [],
      currentSwap: null,
      loading: false,
      error: null,
      filters: {},
      pagination: { page: 1, limit: 10, total: 0 },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render enhanced swap creation modal', () => {
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      expect(screen.getByText('Create Enhanced Swap')).toBeInTheDocument();
      expect(screen.getByText('Paris Hotel')).toBeInTheDocument();
      expect(screen.getByLabelText(/swap title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(
        <EnhancedSwapCreationModal {...defaultProps} isOpen={false} />,
        { preloadedState: initialState }
      );

      expect(
        screen.queryByText('Create Enhanced Swap')
      ).not.toBeInTheDocument();
    });

    it('should display booking information correctly', () => {
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      expect(screen.getByText('Paris Hotel')).toBeInTheDocument();
      expect(screen.getByText(/New York, USA/)).toBeInTheDocument();
      expect(screen.getByText(/\$450/)).toBeInTheDocument(); // Swap value
    });
  });

  describe('Payment Type Selection', () => {
    it('should allow selecting booking exchange only', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      const bookingOnlyRadio = screen.getByLabelText(/booking exchange only/i);
      await user.click(bookingOnlyRadio);

      expect(bookingOnlyRadio).toBeChecked();
      expect(
        screen.queryByLabelText(/minimum cash amount/i)
      ).not.toBeInTheDocument();
    });

    it('should allow selecting booking exchange and cash', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      const bothPaymentsRadio = screen.getByLabelText(
        /booking exchange and cash/i
      );
      await user.click(bothPaymentsRadio);

      expect(bothPaymentsRadio).toBeChecked();
      expect(screen.getByLabelText(/minimum cash amount/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/preferred cash amount/i)
      ).toBeInTheDocument();
    });

    it('should validate minimum cash amount when cash payments enabled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      // Enable cash payments
      const bothPaymentsRadio = screen.getByLabelText(
        /booking exchange and cash/i
      );
      await user.click(bothPaymentsRadio);

      // Enter invalid minimum amount
      const minimumCashInput = screen.getByLabelText(/minimum cash amount/i);
      await user.clear(minimumCashInput);
      await user.type(minimumCashInput, '50'); // Below platform minimum

      // Try to submit
      const createButton = screen.getByRole('button', { name: /create swap/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(
          screen.getByText(/minimum cash amount must be at least \$100/i)
        ).toBeInTheDocument();
      });
    });

    it('should validate preferred amount is not less than minimum', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      // Enable cash payments
      const bothPaymentsRadio = screen.getByLabelText(
        /booking exchange and cash/i
      );
      await user.click(bothPaymentsRadio);

      // Set minimum and preferred amounts
      const minimumCashInput = screen.getByLabelText(/minimum cash amount/i);
      const preferredCashInput = screen.getByLabelText(
        /preferred cash amount/i
      );

      await user.clear(minimumCashInput);
      await user.type(minimumCashInput, '200');
      await user.clear(preferredCashInput);
      await user.type(preferredCashInput, '150'); // Less than minimum

      await user.tab(); // Trigger validation

      await waitFor(() => {
        expect(
          screen.getByText(
            /preferred amount must be greater than or equal to minimum/i
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Acceptance Strategy Selection', () => {
    it('should allow selecting first match strategy', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      const firstMatchRadio = screen.getByLabelText(/first match acceptance/i);
      await user.click(firstMatchRadio);

      expect(firstMatchRadio).toBeChecked();
      expect(
        screen.queryByLabelText(/auction end date/i)
      ).not.toBeInTheDocument();
    });

    it('should allow selecting auction strategy', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      const auctionRadio = screen.getByLabelText(/auction mode/i);
      await user.click(auctionRadio);

      expect(auctionRadio).toBeChecked();
      expect(screen.getByLabelText(/auction end date/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/auto-select highest offer/i)
      ).toBeInTheDocument();
    });

    it('should validate auction end date timing', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      // Select auction mode
      const auctionRadio = screen.getByLabelText(/auction mode/i);
      await user.click(auctionRadio);

      // Set auction end date too close to event
      const auctionEndDateInput = screen.getByLabelText(/auction end date/i);
      const tooLateDate = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000); // 25 days from now (5 days before event)
      await user.clear(auctionEndDateInput);
      await user.type(
        auctionEndDateInput,
        tooLateDate.toISOString().split('T')[0]
      );

      await user.tab(); // Trigger validation

      await waitFor(() => {
        expect(
          screen.getByText(
            /auction must end at least one week before the event/i
          )
        ).toBeInTheDocument();
      });
    });

    it('should disable auction mode for last-minute bookings', () => {
      const lastMinuteBooking = createMockBooking({
        id: 'booking-last-minute',
        dateRange: {
          checkIn: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
          checkOut: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      renderWithProviders(
        <EnhancedSwapCreationModal
          {...defaultProps}
          booking={lastMinuteBooking}
        />,
        { preloadedState: initialState }
      );

      const auctionRadio = screen.getByLabelText(/auction mode/i);
      expect(auctionRadio).toBeDisabled();
      expect(
        screen.getByText(
          /auction mode is not available for bookings less than one week away/i
        )
      ).toBeInTheDocument();
    });
  });

  describe('Swap Preferences', () => {
    it('should allow adding preferred locations', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      const locationInput = screen.getByLabelText(/preferred locations/i);
      await user.type(locationInput, 'London');
      await user.keyboard('{Enter}');

      expect(screen.getByText('London')).toBeInTheDocument();

      // Add another location
      await user.type(locationInput, 'Rome');
      await user.keyboard('{Enter}');

      expect(screen.getByText('Rome')).toBeInTheDocument();
    });

    it('should allow removing preferred locations', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      const locationInput = screen.getByLabelText(/preferred locations/i);
      await user.type(locationInput, 'London');
      await user.keyboard('{Enter}');

      expect(screen.getByText('London')).toBeInTheDocument();

      // Remove the location
      const removeButton = screen.getByRole('button', {
        name: /remove london/i,
      });
      await user.click(removeButton);

      expect(screen.queryByText('London')).not.toBeInTheDocument();
    });

    it('should allow adding additional requirements', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      const requirementsInput = screen.getByLabelText(
        /additional requirements/i
      );
      await user.type(requirementsInput, 'Same star rating');
      await user.keyboard('{Enter}');

      expect(screen.getByText('Same star rating')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should create enhanced swap with first match strategy', async () => {
      const user = userEvent.setup();
      const mockCreateEnhancedSwap = vi.mocked(
        swapThunks.createEnhancedSwapThunk
      );
      mockCreateEnhancedSwap.mockReturnValue({
        type: 'swaps/createEnhanced/fulfilled',
      } as any);

      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      // Fill in required fields
      const titleInput = screen.getByLabelText(/swap title/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      await user.type(titleInput, 'My Paris Hotel Swap');
      await user.type(
        descriptionInput,
        'Looking to swap my Paris hotel booking'
      );

      // Select payment type
      const bookingOnlyRadio = screen.getByLabelText(/booking exchange only/i);
      await user.click(bookingOnlyRadio);

      // Select first match strategy
      const firstMatchRadio = screen.getByLabelText(/first match acceptance/i);
      await user.click(firstMatchRadio);

      // Submit form
      const createButton = screen.getByRole('button', { name: /create swap/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockCreateEnhancedSwap).toHaveBeenCalledWith({
          sourceBookingId: 'booking-123',
          title: 'My Paris Hotel Swap',
          description: 'Looking to swap my Paris hotel booking',
          paymentTypes: {
            bookingExchange: true,
            cashPayment: false,
          },
          acceptanceStrategy: {
            type: 'first_match',
          },
          swapPreferences: {
            preferredLocations: [],
            additionalRequirements: [],
          },
          expirationDate: expect.any(Date),
        });
      });
    });

    it('should create enhanced swap with auction strategy', async () => {
      const user = userEvent.setup();
      const mockCreateEnhancedSwap = vi.mocked(
        swapThunks.createEnhancedSwapThunk
      );
      mockCreateEnhancedSwap.mockReturnValue({
        type: 'swaps/createEnhanced/fulfilled',
      } as any);

      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      // Fill in required fields
      const titleInput = screen.getByLabelText(/swap title/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      await user.type(titleInput, 'Auction Swap Test');
      await user.type(descriptionInput, 'Testing auction functionality');

      // Enable cash payments
      const bothPaymentsRadio = screen.getByLabelText(
        /booking exchange and cash/i
      );
      await user.click(bothPaymentsRadio);

      const minimumCashInput = screen.getByLabelText(/minimum cash amount/i);
      await user.clear(minimumCashInput);
      await user.type(minimumCashInput, '300');

      // Select auction strategy
      const auctionRadio = screen.getByLabelText(/auction mode/i);
      await user.click(auctionRadio);

      // Set auction end date
      const auctionEndDateInput = screen.getByLabelText(/auction end date/i);
      const validEndDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days from now
      await user.clear(auctionEndDateInput);
      await user.type(
        auctionEndDateInput,
        validEndDate.toISOString().split('T')[0]
      );

      // Submit form
      const createButton = screen.getByRole('button', { name: /create swap/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockCreateEnhancedSwap).toHaveBeenCalledWith({
          sourceBookingId: 'booking-123',
          title: 'Auction Swap Test',
          description: 'Testing auction functionality',
          paymentTypes: {
            bookingExchange: true,
            cashPayment: true,
            minimumCashAmount: 300,
          },
          acceptanceStrategy: {
            type: 'auction',
            auctionEndDate: expect.any(Date),
            autoSelectHighest: false,
          },
          auctionSettings: {
            endDate: expect.any(Date),
            allowBookingProposals: true,
            allowCashProposals: true,
            minimumCashOffer: 300,
            autoSelectAfterHours: 24,
          },
          swapPreferences: {
            preferredLocations: [],
            additionalRequirements: [],
          },
          expirationDate: expect.any(Date),
        });
      });
    });

    it('should handle form validation errors', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      // Try to submit without filling required fields
      const createButton = screen.getByRole('button', { name: /create swap/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
        expect(
          screen.getByText(/description is required/i)
        ).toBeInTheDocument();
      });
    });

    it('should call onSuccess when swap is created successfully', async () => {
      const user = userEvent.setup();
      const mockCreateEnhancedSwap = vi.mocked(
        swapThunks.createEnhancedSwapThunk
      );
      mockCreateEnhancedSwap.mockReturnValue({
        type: 'swaps/createEnhanced/fulfilled',
      } as any);

      const onSuccessMock = vi.fn();

      renderWithProviders(
        <EnhancedSwapCreationModal
          {...defaultProps}
          onSuccess={onSuccessMock}
        />,
        { preloadedState: initialState }
      );

      // Fill in required fields
      const titleInput = screen.getByLabelText(/swap title/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      await user.type(titleInput, 'Success Test Swap');
      await user.type(descriptionInput, 'Testing success callback');

      // Submit form
      const createButton = screen.getByRole('button', { name: /create swap/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(onSuccessMock).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText(/swap title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /create swap/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      const titleInput = screen.getByLabelText(/swap title/i);
      titleInput.focus();

      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText(/description/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/booking exchange only/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/booking exchange and cash/i)).toHaveFocus();
    });

    it('should announce form validation errors to screen readers', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: initialState,
      });

      const createButton = screen.getByRole('button', { name: /create swap/i });
      await user.click(createButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/title is required/i);
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });

    it('should close modal on Escape key', async () => {
      const user = userEvent.setup();
      const onCloseMock = vi.fn();

      renderWithProviders(
        <EnhancedSwapCreationModal {...defaultProps} onClose={onCloseMock} />,
        { preloadedState: initialState }
      );

      await user.keyboard('{Escape}');

      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('should show loading state during swap creation', async () => {
      const loadingState: Partial<RootState> = {
        ...initialState,
        swaps: {
          ...initialState.swaps!,
          loading: true,
        },
      };

      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: loadingState,
      });

      const createButton = screen.getByRole('button', { name: /creating.../i });
      expect(createButton).toBeDisabled();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should disable form during loading', () => {
      const loadingState: Partial<RootState> = {
        ...initialState,
        swaps: {
          ...initialState.swaps!,
          loading: true,
        },
      };

      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: loadingState,
      });

      expect(screen.getByLabelText(/swap title/i)).toBeDisabled();
      expect(screen.getByLabelText(/description/i)).toBeDisabled();
      expect(screen.getByLabelText(/booking exchange only/i)).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error messages from API', () => {
      const errorState: Partial<RootState> = {
        ...initialState,
        swaps: {
          ...initialState.swaps!,
          error: 'Failed to create swap: Invalid auction timing',
        },
      };

      renderWithProviders(<EnhancedSwapCreationModal {...defaultProps} />, {
        preloadedState: errorState,
      });

      expect(
        screen.getByText(/failed to create swap: invalid auction timing/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should clear errors when modal is reopened', () => {
      const { rerender } = renderWithProviders(
        <EnhancedSwapCreationModal {...defaultProps} isOpen={false} />,
        { preloadedState: initialState }
      );

      // Reopen modal
      rerender(<EnhancedSwapCreationModal {...defaultProps} isOpen={true} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
