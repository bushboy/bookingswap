import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useId, useAnnouncements, useHighContrast } from '../../hooks/useAccessibility';
import { BookingType } from '@booking-swap/shared';

// Extended booking details interface for proposal display
interface ExtendedBookingDetails {
    id: string;
    title: string;
    description?: string;
    type?: BookingType;
    location: {
        city: string;
        country: string;
    };
    dateRange: {
        checkIn: Date;
        checkOut: Date;
    };
    originalPrice: number | null;
    swapValue: number | null;
    currency?: string;
    capacity?: number;
    amenities?: string[];
    formattedPrice?: string;
}
import { FinancialDataHandler } from '../../utils/financialDataHandler';
import { proposalService, ProposalDetailsResponse } from '../../services/proposalService';
import { getButtonAria, getHighContrastStyles } from '../../utils/accessibility';

interface ProposalDetailsModalProps {
    proposalId: string;
    isOpen: boolean;
    onClose: () => void;
    onAccept: (proposalId: string) => void;
    onReject: (proposalId: string) => void;
}

const getBookingTypeIcon = (type: BookingType): string => {
    switch (type) {
        case 'hotel': return '🏨';
        case 'vacation_rental': return '🏠';
        case 'resort': return '🏖️';
        case 'hostel': return '🏠';
        case 'bnb': return '🏡';
        case 'event': return '🎫';
        case 'concert': return '🎵';
        case 'sports': return '⚽';
        case 'theater': return '🎭';
        case 'flight': return '✈️';
        case 'rental': return '🚗';
        default: return '📋';
    }
};

const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatBookingDates = (booking: any): string => {
    if (!booking) return 'Unknown dates';

    const bookingType = booking.type;

    switch (bookingType) {
        case 'event':
        case 'concert':
        case 'sports':
        case 'theater':
            if (booking.eventDate) {
                return formatDate(booking.eventDate);
            } else if (booking.startDate && booking.endDate) {
                return `${formatDate(booking.startDate)} - ${formatDate(booking.endDate)}`;
            } else if (booking.startDate) {
                return formatDate(booking.startDate);
            } else if (booking.dateRange?.checkIn) {
                return formatDate(booking.dateRange.checkIn);
            }
            return 'Event date TBD';

        case 'hotel':
        case 'vacation_rental':
        case 'resort':
        case 'hostel':
        case 'bnb':
        default:
            if (booking.dateRange?.checkIn && booking.dateRange?.checkOut) {
                return `${formatDate(booking.dateRange.checkIn)} - ${formatDate(booking.dateRange.checkOut)}`;
            } else if (booking.checkInDate && booking.checkOutDate) {
                return `${formatDate(booking.checkInDate)} - ${formatDate(booking.checkOutDate)}`;
            }
            return 'Dates TBD';
    }
};

