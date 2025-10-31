import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { tokens } from '@/design-system/tokens';
import { useResponsive } from '@/hooks/useResponsive';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';
import {
    TargetingHistory as TargetingHistoryType,
    TargetingAction,
} from '@booking-swap/shared';
import {
    selectTargetingHistory,
    selectTargetingLoading,
    selectTargetingError,
} from '@/store/slices/targetingSlice';
import {
    fetchTargetingHistory,
} from '@/store/thunks/targetingThunks';

interface TargetingHistoryProps {
    swapId: string;
    className?: string;
    style?: React.CSSProperties;
    maxItems?: number;
    showTitle?: boolean;
}

interface TargetingHistoryItemProps {
    historyItem: TargetingHistoryType;
    isExpanded: boolean;
    onToggleExpand: () => void;
}

interface TargetingTimelineProps {
    history: TargetingHistoryType[];
    maxItems?: number;
}

// Targeting History Item Component
const TargetingHistoryItem: React.FC<TargetingHistoryItemProps> = ({
    historyItem,
    isExpanded,
    onToggleExpand,
}) => {
    const { isMobile } = useResponsive();

    const getActionIcon = (action: TargetingAction) => {
        switch (action) {
            case 'targeted':
                return '🎯';
            case 'retargeted':
                return '🔄';
            case 'removed':
                return '❌';
            case 'accepted':
                return '✅';
            case 'rejected':
                return '❌';
            case 'cancelled':
                return '⏹️';
            default:
                return '📝';
        }
    };

    const getActionColor = (action: TargetingAction) => {
        switch (action) {
            case 'targeted':
                return tokens.colors.primary[600];
            case 'retargeted':
                return tokens.colors.warning[600];
            case 'removed':
            case 'cancelled':
                return tokens.colors.neutral[500];
            case 'accepted':
                return tokens.colors.success[600];
            case 'rejected':
                return tokens.colors.error[600];
            default:
                return tokens.colors.neutral[600];
        }
    };

    const getActionLabel = (action: TargetingAction) => {
        switch (action) {
            case 'targeted':
                return 'Targeted';
            case 'retargeted':
                return 'Retargeted';
            case 'removed':
                return 'Target Removed';
            case 'accepted':
                return 'Proposal Accepted';
            case 'rejected':
                return 'Proposal Rejected';
            case 'cancelled':
                return 'Cancelled';
            default:
                return String(action).charAt(0).toUpperCase() + String(action).slice(1);
        }
    };

    const formatTimestamp = (timestamp: Date) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffHours / 24;

        if (diffHours < 1) {
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            const hours = Math.floor(diffHours);
            return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            const days = Math.floor(diffDays);
            return `${days} day${days !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                gap: tokens.spacing[3],
                padding: tokens.spacing[4],
                borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
                // Last child styling handled by conditional border
            }}
        >
            {/* Timeline indicator */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flexShrink: 0,
                }}
            >
                <div
                    style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: getActionColor(historyItem.action),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        color: 'white',
                    }}
                >
                    {getActionIcon(historyItem.action)}
                </div>
                <div
                    style={{
                        width: '2px',
                        height: '20px',
                        backgroundColor: tokens.colors.neutral[200],
                        marginTop: tokens.spacing[2],
                    }}
                />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: tokens.spacing[2],
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: isMobile ? tokens.spacing[1] : 0,
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
                            {getActionLabel(historyItem.action)}
                        </div>
                        {historyItem.targetSwapId && (
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                }}
                            >
                                Target: Swap #{historyItem.targetSwapId.slice(-8)}
                            </div>
                        )}
                    </div>

                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[500],
                            textAlign: isMobile ? 'left' : 'right',
                        }}
                    >
                        {formatTimestamp(historyItem.timestamp)}
                    </div>
                </div>

                {/* Expandable details */}
                {historyItem.metadata && Object.keys(historyItem.metadata).length > 0 && (
                    <div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onToggleExpand}
                            style={{
                                padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.primary[600],
                            }}
                        >
                            {isExpanded ? 'Hide Details' : 'Show Details'}
                        </Button>

                        {isExpanded && (
                            <div
                                style={{
                                    marginTop: tokens.spacing[2],
                                    padding: tokens.spacing[3],
                                    backgroundColor: tokens.colors.neutral[50],
                                    borderRadius: tokens.borderRadius.md,
                                    border: `1px solid ${tokens.colors.neutral[200]}`,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        fontWeight: tokens.typography.fontWeight.medium,
                                        color: tokens.colors.neutral[700],
                                        marginBottom: tokens.spacing[2],
                                    }}
                                >
                                    Details:
                                </div>
                                <pre
                                    style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.neutral[600],
                                        margin: 0,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                    }}
                                >
                                    {JSON.stringify(historyItem.metadata, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Targeting Timeline Component
const TargetingTimeline: React.FC<TargetingTimelineProps> = ({
    history,
    maxItems,
}) => {
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [showAll, setShowAll] = useState(false);

    const displayedHistory = maxItems && !showAll
        ? history.slice(0, maxItems)
        : history;

    const handleToggleExpand = (itemId: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(itemId)) {
            newExpanded.delete(itemId);
        } else {
            newExpanded.add(itemId);
        }
        setExpandedItems(newExpanded);
    };

    if (history.length === 0) {
        return (
            <div
                style={{
                    textAlign: 'center',
                    padding: tokens.spacing[8],
                    color: tokens.colors.neutral[600],
                }}
            >
                <div style={{ marginBottom: tokens.spacing[2] }}>
                    No targeting history yet
                </div>
                <div style={{ fontSize: tokens.typography.fontSize.sm }}>
                    Your targeting activities will appear here
                </div>
            </div>
        );
    }

    return (
        <div>
            <div
                style={{
                    border: `1px solid ${tokens.colors.neutral[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    overflow: 'hidden',
                }}
            >
                {displayedHistory.map((item) => (
                    <TargetingHistoryItem
                        key={item.id}
                        historyItem={item}
                        isExpanded={expandedItems.has(item.id)}
                        onToggleExpand={() => handleToggleExpand(item.id)}
                    />
                ))}
            </div>

            {maxItems && history.length > maxItems && (
                <div style={{ textAlign: 'center', marginTop: tokens.spacing[4] }}>
                    <Button
                        variant="outline"
                        onClick={() => setShowAll(!showAll)}
                    >
                        {showAll
                            ? `Show Less (${maxItems} items)`
                            : `Show All (${history.length} items)`
                        }
                    </Button>
                </div>
            )}
        </div>
    );
};

