import React, { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { initializeWallet } from '@/store/thunks/walletThunks';

interface WalletProviderProps {
  children: React.ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Initialize wallet service when the app starts
    dispatch(initializeWallet());
  }, [dispatch]);

  return <>{children}</>;
};
