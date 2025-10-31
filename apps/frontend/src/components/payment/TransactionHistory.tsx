import React, { useState, useMemo } from 'react';
import { PaymentTransaction, PaymentStatus } from '@booking-swap/shared';
import { tokens } from '../../design-system/tokens';
import { paymentService } from '../../services/paymentService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingIndicator';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { Modal } from '../ui/Modal';

interface TransactionHistoryProps {
  userId: string;
  transactions: PaymentTransaction[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

interface TransactionFilters {
  status: PaymentStatus | 'all';
  dateRange: 'all' | '7d' | '30d' | '90d' | 'custom';
  customStartDate?: Date;
  customEndDate?: Date;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  userId,
  transactions,
  loading,
  error,
  onRefresh,
}) => {
  const [filters, setFilters] = useState<TransactionFilters>({
    status: 'all',
    dateRange: 'all',
  });
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentTransaction | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(transaction => transaction.status === filters.status);
    }

    // Filter by date range
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (filters.dateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          if (filters.customStartDate && filters.customEndDate) {
            filtered = filtered.filter(transaction => {
              const transactionDate = new Date(transaction.createdAt);
              return transactionDate >= filters.customStartDate! && 
                     transactionDate <= filters.customEndDate!;
            });
          }
          return filtered;
        default:
          return filtered;
      }

