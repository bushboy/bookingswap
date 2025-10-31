import { useState, useCallback } from 'react';
import { EscrowAccount } from '@booking-swap/shared';
import { paymentService } from '../services/paymentService';

interface UseEscrowAccountsReturn {
  escrowAccounts: EscrowAccount[];
  loading: boolean;
  error: string | null;
  fetchEscrowAccounts: () => Promise<void>;
  getEscrowAccount: (escrowId: string) => Promise<EscrowAccount>;
  releaseEscrow: (escrowId: string, releaseData: any) => Promise<EscrowAccount>;
  refundEscrow: (escrowId: string, reason: string) => Promise<EscrowAccount>;
}

export const useEscrowAccounts = (): UseEscrowAccountsReturn => {
  const [escrowAccounts, setEscrowAccounts] = useState<EscrowAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEscrowAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current user ID from localStorage or auth context
      const userId = localStorage.getItem('user_id') || 'current-user';
      const accounts = await paymentService.getUserEscrowAccounts(userId);
      setEscrowAccounts(accounts);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch escrow accounts');
      setEscrowAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const getEscrowAccount = useCallback(async (escrowId: string): Promise<EscrowAccount> => {
    try {
      const account = await paymentService.getEscrowAccount(escrowId);
      
      // Update the account in the list if it exists
      setEscrowAccounts(prev => 
        prev.map(acc => acc.id === escrowId ? account : acc)
      );
      
      return account;
    } catch (error: any) {
      throw error;
    }
  }, []);

  const releaseEscrow = useCallback(async (escrowId: string, releaseData: any): Promise<EscrowAccount> => {
    try {
      const releasedAccount = await paymentService.releaseEscrow(releaseData);
      
      // Update the account in the list
      setEscrowAccounts(prev => 
        prev.map(acc => acc.id === escrowId ? releasedAccount : acc)
      );
      
      return releasedAccount;
    } catch (error: any) {
      throw error;
    }
  }, []);

  const refundEscrow = useCallback(async (escrowId: string, reason: string): Promise<EscrowAccount> => {
    try {
      const refundedAccount = await paymentService.refundEscrow(escrowId, reason);
      
      // Update the account in the list
      setEscrowAccounts(prev => 
        prev.map(acc => acc.id === escrowId ? refundedAccount : acc)
      );
      
      return refundedAccount;
    } catch (error: any) {
      throw error;
    }
  }, []);

  return {
    escrowAccounts,
    loading,
    error,
    fetchEscrowAccounts,
    getEscrowAccount,
    releaseEscrow,
    refundEscrow,
  };
};