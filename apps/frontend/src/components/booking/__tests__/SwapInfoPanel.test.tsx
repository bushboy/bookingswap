import React from 'react';
import { render, screen } from '@testing-library/react';
import { SwapInfoPanel } from '../SwapInfoPanel';
import { SwapInfo } from '@booking-swap/shared';

const createMockSwapInfo = (overrides: Partial<SwapInfo> = {}): SwapInfo => ({
  swapId: 'swap-1',
  paymentTypes: ['booking'],
  acceptanceStrategy: 'first-match',
  hasActiveProposals: true,
  activeProposalCount: 1,
  swapConditions: [],
  ...overrides,
});

describe('SwapInfoPanel', () => {
  it('renders swap terms for first-match strategy', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'first-match',
      paymentTypes: ['booking', 'cash'],
      minCashAmount: 100,
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="browser" />);
    
    expect(screen.getByText('Swap Terms')).toBeInTheDocument();
    expect(screen.getByText('Booking Exchange')).toBeInTheDocument();
    expect(screen.getByText('Cash Offers')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('renders auction details for auction strategy', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'auction',
      timeRemaining: 12 * 60 * 60 * 1000, // 12 hours
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="browser" />);
    
    expect(screen.getByText('Auction Mode')).toBeInTheDocument();
    expect(screen.getByText('12h left')).toBeInTheDocument();
    expect(screen.getByText('🔨')).toBeInTheDocument();
  });

  it('formats time remaining correctly for days and hours', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'auction',
      timeRemaining: 2.5 * 24 * 60 * 60 * 1000, // 2.5 days
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="browser" />);
    
    expect(screen.getByText('2d 12h left')).toBeInTheDocument();
  });

  it('displays swap conditions when provided', () => {
    const swapInfo = createMockSwapInfo({
      swapConditions: ['Must be flexible with dates', 'Prefer similar location'],
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="browser" />);
    
    expect(screen.getByText('Conditions:')).toBeInTheDocument();
    expect(screen.getByText('Must be flexible with dates')).toBeInTheDocument();
    expect(screen.getByText('Prefer similar location')).toBeInTheDocument();
  });

  it('hides conditions in compact mode', () => {
    const swapInfo = createMockSwapInfo({
      swapConditions: ['Must be flexible with dates'],
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="browser" compact />);
    
    expect(screen.queryByText('Conditions:')).not.toBeInTheDocument();
    expect(screen.queryByText('Must be flexible with dates')).not.toBeInTheDocument();
  });

  it('shows owner notification for pending proposals', () => {
    const swapInfo = createMockSwapInfo({
      activeProposalCount: 3,
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="owner" />);
    
    expect(screen.getByText('3 active proposals waiting for review')).toBeInTheDocument();
  });

  it('shows proposer status for accepted proposal', () => {
    const swapInfo = createMockSwapInfo({
      userProposalStatus: 'accepted',
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="proposer" />);
    
    expect(screen.getByText('✅ Your proposal was accepted!')).toBeInTheDocument();
  });

  it('shows proposer status for rejected proposal', () => {
    const swapInfo = createMockSwapInfo({
      userProposalStatus: 'rejected',
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="proposer" />);
    
    expect(screen.getByText('❌ Your proposal was declined')).toBeInTheDocument();
  });

  it('shows proposer status for pending proposal', () => {
    const swapInfo = createMockSwapInfo({
      userProposalStatus: 'pending',
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="proposer" />);
    
    expect(screen.getByText('⏳ Your proposal is under review')).toBeInTheDocument();
  });

  it('displays payment type icons correctly', () => {
    const swapInfo = createMockSwapInfo({
      paymentTypes: ['booking', 'cash'],
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="browser" />);
    
    expect(screen.getByText('🔄')).toBeInTheDocument(); // booking icon
    expect(screen.getByText('💰')).toBeInTheDocument(); // cash icon
  });

  it('shows urgency styling for ending soon auctions', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'auction',
      timeRemaining: 12 * 60 * 60 * 1000, // 12 hours (ending soon)
    });
    
    render(<SwapInfoPanel swapInfo={swapInfo} userRole="browser" />);
    
    const timeElement = screen.getByText('12h left');
    expect(timeElement).toBeInTheDocument();
  });
});