import { useState, useCallback } from 'react';
import { PaymentTransaction } from '@booking-swap/shared';
import { paymentService } from '../services/paymentService';

interface UsePaymentTransactionsReturn {
  transactions: PaymentTransaction[];
  loading: boolean;
  error: string | null;
  fetchTransactions: () => Promise<void>;
  getTransactionStatus: (transactionId: string) => Promise<PaymentTransaction>;
  cancelPayment: (transactionId: string, reason: string) => Promise<PaymentTransaction>;
  refundPayment: (transactionId: string, refundData: any) => Promise<PaymentTransaction>;
}

export const usePaymentTransactions = (): UsePaymentTransactionsReturn => {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current user ID from localStorage or auth context
      const userId = localStorage.getItem('user_id') || 'current-user';
      const result = await paymentService.getUserTransactions(userId);
      setTransactions(result.transactions);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const getTransactionStatus = useCallback(async (transactionId: string): Promise<PaymentTransaction> => {
    try {
      const transaction = await paymentService.getTransactionStatus(transactionId);
      
      // Update the transaction in the list if it exists
      setTransactions(prev => 
        prev.map(t => t.id === transactionId ? transaction : t)
      );
      
      return transaction;
    } catch (error: any) {
      throw error;
    }
  }, []);

  const cancelPayment = useCallback(async (transactionId: string, reason: string): Promise<PaymentTransaction> => {
    try {
      const cancelledTransaction = await paymentService.cancelPayment(transactionId, reason);
      
      // Update the transaction in the list
      setTransactions(prev => 
        prev.map(t => t.id === transactionId ? cancelledTransaction : t)
      );
      
      return cancelledTransaction;
    } catch (error: any) {
      throw error;
    }
  }, []);

  const refundPayment = useCallback(async (transactionId: string, refundData: any): Promise<PaymentTransaction> => {
    try {
      const refundedTransaction = await paymentService.refundPayment(transactionId, refundData);
      
      // Update the transaction in the list
      setTransactions(prev => 
        prev.map(t => t.id === transactionId ? refundedTransaction : t)
      );
      
      return refundedTransaction;
    } catch (error: any) {
      throw error;
    }
  }, []);

  return {
    transactions,
    loading,
    error,
    fetchTransactions,
    getTransactionStatus,
    cancelPayment,
    refundPayment,
  };
};