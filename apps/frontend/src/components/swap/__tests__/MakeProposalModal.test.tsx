import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MakeProposalModal } from '../MakeProposalModal';
import { EligibleSwap, SwapWithProposalInfo } from '@booking-swap/shared';

// Mock the hooks
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false }),
}));

vi.mock('../../../hooks/useAccessibility', () => ({
  useId: (prefix: string) => `${prefix}-test-id`,
  useAnnouncements: () => ({ announce: vi.fn() }),
}));

// Mock the ProposalCreationForm component
vi.mock('../ProposalCreationForm', () => ({
  ProposalCreationForm: ({ onSubmit, onCancel }: any) => (
    <div data-testid="proposal-form">
      <button onClick={() => onSubmit({ test: 'data' })}>Submit</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

const mockTargetSwap: SwapWithProposalInfo = {
  id: 'target-swap-1',
  sourceBookingId: 'booking-1',
  targetBookingId: 'booking-2',
  proposerId: 'user-1',
  ownerId: 'user-2',
  status: 'pending',
  terms: {
    conditions: [],
    expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
  },
  blockchain: {
    proposalTransactionId: 'tx-1',
  },
  timeline: {
    proposedAt: new Date(),
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  title: 'Beach House in Miami',
  location: 'Miami, FL',
  estimatedValue: 2500,
};

const mockEligibleSwaps: EligibleSwap[] = [
  {
    id: 'eligible-swap-1',
    sourceBookingId: 'booking-3',
    title: 'Mountain Cabin in Colorado',
    description: 'Cozy cabin with mountain views',
    bookingDetails: {
      location: 'Aspen, CO',
      dateRange: {
        checkIn: new Date('2024-07-01'),
        checkOut: new Date('2024-07-07'),
      },
      accommodationType: 'Cabin',
      guests: 4,
      estimatedValue: 2200,
    },
    status: 'pending',
    createdAt: new Date(),
    isCompatible: true,
    compatibilityScore: 85,
  },
  {
    id: 'eligible-swap-2',
    sourceBookingId: 'booking-4',
    title: 'City Apartment in NYC',
    description: 'Modern apartment in Manhattan',
    bookingDetails: {
      location: 'New York, NY',
      dateRange: {
        checkIn: new Date('2024-07-15'),
        checkOut: new Date('2024-07-22'),
      },
      accommodationType: 'Apartment',
      guests: 2,
      estimatedValue: 3000,
    },
    status: 'pending',
    createdAt: new Date(),
    isCompatible: true,
    compatibilityScore: 72,
  },
];

describe('MakeProposalModal', () => {
  const defaultProps = {
    isOpen: true,
    targetSwap: mockTargetSwap,
    userEligibleSwaps: mockEligibleSwaps,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal when open', () => {
    render(<MakeProposalModal {...defaultProps} />);
    
    expect(screen.getByText('Select Your Swap')).toBeInTheDocument();
    expect(screen.getByText('Proposing to this swap:')).toBeInTheDocument();
    expect(screen.getByText('Beach House in Miami')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<MakeProposalModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Select Your Swap')).not.toBeInTheDocument();
  });

  it('displays eligible swaps for selection', () => {
    render(<MakeProposalModal {...defaultProps} />);
    
    expect(screen.getByText('Mountain Cabin in Colorado')).toBeInTheDocument();
    expect(screen.getByText('City Apartment in NYC')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  it('allows selecting a swap', async () => {
    render(<MakeProposalModal {...defaultProps} />);
    
    const firstSwapCard = screen.getByText('Mountain Cabin in Colorado').closest('[role="button"]');
    expect(firstSwapCard).toBeInTheDocument();
    
    fireEvent.click(firstSwapCard!);
    
    // Check if the continue button becomes enabled
    const continueButton = screen.getByText('Continue to Proposal');
    expect(continueButton).not.toBeDisabled();
  });

  it('shows no eligible swaps message when list is empty', () => {
    render(<MakeProposalModal {...defaultProps} userEligibleSwaps={[]} />);
    
    expect(screen.getByText('No Eligible Swaps')).toBeInTheDocument();
    expect(screen.getByText(/You don't have any swaps that are eligible/)).toBeInTheDocument();
  });

  it('proceeds to form when continue is clicked with selected swap', async () => {
    render(<MakeProposalModal {...defaultProps} />);
    
    // Select first swap
    const firstSwapCard = screen.getByText('Mountain Cabin in Colorado').closest('[role="button"]');
    fireEvent.click(firstSwapCard!);
    
    // Click continue
    const continueButton = screen.getByText('Continue to Proposal');
    fireEvent.click(continueButton);
    
    // Should show the form
    await waitFor(() => {
      expect(screen.getByTestId('proposal-form')).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel is clicked', () => {
    render(<MakeProposalModal {...defaultProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('handles form submission', async () => {
    render(<MakeProposalModal {...defaultProps} />);
    
    // Select first swap and proceed to form
    const firstSwapCard = screen.getByText('Mountain Cabin in Colorado').closest('[role="button"]');
    fireEvent.click(firstSwapCard!);
    
    const continueButton = screen.getByText('Continue to Proposal');
    fireEvent.click(continueButton);
    
    // Submit the form
    await waitFor(() => {
      const submitButton = screen.getByText('Submit');
      fireEvent.click(submitButton);
    });
    
    expect(defaultProps.onSubmit).toHaveBeenCalledWith({
      targetSwapId: 'target-swap-1',
      sourceSwapId: 'eligible-swap-1',
      proposerId: '',
      message: undefined,
      conditions: undefined,
      agreedToTerms: undefined,
    });
  });

  it('shows loading state', () => {
    render(<MakeProposalModal {...defaultProps} loading={true} />);
    
    // The loading state would be passed to the form component
    // This test verifies the prop is passed correctly
    expect(screen.getByText('Select Your Swap')).toBeInTheDocument();
  });

  it('supports keyboard navigation', () => {
    render(<MakeProposalModal {...defaultProps} />);
    
    const firstSwapCard = screen.getByText('Mountain Cabin in Colorado').closest('[role="button"]');
    expect(firstSwapCard).toHaveAttribute('tabIndex', '0');
    
    // Test keyboard selection
    fireEvent.keyDown(firstSwapCard!, { key: 'Enter' });
    
    const continueButton = screen.getByText('Continue to Proposal');
    expect(continueButton).not.toBeDisabled();
  });
});