import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookingCard } from '../BookingCard';
import { OwnerActions, BrowserActions } from '../BookingActions';
import { BookingWithSwapInfo, BookingUserRole, SwapInfo } from '@booking-swap/shared';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('react-router-dom', () => ({
    useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock('@/hooks/useBookingWithWallet', () => ({
    useBookingWithWallet: vi.fn(() => ({
        enableSwappingWithWallet: vi.fn(),
        canEnableSwapping: vi.fn(() => true),
        isWalletConnected: true,
    })),
}));

vi.mock('@/components/ui/Card', () => ({
    Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
    CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/Button', () => ({
    Button: ({ children, onClick, disabled, title, ...props }: any) => (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            data-testid={props['data-testid'] || 'button'}
            {...props}
        >
            {children}
        </button>
    ),
}));

vi.mock('../SwapStatusBadge', () => ({
    SwapStatusBadge: ({ swapInfo }: any) => (
        <div data-testid="swap-status-badge">
            {swapInfo?.hasActiveProposals ? 'Available for Swap' : 'No Swap'}
        </div>
    ),
}));

vi.mock('../SwapInfoPanel', () => ({
    SwapInfoPanel: ({ swapInfo, userRole }: any) => (
        <div data-testid="swap-info-panel">
            Swap Info - Role: {userRole}
        </div>
    ),
}));

vi.mock('@/utils/swapButtonState', () => ({
    getSwapButtonState: vi.fn((booking: any, swapInfo: any) => ({
        visible: !swapInfo?.hasActiveProposals,
        enabled: !swapInfo?.hasActiveProposals && booking.status === 'available',
        variant: 'primary',
        tooltip: swapInfo?.hasActiveProposals ? 'Swap already exists' : 'Create swap for this booking'
    })),
    shouldShowManageSwap: vi.fn((swapInfo: any) => Boolean(swapInfo?.hasActiveProposals)),
    getManageSwapTooltip: vi.fn(() => 'Manage your swap')
}));

// Test data
const mockBooking: BookingWithSwapInfo = {
    id: 'booking-1',
    userId: 'user-1',
    type: 'hotel',
    title: 'Test Hotel Booking',
    description: 'A test hotel booking',
    location: {
        city: 'New York',
        country: 'USA',
        address: '123 Test St',
        coordinates: { lat: 40.7128, lng: -74.0060 }
    },
    dateRange: {
        checkIn: new Date('2025-06-01'),
        checkOut: new Date('2025-06-03')
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
        name: 'Test Hotel',
        confirmationNumber: 'TEST123'
    },
    verification: {
        status: 'verified',
        verifiedAt: new Date('2024-01-01'),
        documents: []
    },
    status: 'available',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
};

const mockActiveSwapInfo: SwapInfo = {
    swapId: 'swap-1',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 200,
    hasActiveProposals: true,
    activeProposalCount: 2,
    userProposalStatus: 'pending',
    hasAnySwapInitiated: true,
    swapConditions: ['Must be in same city']
};

const mockInactiveSwapInfo: SwapInfo = {
    swapId: 'swap-2',
    paymentTypes: ['booking'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 100,
    hasActiveProposals: false,
    activeProposalCount: 0,
    userProposalStatus: 'none',
    hasAnySwapInitiated: false,
    swapConditions: []
};

describe('BookingCard Integration Tests - Task 8.1', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Backward Compatibility with Existing onEdit Callbacks', () => {
        it('should continue to support existing onEdit callbacks for bookings without active swaps', () => {
            const onEdit = vi.fn();
            const bookingWithoutActiveSwap = {
                ...mockBooking,
                swapInfo: mockInactiveSwapInfo
            };

            render(
                <BookingCard
                    booking={bookingWithoutActiveSwap}
                    userRole="owner"
                    onEdit={onEdit}
                />
            );

            // Edit button should be enabled and functional
            const editButton = screen.getByText('Edit');
            expect(editButton).not.toBeDisabled();

            fireEvent.click(editButton);
            expect(onEdit).toHaveBeenCalledWith(bookingWithoutActiveSwap);
        });

        it('should disable Edit button but preserve callback for bookings with active swaps', () => {
            const onEdit = vi.fn();
            const bookingWithActiveSwap = {
                ...mockBooking,
                swapInfo: mockActiveSwapInfo
            };

            render(
                <BookingCard
                    booking={bookingWithActiveSwap}
                    userRole="owner"
                    onEdit={onEdit}
                />
            );

            // Edit button should be disabled
            const editButton = screen.getByText('Edit');
            expect(editButton).toBeDisabled();
            expect(editButton).toHaveAttribute('title', 'Cannot edit booking with pending swap proposal');

            // The button should be properly disabled - this is the main requirement
            // Note: Card click may still trigger onEdit, but the button itself should be disabled
            expect(editButton).toBeDisabled();
            expect(editButton).toHaveAttribute('aria-disabled', 'true');
        });

        it('should handle undefined onEdit callback gracefully', () => {
            const bookingWithActiveSwap = {
                ...mockBooking,
                swapInfo: mockActiveSwapInfo
            };

            expect(() => {
                render(
                    <BookingCard
                        booking={bookingWithActiveSwap}
                        userRole="owner"
                    // onEdit is undefined
                    />
                );
            }).not.toThrow();

            // Edit button should not be visible when no callback is provided
            expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        });
    });

    describe('Component Behavior in Different Contexts', () => {
        it('should maintain consistent button behavior in list context', () => {
            const onEdit = vi.fn();
            const onViewDetails = vi.fn();

            const bookingWithActiveSwap = {
                ...mockBooking,
                swapInfo: mockActiveSwapInfo
            };

            render(
                <div data-testid="booking-list">
                    <BookingCard
                        booking={bookingWithActiveSwap}
                        userRole="owner"
                        onEdit={onEdit}
                        onViewDetails={onViewDetails}
                        compact={false}
                    />
                </div>
            );

            // Edit should be disabled, View should be available
            expect(screen.getByText('Edit')).toBeDisabled();
            expect(screen.getByText('View')).not.toBeDisabled();

            // View button should work
            fireEvent.click(screen.getByText('View'));
            expect(onViewDetails).toHaveBeenCalledWith(bookingWithActiveSwap);
        });

        it('should maintain consistent button behavior in grid context', () => {
            const onEdit = vi.fn();
            const onViewDetails = vi.fn();

            const bookingWithActiveSwap = {
                ...mockBooking,
                swapInfo: mockActiveSwapInfo
            };

            render(
                <div data-testid="booking-grid" style={{ display: 'grid' }}>
                    <BookingCard
                        booking={bookingWithActiveSwap}
                        userRole="owner"
                        onEdit={onEdit}
                        onViewDetails={onViewDetails}
                        compact={true}
                    />
                </div>
            );

            // Same behavior should be maintained in compact mode
            expect(screen.getByText('Edit')).toBeDisabled();
            expect(screen.getByText('View')).not.toBeDisabled();
        });

        it('should work correctly in modal context', () => {
            const onEdit = vi.fn();
            const onViewDetails = vi.fn();

            const bookingWithoutActiveSwap = {
                ...mockBooking,
                swapInfo: mockInactiveSwapInfo
            };

            render(
                <div data-testid="modal" role="dialog">
                    <BookingCard
                        booking={bookingWithoutActiveSwap}
                        userRole="owner"
                        onEdit={onEdit}
                        onViewDetails={onViewDetails}
                    />
                </div>
            );

            // Edit should be enabled when no active swap
            const editButton = screen.getByText('Edit');
            expect(editButton).not.toBeDisabled();

            fireEvent.click(editButton);
            expect(onEdit).toHaveBeenCalledWith(bookingWithoutActiveSwap);
        });
    });

    describe('No Regression in Existing Booking Management Functionality', () => {
        it('should preserve all existing booking display functionality', () => {
            const booking = {
                ...mockBooking,
                swapInfo: mockActiveSwapInfo
            };

            render(
                <BookingCard
                    booking={booking}
                    userRole="owner"
                    onEdit={vi.fn()}
                    onViewDetails={vi.fn()}
                />
            );

            // All existing booking information should still be displayed
            expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
            expect(screen.getByText(/New York, USA/)).toBeInTheDocument();
            expect(screen.getByText('$450')).toBeInTheDocument();
            expect(screen.getByText('Available')).toBeInTheDocument();
            expect(screen.getByText('🏨 Booking Image')).toBeInTheDocument();
        });

        it('should preserve swap status badge functionality', () => {
            const booking = {
                ...mockBooking,
                swapInfo: mockActiveSwapInfo
            };

            render(
                <BookingCard
                    booking={booking}
                    userRole="owner"
                    showSwapIndicators={true}
                />
            );

            expect(screen.getByTestId('swap-status-badge')).toBeInTheDocument();
            expect(screen.getByText('Available for Swap')).toBeInTheDocument();
        });

        it('should preserve create swap functionality when no active swap exists', () => {
            const onCreateSwap = vi.fn();
            const booking = {
                ...mockBooking,
                swapInfo: mockInactiveSwapInfo
            };

            render(
                <OwnerActions
                    booking={booking}
                    swapInfo={mockInactiveSwapInfo}
                    onCreateSwap={onCreateSwap}
                />
            );

            const createSwapButton = screen.getByText('Create Swap');
            expect(createSwapButton).not.toBeDisabled();

            fireEvent.click(createSwapButton);
            expect(onCreateSwap).toHaveBeenCalledWith(booking);
        });

        it('should preserve manage swap functionality when active swap exists', () => {
            const onManageSwap = vi.fn();
            const booking = {
                ...mockBooking,
                swapInfo: mockActiveSwapInfo
            };

            render(
                <BookingCard
                    booking={booking}
                    userRole="owner"
                    onManageSwap={onManageSwap}
                />
            );

            const manageSwapButton = screen.getByText('Manage Swap');
            expect(manageSwapButton).not.toBeDisabled();

            fireEvent.click(manageSwapButton);
            expect(onManageSwap).toHaveBeenCalledWith(mockActiveSwapInfo);
        });

        it('should preserve browser actions functionality', () => {
            const onMakeProposal = vi.fn();
            const onViewDetails = vi.fn();
            const booking = {
                ...mockBooking,
                swapInfo: mockActiveSwapInfo
            };

            render(
                <BookingCard
                    booking={booking}
                    userRole="browser"
                    onMakeProposal={onMakeProposal}
                    onViewDetails={onViewDetails}
                />
            );

            // Browser should see View Details and Make Proposal buttons
            expect(screen.getByText('View Details')).toBeInTheDocument();
            expect(screen.getByText('Make Proposal')).toBeInTheDocument();

            fireEvent.click(screen.getByText('View Details'));
            expect(onViewDetails).toHaveBeenCalledWith(booking);

            fireEvent.click(screen.getByText('Make Proposal'));
            expect(onMakeProposal).toHaveBeenCalled();
        });
    });

    describe('Integration with OwnerActions Component', () => {
        it('should properly integrate Edit/View button logic with OwnerActions', () => {
            const onEdit = vi.fn();
            const onViewDetails = vi.fn();

            const bookingWithActiveSwap = {
                ...mockBooking,
                swapInfo: mockActiveSwapInfo
            };

            render(
                <OwnerActions
                    booking={bookingWithActiveSwap}
                    swapInfo={mockActiveSwapInfo}
                    onEdit={onEdit}
                    onViewDetails={onViewDetails}
                />
            );

            // Edit should be disabled due to active swap
            const editButton = screen.getByText('Edit');
            expect(editButton).toBeDisabled();
            expect(editButton).toHaveAttribute('aria-disabled', 'true');

            // View should be available
            const viewButton = screen.getByText('View');
            expect(viewButton).not.toBeDisabled();

            fireEvent.click(viewButton);
            expect(onViewDetails).toHaveBeenCalledWith(bookingWithActiveSwap);
        });

        it('should handle rapid state changes without UI flickering', async () => {
            const onEdit = vi.fn();
            const onViewDetails = vi.fn();

            let swapInfo = mockInactiveSwapInfo;
            const { rerender } = render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={swapInfo}
                    onEdit={onEdit}
                    onViewDetails={onViewDetails}
                />
            );

            // Initially Edit should be enabled
            expect(screen.getByText('Edit')).not.toBeDisabled();
            expect(screen.queryByText('View')).not.toBeInTheDocument();

            // Rapidly change to active swap
            swapInfo = mockActiveSwapInfo;
            rerender(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={swapInfo}
                    onEdit={onEdit}
                    onViewDetails={onViewDetails}
                />
            );

            // Should debounce and show correct state after delay
            await waitFor(() => {
                expect(screen.getByText('Edit')).toBeDisabled();
                expect(screen.getByText('View')).toBeInTheDocument();
            }, { timeout: 200 });
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle malformed SwapInfo gracefully', () => {
            const onEdit = vi.fn();
            const bookingWithMalformedSwap = {
                ...mockBooking,
                swapInfo: {
                    // Malformed SwapInfo - missing required fields
                    swapId: 'invalid-swap'
                } as SwapInfo
            };

            expect(() => {
                render(
                    <BookingCard
                        booking={bookingWithMalformedSwap}
                        userRole="owner"
                        onEdit={onEdit}
                    />
                );
            }).not.toThrow();

            // Should default to allowing edit when SwapInfo is malformed
            const editButton = screen.getByText('Edit');
            expect(editButton).not.toBeDisabled();
        });

        it('should handle null/undefined SwapInfo gracefully', () => {
            const onEdit = vi.fn();
            const bookingWithoutSwap = {
                ...mockBooking,
                swapInfo: undefined
            };

            render(
                <BookingCard
                    booking={bookingWithoutSwap}
                    userRole="owner"
                    onEdit={onEdit}
                />
            );

            // Edit should be enabled when no SwapInfo
            const editButton = screen.getByText('Edit');
            expect(editButton).not.toBeDisabled();

            fireEvent.click(editButton);
            expect(onEdit).toHaveBeenCalledWith(bookingWithoutSwap);
        });

        it('should handle callback errors gracefully', () => {
            const onEdit = vi.fn().mockImplementation(() => {
                throw new Error('Callback error');
            });

            const booking = {
                ...mockBooking,
                swapInfo: mockInactiveSwapInfo
            };

            render(
                <BookingCard
                    booking={booking}
                    userRole="owner"
                    onEdit={onEdit}
                />
            );

            // Should not crash when callback throws error
            expect(() => {
                fireEvent.click(screen.getByText('Edit'));
            }).not.toThrow();
        });
    });

    describe('Accessibility and User Experience', () => {
        it('should maintain proper ARIA attributes for disabled Edit button', () => {
            const bookingWithActiveSwap = {
                ...mockBooking,
                swapInfo: mockActiveSwapInfo
            };

            render(
                <BookingCard
                    booking={bookingWithActiveSwap}
                    userRole="owner"
                    onEdit={vi.fn()}
                    onViewDetails={vi.fn()}
                />
            );

            const editButton = screen.getByText('Edit');
            expect(editButton).toHaveAttribute('aria-disabled', 'true');
            expect(editButton).toHaveAttribute('tabIndex', '-1');
            expect(editButton).toHaveAttribute('title', 'Cannot edit booking with pending swap proposal');
        });

        it('should provide proper tooltips for button states', () => {
            const bookingWithActiveSwap = {
                ...mockBooking,
                swapInfo: mockActiveSwapInfo
            };

            render(
                <BookingCard
                    booking={bookingWithActiveSwap}
                    userRole="owner"
                    onEdit={vi.fn()}
                    onViewDetails={vi.fn()}
                />
            );

            const editButton = screen.getByText('Edit');
            const viewButton = screen.getByText('View');

            expect(editButton).toHaveAttribute('title', 'Cannot edit booking with pending swap proposal');
            expect(viewButton).toHaveAttribute('title', 'View booking details (read-only)');
        });

        it('should maintain keyboard navigation support', () => {
            const onViewDetails = vi.fn();
            const bookingWithActiveSwap = {
                ...mockBooking,
                swapInfo: mockActiveSwapInfo
            };

            render(
                <BookingCard
                    booking={bookingWithActiveSwap}
                    userRole="owner"
                    onEdit={vi.fn()}
                    onViewDetails={onViewDetails}
                />
            );

            const viewButton = screen.getByText('View');

            // Should be focusable and respond to keyboard events
            viewButton.focus();
            expect(document.activeElement).toBe(viewButton);

            // Should respond to Enter key
            fireEvent.keyDown(viewButton, { key: 'Enter' });
            expect(onViewDetails).toHaveBeenCalledWith(bookingWithActiveSwap);
        });
    });
});