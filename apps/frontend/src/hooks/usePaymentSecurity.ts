import { useState, useCallback } from 'react';
import { RiskAssessment, PaymentSecurityContext } from '@booking-swap/shared';
import { paymentSecurityService } from '../services/paymentSecurityService';

interface SecurityCheckRequest {
  paymentMethodId: string;
  amount: number;
  currency: string;
  userId: string;
}

export const usePaymentSecurity = () => {
  const [securityCheck, setSecurityCheck] = useState<any>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(
    null
  );
  const [isCheckingFraud, setIsCheckingFraud] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSecurityCheck = useCallback(
    async (request: SecurityCheckRequest) => {
      setIsCheckingFraud(true);
      setError(null);

      try {
        // Get device and context information
        const context: PaymentSecurityContext = {
          userId: request.userId,
          ipAddress: await getClientIpAddress(),
          deviceFingerprint: await getDeviceFingerprint(),
          previousTransactions: 0, // This would come from user stats
          accountAge: 30, // This would come from user profile
        };

        // Perform security validation
        const securityResult =
          await paymentSecurityService.validatePaymentSecurity(
            request.paymentMethodId,
            context
          );

        setSecurityCheck(securityResult);

        // Perform fraud detection
        const fraudResult = await paymentSecurityService.detectFraud(context, {
          amount: request.amount,
          currency: request.currency,
          payerId: request.userId,
          recipientId: 'temp', // This would be provided
          paymentMethodId: request.paymentMethodId,
          swapId: 'temp', // This would be provided
          proposalId: 'temp', // This would be provided
          escrowRequired: false,
        });

        // Convert fraud result to risk assessment
        const riskAssessment: RiskAssessment = {
          riskLevel:
            fraudResult.riskScore >= 70
              ? 'high'
              : fraudResult.riskScore >= 40
                ? 'medium'
                : 'low',
          factors: fraudResult.flags,
          requiresManualReview:
            fraudResult.recommendedAction === 'review' ||
            fraudResult.recommendedAction === 'reject',
          additionalVerificationRequired: fraudResult.riskScore >= 60,
        };

        setRiskAssessment(riskAssessment);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Security check failed';
        setError(errorMessage);

        // Set high-risk assessment on error
        setRiskAssessment({
          riskLevel: 'high',
          factors: ['Security check failed'],
          requiresManualReview: true,
          additionalVerificationRequired: true,
        });
      } finally {
        setIsCheckingFraud(false);
      }
    },
    []
  );

  const clearSecurityCheck = useCallback(() => {
    setSecurityCheck(null);
    setRiskAssessment(null);
    setError(null);
  }, []);

  return {
    securityCheck,
    riskAssessment,
    isCheckingFraud,
    error,
    performSecurityCheck,
    clearSecurityCheck,
  };
};

// Helper functions for device fingerprinting and IP detection
async function getClientIpAddress(): Promise<string> {
  try {
    // In a real implementation, this would call an IP detection service
    // For now, return a placeholder
    return '192.168.1.1';
  } catch {
    return 'unknown';
  }
}

async function getDeviceFingerprint(): Promise<string> {
  try {
    // Create a basic device fingerprint from available browser information
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
    }

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
    ].join('|');

    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  } catch {
    return 'unknown';
  }
}
