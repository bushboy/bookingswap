import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useId, useAnnouncements, useKeyboardNavigation, useHighContrast } from '../../hooks/useAccessibility';
import { SwapWithBookings, SwapStatus } from '../../services/swapService';
import { BookingType, SwapCardData } from '@booking-swap/shared';
import { useSwapWebSocket } from '../../hooks/useSwapWebSocket';
import {
  SwapCardActions,
  EnhancedSwapCardProps,
  SwapWithProposalInfo
} from '@booking-swap/shared';
import { aria, screenReader, highContrast, touchTargets, KEYS } from '../../utils/accessibility';
import { EnhancedSwapCard } from './SwapCard.enhanced';

interface SwapCardProps {
  // Legacy props for backward compatibility
  swap?: SwapWithBookings | SwapWithProposalInfo;
  userRole?: 'proposer' | 'owner' | 'browser';
  mode?: 'browse' | 'own' | 'manage' | 'default' | 'dashboard' | 'compact';
  variant?: 'default' | 'dashboard' | 'compact';
  currentUserId?: string;
  actions?: SwapCardActions;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onViewDetails?: () => void;
  onComplete?: () => void;
  onMakeProposal?: (swapId: string) => void;
  onAction?: (action: string, swap: SwapWithBookings | SwapWithProposalInfo) => void;

  // New enhanced props
  swapData?: SwapCardData;
  onAcceptProposal?: (proposalId: string) => void;
  onRejectProposal?: (proposalId: string) => void;
  // Targeting action handlers
  onAcceptTarget?: (targetId: string, proposalId: string) => Promise<void>;
  onRejectTarget?: (targetId: string, proposalId: string) => Promise<void>;
  onRetarget?: (swapId: string, currentTargetId: string) => Promise<void>;
  onCancelTargeting?: (swapId: string, targetId: string) => Promise<void>;
  onBrowseTargets?: (swapId: string) => void;
  // New targeting action integration
  onTargetingActionSuccess?: (action: any, result: any) => void;
  onTargetingActionError?: (action: any, error: string) => void;
}

