import { useState, useCallback } from 'react';
import { PaymentRequest, PaymentValidation } from '@booking-swap/shared';
import { paymentService } from '../services/paymentService';

export const usePaymentValidation = () => {
  const [validation, setValidation] = useState<PaymentValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validatePayment = useCallback(
    async (paymentRequest: PaymentRequest) => {
      setIsValidating(true);
      setError(null);

      try {
        const result = await paymentService.validatePayment(paymentRequest);
        setValidation(result);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Payment validation failed';
        setError(errorMessage);
        setValidation({
          isValid: false,
          errors: [errorMessage],
          warnings: [],
          estimatedFees: {
            platformFee: 0,
            processingFee: 0,
            totalFees: 0,
            netAmount: paymentRequest.amount,
          },
          requiresEscrow: false,
        });
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  const clearValidation = useCallback(() => {
    setValidation(null);
    setError(null);
  }, []);

  return {
    validation,
    isValidating,
    error,
    validatePayment,
    clearValidation,
  };
};
