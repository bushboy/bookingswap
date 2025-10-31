import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MakeProposalModal } from '../MakeProposalModal';
import { useProposalModal } from '../../../hooks/useProposalModal';
import { useAuth } from '../../../contexts/AuthContext';
import { useAnnouncements } from '../../../hooks/useAccessibility';

// Mock dependencies
vi.mock('../../../hooks/useProposalModal');
vi.mock('../../../contexts/AuthContext');
vi.mock('../../../hooks/useAccessibility');
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false })
}));
vi.mock('../../../hooks/useAuthenticationGuard', () => ({
  useAuthenticationGuard: () => ({
    requireAuthentication: vi.fn(),
    isAuthError: vi.fn(() => false),
    isAuthorizationError: vi.fn(() => false),
  })
}));
vi.mock('../../../store/hooks', () => ({
  useAppDispatch: () => vi.fn()
}));

const mockTargetSwap = {
  id: 'target-swap-1',
  title: 'Target Swap',
  location: 'Test Location',
  accommodationType: 'Apartment',
  guests: 2,
  estimatedValue: 1000,
};

const mockEligibleSwaps = [
  {
    id: 'swap-1',
    title: 'Test Swap 1',
    bookingDetails: {
      location: 'Location 1',
      accommodationType: 'House',
      guests: 4,
      estimatedValue: 1200,
    },
    compatibilityScore: 85,
    eligibilityReasons: ['Great location match', 'Similar value'],
    isEligible: true,
  },
  {
    id: 'swap-2',
    title: 'Test Swap 2',
    bookingDetails: {
      location: 'Location 2',
      accommodationType: 'Condo',
      guests: 2,
      estimatedValue: 800,
    },
    compatibilityScore: 65,
    eligibilityReasons: ['Good date overlap'],
    isEligible: true,
  },
];

describe('MakeProposalModal Accessibility Enhancements', () => {
  const mockAnnounce = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useAuth as any).mockReturnValue({
      user: { id: 'user-1', name: 'Test User' }
    });

    (useAnnouncements as any).mockReturnValue({
      announce: mockAnnounce
    });

    (useProposalModal as any).mockReturnValue({
      eligibleSwaps: mockEligibleSwaps,
      loading: false,
      error: null,
      submitting: false,
      submitError: null,
      canRetry: false,
      circuitBreakerTriggered: false,
      serviceHealthy: true,
      submitProposal: vi.fn(),
      retry: vi.fn(),
      manualRetry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      resetCircuitBreaker: vi.fn(),
      getCompatibilityScore: vi.fn((id) => ({
        value: id === 'swap-1' ? 85 : 65,
        level: id === 'swap-1' ? 'excellent' : 'good'
      })),
      getCompatibilityAnalysis: vi.fn((id) => ({
        reasons: id === 'swap-1' ? ['Great location match', 'Similar value'] : ['Good date overlap']
      })),
      isLoadingCompatibility: vi.fn(() => false),
      refreshCompatibilityScore: vi.fn(),
      cancelRequests: vi.fn(),
    });
  });

  it('should announce loading state with accessibility information', async () => {
    (useProposalModal as any).mockReturnValue({
      ...((useProposalModal as any)()).mockReturnValue,
      loading: true,
      eligibleSwaps: [],
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(mockAnnounce).toHaveBeenCalledWith(
        'Loading your eligible swaps. Please wait while we find compatible options.',
        'polite'
      );
    });
  });

  it('should announce successful swap loading with compatibility breakdown', async () => {
    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(mockAnnounce).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 eligible swaps including 1 with excellent compatibility, 1 with good compatibility'),
        'polite'
      );
    });
  });

  it('should have proper ARIA labels on swap selection cards', () => {
    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    const swapCard = screen.getByRole('button', { 
      name: /Select Test Swap 1 for your proposal.*85% excellent match/i 
    });
    expect(swapCard).toBeInTheDocument();
    expect(swapCard).toHaveAttribute('tabIndex', '0');
    expect(swapCard).toHaveAttribute('aria-describedby');
  });

  it('should support keyboard navigation on swap cards', () => {
    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    const swapCard = screen.getByRole('button', { 
      name: /Select Test Swap 1 for your proposal/i 
    });
    
    // Test Enter key
    fireEvent.keyDown(swapCard, { key: 'Enter' });
    expect(mockAnnounce).toHaveBeenCalledWith(
      'Selected Test Swap 1 for your proposal. Now filling out proposal details.',
      'polite'
    );
  });

  it('should show keyboard shortcuts help when toggled', () => {
    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    const shortcutsButton = screen.getByRole('button', { name: /Show keyboard shortcuts/i });
    fireEvent.click(shortcutsButton);

    expect(screen.getByText('Available Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText(/Escape.*Close modal/)).toBeInTheDocument();
    expect(screen.getByText(/Tab.*Navigate between elements/)).toBeInTheDocument();
  });

  it('should have proper ARIA labels for loading states', () => {
    (useProposalModal as any).mockReturnValue({
      ...((useProposalModal as any)()).mockReturnValue,
      loading: true,
      eligibleSwaps: [],
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    const loadingRegion = screen.getByRole('status', { name: /Loading eligible swaps/i });
    expect(loadingRegion).toBeInTheDocument();
    expect(loadingRegion).toHaveAttribute('aria-live', 'polite');
    expect(loadingRegion).toHaveAttribute('aria-describedby');
  });

  it('should announce errors with recovery guidance', async () => {
    (useProposalModal as any).mockReturnValue({
      ...((useProposalModal as any)()).mockReturnValue,
      error: 'Network error',
      canRetry: true,
      eligibleSwaps: [],
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(mockAnnounce).toHaveBeenCalledWith(
        expect.stringContaining('Error loading swaps: Network error You can retry by pressing the Retry button or using Alt+R'),
        'assertive'
      );
    });
  });

  it('should support keyboard shortcuts for error recovery', () => {
    const mockRetry = vi.fn();
    (useProposalModal as any).mockReturnValue({
      ...((useProposalModal as any)()).mockReturnValue,
      error: 'Network error',
      canRetry: true,
      retry: mockRetry,
      eligibleSwaps: [],
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    // Test Alt+R shortcut
    fireEvent.keyDown(document, { key: 'r', altKey: true });
    
    expect(mockRetry).toHaveBeenCalled();
    expect(mockAnnounce).toHaveBeenCalledWith('Retrying to load eligible swaps', 'polite');
  });

  it('should have proper modal accessibility attributes', () => {
    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('aria-describedby');
  });

  it('should provide hidden descriptions for screen readers', () => {
    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    // Check for hidden modal description
    const modalDescription = document.getElementById('modal-description');
    expect(modalDescription).toBeInTheDocument();
    expect(modalDescription).toHaveTextContent(/This modal allows you to select one of your eligible swaps/);

    // Check for keyboard shortcuts info
    const keyboardInfo = document.getElementById('keyboard-shortcuts-info');
    expect(keyboardInfo).toBeInTheDocument();
    expect(keyboardInfo).toHaveTextContent(/Keyboard navigation is fully supported/);
  });
});