      filtered = filtered.filter(transaction => 
        new Date(transaction.createdAt) >= startDate
      );
    }

    return filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [transactions, filters]);

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'completed':
        return tokens.colors.success[600];
      case 'pending':
        return tokens.colors.warning[600];
      case 'processing':
        return tokens.colors.primary[600];
      case 'failed':
        return tokens.colors.error[600];
      case 'refunded':
        return tokens.colors.neutral[600];
      default:
        return tokens.colors.neutral[500];
    }
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'pending':
        return '⏳';
      case 'processing':
        return '🔄';
      case 'failed':
        return '❌';
      case 'refunded':
        return '↩️';
      default:
        return '❓';
    }
  };

  const handleGenerateReceipt = async (transaction: PaymentTransaction) => {
    setActionLoading(true);
    setActionError(null);
    
    try {
      const receipt = await paymentService.generateReceipt(transaction.id);
      
      // Create and download receipt
      const receiptData = {
        transactionId: receipt.transactionId,
        swapId: receipt.swapId,
        amount: receipt.amount,
        currency: receipt.currency,
        fees: receipt.fees,
        paymentMethod: receipt.paymentMethod,
        completedAt: receipt.completedAt,
      };
      
      const blob = new Blob([JSON.stringify(receiptData, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${transaction.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error: any) {
      setActionError(error.message || 'Failed to generate receipt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestRefund = async () => {
    if (!selectedTransaction || !refundReason.trim()) return;

    setActionLoading(true);
    setActionError(null);
    
    try {
      await paymentService.refundPayment(selectedTransaction.id, {
        transactionId: selectedTransaction.id,
        reason: refundReason,
        refundToOriginalMethod: true,
      });
      
      setShowRefundModal(false);
      setSelectedTransaction(null);
      setRefundReason('');
      onRefresh();
    } catch (error: any) {
      setActionError(error.message || 'Failed to request refund');
    } finally {
      setActionLoading(false);
    }
  };

  const getTransactionStats = () => {
    const completed = transactions.filter(t => t.status === 'completed').length;
    const pending = transactions.filter(t => t.status === 'pending' || t.status === 'processing').length;
    const failed = transactions.filter(t => t.status === 'failed').length;
    const totalAmount = transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return { completed, pending, failed, totalAmount };
  };

  const stats = getTransactionStats();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: tokens.spacing[8] }}>
        <LoadingSpinner size="lg" />
        <p style={{ 
          marginTop: tokens.spacing[4], 
          color: tokens.colors.neutral[600] 
        }}>
          Loading transaction history...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        error={new Error(error)}
        onRetry={onRefresh}
        title="Failed to load transaction history"
      />
    );
  }

  return (
    <div>
      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: tokens.spacing[4],
          marginBottom: tokens.spacing[6],
        }}
      >
        <Card>
          <div style={{ textAlign: 'center', padding: tokens.spacing[4] }}>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.success[600],
                marginBottom: tokens.spacing[2],
              }}
            >
              {stats.completed}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Completed Transactions
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ textAlign: 'center', padding: tokens.spacing[4] }}>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.warning[600],
                marginBottom: tokens.spacing[2],
              }}
            >
              {stats.pending}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Pending Transactions
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ textAlign: 'center', padding: tokens.spacing[4] }}>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.error[600],
                marginBottom: tokens.spacing[2],
              }}
            >
              {stats.failed}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Failed Transactions
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ textAlign: 'center', padding: tokens.spacing[4] }}>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.primary[600],
                marginBottom: tokens.spacing[2],
              }}
            >
              ${stats.totalAmount.toFixed(2)}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Total Transaction Volume
            </div>
          </div>
        </Card>
      </div>

      {/* Action Error */}
      {actionError && (
        <div
          style={{
            marginBottom: tokens.spacing[4],
            padding: tokens.spacing[3],
            backgroundColor: tokens.colors.error[50],
            border: `1px solid ${tokens.colors.error[200]}`,
            borderRadius: tokens.borderRadius.md,
            color: tokens.colors.error[700],
          }}
        >
          {actionError}
        </div>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: tokens.spacing[6] }}>
        <div style={{ padding: tokens.spacing[4] }}>
          <h3
            style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[900],
              marginBottom: tokens.spacing[4],
            }}
          >
            Filter Transactions
          </h3>
          
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: tokens.spacing[4],
            }}
          >
            {/* Status Filter */}
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
                Status
              </label>
              <select
                value={filters.status}
                onChange={e => setFilters(prev => ({ 
                  ...prev, 
                  status: e.target.value as PaymentStatus | 'all' 
                }))}
                style={{
                  width: '100%',
                  padding: tokens.spacing[2],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                  backgroundColor: tokens.colors.white,
                }}
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            {/* Date Range Filter */}
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
                Date Range
              </label>
              <select
                value={filters.dateRange}
                onChange={e => setFilters(prev => ({ 
                  ...prev, 
                  dateRange: e.target.value as TransactionFilters['dateRange']
                }))}
                style={{
                  width: '100%',
                  padding: tokens.spacing[2],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                  backgroundColor: tokens.colors.white,
                }}
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <Card>
          <div
            style={{
              textAlign: 'center',
              padding: tokens.spacing[8],
            }}
          >
            <div
              style={{
                fontSize: tokens.typography.fontSize['4xl'],
                marginBottom: tokens.spacing[4],
              }}
            >
              📊
            </div>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[700],
                marginBottom: tokens.spacing[2],
              }}
            >
              No Transactions Found
            </h3>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              {transactions.length === 0 
                ? "You haven't made any transactions yet"
                : "No transactions match your current filters"
              }
            </p>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[3] }}>
          {filteredTransactions.map(transaction => (
            <Card key={transaction.id}>
              <div
                style={{
                  padding: tokens.spacing[4],
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[3],
                      marginBottom: tokens.spacing[2],
                    }}
                  >
                    <span style={{ fontSize: tokens.typography.fontSize.lg }}>
                      {getStatusIcon(transaction.status)}
                    </span>
                    <div>
                      <h4
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          fontWeight: tokens.typography.fontWeight.medium,
                          color: tokens.colors.neutral[900],
                          margin: 0,
                        }}
                      >
                        Transaction #{transaction.id.slice(-8)}
                      </h4>
                      <p
                        style={{
                          fontSize: tokens.typography.fontSize.xs,
                          color: tokens.colors.neutral[600],
                          margin: 0,
                        }}
                      >
                        {new Date(transaction.createdAt).toLocaleDateString()} at{' '}
                        {new Date(transaction.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: tokens.spacing[4],
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[600],
                    }}
                  >
                    <div>
                      <strong>Amount:</strong> {transaction.currency} {transaction.amount.toFixed(2)}
                    </div>
                    <div>
                      <strong>Status:</strong>{' '}
                      <span style={{ color: getStatusColor(transaction.status) }}>
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      </span>
                    </div>
                    <div>
                      <strong>Platform Fee:</strong> {transaction.currency} {transaction.platformFee.toFixed(2)}
                    </div>
                    <div>
                      <strong>Net Amount:</strong> {transaction.currency} {transaction.netAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: tokens.spacing[2],
                    alignItems: 'center',
                  }}
                >
                  {transaction.status === 'completed' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleGenerateReceipt(transaction)}
                      disabled={actionLoading}
                    >
                      📄 Receipt
                    </Button>
                  )}
                  
                  {(transaction.status === 'completed' || transaction.status === 'processing') && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedTransaction(transaction);
                        setShowRefundModal(true);
                      }}
                      disabled={actionLoading}
                    >
                      ↩️ Refund
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Refund Request Modal */}
      {showRefundModal && selectedTransaction && (
        <Modal
          isOpen={showRefundModal}
          onClose={() => setShowRefundModal(false)}
          title="Request Refund"
        >
          <div style={{ padding: tokens.spacing[6] }}>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[700],
                marginBottom: tokens.spacing[4],
              }}
            >
              Request a refund for transaction #{selectedTransaction.id.slice(-8)} 
              ({selectedTransaction.currency} {selectedTransaction.amount.toFixed(2)})
            </p>
            
            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Reason for Refund *
              </label>
              <textarea
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                placeholder="Please explain why you're requesting a refund..."
                rows={4}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                  resize: 'vertical',
                }}
              />
            </div>
            
            <div
              style={{
                display: 'flex',
                gap: tokens.spacing[3],
                justifyContent: 'flex-end',
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setShowRefundModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRequestRefund}
                loading={actionLoading}
                disabled={!refundReason.trim()}
              >
                Request Refund
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};