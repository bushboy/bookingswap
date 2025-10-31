/**
 * Tests for SwapCard financial data handling
 * Requirements: 4.1, 4.2, 4.3, 4.4 - Verify $NaN elimination and proper pricing display
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SwapCard } from '../SwapCard';
import { SwapWithBookings } from '../../../services/swapService';

// Mock the financial data handler
vi.mock('../../../utils/financialDataHandler', () => ({
    FinancialDataHandler: {
        formatCurrency: vi.fn((amount, currency = 'USD') => {
            if (amount === null || amount === undefined || amount === '') {
                return 'Price not set';
            }
            if (isNaN(amount) || !isFinite(amount)) {
                return 'Invalid price';
            }
            return `$${amount.toFixed(2)}`;
        })
    }
}));

const createMockSwap = (sourcePrice: any, targetPrice: any): SwapWithBookings => ({
    id: 'test-swap-1',
    sourceBookingId: 'booking-1',
    targetBookingId: 'booking-2',
    proposerId: 'user-1',
    ownerId: 'user-2',
    status: 'pending',
    terms: {
        additionalPayment: 0,
        conditions: [],
        expiresAt: new Date(Date.now() + 86400000) // 24 hours from now
    },
    blockchain: {
        proposalTransactionId: 'tx-1'
    },
    timeline: {
        proposedAt: new Date()
    },
    sourceBooking: {
        id: 'booking-1',
        title: 'Test Hotel',
        type: 'hotel',
        location: {
            city: 'New York',
            country: 'USA'
        },
        dateRange: {
            checkIn: new Date('2024-12-01'),
            checkOut: new Date('2024-12-05')
        },
        originalPrice: sourcePrice,
        swapValue: sourcePrice
    },
    targetBooking: {
        id: 'booking-2',
        title: 'Target Hotel',
        type: 'hotel',
        location: {
            city: 'Paris',
            country: 'France'
        },
        dateRange: {
            checkIn: new Date('2024-12-01'),
            checkOut: new Date('2024-12-05')
        },
        originalPrice: targetPrice,
        swapValue: targetPrice
    },
    createdAt: new Date(),
    updatedAt: new Date()
});

describe('SwapCard Financial Data Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should display valid pricing correctly', () => {
        const swap = createMockSwap(500, 600);

        render(
            <SwapCard
                swap={swap}
                userRole="proposer"
                onViewDetails={() => { }}
            />
        );

        expect(screen.getByText('$500.00')).toBeInTheDocument();
        expect(screen.getByText('$600.00')).toBeInTheDocument();
    });

    it('should handle null pricing values without showing $NaN', () => {
        const swap = createMockSwap(null, null);

        render(
            <SwapCard
                swap={swap}
                userRole="proposer"
                onViewDetails={() => { }}
            />
        );

        expect(screen.getByText('Price not set')).toBeInTheDocument();
        expect(screen.queryByText('$NaN')).not.toBeInTheDocument();
        expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    });

    it('should handle undefined pricing values', () => {
        const swap = createMockSwap(undefined, undefined);

        render(
            <SwapCard
                swap={swap}
                userRole="proposer"
                onViewDetails={() => { }}
            />
        );

        expect(screen.getByText('Price not set')).toBeInTheDocument();
        expect(screen.queryByText('$NaN')).not.toBeInTheDocument();
    });

    it('should handle mixed valid and invalid pricing', () => {
        const swap = createMockSwap(500, null);

        render(
            <SwapCard
                swap={swap}
                userRole="proposer"
                onViewDetails={() => { }}
            />
        );

        expect(screen.getByText('$500.00')).toBeInTheDocument();
        expect(screen.getByText('Price not set')).toBeInTheDocument();
        expect(screen.queryByText('$NaN')).not.toBeInTheDocument();
    });

    it('should handle zero values correctly', () => {
        const swap = createMockSwap(0, 0);

        render(
            <SwapCard
                swap={swap}
                userRole="proposer"
                onViewDetails={() => { }}
            />
        );

        expect(screen.getAllByText('$0.00')).toHaveLength(2);
        expect(screen.queryByText('$NaN')).not.toBeInTheDocument();
    });

    it('should handle string number values', () => {
        const swap = createMockSwap('500', '600');

        render(
            <SwapCard
                swap={swap}
                userRole="proposer"
                onViewDetails={() => { }}
            />
        );

        expect(screen.getByText('$500.00')).toBeInTheDocument();
        expect(screen.getByText('$600.00')).toBeInTheDocument();
    });

    it('should handle invalid string values', () => {
        const swap = createMockSwap('invalid', 'also-invalid');

        render(
            <SwapCard
                swap={swap}
                userRole="proposer"
                onViewDetails={() => { }}
            />
        );

        expect(screen.getAllByText('Invalid price')).toHaveLength(2);
        expect(screen.queryByText('$NaN')).not.toBeInTheDocument();
    });
});