import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useId, useAnnouncements, useHighContrast } from '../../hooks/useAccessibility';
import { IncomingTargetInfo, BookingType } from '@booking-swap/shared';

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
import { proposalService } from '../../services/proposalService';
import ProposalDetailsModal from './ProposalDetailsModal';
import { getButtonAria, getHighContrastStyles } from '../../utils/accessibility';

interface ProposalDetailCardProps {
    proposal: IncomingTargetInfo;
    onAccept: (proposalId: string) => void;
    onReject: (proposalId: string) => void;
    isProcessing?: boolean;
    showActions?: boolean;
}

const getBookingTypeIcon = (type: BookingType): string => {
    switch (type) {
        case 'hotel':
            return '🏨';
        case 'vacation_rental':
            return '🏠';
        case 'resort':
            return '🏖️';
        case 'hostel':
            return '🏠';
        case 'bnb':
            return '🏡';
        case 'event':
            return '🎫';
        case 'concert':
            return '🎵';
        case 'sports':
            return '⚽';
        case 'theater':
            return '🎭';
        case 'flight':
            return '✈️';
        case 'rental':
            return '🚗';
        default:
            return '📋';
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

const getStatusColor = (status: string): string => {
    switch (status) {
        case 'active':
            return tokens.colors.success[500];
        case 'cancelled':
            return tokens.colors.neutral[500];
        case 'accepted':
            return tokens.colors.success[600];
        case 'rejected':
            return tokens.colors.error[500];
        default:
            return tokens.colors.neutral[500];
    }
};

const getStatusIcon = (status: string): string => {
    switch (status) {
        case 'active':
            return '⏳';
        case 'cancelled':
            return '⚪';
        case 'accepted':
            return '✅';
        case 'rejected':
            return '❌';
        default:
            return '❓';
    }
};

export const ProposalDetailCard: React.FC<ProposalDetailCardProps> = ({
    proposal,
    onAccept,
    onReject,
    isProcessing = false,
    showActions = true,
}) => {
    const { isMobile } = useResponsive();
    const { announce } = useAnnouncements();
    const { isHighContrast } = useHighContrast();
    const cardId = useId('proposal-card');
    const titleId = useId('proposal-title');
    const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    const statusColor = getStatusColor(proposal.status);
    const statusIcon = getStatusIcon(proposal.status);
    const canTakeAction = proposal.status === 'active' && showActions;

    const handleAccept = async () => {
        if (isProcessing || actionLoading) return;

        setActionLoading('accept');
        try {
            // Debug logging to see what we're passing to the service
            console.log('ProposalDetailCard.handleAccept - Proposal data:', {
                proposalId: proposal.proposalId,
                targetId: proposal.targetId,
                sourceSwapId: proposal.sourceSwap.id,
                hasTargetId: !!proposal.targetId,
                targetIdLength: proposal.targetId?.length
            });

            const result = await proposalService.acceptProposal({
                proposalId: proposal.proposalId,
                targetId: proposal.targetId,
                swapId: proposal.sourceSwap.id
            });

            if (result.success) {
                announce(`Proposal from ${proposal.sourceSwap.ownerName} accepted`, 'polite');
                // Call the parent callback for UI updates
                await onAccept(proposal.proposalId);
            } else {
                throw new Error(result.error || 'Failed to accept proposal');
            }
        } catch (error) {
            console.error('Error accepting proposal:', error);
            announce('Failed to accept proposal', 'assertive');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (isProcessing || actionLoading) return;

        setActionLoading('reject');
        try {
            // Debug logging to see what we're passing to the service
            console.log('ProposalDetailCard.handleReject - Proposal data:', {
                proposalId: proposal.proposalId,
                targetId: proposal.targetId,
                sourceSwapId: proposal.sourceSwap.id,
                hasTargetId: !!proposal.targetId,
                targetIdLength: proposal.targetId?.length
            });

            const result = await proposalService.rejectProposal({
                proposalId: proposal.proposalId,
                targetId: proposal.targetId,
                swapId: proposal.sourceSwap.id,
                reason: 'Proposal rejected by user'
            });

            if (result.success) {
                announce(`Proposal from ${proposal.sourceSwap.ownerName} rejected`, 'polite');
                // Call the parent callback for UI updates
                await onReject(proposal.proposalId);
            } else {
                throw new Error(result.error || 'Failed to reject proposal');
            }
        } catch (error) {
            console.error('Error rejecting proposal:', error);
            announce('Failed to reject proposal', 'assertive');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <Card
            variant="outlined"
            style={{
                width: '100%',
                transition: 'all 0.2s ease',
                ...(isHighContrast ? getHighContrastStyles() : {}),
                border: `2px solid ${canTakeAction ? tokens.colors.primary[200] : tokens.colors.neutral[200]}`,
                backgroundColor: canTakeAction ? tokens.colors.primary[50] : 'white',
            }}
            id={cardId}
        >
            <CardHeader
                style={{
                    padding: isMobile
                        ? tokens.spacing[4]
                        : `${tokens.spacing[5]} ${tokens.spacing[6]} ${tokens.spacing[3]}`,
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
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[3],
                        }}
                    >
                        {/* Proposer Avatar/Initial */}
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
                            <h3
                                id={titleId}
                                style={{
                                    fontSize: tokens.typography.fontSize.lg,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[900],
                                    margin: 0,
                                    marginBottom: tokens.spacing[1],
                                }}
                            >
                                {proposal.sourceSwap.ownerName}
                            </h3>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                }}
                            >
                                Proposed {formatDate(proposal.createdAt)}
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                            padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                            borderRadius: tokens.borderRadius.full,
                            backgroundColor: `${statusColor}20`,
                            border: `1px solid ${statusColor}`,
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>{statusIcon}</span>
                        <span
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: statusColor,
                                textTransform: 'capitalize',
                            }}
                        >
                            {proposal.status}
                        </span>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {/* Proposer's Booking Details */}
                <div
                    style={{
                        border: `2px solid ${tokens.colors.neutral[200]}`,
                        borderRadius: tokens.borderRadius.lg,
                        padding: tokens.spacing[4],
                        backgroundColor: 'white',
                        marginBottom: tokens.spacing[4],
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                            marginBottom: tokens.spacing[3],
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>
                            {getBookingTypeIcon((proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).type || 'hotel')}
                        </span>
                        <span
                            style={{
                                fontSize: tokens.typography.fontSize.xs,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.primary[600],
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}
                        >
                            {(proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).type || 'Unknown'} • Their Booking
                        </span>
                    </div>

                    <h4
                        style={{
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[900],
                            margin: `0 0 ${tokens.spacing[3]} 0`,
                            lineHeight: tokens.typography.lineHeight.tight,
                        }}
                    >
                        {proposal.sourceSwap.bookingDetails.title || 'Untitled Booking'}
                    </h4>

                    {(proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).description && (
                        <p
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[700],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                                lineHeight: tokens.typography.lineHeight.relaxed,
                            }}
                        >
                            {(proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).description}
                        </p>
                    )}

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: tokens.spacing[3],
                            marginBottom: tokens.spacing[3],
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                                color: tokens.colors.neutral[600],
                                fontSize: tokens.typography.fontSize.sm,
                            }}
                        >
                            <span>📍</span>
                            <span>
                                {proposal.sourceSwap.bookingDetails.location?.city || 'Unknown'},{' '}
                                {proposal.sourceSwap.bookingDetails.location?.country || 'Unknown'}
                            </span>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                                color: tokens.colors.neutral[600],
                                fontSize: tokens.typography.fontSize.sm,
                            }}
                        >
                            <span>📅</span>
                            <span>{formatBookingDates(proposal.sourceSwap.bookingDetails)}</span>
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: tokens.spacing[3],
                            borderTop: `1px solid ${tokens.colors.neutral[200]}`,
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.xl,
                                    fontWeight: tokens.typography.fontWeight.bold,
                                    color: tokens.colors.primary[600],
                                }}
                            >
                                {FinancialDataHandler.formatCurrencyForContext(
                                    proposal.sourceSwap.bookingDetails.swapValue || 0,
                                    (proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).currency || 'USD',
                                    'detail'
                                )}
                            </div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    color: tokens.colors.neutral[500],
                                    marginTop: tokens.spacing[1],
                                }}
                            >
                                Proposed swap value
                            </div>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: tokens.spacing[1],
                            }}
                        >
                            {(proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).capacity && (
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: tokens.spacing[1],
                                        fontSize: tokens.typography.fontSize.sm,
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    <span>👥</span>
                                    <span>{(proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).capacity} guests</span>
                                </div>
                            )}

                            {(proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).amenities && (proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).amenities!.length > 0 && (
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.neutral[500],
                                    }}
                                >
                                    {(proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).amenities!.slice(0, 2).join(', ')}
                                    {(proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).amenities!.length > 2 && ` +${(proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).amenities!.length - 2} more`}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Auction Information (if applicable) */}
                {proposal.auctionInfo?.isAuction && (
                    <div
                        style={{
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.warning[50],
                            borderRadius: tokens.borderRadius.md,
                            border: `1px solid ${tokens.colors.warning[200]}`,
                            marginBottom: tokens.spacing[4],
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
                            <span style={{ fontSize: '20px' }}>🏆</span>
                            <h5
                                style={{
                                    fontSize: tokens.typography.fontSize.base,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.warning[800],
                                    margin: 0,
                                }}
                            >
                                Auction Proposal
                            </h5>
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(150px, 1fr))',
                                gap: tokens.spacing[3],
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.warning[700],
                            }}
                        >
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

                {/* Comprehensive Proposal Information */}
                <div
                    style={{
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.md,
                        marginBottom: canTakeAction ? tokens.spacing[4] : 0,
                    }}
                >
                    <h5
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[900],
                            margin: `0 0 ${tokens.spacing[3]} 0`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                        }}
                    >
                        <span>📋</span>
                        Proposal Summary
                    </h5>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                            gap: tokens.spacing[4],
                            marginBottom: tokens.spacing[4],
                        }}
                    >
                        <div>
                            <h6
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[800],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                }}
                            >
                                Proposal Details
                            </h6>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: tokens.spacing[1],
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                }}
                            >
                                <div>
                                    <strong>Submitted:</strong> {formatDate(proposal.createdAt)}
                                </div>
                                <div>
                                    <strong>Last updated:</strong> {formatDate(proposal.updatedAt)}
                                </div>
                                <div>
                                    <strong>Status:</strong> <span style={{ textTransform: 'capitalize' }}>{proposal.status}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h6
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[800],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                }}
                            >
                                Proposed Terms
                            </h6>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: tokens.spacing[1],
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                }}
                            >
                                <div>
                                    <strong>Exchange type:</strong> Direct swap
                                </div>
                                <div>
                                    <strong>Value:</strong> {FinancialDataHandler.formatCurrencyForContext(
                                        proposal.sourceSwap.bookingDetails.swapValue,
                                        (proposal.sourceSwap.bookingDetails as ExtendedBookingDetails).currency,
                                        'summary'
                                    )}
                                </div>
                                <div>
                                    <strong>Duration:</strong> {formatBookingDates(proposal.sourceSwap.bookingDetails)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Decision Context */}
                    <div
                        style={{
                            padding: tokens.spacing[3],
                            backgroundColor: 'white',
                            borderRadius: tokens.borderRadius.sm,
                            border: `1px solid ${tokens.colors.neutral[200]}`,
                        }}
                    >
                        <h6
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[800],
                                margin: `0 0 ${tokens.spacing[2]} 0`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[1],
                            }}
                        >
                            <span>💡</span>
                            What happens next?
                        </h6>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[600],
                                lineHeight: tokens.typography.lineHeight.relaxed,
                            }}
                        >
                            {canTakeAction ? (
                                <>
                                    <strong>Accept:</strong> You'll exchange your booking with {proposal.sourceSwap.ownerName}'s booking.
                                    Both parties will receive confirmation and next steps for the swap process.
                                    <br /><br />
                                    <strong>Reject:</strong> This proposal will be declined and {proposal.sourceSwap.ownerName} will be notified.
                                    You can continue to review other proposals.
                                </>
                            ) : (
                                `This proposal has been ${proposal.status}. No further action is required.`
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>

            {/* Action Buttons */}
            {canTakeAction && (
                <CardFooter
                    style={{
                        padding: tokens.spacing[4],
                        paddingTop: 0,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            gap: tokens.spacing[3],
                            justifyContent: 'space-between',
                            flexDirection: isMobile ? 'column' : 'row',
                            alignItems: isMobile ? 'stretch' : 'center',
                        }}
                    >
                        {/* View Details Button */}
                        <Button
                            variant="ghost"
                            size={isMobile ? 'md' : 'sm'}
                            onClick={() => setShowDetailsModal(true)}
                            style={{
                                color: tokens.colors.primary[600],
                            }}
                            {...getButtonAria('View complete proposal details')}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                <span>👁️</span>
                                View Details
                            </div>
                        </Button>

                        {/* Action Buttons */}
                        <div
                            style={{
                                display: 'flex',
                                gap: tokens.spacing[2],
                                flexDirection: isMobile ? 'column' : 'row',
                            }}
                        >
                            <Button
                                variant="outline"
                                size={isMobile ? 'lg' : 'md'}
                                onClick={handleReject}
                                disabled={isProcessing || actionLoading !== null}
                                style={{
                                    minWidth: isMobile ? '100%' : '120px',
                                    backgroundColor: actionLoading === 'reject' ? tokens.colors.error[50] : undefined,
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
                                        Reject
                                    </div>
                                )}
                            </Button>

                            <Button
                                variant="primary"
                                size={isMobile ? 'lg' : 'md'}
                                onClick={handleAccept}
                                disabled={isProcessing || actionLoading !== null}
                                style={{
                                    minWidth: isMobile ? '100%' : '120px',
                                    backgroundColor: actionLoading === 'accept' ? tokens.colors.success[600] : tokens.colors.success[500],
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
                                        Accept
                                    </div>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardFooter>
            )}

            {/* Proposal Details Modal */}
            <ProposalDetailsModal
                proposalId={proposal.proposalId}
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                onAccept={onAccept}
                onReject={onReject}
            />
        </Card>
    );
};