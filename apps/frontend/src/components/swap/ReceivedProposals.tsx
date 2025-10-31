import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useId, useAnnouncements, useHighContrast } from '../../hooks/useAccessibility';
import { IncomingTargetInfo } from '@booking-swap/shared';
import { ProposalActionButtons } from './ProposalActionButtons';
import { ProposalStatusIndicator } from './ProposalStatusIndicator';
import { getButtonAria, getFocusVisibleStyles, getHighContrastStyles } from '../../utils/accessibility';

interface ReceivedProposalsProps {
    /** List of received proposals */
    proposals: IncomingTargetInfo[];

    /** Callback when a proposal is accepted */
    onAcceptProposal: (proposalId: string) => Promise<void> | void;

    /** Callback when a proposal is rejected */
    onRejectProposal: (proposalId: string) => Promise<void> | void;

    /** Whether any proposal action is currently processing */
    isProcessing?: boolean;

    /** Current user ID for authorization checks */
    currentUserId?: string;

    /** Whether to show action buttons */
    showActions?: boolean;

    /** Maximum number of proposals to show initially */
    initialDisplayCount?: number;

    /** Custom filter function */
    filterFunction?: (proposal: IncomingTargetInfo) => boolean;

    /** Custom sort function */
    sortFunction?: (a: IncomingTargetInfo, b: IncomingTargetInfo) => number;
}

type ProposalFilter = 'all' | 'active' | 'accepted' | 'rejected' | 'expired';
type ProposalSort = 'newest' | 'oldest' | 'status' | 'value';

