import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useAnnouncements } from '../../hooks/useAccessibility';

export interface ProposalData {
    id: string;
    proposerId: string;
    proposerName: string;
    proposerAvatar?: string;
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    createdAt: Date;
    updatedAt: Date;

    // Proposal details
    proposalType: 'booking' | 'cash';
    message?: string;
    conditions: string[];
    expiresAt?: Date;

    // Booking details
    sourceBooking: {
        id: string;
        title: string;
        type: string;
        location: {
            city: string;
            country: string;
        };
        dateRange: {
            checkIn: Date;
            checkOut: Date;
        };
        swapValue: number;
        currency?: string;
        capacity?: number;
        amenities?: string[];
    };

    // Financial details (for cash proposals)
    cashOffer?: {
        amount: number;
        currency: string;
        paymentMethodId: string;
        escrowAccountId?: string;
    };

    // Auction info (if applicable)
    auctionInfo?: {
        isAuction: boolean;
        endDate?: Date;
        currentProposalCount: number;
    };
}

export interface ProposalAcceptanceModalProps {
    /** Whether the modal is open */
    isOpen: boolean;

    /** Callback to close the modal */
    onClose: () => void;

    /** Proposal data to display */
    proposal: ProposalData | null;

    /** Callback when proposal is accepted */
    onAccept: (proposalId: string, data?: any) => Promise<void>;

    /** Callback when proposal is rejected */
    onReject: (proposalId: string, reason?: string) => Promise<void>;

    /** Whether any action is currently processing */
    isProcessing?: boolean;

    /** Modal mode - 'accept' or 'reject' */
    mode?: 'accept' | 'reject';
}

