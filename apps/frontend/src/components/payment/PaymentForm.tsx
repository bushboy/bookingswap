import React, { useState, useEffect, useCallback } from 'react';
import {
  PaymentMethod,
  PaymentRequest,
  PaymentValidation,
} from '@booking-swap/shared';
import { tokens } from '../../design-system/tokens';
import { usePaymentValidation } from '../../hooks/usePaymentValidation';
import { usePaymentSecurity } from '../../hooks/usePaymentSecurity';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { PaymentSecurityIndicator } from './PaymentSecurityIndicator';
import { FraudWarningModal } from './FraudWarningModal';

interface PaymentFormProps {
  amount: number;
  currency: string;
  recipientId: string;
  swapId: string;
  proposalId: string;
  onSubmit: (paymentData: PaymentRequest) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  amount,
  currency,
  recipientId,
  swapId,
  proposalId,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [escrowAgreed, setEscrowAgreed] = useState(false);
  const [showFraudWarning, setShowFraudWarning] = useState(false);
  const [securityVerificationComplete, setSecurityVerificationComplete] =
    useState(false);

  const { validation, validatePayment, isValidating } = usePaymentValidation();

  const {
    securityCheck,
    performSecurityCheck,
    riskAssessment,
    isCheckingFraud,
  } = usePaymentSecurity();

  // Validate payment when method or amount changes
  useEffect(() => {
    if (selectedPaymentMethod && amount > 0) {
      validatePayment({
        amount,
        currency,
        paymentMethodId: selectedPaymentMethod.id,
        payerId: selectedPaymentMethod.userId,
        recipientId,
        swapId,
        proposalId,
        escrowRequired: validation?.requiresEscrow || false,
      });
    }
  }, [selectedPaymentMethod, amount, currency, validatePayment]);

  // Perform security check when validation is complete
  useEffect(() => {
    if (validation?.isValid && selectedPaymentMethod && !securityCheck) {
      performSecurityCheck({
        paymentMethodId: selectedPaymentMethod.id,
        amount,
        currency,
        userId: selectedPaymentMethod.userId,
      });
    }
  }, [validation, selectedPaymentMethod, performSecurityCheck, securityCheck]);

  // Show fraud warning if high risk detected
  useEffect(() => {
    if (riskAssessment && riskAssessment.riskLevel === 'high') {
      setShowFraudWarning(true);
    }
  }, [riskAssessment]);

  const handlePaymentMethodSelect = useCallback(
    (paymentMethod: PaymentMethod) => {
      setSelectedPaymentMethod(paymentMethod);
      setSecurityVerificationComplete(false);
    },
    []
  );

