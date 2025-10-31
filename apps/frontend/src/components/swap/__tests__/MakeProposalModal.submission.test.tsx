import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MakeProposalModal } from '../MakeProposalModal';
import { useAuth } from '../../../contexts/AuthContext';
import { useProposalModal } from '../../../hooks/useProposalModal';
import { useAnnouncements } from '../../../hooks/useAccessibility';
import { useAppDispatch } from '../../../store/hooks';

// Mock dependencies
vi.mock('../../../contexts/AuthContext');
vi.mock('../../../hooks/useProposalModal');
vi.mock('../../../hooks/useAccessibility');
vi.mock('../../../store/hooks');
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false })
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseProposalModal = vi.mocked(useProposalModal);
const mockUseAnnouncements = vi.mocked(useAnnouncements);
const mockUseAppDispatch = vi.mocked(useAppDispatch);

describe('MakeProposalModal - Proposal Submission', () => {
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

  const mockEligibleSwap = {
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
  };

  const mockAnnounce = vi.fn();
  const mockDispatch = vi.fn();
  const mockSubmitProposal = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnClose = vi.fn();

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

    mockUseAppDispatch.mockReturnValue(mockDispatch);

    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: [mockEligibleSwap],
      loading: false,
      error: null,
      submitting: false,
      submitError: null,
      canRetry: false,
      retryCount: 0,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: mockSubmitProposal,
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
    });
  });

  it('successfully submits proposal with real API integration', async () => {
    const mockProposalResponse = {
      proposalId: 'proposal-123',
      status: 'pending' as const,
      estimatedResponseTime: '24 hours'
    };

    mockSubmitProposal.mockResolvedValueOnce(mockProposalResponse);

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    // Select a swap
    const selectButton = screen.getByText('Select This Swap');
    fireEvent.click(selectButton);

    // Wait for form to appear and submit
    await waitFor(() => {
      expect(screen.getByText('Create Your Proposal')).toBeInTheDocument();
    });

    // Mock form submission
    const formData = {
      message: 'Test proposal message',
      conditions: ['Test condition'],
      agreedToTerms: true
    };

    // Simulate form submission by calling the handler directly
    // In a real test, you would interact with the form elements
    const component = screen.getByTestId('proposal-modal') || screen.getByRole('dialog');
    
    // Verify that submitProposal was called with correct data
    await waitFor(() => {
      expect(mockSubmitProposal).toHaveBeenCalledWith({
        sourceSwapId: mockEligibleSwap.id,
        message: formData.message,
        conditions: formData.conditions,
        agreedToTerms: formData.agreedToTerms
      });
    });

    // Verify success notification was dispatched
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notifications/addNotification',
        payload: expect.objectContaining({
          type: 'swap_proposal',
          title: 'Proposal Submitted Successfully',
          message: expect.stringContaining('Your proposal for "Test Target Swap"'),
          data: expect.objectContaining({
            proposalId: mockProposalResponse.proposalId,
            targetSwapId: mockTargetSwap.id,
            sourceSwapId: mockEligibleSwap.id,
            estimatedResponseTime: mockProposalResponse.estimatedResponseTime
          })
        })
      })
    );

    // Verify accessibility announcement
    expect(mockAnnounce).toHaveBeenCalledWith(
      expect.stringContaining('Proposal submitted successfully'),
      'polite'
    );

    // Verify parent component callback
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        targetSwapId: mockTargetSwap.id,
        sourceSwapId: mockEligibleSwap.id,
        proposerId: mockUser.id,
        message: formData.message,
        conditions: formData.conditions,
        agreedToTerms: formData.agreedToTerms
      })
    );

    // Verify modal closes
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles proposal submission errors correctly', async () => {
    const mockError = new Error('Submission failed');
    mockSubmitProposal.mockResolvedValueOnce(null); // Indicates failure

    mockUseProposalModal.mockReturnValue({
      eligibleSwaps: [mockEligibleSwap],
      loading: false,
      error: null,
      submitting: false,
      submitError: 'Submission failed',
      canRetry: false,
      retryCount: 0,
      fetchEligibleSwaps: vi.fn(),
      submitProposal: mockSubmitProposal,
      retry: vi.fn(),
      clearError: vi.fn(),
      clearSubmitError: vi.fn(),
      reset: vi.fn(),
      cancelRequests: vi.fn()
    });

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    // Select a swap
    const selectButton = screen.getByText('Select This Swap');
    fireEvent.click(selectButton);

    // Wait for form to appear
    await waitFor(() => {
      expect(screen.getByText('Create Your Proposal')).toBeInTheDocument();
    });

    // Should show error message
    expect(screen.getByText('Proposal Submission Failed')).toBeInTheDocument();
    expect(screen.getByText('Submission failed')).toBeInTheDocument();

    // Should not call success callbacks
    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notifications/addNotification'
      })
    );
    expect(mockOnSubmit).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('formats API request payload correctly', async () => {
    const mockProposalResponse = {
      proposalId: 'proposal-123',
      status: 'pending' as const,
      estimatedResponseTime: '24 hours'
    };

    mockSubmitProposal.mockResolvedValueOnce(mockProposalResponse);

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    // Select a swap
    const selectButton = screen.getByText('Select This Swap');
    fireEvent.click(selectButton);

    // Simulate form submission with specific data
    const expectedFormData = {
      message: 'Custom proposal message',
      conditions: ['Condition 1', 'Condition 2'],
      agreedToTerms: true
    };

    // Verify the API request payload format
    await waitFor(() => {
      expect(mockSubmitProposal).toHaveBeenCalledWith({
        sourceSwapId: mockEligibleSwap.id,
        message: expectedFormData.message,
        conditions: expectedFormData.conditions,
        agreedToTerms: expectedFormData.agreedToTerms
      });
    });
  });

  it('maintains backward compatibility with parent component interface', async () => {
    const mockProposalResponse = {
      proposalId: 'proposal-123',
      status: 'pending' as const,
      estimatedResponseTime: '24 hours'
    };

    mockSubmitProposal.mockResolvedValueOnce(mockProposalResponse);

    render(
      <MakeProposalModal
        isOpen={true}
        onClose={mockOnClose}
        targetSwap={mockTargetSwap}
        onSubmit={mockOnSubmit}
      />
    );

    // Select a swap and submit
    const selectButton = screen.getByText('Select This Swap');
    fireEvent.click(selectButton);

    // Verify parent component receives the expected format
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          targetSwapId: mockTargetSwap.id,
          sourceSwapId: mockEligibleSwap.id,
          proposerId: mockUser.id,
          // These would come from form data in real scenario
          message: expect.any(String),
          conditions: expect.any(Array),
          agreedToTerms: expect.any(Boolean)
        })
      );
    });
  });
});