export const ReceivedProposals: React.FC<ReceivedProposalsProps> = ({
    proposals,
    onAcceptProposal,
    onRejectProposal,
    isProcessing = false,
    currentUserId,
    showActions = true,
    initialDisplayCount = 5,
    filterFunction,
    sortFunction,
}) => {
    const { isMobile } = useResponsive();
    const { announce } = useAnnouncements();
    const { isHighContrast } = useHighContrast();
    const componentId = useId('received-proposals');

    const [currentFilter, setCurrentFilter] = useState<ProposalFilter>('all');
    const [currentSort, setCurrentSort] = useState<ProposalSort>('newest');
    const [showAllProposals, setShowAllProposals] = useState(false);
    const [processingProposalId, setProcessingProposalId] = useState<string | null>(null);

    // Filter and sort proposals
    const filteredAndSortedProposals = useMemo(() => {
        let filtered = proposals;

        // Apply custom filter function if provided
        if (filterFunction) {
            filtered = filtered.filter(filterFunction);
        } else {
            // Apply built-in filter
            switch (currentFilter) {
                case 'active':
                    filtered = filtered.filter(p => p.status === 'active');
                    break;
                case 'accepted':
                    filtered = filtered.filter(p => p.status === 'accepted');
                    break;
                case 'rejected':
                    filtered = filtered.filter(p => p.status === 'rejected');
                    break;
                case 'expired':
                    filtered = filtered.filter(p => p.status === 'expired');
                    break;
                case 'all':
                default:
                    // Show all proposals
                    break;
            }
        }

        // Apply custom sort function if provided
        if (sortFunction) {
            filtered = [...filtered].sort(sortFunction);
        } else {
            // Apply built-in sort
            switch (currentSort) {
                case 'oldest':
                    filtered = [...filtered].sort((a, b) =>
                        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    );
                    break;
                case 'status':
                    filtered = [...filtered].sort((a, b) => {
                        const statusOrder = { 'active': 0, 'accepted': 1, 'rejected': 2, 'expired': 3 };
                        return (statusOrder[a.status as keyof typeof statusOrder] || 4) -
                            (statusOrder[b.status as keyof typeof statusOrder] || 4);
                    });
                    break;
                case 'value':
                    filtered = [...filtered].sort((a, b) =>
                        (b.sourceSwap.bookingDetails.swapValue || 0) -
                        (a.sourceSwap.bookingDetails.swapValue || 0)
                    );
                    break;
                case 'newest':
                default:
                    filtered = [...filtered].sort((a, b) =>
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    );
                    break;
            }
        }

        return filtered;
    }, [proposals, currentFilter, currentSort, filterFunction, sortFunction]);

    // Determine visible proposals
    const visibleProposals = showAllProposals
        ? filteredAndSortedProposals
        : filteredAndSortedProposals.slice(0, initialDisplayCount);

    const hasMoreProposals = filteredAndSortedProposals.length > initialDisplayCount;

    // Statistics
    const stats = useMemo(() => {
        const activeCount = proposals.filter(p => p.status === 'active').length;
        const acceptedCount = proposals.filter(p => p.status === 'accepted').length;
        const rejectedCount = proposals.filter(p => p.status === 'rejected').length;
        const expiredCount = proposals.filter(p => p.status === 'expired').length;

        return {
            total: proposals.length,
            active: activeCount,
            accepted: acceptedCount,
            rejected: rejectedCount,
            expired: expiredCount,
        };
    }, [proposals]);

    const handleAcceptProposal = async (proposalId: string) => {
        if (isProcessing || processingProposalId) return;

        setProcessingProposalId(proposalId);
        try {
            await onAcceptProposal(proposalId);
            announce('Proposal accepted successfully', 'polite');
        } catch (error) {
            console.error('Error accepting proposal:', error);
            announce('Failed to accept proposal', 'assertive');
        } finally {
            setProcessingProposalId(null);
        }
    };

    const handleRejectProposal = async (proposalId: string) => {
        if (isProcessing || processingProposalId) return;

        setProcessingProposalId(proposalId);
        try {
            await onRejectProposal(proposalId);
            announce('Proposal rejected successfully', 'polite');
        } catch (error) {
            console.error('Error rejecting proposal:', error);
            announce('Failed to reject proposal', 'assertive');
        } finally {
            setProcessingProposalId(null);
        }
    };

    const handleFilterChange = (filter: ProposalFilter) => {
        setCurrentFilter(filter);
        setShowAllProposals(false);
        announce(`Filtering proposals by ${filter}`, 'polite');
    };

    const handleSortChange = (sort: ProposalSort) => {
        setCurrentSort(sort);
        announce(`Sorting proposals by ${sort}`, 'polite');
    };

    const toggleShowAll = () => {
        setShowAllProposals(!showAllProposals);
        announce(
            showAllProposals ? 'Showing fewer proposals' : 'Showing all proposals',
            'polite'
        );
    };

    if (proposals.length === 0) {
        return (
            <Card
                variant="outlined"
                style={{
                    width: '100%',
                    ...(isHighContrast ? getHighContrastStyles() : {}),
                }}
            >
                <CardContent
                    style={{
                        padding: tokens.spacing[6],
                        textAlign: 'center',
                    }}
                >
                    <div
                        style={{
                            fontSize: '48px',
                            marginBottom: tokens.spacing[4],
                            opacity: 0.5,
                        }}
                    >
                        📥
                    </div>
                    <h3
                        style={{
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[700],
                            margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                    >
                        No Proposals Received
                    </h3>
                    <p
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.neutral[600],
                            margin: 0,
                        }}
                    >
                        You haven't received any swap proposals yet. When someone proposes a swap for your booking, it will appear here.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div
            id={componentId}
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[4],
            }}
        >
            {/* Header with Statistics */}
            <Card
                variant="outlined"
                style={{
                    ...(isHighContrast ? getHighContrastStyles() : {}),
                }}
            >
                <CardHeader
                    style={{
                        padding: tokens.spacing[4],
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: isMobile ? 'flex-start' : 'center',
                            flexDirection: isMobile ? 'column' : 'row',
                            gap: tokens.spacing[3],
                        }}
                    >
                        <div>
                            <h2
                                style={{
                                    fontSize: tokens.typography.fontSize.xl,
                                    fontWeight: tokens.typography.fontWeight.bold,
                                    color: tokens.colors.neutral[900],
                                    margin: `0 0 ${tokens.spacing[1]} 0`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: tokens.spacing[2],
                                }}
                            >
                                <span>📥</span>
                                Received Proposals
                            </h2>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                }}
                            >
                                {stats.active} active • {stats.total} total
                            </div>
                        </div>

                        {/* Statistics Summary */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                                gap: tokens.spacing[3],
                                fontSize: tokens.typography.fontSize.sm,
                                textAlign: 'center',
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.lg,
                                        fontWeight: tokens.typography.fontWeight.bold,
                                        color: tokens.colors.success[600],
                                    }}
                                >
                                    {stats.active}
                                </div>
                                <div style={{ color: tokens.colors.neutral[600] }}>Active</div>
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.lg,
                                        fontWeight: tokens.typography.fontWeight.bold,
                                        color: tokens.colors.primary[600],
                                    }}
                                >
                                    {stats.accepted}
                                </div>
                                <div style={{ color: tokens.colors.neutral[600] }}>Accepted</div>
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.lg,
                                        fontWeight: tokens.typography.fontWeight.bold,
                                        color: tokens.colors.error[600],
                                    }}
                                >
                                    {stats.rejected}
                                </div>
                                <div style={{ color: tokens.colors.neutral[600] }}>Rejected</div>
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.lg,
                                        fontWeight: tokens.typography.fontWeight.bold,
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    {stats.expired}
                                </div>
                                <div style={{ color: tokens.colors.neutral[600] }}>Expired</div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Filter and Sort Controls */}
            <Card
                variant="outlined"
                style={{
                    ...(isHighContrast ? getHighContrastStyles() : {}),
                }}
            >
                <CardContent
                    style={{
                        padding: tokens.spacing[4],
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: isMobile ? 'flex-start' : 'center',
                            flexDirection: isMobile ? 'column' : 'row',
                            gap: tokens.spacing[4],
                        }}
                    >
                        {/* Filter Buttons */}
                        <div
                            style={{
                                display: 'flex',
                                gap: tokens.spacing[2],
                                flexWrap: 'wrap',
                            }}
                        >
                            <span
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: tokens.colors.neutral[700],
                                    alignSelf: 'center',
                                }}
                            >
                                Filter:
                            </span>
                            {(['all', 'active', 'accepted', 'rejected', 'expired'] as ProposalFilter[]).map((filter) => (
                                <Button
                                    key={filter}
                                    variant={currentFilter === filter ? 'primary' : 'outline'}
                                    size="sm"
                                    onClick={() => handleFilterChange(filter)}
                                    {...getButtonAria(`Filter by ${filter} proposals`, false, false)}
                                >
                                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                    {filter !== 'all' && (
                                        <span style={{ marginLeft: tokens.spacing[1] }}>
                                            ({stats[filter as keyof typeof stats]})
                                        </span>
                                    )}
                                </Button>
                            ))}
                        </div>

                        {/* Sort Dropdown */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                            }}
                        >
                            <span
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: tokens.colors.neutral[700],
                                }}
                            >
                                Sort:
                            </span>
                            <select
                                value={currentSort}
                                onChange={(e) => handleSortChange(e.target.value as ProposalSort)}
                                style={{
                                    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                                    borderRadius: tokens.borderRadius.md,
                                    border: `1px solid ${tokens.colors.neutral[300]}`,
                                    fontSize: tokens.typography.fontSize.sm,
                                    backgroundColor: 'white',
                                    color: tokens.colors.neutral[900],
                                }}
                                aria-label="Sort proposals"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="status">By Status</option>
                                <option value="value">By Value</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Proposals List */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: tokens.spacing[4],
                }}
                role="list"
                aria-label={`Received proposals - ${filteredAndSortedProposals.length} proposals`}
            >
                {visibleProposals.map((proposal) => (
                    <ProposalItem
                        key={proposal.proposalId}
                        proposal={proposal}
                        onAccept={handleAcceptProposal}
                        onReject={handleRejectProposal}
                        isProcessing={isProcessing || processingProposalId === proposal.proposalId}
                        showActions={showActions && proposal.status === 'active'}
                        currentUserId={currentUserId}
                    />
                ))}
            </div>

            {/* Show More/Less Button */}
            {hasMoreProposals && (
                <div
                    style={{
                        textAlign: 'center',
                        padding: tokens.spacing[2],
                    }}
                >
                    <Button
                        variant="outline"
                        size="md"
                        onClick={toggleShowAll}
                        {...getButtonAria(
                            showAllProposals
                                ? 'Show fewer proposals'
                                : `Show all ${filteredAndSortedProposals.length} proposals`,
                            false,
                            false
                        )}
                    >
                        {showAllProposals ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                <span>▲</span>
                                Show Less
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                <span>▼</span>
                                Show All ({filteredAndSortedProposals.length})
                            </div>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
};

// Individual Proposal Item Component
interface ProposalItemProps {
    proposal: IncomingTargetInfo;
    onAccept: (proposalId: string) => Promise<void> | void;
    onReject: (proposalId: string) => Promise<void> | void;
    isProcessing: boolean;
    showActions: boolean;
    currentUserId?: string;
}

const ProposalItem: React.FC<ProposalItemProps> = ({
    proposal,
    onAccept,
    onReject,
    isProcessing,
    showActions,
    currentUserId,
}) => {
    const { isMobile } = useResponsive();
    const { isHighContrast } = useHighContrast();

    const formatDate = (date: Date): string => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatCurrency = (amount: number | null, currency = 'USD'): string => {
        if (amount === null || amount === undefined) return 'N/A';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
        }).format(amount);
    };

    return (
        <Card
            variant="outlined"
            style={{
                border: `2px solid ${proposal.status === 'active'
                        ? tokens.colors.success[200]
                        : tokens.colors.neutral[200]
                    }`,
                backgroundColor: proposal.status === 'active'
                    ? tokens.colors.success[25]
                    : 'white',
                ...(isHighContrast ? getHighContrastStyles() : {}),
            }}
            role="listitem"
        >
            <CardContent
                style={{
                    padding: tokens.spacing[4],
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: tokens.spacing[3],
                        marginBottom: tokens.spacing[4],
                    }}
                >
                    {/* Proposer Info */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[3],
                        }}
                    >
                        <div
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                backgroundColor: tokens.colors.primary[100],
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: tokens.typography.fontSize.lg,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.primary[700],
                                border: `2px solid ${tokens.colors.primary[200]}`,
                            }}
                        >
                            {proposal.sourceSwap.ownerAvatar ? (
                                <img
                                    src={proposal.sourceSwap.ownerAvatar}
                                    alt={`${proposal.sourceSwap.ownerName}'s avatar`}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                    }}
                                />
                            ) : (
                                proposal.sourceSwap.ownerName.charAt(0).toUpperCase()
                            )}
                        </div>

                        <div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.base,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[900],
                                    marginBottom: tokens.spacing[1],
                                }}
                            >
                                {proposal.sourceSwap.ownerName}
                            </div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                }}
                            >
                                {proposal.sourceSwap.bookingDetails.title}
                            </div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    color: tokens.colors.neutral[500],
                                }}
                            >
                                📍 {proposal.sourceSwap.bookingDetails.location?.city}, {proposal.sourceSwap.bookingDetails.location?.country}
                            </div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    color: tokens.colors.neutral[500],
                                }}
                            >
                                Proposed {formatDate(proposal.createdAt)}
                            </div>
                        </div>
                    </div>

                    {/* Status and Value */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isMobile ? 'flex-start' : 'flex-end',
                            gap: tokens.spacing[2],
                        }}
                    >
                        <ProposalStatusIndicator
                            status={proposal.status as 'pending' | 'accepted' | 'rejected' | 'processing'}
                            size="sm"
                        />
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.lg,
                                fontWeight: tokens.typography.fontWeight.bold,
                                color: tokens.colors.primary[600],
                            }}
                        >
                            {formatCurrency(proposal.sourceSwap.bookingDetails.swapValue)}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                {showActions && (
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            paddingTop: tokens.spacing[3],
                            borderTop: `1px solid ${tokens.colors.neutral[200]}`,
                        }}
                    >
                        <ProposalActionButtons
                            proposalId={proposal.proposalId}
                            status={proposal.status as 'pending' | 'accepted' | 'rejected' | 'expired'}
                            onAccept={onAccept}
                            onReject={onReject}
                            isProcessing={isProcessing}
                            orientation={isMobile ? 'vertical' : 'horizontal'}
                            size="md"
                        />
                    </div>
                )}

                {/* Auction Info */}
                {proposal.auctionInfo?.isAuction && (
                    <div
                        style={{
                            marginTop: tokens.spacing[3],
                            padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                            backgroundColor: tokens.colors.warning[100],
                            borderRadius: tokens.borderRadius.md,
                            border: `1px solid ${tokens.colors.warning[300]}`,
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.warning[800],
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                        }}
                    >
                        <span>🏆</span>
                        <span>
                            Auction proposal • {proposal.auctionInfo.currentProposalCount} total proposals
                            {proposal.auctionInfo.endDate && (
                                <> • Ends {formatDate(proposal.auctionInfo.endDate)}</>
                            )}
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ReceivedProposals;