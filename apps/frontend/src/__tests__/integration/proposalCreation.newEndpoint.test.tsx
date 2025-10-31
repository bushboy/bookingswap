import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MakeProposalModal } from '../../components/swap/MakeProposalModal';
import { swapApiService } from '../../services/swapApiService';
import { AuthContext } from '../../contexts/AuthContext';
import { notificationSlice } from '../../store/slices/notificationSlice';
import { CreateProposalRequest, ProposalResponse } from '../../types/api';

// Mock the API service
vi.mock('../../services/swapApiService');
const mockSwapApiService = vi.mocked(swapApiService);

// Mock performance monitor
vi.mock('../../services/performanceMonitor', () => ({
  performanceMonitor: {
    measureAsync: vi.fn((name, fn) => fn()),
  },
  apiPerformanceMonitor: {
    measureApiCall: vi.fn((endpoint, method, fn) => fn()),
  },
}));

// Mock cache service
vi.mock('../../services/cacheService', () => ({
  swapCacheService: {
    getEligibleSwaps: vi.fn(() => null),
    setEligibleSwaps: vi.fn(),
    invalidateEligibleSwaps: vi.fn(),
    getCompatibilityAnalysis: vi.fn(() => null),
    setCompatibilityAnalysis: vi.fn(),
    invalidateCompatibility: vi.fn(),
  },
}));

// Mock error recovery hook
vi.mock('../../hooks/useErrorRecovery', () => ({
  useErrorRecovery: vi.fn(() => ({
    executeWithRecovery: vi.fn((fn) => fn()),
    retry: vi.fn(),
    manualRetry: vi.fn(),
    clearError: vi.fn(),
    resetCircuitBreaker: vi.fn(),
    canRetry: false,
    currentAttempt: 0,
    lastRecoveryResult: null,
  })),
}));

// Mock authentication guard
vi.mock('../../hooks/useAuthenticationGuard', () => ({
  useAuthenticationGuard: vi.fn(() => ({
    requireAuthentication: vi.fn(() => true),
    handleAuthError: vi.fn(),
    isAuthError: vi.fn(() => false),
    isAuthorizationError: vi.fn(() => false),
    getAuthErrorMessage: vi.fn((error) => error.message),
  })),
}));

// Mock responsive hook
vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  })),
}));

// Mock accessibility hook
vi.mock('../../hooks/useAccessibility', () => ({
  useAnnouncements: vi.fn(() => ({
    announce: vi.fn(),
  })),
}));

describe('Proposal Creation Integration - New Endpoint', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockTargetSwap = {
    id: 'target-swap-123',
    title: 'Beautiful Beach House',
    description: 'A stunning beachfront property',
  };

  const mockAuthContextValue = {
    user: mockUser,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  };

  let store: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a test store
    store = configureStore({
      reducer: {
        notifications: notificationSlice.reducer,
      },
    });

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => {
          if (key === 'auth_token') return 'mock-jwt-token';
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });

    // Mock successful eligible swaps response
    mockSwapApiService.getEligibleSwaps.mockResolvedValue({
      swaps: [
        {
          id: 'source-swap-456',
          title: 'Mountain Cabin',
          description: 'Cozy mountain retreat',
          bookingDetails: {
            location: 'Mountain View',
            dateRange: {
              checkIn: new Date('2024-07-01'),
              checkOut: new Date('2024-07-07'),
            },
            guests: 4,
            propertyType: 'cabin',
          },
          compatibilityScore: 92,
          estimatedValue: 1800,
        },
      ],
      totalCount: 1,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <Provider store={store}>
        <AuthContext.Provider value={mockAuthContextValue}>
          {component}
        </AuthContext.Provider>
      </Provider>
    );
  };

  describe('End-to-End Proposal Creation', () => {
    it('should successfully create a proposal using the new endpoint', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      const mockProposalResponse: ProposalResponse = {
        proposalId: 'proposal-integration-123',
        status: 'pending',
        estimatedResponseTime: '2-3 business days',
      };

      mockSwapApiService.createProposal.mockResolvedValue(mockProposalResponse);

      renderWithProviders(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Wait for eligible swaps to load
      await waitFor(() => {
        expect(screen.getByText('Mountain Cabin')).toBeInTheDocument();
      });

      // Select the eligible swap
      const swapCard = screen.getByText('Mountain Cabin').closest('[role="button"]');
      expect(swapCard).toBeInTheDocument();
      await user.click(swapCard!);

      // Fill out the proposal form
      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'I would love to swap with you!');

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      await user.click(submitButton);

      // Verify the API was called with the correct endpoint and data
      await waitFor(() => {
        expect(mockSwapApiService.createProposal).toHaveBeenCalledWith(
          'target-swap-123',
          {
            sourceSwapId: 'source-swap-456',
            message: 'I would love to swap with you!',
            conditions: ['Standard swap exchange'],
            agreedToTerms: true,
          },
          undefined,
          expect.any(Object)
        );
      });

      // Verify success handling
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          targetSwapId: 'target-swap-123',
          sourceSwapId: 'source-swap-456',
          proposerId: 'user-123',
          message: 'I would love to swap with you!',
          agreedToTerms: true,
        })
      );

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should successfully create a cash proposal using the new endpoint', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      const mockProposalResponse: ProposalResponse = {
        proposalId: 'cash-proposal-integration-123',
        status: 'pending',
        estimatedResponseTime: '1-2 business days',
      };

      mockSwapApiService.createProposal.mockResolvedValue(mockProposalResponse);

      renderWithProviders(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Wait for the modal to load
      await waitFor(() => {
        expect(screen.getByText('Choose a swap to propose')).toBeInTheDocument();
      });

      // Click on cash offer option
      const cashOfferButton = screen.getByText(/make cash offer/i);
      await user.click(cashOfferButton);

      // Fill out the cash offer form
      await waitFor(() => {
        expect(screen.getByText('Make Cash Offer')).toBeInTheDocument();
      });

      const amountInput = screen.getByLabelText(/cash amount/i);
      await user.type(amountInput, '2500');

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Cash offer for your beautiful property');

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit offer/i });
      await user.click(submitButton);

      // Verify the API was called with the correct cash offer data
      await waitFor(() => {
        expect(mockSwapApiService.createProposal).toHaveBeenCalledWith(
          'target-swap-123',
          {
            sourceSwapId: 'CASH_OFFER',
            message: 'Cash offer for your beautiful property',
            conditions: ['Cash payment offer'],
            agreedToTerms: true,
            cashOffer: {
              amount: 2500,
              currency: 'USD',
            },
          },
          undefined,
          expect.any(Object)
        );
      });

      // Verify success handling
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          targetSwapId: 'target-swap-123',
          sourceSwapId: '',
          proposerId: 'user-123',
          message: 'Cash offer for your beautiful property',
          agreedToTerms: true,
          cashOffer: {
            amount: 2500,
            currency: 'USD',
          },
        })
      );

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle validation errors from the new endpoint gracefully', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      // Mock validation error from the API
      const validationError = new Error('Invalid proposal data');
      validationError.name = 'ValidationError';
      mockSwapApiService.createProposal.mockRejectedValue(validationError);

      renderWithProviders(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Wait for eligible swaps to load
      await waitFor(() => {
        expect(screen.getByText('Mountain Cabin')).toBeInTheDocument();
      });

      // Select swap and submit proposal
      const swapCard = screen.getByText('Mountain Cabin').closest('[role="button"]');
      await user.click(swapCard!);

      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      await user.click(submitButton);

      // Verify error is displayed and modal stays open
      await waitFor(() => {
        expect(screen.getByText(/invalid proposal data/i)).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should handle network errors from the new endpoint gracefully', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      // Mock network error from the API
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      mockSwapApiService.createProposal.mockRejectedValue(networkError);

      renderWithProviders(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Wait for eligible swaps to load
      await waitFor(() => {
        expect(screen.getByText('Mountain Cabin')).toBeInTheDocument();
      });

      // Select swap and submit proposal
      const swapCard = screen.getByText('Mountain Cabin').closest('[role="button"]');
      await user.click(swapCard!);

      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      await user.click(submitButton);

      // Verify error is displayed
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing parent component callbacks', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      const mockProposalResponse: ProposalResponse = {
        proposalId: 'backward-compat-123',
        status: 'pending',
        estimatedResponseTime: '2-3 business days',
      };

      mockSwapApiService.createProposal.mockResolvedValue(mockProposalResponse);

      renderWithProviders(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Complete the proposal flow
      await waitFor(() => {
        expect(screen.getByText('Mountain Cabin')).toBeInTheDocument();
      });

      const swapCard = screen.getByText('Mountain Cabin').closest('[role="button"]');
      await user.click(swapCard!);

      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      await user.click(submitButton);

      // Verify the parent callback receives the expected format
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            targetSwapId: 'target-swap-123',
            sourceSwapId: 'source-swap-456',
            proposerId: 'user-123',
            agreedToTerms: true,
          })
        );
      });
    });

    it('should maintain compatibility with existing notification system', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      const mockProposalResponse: ProposalResponse = {
        proposalId: 'notification-compat-123',
        status: 'pending',
        estimatedResponseTime: '2-3 business days',
      };

      mockSwapApiService.createProposal.mockResolvedValue(mockProposalResponse);

      renderWithProviders(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Complete the proposal flow
      await waitFor(() => {
        expect(screen.getByText('Mountain Cabin')).toBeInTheDocument();
      });

      const swapCard = screen.getByText('Mountain Cabin').closest('[role="button"]');
      await user.click(swapCard!);

      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      await user.click(submitButton);

      // Verify notification was dispatched to the store
      await waitFor(() => {
        const state = store.getState();
        expect(state.notifications.notifications).toHaveLength(1);
        expect(state.notifications.notifications[0]).toMatchObject({
          type: 'swap_proposal',
          title: 'Proposal Submitted Successfully',
          data: expect.objectContaining({
            proposalId: 'notification-compat-123',
            estimatedResponseTime: '2-3 business days',
          }),
        });
      });
    });
  });

  describe('Error Response Format Compatibility', () => {
    it('should handle new error response format correctly', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      // Mock error response in the new format
      const apiError = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid source swap',
              category: 'validation',
              details: {
                sourceSwapId: ['Source swap is not available for proposals'],
              },
            },
            timestamp: '2024-01-15T10:00:00Z',
            requestId: 'req_123456',
          },
        },
      };

      mockSwapApiService.createProposal.mockRejectedValue(apiError);

      renderWithProviders(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Complete the proposal flow
      await waitFor(() => {
        expect(screen.getByText('Mountain Cabin')).toBeInTheDocument();
      });

      const swapCard = screen.getByText('Mountain Cabin').closest('[role="button"]');
      await user.click(swapCard!);

      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      await user.click(submitButton);

      // Verify the error is handled and displayed appropriately
      await waitFor(() => {
        expect(screen.getByText(/invalid source swap/i)).toBeInTheDocument();
      });
    });
  });
});