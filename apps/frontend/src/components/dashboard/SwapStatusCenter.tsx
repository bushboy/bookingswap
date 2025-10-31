import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';

interface SwapProposal {
  id: string;
  sourceBookingTitle: string;
  targetBookingTitle: string;
  proposerName: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  expiresAt: Date;
  additionalPayment?: number;
  isIncoming: boolean;
}

interface SwapStatusCenterProps {
  swapProposals: SwapProposal[];
  onAcceptSwap: (swapId: string) => void;
  onRejectSwap: (swapId: string) => void;
  onViewSwap: (swapId: string) => void;
}

export const SwapStatusCenter: React.FC<SwapStatusCenterProps> = ({
  swapProposals,
  onAcceptSwap,
  onRejectSwap,
  onViewSwap,
}) => {
  const swapItemStyles = {
    padding: tokens.spacing[4],
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const swapHeaderStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing[3],
  };

  const swapTitleStyles = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[1],
  };

  const swapDetailsStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing[2],
  };

  const statusBadgeStyles = (status: SwapProposal['status']) => ({
    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
    borderRadius: tokens.borderRadius.md,
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.medium,
    backgroundColor: getStatusColor(status).bg,
    color: getStatusColor(status).text,
  });

  const actionButtonsStyles = {
    display: 'flex',
    gap: tokens.spacing[2],
    marginTop: tokens.spacing[3],
  };

  const expirationWarningStyles = {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.warning[600],
    fontWeight: tokens.typography.fontWeight.medium,
  };

  const emptyStateStyles = {
    textAlign: 'center' as const,
    padding: tokens.spacing[8],
    color: tokens.colors.neutral[500],
  };

  function getStatusColor(status: SwapProposal['status']) {
    switch (status) {
      case 'pending':
        return {
          bg: tokens.colors.warning[100],
          text: tokens.colors.warning[800],
        };
      case 'accepted':
        return {
          bg: tokens.colors.primary[100],
          text: tokens.colors.primary[800],
        };
      case 'rejected':
        return { bg: tokens.colors.error[100], text: tokens.colors.error[800] };
      case 'completed':
        return {
          bg: tokens.colors.success[100],
          text: tokens.colors.success[800],
        };
      case 'cancelled':
        return {
          bg: tokens.colors.neutral[100],
          text: tokens.colors.neutral[800],
        };
      default:
        return {
          bg: tokens.colors.neutral[100],
          text: tokens.colors.neutral[800],
        };
    }
  }

  function getTimeUntilExpiration(expiresAt: Date) {
    const now = new Date();
    const diffInHours = Math.floor(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours <= 0) {
      return 'Expired';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} left`;
    } else {
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days > 1 ? 's' : ''} left`;
    }
  }

  function isExpiringSoon(expiresAt: Date) {
    const now = new Date();
    const diffInHours =
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffInHours <= 24 && diffInHours > 0;
  }

  const pendingSwaps = swapProposals.filter(swap => swap.status === 'pending');
  const activeSwaps = swapProposals.filter(swap =>
    ['accepted', 'completed'].includes(swap.status)
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacing[4],
      }}
    >
      {/* Pending Proposals */}
      <Card variant="outlined">
        <CardHeader>
          <h2
            style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.semibold,
              margin: 0,
            }}
          >
            Pending Swap Proposals ({pendingSwaps.length})
          </h2>
        </CardHeader>
        <CardContent style={{ padding: 0 }}>
          {pendingSwaps.length === 0 ? (
            <div style={emptyStateStyles}>
              <div
                style={{
                  fontSize: tokens.typography.fontSize['2xl'],
                  marginBottom: tokens.spacing[2],
                }}
              >
                🔄
              </div>
              <p>No pending swap proposals</p>
            </div>
          ) : (
            pendingSwaps.map(swap => (
              <div key={swap.id} style={swapItemStyles}>
                <div style={swapHeaderStyles}>
                  <div style={{ flex: 1 }}>
                    <div style={swapTitleStyles}>
                      {swap.isIncoming ? 'Incoming' : 'Outgoing'} Swap Proposal
                    </div>
                    <div style={swapDetailsStyles}>
                      <strong>{swap.sourceBookingTitle}</strong> ⇄{' '}
                      <strong>{swap.targetBookingTitle}</strong>
                    </div>
                    <div style={swapDetailsStyles}>
                      {swap.isIncoming
                        ? `From: ${swap.proposerName}`
                        : `To: ${swap.proposerName}`}
                    </div>
                    {swap.additionalPayment && (
                      <div style={swapDetailsStyles}>
                        Additional payment: $
                        {swap.additionalPayment.toLocaleString()}
                      </div>
                    )}
                    <div
                      style={
                        isExpiringSoon(swap.expiresAt)
                          ? expirationWarningStyles
                          : swapDetailsStyles
                      }
                    >
                      {getTimeUntilExpiration(swap.expiresAt)}
                    </div>
                  </div>
                  <span style={statusBadgeStyles(swap.status)}>
                    {swap.status.charAt(0).toUpperCase() + swap.status.slice(1)}
                  </span>
                </div>

                <div style={actionButtonsStyles}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewSwap(swap.id)}
                  >
                    View Details
                  </Button>
                  {swap.isIncoming && swap.status === 'pending' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onAcceptSwap(swap.id)}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRejectSwap(swap.id)}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Active Swaps */}
      <Card variant="outlined">
        <CardHeader>
          <h2
            style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.semibold,
              margin: 0,
            }}
          >
            Active Swaps ({activeSwaps.length})
          </h2>
        </CardHeader>
        <CardContent style={{ padding: 0 }}>
          {activeSwaps.length === 0 ? (
            <div style={emptyStateStyles}>
              <div
                style={{
                  fontSize: tokens.typography.fontSize['2xl'],
                  marginBottom: tokens.spacing[2],
                }}
              >
                ✅
              </div>
              <p>No active swaps</p>
            </div>
          ) : (
            activeSwaps.map(swap => (
              <div key={swap.id} style={swapItemStyles}>
                <div style={swapHeaderStyles}>
                  <div style={{ flex: 1 }}>
                    <div style={swapTitleStyles}>
                      Swap{' '}
                      {swap.status === 'completed'
                        ? 'Completed'
                        : 'In Progress'}
                    </div>
                    <div style={swapDetailsStyles}>
                      <strong>{swap.sourceBookingTitle}</strong> ⇄{' '}
                      <strong>{swap.targetBookingTitle}</strong>
                    </div>
                    <div style={swapDetailsStyles}>
                      With: {swap.proposerName}
                    </div>
                    {swap.additionalPayment && (
                      <div style={swapDetailsStyles}>
                        Additional payment: $
                        {swap.additionalPayment.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <span style={statusBadgeStyles(swap.status)}>
                    {swap.status.charAt(0).toUpperCase() + swap.status.slice(1)}
                  </span>
                </div>

                <div style={actionButtonsStyles}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewSwap(swap.id)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
