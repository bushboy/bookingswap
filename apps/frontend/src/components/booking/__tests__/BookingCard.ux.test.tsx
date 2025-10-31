import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BookingCard } from '../BookingCard';
import { OwnerActions } from '../BookingActions';
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
    Button: ({ children, onClick, disabled, title, loading, ...props }: any) => (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            title={title}
            data-testid={props['data-testid'] || 'button'}
            aria-disabled={disabled}
            {...props}
        >
            {loading ? 'Loading...' : children}
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

// Different swap states for testing transitions
const noSwapInfo: SwapInfo | undefined = undefined;

const configuredButInactiveSwap: SwapInfo = {
    swapId: 'swap-1',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 200,
    hasActiveProposals: false,
    activeProposalCount: 0,
    userProposalStatus: 'none',
    hasAnySwapInitiated: false,
    swapConditions: []
};

const activeSwapWithPendingProposal: SwapInfo = {
    swapId: 'swap-2',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 200,
    hasActiveProposals: true,
    activeProposalCount: 2,
    userProposalStatus: 'pending',
    hasAnySwapInitiated: true,
    swapConditions: ['Must be in same city']
};

const activeSwapWithAcceptedProposal: SwapInfo = {
    swapId: 'swap-3',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 200,
    hasActiveProposals: true,
    activeProposalCount: 1,
    userProposalStatus: 'accepted',
    hasAnySwapInitiated: true,
    swapConditions: ['Must be in same city']
};

const cancelledSwap: SwapInfo = {
    swapId: 'swap-4',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 200,
    hasActiveProposals: false,
    activeProposalCount: 0,
    userProposalStatus: 'none',
    hasAnySwapInitiated: false,
    swapConditions: []
};

describe('BookingCard User Experience Validation - Task 8.2', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Button State Transitions During Swap Creation and Cancellation', () => {
        it('should transition from Edit enabled to Edit disabled when swap is created', async () => {
            const onEdit = vi.fn();
            const onViewDetails = vi.fn();

            // Start with no swap
            const { rerender } = render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={noSwapInfo}
                    onEdit={onEdit}
                    onViewDetails={onViewDetails}
                />
            );

            // Initially Edit should be enabled, no View button
            expect(screen.getByText('Edit')).not.toBeDisabled();
            expect(screen.queryByText('View')).not.toBeInTheDocument();

            // Simulate swap creation - transition to active swap
            rerender(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={activeSwapWithPendingProposal}
                    onEdit={onEdit}
                    onViewDetails={onViewDetails}
                />
            );

            // After debounce delay, Edit should be disabled and View should appear
            await waitFor(() => {
                expect(screen.getByText('Edit')).toBeDisabled();
                expect(screen.getByText('View')).toBeInTheDocument();
            }, { timeout: 200 });

            // Verify tooltips are accurate
            expect(screen.getByText('Edit')).toHaveAttribute('title', 'Cannot edit booking with pending swap proposal');
            expect(screen.getByText('View')).toHaveAttribute('title', 'View booking details (read-only)');
        });

        it('should transition from Edit disabled to Edit enabled when swap is cancelled', async () => {
            const onEdit = vi.fn();
            const onViewDetails = vi.fn();

            // Start with active swap
            const { rerender } = render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={activeSwapWithPendingProposal}
                    onEdit={onEdit}
                    onViewDetails={onViewDetails}
                />
            );

            // Initially Edit should be disabled, View should be visible
            await waitFor(() => {
                expect(screen.getByText('Edit')).toBeDisabled();
                expect(screen.getByText('View')).toBeInTheDocument();
            });

            // Simulate swap cancellation
            rerender(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={cancelledSwap}
                    onEdit={onEdit}
                    onViewDetails={onViewDetails}
                />
            );

            // After debounce delay, Edit should be enabled and View should disappear
            await waitFor(() => {
                expect(screen.getByText('Edit')).not.toBeDisabled();
                expect(screen.queryByText('View')).not.toBeInTheDocument();
            }, { timeout: 200 });

            // Verify tooltip is updated
            expect(screen.getByText('Edit')).toHaveAttribute('title', 'Edit booking details');
        });

        it('should handle rapid state changes without UI flickering', async () => {
            const onEdit = vi.fn();
            const onViewDetails = vi.fn();

            const { rerender } = render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={noSwapInfo}
                    onEdit={onEdit}
                    onViewDetails={onViewDetails}
                />
            );

            // Rapidly change states multiple times
            const states = [
                configuredButInactiveSwap,
                activeSwapWithPendingProposal,
                configuredButInactiveSwap,
                activeSwapWithAcceptedProposal,
                cancelledSwap
            ];

            for (const swapInfo of states) {
                rerender(
                    <OwnerActions
                        booking={mockBooking}
                        swapInfo={swapInfo}
                        onEdit={onEdit}
                        onViewDetails={onViewDetails}
                    />
                );
                // Small delay between rapid changes
                await act(async () => {
                    await new Promise(resolve => setTimeout(resolve, 10));
                });
            }

            // Final state should be stable after debounce
            await waitFor(() => {
                expect(screen.getByText('Edit')).not.toBeDisabled();
                expect(screen.queryByText('View')).not.toBeInTheDocument();
            }, { timeout: 300 });
        });
    });

    describe('Tooltip Accuracy and Helpfulness', () => {
        it('should provide accurate tooltips for different swap states', () => {
            const testCases = [
                {
                    swapInfo: noSwapInfo,
                    expectedEditTooltip: 'Edit booking details',
                    expectedViewVisible: false
                },
                {
                    swapInfo: configuredButInactiveSwap,
                    expectedEditTooltip: 'Edit booking details',
                    expectedViewVisible: false
                },
                {
                    swapInfo: activeSwapWithPendingProposal,
                    expectedEditTooltip: 'Cannot edit booking with pending swap proposal',
                    expectedViewVisible: true,
                    expectedViewTooltip: 'View booking details (read-only)'
                },
                {
                    swapInfo: activeSwapWithAcceptedProposal,
                    expectedEditTooltip: 'Cannot edit booking with accepted swap proposal',
                    expectedViewVisible: true,
                    expectedViewTooltip: 'View booking details (read-only)'
                }
            ];

            testCases.forEach(({ swapInfo, expectedEditTooltip, expectedViewVisible, expectedViewTooltip }, index) => {
                const { unmount } = render(
                    <OwnerActions
                        booking={mockBooking}
                        swapInfo={swapInfo}
                        onEdit={vi.fn()}
                        onViewDetails={vi.fn()}
                    />
                );

                const editButton = screen.getByText('Edit');
                expect(editButton).toHaveAttribute('title', expectedEditTooltip);

                if (expectedViewVisible) {
                    const viewButton = screen.getByText('View');
                    expect(viewButton).toBeInTheDocument();
                    expect(viewButton).toHaveAttribute('title', expectedViewTooltip);
                } else {
                    expect(screen.queryByText('View')).not.toBeInTheDocument();
                }

                unmount();
            });
        });

        it('should provide helpful tooltips for inactive booking states', () => {
            const inactiveBooking = {
                ...mockBooking,
                status: 'completed' as const
            };

            render(
                <OwnerActions
                    booking={inactiveBooking}
                    swapInfo={noSwapInfo}
                    onEdit={vi.fn()}
                    onViewDetails={vi.fn()}
                />
            );

            const editButton = screen.getByText('Edit');
            expect(editButton).toBeDisabled();
            expect(editButton).toHaveAttribute('title', 'Cannot edit inactive booking');
        });

        it('should provide contextual tooltips for different user proposal statuses', () => {
            const testCases = [
                {
                    userProposalStatus: 'pending' as const,
                    expectedTooltip: 'Cannot edit booking with pending swap proposal'
                },
                {
                    userProposalStatus: 'accepted' as const,
                    expectedTooltip: 'Cannot edit booking with accepted swap proposal'
                }
            ];

            testCases.forEach(({ userProposalStatus, expectedTooltip }) => {
                const swapInfo = {
                    ...activeSwapWithPendingProposal,
                    userProposalStatus
                };

                const { unmount } = render(
                    <OwnerActions
                        booking={mockBooking}
                        swapInfo={swapInfo}
                        onEdit={vi.fn()}
                        onViewDetails={vi.fn()}
                    />
                );

                const editButton = screen.getByText('Edit');
                expect(editButton).toHaveAttribute('title', expectedTooltip);

                unmount();
            });
        });
    });

    describe('Consistent Behavior Across All BookingCard Instances', () => {
        it('should show consistent button states for same booking across multiple instances', () => {
            const onEdit = vi.fn();
            const onViewDetails = vi.fn();

            const bookingWithActiveSwap = {
                ...mockBooking,
                swapInfo: activeSwapWithPendingProposal
            };

            // Render multiple instances of the same booking
            const { container: container1 } = render(
                <div data-testid="instance-1">
                    <BookingCard
                        booking={bookingWithActiveSwap}
                        userRole="owner"
                        onEdit={onEdit}
                        onViewDetails={onViewDetails}
                    />
                </div>
            );

            const { container: container2 } = render(
                <div data-testid="instance-2">
                    <BookingCard
                        booking={bookingWithActiveSwap}
                        userRole="owner"
                        onEdit={onEdit}
                        onViewDetails={onViewDetails}
                    />
                </div>
            );

            // Both instances should have consistent button states
            const editButtons = screen.getAllByText('Edit');
            const viewButtons = screen.getAllByText('View');

            expect(editButtons).toHaveLength(2);
            expect(viewButtons).toHaveLength(2);

            editButtons.forEach(button => {
                expect(button).toBeDisabled();
                expect(button).toHaveAttribute('title', 'Cannot edit booking with pending swap proposal');
            });

            viewButtons.forEach(button => {
                expect(button).not.toBeDisabled();
                expect(button).toHaveAttribute('title', 'View booking details (read-only)');
            });
        });

        it('should update all instances when swap status changes', async () => {
            const onEdit = vi.fn();
            const onViewDetails = vi.fn();

            let currentSwapInfo = configuredButInactiveSwap;

            const TestComponent = () => (
                <div>
                    <div data-testid="instance-1">
                        <OwnerActions
                            booking={mockBooking}
                            swapInfo={currentSwapInfo}
                            onEdit={onEdit}
                            onViewDetails={onViewDetails}
                        />
                    </div>
                    <div data-testid="instance-2">
                        <OwnerActions
                            booking={mockBooking}
                            swapInfo={currentSwapInfo}
                            onEdit={onEdit}
                            onViewDetails={onViewDetails}
                        />
                    </div>
                </div>
            );

            const { rerender } = render(<TestComponent />);

            // Initially both should have Edit enabled
            let editButtons = screen.getAllByText('Edit');
            expect(editButtons).toHaveLength(2);
            editButtons.forEach(button => expect(button).not.toBeDisabled());

            // Change to active swap
            currentSwapInfo = activeSwapWithPendingProposal;
            rerender(<TestComponent />);

            // After debounce, both should have Edit disabled and View visible
            await waitFor(() => {
                const editButtons = screen.getAllByText('Edit');
                const viewButtons = screen.getAllByText('View');

                expect(editButtons).toHaveLength(2);
                expect(viewButtons).toHaveLength(2);

                editButtons.forEach(button => expect(button).toBeDisabled());
                viewButtons.forEach(button => expect(button).not.toBeDisabled());
            }, { timeout: 200 });
        });

        it('should maintain consistent styling and visual hierarchy', () => {
            const bookingWithActiveSwap = {
                ...mockBooking,
                swapInfo: activeSwapWithPendingProposal
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

            // Both buttons should have consistent styling classes
            expect(editButton).toHaveClass('_responsiveButton_b175d5', '_buttonStateTransition_b175d5');
            expect(viewButton).toHaveClass('_responsiveButton_b175d5', '_buttonStateTransition_b175d5');

            // Edit button should have disabled styling
            expect(editButton).toHaveClass('_disabledEditButton_b175d5');

            // View button should have view-specific styling
            expect(viewButton).toHaveClass('_viewButton_b175d5');
        });
    });

    describe('Accessibility and Screen Reader Support', () => {
        it('should announce button state changes to screen readers', async () => {
            const onEdit = vi.fn();
            const onViewDetails = vi.fn();

            const { rerender } = render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={configuredButInactiveSwap}
                    onEdit={onEdit}
                    onViewDetails={onViewDetails}
                />
            );

            // Change to active swap to trigger announcement
            rerender(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={activeSwapWithPendingProposal}
                    onEdit={onEdit}
                    onViewDetails={onViewDetails}
                />
            );

            // Check for live region with announcement
            await waitFor(() => {
                const liveRegion = screen.getByRole('status');
                expect(liveRegion).toHaveAttribute('aria-live', 'polite');
                expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
                // The message should be announced
                expect(liveRegion).toHaveTextContent(/Edit button disabled|View button available/);
            }, { timeout: 200 });
        });

        it('should provide proper ARIA attributes for disabled buttons', () => {
            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={activeSwapWithPendingProposal}
                    onEdit={vi.fn()}
                    onViewDetails={vi.fn()}
                />
            );

            const editButton = screen.getByText('Edit');

            expect(editButton).toHaveAttribute('aria-disabled', 'true');
            expect(editButton).toHaveAttribute('tabIndex', '-1');
            expect(editButton).toHaveAttribute('aria-describedby', `edit-button-restriction-${mockBooking.id}`);
            expect(editButton).toHaveAttribute('aria-label', `Edit booking ${mockBooking.id} (disabled)`);

            // Check for hidden description element
            const description = screen.getByText('Cannot edit booking with pending swap proposal');
            expect(description).toHaveAttribute('id', `edit-button-restriction-${mockBooking.id}`);
        });

        it('should provide proper ARIA attributes for View button', () => {
            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={activeSwapWithPendingProposal}
                    onEdit={vi.fn()}
                    onViewDetails={vi.fn()}
                />
            );

            const viewButton = screen.getByText('View');

            expect(viewButton).toHaveAttribute('aria-label', `View booking ${mockBooking.id} details (read-only access)`);
            expect(viewButton).toHaveAttribute('aria-describedby', `view-button-description-${mockBooking.id}`);

            // Check for hidden description element
            const description = screen.getByText(/Read-only access to booking details/);
            expect(description).toHaveAttribute('id', `view-button-description-${mockBooking.id}`);
        });

        it('should support keyboard navigation correctly', () => {
            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={activeSwapWithPendingProposal}
                    onEdit={vi.fn()}
                    onViewDetails={vi.fn()}
                />
            );

            const editButton = screen.getByText('Edit');
            const viewButton = screen.getByText('View');

            // Disabled Edit button should not be focusable
            expect(editButton).toHaveAttribute('tabIndex', '-1');

            // View button should be focusable
            expect(viewButton).toHaveAttribute('tabIndex', '0');

            // Test focus behavior
            viewButton.focus();
            expect(document.activeElement).toBe(viewButton);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle missing callback functions gracefully', () => {
            expect(() => {
                render(
                    <OwnerActions
                        booking={mockBooking}
                        swapInfo={activeSwapWithPendingProposal}
                    // No callbacks provided
                    />
                );
            }).not.toThrow();

            // Edit button should not be visible when no onEdit callback
            expect(screen.queryByText('Edit')).not.toBeInTheDocument();

            // View button should not be visible when no onViewDetails callback
            expect(screen.queryByText('View')).not.toBeInTheDocument();
        });

        it('should handle invalid booking data gracefully', () => {
            const invalidBooking = {
                ...mockBooking,
                id: '', // Invalid ID
                status: undefined as any // Invalid status
            };

            expect(() => {
                render(
                    <OwnerActions
                        booking={invalidBooking}
                        swapInfo={activeSwapWithPendingProposal}
                        onEdit={vi.fn()}
                        onViewDetails={vi.fn()}
                    />
                );
            }).not.toThrow();

            // Should still render buttons but with safe defaults
            expect(screen.getByText('Edit')).toBeInTheDocument();
            expect(screen.getByText('View')).toBeInTheDocument();
        });

        it('should handle malformed SwapInfo gracefully', () => {
            const malformedSwapInfo = {
                swapId: 'test',
                // Missing required fields
            } as SwapInfo;

            expect(() => {
                render(
                    <OwnerActions
                        booking={mockBooking}
                        swapInfo={malformedSwapInfo}
                        onEdit={vi.fn()}
                        onViewDetails={vi.fn()}
                    />
                );
            }).not.toThrow();

            // Should default to allowing edit when SwapInfo is malformed
            expect(screen.getByText('Edit')).not.toBeDisabled();
            expect(screen.queryByText('View')).not.toBeInTheDocument();
        });
    });

    describe('Performance and Responsiveness', () => {
        it('should not cause excessive re-renders during state changes', async () => {
            const onEdit = vi.fn();
            const onViewDetails = vi.fn();

            const renderSpy = vi.fn();

            const TestComponent = ({ swapInfo }: { swapInfo?: SwapInfo }) => {
                renderSpy();
                return (
                    <OwnerActions
                        booking={mockBooking}
                        swapInfo={swapInfo}
                        onEdit={onEdit}
                        onViewDetails={onViewDetails}
                    />
                );
            };

            const { rerender } = render(<TestComponent swapInfo={configuredButInactiveSwap} />);

            const initialRenderCount = renderSpy.mock.calls.length;

            // Change state multiple times rapidly
            rerender(<TestComponent swapInfo={activeSwapWithPendingProposal} />);
            rerender(<TestComponent swapInfo={activeSwapWithAcceptedProposal} />);
            rerender(<TestComponent swapInfo={cancelledSwap} />);

            // Wait for debounce to settle
            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 200));
            });

            const finalRenderCount = renderSpy.mock.calls.length;

            // Should not have excessive renders (allowing for reasonable React re-renders)
            expect(finalRenderCount - initialRenderCount).toBeLessThan(10);
        });

        it('should respond quickly to user interactions', async () => {
            const onViewDetails = vi.fn();

            render(
                <OwnerActions
                    booking={mockBooking}
                    swapInfo={activeSwapWithPendingProposal}
                    onEdit={vi.fn()}
                    onViewDetails={onViewDetails}
                />
            );

            const viewButton = screen.getByText('View');

            const startTime = performance.now();
            fireEvent.click(viewButton);
            const endTime = performance.now();

            // Interaction should be handled quickly (within 16ms for 60fps)
            expect(endTime - startTime).toBeLessThan(16);
            expect(onViewDetails).toHaveBeenCalledWith(mockBooking);
        });
    });
});