import React, { useState, memo, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import styles from './targeting-display.module.css';

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

export interface OutgoingTargetDisplayProps {
    targets: OutgoingTargetDisplayData[];
    onAction: (action: TargetingAction) => void;
    className?: string;
}

/**
 * Enhanced outgoing target display component with performance optimizations
 * Shows detailed information about swaps that the current user's swap is targeting
 * Optimized with React.memo and proper dependency management
 * Requirements: 7.4, 7.5
 */
export const OutgoingTargetDisplay: React.FC<OutgoingTargetDisplayProps> = memo(({
    targets,
    onAction,
    className = '',
}) => {
    const [expandedTargets, setExpandedTargets] = useState<Set<string>>(new Set());
    const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

    // Memoize target count to prevent unnecessary re-renders
    const targetCount = useMemo(() => targets.length, [targets.length]);

    // Memoize toggle handler to prevent prop drilling issues
    const toggleExpanded = useCallback((targetId: string) => {
        setExpandedTargets(prev => {
            const newExpanded = new Set(prev);
            if (newExpanded.has(targetId)) {
                newExpanded.delete(targetId);
            } else {
                newExpanded.add(targetId);
            }
            return newExpanded;
        });
    }, []);

    // Memoize action handler to prevent unnecessary re-renders
    const handleAction = useCallback(async (actionType: 'retarget' | 'cancel_targeting', target: OutgoingTargetDisplayData) => {
        setActionLoading(prev => new Set([...prev, target.targetId]));

        try {
            await onAction({
                type: actionType,
                targetId: target.targetId,
                swapId: target.targetSwapId,
                metadata: {
                    targetSwapId: target.targetSwapId,
                    currentTargetId: target.targetId,
                    timestamp: new Date().toISOString()
                }
            });
        } finally {
            setActionLoading(prev => {
                const newSet = new Set(prev);
                newSet.delete(target.targetId);
                return newSet;
            });
        }
    }, [onAction]);

    // Memoize status badge variant function
    const getStatusBadgeVariant = useCallback((status: string): 'success' | 'warning' | 'error' | 'info' => {
        switch (status) {
            case 'active': return 'info';
            case 'accepted': return 'success';
            case 'rejected': return 'error';
            case 'cancelled': return 'error';
            default: return 'info';
        }
    }, []);

    // Styles are now handled by CSS modules

    const getActionButtons = (target: OutgoingTargetDisplayData) => {
        const isLoading = actionLoading.has(target.targetId);

        if (target.status === 'accepted') {
            return (
                <div className={styles.successMessage}>
                    🎉 Your targeting proposal was accepted!
                </div>
            );
        }

        if (target.status === 'rejected') {
            return (
                <div className={styles.targetActions}>
                    <Button
                        variant="primary"
                        size="small"
                        onClick={() => handleAction('retarget', target)}
                        disabled={isLoading}
                        loading={isLoading}
                    >
                        Find New Target
                    </Button>
                </div>
            );
        }

        if (target.status === 'active') {
            return (
                <div className={styles.targetActions}>
                    <Button
                        variant="outline"
                        size="small"
                        onClick={() => handleAction('cancel_targeting', target)}
                        disabled={isLoading}
                        loading={isLoading}
                    >
                        Cancel Targeting
                    </Button>
                    <Button
                        variant="secondary"
                        size="small"
                        onClick={() => handleAction('retarget', target)}
                        disabled={isLoading}
                        loading={isLoading}
                    >
                        Retarget
                    </Button>
                </div>
            );
        }

        return null;
    };

    if (targets.length === 0) {
        return null;
    }

    return (
        <div className={`outgoing-target-display ${className}`}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                marginBottom: tokens.spacing[4],
            }}>
                <span style={{ fontSize: tokens.typography.fontSize.lg, fontWeight: tokens.typography.fontWeight.semibold }}>
                    📤 Outgoing Targets
                </span>
                <Badge variant="info" size="small">
                    {targetCount}
                </Badge>
            </div>

            {targets.map((target) => (
                <OutgoingTargetItem
                    key={target.targetId}
                    target={target}
                    isExpanded={expandedTargets.has(target.targetId)}
                    isLoading={actionLoading.has(target.targetId)}
                    onToggleExpanded={toggleExpanded}
                    onAction={handleAction}
                    getStatusBadgeVariant={getStatusBadgeVariant}
                />
            ))}
        </div>
    );
});

/**
 * Memoized individual outgoing target item component for optimal rendering performance
 */
