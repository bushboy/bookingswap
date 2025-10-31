import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useId, useAnnouncements, useHighContrast } from '../../hooks/useAccessibility';
import { SwapCardData, SwapStatus, EnhancedSwapCardData } from '@booking-swap/shared';
import { BookingType } from '@booking-swap/shared';
import { useSwapWebSocket } from '../../hooks/useSwapWebSocket';
import { getButtonAria, getFocusVisibleStyles, getHighContrastStyles } from '../../utils/accessibility';
import { ReceivedProposalsSection } from './ReceivedProposalsSection';

interface EnhancedSwapCardProps {
    swapData: SwapCardData | EnhancedSwapCardData;
    currentUserId?: string;
    onAcceptProposal?: (proposalId: string) => void;
    onRejectProposal?: (proposalId: string) => void;
    onViewDetails?: () => void;
    onMakeProposal?: (swapId: string) => void;
    // Targeting action handlers
    onAcceptTarget?: (targetId: string, proposalId: string) => Promise<void>;
    onRejectTarget?: (targetId: string, proposalId: string) => Promise<void>;
    onRetarget?: (swapId: string, currentTargetId: string) => Promise<void>;
    onCancelTargeting?: (swapId: string, targetId: string) => Promise<void>;
    onBrowseTargets?: (swapId: string) => void;
    // New targeting action integration
    onTargetingActionSuccess?: (action: any, result: any) => void;
    onTargetingActionError?: (action: any, error: string) => void;
    // Targeting history
    showTargetingHistory?: boolean;
}

const getStatusColor = (status: SwapStatus): string => {
    switch (status) {
        case 'pending':
            return tokens.colors.warning[500];
        case 'accepted':
            return tokens.colors.success[500];
        case 'rejected':
            return tokens.colors.error[500];
        case 'completed':
            return tokens.colors.primary[500];
        case 'cancelled':
            return tokens.colors.neutral[500];
        default:
            return tokens.colors.neutral[500];
    }
};

const getStatusIcon = (status: SwapStatus): string => {
    switch (status) {
        case 'pending':
            return '⏳';
        case 'accepted':
            return '✅';
        case 'rejected':
            return '❌';
        case 'completed':
            return '🎉';
        case 'cancelled':
            return '⚪';
        default:
            return '❓';
    }
};

