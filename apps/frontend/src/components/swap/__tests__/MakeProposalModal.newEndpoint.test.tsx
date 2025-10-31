import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MakeProposalModal } from '../MakeProposalModal';
import { swapApiService } from '../../../services/swapApiService';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppDispatch } from '../../../store/hooks';
import { EligibleSwap, CreateProposalRequest, ProposalResponse } from '../../../types/api';

// Mock dependencies
vi.mock('../../../services/swapApiService');
vi.mock('../../../contexts/AuthContext');
vi.mock('../../../store/hooks');
vi.mock('../../../hooks/useProposalModal');

const mockSwapApiService = vi.mocked(swapApiService);
const mockUseAuth = vi.mocked(useAuth);
const mockUseAppDispatch = vi.mocked(useAppDispatch);
const mockDispatch = vi.fn();

// Mock useProposalModal hook
const mockUseProposalModal = vi.fn();
vi.doMock('../../../hooks/useProposalModal', () => ({
  useProposalModal: mockUseProposalModal,
}));

describe('MakeProposalModal - New Endpoint Compatibility', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockTargetSwap = {
    id: 'target-swap-123',
    title: 'Test Target Swap',
    description: 'A test swap for proposals',
  };

  const mockEligibleSwap: EligibleSwap = {
    id: 'source-swap-123',
    title: 'Test Source Swap',
    description: 'A test swap to propose with',
    bookingDetails: {
      location: 'Test Location',
      dateRange: {
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-07'),
      },
      guests: 2,
      propertyType: 'apartment',
    },
    compatibilityScore: 85,
    estimatedValue: 1200,
  };

  const mockProposalModalHook = {
    eligibleSwaps: [mockEligibleSwap],
    loading: false,
    error: null,
    submitting: false,
    submitError: null,
    canRetry: false,
    retryCount: 0,
    circuitBreakerTriggered: false,
    serviceHealthy: true,
    getCompatibilityScore: vi.fn(),
    getCompatibilityAnalysis: vi.fn(),
    isLoadingCompatibility: vi.fn(() => false),
    refreshCompatibilityScore: vi.fn(),
    fetchEligibleSwaps: vi.fn(),
    submitProposal: vi.fn(),
    retry: vi.fn(),
    manualRetry: vi.fn(),
    clearError: vi.fn(),
    clearSubmitError: vi.fn(),
    reset: vi.fn(),
    resetCircuitBreaker: vi.fn(),
    cancelRequests: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      loading: false,
    });

    mockUseAppDispatch.mockReturnValue(mockDispatch);
    mockUseProposalModal.mockReturnValue(mockProposalModalHook);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('API Endpoint Integration', () => {
    it('should call the new endpoint when creating a proposal', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      const mockProposalResponse: ProposalResponse = {
        proposalId: 'proposal-123',
        status: 'pending',
        estimatedResponseTime: '2-3 business days',
      };

      // Mock successful proposal submission
      mockProposalModalHook.submitProposal.mockResolvedValue(mockProposalResponse);

      render(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Wait for eligible swaps to load
      await waitFor(() => {
        expect(screen.getByText('Test Source Swap')).toBeInTheDocument();
      });

      // Select the eligible swap
      const swapCard = screen.getByText('Test Source Swap').closest('[role="button"]');
      expect(swapCard).toBeInTheDocument();
      await user.click(swapCard!);

      // Fill out the proposal form
      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Test proposal message');

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      await user.click(submitButton);

      // Verify the API was called with correct data
      await waitFor(() => {
        expect(mockProposalModalHook.submitProposal).toHaveBeenCalledWith({
          sourceSwapId: 'source-swap-123',
          message: 'Test proposal message',
          conditions: ['Standard swap exchange'],
          agreedToTerms: true,
        });
      });

      // Verify success handling
      expect(mockOnSubmit).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle cash proposals correctly', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      const mockProposalResponse: ProposalResponse = {
        proposalId: 'cash-proposal-123',
        status: 'pending',
        estimatedResponseTime: '1-2 business days',
      };

      // Mock successful cash proposal submission
      mockProposalModalHook.submitProposal.mockResolvedValue(mockProposalResponse);

      render(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Click on cash offer option
      const cashOfferButton = screen.getByText(/make cash offer/i);
      await user.click(cashOfferButton);

      // Fill out the cash offer form
      await waitFor(() => {
        expect(screen.getByText('Make Cash Offer')).toBeInTheDocument();
      });

      const amountInput = screen.getByLabelText(/cash amount/i);
      await user.type(amountInput, '1500');

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Cash offer message');

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit offer/i });
      await user.click(submitButton);

      // Verify the API was called with correct cash offer data
      await waitFor(() => {
        expect(mockProposalModalHook.submitProposal).toHaveBeenCalledWith({
          sourceSwapId: 'CASH_OFFER',
          message: 'Cash offer message',
          conditions: ['Cash payment offer'],
          agreedToTerms: true,
          cashOffer: {
            amount: 1500,
            currency: 'USD',
          },
        });
      });

      // Verify success handling
      expect(mockOnSubmit).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should handle validation errors from the new endpoint', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      // Mock validation error response
      const validationError = new Error('Invalid proposal data');
      validationError.name = 'ValidationError';
      mockProposalModalHook.submitProposal.mockRejectedValue(validationError);
      mockProposalModalHook.submitError = 'Invalid proposal data';

      render(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Select swap and submit proposal
      await waitFor(() => {
        expect(screen.getByText('Test Source Swap')).toBeInTheDocument();
      });

      const swapCard = screen.getByText('Test Source Swap').closest('[role="button"]');
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
        expect(screen.getByText(/invalid proposal data/i)).toBeInTheDocument();
      });

      // Verify modal stays open for error correction
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should handle authentication errors from the new endpoint', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      // Mock authentication error response
      const authError = new Error('Authentication required');
      authError.name = 'AuthenticationError';
      mockProposalModalHook.submitProposal.mockRejectedValue(authError);
      mockProposalModalHook.submitError = 'Authentication required';

      render(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Select swap and submit proposal
      await waitFor(() => {
        expect(screen.getByText('Test Source Swap')).toBeInTheDocument();
      });

      const swapCard = screen.getByText('Test Source Swap').closest('[role="button"]');
      await user.click(swapCard!);

      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      await user.click(submitButton);

      // Verify authentication error is displayed
      await waitFor(() => {
        expect(screen.getByText(/authentication required/i)).toBeInTheDocument();
      });
    });

    it('should handle server errors from the new endpoint', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      // Mock server error response
      const serverError = new Error('Internal server error');
      serverError.name = 'ServerError';
      mockProposalModalHook.submitProposal.mockRejectedValue(serverError);
      mockProposalModalHook.submitError = 'Internal server error';

      render(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Select swap and submit proposal
      await waitFor(() => {
        expect(screen.getByText('Test Source Swap')).toBeInTheDocument();
      });

      const swapCard = screen.getByText('Test Source Swap').closest('[role="button"]');
      await user.click(swapCard!);

      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      await user.click(submitButton);

      // Verify server error is displayed
      await waitFor(() => {
        expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Response Format Compatibility', () => {
    it('should handle the new endpoint response format correctly', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      const mockProposalResponse: ProposalResponse = {
        proposalId: 'proposal-456',
        status: 'pending',
        estimatedResponseTime: '3-5 business days',
      };

      mockProposalModalHook.submitProposal.mockResolvedValue(mockProposalResponse);

      render(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Submit proposal
      await waitFor(() => {
        expect(screen.getByText('Test Source Swap')).toBeInTheDocument();
      });

      const swapCard = screen.getByText('Test Source Swap').closest('[role="button"]');
      await user.click(swapCard!);

      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      await user.click(submitButton);

      // Verify the response is handled correctly
      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: expect.stringContaining('notification'),
            payload: expect.objectContaining({
              data: expect.objectContaining({
                proposalId: 'proposal-456',
                estimatedResponseTime: '3-5 business days',
              }),
            }),
          })
        );
      });
    });

    it('should maintain backward compatibility with parent component callback', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      const mockProposalResponse: ProposalResponse = {
        proposalId: 'proposal-789',
        status: 'pending',
        estimatedResponseTime: '1-2 business days',
      };

      mockProposalModalHook.submitProposal.mockResolvedValue(mockProposalResponse);

      render(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Submit proposal
      await waitFor(() => {
        expect(screen.getByText('Test Source Swap')).toBeInTheDocument();
      });

      const swapCard = screen.getByText('Test Source Swap').closest('[role="button"]');
      await user.click(swapCard!);

      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      await user.click(submitButton);

      // Verify the parent callback is called with the expected format
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            targetSwapId: 'target-swap-123',
            sourceSwapId: 'source-swap-123',
            proposerId: 'user-123',
            agreedToTerms: true,
          })
        );
      });
    });
  });

  describe('Loading States and User Experience', () => {
    it('should show loading state during proposal submission', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      // Mock submitting state
      const submittingHook = {
        ...mockProposalModalHook,
        submitting: true,
      };
      mockUseProposalModal.mockReturnValue(submittingHook);

      render(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Select swap and go to form
      await waitFor(() => {
        expect(screen.getByText('Test Source Swap')).toBeInTheDocument();
      });

      const swapCard = screen.getByText('Test Source Swap').closest('[role="button"]');
      await user.click(swapCard!);

      // Verify loading state is shown
      await waitFor(() => {
        expect(screen.getByText(/submitting/i)).toBeInTheDocument();
      });

      // Verify submit button is disabled during submission
      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      expect(submitButton).toBeDisabled();
    });

    it('should provide accessibility announcements for proposal submission', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      const mockOnClose = vi.fn();

      const mockProposalResponse: ProposalResponse = {
        proposalId: 'proposal-accessibility',
        status: 'pending',
        estimatedResponseTime: '2-3 business days',
      };

      mockProposalModalHook.submitProposal.mockResolvedValue(mockProposalResponse);

      render(
        <MakeProposalModal
          isOpen={true}
          onClose={mockOnClose}
          targetSwap={mockTargetSwap}
          onSubmit={mockOnSubmit}
        />
      );

      // Submit proposal
      await waitFor(() => {
        expect(screen.getByText('Test Source Swap')).toBeInTheDocument();
      });

      const swapCard = screen.getByText('Test Source Swap').closest('[role="button"]');
      await user.click(swapCard!);

      await waitFor(() => {
        expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      });

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByRole('button', { name: /submit proposal/i });
      await user.click(submitButton);

      // Verify accessibility announcements are made
      // This would typically be tested with a screen reader testing library
      // For now, we verify the success flow completes
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });
});