import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionItemsSection } from '../ActionItemsSection';
import { SwapInfo, BookingUserRole } from '@booking-swap/shared';

// Mock console.log to avoid noise in tests
import { vi } from 'vitest';
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('ActionItemsSection', () => {
  const baseSwapInfo: SwapInfo = {
    swapId: 'swap-123',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 100,
    maxCashAmount: 500,
    hasActiveProposals: false,
    activeProposalCount: 0,
    swapConditions: [],
  };

  afterEach(() => {
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  describe('Owner Role', () => {
    it('should show Review Proposals and Manage Swap buttons when there are active proposals', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        hasActiveProposals: true,
        activeProposalCount: 3,
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="owner" />);

      expect(screen.getByText('Review Proposals')).toBeInTheDocument();
      expect(screen.getByText('Manage Swap')).toBeInTheDocument();
      expect(screen.getByText('👀')).toBeInTheDocument();
      expect(screen.getByText('⚙️')).toBeInTheDocument();
    });

    it('should show only Manage Swap button when there are no active proposals', () => {
      render(<ActionItemsSection swapInfo={baseSwapInfo} userRole="owner" />);

      expect(screen.queryByText('Review Proposals')).not.toBeInTheDocument();
      expect(screen.getByText('Manage Swap')).toBeInTheDocument();
      expect(screen.getByText('⚙️')).toBeInTheDocument();
    });

    it('should handle Review Proposals button click', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        hasActiveProposals: true,
        activeProposalCount: 2,
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="owner" />);

      const reviewButton = screen.getByText('Review Proposals');
      fireEvent.click(reviewButton);

      expect(mockConsoleLog).toHaveBeenCalledWith('Navigate to proposals review');
    });

    it('should handle Manage Swap button click', () => {
      render(<ActionItemsSection swapInfo={baseSwapInfo} userRole="owner" />);

      const manageButton = screen.getByText('Manage Swap');
      fireEvent.click(manageButton);

      expect(mockConsoleLog).toHaveBeenCalledWith('Navigate to swap management');
    });
  });

  describe('Browser Role', () => {
    it('should show Make Proposal and View Details buttons for first-match strategy', () => {
      render(<ActionItemsSection swapInfo={baseSwapInfo} userRole="browser" />);

      expect(screen.getByText('Make Proposal')).toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
      expect(screen.getByText('💌')).toBeInTheDocument();
      expect(screen.getByText('📄')).toBeInTheDocument();
    });

    it('should show Make Proposal button for active auction with time remaining', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        acceptanceStrategy: 'auction',
        timeRemaining: 3600000, // 1 hour
        auctionEndDate: new Date(Date.now() + 3600000),
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="browser" />);

      expect(screen.getByText('Make Proposal')).toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });

    it('should not show Make Proposal button for expired auction', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        acceptanceStrategy: 'auction',
        timeRemaining: 0,
        auctionEndDate: new Date(Date.now() - 3600000),
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="browser" />);

      expect(screen.queryByText('Make Proposal')).not.toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });

    it('should handle Make Proposal button click', () => {
      render(<ActionItemsSection swapInfo={baseSwapInfo} userRole="browser" />);

      const proposalButton = screen.getByText('Make Proposal');
      fireEvent.click(proposalButton);

      expect(mockConsoleLog).toHaveBeenCalledWith('Open proposal creation form');
    });

    it('should handle View Details button click', () => {
      render(<ActionItemsSection swapInfo={baseSwapInfo} userRole="browser" />);

      const detailsButton = screen.getByText('View Details');
      fireEvent.click(detailsButton);

      expect(mockConsoleLog).toHaveBeenCalledWith('Navigate to booking details');
    });
  });

  describe('Proposer Role', () => {
    it('should show View Proposal and Withdraw buttons for pending proposal', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        userProposalStatus: 'pending',
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      expect(screen.getByText('View Proposal')).toBeInTheDocument();
      expect(screen.getByText('Withdraw')).toBeInTheDocument();
      expect(screen.getByText('📄')).toBeInTheDocument();
      expect(screen.getByText('🗑️')).toBeInTheDocument();
    });

    it('should show View Agreement button for accepted proposal', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        userProposalStatus: 'accepted',
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      expect(screen.getByText('View Agreement')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
      expect(screen.queryByText('Withdraw')).not.toBeInTheDocument();
    });

    it('should show Make New Proposal button for rejected proposal in first-match strategy', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        userProposalStatus: 'rejected',
        acceptanceStrategy: 'first-match',
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      expect(screen.getByText('Make New Proposal')).toBeInTheDocument();
      expect(screen.getByText('💌')).toBeInTheDocument();
    });

    it('should show Make New Proposal button for rejected proposal in active auction', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        userProposalStatus: 'rejected',
        acceptanceStrategy: 'auction',
        timeRemaining: 3600000,
        auctionEndDate: new Date(Date.now() + 3600000),
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      expect(screen.getByText('Make New Proposal')).toBeInTheDocument();
    });

    it('should not show Make New Proposal button for rejected proposal in expired auction', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        userProposalStatus: 'rejected',
        acceptanceStrategy: 'auction',
        timeRemaining: 0,
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      expect(screen.queryByText('Make New Proposal')).not.toBeInTheDocument();
    });

    it('should handle View Proposal button click', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        userProposalStatus: 'pending',
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      const viewButton = screen.getByText('View Proposal');
      fireEvent.click(viewButton);

      expect(mockConsoleLog).toHaveBeenCalledWith('Navigate to proposal details');
    });

    it('should handle Withdraw button click', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        userProposalStatus: 'pending',
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      const withdrawButton = screen.getByText('Withdraw');
      fireEvent.click(withdrawButton);

      expect(mockConsoleLog).toHaveBeenCalledWith('Withdraw proposal');
    });

    it('should handle View Agreement button click', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        userProposalStatus: 'accepted',
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      const agreementButton = screen.getByText('View Agreement');
      fireEvent.click(agreementButton);

      expect(mockConsoleLog).toHaveBeenCalledWith('Navigate to agreement details');
    });
  });

  describe('Edge Cases', () => {
    it('should render nothing when no actions are available', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        acceptanceStrategy: 'auction',
        timeRemaining: 0, // Expired auction
      };

      const { container } = render(<ActionItemsSection swapInfo={swapInfo} userRole="browser" />);

      expect(container.firstChild).toBeNull();
    });

    it('should handle proposer with no proposal status', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        userProposalStatus: undefined,
      };

      const { container } = render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      expect(container.firstChild).toBeNull();
    });

    it('should handle proposer with "none" proposal status', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        userProposalStatus: 'none',
      };

      const { container } = render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Button Styling', () => {
    it('should apply primary button styling to Review Proposals button', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        hasActiveProposals: true,
        activeProposalCount: 1,
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="owner" />);

      const reviewButton = screen.getByText('Review Proposals');
      expect(reviewButton).toHaveStyle({
        backgroundColor: '#2563eb', // tokens.colors.primary[600]
        color: 'white',
      });
    });

    it('should apply secondary button styling to Manage Swap button', () => {
      render(<ActionItemsSection swapInfo={baseSwapInfo} userRole="owner" />);

      const manageButton = screen.getByText('Manage Swap');
      expect(manageButton).toHaveStyle({
        backgroundColor: '#f8fafc', // tokens.colors.neutral[50]
        color: '#374151', // tokens.colors.neutral[700]
      });
    });

    it('should apply danger button styling to Withdraw button', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        userProposalStatus: 'pending',
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="proposer" />);

      const withdrawButton = screen.getByText('Withdraw');
      expect(withdrawButton).toHaveStyle({
        backgroundColor: '#fef2f2', // tokens.colors.error[50]
        color: '#b91c1c', // tokens.colors.error[700]
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles and be keyboard accessible', () => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        hasActiveProposals: true,
        activeProposalCount: 1,
      };

      render(<ActionItemsSection swapInfo={swapInfo} userRole="owner" />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);

      buttons.forEach(button => {
        expect(button).toBeEnabled();
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('should handle keyboard events properly', () => {
      render(<ActionItemsSection swapInfo={baseSwapInfo} userRole="owner" />);

      const manageButton = screen.getByText('Manage Swap');
      
      // Test Enter key
      fireEvent.keyDown(manageButton, { key: 'Enter', code: 'Enter' });
      // Note: onClick should be triggered by the browser, not our component
      
      // Test Space key
      fireEvent.keyDown(manageButton, { key: ' ', code: 'Space' });
      // Note: onClick should be triggered by the browser, not our component
    });
  });
});