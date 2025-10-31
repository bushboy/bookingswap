import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import TargetingDetails from '../components/swap/targeting/TargetingDetails';
import { TargetingAction, IncomingTargetDisplayData, OutgoingTargetDisplayData } from '../components/swap/targeting/TargetingDetails';

/**
 * Example component demonstrating targeting action integration
 * Shows how to use the new targeting action buttons and confirmation dialogs
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
export const TargetingActionExample: React.FC = () => {
    const [expanded, setExpanded] = useState(true);
    const [actionLog, setActionLog] = useState<string[]>([]);

    // Mock incoming targets data
    const incomingTargets: IncomingTargetDisplayData[] = [
        {
            targetId: 'target-1',
            sourceSwapId: 'swap-source-1',
            sourceSwapDetails: {
                id: 'swap-source-1',
                bookingTitle: 'Luxury Paris Apartment',
                bookingLocation: 'Paris, France',
                checkIn: new Date('2024-06-15'),
                checkOut: new Date('2024-06-22'),
                price: 1200,
                ownerName: 'Marie Dubois',
                ownerAvatar: 'https://example.com/avatar1.jpg'
            },
            status: 'active',
            createdAt: new Date('2024-01-15T10:30:00Z'),
            displayLabel: "Marie's Paris Apartment is targeting your London Hotel",
            statusIcon: '🎯',
            statusColor: '#10b981',
            actionable: true
        },
        {
            targetId: 'target-2',
            sourceSwapId: 'swap-source-2',
            sourceSwapDetails: {
                id: 'swap-source-2',
                bookingTitle: 'Beachfront Villa in Barcelona',
                bookingLocation: 'Barcelona, Spain',
                checkIn: new Date('2024-06-10'),
                checkOut: new Date('2024-06-17'),
                price: 950,
                ownerName: 'Carlos Rodriguez',
                ownerAvatar: 'https://example.com/avatar2.jpg'
            },
            status: 'active',
            createdAt: new Date('2024-01-16T14:20:00Z'),
            displayLabel: "Carlos's Barcelona Villa is targeting your London Hotel",
            statusIcon: '🎯',
            statusColor: '#10b981',
            actionable: true
        }
    ];

    // Mock outgoing targets data
    const outgoingTargets: OutgoingTargetDisplayData[] = [
        {
            targetId: 'target-out-1',
            targetSwapId: 'swap-target-1',
            targetSwapDetails: {
                id: 'swap-target-1',
                bookingTitle: 'Mountain Chalet in Swiss Alps',
                bookingLocation: 'Zermatt, Switzerland',
                checkIn: new Date('2024-07-01'),
                checkOut: new Date('2024-07-08'),
                price: 1800,
                ownerName: 'Hans Mueller',
                ownerAvatar: 'https://example.com/avatar3.jpg'
            },
            status: 'active',
            createdAt: new Date('2024-01-14T09:15:00Z'),
            displayLabel: "Your London Hotel is targeting Hans's Swiss Chalet",
            statusIcon: '🎯',
            statusColor: '#3b82f6',
            actionable: true
        }
    ];

    const handleTargetingAction = async (action: TargetingAction) => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] Action: ${action.type} - Target: ${action.targetId} - Swap: ${action.swapId}`;

        setActionLog(prev => [logEntry, ...prev]);

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('Targeting action executed:', action);
    };

    const handleActionSuccess = (action: TargetingAction, result: any) => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ✅ SUCCESS: ${action.type} completed successfully`;
        setActionLog(prev => [logEntry, ...prev]);
    };

    const handleActionError = (action: TargetingAction, error: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ❌ ERROR: ${action.type} failed - ${error}`;
        setActionLog(prev => [logEntry, ...prev]);
    };

    const clearLog = () => {
        setActionLog([]);
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <Card>
                <CardHeader>
                    <CardTitle>Targeting Action Integration Example</CardTitle>
                    <p style={{ color: '#6b7280', fontSize: '14px', margin: '8px 0 0 0' }}>
                        This example demonstrates the new targeting action buttons and confirmation dialogs.
                        Try accepting/rejecting incoming targets or retargeting/cancelling outgoing targets.
                    </p>
                </CardHeader>
                <CardContent>
                    <TargetingDetails
                        incomingTargets={incomingTargets}
                        outgoingTargets={outgoingTargets}
                        expanded={expanded}
                        onToggle={() => setExpanded(!expanded)}
                        onAction={handleTargetingAction}
                        onActionSuccess={handleActionSuccess}
                        onActionError={handleActionError}
                    />
                </CardContent>
            </Card>

            {/* Action Log */}
            <Card style={{ marginTop: '20px' }}>
                <CardHeader>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <CardTitle>Action Log</CardTitle>
                        <button
                            onClick={clearLog}
                            style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                background: '#f3f4f6',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Clear Log
                        </button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div style={{
                        maxHeight: '200px',
                        overflowY: 'auto',
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        padding: '12px'
                    }}>
                        {actionLog.length === 0 ? (
                            <p style={{ color: '#6b7280', fontStyle: 'italic', margin: 0 }}>
                                No actions performed yet. Try clicking on the targeting action buttons above.
                            </p>
                        ) : (
                            <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                {actionLog.map((entry, index) => (
                                    <div key={index} style={{ marginBottom: '4px', color: '#374151' }}>
                                        {entry}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Feature Summary */}
            <Card style={{ marginTop: '20px' }}>
                <CardHeader>
                    <CardTitle>Features Implemented</CardTitle>
                </CardHeader>
                <CardContent>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                        <div>
                            <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>✅ Incoming Target Actions</h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#6b7280' }}>
                                <li>Accept targeting proposals</li>
                                <li>Reject targeting proposals</li>
                                <li>Confirmation dialogs</li>
                            </ul>
                        </div>
                        <div>
                            <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>✅ Outgoing Target Actions</h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#6b7280' }}>
                                <li>Retarget to different swap</li>
                                <li>Cancel targeting</li>
                                <li>Browse available targets</li>
                            </ul>
                        </div>
                        <div>
                            <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>✅ User Experience</h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#6b7280' }}>
                                <li>Loading states</li>
                                <li>Error handling</li>
                                <li>Success feedback</li>
                            </ul>
                        </div>
                        <div>
                            <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>✅ Integration</h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#6b7280' }}>
                                <li>SwapTargetingService</li>
                                <li>Real-time updates</li>
                                <li>Accessibility support</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default TargetingActionExample;