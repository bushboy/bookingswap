import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { tokens } from '@/design-system/tokens';
import { useResponsive } from '@/hooks/useResponsive';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';
import {
    SwapTarget,
    SwapWithTargeting,
    SwapTargetStatus,
} from '@booking-swap/shared';
import {
    selectCurrentTarget,
    selectSwapsTargetingMe,
    selectTargetingLoading,
    selectTargetingError,
} from '@/store/slices/targetingSlice';
import {
    fetchCurrentTarget,
    fetchSwapsTargetingMe,
} from '@/store/thunks/targetingThunks';

interface TargetingStatusDisplayProps {
    userSwap: SwapWithTargeting;
    className?: string;
    style?: React.CSSProperties;
    showIncomingTargets?: boolean;
}

interface CurrentTargetStatusProps {
    currentTarget: SwapTarget | null;
    isLoading: boolean;
}

interface IncomingTargetsProps {
    swapsTargetingMe: SwapTarget[];
    isLoading: boolean;
    onRefresh: () => void;
}

interface TargetStatusBadgeProps {
    status: SwapTargetStatus;
    size?: 'sm' | 'md' | 'lg';
}

// Target Status Badge Component
const TargetStatusBadge: React.FC<TargetStatusBadgeProps> = ({
    status,
    size = 'md',
}) => {
    const getStatusConfig = (status: SwapTargetStatus) => {
        switch (status) {
            case 'active':
                return {
                    color: tokens.colors.success[600],
                    backgroundColor: tokens.colors.success[50],
                    borderColor: tokens.colors.success[200],
                    label: 'Active',
                    icon: '🎯',
                };
            case 'cancelled':
                return {
                    color: tokens.colors.neutral[600],
                    backgroundColor: tokens.colors.neutral[50],
                    borderColor: tokens.colors.neutral[200],
                    label: 'Cancelled',
                    icon: '⏹️',
                };
            case 'accepted':
                return {
                    color: tokens.colors.success[700],
                    backgroundColor: tokens.colors.success[100],
                    borderColor: tokens.colors.success[300],
                    label: 'Accepted',
                    icon: '✅',
                };
            case 'rejected':
                return {
                    color: tokens.colors.error[600],
                    backgroundColor: tokens.colors.error[50],
                    borderColor: tokens.colors.error[200],
                    label: 'Rejected',
                    icon: '❌',
                };
            default:
                return {
                    color: tokens.colors.neutral[600],
                    backgroundColor: tokens.colors.neutral[50],
                    borderColor: tokens.colors.neutral[200],
                    label: status,
                    icon: '📝',
                };
        }
    };

    const sizeConfig = {
        sm: {
            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
            fontSize: tokens.typography.fontSize.xs,
            iconSize: '10px',
        },
        md: {
            padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
            fontSize: tokens.typography.fontSize.sm,
            iconSize: '12px',
        },
        lg: {
            padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
            fontSize: tokens.typography.fontSize.base,
            iconSize: '14px',
        },
    };

    const statusConfig = getStatusConfig(status);
    const sizeStyles = sizeConfig[size];

    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: tokens.spacing[1],
                padding: sizeStyles.padding,
                backgroundColor: statusConfig.backgroundColor,
                color: statusConfig.color,
                border: `1px solid ${statusConfig.borderColor}`,
                borderRadius: tokens.borderRadius.full,
                fontSize: sizeStyles.fontSize,
                fontWeight: tokens.typography.fontWeight.medium,
            }}
        >
            <span style={{ fontSize: sizeStyles.iconSize }}>
                {statusConfig.icon}
            </span>
            {statusConfig.label}
        </div>
    );
};

