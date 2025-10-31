import React from 'react';
import { render, screen } from '@testing-library/react';
import { SwapInfoPanel } from '../SwapInfoPanel';
import { SwapInfo } from '@booking-swap/shared';

const createMockSwapInfo = (overrides: Partial<SwapInfo> = {}): SwapInfo => ({
  swapId: 'swap-1',
  paymentTypes: ['booking'],
  acceptanceStrategy: 'first-match',
  hasActiveProposals: false,
  activeProposalCount: 0,
  swapConditions: [],
  ...overrides,
});

describe('SwapStatusSection Integration', () => {
  it('renders first-match status correctly in SwapInfoPanel', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'first-match',
      hasActiveProposals: false,
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="browser" />);
    
    // Check for first-match mode indicators
    expect(screen.getByText('🔄')).toBeInTheDocument();
    expect(screen.getByText('First Match')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('renders active first-match status correctly', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'first-match',
      hasActiveProposals: true,
      activeProposalCount: 2,
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="browser" />);
    
    expect(screen.getByText('🔄')).toBeInTheDocument();
    expect(screen.getByText('First Match')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders auction mode status correctly', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'auction',
      timeRemaining: 2 * 60 * 60 * 1000, // 2 hours
      auctionEndDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="browser" />);
    
    expect(screen.getByText('🔨')).toBeInTheDocument();
    expect(screen.getByText('Auction Mode')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('⏰')).toBeInTheDocument();
  });

  it('renders expired auction status correctly', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'auction',
      timeRemaining: 0,
      auctionEndDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="browser" />);
    
    expect(screen.getByText('🔨')).toBeInTheDocument();
    expect(screen.getByText('Auction Mode')).toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows countdown timer for active auctions', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'auction',
      timeRemaining: 90 * 60 * 1000, // 90 minutes
      auctionEndDate: new Date(Date.now() + 90 * 60 * 1000),
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="browser" />);
    
    expect(screen.getByText('⏰')).toBeInTheDocument();
    // Should show time in hours, minutes, seconds format
    expect(screen.getByText(/1h 30m/)).toBeInTheDocument();
  });
});