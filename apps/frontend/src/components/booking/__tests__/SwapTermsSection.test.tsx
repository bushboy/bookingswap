import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SwapTermsSection } from '../SwapTermsSection';
import { SwapInfo } from '@booking-swap/shared';

// Mock SwapInfo data for testing
const createMockSwapInfo = (overrides: Partial<SwapInfo> = {}): SwapInfo => ({
  swapId: 'swap-123',
  paymentTypes: ['booking', 'cash'],
  acceptanceStrategy: 'first-match',
  hasActiveProposals: false,
  activeProposalCount: 0,
  swapConditions: [],
  ...overrides,
});

describe('SwapTermsSection', () => {
  describe('Payment Types Display', () => {
    it('should display booking exchange badge', () => {
      const swapInfo = createMockSwapInfo({
        paymentTypes: ['booking'],
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('🔄')).toBeInTheDocument();
      expect(screen.getByText('Booking Exchange')).toBeInTheDocument();
    });

    it('should display cash offers badge', () => {
      const swapInfo = createMockSwapInfo({
        paymentTypes: ['cash'],
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('💰')).toBeInTheDocument();
      expect(screen.getByText('Cash Offers')).toBeInTheDocument();
    });

    it('should display both payment type badges', () => {
      const swapInfo = createMockSwapInfo({
        paymentTypes: ['booking', 'cash'],
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('🔄')).toBeInTheDocument();
      expect(screen.getByText('Booking Exchange')).toBeInTheDocument();
      expect(screen.getByText('💰')).toBeInTheDocument();
      expect(screen.getByText('Cash Offers')).toBeInTheDocument();
    });

    it('should not display payment types section when empty', () => {
      const swapInfo = createMockSwapInfo({
        paymentTypes: [],
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.queryByText('Accepts:')).not.toBeInTheDocument();
    });
  });

  describe('Cash Amount Display', () => {
    it('should display minimum cash amount with proper formatting', () => {
      const swapInfo = createMockSwapInfo({
        minCashAmount: 1500,
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('Cash Range:')).toBeInTheDocument();
      expect(screen.getByText('$1,500')).toBeInTheDocument();
      expect(screen.getByText('minimum')).toBeInTheDocument();
    });

    it('should display cash range with both min and max amounts', () => {
      const swapInfo = createMockSwapInfo({
        minCashAmount: 1000,
        maxCashAmount: 5000,
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('Cash Range:')).toBeInTheDocument();
      expect(screen.getByText('$1,000')).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument();
      expect(screen.getByText('$5,000')).toBeInTheDocument();
    });

    it('should display only maximum cash amount', () => {
      const swapInfo = createMockSwapInfo({
        maxCashAmount: 3000,
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('Cash Range:')).toBeInTheDocument();
      expect(screen.getByText('$3,000')).toBeInTheDocument();
    });

    it('should not display cash range when no amounts are specified', () => {
      const swapInfo = createMockSwapInfo();

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.queryByText('Cash Range:')).not.toBeInTheDocument();
    });
  });

  describe('Swap Conditions Display', () => {
    it('should display swap conditions when showFullDetails is true', () => {
      const swapInfo = createMockSwapInfo({
        swapConditions: [
          'Must be available for same dates',
          'Similar accommodation quality required',
          'Non-refundable booking',
        ],
      });

      render(<SwapTermsSection swapInfo={swapInfo} showFullDetails={true} />);

      expect(screen.getByText('Conditions:')).toBeInTheDocument();
      expect(screen.getByText('Must be available for same dates')).toBeInTheDocument();
      expect(screen.getByText('Similar accommodation quality required')).toBeInTheDocument();
      expect(screen.getByText('Non-refundable booking')).toBeInTheDocument();
    });

    it('should not display swap conditions when showFullDetails is false', () => {
      const swapInfo = createMockSwapInfo({
        swapConditions: [
          'Must be available for same dates',
          'Similar accommodation quality required',
        ],
      });

      render(<SwapTermsSection swapInfo={swapInfo} showFullDetails={false} />);

      expect(screen.queryByText('Conditions:')).not.toBeInTheDocument();
      expect(screen.queryByText('Must be available for same dates')).not.toBeInTheDocument();
    });

    it('should not display conditions section when no conditions exist', () => {
      const swapInfo = createMockSwapInfo({
        swapConditions: [],
      });

      render(<SwapTermsSection swapInfo={swapInfo} showFullDetails={true} />);

      expect(screen.queryByText('Conditions:')).not.toBeInTheDocument();
    });
  });

  describe('Auction End Date Display', () => {
    it('should display auction end date for auction mode swaps', () => {
      const auctionEndDate = new Date('2024-12-25T15:30:00Z');
      const swapInfo = createMockSwapInfo({
        acceptanceStrategy: 'auction',
        auctionEndDate,
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('Auction End:')).toBeInTheDocument();
      expect(screen.getByText('🔨')).toBeInTheDocument();
      // Check that the date is formatted and displayed
      expect(screen.getByText(/Dec 25, 2024/)).toBeInTheDocument();
    });

    it('should not display auction end date for first-match strategy', () => {
      const swapInfo = createMockSwapInfo({
        acceptanceStrategy: 'first-match',
        auctionEndDate: new Date('2024-12-25T15:30:00Z'),
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.queryByText('Auction End:')).not.toBeInTheDocument();
    });

    it('should not display auction end date when date is not provided', () => {
      const swapInfo = createMockSwapInfo({
        acceptanceStrategy: 'auction',
        auctionEndDate: undefined,
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.queryByText('Auction End:')).not.toBeInTheDocument();
    });
  });

  describe('Strategy Display', () => {
    it('should display auction mode strategy', () => {
      const swapInfo = createMockSwapInfo({
        acceptanceStrategy: 'auction',
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('Strategy:')).toBeInTheDocument();
      expect(screen.getByText('🔨')).toBeInTheDocument();
      expect(screen.getByText('Auction Mode')).toBeInTheDocument();
    });

    it('should display first match strategy', () => {
      const swapInfo = createMockSwapInfo({
        acceptanceStrategy: 'first-match',
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('Strategy:')).toBeInTheDocument();
      expect(screen.getByText('🔄')).toBeInTheDocument();
      expect(screen.getByText('First Match')).toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('should render the main section header', () => {
      const swapInfo = createMockSwapInfo();

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('📋')).toBeInTheDocument();
      expect(screen.getByText('Swap Terms')).toBeInTheDocument();
    });

    it('should render with default showFullDetails as true', () => {
      const swapInfo = createMockSwapInfo({
        swapConditions: ['Test condition'],
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('Conditions:')).toBeInTheDocument();
      expect(screen.getByText('Test condition')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing optional fields gracefully', () => {
      const swapInfo: SwapInfo = {
        swapId: 'swap-123',
        paymentTypes: ['booking'],
        acceptanceStrategy: 'first-match',
        hasActiveProposals: false,
        activeProposalCount: 0,
        swapConditions: [],
        // All optional fields are undefined
      };

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('Swap Terms')).toBeInTheDocument();
      expect(screen.getByText('Strategy:')).toBeInTheDocument();
      expect(screen.getByText('First Match')).toBeInTheDocument();
    });

    it('should handle large cash amounts with proper formatting', () => {
      const swapInfo = createMockSwapInfo({
        minCashAmount: 1234567,
        maxCashAmount: 9876543,
      });

      render(<SwapTermsSection swapInfo={swapInfo} />);

      expect(screen.getByText('$1,234,567')).toBeInTheDocument();
      expect(screen.getByText('$9,876,543')).toBeInTheDocument();
    });
  });
});