const getBookingTypeIcon = (type: BookingType): string => {
    switch (type) {
        case 'hotel':
            return '🏨';
        case 'event':
            return '🎫';
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

// Import the financial data handler
import { FinancialDataHandler } from '../../utils/financialDataHandler';

const formatCurrency = (amount: any): string => {
    return FinancialDataHandler.formatCurrency(amount, 'USD');
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

const formatTimeRemaining = (expiresAt: Date): string => {
    const now = new Date();
    const timeLeft = new Date(expiresAt).getTime() - now.getTime();

    if (timeLeft <= 0) return 'Expired';

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
        (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;

    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m left`;
};

/**
 * Simple targeting indicators component for basic targeting information display
 * Shows incoming count and outgoing status with minimal visual design
 */
interface SimpleTargetingIndicatorsProps {
    incomingCount: number;
    hasOutgoing: boolean;
    onToggleDetails?: () => void;
}

const SimpleTargetingIndicators: React.FC<SimpleTargetingIndicatorsProps> = ({
    incomingCount,
    hasOutgoing,
    onToggleDetails
}) => {
    const { isMobile } = useResponsive();

    if (incomingCount === 0 && !hasOutgoing) {
        return null;
    }

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                cursor: onToggleDetails ? 'pointer' : 'default',
            }}
            onClick={onToggleDetails}
        >
            {/* Incoming targets indicator */}
            {incomingCount > 0 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[1],
                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                        backgroundColor: '#dcfce7',
                        border: '1px solid #10b981',
                        borderRadius: tokens.borderRadius.full,
                        fontSize: tokens.typography.fontSize.xs,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: '#15803d',
                    }}
                >
                    <span>📥</span>
                    <span>{incomingCount}</span>
                    {!isMobile && <span>targeting</span>}
                </div>
            )}

            {/* Outgoing target indicator */}
            {hasOutgoing && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[1],
                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                        backgroundColor: '#dbeafe',
                        border: '1px solid #3b82f6',
                        borderRadius: tokens.borderRadius.full,
                        fontSize: tokens.typography.fontSize.xs,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: '#1d4ed8',
                    }}
                >
                    <span>📤</span>
                    {!isMobile && <span>targeting</span>}
                </div>
            )}

            {/* Details toggle indicator */}
            {onToggleDetails && (
                <div
                    style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.neutral[500],
                        textDecoration: 'underline',
                    }}
                >
                    details
                </div>
            )}
        </div>
    );
};

export const EnhancedSwapCard: React.FC<EnhancedSwapCardProps> = ({
    swapData,
    currentUserId,
    onAcceptProposal,
    onRejectProposal,
    onViewDetails,
    onMakeProposal,
    onAcceptTarget,
    onRejectTarget,
    onRetarget,
    onCancelTargeting,
    onBrowseTargets,
    onTargetingActionSuccess,
    onTargetingActionError,
}) => {
    const { isMobile } = useResponsive();
    const { announce } = useAnnouncements();
    const { isHighContrast } = useHighContrast();
    const titleId = useId('swap-title');
    const statusId = useId('swap-status');
    const [currentSwapData, setCurrentSwapData] = useState(swapData);

    const [targetingExpanded, setTargetingExpanded] = useState(false);


    const { userSwap } = currentSwapData;
    const statusColor = getStatusColor(userSwap.status);
    const statusIcon = getStatusIcon(userSwap.status);
    const isExpired = userSwap.expiresAt
        ? new Date(userSwap.expiresAt) <= new Date()
        : false;
    const canTakeAction = userSwap.status === 'pending' && !isExpired;

    // Check if this is enhanced swap card data with targeting information
    const isEnhancedData = 'targeting' in currentSwapData;
    const enhancedData = isEnhancedData ? currentSwapData as EnhancedSwapCardData : null;
    const targeting = enhancedData?.targeting;

    // Targeting state
    const incomingTargets = targeting?.incomingTargets || [];
    const outgoingTarget = targeting?.outgoingTarget;
    const canTarget = targeting?.canTarget ?? true;

    // Debug logging to see what data we're receiving
    if (incomingTargets.length > 0 && incomingTargets[0]) {
        console.log('[SwapCard.enhanced] First incoming target:', {
            targetId: incomingTargets[0].targetId,
            sourceSwap: incomingTargets[0].sourceSwap,
            bookingDetails: incomingTargets[0].sourceSwap?.bookingDetails,
            location: incomingTargets[0].sourceSwap?.bookingDetails?.location,
            city: incomingTargets[0].sourceSwap?.bookingDetails?.location?.city,
            country: incomingTargets[0].sourceSwap?.bookingDetails?.location?.country,
        });
    }



    // Real-time WebSocket updates
    useSwapWebSocket({
        swapId: userSwap.id,
        autoJoinRoom: true,
        onSwapUpdate: (swapId, event) => {
            if (swapId === userSwap.id) {
                // Update local swap state based on the event
                setCurrentSwapData(prev => ({
                    ...prev,
                    userSwap: {
                        ...prev.userSwap,
                        status: event.data.newStatus || prev.userSwap.status,
                    }
                }));

                // Announce status changes to screen readers
                if (event.data.newStatus) {
                    const statusMessages = {
                        accepted: 'Swap has been accepted',
                        rejected: 'Swap has been rejected',
                        completed: 'Swap has been completed',
                        cancelled: 'Swap has been cancelled',
                    };

                    const message =
                        statusMessages[event.data.newStatus as keyof typeof statusMessages];
                    if (message) {
                        announce(message, 'assertive');
                    }
                }
            }
        },
    });

    // Update local state when prop changes
    useEffect(() => {
        setCurrentSwapData(swapData);
    }, [swapData]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Handle space key separately for card activation
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onViewDetails?.();
            announce(`Opening details for ${userSwap.bookingDetails?.title || 'swap'}`, 'polite');
            return;
        }
    };



    const handleTargetingAction = async (action: any) => {
        try {
            switch (action.type) {
                case 'accept_target':
                    if (onAcceptTarget && action.targetId) {
                        await onAcceptTarget(action.targetId, action.metadata?.proposalId || '');
                        announce('Target accepted', 'polite');
                    }
                    break;
                case 'reject_target':
                    if (onRejectTarget && action.targetId) {
                        await onRejectTarget(action.targetId, action.metadata?.proposalId || '');
                        announce('Target rejected', 'polite');
                    }
                    break;
                case 'retarget':
                    if (onRetarget && action.swapId) {
                        await onRetarget(action.swapId, action.targetId || '');
                        announce('Retargeting initiated', 'polite');
                    }
                    break;
                case 'cancel_targeting':
                    if (onCancelTargeting && action.swapId && action.targetId) {
                        await onCancelTargeting(action.swapId, action.targetId);
                        announce('Targeting cancelled', 'polite');
                    }
                    break;
                case 'view_details':
                    setTargetingExpanded(!targetingExpanded);
                    break;
                default:
                    console.warn('Unknown targeting action:', action.type);
            }
        } catch (error) {
            console.error('Error handling targeting action:', error);
            announce('Targeting action failed', 'assertive');
        }
    };

    // Generate comprehensive accessibility attributes
    const cardAriaProps = getButtonAria(
        `Swap card for ${userSwap.bookingDetails?.title || 'booking'}`,
        undefined,
        undefined,
        false
    );
    const cardDescription = `Swap card: ${userSwap.bookingDetails?.title || 'booking'} in ${userSwap.bookingDetails?.location?.city || 'unknown location'}, status: ${userSwap.status}, ${incomingTargets.length} incoming targets${outgoingTarget ? ', 1 outgoing target' : ''}`;

    return (
        <Card
            variant="elevated"
            style={{
                width: '100%',
                maxWidth: isMobile ? '100%' : '900px',
                cursor: onViewDetails ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                ...(isHighContrast ? getHighContrastStyles() : {}),
            }}
            onFocus={(e) => {
                const focusStyles = getFocusVisibleStyles(isHighContrast ? '#ffff00' : '#0066cc');
                Object.assign(e.target.style, focusStyles);
            }}
            onBlur={(e) => {
                e.target.style.outline = '';
                e.target.style.outlineOffset = '';
                e.target.style.boxShadow = '';
            }}
            tabIndex={onViewDetails ? 0 : undefined}
            {...cardAriaProps}
            aria-describedby={`${statusId}`}
            onKeyDown={handleKeyDown}
            title={cardDescription}
        >
            <CardHeader
                style={{
                    padding: isMobile
                        ? tokens.spacing[4]
                        : `${tokens.spacing[6]} ${tokens.spacing[6]} ${tokens.spacing[4]}`,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                        flexWrap: 'wrap',
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
                                id={statusId}
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: statusColor,
                                    textTransform: 'capitalize',
                                }}
                            >
                                {userSwap.status}
                            </span>
                        </div>

                        {/* Accurate Targeting Indicators */}
                        {(incomingTargets.length > 0 || outgoingTarget) && (
                            <SimpleTargetingIndicators
                                incomingCount={incomingTargets.length}
                                hasOutgoing={!!outgoingTarget}
                                onToggleDetails={() => setTargetingExpanded(!targetingExpanded)}
                            />
                        )}



                        {userSwap.status === 'pending' && userSwap.expiresAt && (
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: isExpired
                                        ? tokens.colors.error[600]
                                        : tokens.colors.warning[600],
                                    fontWeight: tokens.typography.fontWeight.medium,
                                }}
                            >
                                {formatTimeRemaining(userSwap.expiresAt)}
                            </div>
                        )}
                    </div>

                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.neutral[500],
                        }}
                    >
                        Created {formatDate(userSwap.createdAt)}
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {/* Main Swap Layout */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr auto 1fr',
                        gap: isMobile ? tokens.spacing[4] : tokens.spacing[6],
                        marginBottom: tokens.spacing[6],
                    }}
                >
                    {/* Left Side: User's Own Swap */}
                    <div
                        style={{
                            border: `2px solid ${tokens.colors.primary[300]}`,
                            borderRadius: tokens.borderRadius.lg,
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.primary[50],
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
                                {getBookingTypeIcon('hotel')}
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
                                Your Booking
                            </span>
                        </div>

                        <h4
                            id={titleId}
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[900],
                                margin: `0 0 ${tokens.spacing[2]} 0`,
                                lineHeight: tokens.typography.lineHeight.tight,
                            }}
                        >
                            {userSwap.bookingDetails?.title || 'Untitled Booking'}
                        </h4>

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[1],
                                marginBottom: tokens.spacing[2],
                                color: tokens.colors.neutral[600],
                                fontSize: tokens.typography.fontSize.sm,
                            }}
                        >
                            <span>📍</span>
                            <span>
                                {userSwap.bookingDetails?.location?.city || 'Unknown'},{' '}
                                {userSwap.bookingDetails?.location?.country || 'Unknown'}
                            </span>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[1],
                                marginBottom: tokens.spacing[3],
                                color: tokens.colors.neutral[600],
                                fontSize: tokens.typography.fontSize.sm,
                            }}
                        >
                            <span>📅</span>
                            <span>{formatBookingDates(userSwap.bookingDetails)}</span>
                        </div>

                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.lg,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.primary[600],
                            }}
                        >
                            {formatCurrency(userSwap.bookingDetails?.swapValue || 0)}
                        </div>
                    </div>

                    {/* Center: Targeting Activity Indicator */}
                    {!isMobile && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column',
                                gap: tokens.spacing[2],
                            }}
                        >
                            <div
                                style={{
                                    fontSize: '24px',
                                    color: tokens.colors.primary[500],
                                }}
                            >
                                🎯
                            </div>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    color: tokens.colors.neutral[500],
                                    textAlign: 'center',
                                    fontWeight: tokens.typography.fontWeight.medium,
                                }}
                            >
                                {incomingTargets.length} incoming
                                {outgoingTarget && (
                                    <>
                                        <br />
                                        1 outgoing
                                    </>
                                )}
                                {incomingTargets.length === 0 && !outgoingTarget && 'No targeting'}
                            </div>
                        </div>
                    )}

                    {/* Right Side: Accurate Targeting Display */}
                    <div
                        style={{
                            border: `2px solid ${tokens.colors.neutral[200]}`,
                            borderRadius: tokens.borderRadius.lg,
                            padding: tokens.spacing[4],
                            backgroundColor: 'white',
                            minHeight: '200px',
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
                            <span style={{ fontSize: '20px' }}>🎯</span>
                            <span
                                style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: tokens.colors.neutral[600],
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                Targeting Activity
                            </span>
                        </div>

                        {/* Display targeting information based on database data */}
                        {(incomingTargets.length === 0 && !outgoingTarget) ? (
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '150px',
                                    textAlign: 'center',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: '48px',
                                        marginBottom: tokens.spacing[2],
                                        opacity: 0.5,
                                    }}
                                >
                                    🎯
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.base,
                                        fontWeight: tokens.typography.fontWeight.medium,
                                        color: tokens.colors.neutral[600],
                                        marginBottom: tokens.spacing[1],
                                    }}
                                >
                                    No targeting activity
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        color: tokens.colors.neutral[500],
                                    }}
                                >
                                    No incoming or outgoing targets
                                </div>
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: tokens.spacing[3],
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                }}
                            >
                                {/* Incoming Targets Section */}
                                {incomingTargets.length > 0 && (
                                    <div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: tokens.spacing[2],
                                                marginBottom: tokens.spacing[2],
                                                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                                                backgroundColor: '#dcfce7',
                                                borderRadius: tokens.borderRadius.md,
                                                border: '1px solid #10b981',
                                            }}
                                        >
                                            <span style={{ fontSize: '16px' }}>📥</span>
                                            <span
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    fontWeight: tokens.typography.fontWeight.semibold,
                                                    color: '#15803d',
                                                }}
                                            >
                                                {incomingTargets.length} Incoming Target{incomingTargets.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        {incomingTargets.map((target) => (
                                            <div
                                                key={target.targetId}
                                                style={{
                                                    border: `1px solid #10b981`,
                                                    borderRadius: tokens.borderRadius.md,
                                                    padding: tokens.spacing[3],
                                                    backgroundColor: '#f0fdf4',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'flex-start',
                                                        marginBottom: tokens.spacing[2],
                                                    }}
                                                >
                                                    <div>
                                                        <h5
                                                            style={{
                                                                fontSize: tokens.typography.fontSize.sm,
                                                                fontWeight: tokens.typography.fontWeight.semibold,
                                                                color: tokens.colors.neutral[900],
                                                                margin: `0 0 ${tokens.spacing[1]} 0`,
                                                            }}
                                                        >
                                                            {target.sourceSwap.bookingDetails?.title || 'Untitled Booking'}
                                                        </h5>
                                                        <div
                                                            style={{
                                                                fontSize: tokens.typography.fontSize.xs,
                                                                color: tokens.colors.neutral[600],
                                                            }}
                                                        >
                                                            by {target.sourceSwap.ownerName || 'Unknown User'}
                                                        </div>
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: tokens.typography.fontSize.sm,
                                                            fontWeight: tokens.typography.fontWeight.semibold,
                                                            color: tokens.colors.primary[600],
                                                        }}
                                                    >
                                                        {formatCurrency(target.sourceSwap.bookingDetails?.swapValue || 0)}
                                                    </div>
                                                </div>

                                                <div
                                                    style={{
                                                        fontSize: tokens.typography.fontSize.xs,
                                                        color: tokens.colors.neutral[600],
                                                        marginBottom: tokens.spacing[2],
                                                    }}
                                                >
                                                    📍 {target.sourceSwap.bookingDetails?.location?.city || 'Unknown'},{' '}
                                                    {target.sourceSwap.bookingDetails?.location?.country || 'Unknown'}
                                                    <br />
                                                    📅 {formatBookingDates(target.sourceSwap.bookingDetails)}
                                                </div>

                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: tokens.spacing[2],
                                                        marginBottom: tokens.spacing[2],
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                                            backgroundColor: target.status === 'active' ? '#dcfce7' :
                                                                target.status === 'accepted' ? '#dbeafe' :
                                                                    target.status === 'rejected' ? '#fef2f2' : '#f3f4f6',
                                                            border: `1px solid ${target.status === 'active' ? '#10b981' :
                                                                target.status === 'accepted' ? '#3b82f6' :
                                                                    target.status === 'rejected' ? '#ef4444' : '#9ca3af'}`,
                                                            borderRadius: tokens.borderRadius.full,
                                                            fontSize: tokens.typography.fontSize.xs,
                                                            fontWeight: tokens.typography.fontWeight.medium,
                                                            color: target.status === 'active' ? '#15803d' :
                                                                target.status === 'accepted' ? '#1d4ed8' :
                                                                    target.status === 'rejected' ? '#dc2626' : '#6b7280',
                                                            textTransform: 'capitalize',
                                                        }}
                                                    >
                                                        {target.status}
                                                    </div>
                                                </div>

                                                {canTakeAction && target.status === 'active' && (
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            gap: tokens.spacing[2],
                                                            marginTop: tokens.spacing[2],
                                                        }}
                                                    >
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => onRejectTarget?.(target.targetId, target.proposalId)}
                                                            style={{ flex: 1 }}
                                                        >
                                                            Reject
                                                        </Button>
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            onClick={() => onAcceptTarget?.(target.targetId, target.proposalId)}
                                                            style={{ flex: 1 }}
                                                        >
                                                            Accept
                                                        </Button>
                                                    </div>
                                                )}

                                                <div
                                                    style={{
                                                        fontSize: tokens.typography.fontSize.xs,
                                                        color: tokens.colors.neutral[500],
                                                        marginTop: tokens.spacing[1],
                                                    }}
                                                >
                                                    Targeted {formatDate(target.createdAt)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Outgoing Target Section */}
                                {outgoingTarget && (
                                    <div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: tokens.spacing[2],
                                                marginBottom: tokens.spacing[2],
                                                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                                                backgroundColor: '#dbeafe',
                                                borderRadius: tokens.borderRadius.md,
                                                border: '1px solid #3b82f6',
                                            }}
                                        >
                                            <span style={{ fontSize: '16px' }}>📤</span>
                                            <span
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    fontWeight: tokens.typography.fontWeight.semibold,
                                                    color: '#1d4ed8',
                                                }}
                                            >
                                                Outgoing Target
                                            </span>
                                        </div>

                                        <div
                                            style={{
                                                border: `1px solid #3b82f6`,
                                                borderRadius: tokens.borderRadius.md,
                                                padding: tokens.spacing[3],
                                                backgroundColor: '#eff6ff',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'flex-start',
                                                    marginBottom: tokens.spacing[2],
                                                }}
                                            >
                                                <div>
                                                    <h5
                                                        style={{
                                                            fontSize: tokens.typography.fontSize.sm,
                                                            fontWeight: tokens.typography.fontWeight.semibold,
                                                            color: tokens.colors.neutral[900],
                                                            margin: `0 0 ${tokens.spacing[1]} 0`,
                                                        }}
                                                    >
                                                        {outgoingTarget.targetSwap.bookingDetails?.title || 'Untitled Booking'}
                                                    </h5>
                                                    <div
                                                        style={{
                                                            fontSize: tokens.typography.fontSize.xs,
                                                            color: tokens.colors.neutral[600],
                                                        }}
                                                    >
                                                        owned by {outgoingTarget.targetSwap.ownerName || 'Unknown User'}
                                                    </div>
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: tokens.typography.fontSize.sm,
                                                        fontWeight: tokens.typography.fontWeight.semibold,
                                                        color: tokens.colors.primary[600],
                                                    }}
                                                >
                                                    {formatCurrency(outgoingTarget.targetSwap.bookingDetails?.swapValue || 0)}
                                                </div>
                                            </div>

                                            <div
                                                style={{
                                                    fontSize: tokens.typography.fontSize.xs,
                                                    color: tokens.colors.neutral[600],
                                                    marginBottom: tokens.spacing[2],
                                                }}
                                            >
                                                📍 {outgoingTarget.targetSwap.bookingDetails?.location?.city || 'Unknown'},{' '}
                                                {outgoingTarget.targetSwap.bookingDetails?.location?.country || 'Unknown'}
                                                <br />
                                                📅 {formatBookingDates(outgoingTarget.targetSwap.bookingDetails)}
                                            </div>

                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: tokens.spacing[2],
                                                    marginBottom: tokens.spacing[2],
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                                        backgroundColor: outgoingTarget.status === 'active' ? '#dbeafe' :
                                                            outgoingTarget.status === 'accepted' ? '#dcfce7' :
                                                                outgoingTarget.status === 'rejected' ? '#fef2f2' : '#f3f4f6',
                                                        border: `1px solid ${outgoingTarget.status === 'active' ? '#3b82f6' :
                                                            outgoingTarget.status === 'accepted' ? '#10b981' :
                                                                outgoingTarget.status === 'rejected' ? '#ef4444' : '#9ca3af'}`,
                                                        borderRadius: tokens.borderRadius.full,
                                                        fontSize: tokens.typography.fontSize.xs,
                                                        fontWeight: tokens.typography.fontWeight.medium,
                                                        color: outgoingTarget.status === 'active' ? '#1d4ed8' :
                                                            outgoingTarget.status === 'accepted' ? '#15803d' :
                                                                outgoingTarget.status === 'rejected' ? '#dc2626' : '#6b7280',
                                                        textTransform: 'capitalize',
                                                    }}
                                                >
                                                    {outgoingTarget.status}
                                                </div>
                                            </div>

                                            <div
                                                style={{
                                                    fontSize: tokens.typography.fontSize.xs,
                                                    color: tokens.colors.neutral[500],
                                                    marginTop: tokens.spacing[1],
                                                }}
                                            >
                                                Targeted {formatDate(outgoingTarget.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>



                {/* Proposals Section */}
                {currentSwapData.proposalsFromOthers && currentSwapData.proposalsFromOthers.length > 0 && (
                    <div style={{ marginTop: tokens.spacing[6] }}>
                        <ReceivedProposalsSection
                            proposals={currentSwapData.proposalsFromOthers}
                            onAcceptProposal={onAcceptProposal || (() => { })}
                            onRejectProposal={onRejectProposal || (() => { })}
                            showInCard={true}
                            maxVisibleInCard={2}
                        />
                    </div>
                )}

                {/* Simple Targeting Information Display */}
                {(incomingTargets.length > 0 || outgoingTarget) && targetingExpanded && (
                    <TargetingDisplayWithErrorHandling
                        targeting={targeting}
                        onTargetingAction={handleTargetingAction}
                    />
                )}
            </CardContent>

            {(onViewDetails || incomingTargets.length > 0 || outgoingTarget) && (
                <CardFooter
                    style={{
                        padding: tokens.spacing[4],
                        borderTop: `1px solid ${tokens.colors.neutral[200]}`,
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: tokens.spacing[3],
                        alignItems: 'stretch',
                    }}
                >
                    <div style={{
                        display: 'flex',
                        gap: tokens.spacing[2],
                        flex: 1,
                        flexWrap: 'wrap'
                    }}>
                        {onViewDetails && (
                            <Button
                                variant="outline"
                                onClick={onViewDetails}
                                style={{ flex: isMobile ? 'none' : 1 }}
                            >
                                View Details
                            </Button>
                        )}


                    </div>

                    {/* Targeting Actions in Footer */}
                    {(incomingTargets.length > 0 || outgoingTarget) && (
                        <div
                            style={{
                                display: 'flex',
                                gap: tokens.spacing[2],
                                flex: isMobile ? 'none' : 1,
                                justifyContent: 'flex-end',
                            }}
                        >
                            {outgoingTarget && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="small"
                                        onClick={() => onRetarget?.(userSwap.id, outgoingTarget.targetId)}
                                    >
                                        Retarget
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="small"
                                        onClick={() => onCancelTargeting?.(userSwap.id, outgoingTarget.targetId)}
                                    >
                                        Cancel
                                    </Button>
                                </>
                            )}
                            {canTarget && !outgoingTarget && (
                                <Button
                                    variant="outline"
                                    size="small"
                                    onClick={() => onBrowseTargets?.(userSwap.id)}
                                >
                                    Browse Targets
                                </Button>
                            )}
                        </div>
                    )}
                </CardFooter>
            )}


        </Card>
    );
};

