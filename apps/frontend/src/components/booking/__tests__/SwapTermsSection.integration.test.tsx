import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SwapInfoPanel } from '../SwapInfoPanel';
import { SwapInfo, BookingUserRole } from '@booking-swap/shared';

// Mock SwapInfo data for integration testing
const createMockSwapInfo = (overrides: Partial<SwapInfo> = {}): SwapInfo => ({
  swapId: 'swap-123',
  paymentTypes: ['booking', 'cash'],
  acceptanceStrategy: 'first-match',
  hasActiveProposals: false,
  activeProposalCount: 0,
  swapConditions: [],
  ...overrides,
});

describe('SwapTermsSection Integration', () => {
  describe('Integration with SwapInfoPanel', () => {
    it('should render SwapTermsSection within SwapInfoPanel', () => {
      const swapInfo = createMockSwapInfo({
        paymentTypes: ['booking', 'cash'],
        minCashAmount: 1000,
        maxCashAmount: 5000,
        swapConditions: ['Must be available for same dates'],
      });

      render(
        <SwapInfoPanel 
          swapInfo={swapInfo} 
          userRole="browser" 
          showFullDetails={true}
        />
      );

      // Verify SwapTermsSection content is rendered
      expect(screen.getByText('Swap Terms')).toBeInTheDocument();
      expect(screen.getByText('Booking Exchange')).toBeInTheDocument();
      expect(screen.getByText('Cash Offers')).toBeInTheDocument();
      expect(screen.getByText('$1,000')).toBeInTheDocument();
      expect(screen.getByText('$5,000')).toBeInTheDocument();
      expect(screen.getByText('Must be available for same dates')).toBeInTheDocument();
    });

    it('should respect showFullDetails prop from SwapInfoPanel', () => {
      const swapInfo = createMockSwapInfo({
        swapConditions: ['Test condition that should not show'],
      });

      render(
        <SwapInfoPanel 
          swapInfo={swapInfo} 
          userRole="browser" 
          showFullDetails={false}
        />
      );

      expect(screen.getByText('Swap Terms')).toBeInTheDocument();
      expect(screen.queryByText('Test condition that should not show')).not.toBeInTheDocument();
    });

    it('should respect compact mode from SwapInfoPanel', () => {
      const swapInfo = createMockSwapInfo({
        swapConditions: ['Test condition in compact mode'],
      });

      render(
        <SwapInfoPanel 
          swapInfo={swapInfo} 
          userRole="browser" 
          compact={true}
        />
      );

      expect(screen.getByText('Swap Terms')).toBeInTheDocument();
      // In compact mode, showFullDetails should be false
      expect(screen.queryByText('Test condition in compact mode')).not.toBeInTheDocument();
    });
  });

  describe('Real-world Scenarios', () => {
    it('should display comprehensive auction swap information', () => {
      const swapInfo = createMockSwapInfo({
        paymentTypes: ['booking', 'cash'],
        acceptanceStrategy: 'auction',
        auctionEndDate: new Date('2024-12-25T15:30:00Z'),
        minCashAmount: 2000,
        maxCashAmount: 8000,
        swapConditions: [
          'Must be available for same dates',
          'Similar accommodation quality required',
          'Non-refundable booking',
        ],
        hasActiveProposals: true,
        activeProposalCount: 3,
        timeRemaining: 86400000, // 24 hours
      });

      render(
        <SwapInfoPanel 
          swapInfo={swapInfo} 
          userRole="owner" 
          showFullDetails={true}
        />
      );

      // Verify all swap terms are displayed
      expect(screen.getByText('Swap Terms')).toBeInTheDocument();
      expect(screen.getByText('Booking Exchange')).toBeInTheDocument();
      expect(screen.getByText('Cash Offers')).toBeInTheDocument();
      expect(screen.getByText('$2,000')).toBeInTheDocument();
      expect(screen.getByText('$8,000')).toBeInTheDocument();
      expect(screen.getByText('Auction Mode')).toBeInTheDocument();
      expect(screen.getByText('Must be available for same dates')).toBeInTheDocument();
      expect(screen.getByText('Similar accommodation quality required')).toBeInTheDocument();
      expect(screen.getByText('Non-refundable booking')).toBeInTheDocument();
      expect(screen.getByText(/Dec 25, 2024/)).toBeInTheDocument();
    });

    it('should display minimal first-match swap information', () => {
      const swapInfo = createMockSwapInfo({
        paymentTypes: ['booking'],
        acceptanceStrategy: 'first-match',
        hasActiveProposals: false,
        activeProposalCount: 0,
      });

      render(
        <SwapInfoPanel 
          swapInfo={swapInfo} 
          userRole="browser" 
          showFullDetails={true}
        />
      );

      // Verify basic swap terms are displayed
      expect(screen.getByText('Swap Terms')).toBeInTheDocument();
      expect(screen.getByText('Booking Exchange')).toBeInTheDocument();
      expect(screen.getByText('First Match')).toBeInTheDocument();
      expect(screen.queryByText('Cash Offers')).not.toBeInTheDocument();
      expect(screen.queryByText('Cash Range:')).not.toBeInTheDocument();
      expect(screen.queryByText('Auction End:')).not.toBeInTheDocument();
    });

    it('should display cash-only swap with conditions', () => {
      const swapInfo = createMockSwapInfo({
        paymentTypes: ['cash'],
        acceptanceStrategy: 'first-match',
        minCashAmount: 1500,
        swapConditions: [
          'Payment via PayPal only',
          'Must confirm within 24 hours',
        ],
        hasActiveProposals: true,
        activeProposalCount: 1,
      });

      render(
        <SwapInfoPanel 
          swapInfo={swapInfo} 
          userRole="owner" 
          showFullDetails={true}
        />
      );

      // Verify cash-only swap terms
      expect(screen.getByText('Swap Terms')).toBeInTheDocument();
      expect(screen.getByText('Cash Offers')).toBeInTheDocument();
      expect(screen.queryByText('Booking Exchange')).not.toBeInTheDocument();
      expect(screen.getByText('$1,500')).toBeInTheDocument();
      expect(screen.getByText('minimum')).toBeInTheDocument();
      expect(screen.getByText('Payment via PayPal only')).toBeInTheDocument();
      expect(screen.getByText('Must confirm within 24 hours')).toBeInTheDocument();
      expect(screen.getByText('First Match')).toBeInTheDocument();
    });
  });

  describe('User Role Context', () => {
    it('should display same swap terms regardless of user role', () => {
      const swapInfo = createMockSwapInfo({
        paymentTypes: ['booking', 'cash'],
        minCashAmount: 1000,
      });

      const roles: BookingUserRole[] = ['owner', 'browser', 'proposer'];

      roles.forEach(role => {
        const { unmount } = render(
          <SwapInfoPanel 
            swapInfo={swapInfo} 
            userRole={role} 
            showFullDetails={true}
          />
        );

        // Swap terms should be consistent across all user roles
        expect(screen.getByText('Swap Terms')).toBeInTheDocument();
        expect(screen.getByText('Booking Exchange')).toBeInTheDocument();
        expect(screen.getByText('Cash Offers')).toBeInTheDocument();
        expect(screen.getByText('$1,000')).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle empty payment types gracefully', () => {
      const swapInfo = createMockSwapInfo({
        paymentTypes: [],
      });

      render(
        <SwapInfoPanel 
          swapInfo={swapInfo} 
          userRole="browser" 
          showFullDetails={true}
        />
      );

      expect(screen.getByText('Swap Terms')).toBeInTheDocument();
      expect(screen.queryByText('Accepts:')).not.toBeInTheDocument();
      expect(screen.getByText('First Match')).toBeInTheDocument(); // Strategy should still show
    });

    it('should handle invalid auction end date gracefully', () => {
      const swapInfo = createMockSwapInfo({
        acceptanceStrategy: 'auction',
        auctionEndDate: new Date('invalid-date'),
      });

      render(
        <SwapInfoPanel 
          swapInfo={swapInfo} 
          userRole="browser" 
          showFullDetails={true}
        />
      );

      expect(screen.getByText('Swap Terms')).toBeInTheDocument();
      expect(screen.getByText('Auction Mode')).toBeInTheDocument();
      // Should not crash, but may not display the invalid date
    });
  });
});