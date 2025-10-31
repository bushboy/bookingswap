import React, { useState, useEffect } from 'react';
import { tokens } from '../../design-system/tokens';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import { usePaymentTransactions } from '../../hooks/usePaymentTransactions';
import { useEscrowAccounts } from '../../hooks/useEscrowAccounts';
import { PaymentMethodManagement } from './PaymentMethodManagement';
import { TransactionHistory } from './TransactionHistory';
import { EscrowAccountMonitor } from './EscrowAccountMonitor';
import { DisputeManagement } from './DisputeManagement';

interface PaymentManagementDashboardProps {
  userId: string;
}

type TabType = 'methods' | 'transactions' | 'escrow' | 'disputes';

export const PaymentManagementDashboard: React.FC<PaymentManagementDashboardProps> = ({
  userId,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('methods');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const {
    paymentMethods,
    loading: methodsLoading,
    error: methodsError,
    fetchPaymentMethods,
  } = usePaymentMethods();

  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
    fetchTransactions,
  } = usePaymentTransactions();

  const {
    escrowAccounts,
    loading: escrowLoading,
    error: escrowError,
    fetchEscrowAccounts,
  } = useEscrowAccounts();

  useEffect(() => {
    fetchPaymentMethods();
    fetchTransactions();
    fetchEscrowAccounts();
  }, [fetchPaymentMethods, fetchTransactions, fetchEscrowAccounts, refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const tabs = [
    {
      id: 'methods' as TabType,
      label: 'Payment Methods',
      count: paymentMethods.length,
      icon: '💳',
    },
    {
      id: 'transactions' as TabType,
      label: 'Transaction History',
      count: transactions.length,
      icon: '📊',
    },
    {
      id: 'escrow' as TabType,
      label: 'Escrow Accounts',
      count: escrowAccounts.length,
      icon: '🔒',
    },
    {
      id: 'disputes' as TabType,
      label: 'Disputes',
      count: 0, // Will be updated when disputes are loaded
      icon: '⚖️',
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'methods':
        return (
          <PaymentMethodManagement
            userId={userId}
            paymentMethods={paymentMethods}
            loading={methodsLoading}
            error={methodsError}
            onRefresh={handleRefresh}
          />
        );
      case 'transactions':
        return (
          <TransactionHistory
            userId={userId}
            transactions={transactions}
            loading={transactionsLoading}
            error={transactionsError}
            onRefresh={handleRefresh}
          />
        );
      case 'escrow':
        return (
          <EscrowAccountMonitor
            userId={userId}
            escrowAccounts={escrowAccounts}
            loading={escrowLoading}
            error={escrowError}
            onRefresh={handleRefresh}
          />
        );
      case 'disputes':
        return (
          <DisputeManagement
            userId={userId}
            onRefresh={handleRefresh}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        padding: tokens.spacing[6],
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: tokens.spacing[6],
        }}
      >
        <h1
          style={{
            fontSize: tokens.typography.fontSize['2xl'],
            fontWeight: tokens.typography.fontWeight.bold,
            color: tokens.colors.neutral[900],
            marginBottom: tokens.spacing[2],
          }}
        >
          Payment Management
        </h1>
        <p
          style={{
            fontSize: tokens.typography.fontSize.lg,
            color: tokens.colors.neutral[600],
            margin: 0,
          }}
        >
          Manage your payment methods, view transaction history, and monitor escrow accounts
        </p>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
          marginBottom: tokens.spacing[6],
        }}
      >
        <nav
          style={{
            display: 'flex',
            gap: tokens.spacing[1],
          }}
        >
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: activeTab === tab.id 
                  ? tokens.colors.primary[600] 
                  : tokens.colors.neutral[600],
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${
                  activeTab === tab.id 
                    ? tokens.colors.primary[600] 
                    : 'transparent'
                }`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: tokens.typography.fontSize.lg }}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  style={{
                    fontSize: tokens.typography.fontSize.xs,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.white,
                    backgroundColor: activeTab === tab.id 
                      ? tokens.colors.primary[600] 
                      : tokens.colors.neutral[400],
                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                    borderRadius: tokens.borderRadius.full,
                    minWidth: '20px',
                    textAlign: 'center',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {renderTabContent()}
      </div>
    </div>
  );
};