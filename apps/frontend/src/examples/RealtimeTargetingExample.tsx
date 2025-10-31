import React, { useState, useEffect } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import targetingReducer from '../store/slices/targetingSlice';
import RealtimeTargetingDisplay from '../components/swap/targeting/RealtimeTargetingDisplay';
import { enhancedTargetingWebSocketService } from '../services/enhancedTargetingWebSocketService';

// Mock store for the example
const exampleStore = configureStore({
    reducer: {
        targeting: targetingReducer,
    },
    preloadedState: {
        targeting: {
            swapTargeting: {
                'example-swap-1': {
                    incomingTargets: [
                        {
                            targetId: 'target-1',
                            sourceSwapId: 'source-swap-1',
                            sourceSwap: {
                                id: 'source-swap-1',
                                title: 'Beautiful Paris Apartment',
                                ownerName: 'Marie Dubois',
                            },
                            status: 'active',
                            createdAt: new Date('2024-01-15T10:30:00Z'),
                        },
                        {
                            targetId: 'target-2',
                            sourceSwapId: 'source-swap-2',
                            sourceSwap: {
                                id: 'source-swap-2',
                                title: 'Cozy Rome Villa',
                                ownerName: 'Giuseppe Romano',
                            },
                            status: 'active',
                            createdAt: new Date('2024-01-15T14:20:00Z'),
                        },
                    ],
                    outgoingTarget: {
                        targetId: 'target-3',
                        targetSwapId: 'target-swap-1',
                        targetSwap: {
                            id: 'target-swap-1',
                            title: 'Modern Barcelona Loft',
                            ownerName: 'Carlos Martinez',
                        },
                        status: 'active',
                        createdAt: new Date('2024-01-15T09:15:00Z'),
                    },
                    auctionInfo: {
                        endDate: new Date('2024-01-16T18:00:00Z'),
                        currentProposalCount: 7,
                        timeRemaining: '1h 23m',
                        isEnding: false,
                    },
                    events: [
                        {
                            id: 'event-1',
                            type: 'targeting_received',
                            timestamp: new Date('2024-01-15T14:20:00Z'),
                            data: { sourceUserName: 'Giuseppe Romano' },
                        },
                        {
                            id: 'event-2',
                            type: 'targeting_created',
                            timestamp: new Date('2024-01-15T10:30:00Z'),
                            data: { targetUserName: 'Marie Dubois' },
                        },
                        {
                            id: 'event-3',
                            type: 'auction_targeting_update',
                            timestamp: new Date('2024-01-15T16:45:00Z'),
                            data: { proposalCount: 7 },
                        },
                    ],
                    lastUpdated: new Date(),
                },
            },
            targetingStatus: {},
            isConnected: true,
            showTargetingNotifications: true,
            unreadTargetingCount: 2,
            isTargeting: false,
            targetingHistory: [],
            swapsTargetingMe: [],
            cachedValidations: {},
            cachedCanTarget: {},
            cachedAuctionEligibility: {},
            cachedOneForOneEligibility: {},
        },
    },
});

/**
 * Example component demonstrating real-time targeting functionality
 * This shows how the RealtimeTargetingDisplay component works with live data
 */
