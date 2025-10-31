import React, { useState, memo, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import TargetingActionButtons from './TargetingActionButtons';
import TargetingConfirmationDialog from './TargetingConfirmationDialog';
import useTargetingActions from '@/hooks/useTargetingActions';
// Import components - temporarily commented out to fix compilation
// import IncomingTargetDisplayComponent from './IncomingTargetDisplay';
// import OutgoingTargetDisplayComponent from './OutgoingTargetDisplay';
import styles from './targeting-display.module.css';

export interface IncomingTargetDisplayData {
    targetId: string;
    sourceSwapId: string;
    sourceSwapDetails: {
        id: string;
        bookingTitle: string;
        bookingLocation: string;
        checkIn: Date;
        checkOut: Date;
        price: number;
        ownerName: string;
        ownerAvatar?: string;
    };
    status: 'active' | 'accepted' | 'rejected' | 'cancelled';
    createdAt: Date;
    displayLabel: string;
    statusIcon: string;
    statusColor: string;
    actionable: boolean;
}

export interface OutgoingTargetDisplayData {
    targetId: string;
    targetSwapId: string;
    targetSwapDetails: {
        id: string;
        bookingTitle: string;
        bookingLocation: string;
        checkIn: Date;
        checkOut: Date;
        price: number;
        ownerName: string;
        ownerAvatar?: string;
    };
    status: 'active' | 'accepted' | 'rejected' | 'cancelled';
    createdAt: Date;
    displayLabel: string;
    statusIcon: string;
    statusColor: string;
    actionable: boolean;
}

export interface TargetingAction {
    type: 'accept_target' | 'reject_target' | 'retarget' | 'cancel_targeting' | 'view_details';
    targetId?: string;
    swapId: string;
    metadata?: Record<string, any>;
}

export interface TargetingDetailsProps {
    incomingTargets: IncomingTargetDisplayData[];
    outgoingTargets: OutgoingTargetDisplayData[];
    expanded: boolean;
    onToggle: () => void;
    onAction?: (action: TargetingAction) => void;
    className?: string;
    // New props for action integration
    onActionSuccess?: (action: TargetingAction, result: any) => void;
    onActionError?: (action: TargetingAction, error: string) => void;
}/**
 * Enhanced targeting details component for expanded targeting information
 * Shows detailed view of incoming and outgoing targets with actions
 * Optimized with React.memo and proper dependency management
 * Requirements: 7.4, 7.5
 */
export const TargetingDetails: React.FC<TargetingDetailsProps> = memo(({
    incomingTargets,
    outgoingTargets,
    expanded,
    onToggle,
    onAction,
    className = '',
    onActionSuccess,
    onActionError,
}) => {
    const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');

    // Suppress unused parameter warning - onAction is part of the public API
    void onAction;

    // Initialize targeting actions hook
    const {
        executeAction,
        isLoading: actionLoading,
        error: actionError,
        pendingAction,
        confirmAction,
        cancelAction,
        clearError
    } = useTargetingActions({
        onSuccess: onActionSuccess,
        onError: onActionError,
        requireConfirmation: true
    });

    // Memoize computed values to prevent unnecessary re-renders
    const targetingStats = useMemo(() => {
        const hasIncoming = incomingTargets.length > 0;
        const hasOutgoing = outgoingTargets.length > 0;
        const hasBoth = hasIncoming && hasOutgoing;

        return {
            hasIncoming,
            hasOutgoing,
            hasBoth,
            hasAny: hasIncoming || hasOutgoing,
            incomingCount: incomingTargets.length,
            outgoingCount: outgoingTargets.length,
            totalCount: incomingTargets.length + outgoingTargets.length
        };
    }, [incomingTargets.length, outgoingTargets.length]);

    // Memoize tab change handler
    const handleTabChange = useCallback((tab: 'incoming' | 'outgoing') => {
        setActiveTab(tab);
    }, []);

    // Memoize toggle handler to prevent prop drilling issues
    const handleToggle = useCallback((e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        onToggle();
    }, [onToggle]);

    // Early return for empty state
    if (!targetingStats.hasAny) {
        return null;
    }

    // Determine initial tab based on available data
    const effectiveActiveTab = useMemo(() => {
        if (activeTab === 'incoming' && !targetingStats.hasIncoming) {
            return 'outgoing';
        }
        if (activeTab === 'outgoing' && !targetingStats.hasOutgoing) {
            return 'incoming';
        }
        return activeTab;
    }, [activeTab, targetingStats.hasIncoming, targetingStats.hasOutgoing]);

    return (
        <Card className={`${styles.targetingDetails} ${expanded ? styles.expanded : ''} ${className}`} padding="none">
            <CardHeader>
                <div className={styles.detailsHeader} onClick={handleToggle}>
                    <CardTitle>
                        Targeting Details
                        {targetingStats.hasBoth && (
                            <span style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.normal,
                                color: tokens.colors.neutral[600],
                                marginLeft: tokens.spacing[2]
                            }}>
                                ({targetingStats.incomingCount} incoming, {targetingStats.outgoingCount} outgoing)
                            </span>
                        )}
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="small"
                        icon={expanded ? '▼' : '▶'}
                        iconOnly
                        onClick={handleToggle}
                    />
                </div>
            </CardHeader>

            {expanded && (
                <CardContent>
                    {targetingStats.hasBoth && (
                        <TabNavigation
                            activeTab={effectiveActiveTab}
                            onTabChange={handleTabChange}
                            incomingCount={targetingStats.incomingCount}
                            outgoingCount={targetingStats.outgoingCount}
                        />
                    )}

                    <TargetingContent
                        activeTab={effectiveActiveTab}
                        incomingTargets={incomingTargets}
                        outgoingTargets={outgoingTargets}
                        targetingStats={targetingStats}
                        executeAction={executeAction}
                        actionLoading={actionLoading}
                    />
                </CardContent>
            )}

            {/* Confirmation Dialog */}
            <TargetingConfirmationDialog
                isOpen={!!pendingAction}
                action={pendingAction}
                targetDetails={pendingAction ? getTargetDetails(pendingAction) : undefined}
                onConfirm={confirmAction}
                onCancel={cancelAction}
                loading={actionLoading}
            />

            {/* Error Display */}
            {actionError && (
                <div className={styles.errorMessage} role="alert">
                    <span>❌ {actionError}</span>
                    <Button
                        variant="ghost"
                        size="small"
                        onClick={clearError}
                        style={{ marginLeft: '8px' }}
                    >
                        Dismiss
                    </Button>
                </div>
            )}
        </Card>
    );

    // Helper function to get target details for confirmation dialog
    function getTargetDetails(action: TargetingAction) {
        if (action.type === 'accept_target' || action.type === 'reject_target') {
            const target = incomingTargets.find(t => t.targetId === action.targetId);
            if (target) {
                return {
                    bookingTitle: target.sourceSwapDetails.bookingTitle,
                    ownerName: target.sourceSwapDetails.ownerName,
                    location: target.sourceSwapDetails.bookingLocation,
                    price: target.sourceSwapDetails.price
                };
            }
        } else if (action.type === 'retarget' || action.type === 'cancel_targeting') {
            const target = outgoingTargets.find(t => t.targetId === action.targetId);
            if (target) {
                return {
                    bookingTitle: target.targetSwapDetails.bookingTitle,
                    ownerName: target.targetSwapDetails.ownerName,
                    location: target.targetSwapDetails.bookingLocation,
                    price: target.targetSwapDetails.price
                };
            }
        }
        return undefined;
    }
});

