import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import {
  useWallet,
  useWalletConnection,
  useWalletProviders,
} from '@/hooks/useWallet';
import { WalletErrorType } from '@/types/wallet';

interface WalletSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WalletProviderInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  installUrl?: string;
  troubleshootingUrl?: string;
}

interface ProviderAvailabilityState {
  isAvailable: boolean;
  isChecking: boolean;
  lastChecked?: number;
  error?: string;
}

// Provider information for display
const PROVIDER_INFO: Record<string, WalletProviderInfo> = {
  mock: {
    id: 'mock',
    name: 'Mock Wallet (Testing)',
    icon: '🧪',
    description: 'For development and testing - always available',
  },
  hashpack: {
    id: 'hashpack',
    name: 'HashPack',
    icon: '🔗',
    description: 'The most popular Hedera wallet',
    installUrl: 'https://www.hashpack.app/',
  },
  kabila: {
    id: 'kabila',
    name: 'Kabila Wallet',
    icon: '🏛️',
    description: 'Secure and user-friendly Hedera wallet',
    installUrl: 'https://chrome.google.com/webstore/detail/kabila-wallet',
    troubleshootingUrl: 'https://kabila.app/support',
  },
  yamgo: {
    id: 'yamgo',
    name: 'Yamgo Wallet',
    icon: '🚀',
    description: 'Fast and reliable Hedera wallet',
    installUrl: 'https://yamgo.io/',
  },
  blade: {
    id: 'blade',
    name: 'Blade Wallet',
    icon: '⚔️',
    description: 'Advanced Hedera wallet (may be inactive)',
    installUrl: 'https://bladewallet.io/',
  },
};