export const ProposalDetailsModal: React.FC<ProposalDetailsModalProps> = ({
    proposalId,
    isOpen,
    onClose,
    onAccept,
    onReject,
}) => {
    const { isMobile } = useResponsive();
    const { announce } = useAnnouncements();
    const { isHighContrast } = useHighContrast();
    const modalId = useId('proposal-modal');
    const titleId = useId('proposal-title');

    const [proposalDetails, setProposalDetails] = useState<ProposalDetailsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null);

    // Load proposal details when modal opens
    useEffect(() => {
        if (isOpen && proposalId) {
            loadProposalDetails();
        }
    }, [isOpen, proposalId]);

    const loadProposalDetails = async () => {
        setLoading(true);
        setError(null);

        try {
            const details = await proposalService.getProposalDetails(proposalId);
            setProposalDetails(details);
        } catch (err: any) {
            setError(err.message || 'Failed to load proposal details');
            console.error('Failed to load proposal details:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        if (!proposalDetails || actionLoading) return;

        setActionLoading('accept');
        try {
            const result = await proposalService.acceptProposal({
                proposalId,
                targetId: proposalDetails.proposal.targetId,
                swapId: proposalDetails.proposal.sourceSwap.id
            });

            if (result.success) {
                announce(`Proposal from ${proposalDetails.proposal.sourceSwap.ownerName} accepted`, 'polite');
                onAccept(proposalId);
                onClose();
            } else {
                throw new Error(result.error || 'Failed to accept proposal');
            }
        } catch (error: any) {
            console.error('Error accepting proposal:', error);
            announce('Failed to accept proposal', 'assertive');
            setError(error.message || 'Failed to accept proposal');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!proposalDetails || actionLoading) return;

        setActionLoading('reject');
        try {
            const result = await proposalService.rejectProposal({
                proposalId,
                targetId: proposalDetails.proposal.targetId,
                swapId: proposalDetails.proposal.sourceSwap.id,
                reason: 'Proposal rejected by user'
            });

            if (result.success) {
                announce(`Proposal from ${proposalDetails.proposal.sourceSwap.ownerName} rejected`, 'polite');
                onReject(proposalId);
                onClose();
            } else {
                throw new Error(result.error || 'Failed to reject proposal');
            }
        } catch (error: any) {
            console.error('Error rejecting proposal:', error);
            announce('Failed to reject proposal', 'assertive');
            setError(error.message || 'Failed to reject proposal');
        } finally {
            setActionLoading(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: tokens.spacing[4],
            }}
            onClick={onClose}
        >
            <div
                id={modalId}
                style={{
                    maxWidth: isMobile ? '100%' : '800px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    backgroundColor: 'white',
                    borderRadius: tokens.borderRadius.lg,
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    ...(isHighContrast ? getHighContrastStyles() : {}),
                }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-labelledby={titleId}
                aria-modal="true"
            >
                {/* Header */}
                <div
                    style={{
                        padding: tokens.spacing[6],
                        borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <h2
                        id={titleId}
                        style={{
                            fontSize: tokens.typography.fontSize.xl,
                            fontWeight: tokens.typography.fontWeight.bold,
                            color: tokens.colors.neutral[900],
                            margin: 0,
                        }}
                    >
                        Proposal Details
                    </h2>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        {...getButtonAria('Close modal')}
                    >
                        ✕
                    </Button>
                </div>

                {/* Content */}
                <div style={{ padding: tokens.spacing[6] }}>
                    {loading && (
                        <div
                            style={{
                                textAlign: 'center',
                                padding: tokens.spacing[8],
                                color: tokens.colors.neutral[600],
                            }}
                        >
                            <div style={{ fontSize: '32px', marginBottom: tokens.spacing[4] }}>⏳</div>
                            Loading proposal details...
                        </div>
                    )}

                    {error && (
                        <div
                            style={{
                                padding: tokens.spacing[4],
                                backgroundColor: tokens.colors.error[50],
                                borderRadius: tokens.borderRadius.md,
                                border: `1px solid ${tokens.colors.error[200]}`,
                                color: tokens.colors.error[700],
                                marginBottom: tokens.spacing[4],
                            }}
                        >
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {proposalDetails && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[6] }}>
                            {/* Proposer Information */}
                            <Card variant="outlined">
                                <CardHeader>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: tokens.spacing[4],
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '64px',
                                                height: '64px',
                                                borderRadius: '50%',
                                                backgroundColor: tokens.colors.primary[100],
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: tokens.typography.fontSize.xl,
                                                fontWeight: tokens.typography.fontWeight.semibold,
                                                color: tokens.colors.primary[700],
                                                border: `3px solid ${tokens.colors.primary[200]}`,
                                            }}
                                        >
                                            {proposalDetails.proposal.sourceSwap.ownerAvatar ? (
                                                <img
                                                    src={proposalDetails.proposal.sourceSwap.ownerAvatar}
                                                    alt={`${proposalDetails.proposal.sourceSwap.ownerName}'s avatar`}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        borderRadius: '50%',
                                                        objectFit: 'cover',
                                                    }}
                                                />
                                            ) : (
                                                proposalDetails.proposal.sourceSwap.ownerName.charAt(0).toUpperCase()
                                            )}
                                        </div>

                                        <div>
                                            <h3
                                                style={{
                                                    fontSize: tokens.typography.fontSize.xl,
                                                    fontWeight: tokens.typography.fontWeight.bold,
                                                    color: tokens.colors.neutral[900],
                                                    margin: 0,
                                                    marginBottom: tokens.spacing[1],
                                                }}
                                            >
                                                {proposalDetails.proposal.sourceSwap.ownerName}
                                            </h3>
                                            <div
                                                style={{
                                                    fontSize: tokens.typography.fontSize.base,
                                                    color: tokens.colors.neutral[600],
                                                }}
                                            >
                                                Proposed {formatDate(proposalDetails.proposal.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>

                            {/* Booking Details */}
                            <Card variant="outlined">
                                <CardHeader>
                                    <h4
                                        style={{
                                            fontSize: tokens.typography.fontSize.lg,
                                            fontWeight: tokens.typography.fontWeight.semibold,
                                            color: tokens.colors.neutral[900],
                                            margin: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: tokens.spacing[2],
                                        }}
                                    >
                                        <span style={{ fontSize: '24px' }}>
                                            {getBookingTypeIcon((proposalDetails.proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).type || 'hotel')}
                                        </span>
                                        {proposalDetails.proposal.sourceSwap.bookingDetails.title || 'Untitled Booking'}
                                    </h4>
                                </CardHeader>

                                <CardContent>
                                    {(proposalDetails.proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).description && (
                                        <p
                                            style={{
                                                fontSize: tokens.typography.fontSize.base,
                                                color: tokens.colors.neutral[700],
                                                lineHeight: tokens.typography.lineHeight.relaxed,
                                                margin: `0 0 ${tokens.spacing[4]} 0`,
                                            }}
                                        >
                                            {(proposalDetails.proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).description}
                                        </p>
                                    )}

                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                                            gap: tokens.spacing[4],
                                        }}
                                    >
                                        <div>
                                            <h5
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    fontWeight: tokens.typography.fontWeight.semibold,
                                                    color: tokens.colors.neutral[800],
                                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                                }}
                                            >
                                                Location & Dates
                                            </h5>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: tokens.spacing[2],
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    color: tokens.colors.neutral[600],
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                                    <span>📍</span>
                                                    <span>
                                                        {proposalDetails.proposal.sourceSwap.bookingDetails.location?.city || 'Unknown'},{' '}
                                                        {proposalDetails.proposal.sourceSwap.bookingDetails.location?.country || 'Unknown'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                                    <span>📅</span>
                                                    <span>{formatBookingDates(proposalDetails.proposal.sourceSwap.bookingDetails)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h5
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    fontWeight: tokens.typography.fontWeight.semibold,
                                                    color: tokens.colors.neutral[800],
                                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                                }}
                                            >
                                                Value & Capacity
                                            </h5>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: tokens.spacing[2],
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    color: tokens.colors.neutral[600],
                                                }}
                                            >
                                                <div>
                                                    <strong>Value:</strong> {FinancialDataHandler.formatCurrencyForContext(
                                                        proposalDetails.proposal.sourceSwap.bookingDetails.swapValue,
                                                        (proposalDetails.proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).currency,
                                                        'detail'
                                                    )}
                                                </div>
                                                {(proposalDetails.proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).capacity && (
                                                    <div>
                                                        <strong>Capacity:</strong> {(proposalDetails.proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).capacity} guests
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Action Restrictions */}
                            {proposalDetails.restrictions && proposalDetails.restrictions.length > 0 && (
                                <div
                                    style={{
                                        padding: tokens.spacing[4],
                                        backgroundColor: tokens.colors.warning[50],
                                        borderRadius: tokens.borderRadius.md,
                                        border: `1px solid ${tokens.colors.warning[200]}`,
                                    }}
                                >
                                    <h5
                                        style={{
                                            fontSize: tokens.typography.fontSize.base,
                                            fontWeight: tokens.typography.fontWeight.semibold,
                                            color: tokens.colors.warning[800],
                                            margin: `0 0 ${tokens.spacing[2]} 0`,
                                        }}
                                    >
                                        ⚠️ Action Restrictions
                                    </h5>
                                    <ul
                                        style={{
                                            margin: 0,
                                            paddingLeft: tokens.spacing[4],
                                            color: tokens.colors.warning[700],
                                            fontSize: tokens.typography.fontSize.sm,
                                        }}
                                    >
                                        {proposalDetails.restrictions.map((restriction, index) => (
                                            <li key={index}>{restriction}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                {proposalDetails && (proposalDetails.canAccept || proposalDetails.canReject) && (
                    <div
                        style={{
                            padding: tokens.spacing[6],
                            borderTop: `1px solid ${tokens.colors.neutral[200]}`,
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: tokens.spacing[3],
                        }}
                    >
                        {proposalDetails.canReject && (
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={handleReject}
                                disabled={actionLoading !== null}
                                style={{
                                    borderColor: tokens.colors.error[300],
                                    color: tokens.colors.error[700],
                                }}
                                {...getButtonAria('Reject this proposal')}
                            >
                                {actionLoading === 'reject' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                        <span>⏳</span>
                                        Rejecting...
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                        <span>❌</span>
                                        Reject Proposal
                                    </div>
                                )}
                            </Button>
                        )}

                        {proposalDetails.canAccept && (
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleAccept}
                                disabled={actionLoading !== null}
                                style={{
                                    backgroundColor: tokens.colors.success[500],
                                }}
                                {...getButtonAria('Accept this proposal')}
                            >
                                {actionLoading === 'accept' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                        <span>⏳</span>
                                        Accepting...
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                        <span>✅</span>
                                        Accept Proposal
                                    </div>
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProposalDetailsModal;