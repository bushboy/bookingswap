import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SwapDetailsModal } from '../SwapDetailsModal';
import { SwapCardData } from '@booking-swap/shared';
import * as swapService from '@/services/swapService';
import * as proposalService from '@/services/proposalService';

// Mock the services
vi.mock('@/services/swapService');
vi.mock('@/services/proposalService');

// Mock the ProposalDetailsModal component
vi.mock('../ProposalDetailsModal', () => ({
    ProposalDetailsModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
        isOpen ? <div data-testid="proposal-details-modal">Proposal Details Modal</div> : null
}));

const mockSwapData: SwapCardData = {
    userSwap: {
        id: 'swap-123',
        bookingDetails: {
            id: 'booking-123',
            title: 'Test Hotel Booking',
            location: {
                city: 'New York',
                country: 'USA'
            },
            dateRange: {
                checkIn: new Date('2024-12-01'),
                checkOut: new Date('2024-12-05')
            },
            originalPrice: 500,
            swapValue: 450
        },
        status: 'active',
        createdAt: new Date('2024-11-01'),
        expiresAt: new Date('2024-12-31')
    },
    proposalsFromOthers: [
        {
            id: 'proposal-1',
            proposerId: 'user-456',
            proposerName: 'John Doe',
            targetBookingDetails: {
                id: 'booking-456',
                title: 'Beach Resort',
                location: {
                    city: 'Miami',
                    country: 'USA'
                },
                dateRange: {
                    checkIn: new Date('2024-12-10'),
                    checkOut: new Date('2024-12-15')
                },
                originalPrice: 600,
                swapValue: 550
            },
            status: 'pending',
            createdAt: new Date('2024-11-15'),
            conditions: [],
            additionalPayment: 0
        }
    ],
    proposalCount: 1
};

describe('SwapDetailsModal', () => {
    const mockOnClose = vi.fn();
    const mockOnProposalAction = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock swapService.getSwap
        vi.mocked(swapService.swapService.getSwap).mockResolvedValue({
            id: 'swap-123',
            title: 'Enhanced Swap Title',
            description: 'Enhanced swap description',
            paymentTypes: {
                bookingExchange: true,
                cashPayment: false
            }
        });

        // Mock proposalService.getSwapProposals
        vi.mocked(proposalService.proposalService.getSwapProposals).mockResolvedValue([]);
    });

    it('should render basic swap information with validated financial data', async () => {
        render(
            <SwapDetailsModal
                isOpen={true}
                onClose={mockOnClose}
                swapData={mockSwapData}
                onProposalAction={mockOnProposalAction}
            />
        );

        // Check that basic information is displayed
        expect(screen.getByText('Enhanced Swap Title')).toBeInTheDocument();
        expect(screen.getByText('Enhanced swap description')).toBeInTheDocument();
        expect(screen.getByText('active')).toBeInTheDocument();

        // Check that financial data is properly formatted (no $NaN)
        await waitFor(() => {
            const priceElements = screen.getAllByText(/\$450\.00/);
            expect(priceElements.length).toBeGreaterThan(0);
        });
    });

    it('should handle missing financial data gracefully', async () => {
        const swapDataWithNullPrice: SwapCardData = {
            ...mockSwapData,
            userSwap: {
                ...mockSwapData.userSwap,
                bookingDetails: {
                    ...mockSwapData.userSwap.bookingDetails,
                    swapValue: null,
                    originalPrice: null
                }
            }
        };

        render(
            <SwapDetailsModal
                isOpen={true}
                onClose={mockOnClose}
                swapData={swapDataWithNullPrice}
                onProposalAction={mockOnProposalAction}
            />
        );

        // Should show "Price not available" instead of $NaN
        await waitFor(() => {
            expect(screen.getByText('Price not available')).toBeInTheDocument();
        });
    });

    it('should display proposal information when proposals exist', async () => {
        render(
            <SwapDetailsModal
                isOpen={true}
                onClose={mockOnClose}
                swapData={mockSwapData}
                onProposalAction={mockOnProposalAction}
            />
        );

        // Check that proposals section is displayed
        await waitFor(() => {
            expect(screen.getByText('Proposals Received (1)')).toBeInTheDocument();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('Beach Resort')).toBeInTheDocument();
        });
    });

    it('should handle service errors gracefully', async () => {
        // Mock service to throw error
        vi.mocked(swapService.swapService.getSwap).mockRejectedValue(new Error('Service error'));

        render(
            <SwapDetailsModal
                isOpen={true}
                onClose={mockOnClose}
                swapData={mockSwapData}
                onProposalAction={mockOnProposalAction}
            />
        );

        // Should show error message
        await waitFor(() => {
            expect(screen.getByText(/Failed to load swap details/)).toBeInTheDocument();
        });

        // Should still show basic information from swapData
        expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
    });

    it('should format dates correctly', async () => {
        render(
            <SwapDetailsModal
                isOpen={true}
                onClose={mockOnClose}
                swapData={mockSwapData}
                onProposalAction={mockOnProposalAction}
            />
        );

        // Check that dates are formatted properly
        await waitFor(() => {
            expect(screen.getByText('November 1, 2024')).toBeInTheDocument(); // Created date
            expect(screen.getByText('December 31, 2024')).toBeInTheDocument(); // Expires date
        });
    });

    it('should not render when isOpen is false', () => {
        render(
            <SwapDetailsModal
                isOpen={false}
                onClose={mockOnClose}
                swapData={mockSwapData}
                onProposalAction={mockOnProposalAction}
            />
        );

        expect(screen.queryByText('Swap Details')).not.toBeInTheDocument();
    });

    it('should display payment options when available', async () => {
        render(
            <SwapDetailsModal
                isOpen={true}
                onClose={mockOnClose}
                swapData={mockSwapData}
                onProposalAction={mockOnProposalAction}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Payment Options')).toBeInTheDocument();
            expect(screen.getByText('Booking Exchange')).toBeInTheDocument();
            expect(screen.getByText('Cash Payment')).toBeInTheDocument();
        });
    });
});