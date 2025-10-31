import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InlineProposalForm } from '../InlineProposalForm';
import { PaymentTypeSelector } from '../PaymentTypeSelector';

// Mock dependencies
vi.mock('@/services/bookingService', () => ({
  bookingService: {
    getAvailableBookings: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    isAuthenticated: true,
  }),
}));

// Mock console.warn to capture React warnings
const originalWarn = console.warn;
let warnings: string[] = [];

beforeEach(() => {
  warnings = [];
  console.warn = (...args: any[]) => {
    warnings.push(args.join(' '));
    originalWarn(...args);
  };
});

afterEach(() => {
  console.warn = originalWarn;
});

describe('CSS Property Conflicts - Fixed Components', () => {
  it('InlineProposalForm should render without CSS property conflict warnings', async () => {
    const mockProps = {
      booking: {
        id: 'test-booking',
        title: 'Test Booking',
        acceptsBookingSwaps: true,
        acceptsCashOffers: true,
        minCashOffer: 100,
        maxCashOffer: 1000,
        swapInfo: {
          availableForSwap: true,
          swapPreferences: []
        }
      },
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    };

    render(<InlineProposalForm {...mockProps} />);

    // Check that no CSS property conflict warnings were generated
    const cssWarnings = warnings.filter(warning => 
      warning.includes('border') && warning.includes('borderColor')
    );
    
    expect(cssWarnings).toHaveLength(0);
  });

  it('PaymentTypeSelector should render without CSS property conflict warnings', () => {
    const mockProps = {
      selected: [],
      onChange: vi.fn(),
      availableTypes: ['cash', 'booking'],
    };

    render(<PaymentTypeSelector {...mockProps} />);

    // Check that no CSS property conflict warnings were generated
    const cssWarnings = warnings.filter(warning => 
      warning.includes('border') && warning.includes('borderColor')
    );
    
    expect(cssWarnings).toHaveLength(0);
  });
});