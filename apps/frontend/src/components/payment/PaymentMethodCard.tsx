import React from 'react';
import { PaymentMethod } from '@booking-swap/shared';
import { tokens } from '../../design-system/tokens';

interface PaymentMethodCardProps {
  method: PaymentMethod;
  isSelected: boolean;
  onSelect: () => void;
  amount: number;
  currency: string;
  showVerificationWarning?: boolean;
  showActions?: boolean;
  onVerify?: () => void;
  onDelete?: () => void;
}

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  method,
  isSelected,
  onSelect,
  amount,
  currency,
  showVerificationWarning = false,
  showActions = false,
  onVerify,
  onDelete,
}) => {
  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case 'credit_card':
        return '💳';
      case 'bank_transfer':
        return '🏦';
      case 'digital_wallet':
        return '📱';
      default:
        return '💰';
    }
  };

  const getPaymentMethodLabel = (type: string) => {
    switch (type) {
      case 'credit_card':
        return 'Credit Card';
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'digital_wallet':
        return 'Digital Wallet';
      default:
        return 'Payment Method';
    }
  };

  const getAmountLimits = (type: string) => {
    switch (type) {
      case 'credit_card':
        return { min: 1, max: 10000, warning: 5000 };
      case 'bank_transfer':
        return { min: 10, max: 25000, warning: 10000 };
      case 'digital_wallet':
        return { min: 1, max: 5000, warning: 2500 };
      default:
        return { min: 1, max: 1000, warning: 500 };
    }
  };

  const limits = getAmountLimits(method.type);
  const isAmountTooHigh = amount > limits.max;
  const isAmountWarning = amount > limits.warning;
  const isAmountTooLow = amount < limits.min;

  return (
    <div
      onClick={!isAmountTooHigh && !isAmountTooLow ? onSelect : undefined}
      style={{
        padding: tokens.spacing[4],
        border: `2px solid ${
          isSelected
            ? tokens.colors.primary[500]
            : isAmountTooHigh || isAmountTooLow
              ? tokens.colors.error[300]
              : tokens.colors.neutral[200]
        }`,
        borderRadius: tokens.borderRadius.md,
        backgroundColor: isSelected
          ? tokens.colors.primary[50]
          : isAmountTooHigh || isAmountTooLow
            ? tokens.colors.error[50]
            : tokens.colors.white,
        cursor: !isAmountTooHigh && !isAmountTooLow ? 'pointer' : 'not-allowed',
        opacity: isAmountTooHigh || isAmountTooLow ? 0.6 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: tokens.spacing[3],
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing[2],
          }}
        >
          <span style={{ fontSize: tokens.typography.fontSize.lg }}>
            {getPaymentMethodIcon(method.type)}
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
              {getPaymentMethodLabel(method.type)}
            </h4>
            <p
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[600],
                margin: 0,
              }}
            >
              {method.displayName}
            </p>
          </div>
        </div>

        {/* Verification Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing[2],
          }}
        >
          {method.isVerified ? (
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.success[700],
                backgroundColor: tokens.colors.success[100],
                padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                borderRadius: tokens.borderRadius.sm,
              }}
            >
              ✓ Verified
            </span>
          ) : (
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.warning[700],
                backgroundColor: tokens.colors.warning[100],
                padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                borderRadius: tokens.borderRadius.sm,
              }}
            >
              ⚠ Unverified
            </span>
          )}
        </div>
      </div>

      {/* Amount Validation */}
      {(isAmountTooHigh || isAmountTooLow || isAmountWarning) && (
        <div
          style={{
            marginBottom: tokens.spacing[3],
            padding: tokens.spacing[2],
            backgroundColor:
              isAmountTooHigh || isAmountTooLow
                ? tokens.colors.error[100]
                : tokens.colors.warning[100],
            border: `1px solid ${
              isAmountTooHigh || isAmountTooLow
                ? tokens.colors.error[200]
                : tokens.colors.warning[200]
            }`,
            borderRadius: tokens.borderRadius.sm,
          }}
        >
          <p
            style={{
              fontSize: tokens.typography.fontSize.xs,
              color:
                isAmountTooHigh || isAmountTooLow
                  ? tokens.colors.error[700]
                  : tokens.colors.warning[700],
              margin: 0,
            }}
          >
            {isAmountTooHigh &&
              `Amount exceeds ${currency} ${limits.max} limit for ${getPaymentMethodLabel(method.type).toLowerCase()}`}
            {isAmountTooLow &&
              `Amount below ${currency} ${limits.min} minimum for ${getPaymentMethodLabel(method.type).toLowerCase()}`}
            {isAmountWarning &&
              !isAmountTooHigh &&
              !isAmountTooLow &&
              `Large amount may require additional verification`}
          </p>
        </div>
      )}

      {/* Verification Warning */}
      {showVerificationWarning && !method.isVerified && (
        <div
          style={{
            marginBottom: tokens.spacing[3],
            padding: tokens.spacing[2],
            backgroundColor: tokens.colors.warning[100],
            border: `1px solid ${tokens.colors.warning[200]}`,
            borderRadius: tokens.borderRadius.sm,
          }}
        >
          <p
            style={{
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.colors.warning[700],
              margin: 0,
            }}
          >
            This payment method requires verification before use. You'll be
            prompted to verify during checkout.
          </p>
        </div>
      )}

      {/* Payment Method Details */}
      <div
        style={{
          fontSize: tokens.typography.fontSize.xs,
          color: tokens.colors.neutral[600],
        }}
      >
        <div style={{ marginBottom: tokens.spacing[1] }}>
          <strong>Limits:</strong> {currency} {limits.min} - {currency}{' '}
          {limits.max.toLocaleString()}
        </div>

        {method.type === 'credit_card' && (
          <div style={{ marginBottom: tokens.spacing[1] }}>
            <strong>Processing:</strong> Instant (2.9% fee)
          </div>
        )}

        {method.type === 'bank_transfer' && (
          <div style={{ marginBottom: tokens.spacing[1] }}>
            <strong>Processing:</strong> 1-3 business days (0.5% fee)
          </div>
        )}

        {method.type === 'digital_wallet' && (
          <div style={{ marginBottom: tokens.spacing[1] }}>
            <strong>Processing:</strong> Instant (1.5% fee)
          </div>
        )}

        {method.metadata?.lastUsed && (
          <div>
            <strong>Last used:</strong>{' '}
            {new Date(method.metadata.lastUsed as string).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div
          style={{
            marginTop: tokens.spacing[3],
            display: 'flex',
            gap: tokens.spacing[2],
            justifyContent: 'flex-end',
          }}
        >
          {!method.isVerified && onVerify && (
            <button
              onClick={onVerify}
              style={{
                padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                fontSize: tokens.typography.fontSize.xs,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.primary[600],
                backgroundColor: 'transparent',
                border: `1px solid ${tokens.colors.primary[600]}`,
                borderRadius: tokens.borderRadius.sm,
                cursor: 'pointer',
              }}
            >
              Verify
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              style={{
                padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                fontSize: tokens.typography.fontSize.xs,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.error[600],
                backgroundColor: 'transparent',
                border: `1px solid ${tokens.colors.error[600]}`,
                borderRadius: tokens.borderRadius.sm,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}

      {/* Selection Indicator */}
      {isSelected && (
        <div
          style={{
            marginTop: tokens.spacing[3],
            padding: tokens.spacing[2],
            backgroundColor: tokens.colors.primary[100],
            border: `1px solid ${tokens.colors.primary[200]}`,
            borderRadius: tokens.borderRadius.sm,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: tokens.typography.fontSize.xs,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.primary[700],
            }}
          >
            ✓ Selected for payment
          </span>
        </div>
      )}
    </div>
  );
};
