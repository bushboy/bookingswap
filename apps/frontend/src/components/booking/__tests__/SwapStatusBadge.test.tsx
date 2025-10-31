import React from 'react';
import { render, screen } from '@testing-library/react';
import { SwapStatusBadge } from '../SwapStatusBadge';
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

describe('SwapStatusBadge', () => {
  it('renders nothing when no swap info provided', () => {
    const { container } = render(<SwapStatusBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when swap has no active proposals', () => {
    const swapInfo = createMockSwapInfo({ hasActiveProposals: false });
    const { container } = render(<SwapStatusBadge swapInfo={swapInfo} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders basic swap badge for first-match strategy', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'first-match',
      hasActiveProposals: true,
    });
    
    render(<SwapStatusBadge swapInfo={swapInfo} />);
    expect(screen.getByText('Available for Swap')).toBeInTheDocument();
    expect(screen.getByText('🔄')).toBeInTheDocument();
  });

  it('renders auction badge for auction strategy', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'auction',
      hasActiveProposals: true,
    });
    
    render(<SwapStatusBadge swapInfo={swapInfo} />);
    expect(screen.getByText('Auction Active')).toBeInTheDocument();
    expect(screen.getByText('🔨')).toBeInTheDocument();
  });

  it('renders ending soon badge when time remaining is less than 24 hours', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'auction',
      hasActiveProposals: true,
      timeRemaining: 12 * 60 * 60 * 1000, // 12 hours
    });
    
    render(<SwapStatusBadge swapInfo={swapInfo} />);
    expect(screen.getByText('Ending Soon')).toBeInTheDocument();
    expect(screen.getByText('⏰')).toBeInTheDocument();
  });

  it('renders last chance badge when time remaining is less than 2 hours', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'auction',
      hasActiveProposals: true,
      timeRemaining: 1 * 60 * 60 * 1000, // 1 hour
    });
    
    render(<SwapStatusBadge swapInfo={swapInfo} />);
    expect(screen.getByText('Last Chance')).toBeInTheDocument();
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('renders compact variant with shorter text', () => {
    const swapInfo = createMockSwapInfo({
      acceptanceStrategy: 'auction',
      hasActiveProposals: true,
    });
    
    render(<SwapStatusBadge swapInfo={swapInfo} variant="compact" />);
    expect(screen.getByText('AUCTION')).toBeInTheDocument();
    expect(screen.queryByText('Auction Active')).not.toBeInTheDocument();
  });

  it('displays proposal count badge when activeProposalCount > 0', () => {
    const swapInfo = createMockSwapInfo({
      hasActiveProposals: true,
      activeProposalCount: 3,
    });
    
    render(<SwapStatusBadge swapInfo={swapInfo} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not display proposal count in compact variant', () => {
    const swapInfo = createMockSwapInfo({
      hasActiveProposals: true,
      activeProposalCount: 3,
    });
    
    render(<SwapStatusBadge swapInfo={swapInfo} variant="compact" />);
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });
});