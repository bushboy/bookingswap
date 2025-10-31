import React, { useState, memo, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
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

export interface TargetingAction {
    type: 'accept_target' | 'reject_target' | 'retarget' | 'cancel_targeting' | 'view_details';
    targetId?: string;
    swapId: string;
    metadata?: Record<string, any>;
}

export interface IncomingTargetDisplayProps {
    targets: IncomingTargetDisplayData[];
    onAction: (action: TargetingAction) => void;
    className?: string;
    maxVisible?: number;
}

/**
 * Enhanced incoming target display component with performance optimizations
 * Shows detailed information about swaps targeting the current user's swap
 * Optimized with React.memo and proper dependency management
 * Requirements: 7.4, 7.5
 */
export const IncomingTargetDisplay: React.FC<IncomingTargetDisplayProps> = memo(({
    targets,
    onAction,
    className = '',
    maxVisible = 3,
}) => {
    const [expandedTargets, setExpandedTargets] = useState<Set<string>>(new Set());
    const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

    // Memoize computed values to prevent unnecessary re-renders
    const { visibleTargets, hasMore, targetCount } = useMemo(() => ({
        visibleTargets: targets.slice(0, maxVisible),
        hasMore: targets.length > maxVisible,
        targetCount: targets.length
    }), [targets, maxVisible]);

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
    const handleAction = useCallback(async (actionType: 'accept_target' | 'reject_target', target: IncomingTargetDisplayData) => {
        setActionLoading(prev => new Set([...prev, target.targetId]));

        try {
            await onAction({
                type: actionType,
                targetId: target.targetId,
                swapId: target.sourceSwapId,
                metadata: {
                    sourceSwapId: target.sourceSwapId,
                    targetSwapId: target.targetId,
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
            case 'active': return 'warning';
            case 'accepted': return 'success';
            case 'rejected': return 'error';
            case 'cancelled': return 'error';
            default: return 'info';
        }
    }, []);

    // Styles are now handled by CSS modules

    return (
        <div className={`incoming-target-display ${className}`}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                marginBottom: tokens.spacing[4],
            }}>
                <span style={{ fontSize: tokens.typography.fontSize.lg, fontWeight: tokens.typography.fontWeight.semibold }}>
                    📥 Incoming Targets
                </span>
                <Badge variant="info" size="small">
                    {targetCount}
                </Badge>
            </div>

            {visibleTargets.map((target) => (
                <IncomingTargetItem
                    key={target.targetId}
                    target={target}
                    isExpanded={expandedTargets.has(target.targetId)}
                    isLoading={actionLoading.has(target.targetId)}
                    onToggleExpanded={toggleExpanded}
                    onAction={handleAction}
                    getStatusBadgeVariant={getStatusBadgeVariant}
                />
            ))}

            {hasMore && (
                <div style={{
                    textAlign: 'center',
                    padding: tokens.spacing[3],
                    color: tokens.colors.neutral[600],
                    fontSize: tokens.typography.fontSize.sm,
                }}>
                    Showing {maxVisible} of {targetCount} targets
                </div>
            )}
        </div>
    );
});

/**
 * Memoized individual target item component for optimal rendering performance
 */
const IncomingTargetItem: React.FC<{
    target: IncomingTargetDisplayData;
    isExpanded: boolean;
    isLoading: boolean;
    onToggleExpanded: (targetId: string) => void;
    onAction: (actionType: 'accept_target' | 'reject_target', target: IncomingTargetDisplayData) => void;
    getStatusBadgeVariant: (status: string) => 'success' | 'warning' | 'error' | 'info';
}> = memo(({ target, isExpanded, isLoading, onToggleExpanded, onAction, getStatusBadgeVariant }) => {
    // Memoize click handlers
    const handleToggle = useCallback(() => {
        onToggleExpanded(target.targetId);
    }, [onToggleExpanded, target.targetId]);

    const handleAccept = useCallback(() => {
        onAction('accept_target', target);
    }, [onAction, target]);

    const handleReject = useCallback(() => {
        onAction('reject_target', target);
    }, [onAction, target]);

    // Memoize formatted dates to prevent recalculation
    const formattedDates = useMemo(() => ({
        checkIn: target.sourceSwapDetails.checkIn.toLocaleDateString(),
        checkOut: target.sourceSwapDetails.checkOut.toLocaleDateString(),
        created: target.createdAt.toLocaleDateString()
    }), [target.sourceSwapDetails.checkIn, target.sourceSwapDetails.checkOut, target.createdAt]);

    return (
        <div className={styles.targetItem}>
            <div
                className={styles.targetHeader}
                onClick={handleToggle}
                role="button"
                tabIndex={0}
            >
                <div className={styles.userInfo}>
                    <div className={`${styles.avatar} ${styles.incoming}`}>
                        {target.sourceSwapDetails.ownerAvatar ? (
                            <img
                                src={target.sourceSwapDetails.ownerAvatar}
                                alt={target.sourceSwapDetails.ownerName}
                                style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
                            />
                        ) : (
                            target.sourceSwapDetails.ownerName.charAt(0).toUpperCase()
                        )}
                    </div>
                    <div>
                        <div style={{
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[900],
                        }}>
                            {target.sourceSwapDetails.ownerName}
                        </div>
                        <div style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                        }}>
                            {target.sourceSwapDetails.bookingTitle}
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
                                {target.sourceSwapDetails.bookingLocation}
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
                                ${target.sourceSwapDetails.price}
                            </span>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Proposed:</span>
                            <span className={styles.value}>
                                {formattedDates.created}
                            </span>
                        </div>
                    </div>

                    {target.actionable && target.status === 'active' && (
                        <div className={styles.targetActions}>
                            <Button
                                variant="outline"
                                size="small"
                                onClick={handleReject}
                                disabled={isLoading}
                                loading={isLoading}
                            >
                                Reject
                            </Button>
                            <Button
                                variant="primary"
                                size="small"
                                onClick={handleAccept}
                                disabled={isLoading}
                                loading={isLoading}
                            >
                                Accept
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
});

// Add display names for debugging
IncomingTargetDisplay.displayName = 'IncomingTargetDisplay';
IncomingTargetItem.displayName = 'IncomingTargetItem';

export default IncomingTargetDisplay;