export const ProposalAcceptanceModal: React.FC<ProposalAcceptanceModalProps> = ({
    isOpen,
    onClose,
    proposal,
    onAccept,
    onReject,
    isProcessing = false,
    mode = 'accept',
}) => {
    const { isMobile } = useResponsive();
    const { announce } = useAnnouncements();

    const [rejectionReason, setRejectionReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setRejectionReason('');
            setActionLoading(false);
            setFormErrors({});
        }
    }, [isOpen]);

    if (!proposal) {
        return null;
    }

    const formatDate = (date: Date): string => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatCurrency = (amount: number, currency = 'USD'): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
        }).format(amount);
    };

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (mode === 'reject' && rejectionReason.trim().length > 500) {
            errors.rejectionReason = 'Reason must be 500 characters or less';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleAccept = async () => {
        if (!validateForm()) {
            return;
        }

        try {
            setActionLoading(true);

            await onAccept(proposal.id);

            announce(`Proposal from ${proposal.proposerName} accepted successfully`, 'polite');
            onClose();
        } catch (error) {
            console.error('Error accepting proposal:', error);
            announce('Failed to accept proposal. Please try again.', 'assertive');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!validateForm()) {
            return;
        }

        try {
            setActionLoading(true);

            await onReject(proposal.id, rejectionReason.trim() || undefined);

            announce(`Proposal from ${proposal.proposerName} rejected successfully`, 'polite');
            onClose();
        } catch (error) {
            console.error('Error rejecting proposal:', error);
            announce('Failed to reject proposal. Please try again.', 'assertive');
        } finally {
            setActionLoading(false);
        }
    };

    const getModalTitle = () => {
        if (mode === 'accept') {
            return 'Accept Proposal';
        }
        return 'Reject Proposal';
    };

    const getBookingTypeIcon = (type: string): string => {
        switch (type.toLowerCase()) {
            case 'hotel':
                return '🏨';
            case 'vacation_rental':
                return '🏠';
            case 'resort':
                return '🏖️';
            case 'event':
                return '🎫';
            case 'flight':
                return '✈️';
            default:
                return '📋';
        }
    };

    const isButtonDisabled = isProcessing || actionLoading;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={getModalTitle()}
            size="lg"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[6] }}>

                {/* Proposer Information */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[4],
                    padding: tokens.spacing[4],
                    backgroundColor: tokens.colors.neutral[50],
                    borderRadius: tokens.borderRadius.lg,
                }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        backgroundColor: tokens.colors.primary[100],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: tokens.typography.fontSize.xl,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.primary[700],
                        border: `2px solid ${tokens.colors.primary[200]}`,
                    }}>
                        {proposal.proposerAvatar ? (
                            <img
                                src={proposal.proposerAvatar}
                                alt={`${proposal.proposerName}'s avatar`}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                }}
                            />
                        ) : (
                            proposal.proposerName.charAt(0).toUpperCase()
                        )}
                    </div>

                    <div>
                        <h3 style={{
                            fontSize: tokens.typography.fontSize.xl,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[900],
                            margin: `0 0 ${tokens.spacing[1]} 0`,
                        }}>
                            {proposal.proposerName}
                        </h3>
                        <p style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                            margin: 0,
                        }}>
                            Proposed on {formatDate(proposal.createdAt)}
                        </p>
                    </div>
                </div>

                {/* Proposal Details */}
                <Card>
                    <CardHeader>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                        }}>
                            <span style={{ fontSize: '24px' }}>
                                {getBookingTypeIcon(proposal.sourceBooking.type)}
                            </span>
                            <div>
                                <h4 style={{
                                    fontSize: tokens.typography.fontSize.lg,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[900],
                                    margin: 0,
                                }}>
                                    {proposal.sourceBooking.title}
                                </h4>
                                <p style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                    margin: `${tokens.spacing[1]} 0 0 0`,
                                    textTransform: 'capitalize',
                                }}>
                                    {proposal.proposalType} proposal • {proposal.sourceBooking.type}
                                </p>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                            gap: tokens.spacing[4],
                            marginBottom: tokens.spacing[4],
                        }}>
                            <div>
                                <h5 style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[800],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                }}>
                                    Location
                                </h5>
                                <p style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                    margin: 0,
                                }}>
                                    📍 {proposal.sourceBooking.location.city}, {proposal.sourceBooking.location.country}
                                </p>
                            </div>

                            <div>
                                <h5 style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[800],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                }}>
                                    Dates
                                </h5>
                                <p style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                    margin: 0,
                                }}>
                                    📅 {formatDate(proposal.sourceBooking.dateRange.checkIn)} - {formatDate(proposal.sourceBooking.dateRange.checkOut)}
                                </p>
                            </div>
                        </div>

                        <div style={{
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.primary[50],
                            borderRadius: tokens.borderRadius.md,
                            marginBottom: tokens.spacing[4],
                        }}>
                            <h5 style={{
                                fontSize: tokens.typography.fontSize.base,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.primary[800],
                                margin: `0 0 ${tokens.spacing[2]} 0`,
                            }}>
                                Swap Value
                            </h5>
                            <p style={{
                                fontSize: tokens.typography.fontSize.xl,
                                fontWeight: tokens.typography.fontWeight.bold,
                                color: tokens.colors.primary[700],
                                margin: 0,
                            }}>
                                {formatCurrency(proposal.sourceBooking.swapValue, proposal.sourceBooking.currency)}
                            </p>
                        </div>

                        {/* Financial Proposal Details */}
                        {proposal.proposalType === 'cash' && proposal.cashOffer && (
                            <div style={{
                                padding: tokens.spacing[4],
                                backgroundColor: tokens.colors.success[50],
                                borderRadius: tokens.borderRadius.md,
                                border: `1px solid ${tokens.colors.success[200]}`,
                                marginBottom: tokens.spacing[4],
                            }}>
                                <h5 style={{
                                    fontSize: tokens.typography.fontSize.base,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.success[800],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: tokens.spacing[2],
                                }}>
                                    <span>💰</span>
                                    Cash Offer
                                </h5>
                                <p style={{
                                    fontSize: tokens.typography.fontSize.xl,
                                    fontWeight: tokens.typography.fontWeight.bold,
                                    color: tokens.colors.success[700],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                }}>
                                    {formatCurrency(proposal.cashOffer.amount, proposal.cashOffer.currency)}
                                </p>
                                <p style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.success[600],
                                    margin: 0,
                                }}>
                                    {proposal.cashOffer.escrowAccountId ? 'Funds held in escrow' : 'Payment on acceptance'}
                                </p>
                            </div>
                        )}

                        {/* Proposal Message */}
                        {proposal.message && (
                            <div style={{
                                padding: tokens.spacing[3],
                                backgroundColor: tokens.colors.neutral[100],
                                borderRadius: tokens.borderRadius.md,
                                marginBottom: tokens.spacing[4],
                            }}>
                                <h5 style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[800],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                }}>
                                    Message from {proposal.proposerName}
                                </h5>
                                <p style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[700],
                                    margin: 0,
                                    fontStyle: 'italic',
                                    lineHeight: tokens.typography.lineHeight.relaxed,
                                }}>
                                    "{proposal.message}"
                                </p>
                            </div>
                        )}

                        {/* Conditions */}
                        {proposal.conditions.length > 0 && (
                            <div style={{ marginBottom: tokens.spacing[4] }}>
                                <h5 style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[800],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                }}>
                                    Conditions
                                </h5>
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

                        {/* Auction Information */}
                        {proposal.auctionInfo?.isAuction && (
                            <div style={{
                                padding: tokens.spacing[4],
                                backgroundColor: tokens.colors.warning[50],
                                borderRadius: tokens.borderRadius.md,
                                border: `1px solid ${tokens.colors.warning[200]}`,
                                marginBottom: tokens.spacing[4],
                            }}>
                                <h5 style={{
                                    fontSize: tokens.typography.fontSize.base,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.warning[800],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: tokens.spacing[2],
                                }}>
                                    <span>🏆</span>
                                    Auction Proposal
                                </h5>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                                    gap: tokens.spacing[3],
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.warning[700],
                                }}>
                                    {proposal.auctionInfo.endDate && (
                                        <div>
                                            <strong>Auction ends:</strong> {formatDate(proposal.auctionInfo.endDate)}
                                        </div>
                                    )}
                                    <div>
                                        <strong>Total proposals:</strong> {proposal.auctionInfo.currentProposalCount}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Rejection Reason Input (only for reject mode) */}
                {mode === 'reject' && (
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.neutral[700],
                            marginBottom: tokens.spacing[2],
                        }}>
                            Reason for rejection (optional)
                        </label>
                        <textarea
                            placeholder="Let them know why you're rejecting this proposal..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            maxLength={500}
                            rows={3}
                            style={{
                                width: '100%',
                                padding: tokens.spacing[3],
                                fontSize: tokens.typography.fontSize.base,
                                lineHeight: tokens.typography.lineHeight.normal,
                                border: `1px solid ${formErrors.rejectionReason ? tokens.colors.error[300] : tokens.colors.neutral[300]}`,
                                borderRadius: tokens.borderRadius.md,
                                backgroundColor: 'white',
                                color: tokens.colors.neutral[900],
                                outline: 'none',
                                transition: 'all 0.2s ease-in-out',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                marginBottom: tokens.spacing[2],
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = formErrors.rejectionReason
                                    ? tokens.colors.error[500]
                                    : tokens.colors.primary[500];
                                e.target.style.boxShadow = `0 0 0 3px ${formErrors.rejectionReason
                                    ? tokens.colors.error[200]
                                    : tokens.colors.primary[200]}`;
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = formErrors.rejectionReason
                                    ? tokens.colors.error[300]
                                    : tokens.colors.neutral[300];
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                        {formErrors.rejectionReason && (
                            <div style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.error[600],
                                marginBottom: tokens.spacing[2],
                            }}>
                                {formErrors.rejectionReason}
                            </div>
                        )}
                        <p style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.neutral[500],
                            margin: 0,
                            textAlign: 'right',
                        }}>
                            {rejectionReason.length}/500 characters
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{
                    display: 'flex',
                    gap: tokens.spacing[3],
                    justifyContent: 'flex-end',
                    flexDirection: isMobile ? 'column' : 'row',
                    paddingTop: tokens.spacing[4],
                    borderTop: `1px solid ${tokens.colors.neutral[200]}`,
                }}>
                    <Button
                        variant="outline"
                        size="md"
                        onClick={onClose}
                        disabled={isButtonDisabled}
                        style={{ minWidth: isMobile ? '100%' : '120px' }}
                    >
                        Cancel
                    </Button>

                    {mode === 'accept' ? (
                        <Button
                            variant="primary"
                            size="md"
                            onClick={handleAccept}
                            loading={actionLoading}
                            disabled={isButtonDisabled}
                            style={{
                                backgroundColor: tokens.colors.success[500],
                                minWidth: isMobile ? '100%' : '120px',
                            }}
                        >
                            Accept Proposal
                        </Button>
                    ) : (
                        <Button
                            variant="danger"
                            size="md"
                            onClick={handleReject}
                            loading={actionLoading}
                            disabled={isButtonDisabled}
                            style={{ minWidth: isMobile ? '100%' : '120px' }}
                        >
                            Reject Proposal
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ProposalAcceptanceModal;