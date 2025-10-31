import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { SwapStatusSection } from '../SwapStatusSection';
import { SwapInfo } from '@booking-swap/shared';

describe('SwapStatusSection', () => {
  const baseSwapInfo: SwapInfo = {
    swapId: 'test-swap-1',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    hasActiveProposals: false,
    activeProposalCount: 0,
    swapConditions: [],
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders first-match mode correctly', () => {
    render(<SwapStatusSection swapInfo={baseSwapInfo} />);
    
    expect(screen.getByText('🔄')).toBeInTheDocument();
    expect(screen.getByText('First Match')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('renders first-match mode with active proposals', () => {
    const swapInfoWithProposals: SwapInfo = {
      ...baseSwapInfo,
      hasActiveProposals: true,
      activeProposalCount: 2,
    };

    render(<SwapStatusSection swapInfo={swapInfoWithProposals} />);
    
    expect(screen.getByText('🔄')).toBeInTheDocument();
    expect(screen.getByText('First Match')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders auction mode correctly when active', () => {
    const auctionSwapInfo: SwapInfo = {
      ...baseSwapInfo,
      acceptanceStrategy: 'auction',
      timeRemaining: 2 * 60 * 60 * 1000, // 2 hours
      auctionEndDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
    };

    render(<SwapStatusSection swapInfo={auctionSwapInfo} />);
    
    expect(screen.getByText('🔨')).toBeInTheDocument();
    expect(screen.getByText('Auction Mode')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('⏰')).toBeInTheDocument();
    expect(screen.getByText('2h 0m 0s')).toBeInTheDocument();
  });

  it('renders auction mode with high urgency when time is low', () => {
    const urgentAuctionSwapInfo: SwapInfo = {
      ...baseSwapInfo,
      acceptanceStrategy: 'auction',
      timeRemaining: 30 * 60 * 1000, // 30 minutes
      auctionEndDate: new Date(Date.now() + 30 * 60 * 1000),
    };

    render(<SwapStatusSection swapInfo={urgentAuctionSwapInfo} />);
    
    expect(screen.getByText('🔨')).toBeInTheDocument();
    expect(screen.getByText('Auction Mode')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('30m 0s')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument(); // Urgency indicator
  });

  it('renders expired auction correctly', () => {
    const expiredAuctionSwapInfo: SwapInfo = {
      ...baseSwapInfo,
      acceptanceStrategy: 'auction',
      timeRemaining: 0,
      auctionEndDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    };

    render(<SwapStatusSection swapInfo={expiredAuctionSwapInfo} />);
    
    expect(screen.getByText('🔨')).toBeInTheDocument();
    expect(screen.getByText('Auction Mode')).toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('updates countdown timer correctly', () => {
    const auctionSwapInfo: SwapInfo = {
      ...baseSwapInfo,
      acceptanceStrategy: 'auction',
      timeRemaining: 65 * 1000, // 1 minute 5 seconds
      auctionEndDate: new Date(Date.now() + 65 * 1000),
    };

    render(<SwapStatusSection swapInfo={auctionSwapInfo} />);
    
    // Initial state
    expect(screen.getByText('1m 5s')).toBeInTheDocument();
    
    // Advance timer by 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    
    expect(screen.getByText('1m 0s')).toBeInTheDocument();
    
    // Advance timer by another 60 seconds
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows pulse animation for very urgent auctions', () => {
    const veryUrgentAuctionSwapInfo: SwapInfo = {
      ...baseSwapInfo,
      acceptanceStrategy: 'auction',
      timeRemaining: 30 * 1000, // 30 seconds
      auctionEndDate: new Date(Date.now() + 30 * 1000),
    };

    render(<SwapStatusSection swapInfo={veryUrgentAuctionSwapInfo} />);
    
    expect(screen.getByText('30s')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
    
    // The pulse animation should be applied (we can't easily test CSS animations in jsdom)
    // but we can verify the component renders without errors
  });

  it('formats time correctly for different durations', () => {
    const testCases = [
      { timeRemaining: 5 * 24 * 60 * 60 * 1000, expected: '5d 0h 0m' }, // 5 days
      { timeRemaining: 25 * 60 * 60 * 1000, expected: '1d 1h 0m' }, // 25 hours
      { timeRemaining: 90 * 60 * 1000, expected: '1h 30m 0s' }, // 90 minutes
      { timeRemaining: 45 * 1000, expected: '45s' }, // 45 seconds
    ];

    testCases.forEach(({ timeRemaining, expected }) => {
      const swapInfo: SwapInfo = {
        ...baseSwapInfo,
        acceptanceStrategy: 'auction',
        timeRemaining,
        auctionEndDate: new Date(Date.now() + timeRemaining),
      };

      const { unmount } = render(<SwapStatusSection swapInfo={swapInfo} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    });
  });
});