  const handleSecurityVerificationComplete = useCallback(() => {
    setSecurityVerificationComplete(true);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!selectedPaymentMethod || !validation?.isValid) {
        return;
      }

      // Check if fraud warning needs to be acknowledged
      if (
        riskAssessment?.requiresManualReview &&
        !securityVerificationComplete
      ) {
        setShowFraudWarning(true);
        return;
      }

      const paymentRequest: PaymentRequest = {
        amount,
        currency,
        payerId: selectedPaymentMethod.userId,
        recipientId,
        paymentMethodId: selectedPaymentMethod.id,
        swapId,
        proposalId,
        escrowRequired: validation.requiresEscrow,
      };

      onSubmit(paymentRequest);
    },
    [
      selectedPaymentMethod,
      validation,
      riskAssessment,
      securityVerificationComplete,
      amount,
      currency,
      recipientId,
      swapId,
      proposalId,
      onSubmit,
    ]
  );

  const canSubmit =
    selectedPaymentMethod &&
    validation?.isValid &&
    !isValidating &&
    !isCheckingFraud &&
    (validation.requiresEscrow ? escrowAgreed : true) &&
    (!riskAssessment?.requiresManualReview || securityVerificationComplete);

  return (
    <div
      style={{
        padding: tokens.spacing[6],
        backgroundColor: tokens.colors.neutral[50],
        borderRadius: tokens.borderRadius.lg,
        border: `1px solid ${tokens.colors.neutral[200]}`,
      }}
    >
      <h3
        style={{
          fontSize: tokens.typography.fontSize.xl,
          fontWeight: tokens.typography.fontWeight.semibold,
          color: tokens.colors.neutral[900],
          marginBottom: tokens.spacing[4],
        }}
      >
        Payment Details
      </h3>

      <form onSubmit={handleSubmit}>
        {/* Payment Amount Display */}
        <div
          style={{
            marginBottom: tokens.spacing[6],
            padding: tokens.spacing[4],
            backgroundColor: tokens.colors.neutral[100],
            borderRadius: tokens.borderRadius.md,
            border: `1px solid ${tokens.colors.neutral[300]}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[700],
              }}
            >
              Payment Amount:
            </span>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.primary[600],
              }}
            >
              {currency} {amount.toFixed(2)}
            </span>
          </div>

          {validation?.estimatedFees && (
            <div
              style={{
                marginTop: tokens.spacing[2],
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              <div>
                Platform Fee: {currency}{' '}
                {validation.estimatedFees.platformFee.toFixed(2)}
              </div>
              <div>
                Processing Fee: {currency}{' '}
                {validation.estimatedFees.processingFee.toFixed(2)}
              </div>
              <div
                style={{
                  borderTop: `1px solid ${tokens.colors.neutral[300]}`,
                  paddingTop: tokens.spacing[1],
                  marginTop: tokens.spacing[1],
                  fontWeight: tokens.typography.fontWeight.medium,
                }}
              >
                Total Fees: {currency}{' '}
                {validation.estimatedFees.totalFees.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* Payment Method Selection */}
        <div style={{ marginBottom: tokens.spacing[6] }}>
          <label
            style={{
              display: 'block',
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[2],
            }}
          >
            Payment Method *
          </label>
          <PaymentMethodSelector
            selectedMethod={selectedPaymentMethod}
            onSelect={handlePaymentMethodSelect}
            amount={amount}
            currency={currency}
          />
        </div>

        {/* Security Indicator */}
        {selectedPaymentMethod && (
          <div style={{ marginBottom: tokens.spacing[6] }}>
            <PaymentSecurityIndicator
              paymentMethod={selectedPaymentMethod}
              securityCheck={securityCheck}
              riskAssessment={riskAssessment}
              onVerificationComplete={handleSecurityVerificationComplete}
            />
          </div>
        )}

        {/* Validation Errors */}
        {validation && validation.errors.length > 0 && (
          <div
            style={{
              marginBottom: tokens.spacing[4],
              padding: tokens.spacing[3],
              backgroundColor: tokens.colors.error[50],
              border: `1px solid ${tokens.colors.error[200]}`,
              borderRadius: tokens.borderRadius.md,
            }}
          >
            <h4
              style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.error[800],
                marginBottom: tokens.spacing[2],
              }}
            >
              Payment Validation Errors:
            </h4>
            <ul
              style={{
                margin: 0,
                paddingLeft: tokens.spacing[4],
                color: tokens.colors.error[700],
              }}
            >
              {validation.errors.map((error, index) => (
                <li
                  key={index}
                  style={{ fontSize: tokens.typography.fontSize.sm }}
                >
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Validation Warnings */}
        {validation && validation.warnings.length > 0 && (
          <div
            style={{
              marginBottom: tokens.spacing[4],
              padding: tokens.spacing[3],
              backgroundColor: tokens.colors.warning[50],
              border: `1px solid ${tokens.colors.warning[200]}`,
              borderRadius: tokens.borderRadius.md,
            }}
          >
            <h4
              style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.warning[800],
                marginBottom: tokens.spacing[2],
              }}
            >
              Important Information:
            </h4>
            <ul
              style={{
                margin: 0,
                paddingLeft: tokens.spacing[4],
                color: tokens.colors.warning[700],
              }}
            >
              {validation.warnings.map((warning, index) => (
                <li
                  key={index}
                  style={{ fontSize: tokens.typography.fontSize.sm }}
                >
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Escrow Agreement */}
        {validation?.requiresEscrow && (
          <div
            style={{
              marginBottom: tokens.spacing[6],
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.primary[50],
              border: `1px solid ${tokens.colors.primary[200]}`,
              borderRadius: tokens.borderRadius.md,
            }}
          >
            <h4
              style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.primary[800],
                marginBottom: tokens.spacing[3],
              }}
            >
              Escrow Protection Required
            </h4>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.primary[700],
                marginBottom: tokens.spacing[3],
                lineHeight: 1.5,
              }}
            >
              For your protection, this payment will be held in escrow until the
              booking transfer is completed. Funds will be released to the
              seller once you confirm receipt of the booking.
            </p>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.primary[800],
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={escrowAgreed}
                onChange={e => setEscrowAgreed(e.target.checked)}
                style={{
                  marginRight: tokens.spacing[2],
                  accentColor: tokens.colors.primary[600],
                }}
              />
              I agree to the escrow terms and conditions
            </label>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: tokens.spacing[3],
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: `${tokens.spacing[3]} ${tokens.spacing[6]}`,
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              backgroundColor: tokens.colors.neutral[100],
              border: `1px solid ${tokens.colors.neutral[300]}`,
              borderRadius: tokens.borderRadius.md,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || isLoading}
            style={{
              padding: `${tokens.spacing[3]} ${tokens.spacing[6]}`,
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color:
                canSubmit && !isLoading
                  ? tokens.colors.white
                  : tokens.colors.neutral[400],
              backgroundColor:
                canSubmit && !isLoading
                  ? tokens.colors.primary[600]
                  : tokens.colors.neutral[300],
              border: 'none',
              borderRadius: tokens.borderRadius.md,
              cursor: canSubmit && !isLoading ? 'pointer' : 'not-allowed',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Processing...' : 'Process Payment'}
          </button>
        </div>
      </form>

      {/* Fraud Warning Modal */}
      {showFraudWarning && riskAssessment && (
        <FraudWarningModal
          riskAssessment={riskAssessment}
          onAccept={handleSecurityVerificationComplete}
          onCancel={() => setShowFraudWarning(false)}
        />
      )}
    </div>
  );
};
