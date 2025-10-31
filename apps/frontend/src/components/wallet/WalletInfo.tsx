import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { AccountInfo } from '@/types/wallet';

interface WalletInfoProps {
  accountInfo: AccountInfo;
  showBalance?: boolean;
  onDisconnect?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  layout?: 'horizontal' | 'vertical' | 'compact';
  className?: string;
  style?: React.CSSProperties;
}

export const WalletInfo: React.FC<WalletInfoProps> = ({
  accountInfo,
  showBalance = true,
  onDisconnect,
  variant = 'outline',
  size = 'md',
  layout = 'horizontal',
  className,
  style,
}) => {
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const { accountId, balance, network } = accountInfo;

  // Truncate address for display (first 6 and last 4 characters)
  const truncatedAddress =
    accountId.length > 10
      ? `${accountId.slice(0, 6)}...${accountId.slice(-4)}`
      : accountId;

  const displayAddress = showFullAddress ? accountId : truncatedAddress;

  const handleAddressClick = async () => {
    try {
      await navigator.clipboard.writeText(accountId);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const handleAddressHover = () => {
    if (accountId.length > 10) {
      setShowFullAddress(true);
    }
  };

  const handleAddressLeave = () => {
    setShowFullAddress(false);
  };

  const formatBalance = (balance: string): string => {
    const numBalance = parseFloat(balance);
    if (isNaN(numBalance)) return balance;

    // Format with appropriate decimal places
    if (numBalance >= 1000000) {
      return `${(numBalance / 1000000).toFixed(2)}M`;
    } else if (numBalance >= 1000) {
      return `${(numBalance / 1000).toFixed(2)}K`;
    } else if (numBalance >= 1) {
      return numBalance.toFixed(2);
    } else {
      return numBalance.toFixed(4);
    }
  };

  const getNetworkColor = (network: string) => {
    switch (network) {
      case 'mainnet':
        return tokens.colors.success[600];
      case 'testnet':
        return tokens.colors.warning[600];
      default:
        return tokens.colors.neutral[600];
    }
  };

  const getNetworkLabel = (network: string) => {
    switch (network) {
      case 'mainnet':
        return 'Mainnet';
      case 'testnet':
        return 'Testnet';
      default:
        return network.charAt(0).toUpperCase() + network.slice(1);
    }
  };

  if (layout === 'compact') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[2],
          ...style,
        }}
        className={className}
      >
        <div
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[700],
            cursor: 'pointer',
            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
            borderRadius: tokens.borderRadius.sm,
            backgroundColor: tokens.colors.neutral[100],
            transition: 'all 0.2s ease-in-out',
            position: 'relative',
          }}
          onClick={handleAddressClick}
          onMouseEnter={handleAddressHover}
          onMouseLeave={handleAddressLeave}
          title="Click to copy address"
        >
          {displayAddress}
          {copyFeedback && (
            <div
              style={{
                position: 'absolute',
                top: '-30px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: tokens.colors.neutral[800],
                color: 'white',
                padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                borderRadius: tokens.borderRadius.sm,
                fontSize: tokens.typography.fontSize.xs,
                whiteSpace: 'nowrap',
                zIndex: 10,
              }}
            >
              {copyFeedback}
            </div>
          )}
        </div>

        {onDisconnect && (
          <Button variant={variant} size="sm" onClick={onDisconnect}>
            Disconnect
          </Button>
        )}
      </div>
    );
  }

  if (layout === 'vertical') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.spacing[3],
          padding: tokens.spacing[4],
          border: `1px solid ${tokens.colors.neutral[200]}`,
          borderRadius: tokens.borderRadius.md,
          backgroundColor: 'white',
          ...style,
        }}
        className={className}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
              fontWeight: tokens.typography.fontWeight.medium,
            }}
          >
            Wallet Connected
          </span>
          <div
            style={{
              fontSize: tokens.typography.fontSize.xs,
              color: getNetworkColor(network),
              fontWeight: tokens.typography.fontWeight.medium,
              padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
              backgroundColor: `${getNetworkColor(network)}20`,
              borderRadius: tokens.borderRadius.sm,
            }}
          >
            {getNetworkLabel(network)}
          </div>
        </div>

        <div
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[700],
            cursor: 'pointer',
            padding: tokens.spacing[2],
            backgroundColor: tokens.colors.neutral[50],
            borderRadius: tokens.borderRadius.sm,
            textAlign: 'center',
            transition: 'all 0.2s ease-in-out',
            position: 'relative',
          }}
          onClick={handleAddressClick}
          onMouseEnter={handleAddressHover}
          onMouseLeave={handleAddressLeave}
          title="Click to copy full address"
        >
          {displayAddress}
          {copyFeedback && (
            <div
              style={{
                position: 'absolute',
                top: '-35px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: tokens.colors.neutral[800],
                color: 'white',
                padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                borderRadius: tokens.borderRadius.sm,
                fontSize: tokens.typography.fontSize.xs,
                whiteSpace: 'nowrap',
                zIndex: 10,
              }}
            >
              {copyFeedback}
            </div>
          )}
        </div>

        {showBalance && (
          <div
            style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.neutral[900],
              textAlign: 'center',
            }}
          >
            {formatBalance(balance)} HBAR
          </div>
        )}

        {onDisconnect && (
          <Button
            variant={variant}
            size={size}
            onClick={onDisconnect}
            style={{ width: '100%' }}
          >
            Disconnect Wallet
          </Button>
        )}
      </div>
    );
  }

  // Default horizontal layout
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        {showBalance && (
          <div
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[900],
            }}
          >
            {formatBalance(balance)} HBAR
          </div>
        )}

        <div
          style={{
            fontSize: tokens.typography.fontSize.xs,
            color: tokens.colors.neutral[600],
            cursor: 'pointer',
            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
            borderRadius: tokens.borderRadius.sm,
            transition: 'all 0.2s ease-in-out',
            position: 'relative',
          }}
          onClick={handleAddressClick}
          onMouseEnter={handleAddressHover}
          onMouseLeave={handleAddressLeave}
          title="Click to copy full address"
        >
          {displayAddress}
          {copyFeedback && (
            <div
              style={{
                position: 'absolute',
                top: '-30px',
                right: '0',
                backgroundColor: tokens.colors.neutral[800],
                color: 'white',
                padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                borderRadius: tokens.borderRadius.sm,
                fontSize: tokens.typography.fontSize.xs,
                whiteSpace: 'nowrap',
                zIndex: 10,
              }}
            >
              {copyFeedback}
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: tokens.typography.fontSize.xs,
            color: getNetworkColor(network),
            fontWeight: tokens.typography.fontWeight.medium,
          }}
        >
          {getNetworkLabel(network)}
        </div>
      </div>

      {onDisconnect && (
        <Button variant={variant} size={size} onClick={onDisconnect}>
          Disconnect
        </Button>
      )}
    </div>
  );
};
