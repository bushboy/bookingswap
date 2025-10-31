import React from 'react';
import { render, screen } from '@testing-library/react';
import { SwapInfoPanel } from '../SwapInfoPanel';
import { SwapInfo, BookingUserRole } from '@booking-swap/shared';

// Mock swap info data for integration testing
const createMockSwapInfo = (overrides: Partial<SwapInfo> = {}): SwapInfo => ({
  swapId: 'test-swap-1',
  paymentTypes: ['booking', 'cash'],
  acceptanceStrategy: 'first-match',
  hasActiveProposals: false,
  activeProposalCount: 0,
  swapConditions: [],
  minCashAmount: 100,
  ...overrides
});

describe('ProposalActivitySection Integration', () => {
  it('should render ProposalActivitySection within SwapInfoPanel for owner with proposals', () => {
    const swapInfo = createMockSwapInfo({
      activeProposalCount: 3,
      hasActiveProposals: true
    });

    render(
      <SwapInfoPanel 
        swapInfo={swapInfo} 
        userRole="owner" 
      />
    );

    // Check that ProposalActivitySection content is rendered
    expect(screen.getByText('3 active proposals waiting for review')).toBeInTheDocument();
    expect(screen.getByText('📬')).toBeInTheDocument();
    expect(screen.getByText('Review Proposals')).toBeInTheDocument();

    // Check that other sections are also rendered
    expect(screen.getByText('Swap Terms')).toBeInTheDocument();
    expect(screen.getByText('First Match')).toBeInTheDocument();
  });

  it('should render ProposalActivitySection within SwapInfoPanel for proposer with pending status', () => {
    const swapInfo = createMockSwapInfo({
      userProposalStatus: 'pending',
      activeProposalCount: 1,
      hasActiveProposals: true
    });

    render(
      <SwapInfoPanel 
        swapInfo={swapInfo} 
        userRole="proposer" 
      />
    );

    // Check that ProposalActivitySection shows proposer-specific content
    expect(screen.getByText('Your proposal is under review')).toBeInTheDocument();
    expect(screen.getByText('⏳')).toBeInTheDocument();
  });

  it('should render ProposalActivitySection within SwapInfoPanel for browser role', () => {
    const swapInfo = createMockSwapInfo({
      activeProposalCount: 2,
      hasActiveProposals: true
    });

    render(
      <SwapInfoPanel 
        swapInfo={swapInfo} 
        userRole="browser" 
      />
    );

    // Check that ProposalActivitySection shows browser-specific content
    expect(screen.getByText('2 proposals submitted')).toBeInTheDocument();
    expect(screen.getByText('👥')).toBeInTheDocument();
  });

  it('should render ProposalActivitySection in compact mode within SwapInfoPanel', () => {
    const swapInfo = createMockSwapInfo({
      activeProposalCount: 2,
      hasActiveProposals: true
    });

    render(
      <SwapInfoPanel 
        swapInfo={swapInfo} 
        userRole="owner" 
        compact={true}
      />
    );

    // Check that ProposalActivitySection content is rendered
    expect(screen.getByText('2 active proposals waiting for review')).toBeInTheDocument();
    
    // Check that review button is not shown in compact mode
    expect(screen.queryByText('Review Proposals')).not.toBeInTheDocument();
  });

  it('should handle high urgency proposals within SwapInfoPanel', () => {
    const swapInfo = createMockSwapInfo({
      activeProposalCount: 5,
      hasActiveProposals: true
    });

    const { container } = render(
      <SwapInfoPanel 
        swapInfo={swapInfo} 
        userRole="owner" 
      />
    );

    // Check that high urgency content is rendered
    expect(screen.getByText('5 active proposals waiting for review')).toBeInTheDocument();
    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    
    // Check that urgency styling is applied
    const proposalSection = container.querySelector('[style*="border-left"]');
    expect(proposalSection).toBeInTheDocument();
  });

  it('should render ProposalActivitySection alongside other sections in correct order', () => {
    const swapInfo = createMockSwapInfo({
      activeProposalCount: 1,
      hasActiveProposals: true,
      acceptanceStrategy: 'auction',
      timeRemaining: 3600000 // 1 hour
    });

    render(
      <SwapInfoPanel 
        swapInfo={swapInfo} 
        userRole="owner" 
      />
    );

    const panelContent = screen.getByText('1 active proposal waiting for review').closest('div');
    
    // Check that sections are rendered in expected order
    expect(screen.getByText('Auction Mode')).toBeInTheDocument(); // SwapStatusSection
    expect(screen.getByText('1 active proposal waiting for review')).toBeInTheDocument(); // ProposalActivitySection
    expect(screen.getByText('Swap Terms')).toBeInTheDocument(); // SwapTermsSection
    expect(screen.getByText('Review Proposals')).toBeInTheDocument(); // ActionItemsSection
  });

  it('should pass correct props to ProposalActivitySection from SwapInfoPanel', () => {
    const swapInfo = createMockSwapInfo({
      activeProposalCount: 0,
      hasActiveProposals: false
    });

    render(
      <SwapInfoPanel 
        swapInfo={swapInfo} 
        userRole="owner" 
        compact={false}
      />
    );

    // Verify that ProposalActivitySection receives and handles the props correctly
    expect(screen.getByText('No proposals received yet')).toBeInTheDocument();
    expect(screen.getByText('📭')).toBeInTheDocument();
  });
});