import React from 'react';
import { BookingCard } from './BookingCard';
import { tokens } from '@/design-system/tokens';
import { Booking } from '@booking-swap/shared';

interface BookingGridProps {
  bookings: Booking[];
  loading?: boolean;
  onViewDetails: (bookingId: string) => void;
  onProposeSwap: (bookingId: string) => void;
  emptyMessage?: string;
}

const LoadingSkeleton: React.FC = () => (
  <div
    style={{
      height: '400px',
      backgroundColor: tokens.colors.neutral[100],
      borderRadius: tokens.borderRadius.lg,
      animation: 'pulse 2s infinite',
    }}
  />
);

export const BookingGrid: React.FC<BookingGridProps> = ({
  bookings,
  loading = false,
  onViewDetails,
  onProposeSwap,
  emptyMessage = 'No bookings found. Try adjusting your search filters.',
}) => {
  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: tokens.spacing[6],
          padding: `${tokens.spacing[6]} 0`,
        }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <LoadingSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: `${tokens.spacing[12]} ${tokens.spacing[6]}`,
          color: tokens.colors.neutral[600],
        }}
      >
        <div
          style={{
            fontSize: '64px',
            marginBottom: tokens.spacing[4],
          }}
        >
          🔍
        </div>
        <h3
          style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[700],
            margin: `0 0 ${tokens.spacing[2]} 0`,
          }}
        >
          No bookings found
        </h3>
        <p
          style={{
            fontSize: tokens.typography.fontSize.base,
            color: tokens.colors.neutral[600],
            margin: 0,
            maxWidth: '400px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: tokens.typography.lineHeight.relaxed,
          }}
        >
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.spacing[6],
        }}
      >
        <h2
          style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
            margin: 0,
          }}
        >
          Available Bookings
        </h2>
        <div
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
          }}
        >
          {bookings.length} booking{bookings.length !== 1 ? 's' : ''} found
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: tokens.spacing[6],
        }}
      >
        {bookings.map(booking => (
          <BookingCard
            key={booking.id}
            booking={booking}
            onViewDetails={onViewDetails}
            onProposeSwap={onProposeSwap}
          />
        ))}
      </div>
    </div>
  );
};
