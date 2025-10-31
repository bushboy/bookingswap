/**
 * Integration tests for SwapInfoPanel with data enrichment
 */

import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SwapInfoPanel } from '../SwapInfoPanel';
import { SwapInfo } from '@booking-swap/shared';

describe('SwapInfoPanel with Data Enrichment', () => {
  const mockSwapInfo: SwapInfo = {
    swapId: 'swap-123',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 100,
    maxCashAmount: 500,
    hasActiveProposals: false,
    activeProposalCount: 0,
    swapConditions: ['Must be similar location']
  };

  it('should render with enriched data for browser role', () => {
    expect(() => {
      render(
        <SwapInfoPanel
          swapInfo={mockSwapInfo}
          userRole="browser"
          compact={false}
          showFullDetails={true}
        />
      );
    }).not.toThrow();
  });

  it('should render with enriched data for owner with proposals', () => {
    const swapWithProposals: SwapInfo = {
      ...mockSwapInfo,
      hasActiveProposals: true,
      activeProposalCount: 3
    };

    expect(() => {
      render(
        <SwapInfoPanel
          swapInfo={swapWithProposals}
          userRole="owner"
          compact={false}
          showFullDetails={true}
        />
      );
    }).not.toThrow();
  });

  it('should render with enriched data for urgent auction', () => {
    const urgentAuction: SwapInfo = {
      ...mockSwapInfo,
      acceptanceStrategy: 'auction',
      auctionEndDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      timeRemaining: 2 * 60 * 60 * 1000 // 2 hours
    };

    expect(() => {
      render(
        <SwapInfoPanel
          swapInfo={urgentAuction}
          userRole="browser"
          compact={false}
          showFullDetails={true}
        />
      );
    }).not.toThrow();
  });

  it('should render in compact mode', () => {
    expect(() => {
      render(
        <SwapInfoPanel
          swapInfo={mockSwapInfo}
          userRole="browser"
          compact={true}
          showFullDetails={false}
        />
      );
    }).not.toThrow();
  });

  it('should handle proposer role with pending status', () => {
    const proposerSwap: SwapInfo = {
      ...mockSwapInfo,
      userProposalStatus: 'pending'
    };

    expect(() => {
      render(
        <SwapInfoPanel
          swapInfo={proposerSwap}
          userRole="proposer"
          compact={false}
          showFullDetails={true}
        />
      );
    }).not.toThrow();
  });
});