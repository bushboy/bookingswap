import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MakeProposalModal } from '../MakeProposalModal';
import { useProposalModal } from '../../../hooks/useProposalModal';
import type { EligibleSwap, CompatibilityScore, CompatibilityAnalysis } from '../../../types/api';

// Mock the useProposalModal hook
vi.mock('../../../hooks/useProposalModal');

// Mock other dependencies
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));

vi.mock('../../../hooks/useAuthenticationGuard', () => ({
  useAuthenticationGuard: () => ({
    requireAuthentication: vi.fn(() => true),
    isAuthError: vi.fn(() => false),
    isAuthorizationError: vi.fn(() => false),
  }),
}));

vi.mock('../../../hooks/useAccessibility', () => ({
  useAnnouncements: () => ({ announce: vi.fn() }),
}));

vi.mock('../../../store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
}));

const mockUseProposalModal = vi.mocked(useProposalModal);

describe('MakeProposalModal - Compatibility Display', () => {
  const mockTargetSwap = {
    id: 'target-swap-1',
    title: 'Target Swap',
  };

  const mockEligibleSwaps: EligibleSwap[] = [
    {
      id: 'swap-1',
      title: 'Test Swap 1',
      bookingDetails: {
        location: 'New York',
        accommodationType: 'Hotel',
        guests: 2,
        estimatedValue: 1000,
        dateRange: {
          checkIn: new Date('2024-01-01'),
          checkOut: new Date('2024-01-07'),
        },
      },
      compatibilityScore: 85,
      eligibilityReasons: ['Similar location', 'Matching dates'],
      isEligible: true,
    },
    {
      id: 'swap-2',
      title: 'Test Swap 2',
      bookingDetails: {
        location: 'Los Angeles',
        accommodationType: 'Apartment',
        guests: 4,
        estimatedValue: 1500,
        dateRange: {
          checkIn: new Date('2024-02-01'),
          checkOut: new Date('2024-02-07'),
        },
      },
      compatibilityScore: 65,
      eligibilityReasons: ['Good value match'],
      isEligible: true,
    },
  ];

  const mockCompatibilityScore: CompatibilityScore = {
    value: 85,
    level: 'excellent',
    displayText: '85% - Excellent Match',
    styleClass: 'compatibility-excellent',
  };

  const mockCompatibilityAnalysis: CompatibilityAnalysis = {
    score: 85,
    reasons: ['Similar location', 'Matching dates', 'Compatible accommodation type'],
    isEligible: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: mockEligibleSwaps,
      loading: false,
      error: null,
      submitting: false,
      submitError: null,
      canRetry: false,
      retryCount: 0,
      getCompatibilityScore: vi.fn((swapId: string) => 
        swapId === 'swap-1' ? mockCompatibilityScore : null
      ),
      getCompatibilityAnalysis: vi.fn((swapId: string) => 
        swapId === 'swap-1' ? mockCompatibilityAnalysis : null
      ),
      isLoadingCompatibility: vi.fn(() => false),
      refreshCompatibilityScore: vi.fn(),
      fetchEligibleSwaps: vi.fn(),
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn(),
    });
  });

  it('should display compatibility scores for eligible swaps', async () => {
    render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('85% excellent match')).toBeInTheDocument();
    });
  });

  it('should display eligibility reasons from compatibility analysis', async () => {
    render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Similar location, Matching dates/)).toBeInTheDocument();
    });
  });

  it('should show loading state for compatibility analysis', async () => {
    mockUseProposalModal.mockReturnValue({
      ...mockUseProposalModal(),
      isLoadingCompatibility: vi.fn((swapId: string) => swapId === 'swap-1'),
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    });
  });

  it('should show fallback when compatibility score is unavailable', async () => {
    mockUseProposalModal.mockReturnValue({
      ...mockUseProposalModal(),
      getCompatibilityScore: vi.fn(() => null),
      getCompatibilityAnalysis: vi.fn(() => null),
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Score unavailable')).toBeInTheDocument();
    });
  });

  it('should call refreshCompatibilityScore when score is clicked', async () => {
    const mockRefreshCompatibilityScore = vi.fn();
    
    mockUseProposalModal.mockReturnValue({
      ...mockUseProposalModal(),
      refreshCompatibilityScore: mockRefreshCompatibilityScore,
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    const scoreElement = await screen.findByText('85% excellent match');
    scoreElement.click();

    expect(mockRefreshCompatibilityScore).toHaveBeenCalledWith('swap-1');
  });
});