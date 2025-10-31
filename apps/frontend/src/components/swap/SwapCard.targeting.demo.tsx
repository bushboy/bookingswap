import React from 'react';
import { EnhancedSwapCard } from './SwapCard.enhanced';
import { EnhancedSwapCardData } from '@booking-swap/shared';

/**
 * Demo component showing the simple targeting display functionality
 * This demonstrates the implementation of task 4: Update frontend SwapCard component to display simple targeting information
 */
export const SwapCardTargetingDemo: React.FC = () => {
    // Mock data with targeting information
    const mockSwapDataWithTargeting: EnhancedSwapCardData = {
        userSwap: {
            id: 'swap-1',
            bookingDetails: {
                id: 'booking-1',
                title: 'Luxury Hotel in Manhattan',
                location: { city: 'New York', country: 'USA' },
                dateRange: {
                    checkIn: new Date('2024-02-01'),
                    checkOut: new Date('2024-02-05'),
                },
                swapValue: 800,
                originalPrice: 1000,
            },
            status: 'pending',
            createdAt: new Date('2024-01-15'),
            expiresAt: new Date('2024-01-30'),
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
                            id: 'booking-2',
                            title: 'Paris Apartment',
                            location: { city: 'Paris', country: 'France' },
                            dateRange: {
                                checkIn: new Date('2024-02-01'),
                                checkOut: new Date('2024-02-05'),
                            },
                            swapValue: 750,
                            originalPrice: 900,
                        },
                        ownerId: 'user-2',
                        ownerName: 'John Doe',
                    },
                    proposalId: 'proposal-1',
                    status: 'active',
                    createdAt: new Date('2024-01-16'),
                    updatedAt: new Date('2024-01-16'),
                },
                {
                    targetId: 'target-3',
                    sourceSwapId: 'swap-4',
                    sourceSwap: {
                        id: 'swap-4',
                        bookingDetails: {
                            id: 'booking-4',
                            title: 'Tokyo Business Hotel',
                            location: { city: 'Tokyo', country: 'Japan' },
                            dateRange: {
                                checkIn: new Date('2024-02-01'),
                                checkOut: new Date('2024-02-05'),
                            },
                            swapValue: 850,
                            originalPrice: 1100,
                        },
                        ownerId: 'user-4',
                        ownerName: 'Yuki Tanaka',
                    },
                    proposalId: 'proposal-3',
                    status: 'active',
                    createdAt: new Date('2024-01-17'),
                    updatedAt: new Date('2024-01-17'),
                },
            ],
            incomingTargetCount: 2,
            outgoingTarget: {
                targetId: 'target-2',
                targetSwapId: 'swap-3',
                targetSwap: {
                    id: 'swap-3',
                    bookingDetails: {
                        id: 'booking-3',
                        title: 'London Boutique Hotel',
                        location: { city: 'London', country: 'UK' },
                        dateRange: {
                            checkIn: new Date('2024-02-01'),
                            checkOut: new Date('2024-02-05'),
                        },
                        swapValue: 900,
                        originalPrice: 1200,
                    },
                    ownerId: 'user-3',
                    ownerName: 'Jane Smith',
                },
                proposalId: 'proposal-2',
                status: 'active',
                createdAt: new Date('2024-01-16'),
                updatedAt: new Date('2024-01-16'),
                targetSwapInfo: {
                    acceptanceStrategy: { type: 'one_for_one' as any },
                },
            },
            canReceiveTargets: true,
            canTarget: true,
            targetingRestrictions: [],
        },
    };

    // Mock data without targeting
    const mockSwapDataWithoutTargeting: EnhancedSwapCardData = {
        ...mockSwapDataWithTargeting,
        targeting: {
            incomingTargets: [],
            incomingTargetCount: 0,
            canReceiveTargets: true,
            canTarget: true,
            targetingRestrictions: [],
        },
    };

    // Mock data with invalid targeting (for error handling demo)
    const mockSwapDataWithInvalidTargeting: EnhancedSwapCardData = {
        ...mockSwapDataWithTargeting,
        targeting: {
            incomingTargets: [
                {
                    // Missing required fields to trigger error handling
                    targetId: 'invalid-target',
                    sourceSwapId: 'invalid-swap',
                } as any,
            ],
            incomingTargetCount: 1,
            canReceiveTargets: true,
            canTarget: true,
            targetingRestrictions: [],
        },
    };

    const handleAcceptTarget = async (targetId: string, proposalId: string) => {
        console.log('Accept target:', targetId, proposalId);
        alert(`Accept target: ${targetId}`);
    };

    const handleRejectTarget = async (targetId: string, proposalId: string) => {
        console.log('Reject target:', targetId, proposalId);
        alert(`Reject target: ${targetId}`);
    };

    const handleCancelTargeting = async (swapId: string, targetId: string) => {
        console.log('Cancel targeting:', swapId, targetId);
        alert(`Cancel targeting: ${targetId}`);
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1>SwapCard Targeting Display Demo</h1>
            <p>This demonstrates the simple targeting information display functionality.</p>

            <div style={{ marginBottom: '40px' }}>
                <h2>1. Swap with Targeting Information</h2>
                <p>Shows incoming targets (2) and outgoing target (1) with simple visual indicators.</p>
                <EnhancedSwapCard
                    swapData={mockSwapDataWithTargeting}
                    onAcceptTarget={handleAcceptTarget}
                    onRejectTarget={handleRejectTarget}
                    onCancelTargeting={handleCancelTargeting}
                />
            </div>

            <div style={{ marginBottom: '40px' }}>
                <h2>2. Swap without Targeting Information</h2>
                <p>No targeting indicators should be displayed.</p>
                <EnhancedSwapCard
                    swapData={mockSwapDataWithoutTargeting}
                />
            </div>

            <div style={{ marginBottom: '40px' }}>
                <h2>3. Swap with Invalid Targeting Data</h2>
                <p>Shows error handling for missing or invalid targeting data.</p>
                <EnhancedSwapCard
                    swapData={mockSwapDataWithInvalidTargeting}
                    onAcceptTarget={handleAcceptTarget}
                />
            </div>

            <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                <h3>Implementation Features:</h3>
                <ul>
                    <li>✅ Simple targeting indicators (incoming count, outgoing status)</li>
                    <li>✅ Visual indicators for targeting relationships (📥 📤)</li>
                    <li>✅ Works with simplified data structure</li>
                    <li>✅ Error handling for missing or invalid targeting data</li>
                    <li>✅ Expandable details view</li>
                    <li>✅ Action buttons for accepting/rejecting targets</li>
                    <li>✅ Mobile responsive design</li>
                    <li>✅ Graceful fallback when targeting data is unavailable</li>
                </ul>
            </div>
        </div>
    );
};

export default SwapCardTargetingDemo;