import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { useWallet, useWalletConnection } from '@/hooks/useWallet';
import { WalletSelectionModal } from './WalletSelectionModal';
import { WalletInfo } from './WalletInfo';
import { WalletErrorInline } from './WalletErrorDisplay';
import { useWalletErrorHandler } from './WalletErrorBoundary';

interface WalletConnectButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  showBalance?: boolean;
  showFullInfo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const WalletConnectButton: React.FC<WalletConnectButtonProps> = ({
  variant = 'primary',
  size = 'md',
  showBalance = false,
  showFullInfo = false,
  className,
  style,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    isConnected,
    isConnecting,
    shouldShowConnectButton,
    shouldShowWalletInfo,
    accountInfo,
    truncatedAddress,
    balance,
    error: walletError,
  } = useWallet();

  const { disconnect } = useWalletConnection();
  const {
    error: componentError,
    clearError,
    retryWithErrorHandling,
  } = useWalletErrorHandler();

  const handleConnectClick = () => {
    setIsModalOpen(true);
  };

  const handleDisconnect = async () => {
    await retryWithErrorHandling(async () => {
      await disconnect();
    });
  };

  const handleRetry = () => {
    clearError();
    setIsModalOpen(true);
  };

  // Display error if present
  const displayError = componentError || walletError;
  if (displayError && !isConnected) {
    return (
      <div className={className} style={style}>
        <WalletErrorInline
          error={displayError}
          onRetry={handleRetry}
          onDismiss={clearError}
        />
      </div>
    );
  }

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  // Show wallet info when connected
  if (shouldShowWalletInfo && isConnected && accountInfo) {
    if (showFullInfo) {
      return (
        <WalletInfo
          accountInfo={accountInfo}
          showBalance={showBalance}
          onDisconnect={handleDisconnect}
          variant={variant}
          size={size}
          className={className}
          style={style}
        />
      );
    }

    // Compact display with disconnect button
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[3],
          ...style,
        }}
        className={className}
      >
        {showBalance && balance && (
          <div
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
            }}
          >
            <span>{balance} HBAR</span>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[500],
              }}
            >
              {truncatedAddress}
            </span>
          </div>
        )}
        <Button
          variant={variant}
          size={size}
          onClick={handleDisconnect}
          loading={isConnecting}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  // Show connect button when not connected
  if (shouldShowConnectButton) {
    return (
      <>
        <Button
          variant={variant}
          size={size}
          onClick={handleConnectClick}
          loading={isConnecting}
          className={className}
          style={style}
        >
          Connect Wallet
        </Button>

        <WalletSelectionModal isOpen={isModalOpen} onClose={handleModalClose} />
      </>
    );
  }

  // Fallback - should not normally be reached
  return null;
};
