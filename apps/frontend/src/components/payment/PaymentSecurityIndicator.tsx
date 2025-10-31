import React, { useState } from 'react';
import { PaymentMethod, RiskAssessment } from '@booking-swap/shared';
import { tokens } from '../../design-system/tokens';
import { PaymentVerificationModal } from './PaymentVerificationModal';

interface PaymentSecurityIndicatorProps {
  paymentMethod: PaymentMethod;
  securityCheck: any;
  riskAssessment: RiskAssessment | null;
  onVerificationComplete: () => void;
}

export const PaymentSecurityIndicator: React.FC<
  PaymentSecurityIndicatorProps
> = ({
  paymentMethod,
  securityCheck,
  riskAssessment,
  onVerificationComplete,
}) => {
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const getSecurityLevel = () => {
    if (!riskAssessment) return 'checking';

    switch (riskAssessment.riskLevel) {
      case 'low':
        return 'high';
      case 'medium':
        return 'medium';
      case 'high':
        return 'low';
      default:
        return 'unknown';
    }
  };

  const getSecurityColor = (level: string) => {
    switch (level) {
      case 'high':
        return tokens.colors.success[600];
      case 'medium':
        return tokens.colors.warning[600];
      case 'low':
        return tokens.colors.error[600];
      case 'checking':
        return tokens.colors.primary[600];
      default:
        return tokens.colors.neutral[600];
    }
  };

  const getSecurityIcon = (level: string) => {
    switch (level) {
      case 'high':
        return '🛡️';
      case 'medium':
        return '⚠️';
      case 'low':
        return '🚨';
      case 'checking':
        return '🔍';
      default:
        return '❓';
    }
  };

  const getSecurityMessage = (level: string) => {
    switch (level) {
      case 'high':
        return 'High security - Payment method verified and low risk';
      case 'medium':
        return 'Medium security - Some risk factors detected';
      case 'low':
        return 'Low security - High risk factors detected';
      case 'checking':
        return 'Checking security status...';
      default:
        return 'Security status unknown';
    }
  };

  const securityLevel = getSecurityLevel();
  const securityColor = getSecurityColor(securityLevel);
  const securityIcon = getSecurityIcon(securityLevel);
  const securityMessage = getSecurityMessage(securityLevel);

  const handleVerificationClick = () => {
    if (!paymentMethod.isVerified || riskAssessment?.requiresManualReview) {
      setShowVerificationModal(true);
    }
  };

  return (
    <div
      style={{
        padding: tokens.spacing[4],
        border: `1px solid ${securityColor}`,
        borderRadius: tokens.borderRadius.md,
        backgroundColor: `${securityColor}10`,
      }}
    >
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
            {securityIcon}
          </span>
          <div>
            <h4
              style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: securityColor,
                margin: 0,
              }}
            >
              Security Status
            </h4>
            <p
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[600],
                margin: 0,
              }}
            >
              {securityMessage}
            </p>
          </div>
        </div>

        {(!paymentMethod.isVerified ||
          riskAssessment?.requiresManualReview) && (
          <button
            type="button"
            onClick={handleVerificationClick}
            style={{
              padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
              fontSize: tokens.typography.fontSize.xs,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.white,
              backgroundColor: securityColor,
              border: 'none',
              borderRadius: tokens.borderRadius.sm,
              cursor: 'pointer',
            }}
          >
            {!paymentMethod.isVerified ? 'Verify Now' : 'Review Security'}
          </button>
        )}
      </div>

      {/* Security Details */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: tokens.spacing[3],
          marginBottom: tokens.spacing[3],
        }}
      >
        {/* Verification Status */}
        <div>
          <h5
            style={{
              fontSize: tokens.typography.fontSize.xs,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[1],
            }}
          >
            Verification
          </h5>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[1],
            }}
          >
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: paymentMethod.isVerified
                  ? tokens.colors.success[600]
                  : tokens.colors.warning[600],
              }}
            >
              {paymentMethod.isVerified ? '✓' : '⚠️'}
            </span>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[600],
              }}
            >
              {paymentMethod.isVerified ? 'Verified' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Risk Level */}
        {riskAssessment && (
          <div>
            <h5
              style={{
                fontSize: tokens.typography.fontSize.xs,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[700],
                marginBottom: tokens.spacing[1],
              }}
            >
              Risk Level
            </h5>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[1],
              }}
            >
              <span
                style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: securityColor,
                }}
              >
                {riskAssessment.riskLevel.toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Encryption */}
        <div>
          <h5
            style={{
              fontSize: tokens.typography.fontSize.xs,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[1],
            }}
          >
            Encryption
          </h5>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[1],
            }}
          >
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.success[600],
              }}
            >
              🔒
            </span>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[600],
              }}
            >
              AES-256
            </span>
          </div>
        </div>

        {/* PCI Compliance */}
        <div>
          <h5
            style={{
              fontSize: tokens.typography.fontSize.xs,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[1],
            }}
          >
            PCI Compliance
          </h5>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[1],
            }}
          >
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.success[600],
              }}
            >
              ✓
            </span>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[600],
              }}
            >
              Level 1
            </span>
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      {riskAssessment && riskAssessment.factors.length > 0 && (
        <div>
          <h5
            style={{
              fontSize: tokens.typography.fontSize.xs,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[2],
            }}
          >
            Security Considerations:
          </h5>
          <ul
            style={{
              margin: 0,
              paddingLeft: tokens.spacing[4],
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.colors.neutral[600],
            }}
          >
            {riskAssessment.factors.map((factor, index) => (
              <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Additional Verification Required */}
      {riskAssessment?.additionalVerificationRequired && (
        <div
          style={{
            marginTop: tokens.spacing[3],
            padding: tokens.spacing[3],
            backgroundColor: tokens.colors.warning[50],
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
            Additional verification is required for this payment method due to
            security policies.
          </p>
        </div>
      )}

      {/* Verification Modal */}
      {showVerificationModal && (
        <PaymentVerificationModal
          paymentMethod={paymentMethod}
          riskAssessment={riskAssessment}
          onComplete={() => {
            setShowVerificationModal(false);
            onVerificationComplete();
          }}
          onCancel={() => setShowVerificationModal(false)}
        />
      )}
    </div>
  );
};