/**
 * Targeting Display with Error Handling
 * Wraps the simple targeting display with error boundaries and validation
 */
interface TargetingDisplayWithErrorHandlingProps {
    targeting: any;
    onTargetingAction: (action: any) => void;
}

const TargetingDisplayWithErrorHandling: React.FC<TargetingDisplayWithErrorHandlingProps> = ({
    targeting,
    onTargetingAction,
}) => {
    // Validate targeting data structure
    const validateTargetingData = (data: any) => {
        if (!data) return { isValid: false, errors: ['No targeting data provided'] };

        const errors: string[] = [];

        // Check for required properties
        if (!Array.isArray(data.incomingTargets)) {
            errors.push('Invalid incoming targets data');
        }

        // Validate incoming targets structure
        if (data.incomingTargets) {
            data.incomingTargets.forEach((target: any, index: number) => {
                if (!target.targetId) errors.push(`Incoming target ${index + 1} missing targetId`);
                if (!target.sourceSwap?.bookingDetails?.title) errors.push(`Incoming target ${index + 1} missing booking details`);
                if (!target.sourceSwap?.ownerName) errors.push(`Incoming target ${index + 1} missing owner name`);
            });
        }

        // Validate outgoing target structure
        if (data.outgoingTarget) {
            if (!data.outgoingTarget.targetId) errors.push('Outgoing target missing targetId');
            if (!data.outgoingTarget.targetSwap?.bookingDetails?.title) errors.push('Outgoing target missing booking details');
            if (!data.outgoingTarget.targetSwap?.ownerName) errors.push('Outgoing target missing owner name');
        }

        return { isValid: errors.length === 0, errors };
    };

    const validation = validateTargetingData(targeting);

    // Show error state if validation fails
    if (!validation.isValid) {
        return (
            <div
                style={{
                    marginTop: tokens.spacing[4],
                    padding: tokens.spacing[4],
                    backgroundColor: '#fef2f2',
                    borderRadius: tokens.borderRadius.md,
                    border: '1px solid #fecaca',
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
                    <span style={{ fontSize: '16px' }}>⚠️</span>
                    <span
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: '#dc2626',
                        }}
                    >
                        Targeting Information Unavailable
                    </span>
                </div>
                <div
                    style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: '#7f1d1d',
                        marginBottom: tokens.spacing[2],
                    }}
                >
                    There was an issue loading targeting information for this swap.
                </div>
                <Button
                    variant="secondary"
                    size="small"
                    onClick={() => window.location.reload()}
                    style={{
                        fontSize: tokens.typography.fontSize.xs,
                    }}
                >
                    Refresh Page
                </Button>
            </div>
        );
    }

    // Provide safe defaults for missing data
    const safeIncomingTargets = targeting.incomingTargets || [];
    const safeOutgoingTarget = targeting.outgoingTarget || null;

    return (
        <SimpleTargetingDisplay
            incomingTargets={safeIncomingTargets}
            outgoingTarget={safeOutgoingTarget}
            onTargetingAction={onTargetingAction}
        />
    );
};

