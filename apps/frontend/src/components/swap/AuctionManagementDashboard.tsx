import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { BookingCard } from '@/components/booking/BookingCard';
import { tokens } from '@/design-system/tokens';
import {
  SwapAuction,
  AuctionProposal,
  ProposalType,
  AuctionDashboardData,
  ProposalComparison,
} from '@booking-swap/shared';
import { Booking } from '@/components/booking/BookingCard';

interface AuctionManagementDashboardProps {
  auction: SwapAuction;
  proposals: AuctionProposal[];
  sourceBooking: Booking;
  userBookings: Booking[]; // For displaying booking details in proposals
  onSelectWinner: (proposalId: string) => void;
  onExtendAuction?: (newEndDate: Date) => void;
  onCancelAuction: () => void;
  loading?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export const AuctionManagementDashboard: React.FC<
  AuctionManagementDashboardProps
> = ({
  auction,
  proposals,
  sourceBooking,
  userBookings,
  onSelectWinner,
  onExtendAuction,
  onCancelAuction,
  loading = false,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [showProposalComparison, setShowProposalComparison] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'type'>('date');

  // Calculate time remaining
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const endTime = new Date(auction.settings.endDate).getTime();
      const difference = endTime - now;

      if (difference <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeRemaining({
        days,
        hours,
        minutes,
        seconds,
        isExpired: false,
      });
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [auction.settings.endDate]);

  // Sort proposals
  const sortedProposals = [...proposals].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return (
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );
      case 'amount':
        const aAmount = a.cashOffer?.amount || 0;
        const bAmount = b.cashOffer?.amount || 0;
        return bAmount - aAmount;
      case 'type':
        return a.proposalType.localeCompare(b.proposalType);
      default:
        return 0;
    }
  });

  // Group proposals by type
  const proposalComparison: ProposalComparison = {
    bookingProposals: proposals.filter(p => p.proposalType === 'booking'),
    cashProposals: proposals.filter(p => p.proposalType === 'cash'),
    highestCashOffer: proposals
      .filter(p => p.proposalType === 'cash' && p.cashOffer)
      .sort(
        (a, b) => (b.cashOffer?.amount || 0) - (a.cashOffer?.amount || 0)
      )[0]?.cashOffer,
    recommendedProposal: proposals
      .filter(p => p.proposalType === 'cash')
      .sort(
        (a, b) => (b.cashOffer?.amount || 0) - (a.cashOffer?.amount || 0)
      )[0]?.id,
  };

  const getBookingDetails = (bookingId: string): Booking | undefined => {
    return userBookings.find(b => b.id === bookingId);
  };

  const formatTimeRemaining = (): string => {
    if (timeRemaining.isExpired) {
      return 'Auction Ended';
    }

    if (timeRemaining.days > 0) {
      return `${timeRemaining.days}d ${timeRemaining.hours}h ${timeRemaining.minutes}m`;
    } else if (timeRemaining.hours > 0) {
      return `${timeRemaining.hours}h ${timeRemaining.minutes}m ${timeRemaining.seconds}s`;
    } else {
      return `${timeRemaining.minutes}m ${timeRemaining.seconds}s`;
    }
  };

  const getTimerColor = (): string => {
    if (timeRemaining.isExpired) {
      return tokens.colors.error[600];
    } else if (timeRemaining.days === 0 && timeRemaining.hours < 2) {
      return tokens.colors.warning[600];
    } else if (timeRemaining.days === 0 && timeRemaining.hours < 24) {
      return tokens.colors.warning[500];
    }
    return tokens.colors.success[600];
  };

  const canSelectWinner = auction.status === 'ended' || timeRemaining.isExpired;

  const cardStyles = {
    marginBottom: tokens.spacing[4],
  };

  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing[4],
  };

  const timerStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
    padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
    backgroundColor: timeRemaining.isExpired
      ? tokens.colors.error[50]
      : tokens.colors.success[50],
    borderRadius: tokens.borderRadius.full,
    border: `1px solid ${timeRemaining.isExpired ? tokens.colors.error[200] : tokens.colors.success[200]}`,
  };

  const proposalCardStyles = {
    padding: tokens.spacing[4],
    border: `2px solid ${selectedProposal ? tokens.colors.primary[500] : tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    marginBottom: tokens.spacing[3],
  };

  const statsGridStyles = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: tokens.spacing[4],
    marginBottom: tokens.spacing[6],
  };

  const statCardStyles = {
    textAlign: 'center' as const,
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.neutral[50],
    borderRadius: tokens.borderRadius.md,
    border: `1px solid ${tokens.colors.neutral[200]}`,
  };

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: tokens.spacing[4],
      }}
    >
      {/* Header */}
      <div style={headerStyles}>
        <div>
          <h1
            style={{
              fontSize: tokens.typography.fontSize['2xl'],
              fontWeight: tokens.typography.fontWeight.bold,
              color: tokens.colors.neutral[900],
              margin: 0,
            }}
          >
            Auction Management
          </h1>
          <p
            style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.neutral[600],
              margin: `${tokens.spacing[1]} 0 0 0`,
            }}
          >
            Manage your auction for: {sourceBooking.title}
          </p>
        </div>

        <div style={timerStyles}>
          <span
            style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: getTimerColor(),
            }}
          >
            ⏰ {formatTimeRemaining()}
          </span>
        </div>
      </div>

      {/* Auction Overview */}
      <Card style={cardStyles}>
        <CardHeader>
          <h2
            style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.semibold,
              margin: 0,
            }}
          >
            Auction Overview
          </h2>
        </CardHeader>
        <CardContent>
          {/* Stats Grid */}
          <div style={statsGridStyles}>
            <div style={statCardStyles}>
              <div
                style={{
                  fontSize: tokens.typography.fontSize['2xl'],
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.primary[600],
                  marginBottom: tokens.spacing[1],
                }}
              >
                {proposals.length}
              </div>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}
              >
                Total Proposals
              </div>
            </div>

            <div style={statCardStyles}>
              <div
                style={{
                  fontSize: tokens.typography.fontSize['2xl'],
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.success[600],
                  marginBottom: tokens.spacing[1],
                }}
              >
                {proposalComparison.bookingProposals.length}
              </div>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}
              >
                Booking Offers
              </div>
            </div>

            <div style={statCardStyles}>
              <div
                style={{
                  fontSize: tokens.typography.fontSize['2xl'],
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.warning[600],
                  marginBottom: tokens.spacing[1],
                }}
              >
                {proposalComparison.cashProposals.length}
              </div>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}
              >
                Cash Offers
              </div>
            </div>

            {proposalComparison.highestCashOffer && (
              <div style={statCardStyles}>
                <div
                  style={{
                    fontSize: tokens.typography.fontSize['2xl'],
                    fontWeight: tokens.typography.fontWeight.bold,
                    color: tokens.colors.success[600],
                    marginBottom: tokens.spacing[1],
                  }}
                >
                  ${proposalComparison.highestCashOffer.amount.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[600],
                  }}
                >
                  Highest Cash Offer
                </div>
              </div>
            )}
          </div>

          {/* Your Booking Display */}
          <div style={{ marginBottom: tokens.spacing[4] }}>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                marginBottom: tokens.spacing[3],
              }}
            >
              Your Booking
            </h3>
            <BookingCard
              booking={sourceBooking}
              onViewDetails={() => {}}
              onProposeSwap={() => {}}
              showSwapButton={false}
            />
          </div>

          {/* Auction Settings Display */}
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
                marginBottom: tokens.spacing[3],
              }}
            >
              Auction Settings
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: tokens.spacing[3],
                fontSize: tokens.typography.fontSize.sm,
              }}
            >
              <div>
                <strong>End Date:</strong>
                <br />
                {new Date(auction.settings.endDate).toLocaleString()}
              </div>
              <div>
                <strong>Booking Proposals:</strong>
                <br />
                {auction.settings.allowBookingProposals
                  ? '✅ Allowed'
                  : '❌ Not Allowed'}
              </div>
              <div>
                <strong>Cash Proposals:</strong>
                <br />
                {auction.settings.allowCashProposals
                  ? '✅ Allowed'
                  : '❌ Not Allowed'}
              </div>
              {auction.settings.minimumCashOffer && (
                <div>
                  <strong>Min Cash Offer:</strong>
                  <br />${auction.settings.minimumCashOffer.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposal Management */}
      <Card style={cardStyles}>
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
              Proposals ({proposals.length})
            </h2>

            <div
              style={{
                display: 'flex',
                gap: tokens.spacing[3],
                alignItems: 'center',
              }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setShowProposalComparison(!showProposalComparison)
                }
              >
                {showProposalComparison ? 'Hide' : 'Show'} Comparison
              </Button>

              <select
                value={sortBy}
                onChange={e =>
                  setSortBy(e.target.value as 'date' | 'amount' | 'type')
                }
                style={{
                  padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                  backgroundColor: 'white',
                }}
              >
                <option value="date">Sort by Date</option>
                <option value="amount">Sort by Amount</option>
                <option value="type">Sort by Type</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {proposals.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: tokens.spacing[8],
                backgroundColor: tokens.colors.neutral[50],
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${tokens.colors.neutral[200]}`,
              }}
            >
              <div
                style={{ fontSize: '48px', marginBottom: tokens.spacing[3] }}
              >
                📭
              </div>
              <h3
                style={{
                  fontSize: tokens.typography.fontSize.lg,
                  color: tokens.colors.neutral[700],
                  margin: `0 0 ${tokens.spacing[2]} 0`,
                }}
              >
                No proposals yet
              </h3>
              <p
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                  margin: 0,
                }}
              >
                Proposals will appear here as users submit them.
              </p>
            </div>
          ) : (
            <>
              {/* Proposal Comparison View */}
              {showProposalComparison && (
                <div
                  style={{
                    marginBottom: tokens.spacing[6],
                    padding: tokens.spacing[4],
                    backgroundColor: tokens.colors.primary[50],
                    borderRadius: tokens.borderRadius.md,
                    border: `1px solid ${tokens.colors.primary[200]}`,
                  }}
                >
                  <h4
                    style={{
                      fontSize: tokens.typography.fontSize.base,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      marginBottom: tokens.spacing[3],
                      color: tokens.colors.primary[900],
                    }}
                  >
                    Proposal Comparison
                  </h4>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: tokens.spacing[4],
                    }}
                  >
                    <div>
                      <h5
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          fontWeight: tokens.typography.fontWeight.semibold,
                          marginBottom: tokens.spacing[2],
                          color: tokens.colors.success[700],
                        }}
                      >
                        Booking Proposals (
                        {proposalComparison.bookingProposals.length})
                      </h5>
                      {proposalComparison.bookingProposals.length === 0 ? (
                        <p
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                          }}
                        >
                          No booking proposals received
                        </p>
                      ) : (
                        <div
                          style={{ fontSize: tokens.typography.fontSize.sm }}
                        >
                          <p>
                            • {proposalComparison.bookingProposals.length}{' '}
                            booking exchange offers
                          </p>
                          <p>• Various locations and dates available</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <h5
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          fontWeight: tokens.typography.fontWeight.semibold,
                          marginBottom: tokens.spacing[2],
                          color: tokens.colors.warning[700],
                        }}
                      >
                        Cash Proposals (
                        {proposalComparison.cashProposals.length})
                      </h5>
                      {proposalComparison.cashProposals.length === 0 ? (
                        <p
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                          }}
                        >
                          No cash proposals received
                        </p>
                      ) : (
                        <div
                          style={{ fontSize: tokens.typography.fontSize.sm }}
                        >
                          <p>
                            • Highest offer: $
                            {proposalComparison.highestCashOffer?.amount.toLocaleString()}
                          </p>
                          <p>
                            • Average offer: $
                            {Math.round(
                              proposalComparison.cashProposals.reduce(
                                (sum, p) => sum + (p.cashOffer?.amount || 0),
                                0
                              ) / proposalComparison.cashProposals.length
                            ).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {proposalComparison.recommendedProposal && (
                    <div
                      style={{
                        marginTop: tokens.spacing[3],
                        padding: tokens.spacing[3],
                        backgroundColor: tokens.colors.success[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.success[200]}`,
                      }}
                    >
                      <strong style={{ color: tokens.colors.success[800] }}>
                        💡 Recommended: Highest cash offer ($
                        {proposalComparison.highestCashOffer?.amount.toLocaleString()}
                        )
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* Individual Proposals */}
              <div>
                {sortedProposals.map(proposal => {
                  const bookingDetails = proposal.bookingId
                    ? getBookingDetails(proposal.bookingId)
                    : null;

                  return (
                    <div
                      key={proposal.id}
                      style={{
                        ...proposalCardStyles,
                        borderColor:
                          selectedProposal === proposal.id
                            ? tokens.colors.primary[500]
                            : tokens.colors.neutral[200],
                      }}
                      onClick={() =>
                        setSelectedProposal(
                          selectedProposal === proposal.id ? null : proposal.id
                        )
                      }
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          {/* Proposal Header */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: tokens.spacing[3],
                              marginBottom: tokens.spacing[3],
                            }}
                          >
                            <span
                              style={{
                                padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                                backgroundColor:
                                  proposal.proposalType === 'cash'
                                    ? tokens.colors.warning[100]
                                    : tokens.colors.success[100],
                                color:
                                  proposal.proposalType === 'cash'
                                    ? tokens.colors.warning[800]
                                    : tokens.colors.success[800],
                                borderRadius: tokens.borderRadius.full,
                                fontSize: tokens.typography.fontSize.xs,
                                fontWeight:
                                  tokens.typography.fontWeight.semibold,
                                textTransform: 'uppercase' as const,
                              }}
                            >
                              {proposal.proposalType === 'cash'
                                ? '💰 Cash Offer'
                                : '🔄 Booking Exchange'}
                            </span>

                            <span
                              style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[600],
                              }}
                            >
                              Submitted{' '}
                              {new Date(
                                proposal.submittedAt
                              ).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Proposal Content */}
                          {proposal.proposalType === 'cash' &&
                          proposal.cashOffer ? (
                            <div style={{ marginBottom: tokens.spacing[3] }}>
                              <div
                                style={{
                                  fontSize: tokens.typography.fontSize.xl,
                                  fontWeight: tokens.typography.fontWeight.bold,
                                  color: tokens.colors.success[600],
                                  marginBottom: tokens.spacing[2],
                                }}
                              >
                                ${proposal.cashOffer.amount.toLocaleString()}{' '}
                                {proposal.cashOffer.currency}
                              </div>
                              <div
                                style={{
                                  fontSize: tokens.typography.fontSize.sm,
                                  color: tokens.colors.neutral[600],
                                }}
                              >
                                Payment Method:{' '}
                                {proposal.cashOffer.paymentMethodId}
                                <br />
                                Escrow:{' '}
                                {proposal.cashOffer.escrowRequired
                                  ? 'Required'
                                  : 'Not Required'}
                              </div>
                            </div>
                          ) : bookingDetails ? (
                            <div style={{ marginBottom: tokens.spacing[3] }}>
                              <BookingCard
                                booking={bookingDetails}
                                onViewDetails={() => {}}
                                onProposeSwap={() => {}}
                                showSwapButton={false}
                                compact
                              />
                            </div>
                          ) : (
                            <div
                              style={{
                                padding: tokens.spacing[3],
                                backgroundColor: tokens.colors.neutral[50],
                                borderRadius: tokens.borderRadius.md,
                                marginBottom: tokens.spacing[3],
                              }}
                            >
                              <p
                                style={{
                                  fontSize: tokens.typography.fontSize.sm,
                                  color: tokens.colors.neutral[600],
                                }}
                              >
                                Booking details not available
                              </p>
                            </div>
                          )}

                          {/* Message */}
                          {proposal.message && (
                            <div
                              style={{
                                padding: tokens.spacing[3],
                                backgroundColor: tokens.colors.neutral[50],
                                borderRadius: tokens.borderRadius.md,
                                marginBottom: tokens.spacing[3],
                              }}
                            >
                              <h5
                                style={{
                                  fontSize: tokens.typography.fontSize.sm,
                                  fontWeight:
                                    tokens.typography.fontWeight.semibold,
                                  marginBottom: tokens.spacing[2],
                                }}
                              >
                                Message from proposer:
                              </h5>
                              <p
                                style={{
                                  fontSize: tokens.typography.fontSize.sm,
                                  color: tokens.colors.neutral[700],
                                  margin: 0,
                                }}
                              >
                                "{proposal.message}"
                              </p>
                            </div>
                          )}

                          {/* Conditions */}
                          {proposal.conditions.length > 0 && (
                            <div style={{ marginBottom: tokens.spacing[3] }}>
                              <h5
                                style={{
                                  fontSize: tokens.typography.fontSize.sm,
                                  fontWeight:
                                    tokens.typography.fontWeight.semibold,
                                  marginBottom: tokens.spacing[2],
                                }}
                              >
                                Conditions:
                              </h5>
                              <ul
                                style={{
                                  fontSize: tokens.typography.fontSize.sm,
                                  color: tokens.colors.neutral[700],
                                  margin: 0,
                                  paddingLeft: tokens.spacing[4],
                                }}
                              >
                                {proposal.conditions.map((condition, index) => (
                                  <li key={index}>{condition}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Action Button */}
                        {canSelectWinner && (
                          <Button
                            variant={
                              selectedProposal === proposal.id
                                ? 'primary'
                                : 'outline'
                            }
                            size="sm"
                            onClick={e => {
                              e.stopPropagation();
                              onSelectWinner(proposal.id);
                            }}
                            loading={loading}
                          >
                            {selectedProposal === proposal.id
                              ? 'Select Winner'
                              : 'Select'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: tokens.spacing[3],
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: tokens.spacing[4],
          borderTop: `1px solid ${tokens.colors.neutral[200]}`,
        }}
      >
        <div
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
          }}
        >
          {canSelectWinner
            ? proposals.length > 0
              ? 'Select a winning proposal to complete the auction'
              : 'No proposals received. You can cancel the auction.'
            : `Auction ends ${new Date(auction.settings.endDate).toLocaleDateString()} at ${new Date(auction.settings.endDate).toLocaleTimeString()}`}
        </div>

        <div style={{ display: 'flex', gap: tokens.spacing[3] }}>
          {onExtendAuction && !canSelectWinner && (
            <Button
              variant="outline"
              onClick={() => {
                const newEndDate = new Date(auction.settings.endDate);
                newEndDate.setDate(newEndDate.getDate() + 1);
                onExtendAuction(newEndDate);
              }}
              disabled={loading}
            >
              Extend by 1 Day
            </Button>
          )}

          <Button
            variant="outline"
            onClick={onCancelAuction}
            disabled={loading}
          >
            Cancel Auction
          </Button>
        </div>
      </div>
    </div>
  );
};
