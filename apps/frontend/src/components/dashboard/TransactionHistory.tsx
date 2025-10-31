import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';

interface Transaction {
  id: string;
  type:
    | 'swap_completed'
    | 'swap_proposed'
    | 'booking_listed'
    | 'swap_rejected'
    | 'swap_cancelled';
  title: string;
  description: string;
  timestamp: Date;
  amount?: number;
  blockchainTxId?: string;
  status: 'completed' | 'pending' | 'failed';
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  onViewTransaction: (txId: string) => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  onViewTransaction,
}) => {
  const [filter, setFilter] = useState<
    'all' | 'completed' | 'pending' | 'failed'
  >('all');

  const transactionItemStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[3],
    padding: tokens.spacing[4],
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease-in-out',
  };

  const transactionIconStyles = {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: tokens.typography.fontSize.lg,
  };

  const transactionContentStyles = {
    flex: 1,
  };

  const transactionTitleStyles = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[1],
  };

  const transactionDescriptionStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing[1],
  };

  const transactionTimeStyles = {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.neutral[500],
  };

  const transactionAmountStyles = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.primary[600],
  };

  const statusBadgeStyles = (status: Transaction['status']) => ({
    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
    borderRadius: tokens.borderRadius.md,
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.medium,
    backgroundColor: getStatusColor(status).bg,
    color: getStatusColor(status).text,
  });

  const filterButtonStyles = (isActive: boolean) => ({
    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
    fontSize: tokens.typography.fontSize.sm,
    border: `1px solid ${isActive ? tokens.colors.primary[300] : tokens.colors.neutral[300]}`,
    backgroundColor: isActive ? tokens.colors.primary[50] : 'white',
    color: isActive ? tokens.colors.primary[700] : tokens.colors.neutral[600],
    borderRadius: tokens.borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  });

  const emptyStateStyles = {
    textAlign: 'center' as const,
    padding: tokens.spacing[8],
    color: tokens.colors.neutral[500],
  };

  function getStatusColor(status: Transaction['status']) {
    switch (status) {
      case 'completed':
        return {
          bg: tokens.colors.success[100],
          text: tokens.colors.success[800],
        };
      case 'pending':
        return {
          bg: tokens.colors.warning[100],
          text: tokens.colors.warning[800],
        };
      case 'failed':
        return { bg: tokens.colors.error[100], text: tokens.colors.error[800] };
      default:
        return {
          bg: tokens.colors.neutral[100],
          text: tokens.colors.neutral[800],
        };
    }
  }

  function getTransactionIcon(type: Transaction['type']) {
    switch (type) {
      case 'swap_completed':
        return { icon: '✅', bg: tokens.colors.success[100] };
      case 'swap_proposed':
        return { icon: '🔄', bg: tokens.colors.primary[100] };
      case 'booking_listed':
        return { icon: '📝', bg: tokens.colors.secondary[100] };
      case 'swap_rejected':
        return { icon: '❌', bg: tokens.colors.error[100] };
      case 'swap_cancelled':
        return { icon: '⏰', bg: tokens.colors.warning[100] };
      default:
        return { icon: '📋', bg: tokens.colors.neutral[100] };
    }
  }

  function formatTimestamp(timestamp: Date) {
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInHours < 168) {
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  }

  const filteredTransactions = transactions.filter(
    tx => filter === 'all' || tx.status === filter
  );

  const displayTransactions = filteredTransactions.slice(0, 10);

  return (
    <Card variant="outlined">
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
              margin: 0,
            }}
          >
            Transaction History
          </h2>
        </div>
        <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
          {(['all', 'completed', 'pending', 'failed'] as const).map(
            filterOption => (
              <button
                key={filterOption}
                style={filterButtonStyles(filter === filterOption)}
                onClick={() => setFilter(filterOption)}
              >
                {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
              </button>
            )
          )}
        </div>
      </CardHeader>
      <CardContent style={{ padding: 0 }}>
        {displayTransactions.length === 0 ? (
          <div style={emptyStateStyles}>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                marginBottom: tokens.spacing[2],
              }}
            >
              📊
            </div>
            <p>No transactions found</p>
            {filter !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilter('all')}
                style={{ marginTop: tokens.spacing[2] }}
              >
                Show All Transactions
              </Button>
            )}
          </div>
        ) : (
          displayTransactions.map(transaction => {
            const iconData = getTransactionIcon(transaction.type);
            return (
              <div
                key={transaction.id}
                style={transactionItemStyles}
                onClick={() =>
                  transaction.blockchainTxId &&
                  onViewTransaction(transaction.blockchainTxId)
                }
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor =
                    tokens.colors.neutral[50];
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div
                  style={{
                    ...transactionIconStyles,
                    backgroundColor: iconData.bg,
                  }}
                >
                  {iconData.icon}
                </div>
                <div style={transactionContentStyles}>
                  <div style={transactionTitleStyles}>{transaction.title}</div>
                  <div style={transactionDescriptionStyles}>
                    {transaction.description}
                  </div>
                  <div style={transactionTimeStyles}>
                    {formatTimestamp(transaction.timestamp)}
                    {transaction.blockchainTxId && (
                      <span style={{ marginLeft: tokens.spacing[2] }}>
                        • TX: {transaction.blockchainTxId.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: tokens.spacing[2],
                  }}
                >
                  <span style={statusBadgeStyles(transaction.status)}>
                    {transaction.status.charAt(0).toUpperCase() +
                      transaction.status.slice(1)}
                  </span>
                  {transaction.amount && (
                    <div style={transactionAmountStyles}>
                      ${transaction.amount.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
