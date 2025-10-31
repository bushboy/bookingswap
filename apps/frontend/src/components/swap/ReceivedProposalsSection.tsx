import React, { useState } from 'react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useId, useAnnouncements, useHighContrast } from '../../hooks/useAccessibility';
import { SwapProposalCard } from '@booking-swap/shared';
import { ProposalActionButtons } from './ProposalActionButtons';
import { ProposalStatusDisplay, ProposalStatusData } from './ProposalStatusDisplay';
import { getHighContrastStyles } from '../../utils/accessibility';
import { useAppSelector } from '../../store/hooks';
import { selectActiveOperations } from '../../store/selectors/proposalAcceptanceSelectors';

interface ReceivedProposalsSectionProps {
    proposals: SwapProposalCard[];
    onAcceptProposal: (proposalId: string) => Promise<void> | void;
    onRejectProposal: (proposalId: string, reason?: string) => Promise<void> | void;
    showInCard?: boolean;
    maxVisibleInCard?: number;
    /** Function to get status data for a proposal */
    getProposalStatusData?: (proposalId: string) => ProposalStatusData | undefined;
    /** Callback when retry is requested */
    onRetryProposal?: (proposalId: string) => void;
    /** Current user ID for permission diagnostics */
    currentUserId?: string;
    /** Parent swap ID for websocket/processing state */
    swapId?: string;
}

