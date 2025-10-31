import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { SwapWithBookings, CashSwapDetails } from '../../services/bookingService';
import { BookingType } from '@booking-swap/shared';
import { FEATURE_FLAGS } from '../../config/featureFlags';

interface CashSwapCardProps {
  swap: SwapWithBookings;
  onMakeOffer: (swapId: string) => void;
  onViewOffers: (swapId: string) => void;
  onViewDetails: (swap: SwapWithBookings) => void;
  currentUserId?: string;
  loading?: boolean;
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

const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
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

export const CashSwapCard: React.FC<CashSwapCardProps> = ({
  swap,
  onMakeOffer,
  onViewOffers,
  onViewDetails,
  currentUserId,
  loading = false,
}) => {
  // Hide cash swap cards when feature is disabled
  if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS) {
    return null;
  }

  const { isMobile } = useResponsive();
  const [offerButtonLoading, setOfferButtonLoading] = useState(false);

  const isOwnSwap = currentUserId && swap.owner?.id === currentUserId;
  const cashDetails = swap.cashDetails;
  const booking = swap.sourceBooking;

  const handleMakeOffer = useCallback(async () => {
    if (isOwnSwap || !cashDetails) return;

    setOfferButtonLoading(true);
    try {
      await onMakeOffer(swap.id);
    } catch (error) {
      console.error('Error making cash offer:', error);
    } finally {
      setOfferButtonLoading(false);
    }
  }, [swap.id, onMakeOffer, isOwnSwap, cashDetails]);

  const handleViewOffers = useCallback(() => {
    onViewOffers(swap.id);
  }, [swap.id, onViewOffers]);

  const handleViewDetails = useCallback(() => {
    onViewDetails(swap);
  }, [swap, onViewDetails]);

  if (!cashDetails) {
    return null; // Don't render if not a cash swap
  }

  const containerStyles = {
    width: '100%',
    maxWidth: isMobile ? '100%' : '400px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: `2px solid ${tokens.colors.success[200]}`,
    backgroundColor: tokens.colors.success[25],
  };

  const headerStyles = {
    padding: isMobile
      ? tokens.spacing[4]
      : `${tokens.spacing[5]} ${tokens.spacing[5]} ${tokens.spacing[3]}`,
  };

  const contentStyles = {
    padding: `0 ${isMobile ? tokens.spacing[4] : tokens.spacing[5]} ${tokens.spacing[4]}`,
  };

  const footerStyles = {
    padding: `0 ${isMobile ? tokens.spacing[4] : tokens.spacing[5]} ${tokens.spacing[5]}`,
    borderTop: `1px solid ${tokens.colors.neutral[200]}`,
  };

  return (
    <Card
      variant="elevated"
      style={containerStyles}
      onClick={handleViewDetails}
    >
      <CardHeader style={headerStyles}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: tokens.spacing[3],
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[2],
              padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
              borderRadius: tokens.borderRadius.full,
              backgroundColor: tokens.colors.success[100],
              border: `1px solid ${tokens.colors.success[300]}`,
            }}
          >
            <span style={{ fontSize: '16px' }}>💰</span>
            <span
              style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.success[700],
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Cash Sale
            </span>
          </div>

          <div
            style={{
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.colors.neutral[500],
              textAlign: 'right',
            }}
          >
            {swap.activeProposalCount > 0 && (
              <div style={{ marginBottom: tokens.spacing[1] }}>
                {swap.activeProposalCount} offer{swap.activeProposalCount !== 1 ? 's' : ''}
              </div>
            )}
            <div>
              Listed {formatDate(swap.createdAt)}
            </div>
          </div>
        </div>

        <h3
          style={{
            fontSize: tokens.typography.fontSize.lg,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
            margin: 0,
            lineHeight: tokens.typography.lineHeight.tight,
          }}
        >
          {booking?.title || 'Untitled Booking'}
        </h3>
      </CardHeader>

      <CardContent style={contentStyles}>
        {/* Booking Details */}
        <div
          style={{
            border: `1px solid ${tokens.colors.neutral[200]}`,
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
              {getBookingTypeIcon(booking?.type || 'hotel')}
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
              {booking?.type || 'Unknown'}
            </span>
          </div>

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
              {booking?.location?.city || 'Unknown'},{' '}
              {booking?.location?.country || 'Unknown'}
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
            <span>{formatBookingDates(booking)}</span>
          </div>

          <div
            style={{
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
            }}
          >
            Original Value: {formatCurrency(booking?.swapValue || 0)}
          </div>
        </div>

        {/* Cash Sale Details */}
        <div
          style={{
            border: `2px solid ${tokens.colors.success[200]}`,
            borderRadius: tokens.borderRadius.lg,
            padding: tokens.spacing[4],
            backgroundColor: tokens.colors.success[50],
          }}
        >
          <h4
            style={{
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.success[800],
              margin: `0 0 ${tokens.spacing[3]} 0`,
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[2],
            }}
          >
            <span>💰</span>
            Cash Sale Details
          </h4>

          <div style={{ marginBottom: tokens.spacing[3] }}>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
                marginBottom: tokens.spacing[1],
              }}
            >
              Price Range:
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.success[700],
              }}
            >
              {formatCurrency(cashDetails.minAmount, cashDetails.currency)} -{' '}
              {formatCurrency(cashDetails.maxAmount, cashDetails.currency)}
            </div>
            {cashDetails.preferredAmount && (
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.success[600],
                  marginTop: tokens.spacing[1],
                }}
              >
                Preferred: {formatCurrency(cashDetails.preferredAmount, cashDetails.currency)}
              </div>
            )}
          </div>

          {cashDetails.paymentMethods && cashDetails.paymentMethods.length > 0 && (
            <div style={{ marginBottom: tokens.spacing[3] }}>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Accepted Payment Methods:
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: tokens.spacing[2],
                }}
              >
                {cashDetails.paymentMethods.map((method, index) => (
                  <span
                    key={index}
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                      backgroundColor: tokens.colors.success[100],
                      color: tokens.colors.success[700],
                      borderRadius: tokens.borderRadius.md,
                      border: `1px solid ${tokens.colors.success[300]}`,
                    }}
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>
          )}

          {cashDetails.escrowRequired && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.success[700],
                backgroundColor: tokens.colors.success[100],
                padding: tokens.spacing[2],
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${tokens.colors.success[300]}`,
              }}
            >
              <span>🔒</span>
              <span>Secure escrow protection included</span>
            </div>
          )}

          {cashDetails.platformFeePercentage > 0 && (
            <div
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[500],
                marginTop: tokens.spacing[2],
                textAlign: 'center',
              }}
            >
              Platform fee: {cashDetails.platformFeePercentage}% of transaction
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter style={footerStyles}>
        <div
          style={{
            display: 'flex',
            gap: tokens.spacing[3],
            width: '100%',
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          {isOwnSwap ? (
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleViewOffers();
              }}
              style={{ flex: 1 }}
              disabled={loading}
            >
              View Offers ({swap.activeProposalCount})
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={(e) => {
                e.stopPropagation();
                handleMakeOffer();
              }}
              style={{ flex: 1 }}
              loading={offerButtonLoading}
              disabled={loading || offerButtonLoading}
            >
              Make Cash Offer
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetails();
            }}
            style={{ flex: isMobile ? 1 : 'auto' }}
            disabled={loading}
          >
            View Details
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};