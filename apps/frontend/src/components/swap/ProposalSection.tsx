import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useId, useAnnouncements, useHighContrast } from '../../hooks/useAccessibility';
import { IncomingTargetInfo } from '@booking-swap/shared';
import { ProposalDetailsList } from './ProposalDetailsList';
import { getButtonAria, getFocusVisibleStyles, getHighContrastStyles } from '../../utils/accessibility';

interface ProposalSectionProps {
    proposals: IncomingTargetInfo[];
    onAcceptProposal: (proposalId: string) => void;
    onRejectProposal: (proposalId: string) => void;
    isProcessing?: boolean;
    showInCard?: boolean;
    maxVisibleInCard?: number;
}

export const ProposalSection: React.FC<ProposalSectionProps> = ({
    proposals,
    onAcceptProposal,
    onRejectProposal,
    isProcessing = false,
    showInCard = true,
    maxVisibleInCard = 2,
}) => {
    const { isMobile } = useResponsive();
    const { announce } = useAnnouncements();
    const { isHighContrast } = useHighContrast();
    const sectionId = useId('proposal-section');
    const [showAllProposals, setShowAllProposals] = useState(false);

    // Filter and organize proposals
    const activeProposals = proposals.filter(p => p.status === 'active');
    const inactiveProposals = proposals.filter(p => p.status !== 'active');
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
                        {...getButtonAria('Return to card view', false, false)}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                            <span>←</span>
                            Back to Card
                        </div>
                    </Button>
                </div>

                {/* Full proposals list */}
                <ProposalDetailsList
                    proposals={proposals}
                    onAcceptProposal={onAcceptProposal}
                    onRejectProposal={onRejectProposal}
                    isProcessing={isProcessing}
                    title="All Proposals"
                    emptyStateMessage="No proposals received yet"
                    showActions={true}
                />
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
                                    {activeProposals.length} active
                                    {inactiveProposals.length > 0 && ` • ${inactiveProposals.length} resolved`}
                                </>
                            ) : (
                                `${totalProposals} total (none active)`
                            )}
                        </div>
                    </div>
                </div>

                {totalProposals > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleViewAllProposals}
                        {...getButtonAria('View all proposals in detail', false, false)}
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
                            key={proposal.proposalId}
                            variant="outlined"
                            style={{
                                border: `2px solid ${tokens.colors.success[200]}`,
                                backgroundColor: tokens.colors.success[25],
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
                                        </div>
                                    </div>

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
                                            onClick={() => onRejectProposal(proposal.proposalId)}
                                            disabled={isProcessing}
                                            style={{
                                                borderColor: tokens.colors.error[300],
                                                color: tokens.colors.error[700],
                                                flex: isMobile ? 1 : undefined,
                                                ':hover': {
                                                    backgroundColor: tokens.colors.error[50],
                                                    borderColor: tokens.colors.error[400],
                                                },
                                            }}
                                            {...getButtonAria('Reject this proposal', false, isProcessing)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                                <span>❌</span>
                                                {!isMobile && 'Reject'}
                                            </div>
                                        </Button>

                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => onAcceptProposal(proposal.proposalId)}
                                            disabled={isProcessing}
                                            style={{
                                                backgroundColor: tokens.colors.success[500],
                                                flex: isMobile ? 1 : undefined,
                                                ':hover': {
                                                    backgroundColor: tokens.colors.success[600],
                                                },
                                            }}
                                            {...getButtonAria('Accept this proposal', false, isProcessing)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                                <span>✅</span>
                                                {!isMobile && 'Accept'}
                                            </div>
                                        </Button>
                                    </div>
                                </div>

                                {/* Auction indicator */}
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
                                                <> • Ends {new Date(proposal.auctionInfo.endDate).toLocaleDateString()}</>
                                            )}
                                        </span>
                                    </div>
                                )}
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
                                {...getButtonAria(`View ${activeProposals.length - maxVisibleInCard} more active proposals`, false, false)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                    <span>+{activeProposals.length - maxVisibleInCard} more active proposals</span>
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
                        No active proposals • {totalProposals} resolved
                    </div>
                </div>
            )}
        </div>
    );
};