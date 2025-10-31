import React from 'react';
import { render, screen } from '@testing-library/react';
import { SwapBrowser } from '../SwapBrowser';

// Simple test to verify the component renders without errors
describe('SwapBrowser - Simple Test', () => {
  const mockProps = {
    swaps: [],
    userBookings: [],
    loading: false,
    error: null,
    onSwapSelect: jest.fn(),
    onSwapProposal: jest.fn(),
    currentUserId: 'test-user',
  };

  it('should render without crashing', () => {
    render(<SwapBrowser {...mockProps} />);
    expect(screen.getByText('Browse Available Swaps')).toBeInTheDocument();
  });

  it('should show empty state when no swaps are provided', () => {
    render(<SwapBrowser {...mockProps} />);
    expect(screen.getByText('No swaps available')).toBeInTheDocument();
  });

  it('should show loading state when loading is true', () => {
    render(<SwapBrowser {...mockProps} loading={true} />);
    expect(screen.getByText('Loading swaps...')).toBeInTheDocument();
  });

  it('should show error state when error is provided', () => {
    const errorMessage = 'Failed to load swaps';
    render(<SwapBrowser {...mockProps} error={errorMessage} />);
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});
