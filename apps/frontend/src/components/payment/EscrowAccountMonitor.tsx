import React, { useState, useMemo } from 'react';
import { EscrowAccount, EscrowStatus } from '@booking-swap/shared';
import { tokens } from '../../design-system/tokens';
import { paymentService } from '../../services/paymentService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingIndicator';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { Modal } from '../ui/Modal';

interface EscrowAccountMonitorProps {
  userId: string;
  escrowAccounts: EscrowAccount[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

interface EscrowFilters {
  status: EscrowStatus | 'all';
  dateRange: 'all' | '7d' | '30d' | '90d';
}

export const EscrowAccountMonitor: React.FC<EscrowAccountMonitorProps> = ({
  userId,
  escrowAccounts,
  loading,
  error,
  onRefresh,
}) => {
  const [filters, setFilters] = useState<EscrowFilters>({
    status: 'all',
    dateRange: 'all',
  });
  const [selectedEscrow, setSelectedEscrow] = useState<EscrowAccount | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [releaseReason, setReleaseReason] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredEscrowAccounts = useMemo(() => {
    let filtered = [...escrowAccounts];

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(account => account.status === filters.status);
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
        default:
          return filtered;
      }

      filtered = filtered.filter(account => 
        new Date(account.createdAt) >= startDate
      );
    }

    return filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [escrowAccounts, filters]);

  const getStatusColor = (status: EscrowStatus) => {
    switch (status) {
      case 'active':
        return tokens.colors.primary[600];
      case 'released':
        return tokens.colors.success[600];
      case 'refunded':
        return tokens.colors.warning[600];
      case 'disputed':
        return tokens.colors.error[600];
      case 'expired':
        return tokens.colors.neutral[600];
      default:
        return tokens.colors.neutral[500];
    }
  };

  const getStatusIcon = (status: EscrowStatus) => {
    switch (status) {
      case 'active':
        return '🔒';
      case 'released':
        return '✅';
      case 'refunded':
        return '↩️';
      case 'disputed':
        return '⚠️';
      case 'expired':
        return '⏰';
      default:
        return '❓';
    }
  };

  const handleReleaseEscrow = async () => {
    if (!selectedEscrow || !releaseReason.trim()) return;

    setActionLoading(true);
    setActionError(null);
    
    try {
      await paymentService.releaseEscrow({
        escrowId: selectedEscrow.id,
        recipientId: selectedEscrow.recipientId,
        amount: selectedEscrow.amount,
        reason: releaseReason,
      });
      
      setShowReleaseModal(false);
      setSelectedEscrow(null);
      setReleaseReason('');
      onRefresh();
    } catch (error: any) {
      setActionError(error.message || 'Failed to release escrow');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefundEscrow = async () => {
    if (!selectedEscrow || !refundReason.trim()) return;

    setActionLoading(true);
    setActionError(null);
    
    try {
      await paymentService.refundEscrow(selectedEscrow.id, refundReason);
      
      setShowRefundModal(false);
      setSelectedEscrow(null);
      setRefundReason('');
      onRefresh();
    } catch (error: any) {
      setActionError(error.message || 'Failed to refund escrow');
    } finally {
      setActionLoading(false);
    }
  };

  const getEscrowStats = () => {
    const active = escrowAccounts.filter(acc => acc.status === 'active').length;
    const released = escrowAccounts.filter(acc => acc.status === 'released').length;
    const refunded = escrowAccounts.filter(acc => acc.status === 'refunded').length;
    const totalAmount = escrowAccounts
      .filter(acc => acc.status === 'active')
      .reduce((sum, acc) => sum + acc.amount, 0);
    
    return { active, released, refunded, totalAmount };
  };

  const stats = getEscrowStats();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: tokens.spacing[8] }}>
        <LoadingSpinner size="lg" />
        <p style={{ 
          marginTop: tokens.spacing[4], 
          color: tokens.colors.neutral[600] 
        }}>
          Loading escrow accounts...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        error={new Error(error)}
        onRetry={onRefresh}
        title="Failed to load escrow accounts"
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
                color: tokens.colors.primary[600],
                marginBottom: tokens.spacing[2],
              }}
            >
              {stats.active}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Active Escrow Accounts
            </div>
          </div>
        </Card>

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
              {stats.released}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Released Accounts
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
              {stats.refunded}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Refunded Accounts
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
              Total Escrowed Amount
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
            Filter Escrow Accounts
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
                  status: e.target.value as EscrowStatus | 'all' 
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
                <option value="active">Active</option>
                <option value="released">Released</option>
                <option value="refunded">Refunded</option>
                <option value="disputed">Disputed</option>
                <option value="expired">Expired</option>
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
                  dateRange: e.target.value as EscrowFilters['dateRange']
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
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Escrow Accounts List */}
      {filteredEscrowAccounts.length === 0 ? (
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
              🔒
            </div>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[700],
                marginBottom: tokens.spacing[2],
              }}
            >
              No Escrow Accounts Found
            </h3>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              {escrowAccounts.length === 0 
                ? "You don't have any escrow accounts yet"
                : "No escrow accounts match your current filters"
              }
            </p>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[3] }}>
          {filteredEscrowAccounts.map(account => (
            <Card key={account.id}>
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
                      {getStatusIcon(account.status)}
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
                        Escrow #{account.id.slice(-8)}
                      </h4>
                      <p
                        style={{
                          fontSize: tokens.typography.fontSize.xs,
                          color: tokens.colors.neutral[600],
                          margin: 0,
                        }}
                      >
                        Created: {new Date(account.createdAt).toLocaleDateString()} • 
                        Swap: #{account.swapId.slice(-8)}
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
                      <strong>Amount:</strong> {account.currency} {account.amount.toFixed(2)}
                    </div>
                    <div>
                      <strong>Status:</strong>{' '}
                      <span style={{ color: getStatusColor(account.status) }}>
                        {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                      </span>
                    </div>
                    <div>
                      <strong>Payer:</strong> {account.payerId.slice(-8)}
                    </div>
                    <div>
                      <strong>Recipient:</strong> {account.recipientId.slice(-8)}
                    </div>
                  </div>

                  {account.expiresAt && (
                    <div
                      style={{
                        marginTop: tokens.spacing[2],
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                      }}
                    >
                      <strong>Expires:</strong> {new Date(account.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: tokens.spacing[2],
                    alignItems: 'center',
                  }}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedEscrow(account);
                      setShowDetailsModal(true);
                    }}
                  >
                    View Details
                  </Button>
                  
                  {account.status === 'active' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSelectedEscrow(account);
                          setShowReleaseModal(true);
                        }}
                        disabled={actionLoading}
                      >
                        Release
                      </Button>
                      
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedEscrow(account);
                          setShowRefundModal(true);
                        }}
                        disabled={actionLoading}
                      >
                        Refund
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Escrow Details Modal */}
      {showDetailsModal && selectedEscrow && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title={`Escrow Account #${selectedEscrow.id.slice(-8)}`}
        >
          <div style={{ padding: tokens.spacing[6] }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: tokens.spacing[4],
                marginBottom: tokens.spacing[6],
                fontSize: tokens.typography.fontSize.sm,
              }}
            >
              <div>
                <strong>Escrow ID:</strong><br />
                {selectedEscrow.id}
              </div>
              <div>
                <strong>Amount:</strong><br />
                {selectedEscrow.currency} {selectedEscrow.amount.toFixed(2)}
              </div>
              <div>
                <strong>Status:</strong><br />
                <span style={{ color: getStatusColor(selectedEscrow.status) }}>
                  {selectedEscrow.status.charAt(0).toUpperCase() + selectedEscrow.status.slice(1)}
                </span>
              </div>
              <div>
                <strong>Created:</strong><br />
                {new Date(selectedEscrow.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div style={{ marginBottom: tokens.spacing[4] }}>
              <h4
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[900],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Transaction Details
              </h4>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[700],
                  lineHeight: 1.5,
                }}
              >
                <div><strong>Swap ID:</strong> {selectedEscrow.swapId}</div>
                <div><strong>Proposal ID:</strong> {selectedEscrow.proposalId}</div>
                <div><strong>Payer ID:</strong> {selectedEscrow.payerId}</div>
                <div><strong>Recipient ID:</strong> {selectedEscrow.recipientId}</div>
              </div>
            </div>

            {selectedEscrow.expiresAt && (
              <div style={{ marginBottom: tokens.spacing[4] }}>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[900],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  Expiration
                </h4>
                <p
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[700],
                    margin: 0,
                  }}
                >
                  This escrow account will expire on {new Date(selectedEscrow.expiresAt).toLocaleDateString()} at{' '}
                  {new Date(selectedEscrow.expiresAt).toLocaleTimeString()}
                </p>
              </div>
            )}
            
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Release Escrow Modal */}
      {showReleaseModal && selectedEscrow && (
        <Modal
          isOpen={showReleaseModal}
          onClose={() => setShowReleaseModal(false)}
          title="Release Escrow Funds"
        >
          <div style={{ padding: tokens.spacing[6] }}>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[700],
                marginBottom: tokens.spacing[4],
              }}
            >
              Release {selectedEscrow.currency} {selectedEscrow.amount.toFixed(2)} from escrow 
              #{selectedEscrow.id.slice(-8)} to the recipient.
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
                Reason for Release *
              </label>
              <textarea
                value={releaseReason}
                onChange={e => setReleaseReason(e.target.value)}
                placeholder="Please explain why you're releasing the escrow funds..."
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
                onClick={() => setShowReleaseModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleReleaseEscrow}
                loading={actionLoading}
                disabled={!releaseReason.trim()}
              >
                Release Funds
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Refund Escrow Modal */}
      {showRefundModal && selectedEscrow && (
        <Modal
          isOpen={showRefundModal}
          onClose={() => setShowRefundModal(false)}
          title="Refund Escrow Funds"
        >
          <div style={{ padding: tokens.spacing[6] }}>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[700],
                marginBottom: tokens.spacing[4],
              }}
            >
              Refund {selectedEscrow.currency} {selectedEscrow.amount.toFixed(2)} from escrow 
              #{selectedEscrow.id.slice(-8)} back to the payer.
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
                placeholder="Please explain why you're refunding the escrow funds..."
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
                variant="danger"
                onClick={handleRefundEscrow}
                loading={actionLoading}
                disabled={!refundReason.trim()}
              >
                Refund Funds
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};