/**
 * Memoized tab navigation component
 */
const TabNavigation: React.FC<{
    activeTab: 'incoming' | 'outgoing';
    onTabChange: (tab: 'incoming' | 'outgoing') => void;
    incomingCount: number;
    outgoingCount: number;
}> = memo(({ activeTab, onTabChange, incomingCount, outgoingCount }) => {
    return (
        <div className={styles.tabContainer}>
            <button
                className={`${styles.tabButton} ${activeTab === 'incoming' ? styles.active : ''}`}
                onClick={() => onTabChange('incoming')}
            >
                📥 Incoming ({incomingCount})
            </button>
            <button
                className={`${styles.tabButton} ${activeTab === 'outgoing' ? styles.active : ''}`}
                onClick={() => onTabChange('outgoing')}
            >
                📤 Outgoing ({outgoingCount})
            </button>
        </div>
    );
});

/**
 * Memoized targeting content component
 */
const TargetingContent: React.FC<{
    activeTab: 'incoming' | 'outgoing';
    incomingTargets: IncomingTargetDisplayData[];
    outgoingTargets: OutgoingTargetDisplayData[];
    targetingStats: {
        hasIncoming: boolean;
        hasOutgoing: boolean;
        hasBoth: boolean;
    };
    executeAction: (action: TargetingAction) => Promise<void>;
    actionLoading: boolean;
}> = memo(({ activeTab, incomingTargets, outgoingTargets, targetingStats, executeAction, actionLoading }) => {


    return (
        <>
            {(activeTab === 'incoming' || !targetingStats.hasOutgoing) && targetingStats.hasIncoming && (
                <div className={styles.targetingSection}>
                    {/* IncomingTargetDisplayComponent will be added here */}
                    <div className={styles.placeholderContent}>
                        <h4>Incoming Targets ({incomingTargets.length})</h4>
                        <p>Swaps targeting your bookings</p>
                        {incomingTargets.slice(0, 3).map((target) => (
                            <div key={target.targetId} className={styles.targetPreview}>
                                <span>{target.displayLabel}</span>
                                <span className={styles.targetStatus}>{target.status}</span>
                                {target.actionable && (
                                    <TargetingActionButtons
                                        targetId={target.targetId}
                                        swapId={target.sourceSwapId}
                                        targetType="incoming"
                                        status={target.status}
                                        actionable={target.actionable}
                                        onAction={executeAction}
                                        disabled={actionLoading}
                                    />
                                )}
                            </div>
                        ))}
                        {incomingTargets.length > 3 && (
                            <p className={styles.moreTargets}>
                                +{incomingTargets.length - 3} more targets
                            </p>
                        )}
                    </div>
                </div>
            )}

            {(activeTab === 'outgoing' || !targetingStats.hasIncoming) && targetingStats.hasOutgoing && (
                <div className={styles.targetingSection}>
                    {/* OutgoingTargetDisplayComponent will be added here */}
                    <div className={styles.placeholderContent}>
                        <h4>Outgoing Targets ({outgoingTargets.length})</h4>
                        <p>Bookings you are targeting</p>
                        {outgoingTargets.slice(0, 3).map((target) => (
                            <div key={target.targetId} className={styles.targetPreview}>
                                <span>{target.displayLabel}</span>
                                <span className={styles.targetStatus}>{target.status}</span>
                                {target.actionable && (
                                    <TargetingActionButtons
                                        targetId={target.targetId}
                                        swapId={target.targetSwapId}
                                        targetType="outgoing"
                                        status={target.status}
                                        actionable={target.actionable}
                                        onAction={executeAction}
                                        disabled={actionLoading}
                                    />
                                )}
                            </div>
                        ))}
                        {outgoingTargets.length > 3 && (
                            <p className={styles.moreTargets}>
                                +{outgoingTargets.length - 3} more targets
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
});

// Display names for debugging
TargetingDetails.displayName = 'TargetingDetails';
TabNavigation.displayName = 'TabNavigation';
TargetingContent.displayName = 'TargetingContent';

export default TargetingDetails;