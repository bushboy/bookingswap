import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { SwapProposal } from '@booking-swap/shared';
import { ProposalActionButtons } from './ProposalActionButtons';
import { ProposalStatusIndicator } from './ProposalStatusIndicator';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';

export interface SwapProposalCardProps {
    /** The swap proposal data */
    proposal: SwapProposal;

    /** Whether the current user can take actions on this proposal */
    canTakeAction?: boolean;

    /** Whether any action is currently processing */
    isProcessing?: boolean;

    /** Callback when accept button is clicked */
    onAccept?: (proposalId: string) => Promise<void> | void;

    /** Callback when reject button is clicked */
    onReject?: (proposalId: string) => Promise<void> | void;

    /** Callback when proposal details are clicked */
    onViewDetails?: (proposalId: string) => void;

    /** Whether to show detailed financial information */
    showFinancialDetails?: boolean;

    /** Whether to show action buttons */
    showActions?: boolean;

    /** Custom styling */
    className?: string;

    /** Card variant */
    variant?: 'default' | 'elevated' | 'outlined';

    /** Whether to show compact view */
    compact?: boolean;
}

export const SwapProposalCard: React.FC<SwapProposalCardProps> = ({
    proposal,
    canTakeAction = false,
    isProcessing = false,
    onAccept,
    onReject,
    onViewDetails,
    showFinancialDetails = true,
    showActions = true,
    className = '',
    variant = 'default',
    compact = false,
}) => {
    const { isMobile } = useResponsive();
    const [showFullMessage, setShowFullMessage] = useState(false);

    // Format currency for display
    const formatCurrency = (amount: number, currency: string = 'USD'): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    // Format date for display
    const formatDate = (date: Date): string => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(date));
    };

    // Truncate message for display
    const truncateMessage = (message: string, maxLength: number = 100): string => {
        if (message.length <= maxLength) return message;
        return message.substring(0, maxLength) + '...';
    };

    // Determine if proposal is financial
    const isFinancialProposal = proposal.proposalType === 'cash' && proposal.cashOffer;

    // Get payment status for financial proposals
    const getPaymentStatus = (): string => {
        if (!isFinancialProposal) return '';

        if (proposal.status === 'accepted') {
            return 'Payment Completed';
        } else if (proposal.status === 'pending') {
            return 'Payment Pending';
        }
        return '';
    };

    // Card styles based on status and responsive design
    const getCardStyles = () => {
        const baseStyles = {
            marginBottom: tokens.spacing[4],
            transition: 'all 0.2s ease-in-out',
        };

        if (proposal.status === 'accepted') {
            return {
                ...baseStyles,
                borderColor: tokens.colors.success[300],
                backgroundColor: tokens.colors.success[50],
            };
        } else if (proposal.status === 'rejected') {
            return {
                ...baseStyles,
                borderColor: tokens.colors.error[300],
                backgroundColor: tokens.colors.error[50],
            };
        } else if (proposal.status === 'expired') {
            return {
                ...baseStyles,
                borderColor: tokens.colors.neutral[300],
                backgroundColor: tokens.colors.neutral[50],
                opacity: 0.8,
            };
        }

        return baseStyles;
    };

    // Content layout based on screen size
    const getContentLayout = () => {
        if (compact || isMobile) {
            return {
                flexDirection: 'column' as const,
                gap: tokens.spacing[3],
            };
        }

        return {
            flexDirection: 'row' as const,
            gap: tokens.spacing[4],
            alignItems: 'flex-start',
        };
    };

    const handleViewDetails = () => {
        onViewDetails?.(proposal.id);
    };

    return (
        <Card
            variant={variant}
            className={className}
            style={getCardStyles()}
            data-testid={`proposal-card-${proposal.id}`}
        >
            <CardHeader style={{
                padding: compact ? tokens.spacing[4] : tokens.spacing[6],
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexDirection: isMobile ? 'column' : 'row',
                gap: tokens.spacing[3],
            }}>
                <div style={{ flex: 1 }}>
                    <CardTitle style={{
                        fontSize: compact ? tokens.typography.fontSize.base : tokens.typography.fontSize.lg,
                        marginBottom: tokens.spacing[1],
                    }}>
                        {isFinancialProposal ? 'Cash Offer' : 'Booking Exchange'} Proposal
                    </CardTitle>
                    <CardDescription>
                        From: {proposal.proposerId} • {formatDate(proposal.createdAt)}
                    </CardDescription>
                </div>

                <ProposalStatusIndicator
                    status={proposal.status}
                    proposalId={proposal.id}
                    size={compact ? 'sm' : 'md'}
                    showDetails={false}
                    lastUpdated={proposal.respondedAt}
                />
            </CardHeader>

            <CardContent style={{
                padding: compact ? tokens.spacing[4] : tokens.spacing[6],
                paddingTop: 0,
            }}>
                <div style={getContentLayout()}>
                    {/* Main Proposal Information */}
                    <div style={{ flex: 1 }}>
                        {/* Financial Proposal Details */}
                        {isFinancialProposal && showFinancialDetails && proposal.cashOffer && (
                            <div style={{
                                padding: tokens.spacing[4],
                                backgroundColor: tokens.colors.primary[50],
                                borderRadius: tokens.borderRadius.md,
                                border: `1px solid ${tokens.colors.primary[200]}`,
                                marginBottom: tokens.spacing[4],
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: tokens.spacing[2],
                                }}>
                                    <h4 style={{
                                        fontSize: tokens.typography.fontSize.base,
                                        fontWeight: tokens.typography.fontWeight.semibold,
                                        color: tokens.colors.primary[800],
                                        margin: 0,
                                    }}>
                                        💰 Cash Offer Details
                                    </h4>
                                    {getPaymentStatus() && (
                                        <span style={{
                                            fontSize: tokens.typography.fontSize.xs,
                                            color: tokens.colors.primary[700],
                                            backgroundColor: tokens.colors.primary[100],
                                            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                            borderRadius: tokens.borderRadius.sm,
                                        }}>
                                            {getPaymentStatus()}
                                        </span>
                                    )}
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                                    gap: tokens.spacing[3],
                                }}>
                                    <div>
                                        <span style={{
                                            fontSize: tokens.typography.fontSize.sm,
                                            color: tokens.colors.neutral[600],
                                            display: 'block',
                                        }}>
                                            Offer Amount
                                        </span>
                                        <span style={{
                                            fontSize: tokens.typography.fontSize.xl,
                                            fontWeight: tokens.typography.fontWeight.bold,
                                            color: tokens.colors.primary[800],
                                        }}>
                                            {formatCurrency(proposal.cashOffer.amount, proposal.cashOffer.currency)}
                                        </span>
                                    </div>

                                    <div>
                                        <span style={{
                                            fontSize: tokens.typography.fontSize.sm,
                                            color: tokens.colors.neutral[600],
                                            display: 'block',
                                        }}>
                                            Currency
                                        </span>
                                        <span style={{
                                            fontSize: tokens.typography.fontSize.base,
                                            fontWeight: tokens.typography.fontWeight.medium,
                                            color: tokens.colors.neutral[800],
                                        }}>
                                            {proposal.cashOffer.currency}
                                        </span>
                                    </div>
                                </div>

                                {proposal.cashOffer.escrowAccountId && (
                                    <div style={{ marginTop: tokens.spacing[3] }}>
                                        <span style={{
                                            fontSize: tokens.typography.fontSize.xs,
                                            color: tokens.colors.neutral[600],
                                        }}>
                                            🔒 Funds secured in escrow account
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Proposal Message */}
                        {proposal.message && (
                            <div style={{ marginBottom: tokens.spacing[4] }}>
                                <h4 style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[800],
                                    marginBottom: tokens.spacing[2],
                                }}>
                                    Message
                                </h4>
                                <p style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[700],
                                    lineHeight: tokens.typography.lineHeight.relaxed,
                                    margin: 0,
                                }}>
                                    {showFullMessage ? proposal.message : truncateMessage(proposal.message)}
                                    {proposal.message.length > 100 && (
                                        <button
                                            onClick={() => setShowFullMessage(!showFullMessage)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: tokens.colors.primary[600],
                                                cursor: 'pointer',
                                                fontSize: tokens.typography.fontSize.sm,
                                                marginLeft: tokens.spacing[1],
                                                textDecoration: 'underline',
                                            }}
                                        >
                                            {showFullMessage ? 'Show less' : 'Show more'}
                                        </button>
                                    )}
                                </p>
                            </div>
                        )}

                        {/* Conditions */}
                        {proposal.conditions && proposal.conditions.length > 0 && (
                            <div style={{ marginBottom: tokens.spacing[4] }}>
                                <h4 style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[800],
                                    marginBottom: tokens.spacing[2],
                                }}>
                                    Conditions
                                </h4>
                                <ul style={{
                                    margin: 0,
                                    paddingLeft: tokens.spacing[4],
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[700],
                                }}>
                                    {proposal.conditions.map((condition, index) => (
                                        <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                                            {condition}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Expiration */}
                        {proposal.expiresAt && (
                            <div style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.neutral[600],
                                marginBottom: tokens.spacing[4],
                            }}>
                                ⏰ Expires: {formatDate(proposal.expiresAt)}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons Section */}
                    {showActions && canTakeAction && proposal.status === 'pending' && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: tokens.spacing[3],
                            minWidth: isMobile ? '100%' : '200px',
                        }}>
                            {onAccept && onReject && (
                                <ProposalActionButtons
                                    proposalId={proposal.id}
                                    status={proposal.status}
                                    disabled={isProcessing}
                                    isProcessing={isProcessing}
                                    onAccept={onAccept}
                                    onReject={onReject}
                                    orientation={isMobile ? 'horizontal' : 'vertical'}
                                    size={compact ? 'sm' : 'md'}
                                />
                            )}

                            {onViewDetails && (
                                <Button
                                    variant="ghost"
                                    size={compact ? 'sm' : 'md'}
                                    onClick={handleViewDetails}
                                    style={{
                                        width: '100%',
                                        justifyContent: 'center',
                                    }}
                                >
                                    View Details
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Response Information for Non-Pending Proposals */}
                {proposal.status !== 'pending' && (proposal.respondedAt || proposal.rejectionReason) && (
                    <div style={{
                        marginTop: tokens.spacing[4],
                        padding: tokens.spacing[3],
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.sm,
                        border: `1px solid ${tokens.colors.neutral[200]}`,
                    }}>
                        {proposal.respondedAt && (
                            <div style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.neutral[600],
                                marginBottom: proposal.rejectionReason ? tokens.spacing[1] : 0,
                            }}>
                                Responded: {formatDate(proposal.respondedAt)}
                            </div>
                        )}

                        {proposal.rejectionReason && (
                            <div>
                                <span style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    color: tokens.colors.neutral[600],
                                    fontWeight: tokens.typography.fontWeight.medium,
                                }}>
                                    Reason:
                                </span>
                                <span style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    color: tokens.colors.neutral[700],
                                    marginLeft: tokens.spacing[1],
                                }}>
                                    {proposal.rejectionReason}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Blockchain Transaction Info */}
                {proposal.blockchain?.responseTransactionId && (
                    <div style={{
                        marginTop: tokens.spacing[3],
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.neutral[500],
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[1],
                    }}>
                        <span>🔗</span>
                        <span>Blockchain TX: {proposal.blockchain.responseTransactionId.substring(0, 16)}...</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default SwapProposalCard;