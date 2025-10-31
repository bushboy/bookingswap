import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { MakeProposalModal } from '../../components/swap/MakeProposalModal';
import { AuthContext } from '../../contexts/AuthContext';
import { swapApiService } from '../../services/swapApiService';
import authReducer from '../../store/slices/authSlice';
import notificationReducer, { addNotification } from '../../store/slices/notificationSlice';
import {
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
  User,
  SwapWithProposalInfo,
} from '@booking-swap/shared';
import {
  EligibleSwapResponse,
  EligibleSwap,
  CreateProposalRequest,
  ProposalResponse,
  CompatibilityAnalysis,
} from '../../types/api';

// Mock the SwapApiService
vi.mock('../../services/swapApiService');
const mockSwapApiService = vi.mocked(swapApiService);

// Mock performance monitor to avoid noise in tests
vi.mock('../../services/performanceMonitor', () => ({
  apiPerformanceMonitor: {
    measureApiCall: vi.fn((endpoint, method, fn) => fn()),
  },
}));

// Mock cache service
vi.mock('../../services/cacheService', () => ({
  swapCacheService: {
    getEligibleSwaps: vi.fn(() => null),
    setEligibleSwaps: vi.fn(),
    getCompatibilityAnalysis: vi.fn(() => null),
    setCompatibilityAnalysis: vi.fn(),
    invalidateEligibleSwaps: vi.fn(),
    invalidateCompatibility: vi.fn(),
  },
}));

// Mock WebSocket hooks
vi.mock('../../hooks/useSwapWebSocket', () => ({
  useSwapWebSocket: () => ({
    isConnected: true,
    lastEvent: null,
    reconnect: vi.fn(),
  }),
}));