const OutgoingTargetItem: React.FC<{
    target: OutgoingTargetDisplayData;
    isExpanded: boolean;
    isLoading: boolean;
    onToggleExpanded: (targetId: string) => void;
    onAction: (actionType: 'retarget' | 'cancel_targeting', target: OutgoingTargetDisplayData) => void;
    getStatusBadgeVariant: (status: string) => 'success' | 'warning' | 'error' | 'info';
}> = memo(({ target, isExpanded, isLoading, onToggleExpanded, onAction, getStatusBadgeVariant }) => {
    // Memoize click handlers
    const handleToggle = useCallback(() => {
        onToggleExpanded(target.targetId);
    }, [onToggleExpanded, target.targetId]);

    const handleRetarget = useCallback(() => {
        onAction('retarget', target);
    }, [onAction, target]);

    const handleCancel = useCallback(() => {
        onAction('cancel_targeting', target);
    }, [onAction, target]);

    // Memoize formatted dates to prevent recalculation
    const formattedDates = useMemo(() => ({
        checkIn: target.targetSwapDetails.checkIn.toLocaleDateString(),
        checkOut: target.targetSwapDetails.checkOut.toLocaleDateString(),
        created: target.createdAt.toLocaleDateString()
    }), [target.targetSwapDetails.checkIn, target.targetSwapDetails.checkOut, target.createdAt]);

    // Memoize action buttons to prevent unnecessary re-renders
    const actionButtons = useMemo(() => {
        if (target.status === 'accepted') {
            return (
                <div className={styles.successMessage}>
                    🎉 Your targeting proposal was accepted!
                </div>
            );
        }

        if (target.status === 'rejected') {
            return (
                <div className={styles.targetActions}>
                    <Button
                        variant="primary"
                        size="small"
                        onClick={handleRetarget}
                        disabled={isLoading}
                        loading={isLoading}
                    >
                        Find New Target
                    </Button>
                </div>
            );
        }

        if (target.status === 'active') {
            return (
                <div className={styles.targetActions}>
                    <Button
                        variant="outline"
                        size="small"
                        onClick={handleCancel}
                        disabled={isLoading}
                        loading={isLoading}
                    >
                        Cancel Targeting
                    </Button>
                    <Button
                        variant="secondary"
                        size="small"
                        onClick={handleRetarget}
                        disabled={isLoading}
                        loading={isLoading}
                    >
                        Retarget
                    </Button>
                </div>
            );
        }

        return null;
    }, [target.status, handleRetarget, handleCancel, isLoading]);

    return (
        <div className={styles.targetItem}>
            <div
                className={styles.targetHeader}
                onClick={handleToggle}
                role="button"
                tabIndex={0}
            >
                <div className={styles.userInfo}>
                    <div className={`${styles.avatar} ${styles.outgoing}`}>
                        {target.targetSwapDetails.ownerAvatar ? (
                            <img
                                src={target.targetSwapDetails.ownerAvatar}
                                alt={target.targetSwapDetails.ownerName}
                                style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
                            />
                        ) : (
                            target.targetSwapDetails.ownerName.charAt(0).toUpperCase()
                        )}
                    </div>
                    <div>
                        <div style={{
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[900],
                        }}>
                            {target.targetSwapDetails.ownerName}
                        </div>
                        <div style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                        }}>
                            {target.targetSwapDetails.bookingTitle}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                    <Badge
                        variant={getStatusBadgeVariant(target.status)}
                        size="small"
                    >
                        <span>{target.statusIcon}</span>
                        <span style={{ marginLeft: tokens.spacing[1] }}>
                            {target.status.charAt(0).toUpperCase() + target.status.slice(1)}
                        </span>
                    </Badge>
                    <span style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[500],
                    }}>
                        {isExpanded ? '▼' : '▶'}
                    </span>
                </div>
            </div>

            {isExpanded && (
                <>
                    <div className={styles.targetDetails}>
                        <div className={styles.detailRow}>
                            <span>Location:</span>
                            <span className={styles.value}>
                                {target.targetSwapDetails.bookingLocation}
                            </span>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Check-in:</span>
                            <span className={styles.value}>
                                {formattedDates.checkIn}
                            </span>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Check-out:</span>
                            <span className={styles.value}>
                                {formattedDates.checkOut}
                            </span>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Price:</span>
                            <span className={styles.value}>
                                ${target.targetSwapDetails.price}
                            </span>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Targeted:</span>
                            <span className={styles.value}>
                                {formattedDates.created}
                            </span>
                        </div>
                    </div>

                    {target.actionable && actionButtons}
                </>
            )}
        </div>
    );
});

// Add display names for debugging
OutgoingTargetDisplay.displayName = 'OutgoingTargetDisplay';
OutgoingTargetItem.displayName = 'OutgoingTargetItem';

export default OutgoingTargetDisplay;