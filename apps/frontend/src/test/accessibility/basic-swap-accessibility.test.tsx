/**
 * Basic accessibility tests for swap components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { SwapStatusBadge } from '@/components/booking/SwapStatusBadge';

// Mock data
const mockSwapInfo = {
  hasActiveProposals: true,
  acceptanceStrategy: 'auction' as const,
  paymentTypes: ['booking', 'cash'] as const,
  activeProposalCount: 3,
  timeRemaining: 2 * 60 * 60 * 1000, // 2 hours
};

describe('Basic Swap Accessibility', () => {
  it('should render SwapStatusBadge with proper accessibility attributes', () => {
    render(<SwapStatusBadge swapInfo={mockSwapInfo} />);

    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label');
  });

  it('should provide descriptive text for screen readers', () => {
    render(<SwapStatusBadge swapInfo={mockSwapInfo} />);

    // Check that the badge has a title attribute for tooltips
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('title');
  });

  it('should handle null swap info gracefully', () => {
    render(<SwapStatusBadge swapInfo={undefined} />);

    // Should not render anything when no swap info
    const badge = screen.queryByRole('status');
    expect(badge).not.toBeInTheDocument();
  });
});