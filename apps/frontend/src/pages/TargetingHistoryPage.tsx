import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { tokens } from '@/design-system/tokens';
import { TargetingHistory } from '@/components/swap/targeting/TargetingHistory';
import { useTargetingHistory } from '@/hooks/useTargetingHistory';
import { useResponsive } from '@/hooks/useResponsive';
import { logger } from '@/utils/logger';

/**
 * Dedicated page for viewing comprehensive targeting history
 * Accessible from main navigation and swap management UI
 */
export const TargetingHistoryPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { isMobile } = useResponsive();

    // Get swap ID from URL params if viewing history for specific swap
    const swapId = searchParams.get('swapId') || undefined;
    const swapTitle = searchParams.get('swapTitle') || undefined;

    // State for view mode
    const [viewMode, setViewMode] = useState<'all' | 'specific'>(swapId ? 'specific' : 'all');

    // Use targeting history hook
    const {
        historyData,
        events,
        isLoading,
        error,
        loadHistory,
        loadMoreEvents,
        refreshHistory,
        filters,
        setFilters,
        sorting,
        setSorting,
        hasMore,
        totalEvents,
        stats,
        loadStats
    } = useTargetingHistory({
        swapId: viewMode === 'specific' ? swapId : undefined,
        autoLoad: true,
        initialSorting: { field: 'timestamp', direction: 'desc' }
    });

    // Load stats on mount
    useEffect(() => {
        loadStats();
    }, [loadStats, viewMode]);

    // Handle view mode change
    const handleViewModeChange = (newMode: 'all' | 'specific') => {
        setViewMode(newMode);

        if (newMode === 'all') {
            // Remove swap-specific params and reload for all swaps
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('swapId');
            newParams.delete('swapTitle');
            navigate(`/targeting-history?${newParams.toString()}`, { replace: true });
        }

        // The hook will automatically reload data when swapId changes
        setTimeout(() => {
            loadHistory({ resetData: true });
            loadStats();
        }, 100);
    };

    const getPageTitle = (): string => {
        if (viewMode === 'specific' && swapTitle) {
            return `Targeting History - ${swapTitle}`;
        } else if (viewMode === 'specific') {
            return 'Swap Targeting History';
        } else {
            return 'Your Targeting History';
        }
    };

    const getPageDescription = (): string => {
        if (viewMode === 'specific') {
            return 'View all targeting activities for this specific swap';
        } else {
            return 'View all targeting activities across your swaps';
        }
    };

    return (
        <div style={{
            padding: isMobile ? tokens.spacing[4] : tokens.spacing[6],
            maxWidth: '1200px',
            margin: '0 auto'
        }}>
            {/* Page Header */}
            <div style={{
                marginBottom: tokens.spacing[6],
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: tokens.spacing[4]
            }}>
                <div>
                    <h1 style={{
                        margin: 0,
                        fontSize: isMobile ? '1.5rem' : '2rem',
                        fontWeight: 700,
                        color: tokens.colors.gray[900],
                        marginBottom: tokens.spacing[2]
                    }}>
                        {getPageTitle()}
                    </h1>
                    <p style={{
                        margin: 0,
                        fontSize: '1rem',
                        color: tokens.colors.gray[600],
                        lineHeight: 1.5
                    }}>
                        {getPageDescription()}
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    gap: tokens.spacing[2],
                    flexWrap: 'wrap'
                }}>
                    <Button
                        variant="outline"
                        size="small"
                        onClick={() => navigate('/swaps')}
                    >
                        ← Back to Swaps
                    </Button>

                    <Button
                        variant="outline"
                        size="small"
                        onClick={refreshHistory}
                        disabled={isLoading}
                        title="Refresh targeting history"
                    >
                        {isLoading ? <Spinner size="small" /> : '🔄'}
                        Refresh
                    </Button>
                </div>
            </div>

            {/* View Mode Toggle */}
            <Card style={{ marginBottom: tokens.spacing[4] }}>
                <div style={{ padding: tokens.spacing[4] }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        gap: tokens.spacing[4]
                    }}>
                        <div>
                            <h3 style={{
                                margin: 0,
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                color: tokens.colors.gray[900],
                                marginBottom: tokens.spacing[1]
                            }}>
                                View Options
                            </h3>
                            <p style={{
                                margin: 0,
                                fontSize: '0.9rem',
                                color: tokens.colors.gray[600]
                            }}>
                                Choose what targeting history to display
                            </p>
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: tokens.spacing[2],
                            flexWrap: 'wrap'
                        }}>
                            <Button
                                variant={viewMode === 'all' ? 'primary' : 'outline'}
                                size="small"
                                onClick={() => handleViewModeChange('all')}
                            >
                                All My Swaps
                            </Button>

                            {swapId && (
                                <Button
                                    variant={viewMode === 'specific' ? 'primary' : 'outline'}
                                    size="small"
                                    onClick={() => handleViewModeChange('specific')}
                                >
                                    This Swap Only
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Statistics Summary */}
                    {stats && (
                        <div style={{
                            marginTop: tokens.spacing[4],
                            paddingTop: tokens.spacing[4],
                            borderTop: `1px solid ${tokens.colors.gray[200]}`,
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: tokens.spacing[4]
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{
                                    fontSize: '1.5rem',
                                    fontWeight: 700,
                                    color: tokens.colors.blue[600],
                                    marginBottom: tokens.spacing[1]
                                }}>
                                    {stats.totalEvents}
                                </div>
                                <div style={{
                                    fontSize: '0.9rem',
                                    color: tokens.colors.gray[600]
                                }}>
                                    Total Events
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{
                                    fontSize: '1.5rem',
                                    fontWeight: 700,
                                    color: tokens.colors.green[600],
                                    marginBottom: tokens.spacing[1]
                                }}>
                                    {Object.keys(stats.eventsByType).length}
                                </div>
                                <div style={{
                                    fontSize: '0.9rem',
                                    color: tokens.colors.gray[600]
                                }}>
                                    Event Types
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{
                                    fontSize: '1.5rem',
                                    fontWeight: 700,
                                    color: tokens.colors.purple[600],
                                    marginBottom: tokens.spacing[1]
                                }}>
                                    {stats.recentActivity.length}
                                </div>
                                <div style={{
                                    fontSize: '0.9rem',
                                    color: tokens.colors.gray[600]
                                }}>
                                    Recent Events
                                </div>
                            </div>

                            {/* Event type breakdown */}
                            <div style={{
                                gridColumn: isMobile ? '1' : '1 / -1',
                                marginTop: tokens.spacing[2]
                            }}>
                                <div style={{
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    color: tokens.colors.gray[700],
                                    marginBottom: tokens.spacing[2]
                                }}>
                                    Event Breakdown:
                                </div>
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: tokens.spacing[2]
                                }}>
                                    {Object.entries(stats.eventsByType).map(([type, count]) => (
                                        <Badge
                                            key={type}
                                            variant="outline"
                                            size="small"
                                        >
                                            {type.replace('_', ' ')}: {count}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Targeting History Component */}
            <Card>
                <TargetingHistory
                    swapId={viewMode === 'specific' ? swapId : undefined}
                    events={events}
                    isLoading={isLoading}
                    error={error}
                    onLoadMore={loadMoreEvents}
                    onFiltersChange={setFilters}
                    onSortingChange={setSorting}
                    hasMore={hasMore}
                    maxHeight="70vh"
                    showFilters={true}
                    showSearch={true}
                    groupByDate={true}
                    expandableDetails={true}
                />
            </Card>

            {/* Empty State */}
            {!isLoading && events.length === 0 && !error && (
                <Card style={{ marginTop: tokens.spacing[4] }}>
                    <div style={{
                        padding: tokens.spacing[8],
                        textAlign: 'center'
                    }}>
                        <div style={{
                            fontSize: '3rem',
                            marginBottom: tokens.spacing[4],
                            opacity: 0.6
                        }}>
                            📋
                        </div>
                        <h3 style={{
                            margin: 0,
                            fontSize: '1.2rem',
                            fontWeight: 600,
                            color: tokens.colors.gray[700],
                            marginBottom: tokens.spacing[2]
                        }}>
                            No Targeting History Yet
                        </h3>
                        <p style={{
                            margin: 0,
                            fontSize: '1rem',
                            color: tokens.colors.gray[600],
                            marginBottom: tokens.spacing[4],
                            maxWidth: '400px',
                            marginLeft: 'auto',
                            marginRight: 'auto'
                        }}>
                            {viewMode === 'specific'
                                ? 'This swap hasn\'t had any targeting activity yet. Start by targeting other swaps or wait for others to target yours.'
                                : 'You haven\'t had any targeting activity yet. Start by creating swaps and targeting others to see your history here.'
                            }
                        </p>
                        <Button
                            variant="primary"
                            onClick={() => navigate('/swaps')}
                        >
                            Go to My Swaps
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default TargetingHistoryPage;