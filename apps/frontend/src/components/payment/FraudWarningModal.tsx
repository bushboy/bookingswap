import React from 'react';
import { RiskAssessment } from '@booking-swap/shared';
import { tokens } from '../../design-system/tokens';

interface FraudWarningModalProps {
  riskAssessment: RiskAssessment;
  onAccept: () => void;
  onCancel: () => void;
}

export const FraudWarningModal: React.FC<FraudWarningModalProps> = ({
  riskAssessment,
  onAccept,
  onCancel,
}) => {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high':
        return tokens.colors.error[600];
      case 'medium':
        return tokens.colors.warning[600];
      default:
        return tokens.colors.neutral[600];
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'high':
        return '🚨';
      case 'medium':
        return '⚠️';
      default:
        return '🔍';
    }
  };

  const riskColor = getRiskColor(riskAssessment.riskLevel);
  const riskIcon = getRiskIcon(riskAssessment.riskLevel);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: tokens.colors.white,
          borderRadius: tokens.borderRadius.lg,
          padding: tokens.spacing[6],
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing[3],
            marginBottom: tokens.spacing[4],
          }}
        >
          <span style={{ fontSize: '2rem' }}>{riskIcon}</span>
          <div>
            <h2
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.bold,
                color: riskColor,
                margin: 0,
              }}
            >
              Security Review Required
            </h2>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
                margin: 0,
              }}
            >
              {riskAssessment.riskLevel.toUpperCase()} risk level detected
            </p>
          </div>
        </div>

        {/* Risk Assessment Details */}
        <div
          style={{
            padding: tokens.spacing[4],
            backgroundColor: `${riskColor}10`,
            border: `1px solid ${riskColor}30`,
            borderRadius: tokens.borderRadius.md,
            marginBottom: tokens.spacing[4],
          }}
        >
          <h3
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: riskColor,
              marginBottom: tokens.spacing[3],
            }}
          >
            Security Factors Detected:
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: tokens.spacing[4],
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[700],
            }}
          >
            {riskAssessment.factors.map((factor, index) => (
              <li key={index} style={{ marginBottom: tokens.spacing[2] }}>
                {factor}
              </li>
            ))}
          </ul>
        </div>

        {/* Security Measures */}
        <div
          style={{
            padding: tokens.spacing[4],
            backgroundColor: tokens.colors.primary[50],
            border: `1px solid ${tokens.colors.primary[200]}`,
            borderRadius: tokens.borderRadius.md,
            marginBottom: tokens.spacing[4],
          }}
        >
          <h3
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.primary[800],
              marginBottom: tokens.spacing[3],
            }}
          >
            🛡️ Your Protection:
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: tokens.spacing[4],
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.primary[700],
            }}
          >
            <li style={{ marginBottom: tokens.spacing[1] }}>
              All payments are processed through secure, PCI-compliant gateways
            </li>
            <li style={{ marginBottom: tokens.spacing[1] }}>
              Funds are held in escrow until transaction completion
            </li>
            <li style={{ marginBottom: tokens.spacing[1] }}>
              24/7 fraud monitoring and dispute resolution
            </li>
            <li style={{ marginBottom: tokens.spacing[1] }}>
              Full refund protection for verified fraud cases
            </li>
          </ul>
        </div>

        {/* Manual Review Notice */}
        {riskAssessment.requiresManualReview && (
          <div
            style={{
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.warning[50],
              border: `1px solid ${tokens.colors.warning[200]}`,
              borderRadius: tokens.borderRadius.md,
              marginBottom: tokens.spacing[4],
            }}
          >
            <h3
              style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.warning[800],
                marginBottom: tokens.spacing[2],
              }}
            >
              ⏱️ Manual Review Required
            </h3>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.warning[700],
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              This transaction will be reviewed by our security team. You'll
              receive an email confirmation within 15 minutes, and the review
              typically completes within 1-2 hours.
            </p>
          </div>
        )}

        {/* Additional Verification */}
        {riskAssessment.additionalVerificationRequired && (
          <div
            style={{
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.neutral[50],
              border: `1px solid ${tokens.colors.neutral[200]}`,
              borderRadius: tokens.borderRadius.md,
              marginBottom: tokens.spacing[4],
            }}
          >
            <h3
              style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[800],
                marginBottom: tokens.spacing[2],
              }}
            >
              📋 Additional Verification
            </h3>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[700],
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              You may be asked to provide additional verification documents or
              complete a brief security questionnaire before the payment can be
              processed.
            </p>
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
            Cancel Payment
          </button>
          <button
            type="button"
            onClick={onAccept}
            style={{
              padding: `${tokens.spacing[3]} ${tokens.spacing[6]}`,
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.white,
              backgroundColor: riskColor,
              border: 'none',
              borderRadius: tokens.borderRadius.md,
              cursor: 'pointer',
            }}
          >
            {riskAssessment.requiresManualReview
              ? 'Proceed with Review'
              : 'Accept Risk & Continue'}
          </button>
        </div>

        {/* Disclaimer */}
        <div
          style={{
            marginTop: tokens.spacing[4],
            padding: tokens.spacing[3],
            backgroundColor: tokens.colors.neutral[50],
            borderRadius: tokens.borderRadius.sm,
            fontSize: tokens.typography.fontSize.xs,
            color: tokens.colors.neutral[600],
            textAlign: 'center',
          }}
        >
          By proceeding, you acknowledge that you understand the security
          considerations and agree to our fraud protection policies. Your
          payment information is always encrypted and never stored on our
          servers.
        </div>
      </div>
    </div>
  );
};
