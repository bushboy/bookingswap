import React, { useState, useEffect } from 'react';
import { PaymentMethod } from '@booking-swap/shared';
import { tokens } from '../../design-system/tokens';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import { PaymentMethodCard } from './PaymentMethodCard';
import { AddPaymentMethodModal } from './AddPaymentMethodModal';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  amount: number;
  currency: string;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onSelect,
  amount,
  currency,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const {
    paymentMethods,
    loading,
    error,
    fetchPaymentMethods,
    addPaymentMethod,
  } = usePaymentMethods();

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  const handleAddPaymentMethod = async (methodData: any) => {
    try {
      const newMethod = await addPaymentMethod(methodData);
      onSelect(newMethod);
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to add payment method:', error);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: tokens.spacing[4],
          textAlign: 'center',
          color: tokens.colors.neutral[600],
        }}
      >
        Loading payment methods...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: tokens.spacing[4],
          backgroundColor: tokens.colors.error[50],
          border: `1px solid ${tokens.colors.error[200]}`,
          borderRadius: tokens.borderRadius.md,
          color: tokens.colors.error[700],
        }}
      >
        Error loading payment methods: {error}
      </div>
    );
  }

  const verifiedMethods = paymentMethods.filter(method => method.isVerified);
  const unverifiedMethods = paymentMethods.filter(method => !method.isVerified);

  return (
    <div>
      {/* Verified Payment Methods */}
      {verifiedMethods.length > 0 && (
        <div style={{ marginBottom: tokens.spacing[4] }}>
          <h4
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[3],
            }}
          >
            Verified Payment Methods
          </h4>
          <div
            style={{
              display: 'grid',
              gap: tokens.spacing[3],
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            }}
          >
            {verifiedMethods.map(method => (
              <PaymentMethodCard
                key={method.id}
                method={method}
                isSelected={selectedMethod?.id === method.id}
                onSelect={() => onSelect(method)}
                amount={amount}
                currency={currency}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unverified Payment Methods */}
      {unverifiedMethods.length > 0 && (
        <div style={{ marginBottom: tokens.spacing[4] }}>
          <h4
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.warning[700],
              marginBottom: tokens.spacing[3],
            }}
          >
            Unverified Payment Methods (Verification Required)
          </h4>
          <div
            style={{
              display: 'grid',
              gap: tokens.spacing[3],
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            }}
          >
            {unverifiedMethods.map(method => (
              <PaymentMethodCard
                key={method.id}
                method={method}
                isSelected={selectedMethod?.id === method.id}
                onSelect={() => onSelect(method)}
                amount={amount}
                currency={currency}
                showVerificationWarning
              />
            ))}
          </div>
        </div>
      )}

      {/* Add New Payment Method */}
      <div
        style={{
          padding: tokens.spacing[4],
          border: `2px dashed ${tokens.colors.neutral[300]}`,
          borderRadius: tokens.borderRadius.md,
          textAlign: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          style={{
            padding: `${tokens.spacing[3]} ${tokens.spacing[6]}`,
            fontSize: tokens.typography.fontSize.sm,
            fontWeight: tokens.typography.fontWeight.medium,
            color: tokens.colors.primary[600],
            backgroundColor: 'transparent',
            border: `1px solid ${tokens.colors.primary[600]}`,
            borderRadius: tokens.borderRadius.md,
            cursor: 'pointer',
          }}
        >
          + Add New Payment Method
        </button>
        <p
          style={{
            fontSize: tokens.typography.fontSize.xs,
            color: tokens.colors.neutral[500],
            marginTop: tokens.spacing[2],
            margin: 0,
          }}
        >
          All payment methods are securely encrypted and PCI compliant
        </p>
      </div>

      {/* No Payment Methods */}
      {paymentMethods.length === 0 && (
        <div
          style={{
            padding: tokens.spacing[6],
            textAlign: 'center',
            backgroundColor: tokens.colors.neutral[50],
            border: `1px solid ${tokens.colors.neutral[200]}`,
            borderRadius: tokens.borderRadius.md,
          }}
        >
          <h4
            style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[2],
            }}
          >
            No Payment Methods Found
          </h4>
          <p
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
              marginBottom: tokens.spacing[4],
            }}
          >
            Add a payment method to continue with your transaction.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              padding: `${tokens.spacing[3]} ${tokens.spacing[6]}`,
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.white,
              backgroundColor: tokens.colors.primary[600],
              border: 'none',
              borderRadius: tokens.borderRadius.md,
              cursor: 'pointer',
            }}
          >
            Add Payment Method
          </button>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {showAddModal && (
        <AddPaymentMethodModal
          onSubmit={handleAddPaymentMethod}
          onCancel={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};
