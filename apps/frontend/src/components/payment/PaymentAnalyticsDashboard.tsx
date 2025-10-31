import React, { useState, useMemo } from 'react';
import { PaymentTransaction, EscrowAccount } from '@booking-swap/shared';
import { tokens } from '../../design-system/tokens';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface PaymentAnalyticsDashboardProps {
  transactions: PaymentTransaction[];
  escrowAccounts: EscrowAccount[];
  userId: string;
}

interface MonthlyData {
  month: string;
  volume: number;
  count: number;
  fees: number;
}

interface AnalyticsData {
  totalVolume: number;
  totalFees: number;
  averageTransaction: number;
  successRate: number;
  monthlyVolume: MonthlyData[];
  paymentMethodBreakdown: { method: string; volume: number; count: number }[];
  escrowStats: {
    totalEscrowed: number;
    activeEscrow: number;
    releasedEscrow: number;
    refundedEscrow: number;
  };
}

export const PaymentAnalyticsDashboard: React.FC<PaymentAnalyticsDashboardProps> = ({
  transactions,
  escrowAccounts,
  userId,
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [showExportModal, setShowExportModal] = useState(false);

  const analyticsData = useMemo((): AnalyticsData => {
    // Filter transactions by time range
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const filteredTransactions = transactions.filter(
      t => new Date(t.createdAt) >= startDate
    );

    // Calculate basic metrics
    const completedTransactions = filteredTransactions.filter(t => t.status === 'completed');
    const totalVolume = completedTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalFees = completedTransactions.reduce((sum, t) => sum + t.platformFee, 0);
    const averageTransaction = completedTransactions.length > 0 ? totalVolume / completedTransactions.length : 0;
    const successRate = filteredTransactions.length > 0 
      ? (completedTransactions.length / filteredTransactions.length) * 100 
      : 0;

    // Calculate monthly volume
    const monthlyMap = new Map<string, MonthlyData>();
    completedTransactions.forEach(transaction => {
      const date = new Date(transaction.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: monthName,
          volume: 0,
          count: 0,
          fees: 0,
        });
      }
      
      const monthData = monthlyMap.get(monthKey)!;
      monthData.volume += transaction.amount;
      monthData.count += 1;
      monthData.fees += transaction.platformFee;
    });

    const monthlyVolume = Array.from(monthlyMap.values()).sort((a, b) => 
      new Date(a.month).getTime() - new Date(b.month).getTime()
    );

    // Calculate payment method breakdown
    const methodMap = new Map<string, { volume: number; count: number }>();
    completedTransactions.forEach(transaction => {
      const method = transaction.paymentMethod || 'Unknown';
      if (!methodMap.has(method)) {
        methodMap.set(method, { volume: 0, count: 0 });
      }
      const methodData = methodMap.get(method)!;
      methodData.volume += transaction.amount;
      methodData.count += 1;
    });

    const paymentMethodBreakdown = Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      volume: data.volume,
      count: data.count,
    }));

    // Calculate escrow stats
    const filteredEscrow = escrowAccounts.filter(
      e => new Date(e.createdAt) >= startDate
    );
    
    const escrowStats = {
      totalEscrowed: filteredEscrow.reduce((sum, e) => sum + e.amount, 0),
      activeEscrow: filteredEscrow.filter(e => e.status === 'active').reduce((sum, e) => sum + e.amount, 0),
      releasedEscrow: filteredEscrow.filter(e => e.status === 'released').reduce((sum, e) => sum + e.amount, 0),
      refundedEscrow: filteredEscrow.filter(e => e.status === 'refunded').reduce((sum, e) => sum + e.amount, 0),
    };

    return {
      totalVolume,
      totalFees,
      averageTransaction,
      successRate,
      monthlyVolume,
      paymentMethodBreakdown,
      escrowStats,
    };
  }, [transactions, escrowAccounts, timeRange]);

  const exportAnalytics = () => {
    const exportData = {
      timeRange,
      generatedAt: new Date().toISOString(),
      analytics: analyticsData,
      transactions: transactions.length,
      escrowAccounts: escrowAccounts.length,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header with Time Range Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.spacing[6],
        }}
      >
        <div>
          <h2
            style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.neutral[900],
              margin: 0,
              marginBottom: tokens.spacing[1],
            }}
          >
            Payment Analytics
          </h2>
          <p
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
              margin: 0,
            }}
          >
            Insights into your payment activity and performance
          </p>
        </div>

        <div style={{ display: 'flex', gap: tokens.spacing[3], alignItems: 'center' }}>
          <select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value as typeof timeRange)}
            style={{
              padding: tokens.spacing[2],
              fontSize: tokens.typography.fontSize.sm,
              border: `1px solid ${tokens.colors.neutral[300]}`,
              borderRadius: tokens.borderRadius.md,
              backgroundColor: tokens.colors.white,
            }}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>

          <Button
            variant="secondary"
            onClick={exportAnalytics}
          >
            📊 Export Data
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: tokens.spacing[4],
          marginBottom: tokens.spacing[6],
        }}
      >
        <Card>
          <div style={{ padding: tokens.spacing[4] }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: tokens.spacing[2],
              }}
            >
              <h3
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[600],
                  margin: 0,
                }}
              >
                Total Volume
              </h3>
              <span style={{ fontSize: tokens.typography.fontSize.lg }}>💰</span>
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.primary[600],
                marginBottom: tokens.spacing[1],
              }}
            >
              ${analyticsData.totalVolume.toFixed(2)}
            </div>
            <p
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[500],
                margin: 0,
              }}
            >
              Across {transactions.filter(t => t.status === 'completed').length} completed transactions
            </p>
          </div>
        </Card>

        <Card>
          <div style={{ padding: tokens.spacing[4] }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: tokens.spacing[2],
              }}
            >
              <h3
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[600],
                  margin: 0,
                }}
              >
                Platform Fees
              </h3>
              <span style={{ fontSize: tokens.typography.fontSize.lg }}>💳</span>
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.warning[600],
                marginBottom: tokens.spacing[1],
              }}
            >
              ${analyticsData.totalFees.toFixed(2)}
            </div>
            <p
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[500],
                margin: 0,
              }}
            >
              {analyticsData.totalVolume > 0 
                ? `${((analyticsData.totalFees / analyticsData.totalVolume) * 100).toFixed(1)}% of total volume`
                : 'No transactions yet'
              }
            </p>
          </div>
        </Card>

        <Card>
          <div style={{ padding: tokens.spacing[4] }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: tokens.spacing[2],
              }}
            >
              <h3
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[600],
                  margin: 0,
                }}
              >
                Average Transaction
              </h3>
              <span style={{ fontSize: tokens.typography.fontSize.lg }}>📈</span>
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.success[600],
                marginBottom: tokens.spacing[1],
              }}
            >
              ${analyticsData.averageTransaction.toFixed(2)}
            </div>
            <p
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[500],
                margin: 0,
              }}
            >
              Per completed transaction
            </p>
          </div>
        </Card>

        <Card>
          <div style={{ padding: tokens.spacing[4] }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: tokens.spacing[2],
              }}
            >
              <h3
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[600],
                  margin: 0,
                }}
              >
                Success Rate
              </h3>
              <span style={{ fontSize: tokens.typography.fontSize.lg }}>✅</span>
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: analyticsData.successRate >= 90 
                  ? tokens.colors.success[600] 
                  : analyticsData.successRate >= 70 
                    ? tokens.colors.warning[600] 
                    : tokens.colors.error[600],
                marginBottom: tokens.spacing[1],
              }}
            >
              {analyticsData.successRate.toFixed(1)}%
            </div>
            <p
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[500],
                margin: 0,
              }}
            >
              Of all payment attempts
            </p>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: tokens.spacing[6],
          marginBottom: tokens.spacing[6],
        }}
      >
        {/* Monthly Volume Chart */}
        <Card>
          <div style={{ padding: tokens.spacing[4] }}>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[900],
                marginBottom: tokens.spacing[4],
              }}
            >
              Monthly Transaction Volume
            </h3>
            
            {analyticsData.monthlyVolume.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'end',
                  gap: tokens.spacing[2],
                  height: '200px',
                  padding: tokens.spacing[2],
                }}
              >
                {analyticsData.monthlyVolume.map((month, index) => {
                  const maxVolume = Math.max(...analyticsData.monthlyVolume.map(m => m.volume));
                  const height = maxVolume > 0 ? (month.volume / maxVolume) * 160 : 0;
                  
                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: `${height}px`,
                          backgroundColor: tokens.colors.primary[500],
                          borderRadius: `${tokens.borderRadius.sm} ${tokens.borderRadius.sm} 0 0`,
                          marginBottom: tokens.spacing[2],
                          position: 'relative',
                        }}
                        title={`${month.month}: $${month.volume.toFixed(2)} (${month.count} transactions)`}
                      />
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.xs,
                          color: tokens.colors.neutral[600],
                          textAlign: 'center',
                          transform: 'rotate(-45deg)',
                          transformOrigin: 'center',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {month.month}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: tokens.spacing[8],
                  color: tokens.colors.neutral[500],
                }}
              >
                No transaction data available for the selected time range
              </div>
            )}
          </div>
        </Card>

        {/* Payment Method Breakdown */}
        <Card>
          <div style={{ padding: tokens.spacing[4] }}>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[900],
                marginBottom: tokens.spacing[4],
              }}
            >
              Payment Methods
            </h3>
            
            {analyticsData.paymentMethodBreakdown.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[3] }}>
                {analyticsData.paymentMethodBreakdown.map((method, index) => {
                  const percentage = analyticsData.totalVolume > 0 
                    ? (method.volume / analyticsData.totalVolume) * 100 
                    : 0;
                  
                  return (
                    <div key={index}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: tokens.spacing[1],
                        }}
                      >
                        <span
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[700],
                          }}
                        >
                          {method.method}
                        </span>
                        <span
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.neutral[900],
                          }}
                        >
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: '8px',
                          backgroundColor: tokens.colors.neutral[200],
                          borderRadius: tokens.borderRadius.full,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: '100%',
                            backgroundColor: tokens.colors.primary[500],
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.xs,
                          color: tokens.colors.neutral[500],
                          marginTop: tokens.spacing[1],
                        }}
                      >
                        ${method.volume.toFixed(2)} • {method.count} transactions
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: tokens.spacing[4],
                  color: tokens.colors.neutral[500],
                }}
              >
                No payment method data available
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Escrow Analytics */}
      <Card>
        <div style={{ padding: tokens.spacing[4] }}>
          <h3
            style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[900],
              marginBottom: tokens.spacing[4],
            }}
          >
            Escrow Account Analytics
          </h3>
          
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: tokens.spacing[4],
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.primary[600],
                  marginBottom: tokens.spacing[1],
                }}
              >
                ${analyticsData.escrowStats.totalEscrowed.toFixed(2)}
              </div>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}
              >
                Total Escrowed
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.warning[600],
                  marginBottom: tokens.spacing[1],
                }}
              >
                ${analyticsData.escrowStats.activeEscrow.toFixed(2)}
              </div>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}
              >
                Active Escrow
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.success[600],
                  marginBottom: tokens.spacing[1],
                }}
              >
                ${analyticsData.escrowStats.releasedEscrow.toFixed(2)}
              </div>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}
              >
                Released Funds
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.bold,
                  color: tokens.colors.error[600],
                  marginBottom: tokens.spacing[1],
                }}
              >
                ${analyticsData.escrowStats.refundedEscrow.toFixed(2)}
              </div>
              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}
              >
                Refunded Funds
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};