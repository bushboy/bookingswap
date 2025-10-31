import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { tokens } from '@/design-system/tokens';
import { TargetingHistory } from './TargetingHistory';
import { targetingHistoryService } from '@/services/targetingHistoryService';
import {
    TargetingHistoryResponse,
    TargetingHistoryFilters,
    TargetingHistorySorting,
    TargetingEvent
} from '@booking-swap/shared';
import { logger } from '@/utils/logger';

export interface TargetingHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    swapId?: string;
    swapTitle?: string;
    showUserHistory?: boolean; // If true, shows history for all user's swaps
    className?: string;
}

/**
 * Modal component for displaying targeting history
 * Can show history for a specific swap or all user swaps
 */
export const TargetingHistoryModal: React.FC<TargetingHistoryModalProps> = ({
    isOpen,
    onClose,
    swapId,
    swapTitle,
    showUserHistory = false,
    className = '',
}) => {
    // State management
    const [historyData, setHistoryData] = useState<TargetingHistoryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<TargetingHistoryFilters>({});
    const [sorting, setSorting] = useState<TargetingHistorySorting>({
        field: 'timestamp',
        direction: 'desc'
    });

    // Load targeting history when modal opens
    useEffect(() => {
        if (isOpen) {
            loadTargetingHistory();
        } else {
            // Reset state when modal closes
            setHistoryData(null);
            setError(null);
            setFilters({});
            setSorting({ field: 'timestamp', direction: 'desc' });
        }
    }, [isOpen, swapId, showUserHistory]);

    const loadTargetingHistory = async (isLoadMore = false) => {
        try {
            setIsLoading(true);
            setError(null);

            const options = {
                filters,
                sorting,
                pagination: {
                    page: isLoadMore && historyData ? historyData.pagination.page + 1 : 1,
                    limit: 50
                }
            };

            let newHistoryData: TargetingHistoryResponse;

            if (showUserHistory) {
                newHistoryData = await targetingHistoryService.getUserTargetingHistory(options);
            } else if (swapId) {
                newHistoryData = await targetingHistoryService.getSwapTargetingHistory(swapId, options);
            } else {
                throw new Error('Either swapId or showUserHistory must be provided');
            }

            if (isLoadMore && historyData) {
                // Merge with existing data for load more
                setHistoryData({
                    ...newHistoryData,
                    events: [...historyData.events, ...newHistoryData.events],
                    pagination: {
                        ...newHistoryData.pagination,
                        page: historyData.pagination.page // Keep original page for UI
                    }
                });
            } else {
                setHistoryData(newHistoryData);
            }

            logger.info('Loaded targeting history in modal', {
                swapId,
                showUserHistory,
                totalEvents: newHistoryData.pagination.total,
                isLoadMore
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load targeting history';
            setError(errorMessage);
            logger.error('Failed to load targeting history in modal', {
                error: err,
                swapId,
                showUserHistory
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFiltersChange = (newFilters: TargetingHistoryFilters) => {
        setFilters(newFilters);
        // Reload data with new filters
        setTimeout(() => loadTargetingHistory(), 100);
    };

    const handleSortingChange = (newSorting: TargetingHistorySorting) => {
        setSorting(newSorting);
        // Reload data with new sorting
        setTimeout(() => loadTargetingHistory(), 100);
    };

    const handleLoadMore = () => {
        if (historyData?.hasMore && !isLoading) {
            loadTargetingHistory(true);
        }
    };

    const handleRefresh = () => {
        targetingHistoryService.refreshTargetingHistory(swapId);
        loadTargetingHistory();
    };

    const getModalTitle = (): string => {
        if (showUserHistory) {
            return 'Your Targeting History';
        } else if (swapTitle) {
            return `Targeting History - ${swapTitle}`;
        } else {
            return 'Targeting History';
        }
    };

    const getModalDescription = (): string => {
        if (showUserHistory) {
            return 'View all targeting activities across your swaps';
        } else {
            return 'View all targeting activities for this swap';
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={getModalTitle()}
            size="large"
            className={`targeting-history-modal ${className}`}
        >
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '80vh',
                maxHeight: '800px'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: tokens.spacing[4],
                    borderBottom: `1px solid ${tokens.colors.gray[200]}`,
                    backgroundColor: tokens.colors.gray[50]
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: tokens.spacing[2]
                    }}>
                        <div>
                            <h2 style={{
                                margin: 0,
                                fontSize: '1.25rem',
                                fontWeight: 600,
                                color: tokens.colors.gray[900]
                            }}>
                                {getModalTitle()}
                            </h2>
                            <p style={{
                                margin: `${tokens.spacing[1]} 0 0`,
                                fontSize: '0.9rem',
                                color: tokens.colors.gray[600]
                            }}>
                                {getModalDescription()}
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
                            <Button
                                variant="outline"
                                size="small"
                                onClick={handleRefresh}
                                disabled={isLoading}
                                title="Refresh targeting history"
                            >
                                {isLoading ? (
                                    <Spinner size="small" />
                                ) : (
                                    '🔄'
                                )}
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    {historyData && (
                        <div style={{
                            display: 'flex',
                            gap: tokens.spacing[4],
                            fontSize: '0.9rem',
                            color: tokens.colors.gray[600]
                        }}>
                            <span>
                                <strong>{historyData.pagination.total || 0}</strong> total events
                            </span>
                            <span>
                                <strong>{historyData.events.length}</strong> shown
                            </span>
                            {historyData.hasMore && (
                                <span style={{ color: tokens.colors.blue[600] }}>
                                    More available
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Modal Content */}
                <div style={{
                    flex: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {error ? (
                        <div style={{
                            padding: tokens.spacing[6],
                            textAlign: 'center',
                            color: tokens.colors.red[600]
                        }}>
                            <p style={{ marginBottom: tokens.spacing[3] }}>
                                {error}
                            </p>
                            <Button
                                variant="outline"
                                onClick={() => loadTargetingHistory()}
                                disabled={isLoading}
                            >
                                Try Again
                            </Button>
                        </div>
                    ) : (
                        <TargetingHistory
                            swapId={swapId}
                            events={historyData?.events || []}
                            isLoading={isLoading}
                            error={error}
                            onLoadMore={handleLoadMore}
                            onFiltersChange={handleFiltersChange}
                            onSortingChange={handleSortingChange}
                            hasMore={historyData?.hasMore || false}
                            maxHeight="100%"
                            showFilters={true}
                            showSearch={true}
                            groupByDate={true}
                            expandableDetails={true}
                        />
                    )}
                </div>

                {/* Modal Footer */}
                <div style={{
                    padding: tokens.spacing[4],
                    borderTop: `1px solid ${tokens.colors.gray[200]}`,
                    backgroundColor: tokens.colors.gray[50],
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{
                        fontSize: '0.8rem',
                        color: tokens.colors.gray[500]
                    }}>
                        {historyData && (
                            <>
                                Page {historyData.pagination.page} of{' '}
                                {Math.ceil((historyData.pagination.total || 0) / historyData.pagination.limit)}
                            </>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
                        {historyData?.hasMore && (
                            <Button
                                variant="outline"
                                onClick={handleLoadMore}
                                disabled={isLoading}
                                size="small"
                            >
                                {isLoading ? (
                                    <>
                                        <Spinner size="small" style={{ marginRight: tokens.spacing[1] }} />
                                        Loading...
                                    </>
                                ) : (
                                    'Load More'
                                )}
                            </Button>
                        )}

                        <Button
                            variant="primary"
                            onClick={onClose}
                            size="small"
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default TargetingHistoryModal;