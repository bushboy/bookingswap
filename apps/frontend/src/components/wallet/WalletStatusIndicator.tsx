import React from 'react';
import { useSelector } from 'react-redux';
import { tokens } from '@/design-system/tokens';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';
import {
  selectConnectionStatus,
  selectWalletNetwork,
  selectWalletError,
  selectIsWalletConnected,
  selectWalletErrorType,
} from '@/store/selectors/walletSelectors';
import { ConnectionStatus, WalletErrorType } from '@/types/wallet';

interface WalletStatusIndicatorProps {
  variant?: 'compact' | 'detailed' | 'minimal';
  showNetwork?: boolean;
  showErrorDetails?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const WalletStatusIndicator: React.FC<WalletStatusIndicatorProps> = ({
  variant = 'detailed',
  showNetwork = true,
  showErrorDetails = true,
  className,
  style,
}) => {
  const connectionStatus = useSelector(selectConnectionStatus);
  const network = useSelector(selectWalletNetwork);
  const error = useSelector(selectWalletError);
  const isConnected = useSelector(selectIsWalletConnected);
  const errorType = useSelector(selectWalletErrorType);

  const getStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return tokens.colors.success[500];
      case 'connecting':
        return tokens.colors.warning[500];
      case 'error':
        return tokens.colors.error[500];
      case 'idle':
      default:
        return tokens.colors.neutral[400];
    }
  };

  const getStatusText = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection Error';
      case 'idle':
      default:
        return 'Not Connected';
    }
  };

  const getNetworkColor = (network: string | null): string => {
    if (!network) return tokens.colors.neutral[600];
    switch (network) {
      case 'mainnet':
        return tokens.colors.success[600];
      case 'testnet':
        return tokens.colors.warning[600];
      default:
        return tokens.colors.neutral[600];
    }
  };

  const getNetworkLabel = (network: string | null): string => {
    if (!network) return 'Unknown';
    switch (network) {
      case 'mainnet':
        return 'Mainnet';
      case 'testnet':
        return 'Testnet';
      default:
        return network.charAt(0).toUpperCase() + network.slice(1);
    }
  };

  const getErrorMessage = (errorType: WalletErrorType | null): string => {
    if (!errorType) return '';

    switch (errorType) {
      case WalletErrorType.PROVIDER_NOT_FOUND:
        return 'Wallet not installed';
      case WalletErrorType.CONNECTION_REJECTED:
        return 'Connection rejected';
      case WalletErrorType.WALLET_LOCKED:
        return 'Wallet locked';
      case WalletErrorType.WRONG_NETWORK:
        return 'Wrong network';
      case WalletErrorType.NETWORK_ERROR:
        return 'Network error';
      case WalletErrorType.UNKNOWN_ERROR:
      default:
        return 'Connection failed';
    }
  };

  const renderStatusIndicator = () => {
    const statusColor = getStatusColor(connectionStatus);

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[2],
        }}
      >
        {connectionStatus === 'connecting' ? (
          <LoadingSpinner size="sm" color={statusColor} />
        ) : (
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: tokens.borderRadius.full,
              backgroundColor: statusColor,
              flexShrink: 0,
            }}
            aria-label={`Connection status: ${getStatusText(connectionStatus)}`}
          />
        )}

        {variant !== 'minimal' && (
          <span
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
            }}
          >
            {getStatusText(connectionStatus)}
          </span>
        )}
      </div>
    );
  };

  const renderNetworkIndicator = () => {
    if (!showNetwork || !network || !isConnected) return null;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[1],
          padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
          backgroundColor: `${getNetworkColor(network)}20`,
          borderRadius: tokens.borderRadius.sm,
        }}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: tokens.borderRadius.full,
            backgroundColor: getNetworkColor(network),
          }}
        />
        <span
          style={{
            fontSize: tokens.typography.fontSize.xs,
            fontWeight: tokens.typography.fontWeight.medium,
            color: getNetworkColor(network),
          }}
        >
          {getNetworkLabel(network)}
        </span>
      </div>
    );
  };

  const renderErrorIndicator = () => {
    if (!error || !showErrorDetails) return null;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[2],
          padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
          backgroundColor: tokens.colors.error[50],
          border: `1px solid ${tokens.colors.error[200]}`,
          borderRadius: tokens.borderRadius.md,
          marginTop: tokens.spacing[2],
        }}
      >
        <div
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.error[600],
          }}
        >
          ⚠️
        </div>
        <div>
          <div
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.error[700],
            }}
          >
            {getErrorMessage(errorType)}
          </div>
          {variant === 'detailed' && error?.message && (
            <div
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.error[600],
                marginTop: tokens.spacing[1],
              }}
            >
              {error.message}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (variant === 'minimal') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[2],
          ...style,
        }}
      >
        {renderStatusIndicator()}
        {renderNetworkIndicator()}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[3],
          padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
          backgroundColor: tokens.colors.neutral[50],
          borderRadius: tokens.borderRadius.md,
          border: `1px solid ${tokens.colors.neutral[200]}`,
          ...style,
        }}
      >
        {renderStatusIndicator()}
        {renderNetworkIndicator()}
      </div>
    );
  }

  // Default detailed variant
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacing[2],
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: tokens.spacing[3],
        }}
      >
        {renderStatusIndicator()}
        {renderNetworkIndicator()}
      </div>

      {renderErrorIndicator()}
    </div>
  );
};
