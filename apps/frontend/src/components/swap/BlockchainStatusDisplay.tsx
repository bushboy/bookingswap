import React, { useState } from 'react';
import { tokens } from '../../design-system/tokens';
import { Button } from '../ui/Button';

export interface BlockchainTransaction {
    transactionId: string;
    consensusTimestamp?: string;
    status?: 'pending' | 'confirmed' | 'failed';
    networkFee?: number;
    explorerUrl?: string;
}

export interface BlockchainStatusDisplayProps {
    /** Blockchain transaction data */
    blockchainTransaction?: BlockchainTransaction;

    /** Transaction ID */
    transactionId?: string;

    /** Consensus timestamp */
    consensusTimestamp?: string;

    /** Transaction status */
    status?: 'pending' | 'confirmed' | 'failed';

    /** Whether transaction is currently being processed */
    isProcessing?: boolean;

    /** Blockchain error message if any */
    error?: string;

    /** Compact display mode */
    compact?: boolean;

    /** Show detailed transaction info */
    showDetails?: boolean;

    /** Action type for better messaging */
    actionType?: 'accept' | 'reject';
}

export const BlockchainStatusDisplay: React.FC<BlockchainStatusDisplayProps> = ({
    blockchainTransaction,
    transactionId,
    consensusTimestamp,
    status,
    isProcessing = false,
    error,
    compact = false,
    showDetails = false,
    actionType = 'accept',
}) => {
    const [showFullTransactionId, setShowFullTransactionId] = useState(false);

    // Determine the display values
    const displayTransactionId = blockchainTransaction?.transactionId || transactionId;
    const displayConsensusTimestamp = blockchainTransaction?.consensusTimestamp || consensusTimestamp;
    const displayStatus = blockchainTransaction?.status || status || (isProcessing ? 'pending' : 'confirmed');

    // Status configuration
    const statusConfig = {
        pending: {
            icon: '⏳',
            label: 'Recording on Blockchain',
            color: tokens.colors.warning[600],
            bgColor: tokens.colors.warning[50],
            borderColor: tokens.colors.warning[200],
            description: 'Transaction is being recorded on the blockchain'
        },
        confirmed: {
            icon: '🔗',
            label: 'Blockchain Confirmed',
            color: tokens.colors.success[600],
            bgColor: tokens.colors.success[50],
            borderColor: tokens.colors.success[200],
            description: 'Transaction has been confirmed on the blockchain'
        },
        failed: {
            icon: '❌',
            label: 'Blockchain Failed',
            color: tokens.colors.error[600],
            bgColor: tokens.colors.error[50],
            borderColor: tokens.colors.error[200],
            description: 'Failed to record transaction on blockchain'
        }
    };

    const config = statusConfig[displayStatus] || statusConfig.pending;

    const formatTransactionId = (txId: string, showFull: boolean = false): string => {
        if (!txId) return 'N/A';
        if (showFull || txId.length <= 16) return txId;
        return `${txId.substring(0, 8)}...${txId.substring(txId.length - 8)}`;
    };

    const formatTimestamp = (timestamp: string): string => {
        if (!timestamp) return 'N/A';
        try {
            const date = new Date(timestamp);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });
        } catch {
            return timestamp;
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            // Could add a toast notification here
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
        }
    };

    // Compact display
    if (compact) {
        return (
            <div
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                    backgroundColor: config.bgColor,
                    border: `1px solid ${config.borderColor}`,
                    borderRadius: tokens.borderRadius.md,
                    fontSize: tokens.typography.fontSize.sm,
                    color: config.color,
                }}
            >
                <span>{config.icon}</span>
                <span>Blockchain</span>
                {isProcessing && (
                    <div
                        style={{
                            width: '12px',
                            height: '12px',
                            border: `2px solid ${config.color}`,
                            borderTop: '2px solid transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                        }}
                    />
                )}
            </div>
        );
    }

    // Full display
    return (
        <div
            style={{
                padding: tokens.spacing[4],
                backgroundColor: config.bgColor,
                border: `1px solid ${config.borderColor}`,
                borderRadius: tokens.borderRadius.lg,
                marginBottom: tokens.spacing[3],
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: tokens.spacing[3],
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                    }}
                >
                    <span style={{ fontSize: '20px' }}>{config.icon}</span>
                    <div>
                        <h4
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: config.color,
                                margin: 0,
                            }}
                        >
                            {config.label}
                        </h4>
                        <p
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[600],
                                margin: 0,
                            }}
                        >
                            {config.description}
                        </p>
                    </div>
                </div>

                {displayStatus === 'confirmed' && (
                    <div
                        style={{
                            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                            backgroundColor: tokens.colors.success[100],
                            border: `1px solid ${tokens.colors.success[300]}`,
                            borderRadius: tokens.borderRadius.full,
                            fontSize: tokens.typography.fontSize.xs,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.success[800],
                        }}
                    >
                        Immutable Record
                    </div>
                )}
            </div>

            {/* Progress indicator for pending */}
            {(isProcessing || displayStatus === 'pending') && (
                <div
                    style={{
                        marginBottom: tokens.spacing[3],
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            height: '4px',
                            backgroundColor: tokens.colors.neutral[200],
                            borderRadius: tokens.borderRadius.full,
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                backgroundColor: config.color,
                                animation: 'progress-indeterminate 2s ease-in-out infinite',
                            }}
                        />
                    </div>
                    <p
                        style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.neutral[600],
                            margin: `${tokens.spacing[1]} 0 0 0`,
                            textAlign: 'center',
                        }}
                    >
                        Recording {actionType} action on blockchain...
                    </p>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div
                    style={{
                        padding: tokens.spacing[3],
                        backgroundColor: tokens.colors.error[50],
                        border: `1px solid ${tokens.colors.error[200]}`,
                        borderRadius: tokens.borderRadius.md,
                        marginBottom: tokens.spacing[3],
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>⚠️</span>
                        <div>
                            <h5
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.error[800],
                                    margin: 0,
                                }}
                            >
                                Blockchain Error
                            </h5>
                            <p
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.error[700],
                                    margin: 0,
                                }}
                            >
                                {error}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction ID */}
            {displayTransactionId && (
                <div
                    style={{
                        marginBottom: tokens.spacing[3],
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: tokens.spacing[1],
                        }}
                    >
                        <span
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[700],
                            }}
                        >
                            Transaction ID:
                        </span>
                        <div style={{ display: 'flex', gap: tokens.spacing[1] }}>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowFullTransactionId(!showFullTransactionId)}
                                style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                }}
                            >
                                {showFullTransactionId ? 'Collapse' : 'Expand'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(displayTransactionId)}
                                style={{
                                    fontSize: tokens.typography.fontSize.xs,
                                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                }}
                            >
                                📋 Copy
                            </Button>
                        </div>
                    </div>
                    <div
                        style={{
                            padding: tokens.spacing[2],
                            backgroundColor: tokens.colors.neutral[100],
                            border: `1px solid ${tokens.colors.neutral[200]}`,
                            borderRadius: tokens.borderRadius.md,
                            fontFamily: 'monospace',
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[800],
                            wordBreak: 'break-all',
                        }}
                    >
                        {formatTransactionId(displayTransactionId, showFullTransactionId)}
                    </div>
                </div>
            )}

            {/* Consensus timestamp */}
            {displayConsensusTimestamp && displayStatus === 'confirmed' && (
                <div
                    style={{
                        marginBottom: tokens.spacing[3],
                    }}
                >
                    <span
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.neutral[700],
                        }}
                    >
                        Confirmed at:
                    </span>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                            marginTop: tokens.spacing[1],
                        }}
                    >
                        {formatTimestamp(displayConsensusTimestamp)}
                    </div>
                </div>
            )}

            {/* Additional details */}
            {showDetails && blockchainTransaction && (
                <div
                    style={{
                        borderTop: `1px solid ${config.borderColor}`,
                        paddingTop: tokens.spacing[3],
                    }}
                >
                    <h5
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[700],
                            margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                    >
                        Blockchain Details
                    </h5>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: tokens.spacing[2],
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                        }}
                    >
                        <div>
                            <strong>Network:</strong>
                            <br />
                            Hedera Hashgraph
                        </div>
                        <div>
                            <strong>Action:</strong>
                            <br />
                            Proposal {actionType}
                        </div>
                        {blockchainTransaction.networkFee && (
                            <div>
                                <strong>Network Fee:</strong>
                                <br />
                                {blockchainTransaction.networkFee} HBAR
                            </div>
                        )}
                        {blockchainTransaction.explorerUrl && (
                            <div>
                                <strong>Explorer:</strong>
                                <br />
                                <a
                                    href={blockchainTransaction.explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        color: tokens.colors.primary[600],
                                        textDecoration: 'none',
                                        fontSize: tokens.typography.fontSize.sm,
                                    }}
                                >
                                    View on Explorer ↗
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                @keyframes progress-indeterminate {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(0%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

export default BlockchainStatusDisplay;