const getStatusColor = (status: SwapStatus): string => {
  switch (status) {
    case 'pending':
      return tokens.colors.warning[500];
    case 'active':
      return tokens.colors.info[500]; // Active = awaiting action, similar to pending
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
    case 'active':
      return '🔄'; // Active = in progress/awaiting action
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
      // Events typically have eventDate or startDate/endDate
      if (booking.eventDate) {
        return formatDate(booking.eventDate);
      } else if (booking.startDate && booking.endDate) {
        return `${formatDate(booking.startDate)} - ${formatDate(booking.endDate)}`;
      } else if (booking.startDate) {
        return formatDate(booking.startDate);
      } else if (booking.dateRange?.checkIn) {
        // Fallback to dateRange if available
        return formatDate(booking.dateRange.checkIn);
      }
      return 'Event date TBD';

    case 'hotel':
    case 'vacation_rental':
    case 'resort':
    case 'hostel':
    case 'bnb':
    default:
      // Accommodations have check-in/check-out dates
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

export const SwapCard: React.FC<SwapCardProps> = ({
  swap,
  userRole = 'browser',
  mode = 'default',
  variant = 'default',
  currentUserId,
  actions,
  onAccept,
  onReject,
  onCancel,
  onViewDetails,
  onComplete,
  onMakeProposal,
  onAction,
  // New enhanced props
  swapData,
  onAcceptProposal,
  onRejectProposal,
  onAcceptTarget,
  onRejectTarget,
  onRetarget,
  onCancelTargeting,
  onBrowseTargets,
  onTargetingActionSuccess,
  onTargetingActionError,
}) => {
  // If swapData is provided, use the enhanced SwapCard component
  if (swapData) {
    return (
      <EnhancedSwapCard
        swapData={swapData}
        currentUserId={currentUserId}
        onAcceptProposal={onAcceptProposal}
        onRejectProposal={onRejectProposal}
        onViewDetails={onViewDetails}
        onMakeProposal={onMakeProposal ? () => onMakeProposal(swapData.userSwap.id) : undefined}
        onAcceptTarget={onAcceptTarget}
        onRejectTarget={onRejectTarget}
        onRetarget={onRetarget}
        onCancelTargeting={onCancelTargeting}
        onBrowseTargets={onBrowseTargets}
        onTargetingActionSuccess={onTargetingActionSuccess}
        onTargetingActionError={onTargetingActionError}
      />
    );
  }

  // Legacy component logic for backward compatibility
  if (!swap) {
    return null;
  }

  const { isMobile, isTablet } = useResponsive();
  const { announce } = useAnnouncements();
  const { isHighContrast } = useHighContrast();
  const swapId = useId('swap-card');
  const titleId = useId('swap-title');
  const statusId = useId('swap-status');
  const timelineId = useId('swap-timeline');
  const [currentSwap, setCurrentSwap] = useState(swap);
  const [proposalButtonLoading, setProposalButtonLoading] = useState(false);
  const [proposalEligibilityChecked, setProposalEligibilityChecked] = useState(false);

  const statusColor = getStatusColor(currentSwap.status);
  const statusIcon = getStatusIcon(currentSwap.status);
  const isExpired = currentSwap.terms?.expiresAt
    ? new Date(currentSwap.terms.expiresAt) <= new Date()
    : false;
  const canTakeAction = currentSwap.status === 'pending' && !isExpired;

  // Determine if user can make a proposal in browse mode
  const isBrowseMode = mode === 'browse';
  const isOwnSwap = currentUserId && (currentSwap.proposerId === currentUserId || currentSwap.ownerId === currentUserId);
  const swapWithProposalInfo = currentSwap as SwapWithProposalInfo;

  // Proposal eligibility logic
  const canMakeProposal = isBrowseMode &&
    !isOwnSwap &&
    currentSwap.status === 'pending' &&
    !isExpired &&
    (actions?.canMakeProposal ?? swapWithProposalInfo.userCanPropose ?? true);

  const hasEligibleSwaps = actions?.hasEligibleSwaps ??
    (swapWithProposalInfo.userEligibleSwapsCount ?? 0) > 0;

  const proposalButtonText = actions?.proposalButtonText ??
    (hasEligibleSwaps ? 'Make Proposal' : 'No Eligible Swaps');

  const proposalButtonDisabled = !canMakeProposal || !hasEligibleSwaps || proposalButtonLoading;

  // Real-time WebSocket updates
  const { isConnected } = useSwapWebSocket({
    swapId: swap.id,
    autoJoinRoom: true,
    onSwapUpdate: (swapId, event) => {
      if (swapId === swap.id) {
        // Update local swap state based on the event
        setCurrentSwap(prev => ({
          ...prev,
          status: event.data.newStatus || prev.status,
          updatedAt: new Date(event.timestamp),
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
    setCurrentSwap(swap);
  }, [swap]);

  // Enhanced keyboard navigation
  const { handleKeyDown: keyboardHandler } = useKeyboardNavigation(
    () => {
      // Enter key - view details
      if (onAction) {
        onAction('view', currentSwap);
      } else {
        onViewDetails?.();
      }
      announce(`Opening details for ${currentSwap.sourceBooking?.title || 'swap'}`, 'polite');
    },
    undefined, // No escape handler for card
    undefined, // No arrow up
    undefined, // No arrow down
    undefined, // No arrow left
    undefined  // No arrow right
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle space key separately for card activation
    if (e.key === KEYS.SPACE) {
      e.preventDefault();
      if (onAction) {
        onAction('view', currentSwap);
      } else {
        onViewDetails?.();
      }
      announce(`Opening details for ${currentSwap.sourceBooking?.title || 'swap'}`, 'polite');
      return;
    }

    keyboardHandler(e);
  };

  const handleProposal = async () => {
    if (!canMakeProposal || !hasEligibleSwaps) return;

    setProposalButtonLoading(true);
    try {
      if (onMakeProposal) {
        await onMakeProposal(currentSwap.id);
      } else if (onAction) {
        await onAction('propose', currentSwap);
      }
      announce('Proposal creation started', 'polite');
    } catch (error) {
      console.error('Error initiating proposal:', error);
      announce('Failed to start proposal creation', 'assertive');
    } finally {
      setProposalButtonLoading(false);
    }
  };

  const handleAction = (action: string) => {
    if (onAction) {
      onAction(action, currentSwap);
    } else {
      // Fallback to individual handlers
      switch (action) {
        case 'accept':
          onAccept?.();
          break;
        case 'reject':
          onReject?.();
          break;
        case 'cancel':
          onCancel?.();
          break;
        case 'view':
          onViewDetails?.();
          break;
        case 'complete':
          onComplete?.();
          break;
        case 'propose':
          handleProposal();
          break;
      }
    }
  };

  // Generate comprehensive accessibility attributes
  const cardAriaProps = aria.swapCard(currentSwap, mode);
  const cardDescription = screenReader.describeSwapCard({
    title: currentSwap.sourceBooking?.title,
    location: currentSwap.sourceBooking?.location?.city,
    status: currentSwap.status,
    estimatedValue: currentSwap.sourceBooking?.swapValue,
    compatibilityScore: (currentSwap as SwapWithProposalInfo).compatibilityScore
  });

  return (
    <Card
      variant="elevated"
      style={{
        width: '100%',
        maxWidth: isMobile ? '100%' : '800px',
        cursor: onViewDetails || onAction ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        ...highContrast.getStyles(isHighContrast),
        // Enhanced focus styles for accessibility
        ':focus': {
          ...highContrast.getFocusStyles(isHighContrast),
          boxShadow: isHighContrast
            ? '0 0 0 3px #ffff00'
            : '0 0 0 2px #0066cc, 0 4px 12px rgba(0, 102, 204, 0.3)'
        }
      }}
      tabIndex={onViewDetails || onAction ? 0 : undefined}
      {...cardAriaProps}
      aria-describedby={`${statusId} ${timelineId}`}
      onKeyDown={handleKeyDown}
      // Add screen reader description
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
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: statusColor,
                  textTransform: 'capitalize',
                }}
              >
                {currentSwap.status}
              </span>
            </div>



            {currentSwap.status === 'pending' && (
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: isExpired
                    ? tokens.colors.error[600]
                    : tokens.colors.warning[600],
                  fontWeight: tokens.typography.fontWeight.medium,
                }}
              >
                {currentSwap.terms?.expiresAt
                  ? formatTimeRemaining(currentSwap.terms.expiresAt)
                  : 'No expiration'}
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.colors.neutral[500],
            }}
          >
            Proposed{' '}
            {currentSwap.timeline?.proposedAt
              ? formatDate(currentSwap.timeline.proposedAt)
              : 'Unknown date'}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Swap Direction Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: tokens.spacing[6],
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? tokens.spacing[2] : 0,
          }}
        >
          <div
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
              fontWeight: tokens.typography.fontWeight.medium,
              textAlign: 'center',
            }}
          >
            {userRole === 'proposer' ? 'Your Booking' : 'Their Booking'}
          </div>
          <div
            style={{
              margin: isMobile
                ? `${tokens.spacing[2]} 0`
                : `0 ${tokens.spacing[4]}`,
              fontSize: isMobile ? '20px' : '24px',
              color: tokens.colors.primary[500],
              transform: isMobile ? 'rotate(90deg)' : 'none',
            }}
          >
            ⇄
          </div>
          <div
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
              fontWeight: tokens.typography.fontWeight.medium,
              textAlign: 'center',
            }}
          >
            {userRole === 'proposer' ? 'Their Booking' : 'Your Booking'}
          </div>
        </div>

        {/* Bookings Display */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? '1fr'
              : 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: isMobile ? tokens.spacing[4] : tokens.spacing[6],
            marginBottom: tokens.spacing[6],
          }}
        >
          {/* Source Booking (Proposer's) */}
          <div
            style={{
              border: `2px solid ${userRole === 'proposer' ? tokens.colors.primary[300] : tokens.colors.neutral[200]}`,
              borderRadius: tokens.borderRadius.lg,
              padding: tokens.spacing[4],
              backgroundColor:
                userRole === 'proposer' ? tokens.colors.primary[50] : 'white',
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
                {getBookingTypeIcon(currentSwap.sourceBooking?.type || 'hotel')}
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
                {currentSwap.sourceBooking?.type || 'Unknown'}
              </span>
            </div>

            <h4
              style={{
                fontSize: tokens.typography.fontSize.base,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.neutral[900],
                margin: `0 0 ${tokens.spacing[2]} 0`,
                lineHeight: tokens.typography.lineHeight.tight,
              }}
            >
              {currentSwap.sourceBooking?.title || 'Untitled Booking'}
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
                {currentSwap.sourceBooking?.location?.city || 'Unknown'},{' '}
                {currentSwap.sourceBooking?.location?.country || 'Unknown'}
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
              <span>{formatBookingDates(currentSwap.sourceBooking)}</span>
            </div>

            <div
              style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.primary[600],
              }}
            >
              {formatCurrency(currentSwap.sourceBooking?.swapValue || 0)}
            </div>
          </div>

          {/* Target Booking (Owner's) */}
          <div
            style={{
              border: `2px solid ${userRole === 'owner' ? tokens.colors.primary[300] : tokens.colors.neutral[200]}`,
              borderRadius: tokens.borderRadius.lg,
              padding: tokens.spacing[4],
              backgroundColor:
                userRole === 'owner' ? tokens.colors.primary[50] : 'white',
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
                {getBookingTypeIcon(currentSwap.targetBooking?.type || 'hotel')}
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
                {currentSwap.targetBooking?.type || 'Unknown'}
              </span>
            </div>

            <h4
              style={{
                fontSize: tokens.typography.fontSize.base,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.neutral[900],
                margin: `0 0 ${tokens.spacing[2]} 0`,
                lineHeight: tokens.typography.lineHeight.tight,
              }}
            >
              {currentSwap.targetBooking?.title || 'Untitled Booking'}
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
                {currentSwap.targetBooking?.location?.city || 'Unknown'},{' '}
                {currentSwap.targetBooking?.location?.country || 'Unknown'}
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
              <span>{formatBookingDates(currentSwap.targetBooking)}</span>
            </div>

            <div
              style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.primary[600],
              }}
            >
              {formatCurrency(currentSwap.targetBooking?.swapValue || 0)}
            </div>
          </div>
        </div>

        {/* Swap Terms */}
        {(currentSwap.terms?.additionalPayment ||
          (currentSwap.terms?.conditions &&
            currentSwap.terms.conditions.length > 0)) && (
            <div
              style={{
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.neutral[50],
                borderRadius: tokens.borderRadius.md,
                marginBottom: tokens.spacing[4],
              }}
            >
              <h5
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  color: tokens.colors.neutral[900],
                  margin: `0 0 ${tokens.spacing[2]} 0`,
                }}
              >
                Swap Terms
              </h5>

              {currentSwap.terms?.additionalPayment && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  <span style={{ fontSize: '16px' }}>💰</span>
                  <span
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[700],
                    }}
                  >
                    Additional payment:{' '}
                    {formatCurrency(currentSwap.terms?.additionalPayment || 0)}
                  </span>
                </div>
              )}

              {currentSwap.terms?.conditions &&
                currentSwap.terms.conditions.length > 0 && (
                  <div>
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
                      {currentSwap.terms?.conditions?.map((condition, index) => (
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
            </div>
          )}

        {/* Timeline Display */}
        <div
          style={{
            padding: tokens.spacing[4],
            backgroundColor: tokens.colors.neutral[50],
            borderRadius: tokens.borderRadius.md,
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
            Timeline
          </h5>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.spacing[2],
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: tokens.colors.success[500],
                }}
              />
              <span
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[700],
                }}
              >
                Proposed on{' '}
                {currentSwap.timeline?.proposedAt
                  ? formatDate(currentSwap.timeline.proposedAt)
                  : 'Unknown date'}
              </span>
            </div>

            {currentSwap.timeline?.respondedAt && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[2],
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor:
                      currentSwap.status === 'accepted'
                        ? tokens.colors.success[500]
                        : tokens.colors.error[500],
                  }}
                />
                <span
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[700],
                  }}
                >
                  {currentSwap.status === 'accepted' ? 'Accepted' : 'Rejected'}{' '}
                  on{' '}
                  {formatDate(currentSwap.timeline?.respondedAt || new Date())}
                </span>
              </div>
            )}

            {currentSwap.timeline?.completedAt && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[2],
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: tokens.colors.primary[500],
                  }}
                />
                <span
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[700],
                  }}
                >
                  Completed on{' '}
                  {formatDate(currentSwap.timeline?.completedAt || new Date())}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter
        style={{
          padding: isMobile
            ? tokens.spacing[4]
            : `${tokens.spacing[4]} ${tokens.spacing[6]} ${tokens.spacing[6]}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: tokens.spacing[3],
            width: '100%',
            flexDirection: isMobile ? 'column' : 'row',
            flexWrap: 'wrap',
            justifyContent: isMobile ? 'stretch' : 'flex-end',
          }}
        >
          {(onViewDetails || onAction) && (
            <Button
              variant="outline"
              size="md"
              onClick={() => handleAction('view')}
              style={{
                flex: isMobile ? '1' : 'none',
                minHeight: '44px', // Touch target
              }}
            >
              View Details
            </Button>
          )}

          {/* Make Proposal button for browse mode */}
          {isBrowseMode && (
            <div style={{ position: 'relative', flex: isMobile ? '1' : 'none' }}>
              <Button
                variant={canMakeProposal && hasEligibleSwaps ? "primary" : "outline"}
                size="md"
                onClick={() => handleAction('propose')}
                disabled={proposalButtonDisabled}
                style={{
                  flex: isMobile ? '1' : 'none',
                  minHeight: '44px',
                  width: '100%',
                  opacity: proposalButtonDisabled ? 0.6 : 1,
                  cursor: proposalButtonDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title={
                  !canMakeProposal
                    ? (isOwnSwap ? "Cannot propose to your own swap" : "Swap not available for proposals")
                    : !hasEligibleSwaps
                      ? "You don't have any eligible swaps to propose"
                      : "Click to make a proposal for this swap"
                }
                aria-label={`${proposalButtonText}. ${!canMakeProposal
                  ? (isOwnSwap ? "Cannot propose to your own swap" : "Swap not available for proposals")
                  : !hasEligibleSwaps
                    ? "You don't have any eligible swaps to propose"
                    : "Click to make a proposal for this swap"
                  }`}
              >
                {proposalButtonLoading ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2]
                  }}>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTop: '2px solid currentColor',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}
                    />
                    Loading...
                  </div>
                ) : (
                  <>
                    {hasEligibleSwaps ? '🤝' : '❌'} {proposalButtonText}
                  </>
                )}
              </Button>


            </div>
          )}

          {canTakeAction && userRole === 'owner' && (
            <>
              {(onReject || onAction) && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => handleAction('reject')}
                  style={{
                    color: tokens.colors.error[600],
                    borderColor: tokens.colors.error[300],
                    flex: isMobile ? '1' : 'none',
                    minHeight: '44px',
                  }}
                >
                  Reject
                </Button>
              )}
              {(onAccept || onAction) && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleAction('accept')}
                  style={{
                    flex: isMobile ? '1' : 'none',
                    minHeight: '44px',
                  }}
                >
                  Accept Swap
                </Button>
              )}
            </>
          )}

          {canTakeAction &&
            userRole === 'proposer' &&
            (onCancel || onAction) && (
              <Button
                variant="outline"
                size="md"
                onClick={() => handleAction('cancel')}
                style={{
                  color: tokens.colors.error[600],
                  borderColor: tokens.colors.error[300],
                  flex: isMobile ? '1' : 'none',
                  minHeight: '44px',
                }}
              >
                Cancel Proposal
              </Button>
            )}

          {currentSwap.status === 'accepted' && (onComplete || onAction) && (
            <Button
              variant="primary"
              size="md"
              onClick={() => handleAction('complete')}
              style={{
                flex: isMobile ? '1' : 'none',
                minHeight: '44px',
              }}
            >
              Complete Swap
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

// Add CSS animations for loading spinner
const styleElement = document.createElement('style');
styleElement.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

if (!document.head.querySelector('style[data-swap-card-animations]')) {
  styleElement.setAttribute('data-swap-card-animations', 'true');
  document.head.appendChild(styleElement);
}
