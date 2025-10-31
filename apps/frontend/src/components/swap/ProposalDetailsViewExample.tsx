import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { ProposalDetailsView } from './ProposalDetailsView';
import { ReceivedProposals } from './ReceivedProposals';
import { IncomingTargetInfo } from '@booking-swap/shared';

/**
 * Example component showing how to integrate ProposalDetailsView
 * with existing proposal management components.
 * 
 * This demonstrates the integration pattern for task 12.3:
 * - Add detailed acceptance/rejection interface
 * - Display complete proposal information and terms
 * - Show transaction history and blockchain records
 * - Add export functionality for proposal records
 */
interface ProposalDetailsViewExampleProps {
    /** List of received proposals */
    proposals: IncomingTargetInfo[];

    /** Callback when a proposal is accepted */
    onAcceptProposal: (proposalId: string) => Promise<void>;

    /** Callback when a proposal is rejected */
    onRejectProposal: (proposalId: string) => Promise<void>;
}

export const ProposalDetailsViewExample: React.FC<ProposalDetailsViewExampleProps> = ({
    proposals,
    onAcceptProposal,
    onRejectProposal,
}) => {
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'details'>('list');

    const handleViewDetails = (proposalId: string) => {
        setSelectedProposalId(proposalId);
        setViewMode('details');
    };

    const handleBackToList = () => {
        setSelectedProposalId(null);
        setViewMode('list');
    };

    const handleAcceptFromDetails = async (proposalId: string) => {
        await onAcceptProposal(proposalId);
        // Optionally stay in details view or return to list
        // handleBackToList();
    };

    const handleRejectFromDetails = async (proposalId: string) => {
        await onRejectProposal(proposalId);
        // Optionally stay in details view or return to list
        // handleBackToList();
    };

    if (viewMode === 'details' && selectedProposalId) {
        return (
            <div
                style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: tokens.spacing[4],
                }}
            >
                {/* Navigation breadcrumb */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                        padding: tokens.spacing[2],
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                    }}
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBackToList}
                        style={{
                            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                        }}
                    >
                        ← Back to Proposals
                    </Button>
                    <span>/</span>
                    <span>Proposal Details</span>
                </div>

                {/* Detailed proposal view */}
                <ProposalDetailsView
                    proposalId={selectedProposalId}
                    onAccept={handleAcceptFromDetails}
                    onReject={handleRejectFromDetails}
                    onClose={handleBackToList}
                    showActions={true}
                />
            </div>
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
            {/* Enhanced ReceivedProposals with "View Details" functionality */}
            <EnhancedReceivedProposals
                proposals={proposals}
                onAcceptProposal={onAcceptProposal}
                onRejectProposal={onRejectProposal}
                onViewDetails={handleViewDetails}
            />
        </div>
    );
};

/**
 * Enhanced version of ReceivedProposals that includes "View Details" buttons
 * This shows how existing components can be extended to integrate with ProposalDetailsView
 */
interface EnhancedReceivedProposalsProps {
    proposals: IncomingTargetInfo[];
    onAcceptProposal: (proposalId: string) => Promise<void>;
    onRejectProposal: (proposalId: string) => Promise<void>;
    onViewDetails: (proposalId: string) => void;
}

const EnhancedReceivedProposals: React.FC<EnhancedReceivedProposalsProps> = ({
    proposals,
    onAcceptProposal,
    onRejectProposal,
    onViewDetails,
}) => {
    return (
        <div
            style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[4],
            }}
        >
            {/* Use existing ReceivedProposals component */}
            <ReceivedProposals
                proposals={proposals}
                onAcceptProposal={onAcceptProposal}
                onRejectProposal={onRejectProposal}
                showActions={true}
            />

            {/* Add "View Details" buttons for each proposal */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: tokens.spacing[2],
                }}
            >
                <h3
                    style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.neutral[900],
                        margin: 0,
                    }}
                >
                    Quick Actions
                </h3>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: tokens.spacing[3],
                    }}
                >
                    {proposals.map((proposal) => (
                        <div
                            key={proposal.proposalId}
                            style={{
                                padding: tokens.spacing[3],
                                backgroundColor: tokens.colors.neutral[50],
                                borderRadius: tokens.borderRadius.md,
                                border: `1px solid ${tokens.colors.neutral[200]}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        fontWeight: tokens.typography.fontWeight.medium,
                                        color: tokens.colors.neutral[900],
                                        marginBottom: tokens.spacing[1],
                                    }}
                                >
                                    {proposal.sourceSwap.ownerName}
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    {proposal.sourceSwap.bookingDetails.title}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onViewDetails(proposal.proposalId)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                    <span>👁️</span>
                                    View Details
                                </div>
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProposalDetailsViewExample;