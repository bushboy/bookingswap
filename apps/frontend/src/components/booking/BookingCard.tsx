import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { Booking, BookingWithSwapInfo, BookingUserRole, SwapInfo } from '@booking-swap/shared';
import { BookingWithProposalStatus, getProposalStatusConfig, hasProposalStatus } from '@/types/browsePageFiltering';
import { SwapStatusBadge } from './SwapStatusBadge';
import { SwapInfoPanel } from './SwapInfoPanel';
import { OwnerActions, BrowserActions, ProposerActions } from './BookingActions';
import {
  isSwapConfigured,
  hasActiveSwap,
  isEditButtonEnabled,
  shouldShowViewButton,
  getEditButtonTooltip,
  getViewButtonTooltip
} from '@/utils/swapDetection';

export interface BookingCardProps {
  booking: BookingWithSwapInfo | BookingWithProposalStatus;
  userRole?: BookingUserRole;
  isAuthenticated?: boolean;
  onEdit?: (booking: Booking) => void;
  onDelete?: (bookingId: string) => void;
  onViewDetails?: (booking: Booking) => void;
  onCreateSwap?: (booking: Booking) => void;
  onMakeProposal?: () => void;
  onPropose?: (booking: BookingWithProposalStatus) => void;
  onManageSwap?: (swapInfo: SwapInfo) => void;
  onViewProposals?: (swapInfo: SwapInfo) => void;
  onViewProposal?: () => void;
  onEditProposal?: () => void;
  onWithdrawProposal?: () => void;
  compact?: boolean;
  showInlineProposal?: boolean;
  // Enhanced props for better swap integration
  onInlineProposal?: (bookingId: string, proposalData: any) => Promise<void>;
  showSwapIndicators?: boolean;
}

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  userRole,
  isAuthenticated = false,
  onEdit,

  onViewDetails,
  onCreateSwap,
  onMakeProposal,
  onPropose,
  onManageSwap,
  onViewProposals,
  onViewProposal,
  onEditProposal,
  onWithdrawProposal,
  compact = false,
  showInlineProposal = false,
  onInlineProposal,
  showSwapIndicators = true,
}) => {

  const [isHovered, setIsHovered] = useState(false);
  const [showSwapDetails, setShowSwapDetails] = useState(false);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [inlineProposalLoading, setInlineProposalLoading] = useState(false);

  const swapInfo = 'swapInfo' in booking ? booking.swapInfo : undefined;
  const isProposalStatusBooking = hasProposalStatus(booking);

  // Helper function to check if a swap is actually configured
  // Updated to use enhanced swap detection logic
  const hasSwapConfigured = isSwapConfigured;

  // Enhanced state management for button behavior
  const isBookingActive = booking.status === 'available';
  const editButtonEnabled = isEditButtonEnabled(swapInfo, isBookingActive);
  const editButtonTooltip = getEditButtonTooltip(swapInfo, isBookingActive);
  const viewButtonVisible = shouldShowViewButton(swapInfo, Boolean(onViewDetails));
  const viewButtonTooltip = getViewButtonTooltip();

  // Get action button configuration based on proposal status
  const getActionButton = () => {
    if (!isProposalStatusBooking) {
      // Fallback to original behavior for non-proposal status bookings
      return renderOriginalActions();
    }

    const proposalBooking = booking as BookingWithProposalStatus;

    if (!isAuthenticated) {
      return (
        <Button
          onClick={() => onPropose?.(proposalBooking)}
          variant="primary"
          size="sm"
        >
          Propose Swap
        </Button>
      );
    }

    // For authenticated users, show status-based buttons
    const statusConfig = getProposalStatusConfig(proposalBooking.userProposalStatus || 'none');

    return (
      <Button
        onClick={() => onPropose?.(proposalBooking)}
        variant={statusConfig.buttonDisabled ? "secondary" : "primary"}
        size="sm"
        disabled={statusConfig.buttonDisabled}
        title={statusConfig.tooltipText}
      >
        {statusConfig.buttonText}
      </Button>
    );
  };

  // Get proposal status indicator
  const getProposalStatusIndicator = () => {
    if (!isAuthenticated || !isProposalStatusBooking) {
      return null;
    }

    const proposalBooking = booking as BookingWithProposalStatus;
    const status = proposalBooking.userProposalStatus;

    if (!status || status === 'none') {
      return null;
    }

    const statusConfig = getProposalStatusConfig(status);

    return (
      <div
        className={`proposal-status ${statusConfig.styleClass}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: tokens.spacing[1],
          padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
          borderRadius: tokens.borderRadius.full,
          fontSize: tokens.typography.fontSize.xs,
          fontWeight: tokens.typography.fontWeight.medium,
          backgroundColor: getStatusIndicatorColor(statusConfig.color).bg,
          color: getStatusIndicatorColor(statusConfig.color).text,
          border: `1px solid ${getStatusIndicatorColor(statusConfig.color).border}`,
        }}
      >
        <span>{getStatusIcon(status)}</span>
        <span>{statusConfig.displayText}</span>
      </div>
    );
  };

  // Helper function to get status indicator colors
  const getStatusIndicatorColor = (color: 'default' | 'orange' | 'green' | 'red') => {
    switch (color) {
      case 'orange':
        return {
          bg: tokens.colors.warning[100],
          text: tokens.colors.warning[800],
          border: tokens.colors.warning[200],
        };
      case 'green':
        return {
          bg: tokens.colors.success[100],
          text: tokens.colors.success[800],
          border: tokens.colors.success[200],
        };
      case 'red':
        return {
          bg: tokens.colors.error[100],
          text: tokens.colors.error[800],
          border: tokens.colors.error[200],
        };
      default:
        return {
          bg: tokens.colors.neutral[100],
          text: tokens.colors.neutral[800],
          border: tokens.colors.neutral[200],
        };
    }
  };

  // Helper function to get status icons
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'accepted':
        return '✅';
      case 'rejected':
        return '❌';
      default:
        return '';
    }
  };

  // Render original actions for backward compatibility
  const renderOriginalActions = () => {
    if (!userRole) return null;

    const currentUserRole: BookingUserRole = userRole;

    switch (currentUserRole) {
      case 'owner':
        return (
          <OwnerActions
            booking={booking as BookingWithSwapInfo}
            swapInfo={swapInfo}
            onEdit={onEdit}
            onViewDetails={onViewDetails}
            onManageSwap={onManageSwap}
            onCreateSwap={onCreateSwap}
            onViewProposals={onViewProposals}
          />
        );

      case 'browser':
        return swapInfo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2] }}>
            <BrowserActions
              booking={booking as BookingWithSwapInfo}
              swapInfo={swapInfo}
              onMakeProposal={showInlineProposal ? () => setShowInlineForm(true) : onMakeProposal}
              onViewDetails={onViewDetails}
            />
            {showInlineForm && onInlineProposal && (
              <InlineProposalForm
                booking={booking as BookingWithSwapInfo}
                swapInfo={swapInfo}
                onSubmit={handleInlineProposal}
                onCancel={() => setShowInlineForm(false)}
                loading={inlineProposalLoading}
              />
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetails?.(booking)}
              title="View booking details"
            >
              View Details
            </Button>
          </div>
        );

      case 'proposer':
        return swapInfo ? (
          <ProposerActions
            booking={booking as BookingWithSwapInfo}
            swapInfo={swapInfo}
            onViewProposal={onViewProposal}
            onEditProposal={onEditProposal}
            onWithdrawProposal={onWithdrawProposal}
          />
        ) : null;

      default:
        return null;
    }
  };

  const cardStyles = {
    cursor: 'pointer',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
    boxShadow: isHovered ? tokens.shadows.lg : tokens.shadows.md,
    position: 'relative' as const,
  };

  const imageStyles = {
    width: '100%',
    height: compact ? '120px' : '200px',
    backgroundColor: tokens.colors.neutral[200],
    borderRadius: tokens.borderRadius.md,
    marginBottom: tokens.spacing[3],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colors.neutral[500],
    fontSize: tokens.typography.fontSize.sm,
    position: 'relative' as const,
  };

  const titleStyles = {
    fontSize: compact ? tokens.typography.fontSize.base : tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[2],
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacing[2],
  };

  const detailsStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing[3],
  };

  const priceStyles = {
    fontSize: compact ? tokens.typography.fontSize.lg : tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.primary[600],
    marginBottom: tokens.spacing[3],
  };

  const statusBadgeStyles = {
    display: 'inline-block',
    padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
    borderRadius: tokens.borderRadius.full,
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.medium,
    backgroundColor: getStatusColor(booking.status).bg,
    color: getStatusColor(booking.status).text,
  };

  const badgesContainerStyles = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[3],
    alignItems: 'center',
  };

  const paymentTypeBadgeStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: `2px ${tokens.spacing[2]}`,
    borderRadius: tokens.borderRadius.full,
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.medium,
    backgroundColor: tokens.colors.neutral[100],
    color: tokens.colors.neutral[700],
    border: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const actionsStyles = {
    marginTop: tokens.spacing[3],
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[2],
  };

  function getStatusColor(status: string) {
    switch (status) {
      case 'available':
        return {
          bg: tokens.colors.success[100],
          text: tokens.colors.success[800],
        };
      case 'swapping':
        return {
          bg: tokens.colors.warning[100],
          text: tokens.colors.warning[800],
        };
      case 'completed':
        return {
          bg: tokens.colors.neutral[100],
          text: tokens.colors.neutral[800],
        };
      case 'cancelled':
        return { bg: tokens.colors.error[100], text: tokens.colors.error[800] };
      default:
        return {
          bg: tokens.colors.neutral[100],
          text: tokens.colors.neutral[800],
        };
    }
  }

  function getTypeIcon(type: string): string {
    switch (type) {
      case 'hotel':
        return '🏨';
      case 'event':
        return '🎫';
      case 'flight':
        return '✈️';
      case 'rental':
        return '🏠';
      default:
        return '📋';
    }
  }

  function getPaymentTypeIcon(type: 'booking' | 'cash'): string {
    return type === 'booking' ? '🔄' : '💰';
  }

  const handleInlineProposal = async (proposalData: any) => {
    if (!onInlineProposal) return;

    setInlineProposalLoading(true);
    try {
      await onInlineProposal(booking.id, proposalData);
      setShowInlineForm(false);
    } catch (error) {
      console.error('Failed to submit proposal:', error);
    } finally {
      setInlineProposalLoading(false);
    }
  };

  const renderPaymentTypeBadges = () => {
    if (!swapInfo || !showSwapIndicators) return null;

    return (
      <div style={{ display: 'flex', gap: tokens.spacing[1] }}>
        {(swapInfo.paymentTypes || []).map((type) => (
          <span key={type} style={paymentTypeBadgeStyles}>
            {getPaymentTypeIcon(type)}
            {type === 'booking' ? 'Booking' : 'Cash'}
          </span>
        ))}
      </div>
    );
  };

  const handleCardClick = () => {
    if (userRole === 'owner' && onEdit) {
      onEdit(booking);
    } else if (userRole !== 'owner' && onViewDetails) {
      onViewDetails(booking);
    }
  };

  const renderActions = () => {
    // If this is a proposal status booking, use the new action button logic
    if (isProposalStatusBooking && onPropose) {
      return (
        <div style={{ display: 'flex', gap: tokens.spacing[2], justifyContent: 'flex-end' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails?.(booking)}
          >
            View Details
          </Button>
          {getActionButton()}
        </div>
      );
    }

    // Use enhanced action rendering with new button states
    return renderOriginalActions();
  };

  return (
    <Card
      variant="elevated"
      style={cardStyles}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <CardContent>
        <div style={imageStyles}>
          {getTypeIcon(booking.type)} Booking Image

          {/* Enhanced swap status overlays */}
          {swapInfo && showSwapIndicators && (
            <>
              {/* Main swap status badge */}
              <div
                style={{
                  position: 'absolute',
                  top: tokens.spacing[2],
                  right: tokens.spacing[2],
                }}
              >
                <SwapStatusBadge swapInfo={swapInfo} variant="compact" />
              </div>

              {/* Auction countdown overlay for urgent cases */}
              {swapInfo.acceptanceStrategy === 'auction' && swapInfo.timeRemaining && swapInfo.timeRemaining < 6 * 60 * 60 * 1000 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: tokens.spacing[2],
                    left: tokens.spacing[2],
                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                    backgroundColor: swapInfo.timeRemaining < 2 * 60 * 60 * 1000 ? tokens.colors.error[600] : tokens.colors.warning[600],
                    color: tokens.colors.white,
                    borderRadius: tokens.borderRadius.md,
                    fontSize: tokens.typography.fontSize.xs,
                    fontWeight: tokens.typography.fontWeight.bold,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  ⏰ {Math.ceil(swapInfo.timeRemaining / (1000 * 60 * 60))}h left
                </div>
              )}

              {/* Payment type indicators */}
              {!compact && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: tokens.spacing[2],
                    right: tokens.spacing[2],
                    display: 'flex',
                    gap: '4px',
                  }}
                >
                  {(swapInfo.paymentTypes || []).map((type) => (
                    <div
                      key={type}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: tokens.colors.white,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        border: `1px solid ${tokens.colors.neutral[300]}`,
                      }}
                      title={type === 'booking' ? 'Accepts booking swaps' : 'Accepts cash offers'}
                    >
                      {getPaymentTypeIcon(type)}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div style={titleStyles}>
          <div style={{ flex: 1 }}>
            <span>{booking.title}</span>
            {getProposalStatusIndicator() && (
              <div style={{ marginTop: tokens.spacing[1] }}>
                {getProposalStatusIndicator()}
              </div>
            )}
          </div>
          {userRole === 'owner' && (
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[500],
                fontStyle: 'italic',
                flexShrink: 0,
              }}
            >
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
          <span
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[500],
              textDecoration: 'line-through',
              marginLeft: tokens.spacing[2],
            }}
          >
            ${booking.originalPrice.toLocaleString()}
          </span>
        </div>

        <div style={badgesContainerStyles}>
          <span style={statusBadgeStyles}>
            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </span>

          {swapInfo && showSwapIndicators && hasSwapConfigured(swapInfo) && (
            <SwapStatusBadge swapInfo={swapInfo} variant="default" />
          )}

          {renderPaymentTypeBadges()}
        </div>

        {/* Enhanced Swap Information Panel - Only show if swap is actually configured */}
        {swapInfo && showSwapIndicators && (showSwapDetails || compact) && hasSwapConfigured(swapInfo) && (
          <SwapInfoPanel
            swapInfo={swapInfo}
            userRole={userRole || 'browser'}
            compact={compact}
            showFullDetails={true}
          />
        )}

        {/* Quick Swap Summary for compact view - Only show if swap is configured */}
        {swapInfo && showSwapIndicators && compact && !showSwapDetails && hasSwapConfigured(swapInfo) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing[2],
            padding: tokens.spacing[2],
            backgroundColor: tokens.colors.primary[50],
            borderRadius: tokens.borderRadius.md,
            marginBottom: tokens.spacing[2],
            fontSize: tokens.typography.fontSize.sm,
          }}>
            <span>💫 Available for swap</span>
            {swapInfo.minCashAmount && (
              <span style={{ color: tokens.colors.neutral[600] }}>
                Min: ${swapInfo.minCashAmount.toLocaleString()}
              </span>
            )}
            {swapInfo.acceptanceStrategy === 'auction' && swapInfo.timeRemaining && (
              <span style={{
                color: swapInfo.timeRemaining < 24 * 60 * 60 * 1000 ? tokens.colors.error[600] : tokens.colors.warning[600],
                fontWeight: tokens.typography.fontWeight.medium
              }}>
                ⏰ {Math.ceil(swapInfo.timeRemaining / (1000 * 60 * 60))}h left
              </span>
            )}
          </div>
        )}

        {/* Toggle for swap details in non-compact mode - Only show if swap is configured */}
        {swapInfo && !compact && hasSwapConfigured(swapInfo) && (
          <div style={{ marginBottom: tokens.spacing[2] }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowSwapDetails(!showSwapDetails);
              }}
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.primary[600],
                padding: `${tokens.spacing[1]} 0`,
              }}
            >
              {showSwapDetails ? '▼ Hide' : '▶ Show'} Swap Details
            </Button>
          </div>
        )}

        <div style={actionsStyles}>
          {renderActions()}
        </div>
      </CardContent>
    </Card>
  );
};

// Inline Proposal Form Component
interface InlineProposalFormProps {
  booking: BookingWithSwapInfo;
  swapInfo: SwapInfo;
  onSubmit: (proposalData: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const InlineProposalForm: React.FC<InlineProposalFormProps> = ({
  booking,
  swapInfo,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const [proposalType, setProposalType] = useState<'booking' | 'cash'>('booking');
  const [selectedBooking, setSelectedBooking] = useState<string>('');
  const [cashAmount, setCashAmount] = useState<number>(swapInfo?.minCashAmount || 0);
  const [message, setMessage] = useState('');

  const canMakeCashProposal = (swapInfo.paymentTypes || []).includes('cash');
  const canMakeBookingProposal = (swapInfo.paymentTypes || []).includes('booking');

  // Auto-select the only available option if there's just one
  React.useEffect(() => {
    if (canMakeCashProposal && !canMakeBookingProposal) {
      setProposalType('cash');
    } else if (canMakeBookingProposal && !canMakeCashProposal) {
      setProposalType('booking');
    }
  }, [canMakeCashProposal, canMakeBookingProposal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const proposalData = {
      type: proposalType,
      selectedBookingId: proposalType === 'booking' ? selectedBooking : undefined,
      cashAmount: proposalType === 'cash' ? cashAmount : undefined,
      message: message.trim() || undefined,
    };

    await onSubmit(proposalData);
  };

  const isValidProposal = () => {
    if (proposalType === 'booking') {
      return selectedBooking.length > 0;
    }
    if (proposalType === 'cash') {
      return cashAmount >= (swapInfo?.minCashAmount || 0);
    }
    return false;
  };

  const formStyles = {
    padding: tokens.spacing[3],
    backgroundColor: tokens.colors.neutral[50],
    borderRadius: tokens.borderRadius.md,
    border: `1px solid ${tokens.colors.neutral[200]}`,
    marginTop: tokens.spacing[2],
  };

  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing[3],
  };

  const fieldStyles = {
    marginBottom: tokens.spacing[3],
  };

  const labelStyles = {
    display: 'block',
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[700],
    marginBottom: tokens.spacing[1],
  };

  const inputStyles = {
    width: '100%',
    padding: tokens.spacing[2],
    borderRadius: tokens.borderRadius.md,
    border: `1px solid ${tokens.colors.neutral[300]}`,
    fontSize: tokens.typography.fontSize.sm,
  };

  const selectStyles = {
    ...inputStyles,
    backgroundColor: tokens.colors.white,
  };

  const actionsStyles = {
    display: 'flex',
    gap: tokens.spacing[2],
    justifyContent: 'flex-end',
  };

  return (
    <div style={formStyles}>
      <div style={headerStyles}>
        <h4 style={{ margin: 0, fontSize: tokens.typography.fontSize.base, fontWeight: tokens.typography.fontWeight.semibold }}>
          Make a Proposal
        </h4>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
          ✕
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        {(canMakeBookingProposal && canMakeCashProposal) && (
          <div style={fieldStyles}>
            <label style={labelStyles}>Proposal Type</label>
            <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                <input
                  type="radio"
                  value="booking"
                  checked={proposalType === 'booking'}
                  onChange={(e) => setProposalType(e.target.value as 'booking')}
                  disabled={loading}
                />
                🔄 Swap with my booking
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                <input
                  type="radio"
                  value="cash"
                  checked={proposalType === 'cash'}
                  onChange={(e) => setProposalType(e.target.value as 'cash')}
                  disabled={loading}
                />
                💰 Make cash offer
              </label>
            </div>
          </div>
        )}

        {proposalType === 'booking' && (
          <div style={fieldStyles}>
            <label style={labelStyles}>Select Your Booking</label>
            <select
              style={selectStyles}
              value={selectedBooking}
              onChange={(e) => setSelectedBooking(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">Choose a booking to swap...</option>
              {/* This would be populated with user's available bookings */}
              <option value="booking-1">Sample Booking 1</option>
              <option value="booking-2">Sample Booking 2</option>
            </select>
          </div>
        )}

        {proposalType === 'cash' && (
          <div style={fieldStyles}>
            <label style={labelStyles}>
              Cash Offer Amount
              {swapInfo.minCashAmount && (
                <span style={{ color: tokens.colors.neutral[500], fontWeight: 'normal' }}>
                  {' '}(min: ${swapInfo.minCashAmount.toLocaleString()})
                </span>
              )}
            </label>
            <input
              type="number"
              style={inputStyles}
              value={cashAmount}
              onChange={(e) => setCashAmount(Number(e.target.value))}
              min={swapInfo?.minCashAmount || 0}
              max={swapInfo?.maxCashAmount}
              disabled={loading}
              required
            />
          </div>
        )}

        <div style={fieldStyles}>
          <label style={labelStyles}>Message (Optional)</label>
          <textarea
            style={{ ...inputStyles, minHeight: '60px', resize: 'vertical' as const }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message to your proposal..."
            maxLength={500}
            disabled={loading}
          />
        </div>

        <div style={actionsStyles}>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!isValidProposal() || loading}
          >
            {loading ? 'Sending...' : 'Send Proposal'}
          </Button>
        </div>
      </form>
    </div>
  );
};
