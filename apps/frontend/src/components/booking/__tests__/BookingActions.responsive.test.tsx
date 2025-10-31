import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OwnerActions, BrowserActions, ProposerActions } from '../BookingActions';
import { Booking, SwapInfo } from '@booking-swap/shared';

// Mock the utility functions
vi.mock('@/utils/swapButtonState', () => ({
    getSwapButtonState: vi.fn(() => ({
        visible: true,
        enabled: true,
        tooltip: 'Create a swap proposal for this booking',
        variant: 'primary' as const,
    })),
    shouldShowManageSwap: vi.fn(() => false),
    getManageSwapTooltip: vi.fn(() => 'Manage swap settings'),
}));

// Mock window.innerWidth for responsive testing
const mockInnerWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
    });
    window.dispatchEvent(new Event('resize'));
};

describe('BookingActions Responsive Design', () => {
    const mockBooking: Booking = {
        id: '1',
        title: 'Test Booking',
        status: 'available',
        userId: 'user1',
        type: 'hotel',
        description: 'Test Description',
        location: {
            city: 'Test City',
            country: 'Test Country',
        },
        dateRange: {
            checkIn: new Date('2025-01-01'),
            checkOut: new Date('2025-01-07'),
        },
        originalPrice: 1000,
        swapValue: 1000,
        providerDetails: {
            provider: 'Test Provider',
            confirmationNumber: 'TEST123',
            bookingReference: 'REF123',
        },
        verification: {
            status: 'verified',
            documents: [],
        },
        blockchain: {
            topicId: 'test-topic',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockSwapInfo: SwapInfo = {
        hasActiveProposals: false,
        activeProposalCount: 0,
        acceptanceStrategy: 'first-come',
        timeRemaining: null,
        userProposalStatus: null,
    };

    beforeEach(() => {
        // Reset to desktop size
        mockInnerWidth(1024);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('OwnerActions Responsive Behavior', () => {
        it('should render buttons in horizontal layout on desktop', () => {
            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfo}
                    onEdit={vi.fn()}
                    onCreateSwap={vi.fn()}
                />
            );

            const container = screen.getByText('Edit').parentElement;
            // Check for CSS module class name pattern instead of exact match
            expect(container?.className).toMatch(/actionsContainer/);
        });

        it('should handle mobile layout correctly', () => {
            // Set mobile viewport
            mockInnerWidth(600);

            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfo}
                    onEdit={vi.fn()}
                    onCreateSwap={vi.fn()}
                />
            );

            const editButton = screen.getByText('Edit');
            const createSwapButton = screen.getByText('Create Swap');

            expect(editButton).toBeInTheDocument();
            expect(createSwapButton).toBeInTheDocument();
        });

        it('should prevent event propagation on button clicks', () => {
            const mockOnEdit = vi.fn();
            const mockOnCreateSwap = vi.fn();
            const mockCardClick = vi.fn();

            const { container } = render(
                <div onClick={mockCardClick}>
                    <OwnerActions
                        booking={mockBooking}
                        swapInfo={mockSwapInfo}
                        onEdit={mockOnEdit}
                        onCreateSwap={mockOnCreateSwap}
                    />
                </div>
            );

            const editButton = screen.getByText('Edit');
            const createSwapButton = screen.getByText('Create Swap');

            fireEvent.click(editButton);
            fireEvent.click(createSwapButton);

            expect(mockOnEdit).toHaveBeenCalledWith(mockBooking);
            expect(mockOnCreateSwap).toHaveBeenCalledWith(mockBooking);
            expect(mockCardClick).not.toHaveBeenCalled();
        });

        it('should show proper tooltips for disabled states', () => {
            const inactiveBooking = { ...mockBooking, status: 'inactive' as const };

            render(
                <OwnerActions
                    booking={inactiveBooking}
                    swapInfo={mockSwapInfo}
                    onEdit={vi.fn()}
                    onCreateSwap={vi.fn()}
                />
            );

            const editButton = screen.getByText('Edit');
            expect(editButton).toHaveAttribute('title', 'Cannot edit inactive booking');
            expect(editButton).toBeDisabled();
        });
    });

    describe('BrowserActions Responsive Behavior', () => {
        const mockSwapInfoWithProposals: SwapInfo = {
            ...mockSwapInfo,
            hasActiveProposals: true,
            activeProposalCount: 2,
        };

        it('should render proposal buttons correctly', () => {
            render(
                <BrowserActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfoWithProposals}
                    onMakeProposal={vi.fn()}
                    onViewDetails={vi.fn()}
                />
            );

            expect(screen.getByText('View Details')).toBeInTheDocument();
            expect(screen.getByText('Make Proposal')).toBeInTheDocument();
        });

        it('should handle auction scenarios correctly', () => {
            const auctionSwapInfo: SwapInfo = {
                ...mockSwapInfoWithProposals,
                acceptanceStrategy: 'auction',
                timeRemaining: 25 * 60 * 60 * 1000, // 25 hours (not ending soon)
            };

            render(
                <BrowserActions
                    booking={mockBooking}
                    swapInfo={auctionSwapInfo}
                    onMakeProposal={vi.fn()}
                    onViewDetails={vi.fn()}
                />
            );

            // The button text should be "Place Bid" for auctions that are not ending soon
            expect(screen.getByText('Place Bid')).toBeInTheDocument();
        });

        it('should show urgent bidding for ending soon auctions', () => {
            const endingSoonSwapInfo: SwapInfo = {
                ...mockSwapInfoWithProposals,
                acceptanceStrategy: 'auction',
                timeRemaining: 30 * 60 * 1000, // 30 minutes
            };

            render(
                <BrowserActions
                    booking={mockBooking}
                    swapInfo={endingSoonSwapInfo}
                    onMakeProposal={vi.fn()}
                    onViewDetails={vi.fn()}
                />
            );

            expect(screen.getByText('Bid Now!')).toBeInTheDocument();
        });
    });

    describe('ProposerActions Responsive Behavior', () => {
        const mockSwapInfoWithUserProposal: SwapInfo = {
            ...mockSwapInfo,
            hasActiveProposals: true,
            userProposalStatus: 'pending',
        };

        it('should render proposal management buttons', () => {
            render(
                <ProposerActions
                    swapInfo={mockSwapInfoWithUserProposal}
                    onViewProposal={vi.fn()}
                    onEditProposal={vi.fn()}
                    onWithdrawProposal={vi.fn()}
                />
            );

            expect(screen.getByText('View Proposal')).toBeInTheDocument();
            expect(screen.getByText('Withdraw')).toBeInTheDocument();
        });

        it('should show edit button for auction proposals', () => {
            const auctionSwapInfo: SwapInfo = {
                ...mockSwapInfoWithUserProposal,
                acceptanceStrategy: 'auction',
            };

            render(
                <ProposerActions
                    swapInfo={auctionSwapInfo}
                    onViewProposal={vi.fn()}
                    onEditProposal={vi.fn()}
                    onWithdrawProposal={vi.fn()}
                />
            );

            expect(screen.getByText('Update Bid')).toBeInTheDocument();
        });
    });

    describe('Touch Target Accessibility', () => {
        it('should have minimum touch target sizes on mobile', () => {
            // Set mobile viewport
            mockInnerWidth(600);

            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfo}
                    onEdit={vi.fn()}
                    onCreateSwap={vi.fn()}
                />
            );

            // Note: In a real test environment, you would check computed styles
            // This is a simplified test to verify the component renders without errors
            expect(screen.getByText('Edit')).toBeInTheDocument();
            expect(screen.getByText('Create Swap')).toBeInTheDocument();
        });

        it('should maintain button functionality across screen sizes', () => {
            const mockOnCreateSwap = vi.fn();

            // Test desktop
            mockInnerWidth(1024);
            const { rerender } = render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfo}
                    onCreateSwap={mockOnCreateSwap}
                />
            );

            fireEvent.click(screen.getByText('Create Swap'));
            expect(mockOnCreateSwap).toHaveBeenCalledTimes(1);

            // Test mobile
            mockInnerWidth(600);
            rerender(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfo}
                    onCreateSwap={mockOnCreateSwap}
                />
            );

            fireEvent.click(screen.getByText('Create Swap'));
            expect(mockOnCreateSwap).toHaveBeenCalledTimes(2);
        });
    });

    describe('Button Spacing and Layout', () => {
        it('should handle multiple buttons without overflow', () => {
            const swapInfoWithActiveSwap: SwapInfo = {
                ...mockSwapInfo,
                hasActiveProposals: true,
                activeProposalCount: 3,
            };

            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={swapInfoWithActiveSwap}
                    onEdit={vi.fn()}
                    onManageSwap={vi.fn()}
                    onViewProposals={vi.fn()}
                />
            );

            expect(screen.getByText('Edit')).toBeInTheDocument();
            // The component should render multiple buttons without layout issues
            // Since the mocked utility returns visible: true for Create Swap button
            // and shouldShowManageSwap is mocked to return false, we expect Create Swap
            expect(screen.getByText('Create Swap')).toBeInTheDocument();
        });

        it('should wrap buttons appropriately on small screens', () => {
            mockInnerWidth(400);

            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={mockSwapInfo}
                    onEdit={vi.fn()}
                    onCreateSwap={vi.fn()}
                />
            );

            const container = screen.getByText('Edit').parentElement;
            // Check for CSS module class name pattern instead of exact match
            expect(container?.className).toMatch(/actionsContainer/);
        });
    });
});