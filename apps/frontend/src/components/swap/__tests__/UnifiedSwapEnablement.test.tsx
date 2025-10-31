import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedSwapEnablement } from '../UnifiedSwapEnablement';
import { Booking, SwapPreferencesData } from '@booking-swap/shared';

// Mock the wallet hook
jest.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({
    isConnected: true,
    accountInfo: { accountId: 'test-account' },
  }),
}));

// Mock the booking with wallet hook
jest.mock('@/hooks/useBookingWithWallet', () => ({
  useBookingWithWallet: () => ({
    enableSwappingWithWallet: jest.fn().mockResolvedValue({}),
    canEnableSwapping: jest.fn().mockReturnValue(true),
  }),
}));

// Mock the swap preferences section
jest.mock('@/components/booking/SwapPreferencesSection', () => ({
  SwapPreferencesSection: ({ enabled, onToggle }: any) => (
    <div data-testid="swap-preferences-section">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          data-testid="swap-toggle"
        />
        Enable Swapping
      </label>
    </div>
  ),
}));

const mockBooking: Booking = {
  id: 'test-booking-id',
  type: 'hotel',
  title: 'Test Hotel Booking',
  description: 'A test hotel booking',
  location: {
    city: 'Paris',
    country: 'France',
  },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-05'),
  },
  originalPrice: 500,
  swapValue: 450,
  providerDetails: {
    provider: 'Test Provider',
    confirmationNumber: 'TEST123',
    bookingReference: 'REF456',
  },
  status: 'available',
  userId: 'test-user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  verification: {
    status: 'verified',
    verifiedAt: new Date(),
    verifiedBy: 'test-verifier',
  },
};

describe('UnifiedSwapEnablement', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    booking: mockBooking,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders swap preferences section in integrated mode', () => {
    render(
      <UnifiedSwapEnablement
        {...defaultProps}
        integrated={true}
      />
    );

    expect(screen.getByTestId('swap-preferences-section')).toBeInTheDocument();
    expect(screen.getByTestId('swap-toggle')).toBeInTheDocument();
  });

  it('renders modal in non-integrated mode', () => {
    render(
      <UnifiedSwapEnablement
        {...defaultProps}
        integrated={false}
      />
    );

    expect(screen.getByText('Enable Swapping for "Test Hotel Booking"')).toBeInTheDocument();
    expect(screen.getByText('📋 Booking Details')).toBeInTheDocument();
    expect(screen.getByTestId('swap-preferences-section')).toBeInTheDocument();
  });

  it('calls onSuccess when swap is enabled in integrated mode', async () => {
    const mockOnSuccess = jest.fn();
    
    render(
      <UnifiedSwapEnablement
        {...defaultProps}
        integrated={true}
        onSuccess={mockOnSuccess}
      />
    );

    const toggle = screen.getByTestId('swap-toggle');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('shows wallet connection prompt when wallet is not connected', () => {
    // Mock wallet as not connected
    jest.doMock('@/hooks/useWallet', () => ({
      useWallet: () => ({
        isConnected: false,
        accountInfo: null,
      }),
    }));

    render(
      <UnifiedSwapEnablement
        {...defaultProps}
        integrated={false}
      />
    );

    // The component should still render, but wallet status should be shown
    expect(screen.getByText('⚠️ Wallet Not Connected')).toBeInTheDocument();
  });

  it('handles initial preferences correctly', () => {
    const initialPreferences: SwapPreferencesData = {
      paymentTypes: ['booking', 'cash'],
      acceptanceStrategy: 'auction',
      minCashAmount: 100,
      maxCashAmount: 200,
      swapConditions: ['No smoking'],
    };

    render(
      <UnifiedSwapEnablement
        {...defaultProps}
        integrated={true}
        initialPreferences={initialPreferences}
      />
    );

    const toggle = screen.getByTestId('swap-toggle');
    expect(toggle).toBeChecked();
  });

  it('closes modal when cancel button is clicked', () => {
    const mockOnClose = jest.fn();
    
    render(
      <UnifiedSwapEnablement
        {...defaultProps}
        integrated={false}
        onClose={mockOnClose}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

