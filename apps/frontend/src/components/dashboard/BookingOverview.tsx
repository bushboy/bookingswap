import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';

interface Booking {
  id: string;
  title: string;
  type: 'hotel' | 'event' | 'flight' | 'rental';
  location: {
    city: string;
    country: string;
  };
  dateRange: {
    checkIn: Date;
    checkOut: Date;
  };
  status: 'available' | 'locked' | 'swapped' | 'cancelled';
  swapValue: number;
}

interface BookingOverviewProps {
  bookings: Booking[];
  onViewAll: () => void;
}

export const BookingOverview: React.FC<BookingOverviewProps> = ({
  bookings,
  onViewAll,
}) => {
  const bookingItemStyles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing[4],
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const bookingInfoStyles = {
    flex: 1,
  };

  const bookingTitleStyles = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[1],
  };

  const bookingDetailsStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing[1],
  };

  const statusBadgeStyles = (status: Booking['status']) => ({
    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
    borderRadius: tokens.borderRadius.md,
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.medium,
    backgroundColor: getStatusColor(status).bg,
    color: getStatusColor(status).text,
  });

  const valueStyles = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.primary[600],
    marginLeft: tokens.spacing[4],
  };

  const emptyStateStyles = {
    textAlign: 'center' as const,
    padding: tokens.spacing[8],
    color: tokens.colors.neutral[500],
  };

  function getStatusColor(status: Booking['status']) {
    switch (status) {
      case 'available':
        return {
          bg: tokens.colors.success[100],
          text: tokens.colors.success[800],
        };
      case 'locked':
        return {
          bg: tokens.colors.warning[100],
          text: tokens.colors.warning[800],
        };
      case 'swapped':
        return {
          bg: tokens.colors.primary[100],
          text: tokens.colors.primary[800],
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

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  function getTypeIcon(type: Booking['type']) {
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

  const displayBookings = bookings.slice(0, 5);

  return (
    <Card variant="outlined">
      <CardHeader>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.semibold,
              margin: 0,
            }}
          >
            Your Bookings
          </h2>
          {bookings.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              View All ({bookings.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent style={{ padding: 0 }}>
        {displayBookings.length === 0 ? (
          <div style={emptyStateStyles}>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                marginBottom: tokens.spacing[2],
              }}
            >
              📋
            </div>
            <p>No bookings yet</p>
            <Button
              variant="primary"
              size="sm"
              style={{ marginTop: tokens.spacing[4] }}
            >
              List Your First Booking
            </Button>
          </div>
        ) : (
          displayBookings.map(booking => (
            <div key={booking.id} style={bookingItemStyles}>
              <div style={bookingInfoStyles}>
                <div style={bookingTitleStyles}>
                  {getTypeIcon(booking.type)} {booking.title}
                </div>
                <div style={bookingDetailsStyles}>
                  {booking.location.city}, {booking.location.country}
                </div>
                <div style={bookingDetailsStyles}>
                  {formatDate(booking.dateRange.checkIn)} -{' '}
                  {formatDate(booking.dateRange.checkOut)}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[3],
                }}
              >
                <span style={statusBadgeStyles(booking.status)}>
                  {booking.status.charAt(0).toUpperCase() +
                    booking.status.slice(1)}
                </span>
                <div style={valueStyles}>
                  ${booking.swapValue.toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
