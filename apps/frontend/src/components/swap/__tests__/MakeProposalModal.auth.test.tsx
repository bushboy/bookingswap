import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MakeProposalModal } from '../MakeProposalModal';
import { AuthProvider } from '../../../contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../../../store';
import { SwapPlatformError, ERROR_CODES } from '@booking-swap/shared';

// Mock the API service
vi.mock('../../../services/swapApiService', () => ({
  swapApiService: {
    getEligibleSwaps: vi.fn(),
    createProposal: vi.fn(),
    isAuthenticated: vi.fn(),
  },
}));

// Mock the hooks
vi.mock('../../../hooks/useProposalModal', () => ({
  useProposalModal: vi.fn(),
}));

vi.mock('../../../hooks/useAuthenticationGuard', () => ({
  useAuthenticationGuard: vi.fn(),
}));

vi.mock('../../../hooks/useAccessibility', () => ({
  useAnnouncements: () => ({
    announce: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: false,
  }),
}));

const mockTargetSwap = {
  id: 'target-swap-1',
  title: 'Test Target Swap',
  bookingDetails: {
    dateRange: {
      checkIn: new Date('2024-06-01'),
      checkOut: new Date('2024-06-07'),
    },
    location: 'Test Location',
    guests: 2,
    propertyType: 'apartment',
  },
  description: 'Test swap description',
  images: [],
  amenities: [],
  userId: 'other-user-id',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const TestWrapper: React.FC<{ children: React.ReactNode; user?: any }> = ({ 
  children, 
  user = null 
}) => {
  // Mock AuthContext value
  const authValue = {
    user,
    token: user ? 'mock-token' : null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
    isAuthenticated: !!user,
  };

  return (
    <Provider store={store}>
      <BrowserRouter>
        <AuthProvider value={authValue}>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </Provider>
  );
};

describe('MakeProposalModal - Authentication & Authorization', () => {
  const mockUseProposalModal = vi.mocked(
    require('../../../hooks/useProposalModal').useProposalModal
  );
  const mockUseAuthenticationGuard = vi.mocked(
    require('../../../hooks/useAuthenticationGuard').useAuthenticationGuard
  );

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: [],
      loading: false,
      error: null,
      submitting: false,
      submitError: null,
      canRetry: false,
      retryCount: 0,
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn(),
      fetchEligibleSwaps: vi.fn(),
    });

    mockUseAuthenticationGuard.mockReturnValue({
      requireAuthentication: vi.fn(() => true),
      handleAuthError: vi.fn(),
      isAuthError: vi.fn(() => false),
      isAuthorizationError: vi.fn(() => false),
      getAuthErrorMessage: vi.fn((error) => error.message),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication Handling', () => {
    it('should show authentication error when user is not logged in', () => {
      render(
        <TestWrapper user={null}>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/authentication/i)).toBeInTheDocument();
      expect(screen.getByText(/not authenticated/i)).toBeInTheDocument();
    });

    it('should call requireAuthentication when login button is clicked', async () => {
      const mockRequireAuthentication = vi.fn();
      mockUseAuthenticationGuard.mockReturnValue({
        requireAuthentication: mockRequireAuthentication,
        handleAuthError: vi.fn(),
        isAuthError: vi.fn(() => false),
        isAuthorizationError: vi.fn(() => false),
        getAuthErrorMessage: vi.fn((error) => error.message),
      });

      render(
        <TestWrapper user={null}>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      const loginButton = screen.getByRole('button', { name: /login/i });
      fireEvent.click(loginButton);

      expect(mockRequireAuthentication).toHaveBeenCalled();
    });

    it('should handle authentication errors in eligible swaps loading', () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        verificationLevel: 'verified',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const authError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Your session has expired',
        'authentication'
      );

      mockUseAuthenticationGuard.mockReturnValue({
        requireAuthentication: vi.fn(() => true),
        handleAuthError: vi.fn(),
        isAuthError: vi.fn((error) => error === authError),
        isAuthorizationError: vi.fn(() => false),
        getAuthErrorMessage: vi.fn(() => 'Your session has expired. Please log in again.'),
      });

      mockUseProposalModal.mockReturnValue({
        eligibleSwaps: [],
        loading: false,
        error: authError.message,
        submitting: false,
        submitError: null,
        canRetry: false,
        retryCount: 0,
        submitProposal: vi.fn(),
        retry: vi.fn(),
        clearError: vi.fn(),
        clearSubmitError: vi.fn(),
        reset: vi.fn(),
        cancelRequests: vi.fn(),
        fetchEligibleSwaps: vi.fn(),
      });

      render(
        <TestWrapper user={mockUser}>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/authentication/i)).toBeInTheDocument();
    });

    it('should handle authorization errors in eligible swaps loading', () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        verificationLevel: 'verified',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const authzError = new SwapPlatformError(
        ERROR_CODES.ACCESS_DENIED,
        'You don\'t have permission to access this resource',
        'authorization'
      );

      mockUseAuthenticationGuard.mockReturnValue({
        requireAuthentication: vi.fn(() => true),
        handleAuthError: vi.fn(),
        isAuthError: vi.fn(() => false),
        isAuthorizationError: vi.fn((error) => error === authzError),
        getAuthErrorMessage: vi.fn(() => 'You don\'t have permission to access this resource.'),
      });

      mockUseProposalModal.mockReturnValue({
        eligibleSwaps: [],
        loading: false,
        error: authzError.message,
        submitting: false,
        submitError: null,
        canRetry: false,
        retryCount: 0,
        submitProposal: vi.fn(),
        retry: vi.fn(),
        clearError: vi.fn(),
        clearSubmitError: vi.fn(),
        reset: vi.fn(),
        cancelRequests: vi.fn(),
        fetchEligibleSwaps: vi.fn(),
      });

      render(
        <TestWrapper user={mockUser}>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/authorization/i)).toBeInTheDocument();
    });
  });

  describe('Proposal Submission Authentication', () => {
    it('should handle authentication errors during proposal submission', () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        verificationLevel: 'verified',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const authError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Your session has expired',
        'authentication'
      );

      mockUseAuthenticationGuard.mockReturnValue({
        requireAuthentication: vi.fn(() => true),
        handleAuthError: vi.fn(),
        isAuthError: vi.fn((error) => error === authError),
        isAuthorizationError: vi.fn(() => false),
        getAuthErrorMessage: vi.fn(() => 'Your session has expired. Please log in again.'),
      });

      mockUseProposalModal.mockReturnValue({
        eligibleSwaps: [
          {
            id: 'eligible-swap-1',
            title: 'Test Eligible Swap',
            bookingDetails: {
              dateRange: {
                checkIn: new Date('2024-07-01'),
                checkOut: new Date('2024-07-07'),
              },
              location: 'Test Location',
              guests: 2,
              propertyType: 'apartment',
            },
            compatibilityScore: 85,
            eligibilityReasons: ['Compatible dates', 'Similar location'],
            isEligible: true,
          },
        ],
        loading: false,
        error: null,
        submitting: false,
        submitError: authError.message,
        canRetry: false,
        retryCount: 0,
        submitProposal: vi.fn(),
        retry: vi.fn(),
        clearError: vi.fn(),
        clearSubmitError: vi.fn(),
        reset: vi.fn(),
        cancelRequests: vi.fn(),
        fetchEligibleSwaps: vi.fn(),
      });

      render(
        <TestWrapper user={mockUser}>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Click on a swap to go to the form
      const swapCard = screen.getByText('Test Eligible Swap');
      fireEvent.click(swapCard);

      // Should show authentication error in the form
      expect(screen.getByText(/authentication/i)).toBeInTheDocument();
    });

    it('should handle authorization errors during proposal submission', () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        verificationLevel: 'verified',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const authzError = new SwapPlatformError(
        ERROR_CODES.ACCESS_DENIED,
        'You don\'t have permission to create proposals for this swap',
        'authorization'
      );

      mockUseAuthenticationGuard.mockReturnValue({
        requireAuthentication: vi.fn(() => true),
        handleAuthError: vi.fn(),
        isAuthError: vi.fn(() => false),
        isAuthorizationError: vi.fn((error) => error === authzError),
        getAuthErrorMessage: vi.fn(() => 'You don\'t have permission to create proposals for this swap.'),
      });

      mockUseProposalModal.mockReturnValue({
        eligibleSwaps: [
          {
            id: 'eligible-swap-1',
            title: 'Test Eligible Swap',
            bookingDetails: {
              dateRange: {
                checkIn: new Date('2024-07-01'),
                checkOut: new Date('2024-07-07'),
              },
              location: 'Test Location',
              guests: 2,
              propertyType: 'apartment',
            },
            compatibilityScore: 85,
            eligibilityReasons: ['Compatible dates', 'Similar location'],
            isEligible: true,
          },
        ],
        loading: false,
        error: null,
        submitting: false,
        submitError: authzError.message,
        canRetry: false,
        retryCount: 0,
        submitProposal: vi.fn(),
        retry: vi.fn(),
        clearError: vi.fn(),
        clearSubmitError: vi.fn(),
        reset: vi.fn(),
        cancelRequests: vi.fn(),
        fetchEligibleSwaps: vi.fn(),
      });

      render(
        <TestWrapper user={mockUser}>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Click on a swap to go to the form
      const swapCard = screen.getByText('Test Eligible Swap');
      fireEvent.click(swapCard);

      // Should show authorization error in the form
      expect(screen.getByText(/authorization/i)).toBeInTheDocument();
    });
  });

  describe('Token Validation', () => {
    it('should validate authentication before making API calls', () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        verificationLevel: 'verified',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockRequireAuthentication = vi.fn(() => true);
      mockUseAuthenticationGuard.mockReturnValue({
        requireAuthentication: mockRequireAuthentication,
        handleAuthError: vi.fn(),
        isAuthError: vi.fn(() => false),
        isAuthorizationError: vi.fn(() => false),
        getAuthErrorMessage: vi.fn((error) => error.message),
      });

      render(
        <TestWrapper user={mockUser}>
          <MakeProposalModal
            isOpen={true}
            onClose={vi.fn()}
            targetSwap={mockTargetSwap}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // The useProposalModal hook should have been called with the user ID
      expect(mockUseProposalModal).toHaveBeenCalledWith({
        userId: mockUser.id,
        targetSwapId: mockTargetSwap.id,
        autoFetch: true,
      });
    });
  });
});