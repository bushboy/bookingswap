import React from 'react';
import { render, screen } from '@testing-library/react';
import { EnhancedSwapCard } from '../SwapCard.enhanced';
import { EnhancedSwapCardData } from '@booking-swap/shared';

import { vi } from 'vitest';

// Mock the financial data handler
vi.mock('../../../utils/financialDataHandler', () => ({
    FinancialDataHandler: {
        formatCurrency: (amount: any) => `$${amount || 0}.00`
    }
}));

// Mock hooks
vi.mock('../../../hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: false, isTablet: false })
}));

vi.mock('../../../hooks/useAccessibility', () => ({
    useId: (prefix: string) => `${prefix}-test-id`,
    useAnnouncements: () => ({ announce: vi.fn() }),
    useHighContrast: () => ({ isHighContrast: false })
}));

vi.mock('../../../hooks/useSwapWebSocket', () => ({
    useSwapWebSocket: () => ({ isConnected: true })
}));

vi.mock('../../../utils/accessibility', () => ({
    getButtonAria: () => ({}),
    getFocusVisibleStyles: () => ({}),
    getHighContrastStyles: () => ({})
}));

const mockSwapData: EnhancedSwapCardData = {
    userSwap: {
        id: 'swap-1',
        bookingDetails: {
            title: 'Test Hotel Booking',
            location: { city: 'New York', country: 'USA' },
            swapValue: 500,
            dateRange: {
                checkIn: new Date('2024-12-01'),
                checkOut: new Date('2024-12-05')
            }
        },
        status: 'pending',
        createdAt: new Date('2024-11-01'),
        expiresAt: new Date('2024-12-31')
    },
    proposalsFromOthers: [],
    proposalCount: 0,
    targeting: {
        incomingTargets: [
            {
                targetId: 'target-1',
                sourceSwapId: 'swap-2',
                sourceSwap: {
                    id: 'swap-2',
                    bookingDetails: {
                        title: 'Paris Apartment',
                        location: { city: 'Paris', country: 'France' },
                        swapValue: 600,
                        dateRange: {
                            checkIn: new Date('2024-12-01'),
                            checkOut: new Date('2024-12-05')
                        }
                    },
                    ownerId: 'user-2',
                    ownerName: 'John Doe'
                },
                proposalId: 'proposal-1',
                status: 'active',
                createdAt: new Date('2024-11-15'),
                updatedAt: new Date('2024-11-15')
            }
        ],
        incomingTargetCount: 1,
        outgoingTarget: {
            targetId: 'target-2',
            targetSwapId: 'swap-3',
            targetSwap: {
                id: 'swap-3',
                bookingDetails: {
                    title: 'London Hotel',
                    location: { city: 'London', country: 'UK' },
                    swapValue: 450,
                    dateRange: {
                        checkIn: new Date('2024-12-10'),
                        checkOut: new Date('2024-12-15')
                    }
                },
                ownerId: 'user-3',
                ownerName: 'Jane Smith'
            },
            proposalId: 'proposal-2',
            status: 'active',
            createdAt: new Date('2024-11-10'),
            updatedAt: new Date('2024-11-10'),
            targetSwapInfo: {
                acceptanceStrategy: 'first_come_first_served'
            }
        },
        canReceiveTargets: true,
        canTarget: true
    }
};

describe('EnhancedSwapCard - Targeting Display', () => {
    it('should display accurate targeting information instead of proposals', () => {
        render(<EnhancedSwapCard swapData={mockSwapData} />);

        // Should show "Targeting Activity" instead of "Proposals from Others"
        expect(screen.getByText('Targeting Activity')).toBeInTheDocument();
        expect(screen.queryByText('Proposals from Others')).not.toBeInTheDocument();

        // Should show incoming targets section
        expect(screen.getByText('1 Incoming Target')).toBeInTheDocument();
        expect(screen.getByText('Paris Apartment')).toBeInTheDocument();
        expect(screen.getByText('by John Doe')).toBeInTheDocument();

        // Should show outgoing target section
        expect(screen.getByText('Outgoing Target')).toBeInTheDocument();
        expect(screen.getByText('London Hotel')).toBeInTheDocument();
        expect(screen.getByText('owned by Jane Smith')).toBeInTheDocument();
    });

    it('should show accurate targeting count in center indicator', () => {
        render(<EnhancedSwapCard swapData={mockSwapData} />);

        // Should show targeting count instead of proposal count
        expect(screen.getByText(/1 incoming/)).toBeInTheDocument();
        expect(screen.getByText(/1 outgoing/)).toBeInTheDocument();
    });

    it('should show no targeting activity when no targets exist', () => {
        const noTargetingData: EnhancedSwapCardData = {
            ...mockSwapData,
            targeting: {
                incomingTargets: [],
                incomingTargetCount: 0,
                canReceiveTargets: true,
                canTarget: true
            }
        };

        render(<EnhancedSwapCard swapData={noTargetingData} />);

        expect(screen.getByText('No targeting activity')).toBeInTheDocument();
        expect(screen.getByText('No incoming or outgoing targets')).toBeInTheDocument();
    });

    it('should display targeting status badges correctly', () => {
        render(<EnhancedSwapCard swapData={mockSwapData} />);

        // Should show status badges for targets
        const statusBadges = screen.getAllByText('active');
        expect(statusBadges).toHaveLength(2); // One for incoming, one for outgoing
    });

    it('should show accept/reject buttons for active incoming targets when swap is not expired', () => {
        // Create a non-expired swap
        const nonExpiredSwapData: EnhancedSwapCardData = {
            ...mockSwapData,
            userSwap: {
                ...mockSwapData.userSwap,
                expiresAt: new Date('2025-12-31') // Future date
            }
        };

        render(<EnhancedSwapCard swapData={nonExpiredSwapData} />);

        // Should show action buttons for incoming targets
        expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    });
});