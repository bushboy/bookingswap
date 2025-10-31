import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActionItemsSection } from '../ActionItemsSection';
import { SwapInfo, BookingUserRole } from '@booking-swap/shared';

// Mock console.log to avoid noise in tests
import { vi } from 'vitest';
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('ActionItemsSection Integration Tests', () => {
  const createSwapInfo = (overrides: Partial<SwapInfo> = {}): SwapInfo => ({
    swapId: 'swap-123',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 100,
    maxCashAmount: 500,
    hasActiveProposals: false,
    activeProposalCount: 0,
    swapConditions: [],
    ...overrides,
  });

  afterEach(() => {
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  describe('Real-world Scenarios', () => {
    it('should handle owner with multiple active proposals scenario', async () => {
      const swapInfo = createSwapInfo({
        hasActiveProposals: true,
        activeProposalCount: 5,
        acceptanceStrategy: 'auction',
        timeRemaining: 7200000, // 2 hours
        auctionEndDate: new Date(Date.now() + 7200000),
      });

      render(<ActionItemsSection swapInfo={swapInfo} userRole="owner" />);

      // Should show both action buttons
      expect(screen.getByText('Review Proposals')).toBeInTheDocument();
      expect(screen.getByText('Manage Swap')).toBeInTheDocument();

      // Test interaction with Review Proposals
      const reviewButton = screen.getByText('Review Proposals');
      fireEvent.click(reviewButton);
      expect(mockConsoleLog).toHaveBeenCalledWith('Navigate to proposals review');

      // Test interaction with Manage Swap
      const manageButton = screen.getByText('Manage Swap');
      fireEvent.click(manageButton);
      expect(mockConsoleLog).toHaveBeenCalledWith('Navigate to swap management');
    });

    it('should handle browser in competitive auction scenario', () => {
      const swapInfo = createSwapInfo({
        acceptanceStrategy: 'auction',
        hasActiveProposals: true,
        activeProposalCount: 8,
        timeRemaining: 1800000, // 30 minutes - urgent
        auctionEndDate: new Date(Date.now() + 1800000),
        minCashAmount: 200,
        maxCashAmount: 1000,
      });

      render(<ActionItemsSection swapInfo={swapInfo} userRole="browser" />);

      // Should show proposal and details buttons
      expect(screen.getByText('Make Proposal')).toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();

      // Test making a proposal in competitive environment
      const proposalButton = screen.getByText('Make Proposal');
      fireEvent.click(proposalButton);
      expect(mockConsoleLog).toHaveBeenCalledWith('Open proposal creation form');
    });

    it('should handle proposer with pending proposal in ending auction', () => {
      const swapInfo = createSwapInfo({
        acceptanceStrategy: 'auction',
        userProposalStatus: 'pending',
        timeRemaining: 300000, // 5 minutes - very urgent
        auctionEndDate: new Date(Date.now() + 300000),
        hasActiveProposals: true,
        activeProposalCount: 3,
      });

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      // Should show pending proposal actions
      expect(screen.getByText('View Proposal')).toBeInTheDocument();
      expect(screen.getByText('Withdraw')).toBeInTheDocument();

      // Test viewing proposal details
      const viewButton = screen.getByText('View Proposal');
      fireEvent.click(viewButton);
      expect(mockConsoleLog).toHaveBeenCalledWith('Navigate to proposal details');

      // Test withdrawal action
      const withdrawButton = screen.getByText('Withdraw');
      fireEvent.click(withdrawButton);
      expect(mockConsoleLog).toHaveBeenCalledWith('Withdraw proposal');
    });

    it('should handle successful proposal acceptance flow', () => {
      const swapInfo = createSwapInfo({
        userProposalStatus: 'accepted',
        acceptanceStrategy: 'first-match',
        hasActiveProposals: false,
        activeProposalCount: 0,
      });

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      // Should only show agreement button
      expect(screen.getByText('View Agreement')).toBeInTheDocument();
      expect(screen.queryByText('Withdraw')).not.toBeInTheDocument();
      expect(screen.queryByText('Make New Proposal')).not.toBeInTheDocument();

      // Test viewing agreement
      const agreementButton = screen.getByText('View Agreement');
      fireEvent.click(agreementButton);
      expect(mockConsoleLog).toHaveBeenCalledWith('Navigate to agreement details');
    });

    it('should handle rejected proposal with opportunity for retry', () => {
      const swapInfo = createSwapInfo({
        userProposalStatus: 'rejected',
        acceptanceStrategy: 'auction',
        timeRemaining: 3600000, // 1 hour remaining
        auctionEndDate: new Date(Date.now() + 3600000),
        hasActiveProposals: true,
        activeProposalCount: 2,
      });

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      // Should show option to make new proposal
      expect(screen.getByText('Make New Proposal')).toBeInTheDocument();
      expect(screen.queryByText('View Proposal')).not.toBeInTheDocument();
      expect(screen.queryByText('Withdraw')).not.toBeInTheDocument();

      // Test making new proposal
      const newProposalButton = screen.getByText('Make New Proposal');
      fireEvent.click(newProposalButton);
      expect(mockConsoleLog).toHaveBeenCalledWith('Open new proposal creation form');
    });

    it('should handle expired auction with no available actions', () => {
      const swapInfo = createSwapInfo({
        acceptanceStrategy: 'auction',
        timeRemaining: 0,
        auctionEndDate: new Date(Date.now() - 3600000), // 1 hour ago
        hasActiveProposals: false,
        activeProposalCount: 0,
      });

      const { container } = render(<ActionItemsSection swapInfo={swapInfo} userRole="browser" />);

      // Should render nothing for expired auction
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Button Interaction and Styling', () => {
    it('should handle hover states correctly', async () => {
      const swapInfo = createSwapInfo({
        hasActiveProposals: true,
        activeProposalCount: 1,
      });

      render(<ActionItemsSection swapInfo={swapInfo} userRole="owner" />);

      const reviewButton = screen.getByText('Review Proposals');
      
      // Test hover enter
      fireEvent.mouseEnter(reviewButton);
      await waitFor(() => {
        expect(reviewButton).toHaveStyle({
          backgroundColor: '#1d4ed8', // tokens.colors.primary[700] - hover state
        });
      });

      // Test hover leave
      fireEvent.mouseLeave(reviewButton);
      await waitFor(() => {
        expect(reviewButton).toHaveStyle({
          backgroundColor: '#2563eb', // tokens.colors.primary[600] - original state
        });
      });
    });

    it('should handle multiple button types with different hover behaviors', async () => {
      const swapInfo = createSwapInfo({
        userProposalStatus: 'pending',
      });

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      const viewButton = screen.getByText('View Proposal');
      const withdrawButton = screen.getByText('Withdraw');

      // Test secondary button hover
      fireEvent.mouseEnter(viewButton);
      await waitFor(() => {
        expect(viewButton).toHaveStyle({
          backgroundColor: '#f1f5f9', // tokens.colors.neutral[100] - hover state
        });
      });

      // Test danger button hover
      fireEvent.mouseEnter(withdrawButton);
      await waitFor(() => {
        expect(withdrawButton).toHaveStyle({
          backgroundColor: '#fee2e2', // tokens.colors.error[100] - hover state
        });
      });
    });

    it('should maintain proper button spacing and layout', () => {
      const swapInfo = createSwapInfo({
        hasActiveProposals: true,
        activeProposalCount: 2,
      });

      render(<ActionItemsSection swapInfo={swapInfo} userRole="owner" />);

      const actionSection = screen.getByText('Review Proposals').closest('div')?.parentElement;
      expect(actionSection).toHaveStyle({
        display: 'flex',
        gap: '8px', // tokens.spacing[2]
        flexWrap: 'wrap',
      });
    });
  });

  describe('Complex State Transitions', () => {
    it('should handle state change from no proposals to active proposals', () => {
      const initialSwapInfo = createSwapInfo({
        hasActiveProposals: false,
        activeProposalCount: 0,
      });

      const { rerender } = render(<ActionItemsSection swapInfo={initialSwapInfo} userRole="owner" />);

      // Initially should only show Manage Swap
      expect(screen.queryByText('Review Proposals')).not.toBeInTheDocument();
      expect(screen.getByText('Manage Swap')).toBeInTheDocument();

      // Update to have active proposals
      const updatedSwapInfo = createSwapInfo({
        hasActiveProposals: true,
        activeProposalCount: 3,
      });

      rerender(<ActionItemsSection swapInfo={updatedSwapInfo} userRole="owner" />);

      // Now should show both buttons
      expect(screen.getByText('Review Proposals')).toBeInTheDocument();
      expect(screen.getByText('Manage Swap')).toBeInTheDocument();
    });

    it('should handle proposer status change from pending to accepted', () => {
      const pendingSwapInfo = createSwapInfo({
        userProposalStatus: 'pending',
      });

      const { rerender } = render(<ActionItemsSection swapInfo={pendingSwapInfo} userRole="proposer" />);

      // Should show pending proposal actions
      expect(screen.getByText('View Proposal')).toBeInTheDocument();
      expect(screen.getByText('Withdraw')).toBeInTheDocument();

      // Update to accepted status
      const acceptedSwapInfo = createSwapInfo({
        userProposalStatus: 'accepted',
      });

      rerender(<ActionItemsSection swapInfo={acceptedSwapInfo} userRole="proposer" />);

      // Should show agreement action
      expect(screen.getByText('View Agreement')).toBeInTheDocument();
      expect(screen.queryByText('View Proposal')).not.toBeInTheDocument();
      expect(screen.queryByText('Withdraw')).not.toBeInTheDocument();
    });

    it('should handle auction expiration during user interaction', () => {
      const activeAuctionSwapInfo = createSwapInfo({
        acceptanceStrategy: 'auction',
        timeRemaining: 1000, // 1 second
        auctionEndDate: new Date(Date.now() + 1000),
      });

      const { rerender } = render(<ActionItemsSection swapInfo={activeAuctionSwapInfo} userRole="browser" />);

      // Should show proposal option
      expect(screen.getByText('Make Proposal')).toBeInTheDocument();

      // Simulate auction expiration
      const expiredAuctionSwapInfo = createSwapInfo({
        acceptanceStrategy: 'auction',
        timeRemaining: 0,
        auctionEndDate: new Date(Date.now() - 1000),
      });

      rerender(<ActionItemsSection swapInfo={expiredAuctionSwapInfo} userRole="browser" />);

      // Should only show view details
      expect(screen.queryByText('Make Proposal')).not.toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing optional properties gracefully', () => {
      const minimalSwapInfo: SwapInfo = {
        swapId: 'swap-123',
        paymentTypes: ['booking'],
        acceptanceStrategy: 'first-match',
        hasActiveProposals: false,
        activeProposalCount: 0,
        swapConditions: [],
        // Missing optional properties like minCashAmount, timeRemaining, etc.
      };

      render(<ActionItemsSection swapInfo={minimalSwapInfo} userRole="browser" />);

      // Should still render appropriate actions
      expect(screen.getByText('Make Proposal')).toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });

    it('should handle invalid user role gracefully', () => {
      const swapInfo = createSwapInfo();
      
      // TypeScript would prevent this, but testing runtime behavior
      const { container } = render(
        <ActionItemsSection swapInfo={swapInfo} userRole={'invalid' as BookingUserRole} />
      );

      // Should render nothing for invalid role
      expect(container.firstChild).toBeNull();
    });

    it('should handle zero active proposal count correctly', () => {
      const swapInfo = createSwapInfo({
        hasActiveProposals: false,
        activeProposalCount: 0,
      });

      render(<ActionItemsSection swapInfo={swapInfo} userRole="owner" />);

      // Should not show Review Proposals button
      expect(screen.queryByText('Review Proposals')).not.toBeInTheDocument();
      expect(screen.getByText('Manage Swap')).toBeInTheDocument();
    });
  });
});