import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useId, useAnnouncements, useHighContrast } from '../../hooks/useAccessibility';
import { IncomingTargetInfo } from '@booking-swap/shared';
import { ProposalDetailCard } from './ProposalDetailCard';
import { getButtonAria, getFocusVisibleStyles, getHighContrastStyles } from '../../utils/accessibility';

interface ProposalDetailsListProps {
    proposals: IncomingTargetInfo[];
    onAcceptProposal: (proposalId: string) => void;
    onRejectProposal: (proposalId: string) => void;
    isProcessing?: boolean;
    title?: string;
    emptyStateMessage?: string;
    showActions?: boolean;
    maxVisible?: number;
}

export const ProposalDetailsList: React.FC<ProposalDetailsListProps> = ({
    proposals,
    onAcceptProposal,
    onRejectProposal,
    isProcessing = false,
    title = 'Incoming Proposals',
    emptyStateMessage = 'No proposals received yet',
    showActions = true,
    maxVisible = 5,
}) => {
    const { isMobile } = useResponsive();
    const { announce } = useAnnouncements();
    const { isHighContrast } = useHighContrast();
    const listId = useId('proposals-list');
    const [expanded, setExpanded] = useState(false);
    const [processingProposalId, setProcessingProposalId] = useState<string | null>(null);

    // Filter and sort proposals
    const activeProposals = proposals.filter(p => p.status === 'active');
    const inactiveProposals = proposals.filter(p => p.status !== 'active');
    const sortedProposals = [
        ...activeProposals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        ...inactiveProposals.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    ];

    const visibleProposals = expanded ? sortedProposals : sortedProposals.slice(0, maxVisible);
    const hasMoreProposals = sortedProposals.length > maxVisible;

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

    const toggleExpanded = () => {
        setExpanded(!expanded);
        announce(
            expanded ? 'Showing fewer proposals' : 'Showing all proposals',
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
                        {title}
                    </h3>
                    <p
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.neutral[600],
                            margin: 0,
                        }}
                    >
                        {emptyStateMessage}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[4],
            }}
        >
            {/* Header */}
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
                            alignItems: 'center',
                            flexWrap: 'wrap',
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
                                {title}
                            </h2>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                }}
                            >
                                {activeProposals.length} active • {proposals.length} total
                            </div>
                        </div>

                        {hasMoreProposals && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleExpanded}
                                {...getButtonAria(
                                    expanded ? 'Show fewer proposals' : 'Show all proposals',
                                    false,
                                    false
                                )}
                            >
                                {expanded ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                        <span>▲</span>
                                        Show Less
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                        <span>▼</span>
                                        Show All ({sortedProposals.length})
                                    </div>
                                )}
                            </Button>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {/* Proposals List */}
            <div
                id={listId}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: tokens.spacing[4],
                }}
                role="list"
                aria-label={`${title} - ${proposals.length} proposals`}
            >
                {visibleProposals.map((proposal, index) => (
                    <div
                        key={proposal.proposalId}
                        role="listitem"
                        style={{
                            position: 'relative',
                        }}
                    >
                        {/* Priority indicator for active proposals */}
                        {proposal.status === 'active' && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    left: '16px',
                                    zIndex: 1,
                                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                    backgroundColor: tokens.colors.success[500],
                                    color: 'white',
                                    fontSize: tokens.typography.fontSize.xs,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    borderRadius: tokens.borderRadius.full,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                Awaiting Response
                            </div>
                        )}

                        <ProposalDetailCard
                            proposal={proposal}
                            onAccept={handleAcceptProposal}
                            onReject={handleRejectProposal}
                            isProcessing={isProcessing || processingProposalId === proposal.proposalId}
                            showActions={showActions && proposal.status === 'active'}
                        />
                    </div>
                ))}
            </div>

            {/* Summary Statistics */}
            {proposals.length > 0 && (
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
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(150px, 1fr))',
                                gap: tokens.spacing[4],
                                textAlign: 'center',
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.xl,
                                        fontWeight: tokens.typography.fontWeight.bold,
                                        color: tokens.colors.success[600],
                                    }}
                                >
                                    {activeProposals.length}
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    Active Proposals
                                </div>
                            </div>

                            <div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.xl,
                                        fontWeight: tokens.typography.fontWeight.bold,
                                        color: tokens.colors.primary[600],
                                    }}
                                >
                                    {proposals.length}
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    Total Received
                                </div>
                            </div>

                            <div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.xl,
                                        fontWeight: tokens.typography.fontWeight.bold,
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    {proposals.filter(p => p.auctionInfo?.isAuction).length}
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    Auction Proposals
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};