// Activity Summary Component
interface ActivitySummaryProps {
    history: TargetingHistoryType[];
}

const ActivitySummary: React.FC<ActivitySummaryProps> = ({ history }) => {
    const { isMobile } = useResponsive();

    const stats = React.useMemo(() => {
        const totalActions = history.length;
        const targetingActions = history.filter(h => h.action === 'targeted').length;
        const retargetingActions = history.filter(h => h.action === 'retargeted').length;
        const acceptedActions = history.filter(h => h.action === 'accepted').length;
        const rejectedActions = history.filter(h => h.action === 'rejected').length;

        const successRate = totalActions > 0
            ? ((acceptedActions / (acceptedActions + rejectedActions)) * 100) || 0
            : 0;

        return {
            totalActions,
            targetingActions,
            retargetingActions,
            acceptedActions,
            rejectedActions,
            successRate,
        };
    }, [history]);

    const statItems = [
        { label: 'Total Actions', value: stats.totalActions, color: tokens.colors.neutral[600] },
        { label: 'Targeting Attempts', value: stats.targetingActions, color: tokens.colors.primary[600] },
        { label: 'Retargeting', value: stats.retargetingActions, color: tokens.colors.warning[600] },
        { label: 'Accepted', value: stats.acceptedActions, color: tokens.colors.success[600] },
        { label: 'Success Rate', value: `${Math.round(stats.successRate)}%`, color: tokens.colors.success[600] },
    ];

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
                gap: tokens.spacing[4],
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.neutral[50],
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${tokens.colors.neutral[200]}`,
                marginBottom: tokens.spacing[4],
            }}
        >
            {statItems.map((item, index) => (
                <div key={index} style={{ textAlign: 'center' }}>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.xl,
                            fontWeight: tokens.typography.fontWeight.bold,
                            color: item.color,
                            marginBottom: tokens.spacing[1],
                        }}
                    >
                        {item.value}
                    </div>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.neutral[600],
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}
                    >
                        {item.label}
                    </div>
                </div>
            ))}
        </div>
    );
};

// Main Targeting History Component
export const TargetingHistory: React.FC<TargetingHistoryProps> = ({
    swapId,
    className,
    style,
    maxItems = 10,
    showTitle = true,
}) => {
    const dispatch = useDispatch();

    // Redux state
    const history = useSelector(selectTargetingHistory);
    const isLoading = useSelector(selectTargetingLoading);
    const error = useSelector(selectTargetingError);

    // Local state
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch history on mount
    useEffect(() => {
        dispatch(fetchTargetingHistory({ swapId }) as any);
    }, [dispatch, swapId]);

    // Handle refresh
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await dispatch(fetchTargetingHistory({ swapId }) as any).unwrap();
        } catch (error) {
            console.error('Failed to refresh targeting history:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    if (isLoading && history.length === 0) {
        return (
            <Card variant="outlined" className={className} style={style}>
                {showTitle && (
                    <CardHeader>
                        <CardTitle>Targeting History</CardTitle>
                        <CardDescription>
                            Track your swap targeting activities and outcomes
                        </CardDescription>
                    </CardHeader>
                )}
                <CardContent>
                    <div style={{ textAlign: 'center', padding: tokens.spacing[6] }}>
                        <LoadingSpinner size="lg" />
                        <div style={{ marginTop: tokens.spacing[4], color: tokens.colors.neutral[600] }}>
                            Loading targeting history...
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card variant="outlined" className={className} style={style}>
            {showTitle && (
                <CardHeader>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <CardTitle>Targeting History</CardTitle>
                            <CardDescription>
                                Track your swap targeting activities and outcomes
                            </CardDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRefresh}
                            loading={isRefreshing}
                            disabled={isLoading}
                        >
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
            )}

            <CardContent>
                {error && (
                    <Alert variant="error" style={{ marginBottom: tokens.spacing[4] }}>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {history.length > 0 && (
                    <ActivitySummary history={history} />
                )}

                <TargetingTimeline
                    history={history}
                    maxItems={maxItems}
                />
            </CardContent>
        </Card>
    );
};

export default TargetingHistory;