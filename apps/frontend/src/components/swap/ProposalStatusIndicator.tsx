import React, { useState, useEffect } from 'react';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useAnnouncements } from '../../hooks/useAccessibility';

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'processing';

export interface ProposalStatusIndicatorProps {
    /** Current status of the proposal */
    status: ProposalStatus;

    /** Unique identifier for the proposal */
    proposalId: string;

    /** Whether the status is currently being updated */
    isUpdating?: boolean;

    /** Additional status message */
    message?: string;

    /** Timestamp of last status update */
    lastUpdated?: Date;

    /** Whether to show detailed status information */
    showDetails?: boolean;

    /** Size variant */
    size?: 'sm' | 'md' | 'lg';

    /** Whether to animate status changes */
    animated?: boolean;

    /** Callback when status changes (for real-time updates) */
    onStatusChange?: (newStatus: ProposalStatus) => void;

    /** Custom styling */
    className?: string;

    /** Whether to show processing states */
    showProcessingStates?: boolean;
}

interface StatusConfig {
    icon: string;
    color: string;
    backgroundColor: string;
    borderColor: string;
    label: string;
    description: string;
}

export const ProposalStatusIndicator: React.FC<ProposalStatusIndicatorProps> = ({
    status,
    proposalId,
    isUpdating = false,
    message,
    lastUpdated,
    showDetails = false,
    size = 'md',
    animated = true,
    onStatusChange,
    className = '',
    showProcessingStates = true,
}) => {
    const { isMobile } = useResponsive();
    const { announce } = useAnnouncements();

    const [currentStatus, setCurrentStatus] = useState<ProposalStatus>(status);
    const [isAnimating, setIsAnimating] = useState(false);
    const [processingMessage, setProcessingMessage] = useState<string>('');

    // Handle status changes
    useEffect(() => {
        if (status !== currentStatus) {
            if (animated) {
                setIsAnimating(true);
                setTimeout(() => {
                    setCurrentStatus(status);
                    setIsAnimating(false);

                    // Announce status change for accessibility
                    const statusConfig = getStatusConfig(status);
                    announce(`Proposal status changed to ${statusConfig.label}`, 'polite');

                    onStatusChange?.(status);
                }, 150);
            } else {
                setCurrentStatus(status);
                onStatusChange?.(status);
            }
        }
    }, [status, currentStatus, animated, announce, onStatusChange]);

    // Handle processing states
    useEffect(() => {
        if (showProcessingStates && (isUpdating || currentStatus === 'processing')) {
            const messages = [
                'Processing proposal...',
                'Updating status...',
                'Finalizing changes...',
            ];

            let messageIndex = 0;
            const interval = setInterval(() => {
                setProcessingMessage(messages[messageIndex]);
                messageIndex = (messageIndex + 1) % messages.length;
            }, 1500);

            return () => clearInterval(interval);
        } else {
            setProcessingMessage('');
        }
    }, [isUpdating, currentStatus, showProcessingStates]);

    const getStatusConfig = (statusValue: ProposalStatus): StatusConfig => {
        switch (statusValue) {
            case 'pending':
                return {
                    icon: '⏳',
                    color: tokens.colors.warning[700],
                    backgroundColor: tokens.colors.warning[50],
                    borderColor: tokens.colors.warning[200],
                    label: 'Pending',
                    description: 'Awaiting your response',
                };
            case 'accepted':
                return {
                    icon: '✅',
                    color: tokens.colors.success[700],
                    backgroundColor: tokens.colors.success[50],
                    borderColor: tokens.colors.success[200],
                    label: 'Accepted',
                    description: 'Proposal has been accepted',
                };
            case 'rejected':
                return {
                    icon: '❌',
                    color: tokens.colors.error[700],
                    backgroundColor: tokens.colors.error[50],
                    borderColor: tokens.colors.error[200],
                    label: 'Rejected',
                    description: 'Proposal has been rejected',
                };
            case 'expired':
                return {
                    icon: '⏰',
                    color: tokens.colors.neutral[600],
                    backgroundColor: tokens.colors.neutral[50],
                    borderColor: tokens.colors.neutral[200],
                    label: 'Expired',
                    description: 'Proposal has expired',
                };
            case 'processing':
                return {
                    icon: '🔄',
                    color: tokens.colors.primary[700],
                    backgroundColor: tokens.colors.primary[50],
                    borderColor: tokens.colors.primary[200],
                    label: 'Processing',
                    description: 'Processing your request',
                };
            default:
                return {
                    icon: '❓',
                    color: tokens.colors.neutral[600],
                    backgroundColor: tokens.colors.neutral[50],
                    borderColor: tokens.colors.neutral[200],
                    label: 'Unknown',
                    description: 'Status unknown',
                };
        }
    };

    const getSizeStyles = () => {
        switch (size) {
            case 'sm':
                return {
                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                    fontSize: tokens.typography.fontSize.xs,
                    iconSize: '14px',
                    minHeight: '24px',
                };
            case 'lg':
                return {
                    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                    fontSize: tokens.typography.fontSize.base,
                    iconSize: '20px',
                    minHeight: '48px',
                };
            default: // md
                return {
                    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                    fontSize: tokens.typography.fontSize.sm,
                    iconSize: '16px',
                    minHeight: '32px',
                };
        }
    };

    const formatLastUpdated = (date: Date): string => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const sizeStyles = getSizeStyles();
    const displayStatus = isUpdating || currentStatus === 'processing' ? 'processing' : currentStatus;
    const displayConfig = getStatusConfig(displayStatus);

    const containerStyles = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
        ...sizeStyles,
        borderRadius: tokens.borderRadius.full,
        backgroundColor: displayConfig.backgroundColor,
        border: `1px solid ${displayConfig.borderColor}`,
        color: displayConfig.color,
        fontWeight: tokens.typography.fontWeight.medium,
        transition: animated ? 'all 0.2s ease-in-out' : 'none',
        transform: isAnimating ? 'scale(1.05)' : 'scale(1)',
        opacity: isAnimating ? 0.8 : 1,
        minHeight: sizeStyles.minHeight,
    };

    const iconStyles = {
        fontSize: sizeStyles.iconSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: (displayStatus === 'processing' && animated) ? 'spin 2s linear infinite' : 'none',
    };

    const labelStyles = {
        fontSize: sizeStyles.fontSize,
        fontWeight: tokens.typography.fontWeight.medium,
        textTransform: 'capitalize' as const,
    };

    return (
        <div className={className}>
            <div
                style={containerStyles}
                role="status"
                aria-label={`Proposal status: ${displayConfig.label}`}
                aria-live="polite"
                data-testid={`proposal-status-${proposalId}`}
            >
                <span style={iconStyles} aria-hidden="true">
                    {displayConfig.icon}
                </span>

                <span style={labelStyles}>
                    {displayConfig.label}
                </span>

                {showProcessingStates && processingMessage && (
                    <span style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.neutral[600],
                        fontStyle: 'italic',
                        marginLeft: tokens.spacing[1],
                    }}>
                        {processingMessage}
                    </span>
                )}
            </div>

            {/* Detailed Status Information */}
            {showDetails && (
                <div style={{
                    marginTop: tokens.spacing[2],
                    padding: tokens.spacing[3],
                    backgroundColor: 'white',
                    border: `1px solid ${tokens.colors.neutral[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    fontSize: tokens.typography.fontSize.sm,
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: tokens.spacing[3],
                        flexDirection: isMobile ? 'column' : 'row',
                    }}>
                        <div style={{ flex: 1 }}>
                            <p style={{
                                color: tokens.colors.neutral[700],
                                margin: `0 0 ${tokens.spacing[1]} 0`,
                                fontWeight: tokens.typography.fontWeight.medium,
                            }}>
                                {displayConfig.description}
                            </p>

                            {message && (
                                <p style={{
                                    color: tokens.colors.neutral[600],
                                    margin: 0,
                                    fontSize: tokens.typography.fontSize.xs,
                                    lineHeight: tokens.typography.lineHeight.relaxed,
                                }}>
                                    {message}
                                </p>
                            )}
                        </div>

                        {lastUpdated && (
                            <div style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.neutral[500],
                                textAlign: isMobile ? 'left' : 'right',
                                flexShrink: 0,
                            }}>
                                <div>Updated</div>
                                <div style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                    {formatLastUpdated(lastUpdated)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CSS Animation for spinning icon */}
            <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

export default ProposalStatusIndicator;