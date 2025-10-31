import { useState, useCallback } from 'react';
import { PaymentMethod } from '@booking-swap/shared';
import { paymentService, AddPaymentMethodRequest } from '../services/paymentService';

interface UsePaymentMethodsReturn {
  paymentMethods: PaymentMethod[];
  loading: boolean;
  error: string | null;
  fetchPaymentMethods: () => Promise<void>;
  addPaymentMethod: (methodData: AddPaymentMethodRequest) => Promise<PaymentMethod>;
  verifyPaymentMethod: (methodId: string, verificationData: any) => Promise<PaymentMethod>;
  removePaymentMethod: (methodId: string) => Promise<void>;
}

export const usePaymentMethods = (): UsePaymentMethodsReturn => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPaymentMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current user ID from localStorage or auth context
      const userId = localStorage.getItem('user_id') || 'current-user';
      const methods = await paymentService.getPaymentMethods(userId);
      setPaymentMethods(methods);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch payment methods');
      setPaymentMethods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const addPaymentMethod = useCallback(async (methodData: AddPaymentMethodRequest): Promise<PaymentMethod> => {
    try {
      const newMethod = await paymentService.addPaymentMethod(methodData);
      setPaymentMethods(prev => [...prev, newMethod]);
      return newMethod;
    } catch (error: any) {
      throw error;
    }
  }, []);

  const verifyPaymentMethod = useCallback(async (methodId: string, verificationData: any): Promise<PaymentMethod> => {
    try {
      const verifiedMethod = await paymentService.verifyPaymentMethod(methodId, verificationData);
      setPaymentMethods(prev => 
        prev.map(method => 
          method.id === methodId ? verifiedMethod : method
        )
      );
      return verifiedMethod;
    } catch (error: any) {
      throw error;
    }
  }, []);

  const removePaymentMethod = useCallback(async (methodId: string): Promise<void> => {
    try {
      await paymentService.removePaymentMethod(methodId);
      setPaymentMethods(prev => prev.filter(method => method.id !== methodId));
    } catch (error: any) {
      throw error;
    }
  }, []);

  return {
    paymentMethods,
    loading,
    error,
    fetchPaymentMethods,
    addPaymentMethod,
    verifyPaymentMethod,
    removePaymentMethod,
  };
};