// Current Target Status Component
const CurrentTargetStatus: React.FC<CurrentTargetStatusProps> = ({
    currentTarget,
    isLoading,
}) => {
    const { isMobile } = useResponsive();

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                <LoadingSpinner size="sm" />
                <span style={{ color: tokens.colors.neutral[600] }}>
                    Loading current target...
                </span>
            </div>
        );
    }

    if (!currentTarget) {
        return (
            <Alert variant="info">
                <AlertDescription>
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                        <span>🎯</span>
                        <span>Your swap is available for general targeting</span>
                    </div>
                </AlertDescription>
            </Alert>
        );
    }

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div
            style={{
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.neutral[50],
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${tokens.colors.neutral[200]}`,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: tokens.spacing[3],
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? tokens.spacing[2] : 0,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.neutral[900],
                            marginBottom: tokens.spacing[1],
                        }}
                    >
                        Currently Targeting
                    </div>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.primary[600],
                            fontWeight: tokens.typography.fontWeight.medium,
                        }}
                    >
                        Swap #{currentTarget.targetSwapId.slice(-8)}
                    </div>
                </div>

                <TargetStatusBadge status={currentTarget.status} />
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                    gap: tokens.spacing[3],
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[600],
                }}
            >
                <div>
                    <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                        Targeted:
                    </span>{' '}
                    {formatDate(currentTarget.createdAt)}
                </div>

                {currentTarget.updatedAt !== currentTarget.createdAt && (
                    <div>
                        <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                            Updated:
                        </span>{' '}
                        {formatDate(currentTarget.updatedAt)}
                    </div>
                )}

                {currentTarget.proposalId && (
                    <div style={{ gridColumn: isMobile ? '1' : '1 / -1' }}>
                        <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                            Proposal ID:
                        </span>{' '}
                        {currentTarget.proposalId.slice(-8)}
                    </div>
                )}
            </div>
        </div>
    );
};

// Incoming Targets Component
const IncomingTargets: React.FC<IncomingTargetsProps> = ({
    swapsTargetingMe,
    isLoading,
    onRefresh,
}) => {
    const { isMobile } = useResponsive();
    const [showAll, setShowAll] = useState(false);

    const activeTargets = swapsTargetingMe.filter(target => target.status === 'active');
    const completedTargets = swapsTargetingMe.filter(target =>
        ['accepted', 'rejected', 'cancelled'].includes(target.status)
    );

    const displayedTargets = showAll ? swapsTargetingMe : swapsTargetingMe.slice(0, 5);

    if (isLoading && swapsTargetingMe.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: tokens.spacing[4] }}>
                <LoadingSpinner size="md" />
                <div style={{ marginTop: tokens.spacing[2], color: tokens.colors.neutral[600] }}>
                    Loading incoming targets...
                </div>
            </div>
        );
    }

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: tokens.spacing[4],
                }}
            >
                <div>
                    <h4
                        style={{
                            margin: 0,
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.neutral[900],
                        }}
                    >
                        Incoming Targets
                    </h4>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                            marginTop: tokens.spacing[1],
                        }}
                    >
                        {activeTargets.length} active • {completedTargets.length} completed
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    loading={isLoading}
                >
                    Refresh
                </Button>
            </div>

            {swapsTargetingMe.length === 0 ? (
                <Alert variant="info">
                    <AlertDescription>
                        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                            <span>📭</span>
                            <span>No swaps are currently targeting you</span>
                        </div>
                    </AlertDescription>
                </Alert>
            ) : (
                <div>
                    <div
                        style={{
                            border: `1px solid ${tokens.colors.neutral[200]}`,
                            borderRadius: tokens.borderRadius.md,
                            overflow: 'hidden',
                        }}
                    >
                        {displayedTargets.map((target, index) => (
                            <div
                                key={target.id}
                                style={{
                                    padding: tokens.spacing[4],
                                    borderBottom: index < displayedTargets.length - 1
                                        ? `1px solid ${tokens.colors.neutral[200]}`
                                        : 'none',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: tokens.spacing[2],
                                        flexDirection: isMobile ? 'column' : 'row',
                                        gap: isMobile ? tokens.spacing[2] : 0,
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                fontSize: tokens.typography.fontSize.base,
                                                fontWeight: tokens.typography.fontWeight.medium,
                                                color: tokens.colors.neutral[900],
                                                marginBottom: tokens.spacing[1],
                                            }}
                                        >
                                            Swap #{target.sourceSwapId.slice(-8)}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: tokens.typography.fontSize.sm,
                                                color: tokens.colors.neutral[600],
                                            }}
                                        >
                                            Targeted {new Date(target.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <TargetStatusBadge status={target.status} size="sm" />
                                </div>

                                {target.proposalId && (
                                    <div
                                        style={{
                                            fontSize: tokens.typography.fontSize.xs,
                                            color: tokens.colors.neutral[500],
                                        }}
                                    >
                                        Proposal: {target.proposalId.slice(-8)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {swapsTargetingMe.length > 5 && (
                        <div style={{ textAlign: 'center', marginTop: tokens.spacing[3] }}>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowAll(!showAll)}
                            >
                                {showAll
                                    ? 'Show Less'
                                    : `Show All (${swapsTargetingMe.length} total)`
                                }
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Main Targeting Status Display Component
export const TargetingStatusDisplay: React.FC<TargetingStatusDisplayProps> = ({
    userSwap,
    className,
    style,
    showIncomingTargets = true,
}) => {
    const dispatch = useDispatch();

    // Redux state
    const currentTarget = useSelector(selectCurrentTarget);
    const swapsTargetingMe = useSelector(selectSwapsTargetingMe);
    const isLoading = useSelector(selectTargetingLoading);
    const error = useSelector(selectTargetingError);

    // Local state
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch data on mount
    useEffect(() => {
        dispatch(fetchCurrentTarget({ swapId: userSwap.id }) as any);
        if (showIncomingTargets) {
            dispatch(fetchSwapsTargetingMe({}) as any);
        }
    }, [dispatch, userSwap.id, showIncomingTargets]);

    // Handle refresh
    const handleRefreshIncoming = async () => {
        setIsRefreshing(true);
        try {
            await dispatch(fetchSwapsTargetingMe({}) as any).unwrap();
        } catch (error) {
            console.error('Failed to refresh incoming targets:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <Card variant="outlined" className={className} style={style}>
            <CardHeader>
                <CardTitle>Targeting Status</CardTitle>
                <CardDescription>
                    Current targeting status and incoming proposals
                </CardDescription>
            </CardHeader>

            <CardContent>
                {error && (
                    <Alert variant="error" style={{ marginBottom: tokens.spacing[4] }}>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <div style={{ marginBottom: showIncomingTargets ? tokens.spacing[6] : 0 }}>
                    <CurrentTargetStatus
                        currentTarget={currentTarget}
                        isLoading={isLoading}
                    />
                </div>

                {showIncomingTargets && (
                    <IncomingTargets
                        swapsTargetingMe={swapsTargetingMe}
                        isLoading={isRefreshing}
                        onRefresh={handleRefreshIncoming}
                    />
                )}
            </CardContent>
        </Card>
    );
};

export default TargetingStatusDisplay;