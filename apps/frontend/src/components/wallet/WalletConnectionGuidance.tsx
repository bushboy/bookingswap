import React from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { useWallet } from '@/hooks/useWallet';

interface WalletConnectionGuidanceProps {
    onConnectWallet?: () => void;
    onDismiss?: () => void;
    className?: string;
    showSteps?: boolean;
}

export const WalletConnectionGuidance: React.FC<WalletConnectionGuidanceProps> = ({
    onConnectWallet,
    onDismiss,
    className = '',
    showSteps = true,
}) => {
    const { availableProviders, connect } = useWallet();

    const handleConnectWallet = async () => {
        if (onConnectWallet) {
            onConnectWallet();
        } else if (availableProviders.length > 0) {
            // Auto-connect to first available provider
            try {
                await connect(availableProviders[0]);
            } catch (error) {
                console.error('Failed to connect wallet:', error);
            }
        }
    };

    return (
        <div
            className={className}
            style={{
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.primary[50],
                border: `1px solid ${tokens.colors.primary[200]}`,
                borderRadius: tokens.borderRadius.md,
                marginBottom: tokens.spacing[4],
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: tokens.spacing[3],
                }}
            >
                <div
                    style={{
                        fontSize: '24px',
                        color: tokens.colors.primary[600],
                        marginTop: tokens.spacing[1],
                    }}
                >
                    🔗
                </div>

                <div style={{ flex: 1 }}>
                    <h3
                        style={{
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.primary[800],
                            margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                    >
                        Connect Your Wallet to Continue
                    </h3>

                    <p
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.primary[700],
                            margin: `0 0 ${tokens.spacing[3]} 0`,
                            lineHeight: 1.5,
                        }}
                    >
                        To create a swap, you need to connect a wallet for blockchain transactions and escrow management.
                    </p>

                    {showSteps && (
                        <div
                            style={{
                                padding: tokens.spacing[3],
                                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                borderRadius: tokens.borderRadius.sm,
                                marginBottom: tokens.spacing[3],
                            }}
                        >
                            <h4
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.primary[800],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                }}
                            >
                                How to Connect:
                            </h4>
                            <ol
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.primary[700],
                                    margin: 0,
                                    paddingLeft: tokens.spacing[4],
                                    lineHeight: 1.5,
                                }}
                            >
                                <li style={{ marginBottom: tokens.spacing[1] }}>
                                    Click "Connect Wallet" below
                                </li>
                                <li style={{ marginBottom: tokens.spacing[1] }}>
                                    Choose your preferred wallet provider
                                </li>
                                <li style={{ marginBottom: tokens.spacing[1] }}>
                                    Approve the connection in your wallet
                                </li>
                                <li>
                                    Return here to continue creating your swap
                                </li>
                            </ol>
                        </div>
                    )}

                    <div
                        style={{
                            display: 'flex',
                            gap: tokens.spacing[2],
                            marginTop: tokens.spacing[3],
                        }}
                    >
                        <Button
                            onClick={handleConnectWallet}
                            variant="primary"
                            size="sm"
                            disabled={availableProviders.length === 0}
                        >
                            {availableProviders.length > 0 ? 'Connect Wallet' : 'No Wallets Available'}
                        </Button>

                        {availableProviders.length === 0 && (
                            <Button
                                onClick={() => window.open('https://www.hashpack.app/', '_blank')}
                                variant="outline"
                                size="sm"
                            >
                                Install HashPack
                            </Button>
                        )}
                    </div>

                    {availableProviders.length === 0 && (
                        <p
                            style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.primary[600],
                                margin: `${tokens.spacing[2]} 0 0 0`,
                                fontStyle: 'italic',
                            }}
                        >
                            💡 You'll need a Hedera wallet like HashPack to use this feature.
                        </p>
                    )}
                </div>

                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: tokens.colors.primary[600],
                            cursor: 'pointer',
                            fontSize: '18px',
                            padding: tokens.spacing[1],
                        }}
                        aria-label="Dismiss guidance"
                    >
                        ×
                    </button>
                )}
            </div>
        </div>
    );
};