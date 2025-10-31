import { createAsyncThunk } from '@reduxjs/toolkit';
import { walletService, WalletConnection } from '@/services/walletService';
import {
  setUser,
  setWalletConnected,
  setLoading,
  setError,
} from '../slices/authSlice';

export const initializeWallet = createAsyncThunk(
  'wallet/initialize',
  async (_, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      await walletService.initialize();

      // Set up event listeners
      walletService.onSessionUpdate((connection: WalletConnection) => {
        dispatch(setWalletConnected(connection.isConnected));
        if (connection.isConnected && connection.account) {
          dispatch(
            setUser({
              id: connection.account.accountId,
              walletAddress: connection.account.accountId,
              verificationLevel: 'basic',
            })
          );
        }
      });

      walletService.onSessionDelete(() => {
        dispatch(setWalletConnected(false));
        dispatch(setUser(null as any));
      });

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to initialize wallet';
      dispatch(setError(message));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }
);

export const connectWallet = createAsyncThunk(
  'wallet/connect',
  async (_, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      dispatch(setError(null));

      const connection = await walletService.connect();

      if (connection.isConnected && connection.account) {
        dispatch(setWalletConnected(true));
        dispatch(
          setUser({
            id: connection.account.accountId,
            walletAddress: connection.account.accountId,
            verificationLevel: 'basic',
          })
        );

        return connection;
      } else {
        throw new Error('Failed to establish wallet connection');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to connect wallet';
      dispatch(setError(message));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }
);

export const disconnectWallet = createAsyncThunk(
  'wallet/disconnect',
  async (_, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      await walletService.disconnect();

      dispatch(setWalletConnected(false));
      dispatch(setUser(null as any));
      dispatch(setError(null));

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to disconnect wallet';
      dispatch(setError(message));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }
);

export const signTransaction = createAsyncThunk(
  'wallet/signTransaction',
  async (transactionBytes: Uint8Array, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      dispatch(setError(null));

      const signedTransaction =
        await walletService.signTransaction(transactionBytes);
      return signedTransaction;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to sign transaction';
      dispatch(setError(message));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }
);

export const signMessage = createAsyncThunk(
  'wallet/signMessage',
  async (message: string, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      dispatch(setError(null));

      const signature = await walletService.signMessage(message);
      return signature;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to sign message';
      dispatch(setError(errorMessage));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }
);