export const RealtimeTargetingExample: React.FC = () => {
    const [simulateUpdates, setSimulateUpdates] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('connected');

    // Simulate real-time updates for demonstration
    useEffect(() => {
        if (!simulateUpdates) return;

        const interval = setInterval(() => {
            // Simulate random targeting events
            const eventTypes = [
                'targeting_received',
                'targeting_accepted',
                'targeting_rejected',
                'auction_targeting_update',
                'proposal_targeting_update',
            ];

            const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];

            // Dispatch a mock event to the store
            exampleStore.dispatch({
                type: 'targeting/addTargetingEvent',
                payload: {
                    swapId: 'example-swap-1',
                    event: {
                        id: `event-${Date.now()}`,
                        type: randomEvent,
                        timestamp: new Date(),
                        data: {
                            sourceUserName: 'Demo User',
                            message: `Simulated ${randomEvent} event`,
                        },
                    },
                },
            });

            // Occasionally simulate new incoming targets
            if (Math.random() < 0.3) {
                exampleStore.dispatch({
                    type: 'targeting/addIncomingTarget',
                    payload: {
                        swapId: 'example-swap-1',
                        targetInfo: {
                            targetId: `target-${Date.now()}`,
                            sourceSwapId: `source-${Date.now()}`,
                            sourceSwap: {
                                id: `source-${Date.now()}`,
                                title: 'New Demo Swap',
                                ownerName: 'Demo User',
                            },
                            status: 'active',
                            createdAt: new Date(),
                        },
                    },
                });

                // Increment unread count
                exampleStore.dispatch({
                    type: 'targeting/updateSwapTargeting',
                    payload: {
                        swapId: 'example-swap-1',
                        updates: {
                            lastUpdated: new Date(),
                        },
                    },
                });
            }

            // Simulate auction countdown updates
            if (Math.random() < 0.4) {
                const timeRemaining = Math.floor(Math.random() * 120); // 0-120 minutes
                const hours = Math.floor(timeRemaining / 60);
                const minutes = timeRemaining % 60;
                const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

                exampleStore.dispatch({
                    type: 'targeting/updateAuctionCountdown',
                    payload: {
                        swapId: 'example-swap-1',
                        auctionInfo: {
                            endDate: new Date(Date.now() + timeRemaining * 60 * 1000),
                            currentProposalCount: Math.floor(Math.random() * 15) + 1,
                            timeRemaining: timeString,
                            isEnding: timeRemaining < 10,
                        },
                    },
                });
            }

        }, 3000); // Update every 3 seconds

        return () => clearInterval(interval);
    }, [simulateUpdates]);

    // Simulate connection status changes
    const handleConnectionToggle = () => {
        const statuses: Array<'connected' | 'disconnected' | 'error'> = ['connected', 'disconnected', 'error'];
        const currentIndex = statuses.indexOf(connectionStatus);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        setConnectionStatus(nextStatus);

        // Update the store connection status
        exampleStore.dispatch({
            type: 'targeting/setConnectionStatus',
            payload: {
                isConnected: nextStatus === 'connected',
                error: nextStatus === 'error' ? 'Simulated connection error' : undefined,
            },
        });
    };

    const handleClearData = () => {
        exampleStore.dispatch({
            type: 'targeting/clearSwapTargeting',
            payload: 'example-swap-1',
        });
    };

    const handleResetData = () => {
        window.location.reload();
    };

    return (
        <Provider store={exampleStore}>
            <div style={{
                maxWidth: '800px',
                margin: '0 auto',
                padding: '20px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
                <h1 style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    marginBottom: '16px',
                    color: '#1f2937'
                }}>
                    Real-time Targeting Display Example
                </h1>

                <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    marginBottom: '24px',
                    lineHeight: '1.5'
                }}>
                    This example demonstrates the real-time targeting functionality with live updates,
                    optimistic UI changes, error handling, and WebSocket connection management.
                </p>

                {/* Control Panel */}
                <div style={{
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '24px',
                }}>
                    <h3 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        marginBottom: '12px',
                        color: '#1f2937'
                    }}>
                        Demo Controls
                    </h3>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setSimulateUpdates(!simulateUpdates)}
                            style={{
                                background: simulateUpdates ? '#ef4444' : '#10b981',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                            }}
                        >
                            {simulateUpdates ? 'Stop Updates' : 'Start Updates'}
                        </button>

                        <button
                            onClick={handleConnectionToggle}
                            style={{
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                            }}
                        >
                            Toggle Connection ({connectionStatus})
                        </button>

                        <button
                            onClick={handleClearData}
                            style={{
                                background: '#f59e0b',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                            }}
                        >
                            Clear Data
                        </button>

                        <button
                            onClick={handleResetData}
                            style={{
                                background: '#6b7280',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                            }}
                        >
                            Reset Demo
                        </button>
                    </div>
                </div>

                {/* Real-time Targeting Display */}
                <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        background: '#f3f4f6',
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                    }}>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            margin: '0',
                            color: '#1f2937'
                        }}>
                            Swap: London Penthouse
                        </h3>
                        <p style={{
                            fontSize: '13px',
                            color: '#6b7280',
                            margin: '4px 0 0 0'
                        }}>
                            Real-time targeting updates and interactions
                        </p>
                    </div>

                    <RealtimeTargetingDisplay
                        swapId="example-swap-1"
                        userId="example-user-1"
                        showConnectionStatus={true}
                        enableOptimisticUpdates={true}
                        autoMarkAsRead={false} // Disabled for demo to see unread states
                    />
                </div>

                {/* Feature Highlights */}
                <div style={{
                    marginTop: '24px',
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                    padding: '16px',
                }}>
                    <h3 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        marginBottom: '12px',
                        color: '#0369a1'
                    }}>
                        Features Demonstrated
                    </h3>

                    <ul style={{
                        fontSize: '14px',
                        color: '#0369a1',
                        lineHeight: '1.6',
                        paddingLeft: '20px',
                        margin: '0'
                    }}>
                        <li>Real-time WebSocket connection status indicator</li>
                        <li>Live targeting updates (incoming/outgoing targets)</li>
                        <li>Optimistic UI updates with loading states</li>
                        <li>Error handling and retry mechanisms</li>
                        <li>Auction countdown with real-time updates</li>
                        <li>Interactive targeting actions (accept/reject/retarget/cancel)</li>
                        <li>Unread count tracking and management</li>
                        <li>Recent activity timeline</li>
                        <li>Expandable target details</li>
                        <li>Mobile-responsive design</li>
                        <li>Accessibility features (ARIA labels, keyboard navigation)</li>
                        <li>Failed update indicators with retry logic</li>
                    </ul>
                </div>

                {/* Usage Instructions */}
                <div style={{
                    marginTop: '16px',
                    background: '#fffbeb',
                    border: '1px solid #fed7aa',
                    borderRadius: '8px',
                    padding: '16px',
                }}>
                    <h3 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        marginBottom: '12px',
                        color: '#d97706'
                    }}>
                        Try It Out
                    </h3>

                    <ol style={{
                        fontSize: '14px',
                        color: '#d97706',
                        lineHeight: '1.6',
                        paddingLeft: '20px',
                        margin: '0'
                    }}>
                        <li>Click "Start Updates" to see live targeting events</li>
                        <li>Toggle connection status to see error handling</li>
                        <li>Expand targets to see action buttons</li>
                        <li>Try accepting/rejecting targets to see optimistic updates</li>
                        <li>Watch the auction countdown update in real-time</li>
                        <li>Notice the unread count and connection indicators</li>
                        <li>Clear data to see empty states</li>
                    </ol>
                </div>
            </div>
        </Provider>
    );
};

export default RealtimeTargetingExample;