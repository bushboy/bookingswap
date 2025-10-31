import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MakeProposalModal } from '../MakeProposalModal';
import { useAuth } from '../../../contexts/AuthContext';
import { useProposalModal } from '../../../hooks/useProposalModal';
import { useAnnouncements } from '../../../hooks/useAccessibility';

// Mock dependencies
vi.mock('../../../contexts/AuthContext');
vi.mock('../../../hooks/useProposalModal');
vi.mock('../../../hooks/useAccessibility');
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false })
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseProposalModal = vi.mocked(useProposalModal);
const mockUseAnnouncements = vi.mocked(useAnnouncements);

describe('MakeProposalModal - Loading States', () => {
  const mockTargetSwap = {
    id: 'target-swap-1',
    title: 'Test Target Swap',
    bookingDetails: {
      location: 'Test Location',
      accommodationType: 'Hotel',
      guests: 2,
      estimatedValue: 1000
    }
  };

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com'
  };

  const mockAnnounce = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      loading: false
    });

    mockUseAnnouncements.mockReturnValue({
      announce: mockAnnounce
    });
  });

  it('shows initialization loading state when user or targetSwap is missing', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      loading: true
    });

    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: [],
      loading: false,
      error: null,
      submitting: false,
      submitError: null,
      canRetry: false,
      retryCount: 0,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Preparing Proposal Modal')).toBeInTheDocument();
    expect(screen.getByText('Loading your account information...')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Initializing proposal modal' })).toBeInTheDocument();
  });

  it('shows skeleton loaders when loading eligible swaps', () => {
    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: [],
      loading: true,
      error: null,
      submitting: false,
      submitError: null,
      canRetry: false,
      retryCount: 0,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Your available swaps:')).toBeInTheDocument();
    expect(screen.getByText('Loading your swaps...')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading eligible swaps' })).toBeInTheDocument();
    
    // Should show 3 skeleton loaders
    const skeletons = screen.getAllByRole('status', { name: 'Loading eligible swap' });
    expect(skeletons).toHaveLength(3);
  });

  it('shows submission loading state when submitting proposal', () => {
    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: [{
        id: 'swap-1',
        title: 'Test Swap',
        bookingDetails: {
          location: 'Test Location',
          accommodationType: 'Hotel',
          guests: 2,
          estimatedValue: 1000
        },
        compatibilityScore: 85,
        eligibilityReasons: ['Good match'],
        isEligible: true
      }],
      loading: false,
      error: null,
      submitting: true,
      submitError: null,
      canRetry: false,
      retryCount: 0,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
    });

    // Mock that we're in the form view (showForm = true)
    const { rerender } = render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    // Click on a swap to go to form view
    const selectButton = screen.getByText('Select This Swap');
    selectButton.click();

    // Should show submission loading state
    expect(screen.getByText('Submitting Your Proposal')).toBeInTheDocument();
    expect(screen.getByText('Please wait while we process your proposal...')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Submitting proposal' })).toBeInTheDocument();
  });

  it('announces loading states for accessibility', async () => {
    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: [],
      loading: true,
      error: null,
      submitting: false,
      submitError: null,
      canRetry: false,
      retryCount: 0,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
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
      expect(mockAnnounce).toHaveBeenCalledWith('Loading your eligible swaps', 'polite');
    });
  });

  it('announces successful data loading', async () => {
    const mockSwaps = [{
      id: 'swap-1',
      title: 'Test Swap',
      bookingDetails: {
        location: 'Test Location',
        accommodationType: 'Hotel',
        guests: 2,
        estimatedValue: 1000
      },
      compatibilityScore: 85,
      eligibilityReasons: ['Good match'],
      isEligible: true
    }];

    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: mockSwaps,
      loading: false,
      error: null,
      submitting: false,
      submitError: null,
      canRetry: false,
      retryCount: 0,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
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
      expect(mockAnnounce).toHaveBeenCalledWith('Found 1 eligible swap', 'polite');
    });
  });

  it('announces errors for accessibility', async () => {
    const errorMessage = 'Failed to load swaps';
    
    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: [],
      loading: false,
      error: errorMessage,
      submitting: false,
      submitError: null,
      canRetry: true,
      retryCount: 1,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
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
      expect(mockAnnounce).toHaveBeenCalledWith(`Error loading swaps: ${errorMessage}`, 'assertive');
    });
  });

  it('shows loading indicator on retry button when retrying', () => {
    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: [],
      loading: true, // Currently loading (retrying)
      error: 'Previous error',
      submitting: false,
      submitError: null,
      canRetry: true,
      retryCount: 1,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    const retryButton = screen.getByRole('button', { name: /retrying/i });
    expect(retryButton).toBeDisabled();
    expect(screen.getByText('Retrying...')).toBeInTheDocument();
  });

  it('shows enhanced loading message when loading swaps', () => {
    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: [],
      loading: true,
      error: null,
      submitting: false,
      submitError: null,
      canRetry: false,
      retryCount: 0,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Finding your compatible swaps...')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading eligible swaps')).toBeInTheDocument();
  });

  it('shows enhanced submission loading state with proper styling', () => {
    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: [{
        id: 'swap-1',
        title: 'Test Swap',
        bookingDetails: {
          location: 'Test Location',
          accommodationType: 'Hotel',
          guests: 2,
          estimatedValue: 1000
        },
        compatibilityScore: 85,
        eligibilityReasons: ['Good match'],
        isEligible: true
      }],
      loading: false,
      error: null,
      submitting: true,
      submitError: null,
      canRetry: false,
      retryCount: 0,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
    });

    const { rerender } = render(
      <MakeProposalModal
        isOpen={true}
        onClose={vi.fn()}
        targetSwap={mockTargetSwap}
        onSubmit={vi.fn()}
      />
    );

    // Click on a swap to go to form view
    const selectButton = screen.getByText('Select This Swap');
    selectButton.click();

    expect(screen.getByText('Submitting Your Proposal')).toBeInTheDocument();
    expect(screen.getByText(/We're sending your proposal to the swap owner/)).toBeInTheDocument();
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('provides detailed accessibility announcements for different loading scenarios', async () => {
    // Test loading announcement
    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: [],
      loading: true,
      error: null,
      submitting: false,
      submitError: null,
      canRetry: false,
      retryCount: 0,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
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
      expect(mockAnnounce).toHaveBeenCalledWith(
        'Loading your eligible swaps. Please wait while we find compatible options.', 
        'polite'
      );
    });
  });

  it('announces high compatibility swaps when loaded', async () => {
    const mockSwaps = [
      {
        id: 'swap-1',
        title: 'High Compatibility Swap',
        bookingDetails: {
          location: 'Test Location',
          accommodationType: 'Hotel',
          guests: 2,
          estimatedValue: 1000
        },
        compatibilityScore: 90,
        eligibilityReasons: ['Excellent match'],
        isEligible: true
      },
      {
        id: 'swap-2',
        title: 'Medium Compatibility Swap',
        bookingDetails: {
          location: 'Test Location 2',
          accommodationType: 'Apartment',
          guests: 4,
          estimatedValue: 1200
        },
        compatibilityScore: 70,
        eligibilityReasons: ['Good match'],
        isEligible: true
      }
    ];

    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: mockSwaps,
      loading: false,
      error: null,
      submitting: false,
      submitError: null,
      canRetry: false,
      retryCount: 0,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: vi.fn(),
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
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
      expect(mockAnnounce).toHaveBeenCalledWith(
        'Found 2 eligible swaps 1 with excellent compatibility.', 
        'polite'
      );
    });
  });
});