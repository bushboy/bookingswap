import { useCallback } from 'react';
import { useWallet } from './useWallet';
import { bookingService } from '../services/bookingService';
import { Booking } from '@booking-swap/shared';

/**
 * Hook that combines wallet functionality with booking operations
 * Ensures NFTs are minted to the user's connected wallet
 */
export const useBookingWithWallet = () => {
  const { accountInfo, isConnected } = useWallet();

  /**
   * Enable swapping for a booking with NFT minting to user's wallet
   */
  const enableSwappingWithWallet = useCallback(
    async (bookingId: string): Promise<{ booking: Booking; nft?: any }> => {
      if (!isConnected || !accountInfo?.accountId) {
        throw new Error('Wallet not connected. Please connect your wallet to enable swapping.');
      }

      return bookingService.enableSwapping(bookingId, accountInfo.accountId);
    },
    [isConnected, accountInfo?.accountId]
  );

  /**
   * Disable swapping for a booking (burns NFT)
   */
  const disableSwapping = useCallback(
    async (bookingId: string): Promise<Booking> => {
      return bookingService.disableSwapping(bookingId);
    },
    []
  );

  /**
   * Check if user can enable swapping (wallet connected and booking available)
   */
  const canEnableSwapping = useCallback(
    (booking: Booking): boolean => {
      return (
        isConnected &&
        !!accountInfo?.accountId &&
        booking.status === 'available' &&
        booking.verification.status === 'verified'
      );
    },
    [isConnected, accountInfo?.accountId]
  );

  return {
    enableSwappingWithWallet,
    disableSwapping,
    canEnableSwapping,
    isWalletConnected: isConnected,
    walletAddress: accountInfo?.accountId,
  };
};