// Add CSS animation for spinner
const spinnerStyle = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export const WalletSelectionModal: React.FC<WalletSelectionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [providerAvailability, setProviderAvailability] = useState<
    Record<string, ProviderAvailabilityState>
  >({});

  const {
    error,
    isConnecting,
    clearError,
    needsProviderInstallation,
    getProviderAvailabilityStatus,
  } = useWallet();

  const { connect } = useWalletConnection();
  const { availableProviders, refreshAvailableProviders } =
    useWalletProviders();

  // Enhanced provider availability checking with real-time updates
  const checkProviderAvailability = useCallback(async () => {
    if (!isOpen) return;

    const newAvailability: Record<string, ProviderAvailabilityState> = {};

    for (const providerId of Object.keys(PROVIDER_INFO)) {
      // Set checking state
      setProviderAvailability(prev => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          isChecking: true,
        }
      }));

      try {
        let isAvailable = false;

        if (providerId === 'kabila') {
          // Enhanced Kabila availability detection
          isAvailable = await checkKabilaAvailability();
        } else {
          // Standard availability check for other providers
          isAvailable = availableProviders.includes(providerId);
        }

        newAvailability[providerId] = {
          isAvailable,
          isChecking: false,
          lastChecked: Date.now(),
          error: undefined,
        };
      } catch (error) {
        newAvailability[providerId] = {
          isAvailable: false,
          isChecking: false,
          lastChecked: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    setProviderAvailability(prev => ({ ...prev, ...newAvailability }));
  }, [isOpen, availableProviders]);

  // Enhanced Kabila availability detection
  const checkKabilaAvailability = async (): Promise<boolean> => {
    try {
      // Use the wallet service's enhanced availability checking
      if (getProviderAvailabilityStatus) {
        const status = await getProviderAvailabilityStatus();
        return status.kabila || false;
      }

      // Fallback to basic check
      return availableProviders.includes('kabila');
    } catch (error) {
      console.warn('Kabila availability check failed:', error);
      return false;
    }
  };

  // Check provider availability on mount and when modal opens
  useEffect(() => {
    if (isOpen) {
      checkProviderAvailability();
      refreshAvailableProviders();
    }
  }, [isOpen, refreshAvailableProviders, checkProviderAvailability]);

  // Set up real-time availability updates for Kabila
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      // Only refresh Kabila availability in real-time
      checkKabilaAvailability().then(isAvailable => {
        setProviderAvailability(prev => ({
          ...prev,
          kabila: {
            ...prev.kabila,
            isAvailable,
            lastChecked: Date.now(),
          }
        }));
      }).catch(error => {
        setProviderAvailability(prev => ({
          ...prev,
          kabila: {
            ...prev.kabila,
            isAvailable: false,
            lastChecked: Date.now(),
            error: error instanceof Error ? error.message : 'Check failed',
          }
        }));
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleProviderSelect = async (providerId: string) => {
    const availability = providerAvailability[providerId];
    if (!availability?.isAvailable || availability.isChecking) {
      return; // Provider not available or still checking
    }

    setSelectedProvider(providerId);
    clearError();

    try {
      await connect(providerId);
      onClose(); // Close modal on successful connection
    } catch (error) {
      console.error('Failed to connect to provider:', error);
      setSelectedProvider(null);

      // Refresh availability after connection failure
      if (providerId === 'kabila') {
        setTimeout(() => checkProviderAvailability(), 1000);
      }
    }
  };

  const handleInstallProvider = (providerId: string) => {
    const providerInfo = PROVIDER_INFO[providerId];
    if (providerInfo.installUrl) {
      window.open(providerInfo.installUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRetry = () => {
    clearError();
    checkProviderAvailability();
    refreshAvailableProviders();
  };

  const handleClose = () => {
    setSelectedProvider(null);
    clearError();
    onClose();
  };

  const renderProviderOption = (
    providerId: string,
    providerInfo: WalletProviderInfo
  ) => {
    const availability = providerAvailability[providerId] || {
      isAvailable: false,
      isChecking: false,
    };
    const { isAvailable, isChecking, error } = availability;
    const isSelected = selectedProvider === providerId;
    const isLoading = isConnecting && isSelected;

    // Enhanced status display for Kabila
    const getStatusText = () => {
      if (isChecking) return 'Checking...';
      if (error) return 'Check failed';
      if (isAvailable) return providerInfo.description;

      if (providerId === 'kabila') {
        return 'Extension not detected';
      }
      return 'Not installed';
    };

    const getStatusColor = () => {
      if (isChecking) return tokens.colors.primary[600];
      if (error) return tokens.colors.error[600];
      if (isAvailable) return tokens.colors.neutral[600];
      return tokens.colors.neutral[400];
    };

    return (
      <div
        key={providerId}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[3],
          padding: tokens.spacing[4],
          border: `1px solid ${isAvailable
            ? tokens.colors.neutral[200]
            : error
              ? tokens.colors.error[200]
              : tokens.colors.neutral[100]
            }`,
          borderRadius: tokens.borderRadius.md,
          cursor: isAvailable && !isChecking ? 'pointer' : 'default',
          transition: 'all 0.2s ease-in-out',
          marginBottom: tokens.spacing[3],
          backgroundColor: isAvailable
            ? isSelected
              ? tokens.colors.primary[50]
              : 'white'
            : error
              ? tokens.colors.error[50]
              : tokens.colors.neutral[50],
          opacity: isAvailable ? 1 : 0.6,
          ...(isAvailable && !isChecking && {
            ':hover': {
              borderColor: tokens.colors.primary[300],
              backgroundColor: tokens.colors.primary[50],
            },
          }),
        }}
        onClick={() => isAvailable && !isChecking && handleProviderSelect(providerId)}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: tokens.borderRadius.md,
            backgroundColor: isAvailable
              ? tokens.colors.primary[100]
              : error
                ? tokens.colors.error[100]
                : tokens.colors.neutral[200],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: tokens.typography.fontSize.xl,
            position: 'relative',
          }}
        >
          {isChecking ? (
            <div
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid transparent',
                borderTop: `2px solid ${tokens.colors.primary[600]}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          ) : (
            providerInfo.icon
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: isAvailable
                ? tokens.colors.neutral[900]
                : error
                  ? tokens.colors.error[700]
                  : tokens.colors.neutral[500],
              marginBottom: tokens.spacing[1],
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[2],
            }}
          >
            {providerInfo.name}
            {providerId === 'kabila' && isAvailable && (
              <span
                style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.success[600],
                  backgroundColor: tokens.colors.success[50],
                  padding: '2px 6px',
                  borderRadius: tokens.borderRadius.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                }}
              >
                Ready
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: getStatusColor(),
              marginBottom: error ? tokens.spacing[1] : 0,
            }}
          >
            {getStatusText()}
          </div>
          {error && providerId === 'kabila' && (
            <div
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.error[600],
                fontStyle: 'italic',
              }}
            >
              Try refreshing or check extension
            </div>
          )}
        </div>

        {isLoading && (
          <div
            style={{
              width: '20px',
              height: '20px',
              border: '2px solid transparent',
              borderTop: `2px solid ${tokens.colors.primary[600]}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        )}

        {!isAvailable && !isChecking && (
          <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
            {providerId === 'kabila' && (
              <Button
                variant="outline"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  checkProviderAvailability();
                }}
              >
                Refresh
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                handleInstallProvider(providerId);
              }}
            >
              Install
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderError = () => {
    if (!error) return null;

    let errorMessage = error.message;
    let showRetry = false;
    let showInstallGuidance = false;
    let showTroubleshooting = false;
    let troubleshootingSteps: string[] = [];
    let installUrl = '';

    // Enhanced Kabila-specific error handling
    const isKabilaError = selectedProvider === 'kabila' ||
      error.message.toLowerCase().includes('kabila');

    switch (error.type) {
      case WalletErrorType.PROVIDER_NOT_FOUND:
        if (isKabilaError) {
          errorMessage = 'Kabila wallet extension is not installed or not properly loaded.';
          installUrl = PROVIDER_INFO.kabila.installUrl || '';
          troubleshootingSteps = [
            'Install the Kabila wallet extension from Chrome Web Store',
            'Refresh this page after installation',
            'Make sure the extension is enabled in Chrome extensions',
            'Try restarting your browser if the issue persists'
          ];
        } else {
          errorMessage = 'Wallet provider not found. Please install the wallet extension.';
        }
        showInstallGuidance = true;
        showTroubleshooting = true;
        break;

      case WalletErrorType.CONNECTION_REJECTED:
        if (isKabilaError) {
          errorMessage = 'Connection request was rejected in Kabila wallet.';
          troubleshootingSteps = [
            'Click "Connect" and approve the connection request',
            'Make sure you click "Accept" in the Kabila popup',
            'Check if Kabila extension popup was blocked by browser',
            'Try disabling popup blockers for this site'
          ];
        } else {
          errorMessage = 'Connection was rejected. Please try again and approve the connection.';
        }
        showRetry = true;
        showTroubleshooting = true;
        break;

      case WalletErrorType.WALLET_LOCKED:
        if (isKabilaError) {
          errorMessage = 'Kabila wallet is locked. Please unlock your wallet first.';
          troubleshootingSteps = [
            'Click on the Kabila extension icon in your browser toolbar',
            'Enter your password to unlock the wallet',
            'Make sure you have created an account in Kabila',
            'Try refreshing the page if unlock doesn\'t work'
          ];
        } else {
          errorMessage = 'Wallet is locked. Please unlock your wallet and try again.';
        }
        showRetry = true;
        showTroubleshooting = true;
        break;

      case WalletErrorType.WRONG_NETWORK:
        if (isKabilaError) {
          errorMessage = 'Kabila wallet is connected to an unsupported network.';
          troubleshootingSteps = [
            'Open Kabila wallet settings',
            'Switch to Hedera Mainnet or Testnet',
            'Refresh this page after switching networks',
            'Make sure the network matches the application requirements'
          ];
        } else {
          errorMessage = 'Wrong network detected. Please switch to the correct network in your wallet.';
        }
        showRetry = true;
        showTroubleshooting = true;
        break;

      case WalletErrorType.NETWORK_ERROR:
        if (isKabilaError) {
          errorMessage = 'Network connection error with Kabila wallet.';
          troubleshootingSteps = [
            'Check your internet connection',
            'Make sure Kabila extension has network access',
            'Try disabling VPN or proxy if enabled',
            'Refresh the page and try again'
          ];
        } else {
          errorMessage = 'Network connection error. Please check your internet connection and try again.';
        }
        showRetry = true;
        showTroubleshooting = true;
        break;

      default:
        if (isKabilaError) {
          troubleshootingSteps = [
            'Try refreshing the page',
            'Restart your browser',
            'Check if Kabila extension needs updating',
            'Contact Kabila support if issue persists'
          ];
          showTroubleshooting = true;
        }
        showRetry = true;
        break;
    }

    return (
      <div
        style={{
          padding: tokens.spacing[4],
          backgroundColor: tokens.colors.error[50],
          border: `1px solid ${tokens.colors.error[200]}`,
          borderRadius: tokens.borderRadius.md,
          marginBottom: tokens.spacing[4],
        }}
      >
        <div
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.error[800],
            marginBottom: tokens.spacing[3],
            fontWeight: tokens.typography.fontWeight.medium,
          }}
        >
          {errorMessage}
        </div>

        {showTroubleshooting && troubleshootingSteps.length > 0 && (
          <div style={{ marginBottom: tokens.spacing[3] }}>
            <div
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.error[700],
                fontWeight: tokens.typography.fontWeight.semibold,
                marginBottom: tokens.spacing[2],
              }}
            >
              Troubleshooting steps:
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: tokens.spacing[4],
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.error[600],
              }}
            >
              {troubleshootingSteps.map((step, index) => (
                <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: tokens.spacing[2], flexWrap: 'wrap' }}>
          {showRetry && (
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Try Again
            </Button>
          )}

          {showInstallGuidance && installUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(installUrl, '_blank', 'noopener,noreferrer')}
            >
              Install Kabila
            </Button>
          )}

          {isKabilaError && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkProviderAvailability()}
            >
              Refresh Status
            </Button>
          )}

          {showInstallGuidance && needsProviderInstallation && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkProviderAvailability()}
            >
              Check Again
            </Button>
          )}

          {isKabilaError && PROVIDER_INFO.kabila.troubleshootingUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(PROVIDER_INFO.kabila.troubleshootingUrl, '_blank', 'noopener,noreferrer')}
            >
              Get Help
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{spinnerStyle}</style>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Connect Wallet"
        size="sm"
      >
        <div>
          {renderError()}

          <div style={{ marginBottom: tokens.spacing[4] }}>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
                margin: 0,
                marginBottom: tokens.spacing[4],
              }}
            >
              Choose a wallet to connect to the Hedera network:
            </p>

            {(import.meta.env.DEV ||
              import.meta.env.VITE_ENABLE_MOCK_WALLET === 'true') && (
                <div
                  style={{
                    padding: tokens.spacing[3],
                    backgroundColor: tokens.colors.primary[50],
                    border: `1px solid ${tokens.colors.primary[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    marginBottom: tokens.spacing[4],
                  }}
                >
                  <p
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.primary[800],
                      margin: 0,
                    }}
                  >
                    💡 <strong>Development Mode:</strong> Use "Mock Wallet
                    (Testing)" for immediate testing without installing any wallet
                    extensions.
                  </p>
                </div>
              )}

            {Object.entries(PROVIDER_INFO)
              .filter(([providerId]) => {
                // Show mock wallet only in development or when explicitly enabled
                if (providerId === 'mock') {
                  return (
                    import.meta.env.DEV ||
                    import.meta.env.VITE_ENABLE_MOCK_WALLET === 'true'
                  );
                }
                return true;
              })
              .map(([providerId, providerInfo]) =>
                renderProviderOption(providerId, providerInfo)
              )}
          </div>

          <div
            style={{
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.neutral[50],
              borderRadius: tokens.borderRadius.md,
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
              textAlign: 'center',
            }}
          >
            <p style={{ marginTop: 0, marginRight: 0, marginBottom: tokens.spacing[2], marginLeft: 0 }}>
              By connecting a wallet, you agree to our Terms of Service and
              Privacy Policy.
            </p>
            <p style={{ margin: 0 }}>
              Make sure you trust this site with your wallet.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};
