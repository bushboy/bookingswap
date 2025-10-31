import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { Swap, SwapStatus } from '@booking-swap/shared';

interface SwapStatusStep {
  status: SwapStatus;
  label: string;
  description: string;
  icon: string;
  completed: boolean;
  active: boolean;
}

interface SwapStatusTrackerProps {
  swap: Swap;
  onViewDetails?: (swapId: string) => void;
  compact?: boolean;
}

export const SwapStatusTracker: React.FC<SwapStatusTrackerProps> = ({
  swap,
  onViewDetails,
  compact = false,
}) => {
  const getStatusSteps = (
    currentStatus: SwapStatus,
    timeline: Swap['timeline']
  ): SwapStatusStep[] => {
    const steps: SwapStatusStep[] = [
      {
        status: 'pending',
        label: 'Proposal Sent',
        description: 'Waiting for response from the booking owner',
        icon: '📤',
        completed: true,
        active: currentStatus === 'pending',
      },
      {
        status: 'accepted',
        label: 'Proposal Accepted',
        description: 'Both parties agreed to the swap terms',
        icon: '✅',
        completed: ['accepted', 'completed'].includes(currentStatus),
        active: currentStatus === 'accepted',
      },
      {
        status: 'completed',
        label: 'Swap Completed',
        description: 'Blockchain transaction executed successfully',
        icon: '🎉',
        completed: currentStatus === 'completed',
        active: currentStatus === 'completed',
      },
    ];

    // Handle rejected/cancelled states
    if (currentStatus === 'rejected') {
      return [
        steps[0],
        {
          status: 'rejected',
          label: 'Proposal Rejected',
          description: 'The booking owner declined your proposal',
          icon: '❌',
          completed: true,
          active: true,
        },
      ];
    }

    if (currentStatus === 'cancelled') {
      return [
        steps[0],
        {
          status: 'cancelled',
          label: 'Proposal Cancelled',
          description: 'The proposal was cancelled',
          icon: '🚫',
          completed: true,
          active: true,
        },
      ];
    }

    return steps;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const getStatusColor = (status: SwapStatus) => {
    switch (status) {
      case 'pending':
        return tokens.colors.warning[500];
      case 'accepted':
        return tokens.colors.primary[500];
      case 'completed':
        return tokens.colors.success[500];
      case 'rejected':
      case 'cancelled':
        return tokens.colors.error[500];
      default:
        return tokens.colors.neutral[500];
    }
  };

  const getStatusBadge = (status: SwapStatus) => {
    const color = getStatusColor(status);
    const labels = {
      pending: 'Pending',
      accepted: 'Accepted',
      completed: 'Completed',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
    };

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
          backgroundColor: `${color}20`,
          color: color,
          borderRadius: tokens.borderRadius.full,
          fontSize: tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.medium,
        }}
      >
        {labels[status]}
      </span>
    );
  };

  const steps = getStatusSteps(swap.status, swap.timeline);
  const isExpired =
    new Date() > new Date(swap.terms.expiresAt) && swap.status === 'pending';

  if (compact) {
    return (
      <Card>
        <CardContent style={{ padding: tokens.spacing[4] }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[3],
              }}
            >
              <div style={{ fontSize: '24px' }}>
                {steps.find(s => s.active)?.icon || '📋'}
              </div>
              <div>
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                    marginBottom: tokens.spacing[1],
                  }}
                >
                  {steps.find(s => s.active)?.label || 'Unknown Status'}
                </div>
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[600],
                  }}
                >
                  {formatDate(swap.timeline.proposedAt)}
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[3],
              }}
            >
              {getStatusBadge(swap.status)}
              {onViewDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails(swap.id)}
                >
                  View Details
                </Button>
              )}
            </div>
          </div>

          {isExpired && (
            <div
              style={{
                marginTop: tokens.spacing[3],
                padding: tokens.spacing[2],
                backgroundColor: tokens.colors.error[50],
                border: `1px solid ${tokens.colors.error[200]}`,
                borderRadius: tokens.borderRadius.sm,
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.error[700],
              }}
            >
              ⚠️ This proposal has expired
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3
            style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.neutral[900],
              margin: 0,
            }}
          >
            Swap Progress
          </h3>
          {getStatusBadge(swap.status)}
        </div>
      </CardHeader>

      <CardContent>
        <div style={{ position: 'relative' }}>
          {/* Progress Line */}
          <div
            style={{
              position: 'absolute',
              left: '20px',
              top: '20px',
              bottom: '20px',
              width: '2px',
              backgroundColor: tokens.colors.neutral[200],
            }}
          />

          {/* Steps */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.spacing[6],
            }}
          >
            {steps.map((step, index) => (
              <div
                key={step.status}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: tokens.spacing[4],
                }}
              >
                {/* Step Icon */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: step.completed
                      ? getStatusColor(step.status)
                      : tokens.colors.neutral[200],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    border: `3px solid ${tokens.colors.neutral[50]}`,
                  }}
                >
                  {step.completed ? (
                    <span style={{ filter: 'brightness(0) invert(1)' }}>
                      {step.icon}
                    </span>
                  ) : (
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: tokens.colors.neutral[400],
                      }}
                    />
                  )}
                </div>

                {/* Step Content */}
                <div style={{ flex: 1, paddingTop: tokens.spacing[1] }}>
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.base,
                      fontWeight: tokens.typography.fontWeight.semibold,
                      color: step.completed
                        ? tokens.colors.neutral[900]
                        : tokens.colors.neutral[500],
                      marginBottom: tokens.spacing[1],
                    }}
                  >
                    {step.label}
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: step.completed
                        ? tokens.colors.neutral[600]
                        : tokens.colors.neutral[400],
                      marginBottom: tokens.spacing[2],
                    }}
                  >
                    {step.description}
                  </div>

                  {/* Timestamps */}
                  {step.status === 'pending' && swap.timeline.proposedAt && (
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.neutral[500],
                      }}
                    >
                      {formatDate(swap.timeline.proposedAt)}
                    </div>
                  )}
                  {step.status === 'accepted' && swap.timeline.respondedAt && (
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.neutral[500],
                      }}
                    >
                      {formatDate(swap.timeline.respondedAt)}
                    </div>
                  )}
                  {step.status === 'completed' && swap.timeline.completedAt && (
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.neutral[500],
                      }}
                    >
                      {formatDate(swap.timeline.completedAt)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Info */}
        <div
          style={{
            marginTop: tokens.spacing[6],
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
                Proposal ID
              </div>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontFamily: 'monospace',
                  color: tokens.colors.neutral[900],
                }}
              >
                {swap.id.slice(0, 8)}...{swap.id.slice(-8)}
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
                {swap.status === 'pending' ? 'Expires' : 'Expired'}
              </div>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: isExpired
                    ? tokens.colors.error[600]
                    : tokens.colors.neutral[900],
                }}
              >
                {formatDate(swap.terms.expiresAt)}
              </div>
            </div>
          </div>

          {isExpired && (
            <div
              style={{
                marginTop: tokens.spacing[3],
                padding: tokens.spacing[3],
                backgroundColor: tokens.colors.error[50],
                border: `1px solid ${tokens.colors.error[200]}`,
                borderRadius: tokens.borderRadius.sm,
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.error[700],
              }}
            >
              ⚠️ This proposal has expired and can no longer be accepted
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
};