describe('Proposal Modal API Integration Tests', () => {
  let store: ReturnType<typeof configureStore>;
  let user: ReturnType<typeof userEvent.setup>;

  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    profile: {
      firstName: 'Test',
      lastName: 'User',
      avatar: '',
      bio: '',
      location: { city: 'New York', country: 'USA' },
      preferences: {},
      reputation: { score: 5, reviewCount: 10 },
      verification: { status: 'verified', documents: [] },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTargetSwap: SwapWithProposalInfo = {
    id: 'target-swap-123',
    title: 'Luxury Hotel in Paris',
    description: 'Beautiful hotel in the heart of Paris',
    location: 'Paris, France',
    dateRange: {
      checkIn: new Date('2024-07-01'),
      checkOut: new Date('2024-07-05'),
    },
    estimatedValue: 800,
    accommodationType: 'hotel',
    guests: 2,
    amenities: ['wifi', 'pool', 'gym'],
    images: [],
    owner: {
      id: 'owner-456',
      username: 'owner',
      profile: {
        firstName: 'Owner',
        lastName: 'User',
        reputation: { score: 4.8, reviewCount: 25 },
      },
    },
    status: 'available',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEligibleSwaps: EligibleSwap[] = [
    {
      id: 'eligible-swap-1',
      title: 'Beach Resort in Miami',
      bookingDetails: {
        location: 'Miami, FL',
        accommodationType: 'resort',
        guests: 2,
        estimatedValue: 750,
        dateRange: {
          checkIn: new Date('2024-07-01'),
          checkOut: new Date('2024-07-05'),
        },
        amenities: ['beach', 'pool', 'spa'],
      },
      compatibilityScore: 85,
      eligibilityReasons: ['Similar dates', 'Compatible value range', 'Same guest count'],
      isEligible: true,
    },
    {
      id: 'eligible-swap-2',
      title: 'Mountain Cabin in Colorado',
      bookingDetails: {
        location: 'Aspen, CO',
        accommodationType: 'cabin',
        guests: 2,
        estimatedValue: 650,
        dateRange: {
          checkIn: new Date('2024-07-02'),
          checkOut: new Date('2024-07-06'),
        },
        amenities: ['fireplace', 'kitchen', 'mountain_view'],
      },
      compatibilityScore: 72,
      eligibilityReasons: ['Overlapping dates', 'Similar guest count'],
      isEligible: true,
    },
  ];

  const mockEligibleSwapsResponse: EligibleSwapResponse = {
    swaps: mockEligibleSwaps,
    totalCount: 2,
    compatibilityThreshold: 60,
  };

  const mockCompatibilityAnalysis: CompatibilityAnalysis = {
    score: 85,
    level: 'excellent',
    reasons: ['Similar dates', 'Compatible value range', 'Same guest count'],
    details: {
      dateCompatibility: 0.9,
      valueCompatibility: 0.85,
      locationCompatibility: 0.7,
      amenityCompatibility: 0.8,
    },
  };

  const mockProposalResponse: ProposalResponse = {
    proposalId: 'proposal-789',
    status: 'pending',
    estimatedResponseTime: '2-3 business days',
  };

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Provider store={store}>
      <BrowserRouter>
        <AuthContext.Provider
          value={{
            user: mockUser,
            isAuthenticated: true,
            login: vi.fn(),
            logout: vi.fn(),
            loading: false,
            error: null,
          }}
        >
          {children}
        </AuthContext.Provider>
      </BrowserRouter>
    </Provider>
  );

  beforeEach(() => {
    user = userEvent.setup();
    store = configureStore({
      reducer: {
        auth: authReducer,
        notifications: notificationReducer,
      },
      preloadedState: {
        auth: {
          isAuthenticated: true,
          user: mockUser,
          walletConnected: true,
          loading: false,
          error: null,
        },
        notifications: {
          notifications: [],
          unreadCount: 0,
        },
      },
    });

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default successful API responses
    mockSwapApiService.getEligibleSwaps.mockResolvedValue(mockEligibleSwapsResponse);
    mockSwapApiService.getSwapCompatibility.mockResolvedValue(mockCompatibilityAnalysis);
    mockSwapApiService.createProposal.mockResolvedValue(mockProposalResponse);
    mockSwapApiService.isAuthenticated.mockReturnValue(true);
    mockSwapApiService.createAbortController.mockReturnValue(new AbortController());

    // Mock localStorage for auth token
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => {
          if (key === 'auth_token' || key === 'authToken') {
            return 'mock-jwt-token';
          }
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('End-to-End Proposal Creation Flow', () => {
    it('should complete the full proposal creation workflow with real API calls', async () => {
      const onSubmit = vi.fn();
      const onClose = vi.fn();

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={onClose}
            targetSwap={mockTargetSwap}
            onSubmit={onSubmit}
          />
        </TestWrapper>
      );

      // Wait for eligible swaps to load
      await waitFor(() => {
        expect(mockSwapApiService.getEligibleSwaps).toHaveBeenCalledWith(
          mockUser.id,
          expect.objectContaining({
            targetSwapId: mockTargetSwap.id,
          }),
          expect.any(Object)
        );
      });

      // Should display eligible swaps
      await waitFor(() => {
        expect(screen.getByText('Beach Resort in Miami')).toBeInTheDocument();
        expect(screen.getByText('Mountain Cabin in Colorado')).toBeInTheDocument();
      });

      // Select the first eligible swap
      const firstSwap = screen.getByText('Beach Resort in Miami');
      await user.click(firstSwap);

      // Should navigate to proposal form
      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      // Fill out the proposal form
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'I would love to swap my beach resort for your Paris hotel!');

      const conditionsInput = screen.getByLabelText(/conditions/i);
      await user.type(conditionsInput, 'Flexible check-in time preferred');

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      // Submit the proposal
      const submitButton = screen.getByRole('button', { name: /send proposal/i });
      await user.click(submitButton);

      // Verify API call was made with correct data
      await waitFor(() => {
        expect(mockSwapApiService.createProposal).toHaveBeenCalledWith(
          mockTargetSwap.id,
          expect.objectContaining({
            sourceSwapId: 'eligible-swap-1',
            message: 'I would love to swap my beach resort for your Paris hotel!',
            conditions: ['Flexible check-in time preferred'],
            agreedToTerms: true,
          }),
          expect.any(Object),
          expect.any(Object)
        );
      });

      // Should call onSubmit with the proposal data
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          targetSwapId: mockTargetSwap.id,
          sourceSwapId: 'eligible-swap-1',
          proposerId: mockUser.id,
          message: 'I would love to swap my beach resort for your Paris hotel!',
          conditions: ['Flexible check-in time preferred'],
          agreedToTerms: true,
        })
      );

      // Should close the modal
      expect(onClose).toHaveBeenCalled();

      // Should add success notification to store
      const state = store.getState();
      expect(state.notifications.notifications).toHaveLength(1);
      expect(state.notifications.notifications[0]).toMatchObject({
        type: 'swap_proposal',
        title: 'Proposal Submitted Successfully',
        data: {
          proposalId: mockProposalResponse.proposalId,
          targetSwapId: mockTargetSwap.id,
          sourceSwapId: 'eligible-swap-1',
        },
      });
    });

    it('should handle compatibility score loading and display', async () => {
      // Mock delayed compatibility response
      mockSwapApiService.getSwapCompatibility.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockCompatibilityAnalysis), 100))
      );

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Wait for eligible swaps to load
      await waitFor(() => {
        expect(screen.getByText('Beach Resort in Miami')).toBeInTheDocument();
      });

      // Should show loading state for compatibility
      expect(screen.getByText(/analyzing compatibility/i)).toBeInTheDocument();

      // Wait for compatibility to load
      await waitFor(() => {
        expect(screen.getByText(/85% excellent match/i)).toBeInTheDocument();
      }, { timeout: 2000 });

      // Verify compatibility API was called
      expect(mockSwapApiService.getSwapCompatibility).toHaveBeenCalledWith(
        'eligible-swap-1',
        mockTargetSwap.id,
        expect.any(Object)
      );
    });

    it('should handle request cancellation when modal closes', async () => {
      const mockAbortController = new AbortController();
      const abortSpy = vi.spyOn(mockAbortController, 'abort');
      mockSwapApiService.createAbortController.mockReturnValue(mockAbortController);

      const { rerender } = render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(mockSwapApiService.getEligibleSwaps).toHaveBeenCalled();
      });

      // Close the modal
      rerender(
        <TestWrapper>
          <MakeProposalModal
            isOpen={false}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Should cancel in-flight requests
      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe('Authentication and Authorization Flow Tests', () => {
    it('should handle authentication errors and redirect to login', async () => {
      // Mock authentication error
      mockSwapApiService.getEligibleSwaps.mockRejectedValue(
        new SwapPlatformError(
          ERROR_CODES.INVALID_TOKEN,
          'Authentication required',
          'authentication'
        )
      );
      mockSwapApiService.isAuthenticated.mockReturnValue(false);

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Should show authentication error
      await waitFor(() => {
        expect(screen.getByText(/authentication required/i)).toBeInTheDocument();
      });

      // Should show login button
      const loginButton = screen.getByRole('button', { name: /log in/i });
      expect(loginButton).toBeInTheDocument();

      // Should clear tokens from localStorage when auth fails
      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('authToken');
    });

    it('should handle authorization errors for insufficient permissions', async () => {
      // Mock authorization error
      mockSwapApiService.getEligibleSwaps.mockRejectedValue(
        new SwapPlatformError(
          ERROR_CODES.ACCESS_DENIED,
          'You don\'t have permission to access this resource',
          'authorization'
        )
      );

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Should show authorization error
      await waitFor(() => {
        expect(screen.getByText(/don't have permission/i)).toBeInTheDocument();
      });

      // Should show retry option
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should handle token expiration during proposal submission', async () => {
      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Wait for eligible swaps to load
      await waitFor(() => {
        expect(screen.getByText('Beach Resort in Miami')).toBeInTheDocument();
      });

      // Select swap and fill form
      await user.click(screen.getByText('Beach Resort in Miami'));
      
      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Test message');
      
      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      // Mock token expiration during submission
      mockSwapApiService.createProposal.mockRejectedValue(
        new SwapPlatformError(
          ERROR_CODES.INVALID_TOKEN,
          'Your session has expired',
          'authentication'
        )
      );

      // Submit proposal
      const submitButton = screen.getByRole('button', { name: /send proposal/i });
      await user.click(submitButton);

      // Should show token expiration error
      await waitFor(() => {
        expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
      });

      // Should show login option
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });

    it('should validate authentication before making API calls', async () => {
      // Mock unauthenticated state
      mockSwapApiService.isAuthenticated.mockReturnValue(false);
      
      // Mock localStorage to return no token
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
      });

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Should show authentication required message
      await waitFor(() => {
        expect(screen.getByText(/user not authenticated/i)).toBeInTheDocument();
      });

      // Should not make API calls when not authenticated
      expect(mockSwapApiService.getEligibleSwaps).not.toHaveBeenCalled();
    });
  });

  describe('Error Scenarios and Recovery Mechanisms', () => {
    it('should handle network errors with retry functionality', async () => {
      // Mock network error
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error. Please check your internet connection.',
        'integration',
        true
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(networkError);

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Should show network error
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Should show retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Mock successful retry
      mockSwapApiService.getEligibleSwaps.mockResolvedValue(mockEligibleSwapsResponse);

      // Click retry
      await user.click(retryButton);

      // Should retry and show eligible swaps
      await waitFor(() => {
        expect(screen.getByText('Beach Resort in Miami')).toBeInTheDocument();
      });

      // Should have called API twice (initial + retry)
      expect(mockSwapApiService.getEligibleSwaps).toHaveBeenCalledTimes(2);
    });

    it('should handle validation errors during proposal submission', async () => {
      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Wait for eligible swaps to load
      await waitFor(() => {
        expect(screen.getByText('Beach Resort in Miami')).toBeInTheDocument();
      });

      // Select swap and navigate to form
      await user.click(screen.getByText('Beach Resort in Miami'));
      
      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      // Mock validation error
      const validationError = new ValidationError(
        'Invalid proposal data',
        { 
          message: ['Message is required'],
          conditions: ['At least one condition must be specified']
        }
      );

      mockSwapApiService.createProposal.mockRejectedValue(validationError);

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /send proposal/i });
      await user.click(submitButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/message is required/i)).toBeInTheDocument();
      });
    });

    it('should handle server errors with exponential backoff retry', async () => {
      // Mock server error
      const serverError = new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'An unexpected error occurred. Please try again.',
        'server_error',
        true
      );

      mockSwapApiService.getEligibleSwaps
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue(mockEligibleSwapsResponse);

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Should show server error
      await waitFor(() => {
        expect(screen.getByText(/unexpected error occurred/i)).toBeInTheDocument();
      });

      // Should show retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // First retry should fail
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText(/unexpected error occurred/i)).toBeInTheDocument();
      });

      // Second retry should succeed
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Beach Resort in Miami')).toBeInTheDocument();
      });

      // Should have called API three times (initial + 2 retries)
      expect(mockSwapApiService.getEligibleSwaps).toHaveBeenCalledTimes(3);
    });

    it('should handle rate limiting errors', async () => {
      // Mock rate limiting error
      const rateLimitError = new SwapPlatformError(
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        'Too many requests. Please try again later.',
        'rate_limiting',
        true
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValue(rateLimitError);

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Should show rate limiting error
      await waitFor(() => {
        expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
      });

      // Should show retry option
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should handle business logic errors', async () => {
      // Mock business logic error
      const businessError = new BusinessLogicError(
        ERROR_CODES.INVALID_SWAP_STATE,
        'This swap is no longer available for proposals'
      );

      mockSwapApiService.createProposal.mockRejectedValue(businessError);

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Wait for eligible swaps and select one
      await waitFor(() => {
        expect(screen.getByText('Beach Resort in Miami')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Beach Resort in Miami'));
      
      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      // Fill form and submit
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Test message');
      
      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /send proposal/i });
      await user.click(submitButton);

      // Should show business logic error
      await waitFor(() => {
        expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
      });
    });

    it('should handle circuit breaker activation', async () => {
      // Mock multiple consecutive failures to trigger circuit breaker
      const serverError = new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Service unavailable',
        'server_error',
        true
      );

      // Mock the circuit breaker being triggered
      mockSwapApiService.getEligibleSwaps.mockRejectedValue(serverError);

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Should show error with circuit breaker information
      await waitFor(() => {
        expect(screen.getByText(/service unavailable/i)).toBeInTheDocument();
      });

      // Should show circuit breaker status if implemented
      // This would depend on the specific circuit breaker implementation
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large numbers of eligible swaps efficiently', async () => {
      // Create 50 mock eligible swaps
      const manySwaps = Array.from({ length: 50 }, (_, i) => ({
        ...mockEligibleSwaps[0],
        id: `eligible-swap-${i}`,
        title: `Swap Option ${i + 1}`,
      }));

      const largeResponse: EligibleSwapResponse = {
        swaps: manySwaps,
        totalCount: 50,
        compatibilityThreshold: 60,
      };

      mockSwapApiService.getEligibleSwaps.mockResolvedValue(largeResponse);

      const startTime = performance.now();

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Wait for all swaps to load
      await waitFor(() => {
        expect(screen.getByText('Swap Option 1')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 2 seconds)
      expect(renderTime).toBeLessThan(2000);

      // Should show pagination or virtualization for large lists
      // This would depend on the specific implementation
    });

    it('should handle empty eligible swaps response', async () => {
      const emptyResponse: EligibleSwapResponse = {
        swaps: [],
        totalCount: 0,
        compatibilityThreshold: 60,
      };

      mockSwapApiService.getEligibleSwaps.mockResolvedValue(emptyResponse);

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Should show no eligible swaps message
      await waitFor(() => {
        expect(screen.getByText(/no eligible swaps found/i)).toBeInTheDocument();
      });

      // Should provide helpful guidance
      expect(screen.getByText(/create more swaps/i)).toBeInTheDocument();
    });

    it('should handle malformed API responses gracefully', async () => {
      // Mock malformed response
      const malformedResponse = {
        // Missing required fields
        swaps: null,
        totalCount: 'invalid',
      } as any;

      mockSwapApiService.getEligibleSwaps.mockResolvedValue(malformedResponse);

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Should handle malformed response gracefully
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    it('should handle concurrent API calls correctly', async () => {
      // Mock delayed responses to test concurrent calls
      mockSwapApiService.getEligibleSwaps.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockEligibleSwapsResponse), 100))
      );

      mockSwapApiService.getSwapCompatibility.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockCompatibilityAnalysis), 150))
      );

      render(
        <TestWrapper>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Should handle concurrent API calls without race conditions
      await waitFor(() => {
        expect(screen.getByText('Beach Resort in Miami')).toBeInTheDocument();
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(screen.getByText(/85% excellent match/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Both API calls should have been made
      expect(mockSwapApiService.getEligibleSwaps).toHaveBeenCalled();
      expect(mockSwapApiService.getSwapCompatibility).toHaveBeenCalled();
    });
  });
});