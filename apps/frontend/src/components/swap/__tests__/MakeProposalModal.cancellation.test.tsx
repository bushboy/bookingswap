import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MakeProposalModal } from '../MakeProposalModal';
import { useProposalModal } from '../../../hooks/useProposalModal';
import { useAuth } from '../../../contexts/AuthContext';
import { useAuthenticationGuard } from '../../../hooks/useAuthenticationGuard';
import { useAnnouncements } from '../../../hooks/useAccessibility';
import { useAppDispatch } from '../../../store/hooks';
import type { SwapWithProposalInfo } from '@booking-swap/shared';

// Mock all the hooks and dependencies
vi.mock('../../../hooks/useProposalModal');
vi.mock('../../../contexts/AuthContext');
vi.mock('../../../hooks/useAuthenticationGuard');
vi.mock('../../../hooks/useAccessibility');
vi.mock('../../../store/hooks');
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false }),
}));

const mockUseProposalModal = vi.mocked(useProposalModal);
const mockUseAuth = vi.mocked(useAuth);
const mockUseAuthenticationGuard = vi.mocked(useAuthenticationGuard);
const mockUseAnnouncements = vi.mocked(useAnnouncements);
const mockUseAppDispatch = vi.mocked(useAppDispatch);

describe('MakeProposalModal - Request Cancellation', () => {
  const mockTargetSwap: SwapWithProposalInfo = {
    id: 'target-swap-123',
    title: 'Target Swap',
    bookingDetails: {
      location: 'Test Location',
      dateRange: {
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-07'),
      },
      accommodationType: 'Hotel',
      guests: 2,
      estimatedValue: 500,
    },
    proposalCount: 0,
    hasUserProposed: false,
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockCancelRequests = vi.fn();
  const mockReset = vi.fn();
  const mockAnnounce = vi.fn();
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useAuth
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      loading: false,
    });

    // Mock useAuthenticationGuard
    mockUseAuthenticationGuard.mockReturnValue({
      requireAuthentication: vi.fn().mockReturnValue(true),
      isAuthError: vi.fn().mockReturnValue(false),
      isAuthorizationError: vi.fn().mockReturnValue(false),
      handleAuthError: vi.fn(),
      getAuthErrorMessage: vi.fn(),
    });

    // Mock useAnnouncements
    mockUseAnnouncements.mockReturnValue({
      announce: mockAnnounce,
    });

    // Mock useAppDispatch
    mockUseAppDispatch.mockReturnValue(mockDispatch);

    // Mock useProposalModal with cancelRequests function
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
      reset: mockReset,
      getCompatibilityScore: vi.fn(),
      getCompatibilityAnalysis: vi.fn(),
      isLoadingCompatibility: vi.fn(),
      refreshCompatibilityScore: vi.fn(),
      cancelRequests: mockCancelRequests,
      fetchEligibleSwaps: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should call cancelRequests when modal closes', () => {
    const { rerender } = render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    // Verify initial state - cancelRequests should not be called yet
    expect(mockCancelRequests).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();

    // Close the modal
    rerender(
      <MakeProposalModal
        isOpen={false}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    // Verify that cancelRequests and reset were called when modal closed
    expect(mockCancelRequests).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('should call cancelRequests on component unmount', () => {
    const { unmount } = render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    // Clear previous calls from the initial render
    mockCancelRequests.mockClear();

    // Unmount the component
    unmount();

    // Verify that cancelRequests was called during unmount
    expect(mockCancelRequests).toHaveBeenCalledTimes(1);
  });

  it('should call cancelRequests before reset when modal closes', () => {
    const { rerender } = render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    // Close the modal
    rerender(
      <MakeProposalModal
        isOpen={false}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    // Verify that cancelRequests was called before reset
    expect(mockCancelRequests).toHaveBeenCalledBefore(mockReset);
  });

  it('should handle multiple open/close cycles correctly', () => {
    const { rerender } = render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    // Close and reopen multiple times
    for (let i = 0; i < 3; i++) {
      // Close
      rerender(
        <MakeProposalModal
          isOpen={false}
          onClose={vi.fn()}
          targetSwap={mockTargetSwap}
          onSubmit={vi.fn()}
        />
      );

      // Reopen
      rerender(
        <MakeProposalModal
          isOpen={true}
          onClose={vi.fn()}
          targetSwap={mockTargetSwap}
          onSubmit={vi.fn()}
        />
      );
    }

    // Verify cancelRequests was called for each close
    expect(mockCancelRequests).toHaveBeenCalledTimes(3);
    expect(mockReset).toHaveBeenCalledTimes(3);
  });

  it('should not call cancelRequests when modal remains open', () => {
    const { rerender } = render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    mockCancelRequests.mockClear();
    mockReset.mockClear();

    // Re-render with modal still open but different props
    rerender(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
        loading={true} // Different prop
      />
    );

    // Verify cancelRequests was not called since modal remained open
    expect(mockCancelRequests).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('should handle cancelRequests errors gracefully', () => {
    // Make cancelRequests throw an error
    mockCancelRequests.mockImplementation(() => {
      throw new Error('Cancel requests failed');
    });

    const { rerender } = render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    // Should not throw when closing modal even if cancelRequests fails
    expect(() => {
      rerender(
        <MakeProposalModal
          isOpen={false}
          onClose={vi.fn()}
          targetSwap={mockTargetSwap}
          onSubmit={vi.fn()}
        />
      );
    }).not.toThrow();

    // Verify cancelRequests was still called
    expect(mockCancelRequests).toHaveBeenCalledTimes(1);
  });

  it('should pass correct parameters to useProposalModal hook', () => {
    render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    // Verify useProposalModal was called with correct parameters
    expect(mockUseProposalModal).toHaveBeenCalledWith({
      userId: mockUser.id,
      targetSwapId: mockTargetSwap.id,
      autoFetch: true, // isOpen && !!user?.id
    });
  });

  it('should not auto-fetch when modal is closed', () => {
    render(
      <MakeProposalModal
        isOpen={false}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    // Verify useProposalModal was called with autoFetch: false
    expect(mockUseProposalModal).toHaveBeenCalledWith({
      userId: mockUser.id,
      targetSwapId: mockTargetSwap.id,
      autoFetch: false, // isOpen && !!user?.id = false && true = false
    });
  });

  it('should not auto-fetch when user is not available', () => {
    // Mock no user
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      loading: false,
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    // Verify useProposalModal was called with autoFetch: false
    expect(mockUseProposalModal).toHaveBeenCalledWith({
      userId: '',
      targetSwapId: mockTargetSwap.id,
      autoFetch: false, // isOpen && !!user?.id = true && false = false
    });
  });
});