/**
 * Simple Targeting Display Component
 * Shows basic targeting information with minimal complexity
 */
interface SimpleTargetingDisplayProps {
    incomingTargets: any[];
    outgoingTarget?: any;
    onTargetingAction: (action: any) => void;
}

const SimpleTargetingDisplay: React.FC<SimpleTargetingDisplayProps> = ({
    incomingTargets,
    outgoingTarget,
    onTargetingAction,
}) => {
    const { isMobile } = useResponsive();

    const handleTargetAction = (action: string, targetId: string, swapId: string) => {
        onTargetingAction({
            type: action,
            targetId,
            swapId,
        });
    };

    return (
        <div
            style={{
                marginTop: tokens.spacing[4],
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.neutral[50],
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${tokens.colors.neutral[200]}`,
            }}
        >
            <h5
                style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[3]} 0`,
                }}
            >
                Targeting Information
            </h5>

            {/* Incoming Targets */}
            {incomingTargets.length > 0 && (
                <div style={{ marginBottom: tokens.spacing[4] }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                            marginBottom: tokens.spacing[2],
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>📥</span>
                        <span
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[700],
                            }}
                        >
                            {incomingTargets.length} swap{incomingTargets.length > 1 ? 's' : ''} targeting yours
                        </span>
                    </div>

                    {incomingTargets.slice(0, 2).map((target) => (
                        <div
                            key={target.targetId}
                            style={{
                                padding: tokens.spacing[3],
                                backgroundColor: 'white',
                                borderRadius: tokens.borderRadius.md,
                                border: `1px solid ${tokens.colors.neutral[200]}`,
                                marginBottom: tokens.spacing[2],
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: isMobile ? 'flex-start' : 'center',
                                    flexDirection: isMobile ? 'column' : 'row',
                                    gap: tokens.spacing[2],
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
                                        {target.sourceSwap.ownerName}'s {target.sourceSwap.bookingDetails.title}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: tokens.typography.fontSize.xs,
                                            color: tokens.colors.neutral[600],
                                        }}
                                    >
                                        {target.sourceSwap.bookingDetails.location?.city}, {target.sourceSwap.bookingDetails.location?.country}
                                    </div>
                                </div>

                                {target.status === 'active' && (
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: tokens.spacing[2],
                                            flexDirection: isMobile ? 'column' : 'row',
                                        }}
                                    >
                                        <Button
                                            variant="primary"
                                            size="small"
                                            onClick={() => handleTargetAction('accept_target', target.targetId, target.sourceSwapId)}
                                        >
                                            Accept
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="small"
                                            onClick={() => handleTargetAction('reject_target', target.targetId, target.sourceSwapId)}
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                )}

                                {target.status !== 'active' && (
                                    <div
                                        style={{
                                            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                            backgroundColor: target.status === 'accepted' ? '#dcfce7' : '#fee2e2',
                                            color: target.status === 'accepted' ? '#15803d' : '#dc2626',
                                            borderRadius: tokens.borderRadius.sm,
                                            fontSize: tokens.typography.fontSize.xs,
                                            fontWeight: tokens.typography.fontWeight.medium,
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        {target.status}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {incomingTargets.length > 2 && (
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.neutral[500],
                                fontStyle: 'italic',
                                textAlign: 'center',
                                padding: tokens.spacing[2],
                            }}
                        >
                            +{incomingTargets.length - 2} more targeting this swap
                        </div>
                    )}
                </div>
            )}

            {/* Outgoing Target */}
            {outgoingTarget && (
                <div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                            marginBottom: tokens.spacing[2],
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>📤</span>
                        <span
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[700],
                            }}
                        >
                            Your swap is targeting
                        </span>
                    </div>

                    <div
                        style={{
                            padding: tokens.spacing[3],
                            backgroundColor: 'white',
                            borderRadius: tokens.borderRadius.md,
                            border: `1px solid ${tokens.colors.neutral[200]}`,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: isMobile ? 'flex-start' : 'center',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: tokens.spacing[2],
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
                                    {outgoingTarget.targetSwap.ownerName}'s {outgoingTarget.targetSwap.bookingDetails.title}
                                </div>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    {outgoingTarget.targetSwap.bookingDetails.location?.city}, {outgoingTarget.targetSwap.bookingDetails.location?.country}
                                </div>
                            </div>

                            {outgoingTarget.status === 'active' && (
                                <Button
                                    variant="secondary"
                                    size="small"
                                    onClick={() => handleTargetAction('cancel_targeting', outgoingTarget.targetId, outgoingTarget.targetSwapId)}
                                >
                                    Cancel
                                </Button>
                            )}

                            {outgoingTarget.status !== 'active' && (
                                <div
                                    style={{
                                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                        backgroundColor: outgoingTarget.status === 'accepted' ? '#dcfce7' : '#fee2e2',
                                        color: outgoingTarget.status === 'accepted' ? '#15803d' : '#dc2626',
                                        borderRadius: tokens.borderRadius.sm,
                                        fontSize: tokens.typography.fontSize.xs,
                                        fontWeight: tokens.typography.fontWeight.medium,
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    {outgoingTarget.status}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {incomingTargets.length === 0 && !outgoingTarget && (
                <div
                    style={{
                        textAlign: 'center',
                        padding: tokens.spacing[4],
                        color: tokens.colors.neutral[500],
                        fontSize: tokens.typography.fontSize.sm,
                    }}
                >
                    No targeting activity for this swap
                </div>
            )}
        </div>
    );
};