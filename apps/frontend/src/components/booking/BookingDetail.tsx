import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { Booking, BookingType } from '@booking-swap/shared';

interface BookingDetailProps {
  booking: Booking;
  onProposeSwap: (bookingId: string) => void;
  onClose: () => void;
  showSwapButton?: boolean;
}

const getBookingTypeIcon = (type: BookingType): string => {
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
};

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'available':
      return tokens.colors.success[500];
    case 'locked':
      return tokens.colors.warning[500];
    case 'swapped':
      return tokens.colors.neutral[500];
    case 'cancelled':
      return tokens.colors.error[500];
    default:
      return tokens.colors.neutral[500];
  }
};

export const BookingDetail: React.FC<BookingDetailProps> = ({
  booking,
  onProposeSwap,
  onClose,
  showSwapButton = true,
}) => {
  const statusColor = getStatusColor(booking.status);

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
    >
      <div
        style={{
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <Card variant="elevated">
          <CardHeader>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[3],
                }}
              >
                <span style={{ fontSize: '32px' }}>
                  {getBookingTypeIcon(booking.type)}
                </span>
                <div>
                  <h1
                    style={{
                      fontSize: tokens.typography.fontSize['2xl'],
                      fontWeight: tokens.typography.fontWeight.bold,
                      color: tokens.colors.neutral[900],
                      margin: 0,
                      lineHeight: tokens.typography.lineHeight.tight,
                    }}
                  >
                    {booking.title}
                  </h1>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[2],
                      marginTop: tokens.spacing[1],
                    }}
                  >
                    <span
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.neutral[600],
                        textTransform: 'capitalize',
                      }}
                    >
                      {booking.type}
                    </span>
                    <span style={{ color: tokens.colors.neutral[400] }}>•</span>
                    <div
                      style={{
                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                        borderRadius: tokens.borderRadius.full,
                        backgroundColor: `${statusColor}20`,
                        border: `1px solid ${statusColor}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: tokens.typography.fontSize.xs,
                          fontWeight: tokens.typography.fontWeight.medium,
                          color: statusColor,
                          textTransform: 'capitalize',
                        }}
                      >
                        {booking.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: tokens.spacing[8],
              }}
            >
              {/* Main content */}
              <div>
                <section style={{ marginBottom: tokens.spacing[6] }}>
                  <h3
                    style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      margin: `0 0 ${tokens.spacing[3]} 0`,
                    }}
                  >
                    Description
                  </h3>
                  <p
                    style={{
                      fontSize: tokens.typography.fontSize.base,
                      color: tokens.colors.neutral[700],
                      lineHeight: tokens.typography.lineHeight.relaxed,
                      margin: 0,
                    }}
                  >
                    {booking.description}
                  </p>
                </section>

                <section style={{ marginBottom: tokens.spacing[6] }}>
                  <h3
                    style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      margin: `0 0 ${tokens.spacing[3]} 0`,
                    }}
                  >
                    Location & Dates
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: tokens.spacing[3],
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>📍</span>
                      <span
                        style={{
                          fontSize: tokens.typography.fontSize.base,
                          color: tokens.colors.neutral[700],
                        }}
                      >
                        {booking.location.city}, {booking.location.country}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>📅</span>
                      <div>
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.neutral[700],
                            fontWeight: tokens.typography.fontWeight.medium,
                          }}
                        >
                          Check-in: {formatDate(booking.dateRange.checkIn)}
                        </div>
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.neutral[700],
                            fontWeight: tokens.typography.fontWeight.medium,
                          }}
                        >
                          Check-out: {formatDate(booking.dateRange.checkOut)}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section style={{ marginBottom: tokens.spacing[6] }}>
                  <h3
                    style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      margin: `0 0 ${tokens.spacing[3]} 0`,
                    }}
                  >
                    Booking Details
                  </h3>
                  <div
                    style={{
                      backgroundColor: tokens.colors.neutral[50],
                      padding: tokens.spacing[4],
                      borderRadius: tokens.borderRadius.md,
                      border: `1px solid ${tokens.colors.neutral[200]}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: tokens.spacing[4],
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                            marginBottom: tokens.spacing[1],
                          }}
                        >
                          Provider
                        </div>
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.neutral[900],
                            fontWeight: tokens.typography.fontWeight.medium,
                          }}
                        >
                          {booking.providerDetails.provider}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                            marginBottom: tokens.spacing[1],
                          }}
                        >
                          Confirmation Number
                        </div>
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.neutral[900],
                            fontWeight: tokens.typography.fontWeight.medium,
                            fontFamily: 'monospace',
                          }}
                        >
                          {booking.providerDetails.confirmationNumber}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {booking.verification.status === 'verified' && (
                  <section>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                        padding: tokens.spacing[3],
                        backgroundColor: tokens.colors.success[50],
                        border: `1px solid ${tokens.colors.success[200]}`,
                        borderRadius: tokens.borderRadius.md,
                        color: tokens.colors.success[700],
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>✓</span>
                      <div>
                        <div
                          style={{
                            fontWeight: tokens.typography.fontWeight.medium,
                          }}
                        >
                          Verified Booking
                        </div>
                        <div
                          style={{ fontSize: tokens.typography.fontSize.sm }}
                        >
                          This booking has been verified with the provider
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* Sidebar */}
              <div>
                <Card variant="outlined">
                  <CardContent>
                    <div
                      style={{
                        textAlign: 'center',
                        marginBottom: tokens.spacing[4],
                      }}
                    >
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          color: tokens.colors.neutral[600],
                          marginBottom: tokens.spacing[1],
                        }}
                      >
                        Original Price
                      </div>
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.lg,
                          color: tokens.colors.neutral[500],
                          textDecoration: 'line-through',
                          marginBottom: tokens.spacing[2],
                        }}
                      >
                        {formatCurrency(booking.originalPrice)}
                      </div>
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          color: tokens.colors.neutral[600],
                          marginBottom: tokens.spacing[1],
                        }}
                      >
                        Swap Value
                      </div>
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize['3xl'],
                          fontWeight: tokens.typography.fontWeight.bold,
                          color: tokens.colors.primary[600],
                        }}
                      >
                        {formatCurrency(booking.swapValue)}
                      </div>
                    </div>

                    {showSwapButton && booking.status === 'available' && (
                      <Button
                        onClick={() => onProposeSwap(booking.id)}
                        style={{ width: '100%' }}
                        size="lg"
                      >
                        Propose Swap
                      </Button>
                    )}

                    <div
                      style={{
                        marginTop: tokens.spacing[4],
                        padding: tokens.spacing[3],
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.md,
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                      }}
                    >
                      <div style={{ marginBottom: tokens.spacing[2] }}>
                        <strong>Blockchain Record:</strong>
                      </div>
                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: tokens.typography.fontSize.xs,
                        }}
                      >
                        {booking.blockchain.transactionId ? (
                          <div>
                            TX: {booking.blockchain.transactionId.slice(0, 20)}
                            ...
                          </div>
                        ) : (
                          <div>Pending blockchain confirmation</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
