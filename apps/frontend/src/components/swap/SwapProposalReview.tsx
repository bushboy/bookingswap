import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { BookingCard } from '@/components/booking/BookingCard';
import { tokens } from '@/design-system/tokens';
import { Swap, Booking } from '@booking-swap/shared';

interface SwapProposalReviewProps {
  swap: Swap;
  sourceBooking: Booking;
  targetBooking: Booking;
  onAccept: (swapId: string, swapTargetId?: string) => void;
  onReject: (swapId: string, reason?: string, swapTargetId?: string) => void;
  onClose: () => void;
  loading?: boolean;
  swapTargetId?: string; // Target swap ID for booking proposals
}

export const SwapProposalReview: React.FC<SwapProposalReviewProps> = ({
  swap,
  sourceBooking,
  targetBooking,
  onAccept,
  onReject,
  onClose,
  loading = false,
  swapTargetId,
}) => {
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleAccept = () => {
    onAccept(swap.id, swapTargetId);
  };

  const handleReject = () => {
    if (showRejectReason) {
      onReject(swap.id, rejectReason.trim() || undefined, swapTargetId);
    } else {
      setShowRejectReason(true);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const isExpired = new Date() > new Date(swap.terms.expiresAt);
  const totalValue =
    sourceBooking.swapValue + (swap.terms.additionalPayment || 0);

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
          maxWidth: '1000px',
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
                alignItems: 'center',
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
                Swap Proposal Review
              </h2>
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            </div>

            {isExpired && (
              <div
                style={{
                  marginTop: tokens.spacing[3],
                  padding: tokens.spacing[3],
                  backgroundColor: tokens.colors.error[50],
                  border: `1px solid ${tokens.colors.error[200]}`,
                  borderRadius: tokens.borderRadius.md,
                  color: tokens.colors.error[700],
                  fontSize: tokens.typography.fontSize.sm,
                }}
              >
                ⚠️ This proposal has expired
              </div>
            )}
          </CardHeader>

          <CardContent>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[6],
              }}
            >
              {/* Proposal Info */}
              <div
                style={{
                  padding: tokens.spacing[4],
                  backgroundColor: tokens.colors.neutral[50],
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
                      Proposed on
                    </div>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.base,
                        color: tokens.colors.neutral[900],
                      }}
                    >
                      {formatDate(swap.timeline.proposedAt)}
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
                      Expires on
                    </div>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.base,
                        color: isExpired
                          ? tokens.colors.error[600]
                          : tokens.colors.neutral[900],
                      }}
                    >
                      {formatDate(swap.terms.expiresAt)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bookings Comparison */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  gap: tokens.spacing[4],
                  alignItems: 'center',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      margin: `0 0 ${tokens.spacing[3]} 0`,
                    }}
                  >
                    They offer:
                  </h3>
                  <BookingCard
                    booking={sourceBooking}
                    onViewDetails={() => { }}
                    onPropose={() => { }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: tokens.spacing[4],
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: tokens.colors.primary[100],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      marginBottom: tokens.spacing[2],
                    }}
                  >
                    ⇄
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[600],
                      textAlign: 'center',
                    }}
                  >
                    Swap
                  </div>
                </div>

                <div>
                  <h3
                    style={{
                      fontSize: tokens.typography.fontSize.lg,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      margin: `0 0 ${tokens.spacing[3]} 0`,
                    }}
                  >
                    You give:
                  </h3>
                  <BookingCard
                    booking={targetBooking}
                    onViewDetails={() => { }}
                    onPropose={() => { }}
                  />
                </div>
              </div>

              {/* Value Analysis */}
              <div
                style={{
                  padding: tokens.spacing[4],
                  backgroundColor: tokens.colors.neutral[50],
                  borderRadius: tokens.borderRadius.md,
                  border: `1px solid ${tokens.colors.neutral[200]}`,
                }}
              >
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    margin: `0 0 ${tokens.spacing[3]} 0`,
                  }}
                >
                  Value Analysis
                </h4>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: tokens.spacing[4],
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                        marginBottom: tokens.spacing[1],
                      }}
                    >
                      Their Booking
                    </div>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.neutral[900],
                      }}
                    >
                      ${sourceBooking.swapValue}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                        marginBottom: tokens.spacing[1],
                      }}
                    >
                      Additional Payment
                    </div>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.success[600],
                      }}
                    >
                      +${swap.terms.additionalPayment || 0}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                        marginBottom: tokens.spacing[1],
                      }}
                    >
                      Total Value
                    </div>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.primary[600],
                      }}
                    >
                      ${totalValue}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                        marginBottom: tokens.spacing[1],
                      }}
                    >
                      Your Booking
                    </div>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.neutral[900],
                      }}
                    >
                      ${targetBooking.swapValue}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: tokens.spacing[4],
                    padding: tokens.spacing[3],
                    backgroundColor:
                      totalValue >= targetBooking.swapValue
                        ? tokens.colors.success[50]
                        : tokens.colors.warning[50],
                    borderRadius: tokens.borderRadius.sm,
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[600],
                      marginBottom: tokens.spacing[1],
                    }}
                  >
                    Net Difference
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.xl,
                      fontWeight: tokens.typography.fontWeight.bold,
                      color:
                        totalValue >= targetBooking.swapValue
                          ? tokens.colors.success[600]
                          : tokens.colors.warning[600],
                    }}
                  >
                    {totalValue >= targetBooking.swapValue ? '+' : ''}$
                    {totalValue - targetBooking.swapValue}
                  </div>
                </div>
              </div>

              {/* Conditions */}
              {swap.terms.conditions.length > 0 && (
                <div>
                  <h4
                    style={{
                      fontSize: tokens.typography.fontSize.base,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: tokens.colors.neutral[900],
                      margin: `0 0 ${tokens.spacing[3]} 0`,
                    }}
                  >
                    Swap Conditions
                  </h4>
                  <div
                    style={{
                      backgroundColor: tokens.colors.neutral[50],
                      padding: tokens.spacing[3],
                      borderRadius: tokens.borderRadius.md,
                      border: `1px solid ${tokens.colors.neutral[200]}`,
                    }}
                  >
                    {swap.terms.conditions.map((condition, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          padding: `${tokens.spacing[2]} 0`,
                          borderBottom:
                            index < swap.terms.conditions.length - 1
                              ? `1px solid ${tokens.colors.neutral[200]}`
                              : 'none',
                        }}
                      >
                        <span
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[700],
                          }}
                        >
                          • {condition}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reject Reason Input */}
              {showRejectReason && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.medium,
                      color: tokens.colors.neutral[700],
                      marginBottom: tokens.spacing[2],
                    }}
                  >
                    Reason for rejection (optional)
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Let them know why you're declining this proposal..."
                    style={{
                      width: '100%',
                      padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                      fontSize: tokens.typography.fontSize.base,
                      border: `1px solid ${tokens.colors.neutral[300]}`,
                      borderRadius: tokens.borderRadius.md,
                      backgroundColor: 'white',
                      color: tokens.colors.neutral[900],
                      outline: 'none',
                      minHeight: '80px',
                      resize: 'vertical' as const,
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              )}

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: tokens.spacing[3],
                  paddingTop: tokens.spacing[4],
                  borderTop: `1px solid ${tokens.colors.neutral[200]}`,
                }}
              >
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
                {!isExpired && swap.status === 'pending' && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReject}
                      loading={loading}
                    >
                      {showRejectReason ? 'Confirm Rejection' : 'Reject'}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleAccept}
                      loading={loading}
                    >
                      Accept Proposal
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
