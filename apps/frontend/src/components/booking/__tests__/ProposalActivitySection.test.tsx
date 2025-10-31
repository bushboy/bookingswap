import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProposalActivitySection } from '../ProposalActivitySection';
import { SwapInfo, BookingUserRole } from '@booking-swap/shared';

// Mock swap info data for testing
const createMockSwapInfo = (overrides: Partial<SwapInfo> = {}): SwapInfo => ({
  swapId: 'test-swap-1',
  paymentTypes: ['booking', 'cash'],
  acceptanceStrategy: 'first-match',
  hasActiveProposals: false,
  activeProposalCount: 0,
  swapConditions: [],
  ...overrides
});

describe('ProposalActivitySection', () => {
  describe('Owner role', () => {
    it('should display "No proposals received yet" when no proposals exist', () => {
      const swapInfo = createMockSwapInfo({
        activeProposalCount: 0,
        hasActiveProposals: false
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="owner" 
        />
      );

      expect(screen.getByText('No proposals received yet')).toBeInTheDocument();
      expect(screen.getByText('📭')).toBeInTheDocument();
      expect(screen.queryByText('Review Proposals')).not.toBeInTheDocument();
    });

    it('should display proposal count and review button when proposals exist', () => {
      const swapInfo = createMockSwapInfo({
        activeProposalCount: 2,
        hasActiveProposals: true
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="owner" 
        />
      );

      expect(screen.getByText('2 active proposals waiting for review')).toBeInTheDocument();
      expect(screen.getByText('📬')).toBeInTheDocument();
      expect(screen.getByText('Review Proposals')).toBeInTheDocument();
    });

    it('should display singular "proposal" for count of 1', () => {
      const swapInfo = createMockSwapInfo({
        activeProposalCount: 1,
        hasActiveProposals: true
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="owner" 
        />
      );

      expect(screen.getByText('1 active proposal waiting for review')).toBeInTheDocument();
    });

    it('should show high urgency styling for more than 3 proposals', () => {
      const swapInfo = createMockSwapInfo({
        activeProposalCount: 5,
        hasActiveProposals: true
      });

      const { container } = render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="owner" 
        />
      );

      expect(screen.getByText('5 active proposals waiting for review')).toBeInTheDocument();
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
      
      // Check for urgency styling
      const sectionElement = container.firstChild as HTMLElement;
      expect(sectionElement).toHaveStyle({
        'border-left': expect.stringContaining('4px solid')
      });
    });

    it('should not show review button in compact mode', () => {
      const swapInfo = createMockSwapInfo({
        activeProposalCount: 2,
        hasActiveProposals: true
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="owner" 
          compact={true}
        />
      );

      expect(screen.getByText('2 active proposals waiting for review')).toBeInTheDocument();
      expect(screen.queryByText('Review Proposals')).not.toBeInTheDocument();
    });
  });

  describe('Proposer role', () => {
    it('should display "Available for proposals" when no proposal status', () => {
      const swapInfo = createMockSwapInfo({
        userProposalStatus: undefined
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="proposer" 
        />
      );

      expect(screen.getByText('Available for proposals')).toBeInTheDocument();
      expect(screen.getByText('✨')).toBeInTheDocument();
    });

    it('should display pending status with correct icon', () => {
      const swapInfo = createMockSwapInfo({
        userProposalStatus: 'pending'
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="proposer" 
        />
      );

      expect(screen.getByText('Your proposal is under review')).toBeInTheDocument();
      expect(screen.getByText('⏳')).toBeInTheDocument();
    });

    it('should display accepted status with correct icon', () => {
      const swapInfo = createMockSwapInfo({
        userProposalStatus: 'accepted'
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="proposer" 
        />
      );

      expect(screen.getByText('Your proposal was accepted!')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
    });

    it('should display rejected status with correct icon', () => {
      const swapInfo = createMockSwapInfo({
        userProposalStatus: 'rejected'
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="proposer" 
        />
      );

      expect(screen.getByText('Your proposal was declined')).toBeInTheDocument();
      expect(screen.getByText('❌')).toBeInTheDocument();
    });
  });

  describe('Browser role', () => {
    it('should display "Available for proposals" when no proposals exist', () => {
      const swapInfo = createMockSwapInfo({
        activeProposalCount: 0,
        hasActiveProposals: false
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="browser" 
        />
      );

      expect(screen.getByText('Available for proposals')).toBeInTheDocument();
      expect(screen.getByText('✨')).toBeInTheDocument();
    });

    it('should display proposal count when proposals exist', () => {
      const swapInfo = createMockSwapInfo({
        activeProposalCount: 3,
        hasActiveProposals: true
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="browser" 
        />
      );

      expect(screen.getByText('3 proposals submitted')).toBeInTheDocument();
      expect(screen.getByText('👥')).toBeInTheDocument();
    });

    it('should display singular "proposal" for count of 1', () => {
      const swapInfo = createMockSwapInfo({
        activeProposalCount: 1,
        hasActiveProposals: true
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="browser" 
        />
      );

      expect(screen.getByText('1 proposal submitted')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined activeProposalCount gracefully', () => {
      const swapInfo = createMockSwapInfo({
        activeProposalCount: undefined as any,
        hasActiveProposals: false
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="owner" 
        />
      );

      expect(screen.getByText('No proposals received yet')).toBeInTheDocument();
    });

    it('should handle zero activeProposalCount correctly', () => {
      const swapInfo = createMockSwapInfo({
        activeProposalCount: 0,
        hasActiveProposals: false
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="browser" 
        />
      );

      expect(screen.getByText('Available for proposals')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button accessibility for review proposals', () => {
      const swapInfo = createMockSwapInfo({
        activeProposalCount: 2,
        hasActiveProposals: true
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="owner" 
        />
      );

      const reviewButton = screen.getByRole('button', { name: /review proposals/i });
      expect(reviewButton).toBeInTheDocument();
      expect(reviewButton).toHaveAttribute('type', 'button');
    });

    it('should have appropriate text content for screen readers', () => {
      const swapInfo = createMockSwapInfo({
        activeProposalCount: 5,
        hasActiveProposals: true
      });

      render(
        <ProposalActivitySection 
          swapInfo={swapInfo} 
          userRole="owner" 
        />
      );

      // Check that urgency indicator is present for screen readers
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    });
  });
});