export const ReceivedProposalsSection: React.FC<ReceivedProposalsSectionProps> = ({
    proposals,
    onAcceptProposal,
    onRejectProposal,
    showInCard = true,
    maxVisibleInCard = 2,
    getProposalStatusData,
    onRetryProposal,
    currentUserId,
    swapId,
}) => {
    const { isMobile } = useResponsive();
    const { announce } = useAnnouncements();
    const { isHighContrast } = useHighContrast();
    const sectionId = useId('received-proposals-section');
    const [showAllProposals, setShowAllProposals] = useState(false);

    // Get Redux store loading states for individual proposals
    const activeOperations = useAppSelector(selectActiveOperations);

    // Filter and organize proposals
    const activeProposals = proposals.filter(p => p.status === 'pending');
    const inactiveProposals = proposals.filter(p => p.status !== 'pending');
    const totalProposals = proposals.length;
    const hasActiveProposals = activeProposals.length > 0;

    // Determine what to show in card view
    const cardViewProposals = showInCard
        ? activeProposals.slice(0, maxVisibleInCard)
        : [];
    const hasMoreProposals = activeProposals.length > maxVisibleInCard;

    const handleViewAllProposals = () => {
        setShowAllProposals(true);
        announce('Showing all proposals in detailed view', 'polite');
    };

    const handleBackToCard = () => {
        setShowAllProposals(false);
        announce('Returning to card view', 'polite');
    };

    const formatDate = (date: Date): string => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    // If no proposals exist, return null (handled by parent component)
    if (totalProposals === 0) {
        return null;
    }

    // Full detailed view
    if (showAllProposals) {
        return (
            <div
                style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: tokens.spacing[4],
                }}
            >
                {/* Back button */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                    }}
                >
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBackToCard}
                        aria-label="Return to card view"
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                            <span>←</span>
                            Back to Card
                        </div>
                    </Button>
                </div>

                {/* Full proposals list */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: tokens.spacing[4],
                    }}
                >
                    <h4
                        style={{
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[900],
                            margin: 0,
                        }}
                    >
                        All Proposals ({totalProposals})
                    </h4>

                    {proposals.map((proposal) => (
                        <Card
                            key={proposal.id}
                            variant="outlined"
                            style={{
                                border: `2px solid ${proposal.status === 'pending'
                                    ? tokens.colors.success[200]
                                    : tokens.colors.neutral[200]
                                    }`,
                                backgroundColor: proposal.status === 'pending'
                                    ? tokens.colors.success[50]
                                    : 'white',
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
                                            {proposal.proposerName.charAt(0).toUpperCase()}
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
                                                {proposal.proposerName}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    color: tokens.colors.neutral[600],
                                                }}
                                            >
                                                {proposal.targetBookingDetails.title}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: tokens.typography.fontSize.xs,
                                                    color: tokens.colors.neutral[500],
                                                }}
                                            >
                                                📍 {proposal.targetBookingDetails.location?.city}, {proposal.targetBookingDetails.location?.country}
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
                                        <div
                                            style={{
                                                padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                                backgroundColor: proposal.status === 'pending' ? tokens.colors.warning[100] :
                                                    proposal.status === 'accepted' ? tokens.colors.success[100] :
                                                        proposal.status === 'rejected' ? tokens.colors.error[100] : tokens.colors.neutral[100],
                                                border: `1px solid ${proposal.status === 'pending' ? tokens.colors.warning[300] :
                                                    proposal.status === 'accepted' ? tokens.colors.success[300] :
                                                        proposal.status === 'rejected' ? tokens.colors.error[300] : tokens.colors.neutral[300]}`,
                                                borderRadius: tokens.borderRadius.full,
                                                fontSize: tokens.typography.fontSize.xs,
                                                fontWeight: tokens.typography.fontWeight.medium,
                                                color: proposal.status === 'pending' ? tokens.colors.warning[800] :
                                                    proposal.status === 'accepted' ? tokens.colors.success[800] :
                                                        proposal.status === 'rejected' ? tokens.colors.error[800] : tokens.colors.neutral[800],
                                                textTransform: 'capitalize',
                                            }}
                                        >
                                            {proposal.status}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: tokens.typography.fontSize.lg,
                                                fontWeight: tokens.typography.fontWeight.bold,
                                                color: tokens.colors.primary[600],
                                            }}
                                        >
                                            {formatCurrency(proposal.targetBookingDetails.swapValue || 0)}
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Payment */}
                                {proposal.additionalPayment && proposal.additionalPayment > 0 && (
                                    <div
                                        style={{
                                            padding: tokens.spacing[3],
                                            backgroundColor: tokens.colors.primary[50],
                                            borderRadius: tokens.borderRadius.md,
                                            border: `1px solid ${tokens.colors.primary[200]}`,
                                            marginBottom: tokens.spacing[3],
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: tokens.spacing[2],
                                            }}
                                        >
                                            <span style={{ fontSize: '16px' }}>💰</span>
                                            <span
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    fontWeight: tokens.typography.fontWeight.medium,
                                                    color: tokens.colors.primary[800],
                                                }}
                                            >
                                                Additional Payment: {formatCurrency(proposal.additionalPayment)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Conditions */}
                                {proposal.conditions && proposal.conditions.length > 0 && (
                                    <div
                                        style={{
                                            marginBottom: tokens.spacing[3],
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: tokens.spacing[2],
                                                marginBottom: tokens.spacing[2],
                                            }}
                                        >
                                            <span style={{ fontSize: '16px' }}>📋</span>
                                            <span
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    fontWeight: tokens.typography.fontWeight.medium,
                                                    color: tokens.colors.neutral[700],
                                                }}
                                            >
                                                Conditions:
                                            </span>
                                        </div>
                                        <ul
                                            style={{
                                                margin: 0,
                                                paddingLeft: tokens.spacing[6],
                                                fontSize: tokens.typography.fontSize.sm,
                                                color: tokens.colors.neutral[700],
                                            }}
                                        >
                                            {proposal.conditions.map((condition, index) => (
                                                <li
                                                    key={index}
                                                    style={{ marginBottom: tokens.spacing[1] }}
                                                >
                                                    {condition}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                {/* Payment and Blockchain Status Display */}
                                {getProposalStatusData && getProposalStatusData(proposal.id) && (
                                    <div style={{ marginTop: tokens.spacing[3] }}>
                                        <ProposalStatusDisplay
                                            statusData={getProposalStatusData(proposal.id)!}
                                            compact={true}
                                            showDetailsDefault={false}
                                            allowToggleDetails={false}
                                            onRetry={onRetryProposal}
                                            canRetry={!!onRetryProposal}
                                        />
                                    </div>
                                )}

                                {proposal.status === 'pending' && (
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            borderTop: `1px solid ${tokens.colors.neutral[200]}`,
                                            paddingTop: tokens.spacing[3],
                                        }}
                                    >
                                        <ProposalActionButtons
                                            proposalId={proposal.id}
                                            status={proposal.status as 'pending' | 'accepted' | 'rejected' | 'expired'}
                                            onAccept={onAcceptProposal}
                                            onReject={onRejectProposal}
                                            isProcessing={activeOperations[proposal.id]?.loading || false}
                                            orientation={isMobile ? 'vertical' : 'horizontal'}
                                            size="md"
                                            statusData={getProposalStatusData ? getProposalStatusData(proposal.id) : undefined}
                                            showStatus={false} // We show it separately above
                                            onRetry={onRetryProposal}
                                            currentUserId={currentUserId}
                                            proposalOwnerId={currentUserId}
                                            swapId={swapId}
                                        />
                                    </div>
                                )}

                                {/* Expiration */}
                                {proposal.expiresAt && (
                                    <div
                                        style={{
                                            marginTop: tokens.spacing[2],
                                            fontSize: tokens.typography.fontSize.xs,
                                            color: tokens.colors.neutral[500],
                                        }}
                                    >
                                        ⏰ Expires: {formatDate(proposal.expiresAt)}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    // Card view with summary and key proposals
    return (
        <div
            id={sectionId}
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[3],
            }}
        >
            {/* Proposal Summary Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: `${tokens.spacing[3]} 0`,
                    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                    }}
                >
                    <span style={{ fontSize: '20px' }}>📥</span>
                    <div>
                        <h4
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[900],
                                margin: 0,
                            }}
                        >
                            Proposals Received
                        </h4>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[600],
                            }}
                        >
                            {hasActiveProposals ? (
                                <>
                                    {activeProposals.length} pending
                                    {inactiveProposals.length > 0 && ` • ${inactiveProposals.length} resolved`}
                                </>
                            ) : (
                                `${totalProposals} total (none pending)`
                            )}
                        </div>
                    </div>
                </div>

                {totalProposals > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleViewAllProposals}
                        aria-label="View all proposals in detail"
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                            View All ({totalProposals})
                            <span>→</span>
                        </div>
                    </Button>
                )}
            </div>

            {/* Active Proposals Preview */}
            {hasActiveProposals && cardViewProposals.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: tokens.spacing[3],
                    }}
                >
                    {cardViewProposals.map((proposal) => (
                        <Card
                            key={proposal.id}
                            variant="outlined"
                            style={{
                                border: `2px solid ${tokens.colors.success[200]}`,
                                backgroundColor: tokens.colors.success[50],
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
                                        gap: tokens.spacing[3],
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
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                backgroundColor: tokens.colors.primary[100],
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: tokens.typography.fontSize.base,
                                                fontWeight: tokens.typography.fontWeight.semibold,
                                                color: tokens.colors.primary[700],
                                                border: `2px solid ${tokens.colors.primary[200]}`,
                                            }}
                                        >
                                            {proposal.proposerName.charAt(0).toUpperCase()}
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
                                                {proposal.proposerName}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    color: tokens.colors.neutral[600],
                                                }}
                                            >
                                                {proposal.targetBookingDetails.title}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: tokens.typography.fontSize.xs,
                                                    color: tokens.colors.neutral[500],
                                                }}
                                            >
                                                📍 {proposal.targetBookingDetails.location?.city}, {proposal.targetBookingDetails.location?.country}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Payment and Blockchain Status Display */}
                                    {getProposalStatusData && getProposalStatusData(proposal.id) && (
                                        <div style={{ marginBottom: tokens.spacing[2], width: '100%' }}>
                                            <ProposalStatusDisplay
                                                statusData={getProposalStatusData(proposal.id)!}
                                                compact={true}
                                                showDetailsDefault={false}
                                                allowToggleDetails={false}
                                                onRetry={onRetryProposal}
                                                canRetry={!!onRetryProposal}
                                            />
                                        </div>
                                    )}

                                    {/* Quick Actions */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: tokens.spacing[2],
                                            flexDirection: isMobile ? 'row' : 'row',
                                            width: isMobile ? '100%' : 'auto',
                                        }}
                                    >
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onRejectProposal(proposal.id)}
                                            disabled={activeOperations[proposal.id]?.loading || false}
                                            loading={activeOperations[proposal.id]?.loading && activeOperations[proposal.id]?.action === 'reject'}
                                            style={{
                                                borderColor: tokens.colors.error[300],
                                                color: tokens.colors.error[700],
                                                flex: isMobile ? 1 : undefined,
                                            }}
                                            aria-label="Reject this proposal"
                                            data-testid="reject-proposal-button"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                                <span>❌</span>
                                                {!isMobile && 'Reject'}
                                            </div>
                                        </Button>

                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => onAcceptProposal(proposal.id)}
                                            disabled={activeOperations[proposal.id]?.loading || false}
                                            loading={activeOperations[proposal.id]?.loading && activeOperations[proposal.id]?.action === 'accept'}
                                            style={{
                                                backgroundColor: tokens.colors.success[500],
                                                flex: isMobile ? 1 : undefined,
                                            }}
                                            aria-label="Accept this proposal"
                                            data-testid="accept-proposal-button"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                                <span>✅</span>
                                                {!isMobile && 'Accept'}
                                            </div>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {/* Show more indicator */}
                    {hasMoreProposals && (
                        <div
                            style={{
                                textAlign: 'center',
                                padding: tokens.spacing[2],
                            }}
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleViewAllProposals}
                                aria-label={`View ${activeProposals.length - maxVisibleInCard} more pending proposals`}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                    <span>+{activeProposals.length - maxVisibleInCard} more pending proposals</span>
                                    <span>→</span>
                                </div>
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* No Active Proposals State */}
            {!hasActiveProposals && totalProposals > 0 && (
                <div
                    style={{
                        textAlign: 'center',
                        padding: tokens.spacing[4],
                        color: tokens.colors.neutral[600],
                        fontSize: tokens.typography.fontSize.sm,
                    }}
                >
                    <div style={{ fontSize: '32px', marginBottom: tokens.spacing[2], opacity: 0.5 }}>
                        📭
                    </div>
                    <div>
                        No pending proposals • {totalProposals} resolved
                    </div>
                </div>
            )}
        </div>
    );
};