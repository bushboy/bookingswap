import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SwapStatusTracker } from './SwapStatusTracker';
import { tokens } from '@/design-system/tokens';
import { Swap, SwapStatus } from '@booking-swap/shared';

interface SwapListProps {
  swaps: Swap[];
  title?: string;
  onViewDetails?: (swapId: string) => void;
  onAcceptSwap?: (swapId: string) => void;
  onRejectSwap?: (swapId: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  showActions?: boolean;
}

type FilterType =
  | 'all'
  | 'pending'
  | 'accepted'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export const SwapList: React.FC<SwapListProps> = ({
  swaps,
  title = 'Swap Proposals',
  onViewDetails,
  onAcceptSwap,
  onRejectSwap,
  loading = false,
  emptyMessage = 'No swap proposals found',
  showActions = false,
}) => {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredSwaps = swaps.filter(swap => {
    if (filter === 'all') return true;
    return swap.status === filter;
  });

  const getFilterCounts = () => {
    const counts = swaps.reduce(
      (acc, swap) => {
        acc[swap.status] = (acc[swap.status] || 0) + 1;
        return acc;
      },
      {} as Record<SwapStatus, number>
    );

    return {
      all: swaps.length,
      pending: counts.pending || 0,
      accepted: counts.accepted || 0,
      completed: counts.completed || 0,
      rejected: counts.rejected || 0,
      cancelled: counts.cancelled || 0,
    };
  };

  const counts = getFilterCounts();

  const filterButtons: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'accepted', label: 'Accepted', count: counts.accepted },
    { key: 'completed', label: 'Completed', count: counts.completed },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
    { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
  ];

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  if (loading) {
    return (
      <Card>
        <CardContent
          style={{ padding: tokens.spacing[8], textAlign: 'center' }}
        >
          <div style={{ fontSize: '48px', marginBottom: tokens.spacing[4] }}>
            ⏳
          </div>
          <div
            style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.neutral[600],
            }}
          >
            Loading swap proposals...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacing[4],
      }}
    >
      {/* Header and Filters */}
      <Card>
        <CardHeader>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: tokens.spacing[4],
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
              {title}
            </h2>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              {swaps.length} total
            </div>
          </div>

          {/* Filter Buttons */}
          <div
            style={{
              display: 'flex',
              gap: tokens.spacing[2],
              flexWrap: 'wrap',
            }}
          >
            {filterButtons.map(({ key, label, count }) => (
              <Button
                key={key}
                variant={filter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(key)}
                disabled={count === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[2],
                }}
              >
                {label}
                <span
                  style={{
                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                    backgroundColor:
                      filter === key
                        ? 'rgba(255, 255, 255, 0.2)'
                        : tokens.colors.neutral[100],
                    borderRadius: tokens.borderRadius.full,
                    fontSize: tokens.typography.fontSize.xs,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    minWidth: '20px',
                    textAlign: 'center',
                  }}
                >
                  {count}
                </span>
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {/* Swap List */}
      {filteredSwaps.length === 0 ? (
        <Card>
          <CardContent
            style={{ padding: tokens.spacing[8], textAlign: 'center' }}
          >
            <div style={{ fontSize: '48px', marginBottom: tokens.spacing[4] }}>
              {filter === 'all' ? '📋' : '🔍'}
            </div>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.lg,
                color: tokens.colors.neutral[700],
                margin: `0 0 ${tokens.spacing[2]} 0`,
              }}
            >
              {filter === 'all' ? emptyMessage : `No ${filter} proposals`}
            </h3>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
                margin: 0,
              }}
            >
              {filter === 'all'
                ? 'Start by browsing available bookings and proposing swaps.'
                : `Try selecting a different filter to see other proposals.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing[4],
          }}
        >
          {filteredSwaps.map(swap => (
            <Card key={swap.id}>
              <CardContent style={{ padding: tokens.spacing[4] }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: tokens.spacing[4],
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.base,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.neutral[900],
                        marginBottom: tokens.spacing[1],
                      }}
                    >
                      Swap Proposal #{swap.id.slice(0, 8)}
                    </div>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                      }}
                    >
                      Proposed on {formatDate(swap.timeline.proposedAt)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[3],
                    }}
                  >
                    {swap.terms.additionalPayment &&
                      swap.terms.additionalPayment > 0 && (
                        <div
                          style={{
                            padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                            backgroundColor: tokens.colors.success[50],
                            color: tokens.colors.success[700],
                            borderRadius: tokens.borderRadius.full,
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                          }}
                        >
                          +${swap.terms.additionalPayment}
                        </div>
                      )}
                  </div>
                </div>

                <SwapStatusTracker
                  swap={swap}
                  onViewDetails={onViewDetails}
                  compact={true}
                />

                {showActions &&
                  swap.status === 'pending' &&
                  (onAcceptSwap || onRejectSwap) && (
                    <div
                      style={{
                        marginTop: tokens.spacing[4],
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.neutral[200]}`,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: tokens.spacing[3],
                      }}
                    >
                      {onRejectSwap && (
                        <Button
                          variant="outline"
                          onClick={() => onRejectSwap(swap.id)}
                        >
                          Reject
                        </Button>
                      )}
                      {onAcceptSwap && (
                        <Button onClick={() => onAcceptSwap(swap.id)}>
                          Accept
                        </Button>
                      )}
                    </div>
                  )}

                {swap.terms.conditions.length > 0 && (
                  <div
                    style={{
                      marginTop: tokens.spacing[4],
                      padding: tokens.spacing[3],
                      backgroundColor: tokens.colors.neutral[50],
                      borderRadius: tokens.borderRadius.md,
                      border: `1px solid ${tokens.colors.neutral[200]}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.neutral[700],
                        marginBottom: tokens.spacing[2],
                      }}
                    >
                      Conditions:
                    </div>
                    {swap.terms.conditions
                      .slice(0, 2)
                      .map((condition, index) => (
                        <div
                          key={index}
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                            marginBottom: tokens.spacing[1],
                          }}
                        >
                          • {condition}
                        </div>
                      ))}
                    {swap.terms.conditions.length > 2 && (
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          color: tokens.colors.neutral[500],
                          fontStyle: 'italic',
                        }}
                      >
                        +{swap.terms.conditions.length - 2} more conditions
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
