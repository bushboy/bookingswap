import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { tokens } from '@/design-system/tokens';
import { useResponsive, useTouch } from '@/hooks/useResponsive';
import { Booking, BookingWithSwapInfo, BookingUserRole, SwapInfo } from '@booking-swap/shared';
import { SwapStatusBadge } from './SwapStatusBadge';
import { SwapInfoPanel } from './SwapInfoPanel';
import { MobileProposalForm } from './MobileProposalForm';
import { isSwapConfigured } from '@/utils/swapDetection';

export interface TouchFriendlyBookingCardProps {
  booking: BookingWithSwapInfo;
  userRole: BookingUserRole;
  userBookings?: Booking[];
  onEdit?: (booking: Booking) => void;
  onViewDetails?: (booking: Booking) => void;
  onCreateSwap?: (booking: Booking) => void;
  onMakeProposal?: (bookingId: string, proposalData: any) => Promise<void>;
  onManageSwap?: (swapInfo: SwapInfo) => void;

  onViewProposal?: () => void;
  onEditProposal?: () => void;
  onWithdrawProposal?: () => void;
  compact?: boolean;
  showSwapIndicators?: boolean;
}

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
  direction: 'left' | 'right' | null;
}

// Touch-friendly action button component
const TouchActionButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: string;
  disabled?: boolean;
}> = ({ children, onClick, variant = 'secondary', icon, disabled }) => {
  const [isPressed, setIsPressed] = useState(false);

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: tokens.colors.primary[500],
          color: tokens.colors.white,
          border: `2px solid ${tokens.colors.primary[500]}`,
        };
      case 'danger':
        return {
          backgroundColor: tokens.colors.error[500],
          color: tokens.colors.white,
          border: `2px solid ${tokens.colors.error[500]}`,
        };
      default:
        return {
          backgroundColor: tokens.colors.white,
          color: tokens.colors.neutral[700],
          border: `2px solid ${tokens.colors.neutral[300]}`,
        };
    }
  };

  const buttonStyles: React.CSSProperties = {
    ...getVariantStyles(),
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    borderRadius: tokens.borderRadius.lg,
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : isPressed ? 0.8 : 1,
    transition: 'all 0.15s ease-in-out',
    minHeight: '48px', // Touch-friendly minimum
    minWidth: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    transform: isPressed ? 'scale(0.98)' : 'scale(1)',
    boxShadow: isPressed ? tokens.shadows.sm : tokens.shadows.md,
  };

  return (
    <button
      style={buttonStyles}
      onClick={onClick}
      disabled={disabled}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onTouchCancel={() => setIsPressed(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {icon && <span style={{ fontSize: tokens.typography.fontSize.lg }}>{icon}</span>}
      {children}
    </button>
  );
};

// Swipe actions overlay
const SwipeActionsOverlay: React.FC<{
  direction: 'left' | 'right';
  actions: Array<{
    label: string;
    icon: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
  isVisible: boolean;
}> = ({ direction, actions, isVisible }) => {
  const overlayStyles: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    [direction]: 0,
    width: `${actions.length * 80}px`,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: tokens.colors.neutral[100],
    borderRadius: tokens.borderRadius.lg,
    opacity: isVisible ? 1 : 0,
    transform: `translateX(${isVisible ? 0 : direction === 'left' ? '-100%' : '100%'})`,
    transition: 'all 0.2s ease-in-out',
    zIndex: 1,
  };

  const actionStyles: React.CSSProperties = {
    width: '80px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    gap: tokens.spacing[1],
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[700],
  };

  return (
    <div style={overlayStyles}>
      {actions.map((action, index) => (
        <div
          key={index}
          style={actionStyles}
          onClick={action.onClick}
        >
          <span style={{ fontSize: tokens.typography.fontSize.xl }}>{action.icon}</span>
          <span>{action.label}</span>
        </div>
      ))}
    </div>
  );
};

export const TouchFriendlyBookingCard: React.FC<TouchFriendlyBookingCardProps> = ({
  booking,
  userRole,
  userBookings = [],
  onEdit,
  onViewDetails,
  onCreateSwap,
  onMakeProposal,
  onManageSwap,

  onViewProposal,
  onEditProposal,
  onWithdrawProposal,
  compact = false,
  showSwapIndicators = true,
}) => {
  const { isMobile } = useResponsive();
  const isTouch = useTouch();


  const [isPressed, setIsPressed] = useState(false);
  const [showSwapDetails, setShowSwapDetails] = useState(false);
  const [showMobileProposal, setShowMobileProposal] = useState(false);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
    direction: null,
  });
  const [showSwipeActions, setShowSwipeActions] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const swipeThreshold = 80; // Minimum swipe distance to trigger actions

  const swapInfo = booking.swapInfo;

  // Helper function to check if a swap is actually configured
  // Updated to use enhanced swap detection logic
  const hasSwapConfigured = isSwapConfigured;

  // Swipe gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isTouch) return;

    const touch = e.touches[0];
    setSwipeState({
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      isDragging: true,
      direction: null,
    });
  }, [isTouch]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeState.isDragging) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;

    // Determine if this is a horizontal swipe
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      e.preventDefault(); // Prevent scrolling

      const direction = deltaX > 0 ? 'right' : 'left';

      setSwipeState(prev => ({
        ...prev,
        currentX: touch.clientX,
        currentY: touch.clientY,
        direction,
      }));

      // Show actions if swiped far enough
      if (Math.abs(deltaX) > swipeThreshold) {
        setShowSwipeActions(true);
      }

      // Apply transform to card
      if (cardRef.current) {
        const maxTranslate = 120;
        const translateX = Math.max(-maxTranslate, Math.min(maxTranslate, deltaX * 0.5));
        cardRef.current.style.transform = `translateX(${translateX}px)`;
      }
    }
  }, [swipeState.isDragging, swipeState.startX, swipeState.startY, swipeThreshold]);

  const handleTouchEnd = useCallback(() => {
    if (!swipeState.isDragging) return;

    const deltaX = swipeState.currentX - swipeState.startX;

    // Reset card position
    if (cardRef.current) {
      cardRef.current.style.transform = 'translateX(0)';
    }

    // If swiped far enough, keep actions visible briefly
    if (Math.abs(deltaX) > swipeThreshold) {
      setTimeout(() => setShowSwipeActions(false), 2000);
    } else {
      setShowSwipeActions(false);
    }

    setSwipeState(prev => ({ ...prev, isDragging: false }));
  }, [swipeState, swipeThreshold]);

  // Define swipe actions based on user role
  const getSwipeActions = () => {
    const leftActions: Array<{
      label: string;
      icon: string;
      onClick: () => void;
      variant?: 'primary' | 'secondary' | 'danger';
    }> = [];

    const rightActions: Array<{
      label: string;
      icon: string;
      onClick: () => void;
      variant?: 'primary' | 'secondary' | 'danger';
    }> = [];

    switch (userRole) {
      case 'owner':
        leftActions.push({
          label: 'Edit',
          icon: '✏️',
          onClick: () => onEdit?.(booking),
        });
        if (swapInfo) {
          rightActions.push({
            label: 'Manage',
            icon: '⚙️',
            onClick: () => onManageSwap?.(swapInfo),
          });
        } else {
          rightActions.push({
            label: 'Add Swap',
            icon: '🔄',
            onClick: () => onCreateSwap?.(booking),
          });
        }
        break;

      case 'browser':
        if (swapInfo) {
          leftActions.push({
            label: 'Propose',
            icon: '💬',
            onClick: () => setShowMobileProposal(true),
            variant: 'primary',
          });
        }
        rightActions.push({
          label: 'Details',
          icon: '👁️',
          onClick: () => onViewDetails?.(booking),
        });
        break;

      case 'proposer':
        if (swapInfo) {
          leftActions.push({
            label: 'View',
            icon: '👁️',
            onClick: () => onViewProposal?.(),
          });
          rightActions.push({
            label: 'Edit',
            icon: '✏️',
            onClick: () => onEditProposal?.(),
          });
        }
        break;
    }

    return { leftActions, rightActions };
  };

  const { leftActions, rightActions } = getSwipeActions();

  // Card press handlers
  const handleCardPress = () => {
    if (!swipeState.isDragging) {
      if (userRole === 'owner' && onEdit) {
        onEdit(booking);
      } else if (userRole !== 'owner' && onViewDetails) {
        onViewDetails(booking);
      }
    }
  };

  // Main action buttons for mobile
  const renderMobileActions = () => {
    if (!isMobile) return null;

    const actionStyles: React.CSSProperties = {
      display: 'flex',
      gap: tokens.spacing[2],
      marginTop: tokens.spacing[3],
      flexWrap: 'wrap',
    };

    switch (userRole) {
      case 'owner':
        return (
          <div style={actionStyles}>
            <TouchActionButton
              onClick={() => onEdit?.(booking)}
              icon="✏️"
              disabled={swapInfo?.hasAnySwapInitiated}
            >
              Edit
            </TouchActionButton>
            {swapInfo ? (
              <TouchActionButton
                onClick={() => onManageSwap?.(swapInfo)}
                icon="⚙️"
                variant="primary"
              >
                Manage Swap
              </TouchActionButton>
            ) : (
              <TouchActionButton
                onClick={() => onCreateSwap?.(booking)}
                icon="🔄"
                variant="primary"
              >
                Add Swap
              </TouchActionButton>
            )}
          </div>
        );

      case 'browser':
        return swapInfo ? (
          <div style={actionStyles}>
            <TouchActionButton
              onClick={() => setShowMobileProposal(true)}
              icon="💬"
              variant="primary"
            >
              Make Proposal
            </TouchActionButton>
            <TouchActionButton
              onClick={() => onViewDetails?.(booking)}
              icon="👁️"
            >
              View Details
            </TouchActionButton>
          </div>
        ) : (
          <div style={actionStyles}>
            <TouchActionButton
              onClick={() => onViewDetails?.(booking)}
              icon="👁️"
            >
              View Details
            </TouchActionButton>
          </div>
        );

      case 'proposer':
        return swapInfo ? (
          <div style={actionStyles}>
            <TouchActionButton
              onClick={() => onViewProposal?.()}
              icon="👁️"
            >
              View Proposal
            </TouchActionButton>
            <TouchActionButton
              onClick={() => onEditProposal?.()}
              icon="✏️"
            >
              Edit
            </TouchActionButton>
            <TouchActionButton
              onClick={() => onWithdrawProposal?.()}
              icon="🗑️"
              variant="danger"
            >
              Withdraw
            </TouchActionButton>
          </div>
        ) : null;

      default:
        return null;
    }
  };

  const cardStyles: React.CSSProperties = {
    cursor: 'pointer',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    transform: isPressed ? 'scale(0.98)' : 'scale(1)',
    boxShadow: isPressed ? tokens.shadows.sm : tokens.shadows.md,
    position: 'relative',
    overflow: 'hidden',
    // Touch-friendly minimum size
    minHeight: compact ? '200px' : '280px',
  };

  const imageStyles: React.CSSProperties = {
    width: '100%',
    height: compact ? '100px' : '140px',
    backgroundColor: tokens.colors.neutral[200],
    borderRadius: tokens.borderRadius.md,
    marginBottom: tokens.spacing[3],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colors.neutral[500],
    fontSize: tokens.typography.fontSize.sm,
    position: 'relative',
  };

  const titleStyles: React.CSSProperties = {
    fontSize: compact ? tokens.typography.fontSize.base : tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[2],
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacing[2],
  };

  const detailsStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing[2],
    lineHeight: tokens.typography.lineHeight.relaxed,
  };

  const priceStyles: React.CSSProperties = {
    fontSize: compact ? tokens.typography.fontSize.lg : tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.primary[600],
    marginBottom: tokens.spacing[2],
  };

  const badgesContainerStyles: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[3],
    alignItems: 'center',
  };

  function getStatusColor(status: string) {
    switch (status) {
      case 'available':
        return { bg: tokens.colors.success[100], text: tokens.colors.success[800] };
      case 'swapping':
        return { bg: tokens.colors.warning[100], text: tokens.colors.warning[800] };
      case 'completed':
        return { bg: tokens.colors.neutral[100], text: tokens.colors.neutral[800] };
      case 'cancelled':
        return { bg: tokens.colors.error[100], text: tokens.colors.error[800] };
      default:
        return { bg: tokens.colors.neutral[100], text: tokens.colors.neutral[800] };
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'hotel': return '🏨';
      case 'event': return '🎫';
      case 'flight': return '✈️';
      case 'rental': return '🏠';
      default: return '📋';
    }
  }

  const statusBadgeStyles: React.CSSProperties = {
    display: 'inline-block',
    padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
    borderRadius: tokens.borderRadius.full,
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.medium,
    backgroundColor: getStatusColor(booking.status).bg,
    color: getStatusColor(booking.status).text,
  };

  return (
    <>
      <div
        style={cardStyles}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        onClick={handleCardPress}
        ref={cardRef}
      >
        <Card variant="elevated" style={{ height: '100%' }}>
          {/* Swipe actions overlays */}
          {isTouch && leftActions.length > 0 && (
            <SwipeActionsOverlay
              direction="left"
              actions={leftActions}
              isVisible={showSwipeActions && swipeState.direction === 'right'}
            />
          )}

          {isTouch && rightActions.length > 0 && (
            <SwipeActionsOverlay
              direction="right"
              actions={rightActions}
              isVisible={showSwipeActions && swipeState.direction === 'left'}
            />
          )}

          <CardContent>
            <div style={imageStyles}>
              {getTypeIcon(booking.type)} Booking Image

              {/* Enhanced swap status overlays */}
              {swapInfo && showSwapIndicators && (
                <>
                  <div style={{
                    position: 'absolute',
                    top: tokens.spacing[2],
                    right: tokens.spacing[2],
                  }}>
                    <SwapStatusBadge swapInfo={swapInfo} variant="compact" />
                  </div>

                  {/* Urgent auction countdown */}
                  {swapInfo.acceptanceStrategy === 'auction' &&
                    swapInfo.timeRemaining &&
                    swapInfo.timeRemaining < 6 * 60 * 60 * 1000 && (
                      <div style={{
                        position: 'absolute',
                        bottom: tokens.spacing[2],
                        left: tokens.spacing[2],
                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                        backgroundColor: swapInfo.timeRemaining < 2 * 60 * 60 * 1000
                          ? tokens.colors.error[600]
                          : tokens.colors.warning[600],
                        color: tokens.colors.white,
                        borderRadius: tokens.borderRadius.md,
                        fontSize: tokens.typography.fontSize.xs,
                        fontWeight: tokens.typography.fontWeight.bold,
                      }}>
                        ⏰ {Math.ceil(swapInfo.timeRemaining / (1000 * 60 * 60))}h left
                      </div>
                    )}
                </>
              )}
            </div>

            <div style={titleStyles}>
              <span>{booking.title}</span>
              {userRole === 'owner' && (
                <span style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.neutral[500],
                  fontStyle: 'italic',
                  flexShrink: 0,
                }}>
                  Your booking
                </span>
              )}
            </div>

            <div style={detailsStyles}>
              📍 {booking.location?.city || 'Unknown'}, {booking.location?.country || 'Unknown'}
              <br />
              📅 {booking.dateRange?.checkIn ? new Date(booking.dateRange.checkIn).toLocaleDateString() : 'Unknown'} -{' '}
              {booking.dateRange?.checkOut ? new Date(booking.dateRange.checkOut).toLocaleDateString() : 'Unknown'}
            </div>

            <div style={priceStyles}>
              ${booking.swapValue.toLocaleString()}
              <span style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[500],
                textDecoration: 'line-through',
                marginLeft: tokens.spacing[2],
              }}>
                ${booking.originalPrice.toLocaleString()}
              </span>
            </div>

            <div style={badgesContainerStyles}>
              <span style={statusBadgeStyles}>
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </span>

              {swapInfo && showSwapIndicators && (
                <SwapStatusBadge swapInfo={swapInfo} variant="default" />
              )}
            </div>

            {/* Swap info panel for expanded view */}
            {swapInfo && showSwapIndicators && showSwapDetails && (
              <SwapInfoPanel
                swapInfo={swapInfo}
                userRole={userRole}
                compact={compact}
              />
            )}

            {/* Quick swap summary for mobile - Only show if swap is configured */}
            {swapInfo && showSwapIndicators && isMobile && !showSwapDetails && hasSwapConfigured(swapInfo) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                padding: tokens.spacing[3],
                backgroundColor: tokens.colors.primary[50],
                borderRadius: tokens.borderRadius.md,
                marginBottom: tokens.spacing[3],
                fontSize: tokens.typography.fontSize.sm,
              }}>
                <span>💫 Available for swap</span>
                {swapInfo.minCashAmount && (
                  <span style={{ color: tokens.colors.neutral[600] }}>
                    Min: ${swapInfo.minCashAmount.toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* Swap details toggle - Only show if swap is configured */}
            {swapInfo && !compact && hasSwapConfigured(swapInfo) && (
              <TouchActionButton
                onClick={() => setShowSwapDetails(!showSwapDetails)}
              >
                {showSwapDetails ? '▲ Hide' : '▼ Show'} Swap Details
              </TouchActionButton>
            )}

            {/* Mobile action buttons */}
            {renderMobileActions()}

            {/* Swipe hint for first-time users */}
            {isTouch && (leftActions.length > 0 || rightActions.length > 0) && (
              <div style={{
                marginTop: tokens.spacing[2],
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[500],
                textAlign: 'center',
                fontStyle: 'italic',
              }}>
                💡 Swipe left or right for quick actions
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile proposal form */}
      {showMobileProposal && swapInfo && onMakeProposal && (
        <MobileProposalForm
          booking={booking}
          onSubmit={async (proposalData) => {
            await onMakeProposal(booking.id, proposalData);
            setShowMobileProposal(false);
          }}
          onCancel={() => setShowMobileProposal(false)}
          isOpen={showMobileProposal}
          userBookings={userBookings}
        />
      )}
    </>
  );
};