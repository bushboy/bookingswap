import React, { useState, useRef, useCallback } from 'react';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { proposalToastService } from '../../services/proposalToastService';
import { ProposalStatusDisplay, ProposalStatusData } from './ProposalStatusDisplay';
import ProposalConfirmationDialog from './ProposalConfirmationDialog';
import ProposalErrorBoundary from '../error/ProposalErrorBoundary';
import ProposalButtonFallback from '../error/ProposalButtonFallback';
import StuckStateDetector from '../error/StuckStateDetector';
import TimeoutHandler from '../../utils/timeoutHandler';
import { ConnectionStatusIndicator } from '../common/ConnectionStatusIndicator';
import { useSwapWebSocket } from '../../hooks/useSwapWebSocket';
import { proposalButtonDiagnostics } from '../../utils/proposalButtonDiagnostics';


export interface ProposalActionButtonsProps {
    /** Unique identifier for the proposal */
    proposalId: string;

    /** Current status of the proposal */
    status: 'pending' | 'accepted' | 'rejected' | 'expired';

    /** Proposal type for better messaging */
    proposalType?: 'booking' | 'cash';

    /** Target title for better messaging */
    targetTitle?: string;

    /** Whether the buttons should be disabled */
    disabled?: boolean;

    /** Whether any action is currently processing */
    isProcessing?: boolean;

    /** Callback when accept button is clicked */
    onAccept: (proposalId: string) => Promise<void> | void;

    /** Callback when reject button is clicked */
    onReject: (proposalId: string, reason?: string) => Promise<void> | void;

    /** Whether to show confirmation dialogs */
    showConfirmation?: boolean;

    /** Confirmation dialog customization options */
    confirmationOptions?: {
        /** Whether to show keyboard shortcuts in dialogs */
        showKeyboardShortcuts?: boolean;
        /** Whether to auto-focus the confirm button */
        autoFocusConfirm?: boolean;
        /** Whether to show detailed proposal info in dialogs */
        showProposalDetails?: boolean;
        /** Custom button text for accept dialog */
        acceptButtonText?: string;
        /** Custom button text for reject dialog */
        rejectButtonText?: string;
        /** Custom button text for cancel */
        cancelButtonText?: string;
        /** Custom message for accept dialog */
        acceptMessage?: string;
        /** Custom message for reject dialog */
        rejectMessage?: string;
    };

    /** Custom styling */
    className?: string;

    /** Layout orientation */
    orientation?: 'horizontal' | 'vertical';

    /** Button size */
    size?: 'sm' | 'md' | 'lg';

    /** Whether to show toast notifications */
    showToasts?: boolean;

    /** Payment and blockchain status data */
    statusData?: ProposalStatusData;

    /** Whether to show payment/blockchain status */
    showStatus?: boolean;

    /** Callback when retry is requested */
    onRetry?: (proposalId: string) => void;

    /** Debug mode - force show buttons even when conditions aren't met */
    debugForceShow?: boolean;

    /** Current user ID for permission validation */
    currentUserId?: string;

    /** Proposal owner ID for permission validation */
    proposalOwnerId?: string;

    /** Swap ID for WebSocket connection */
    swapId?: string;

    /** Whether to show connection status indicator */
    showConnectionStatus?: boolean;
}

export const ProposalActionButtons: React.FC<ProposalActionButtonsProps> = ({
    proposalId,
    status,
    proposalType = 'booking',
    targetTitle = 'Unknown',
    disabled = false,
    isProcessing = false,
    onAccept,
    onReject,
    showConfirmation = true,
    confirmationOptions = {},
    className = '',
    orientation = 'horizontal',
    size = 'md',
    showToasts = true,
    statusData,
    showStatus = true,
    onRetry,
    debugForceShow = false,
    currentUserId,
    proposalOwnerId,
    swapId,
    showConnectionStatus = false,
}) => {
    const { isMobile } = useResponsive();

    // WebSocket connection for real-time updates and optimistic actions
    const {
        connectionHealth,
        manualReconnect,
        optimisticAcceptProposal,
        optimisticRejectProposal,
        rollbackProposalAction,
        isProposalProcessing,
    } = useSwapWebSocket({
        swapId,
        autoJoinRoom: !!swapId,
    });

    const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null);
    const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [, setProcessingToastId] = useState<string | null>(null);

    // Debouncing and duplicate prevention
    const lastActionTime = useRef<number>(0);
    const actionInProgress = useRef<boolean>(false);
    const DEBOUNCE_DELAY = 1000; // 1 second debounce

    // Error handling state
    const [retryCount, setRetryCount] = useState<Record<string, number>>({});
    const [lastError, setLastError] = useState<string | null>(null);
    const MAX_RETRIES = 3;

    // Error categorization and handling
    const categorizeError = useCallback((error: any): {
        type: 'network' | 'permission' | 'validation' | 'system';
        isRetryable: boolean;
        userMessage: string;
        shouldRefresh: boolean;
    } => {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';

        // Network errors
        if (errorMessage.includes('fetch') || errorMessage.includes('network') ||
            errorMessage.includes('timeout') || errorMessage.includes('connection')) {
            return {
                type: 'network',
                isRetryable: true,
                userMessage: 'Connection issue. Please check your internet and try again.',
                shouldRefresh: false
            };
        }

        // Permission errors
        if (errorMessage.includes('unauthorized') || errorMessage.includes('permission') ||
            errorMessage.includes('forbidden') || error?.status === 403) {
            return {
                type: 'permission',
                isRetryable: false,
                userMessage: 'You don\'t have permission to perform this action.',
                shouldRefresh: true
            };
        }

        // Validation errors (proposal expired, already processed, etc.)
        if (errorMessage.includes('expired') || errorMessage.includes('already') ||
            errorMessage.includes('invalid state') || error?.status === 400) {
            return {
                type: 'validation',
                isRetryable: false,
                userMessage: 'This proposal is no longer available for this action.',
                shouldRefresh: true
            };
        }

        // System errors
        return {
            type: 'system',
            isRetryable: true,
            userMessage: 'Something went wrong. Please try again.',
            shouldRefresh: false
        };
    }, []);

    // Retry handler
    const handleRetryAction = useCallback(async (actionType: 'accept' | 'reject', originalAction: () => Promise<void>) => {
        const retryKey = `${proposalId}-${actionType}`;
        const currentRetries = retryCount[retryKey] || 0;

        if (currentRetries >= MAX_RETRIES) {
            console.warn(`[ProposalActionButtons] Max retries reached for ${actionType} on ${proposalId}`);
            return;
        }

        console.log(`[ProposalActionButtons] Retrying ${actionType} for ${proposalId}, attempt ${currentRetries + 1}`);

        setRetryCount(prev => ({
            ...prev,
            [retryKey]: currentRetries + 1
        }));

        try {
            await originalAction();
            // Reset retry count on success
            setRetryCount(prev => {
                const newCount = { ...prev };
                delete newCount[retryKey];
                return newCount;
            });
            setLastError(null);
        } catch (error) {
            console.error(`[ProposalActionButtons] Retry ${currentRetries + 1} failed for ${actionType} on ${proposalId}:`, error);
            const errorInfo = categorizeError(error);
            setLastError(errorInfo.userMessage);

            if (!errorInfo.isRetryable || currentRetries + 1 >= MAX_RETRIES) {
                console.warn(`[ProposalActionButtons] No more retries for ${actionType} on ${proposalId}`);
            }
        }
    }, [proposalId, retryCount, categorizeError]);

    // Debounced action wrapper to prevent duplicate submissions
    const withDebounce = useCallback((action: () => Promise<void>, actionType: 'accept' | 'reject') => {
        return async () => {
            const now = Date.now();

            // Check if action is already in progress
            if (actionInProgress.current) {
                console.log(`[ProposalActionButtons] ${actionType} action already in progress for ${proposalId}, ignoring`);
                return;
            }

            // Check debounce delay
            if (now - lastActionTime.current < DEBOUNCE_DELAY) {
                console.log(`[ProposalActionButtons] ${actionType} action debounced for ${proposalId}, ignoring`);
                return;
            }

            lastActionTime.current = now;
            actionInProgress.current = true;

            try {
                await action();
            } finally {
                actionInProgress.current = false;
            }
        };
    }, [proposalId]);

    // Enhanced button visibility logic with detailed conditions checking
    // Support different casing coming from backend (e.g. 'PENDING', 'Pending')
    const statusIsPending = String(status).toLowerCase() === 'pending';
    const componentNotDisabled = !disabled;
    const notCurrentlyProcessing = !isProcessing;
    const hasPermission = !currentUserId || !proposalOwnerId || currentUserId === proposalOwnerId;
    const canTakeAction = (statusIsPending && componentNotDisabled && hasPermission) || debugForceShow;

    // Debug logging to understand button visibility issues
    console.log(`[ProposalActionButtons] Proposal ${proposalId} visibility check:`, {
        status,
        statusIsPending,
        disabled,
        componentNotDisabled,
        isProcessing,
        notCurrentlyProcessing,
        hasPermission,
        currentUserId,
        proposalOwnerId,
        canTakeAction,
        debugForceShow,
        showConfirmation,
        targetTitle,
        timestamp: new Date().toISOString()
    });

    // Generate diagnostic report for troubleshooting
    const diagnosticReport = proposalButtonDiagnostics.generateDiagnosticReport(
        proposalId,
        status,
        currentUserId || null,
        proposalOwnerId || null,
        disabled,
        isProcessing,
        debugForceShow
    );

    // Determine why buttons might be hidden
    const hiddenReasons = [];
    if (!statusIsPending) hiddenReasons.push(`Status is '${status}' (must be 'pending')`);
    if (!componentNotDisabled) hiddenReasons.push('Component is disabled');
    if (!hasPermission) hiddenReasons.push('User lacks permission (not proposal owner)');

    // If buttons can't be shown, provide better feedback
    if (!canTakeAction) {
        const reason = hiddenReasons.join(', ');
        console.warn(`[ProposalActionButtons] Buttons hidden for proposal ${proposalId}: ${reason}`);

        // In development, show diagnostic info instead of hiding completely
        if (process.env.NODE_ENV === 'development') {
            return (
                <div style={{
                    padding: tokens.spacing[2],
                    backgroundColor: tokens.colors.warning[50],
                    border: `1px solid ${tokens.colors.warning[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.warning[700],
                    marginTop: tokens.spacing[2]
                }}>
                    <strong>🔍 Debug: Buttons Hidden</strong><br />
                    Proposal: {proposalId}<br />
                    Status: {status} {statusIsPending ? '✅' : '❌'}<br />
                    Disabled: {disabled ? 'Yes ❌' : 'No ✅'}<br />
                    Processing: {isProcessing ? 'Yes ⏳' : 'No ✅'}<br />
                    Permission: {hasPermission ? 'Yes ✅' : 'No ❌'}<br />
                    Current User: {currentUserId || 'Not provided'}<br />
                    Owner: {proposalOwnerId || 'Not provided'}<br />
                    Force Show: {debugForceShow ? 'Yes 🔧' : 'No'}<br />
                    Reason: {reason}<br />
                    <small>Buttons will show when status is 'pending', not disabled, and user has permission</small>
                </div>
            );
        }

        // In production, show a subtle message for non-pending proposals
        if (status !== 'pending') {
            return (
                <div style={{
                    padding: tokens.spacing[2],
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.neutral[500],
                    textAlign: 'center',
                    fontStyle: 'italic'
                }}>
                    Proposal {status}
                </div>
            );
        }

        return null;
    }

    const handleAcceptAction = async () => {
        console.log(`[ProposalActionButtons] Accept action starting for proposal ${proposalId}`);

        let toastId: string | null = null;
        let optimisticUpdate: any = null;

        const startTime = Date.now();

        try {
            setActionLoading('accept');

            // Apply optimistic update if WebSocket is connected
            if (connectionHealth?.isHealthy && swapId) {
                optimisticUpdate = optimisticAcceptProposal(proposalId, {
                    id: proposalId,
                    status: 'pending',
                    lastModified: Date.now(),
                });
            }

            // Show processing toast if enabled
            if (showToasts) {
                toastId = proposalToastService.showProcessingToast(
                    proposalId,
                    'accepting',
                    targetTitle
                );
                setProcessingToastId(toastId);
            }

            // Wrap the action with timeout handling (Requirement 5.4)
            await TimeoutHandler.wrapProposalAction(
                async () => {
                    const result = onAccept(proposalId);
                    return result instanceof Promise ? await result : result;
                },
                'accept',
                proposalId,
                (timeoutError) => {
                    console.error(`[ProposalActionButtons] Accept action timed out for ${proposalId}:`, timeoutError);
                    setLastError(`Accept action timed out: ${timeoutError.message}`);
                    // Rollback optimistic update on timeout
                    if (optimisticUpdate && swapId) {
                        rollbackProposalAction(proposalId);
                    }
                },
                (attempt) => {
                    console.log(`[ProposalActionButtons] Retrying accept action for ${proposalId}, attempt ${attempt}`);
                }
            );

            // Show success toast
            if (showToasts) {
                if (toastId) {
                    proposalToastService.updateProcessingToast(
                        toastId,
                        { success: true, proposalId },
                        targetTitle
                    );
                }
                proposalToastService.showAcceptanceSuccess(
                    proposalId,
                    proposalType,
                    targetTitle
                );
            }

            // Track successful interaction
            proposalButtonDiagnostics.trackInteraction(
                proposalId,
                'accept',
                true,
                Date.now() - startTime,
                undefined,
                currentUserId || undefined
            );
        } catch (error) {
            console.error('Error accepting proposal:', error);

            const errorInfo = categorizeError(error);
            setLastError(errorInfo.userMessage);

            // Rollback optimistic update on error
            if (optimisticUpdate && swapId) {
                rollbackProposalAction(proposalId);
            }

            // Show error toast with retry option if applicable
            if (showToasts) {
                // const retryKey = `${proposalId}-accept`;
                // const currentRetries = retryCount[retryKey] || 0;
                // const canRetry = errorInfo.isRetryable && currentRetries < MAX_RETRIES;

                if (toastId) {
                    proposalToastService.updateProcessingToast(
                        toastId,
                        {
                            success: false,
                            proposalId,
                            errorMessage: errorInfo.userMessage
                        },
                        targetTitle
                    );
                } else {
                    proposalToastService.showError(
                        proposalId,
                        errorInfo.userMessage,
                        targetTitle
                    );
                }
            }

            // Don't rethrow - let the component handle the error state
        } finally {
            setActionLoading(null);
            setProcessingToastId(null);
        }
    };

    // Create debounced click handlers
    const handleAcceptClick = withDebounce(async () => {
        if (showConfirmation && !showAcceptConfirm) {
            console.log(`[ProposalActionButtons] Showing accept confirmation dialog for ${proposalId}`);
            setShowAcceptConfirm(true);
            return;
        }
        await handleAcceptAction();
    }, 'accept');

    const handleRejectAction = async () => {
        console.log(`[ProposalActionButtons] Reject action starting for proposal ${proposalId}`, {
            showConfirmation,
            showRejectConfirm,
            isProcessing,
            actionLoading,
            rejectionReason
        });

        const startTime = Date.now();
        let toastId: string | null = null;
        let optimisticUpdate: any = null;

        try {
            setActionLoading('reject');

            // Apply optimistic update if WebSocket is connected
            if (connectionHealth?.isHealthy && swapId) {
                optimisticUpdate = optimisticRejectProposal(proposalId, {
                    id: proposalId,
                    status: 'pending',
                    lastModified: Date.now(),
                }, rejectionReason.trim() || undefined);
            }

            // Show processing toast if enabled
            if (showToasts) {
                toastId = proposalToastService.showProcessingToast(
                    proposalId,
                    'rejecting',
                    targetTitle
                );
                setProcessingToastId(toastId);
            }

            // Wrap the action with timeout handling (Requirement 5.4)
            await TimeoutHandler.wrapProposalAction(
                async () => {
                    const result = onReject(proposalId, rejectionReason.trim() || undefined);
                    return result instanceof Promise ? await result : result;
                },
                'reject',
                proposalId,
                (timeoutError) => {
                    console.error(`[ProposalActionButtons] Reject action timed out for ${proposalId}:`, timeoutError);
                    setLastError(`Reject action timed out: ${timeoutError.message}`);
                    // Rollback optimistic update on timeout
                    if (optimisticUpdate && swapId) {
                        rollbackProposalAction(proposalId);
                    }
                },
                (attempt) => {
                    console.log(`[ProposalActionButtons] Retrying reject action for ${proposalId}, attempt ${attempt}`);
                }
            );

            // Show success toast
            if (showToasts) {
                if (toastId) {
                    proposalToastService.updateProcessingToast(
                        toastId,
                        { success: true, proposalId },
                        targetTitle
                    );
                }
                proposalToastService.showRejectionSuccess(
                    proposalId,
                    proposalType,
                    targetTitle,
                    rejectionReason.trim() || undefined
                );
            }

            // Clear rejection reason
            setRejectionReason('');
        } catch (error) {
            console.error('Error rejecting proposal:', error);

            const errorInfo = categorizeError(error);
            setLastError(errorInfo.userMessage);

            // Rollback optimistic update on error
            if (optimisticUpdate && swapId) {
                rollbackProposalAction(proposalId);
            }

            // Show error toast with retry option if applicable
            if (showToasts) {
                // const retryKey = `${proposalId}-reject`;
                // const currentRetries = retryCount[retryKey] || 0;
                // const canRetry = errorInfo.isRetryable && currentRetries < MAX_RETRIES;

                if (toastId) {
                    proposalToastService.updateProcessingToast(
                        toastId,
                        {
                            success: false,
                            proposalId,
                            errorMessage: errorInfo.userMessage
                        },
                        targetTitle
                    );
                } else {
                    proposalToastService.showError(
                        proposalId,
                        errorInfo.userMessage,
                        targetTitle
                    );
                }
            }

            // Don't rethrow - let the component handle the error state
        } finally {
            setActionLoading(null);
            setProcessingToastId(null);
        }
    };

    // Create debounced reject handler
    const handleRejectClick = withDebounce(async () => {
        if (showConfirmation && !showRejectConfirm) {
            console.log(`[ProposalActionButtons] Showing reject confirmation dialog for ${proposalId}`);
            setShowRejectConfirm(true);
            return;
        }
        await handleRejectAction();
    }, 'reject');

    const handleCancelConfirm = () => {
        setShowAcceptConfirm(false);
        setShowRejectConfirm(false);
        setRejectionReason('');
    };

    // Enhanced button disabled state calculation
    const isExternallyProcessing = isProcessing;
    const isInternallyProcessing = actionLoading !== null;
    const isWebSocketProcessing = swapId ? isProposalProcessing(proposalId) : false;
    const isShowingConfirmation = showAcceptConfirm || showRejectConfirm;
    const isDebounceBlocked = actionInProgress.current;
    const isButtonDisabled = isExternallyProcessing || isInternallyProcessing || isWebSocketProcessing || isDebounceBlocked;

    // Log button state for debugging
    console.log(`[ProposalActionButtons] Button state for ${proposalId}:`, {
        isButtonDisabled,
        isExternallyProcessing,
        isInternallyProcessing,
        isShowingConfirmation,
        isDebounceBlocked,
        actionLoading,
        showAcceptConfirm,
        showRejectConfirm,
        canInteract: canTakeAction && !isButtonDisabled,
        lastActionTime: lastActionTime.current,
        timeSinceLastAction: Date.now() - lastActionTime.current
    });
    const actualOrientation = isMobile ? 'vertical' : orientation;

    const containerStyles = {
        display: 'flex',
        gap: tokens.spacing[3],
        flexDirection: actualOrientation === 'vertical' ? 'column' : 'row',
        alignItems: actualOrientation === 'vertical' ? 'stretch' : 'center',
        justifyContent: actualOrientation === 'horizontal' ? 'flex-end' : 'stretch',
    } as const;



    // Enhanced error analysis for fallback
    const analyzeErrorForFallback = useCallback((error: Error) => {
        const errorMessage = error?.message?.toLowerCase() || '';
        const errorStack = error?.stack?.toLowerCase() || '';

        // Detect timeout errors (Requirement 5.4)
        const isTimeout = errorMessage.includes('timeout') ||
            errorMessage.includes('timed out') ||
            errorMessage.includes('request timeout') ||
            errorStack.includes('timeout');

        // Detect invalid state errors (Requirement 5.2)
        const isInvalidState = errorMessage.includes('invalid state') ||
            errorMessage.includes('already processed') ||
            errorMessage.includes('expired') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('state mismatch');

        let errorType: 'timeout' | 'invalid_state' | 'network' | 'permission' | 'unknown' = 'unknown';

        if (isTimeout) errorType = 'timeout';
        else if (isInvalidState) errorType = 'invalid_state';
        else if (errorMessage.includes('network') || errorMessage.includes('fetch')) errorType = 'network';
        else if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) errorType = 'permission';

        return {
            errorType,
            isTimeoutError: isTimeout,
            isInvalidStateError: isInvalidState,
        };
    }, []);

    // Create a specialized fallback component for button failures
    const ButtonFallback = useCallback((fallbackProps: any) => {
        const errorAnalysis = fallbackProps.error ? analyzeErrorForFallback(fallbackProps.error) : {
            errorType: 'unknown' as const,
            isTimeoutError: false,
            isInvalidStateError: false,
        };

        return (
            <ProposalButtonFallback
                {...fallbackProps}
                onManualAccept={onAccept}
                onManualReject={onReject}
                onRefreshProposal={onRetry}
                allowManualActions={status === 'pending'}
                proposalStatus={status}
                errorType={errorAnalysis.errorType}
                isTimeoutError={errorAnalysis.isTimeoutError}
                isInvalidStateError={errorAnalysis.isInvalidStateError}
                lastActionTimestamp={lastActionTime.current > 0 ? new Date(lastActionTime.current) : undefined}
            />
        );
    }, [onAccept, onReject, onRetry, status, analyzeErrorForFallback, lastActionTime]);

    return (
        <StuckStateDetector
            componentId={`proposal-buttons-${proposalId}`}
            isLoading={isButtonDisabled && (isExternallyProcessing || isInternallyProcessing)}
            maxLoadingTime={45000} // 45 seconds before considering stuck
            onStuckStateDetected={(componentId, duration) => {
                console.warn(`[ProposalActionButtons] Stuck state detected for ${componentId} after ${duration}ms`);
            }}
            onRecovery={async (componentId) => {
                console.log(`[ProposalActionButtons] Attempting recovery for ${componentId}`);
                // Reset internal state
                setActionLoading(null);
                setLastError(null);
                // Try to refresh proposal data if available
                if (onRetry) {
                    await onRetry(proposalId);
                }
            }}
            showStuckStateUI={true}
            stuckStateMessage="The proposal action buttons appear to be stuck in a loading state. This may be due to network issues or server delays."
            autoRecover={false} // Manual recovery for better user control
        >
            <ProposalErrorBoundary
                proposalId={proposalId}
                componentName="ProposalActionButtons"
                fallback={ButtonFallback}
                resetOnPropsChange={true}
                maxRecoveryAttempts={3}
                showDebugInfo={debugForceShow || process.env.NODE_ENV === 'development'}
                onError={(error, errorInfo) => {
                    console.error(`[ProposalActionButtons] Error boundary caught error for proposal ${proposalId}:`, {
                        error: error.message,
                        stack: error.stack,
                        componentStack: errorInfo.componentStack,
                        proposalId,
                        status,
                        currentUserId,
                        proposalOwnerId,
                    });
                }}
                onRecoveryAttempt={(attempt, success) => {
                    console.log(`[ProposalActionButtons] Recovery attempt ${attempt} ${success ? 'succeeded' : 'failed'} for proposal ${proposalId}`);
                }}
            >
                {/* Connection Status Indicator */}
                {showConnectionStatus && connectionHealth && (
                    <ConnectionStatusIndicator
                        health={connectionHealth}
                        onReconnect={manualReconnect}
                        showDetails={debugForceShow || process.env.NODE_ENV === 'development'}
                        className="proposal-connection-status"
                    />
                )}

                {/* Payment and Blockchain Status Display */}
                {showStatus && statusData && (
                    <ProposalStatusDisplay
                        statusData={statusData}
                        compact={false}
                        showDetailsDefault={false}
                        allowToggleDetails={true}
                        onRetry={onRetry}
                        canRetry={!!onRetry && statusData.overallStatus === 'failed'}
                    />
                )}

                <div className={className} style={containerStyles}>
                    <Button
                        variant="outline"
                        size={size}
                        onClick={handleRejectClick}
                        disabled={isButtonDisabled}
                        loading={actionLoading === 'reject'}
                        style={{
                            borderColor: tokens.colors.error[300],
                            color: tokens.colors.error[700],
                            backgroundColor: actionLoading === 'reject' ? tokens.colors.error[50] : undefined,
                        }}
                        aria-label={`Reject proposal ${proposalId}`}
                        data-testid="reject-proposal-button"
                    >
                        {actionLoading === 'reject' ? (
                            <>
                                <span role="img" aria-label="Processing">⏳</span>
                                Rejecting...
                            </>
                        ) : (
                            <>
                                <span role="img" aria-label="Reject">❌</span>
                                Reject
                            </>
                        )}
                    </Button>

                    <Button
                        variant="primary"
                        size={size}
                        onClick={handleAcceptClick}
                        disabled={isButtonDisabled}
                        loading={actionLoading === 'accept'}
                        style={{
                            backgroundColor: actionLoading === 'accept'
                                ? tokens.colors.success[600]
                                : tokens.colors.success[500],
                        }}
                        aria-label={`Accept proposal ${proposalId}`}
                        data-testid="accept-proposal-button"
                    >
                        {actionLoading === 'accept' ? (
                            <>
                                <span role="img" aria-label="Processing">⏳</span>
                                Accepting...
                            </>
                        ) : (
                            <>
                                <span role="img" aria-label="Accept">✅</span>
                                Accept
                            </>
                        )}
                    </Button>
                </div>

                {/* Error Display and Retry Options */}
                {lastError && (
                    <div style={{
                        marginTop: tokens.spacing[2],
                        padding: tokens.spacing[2],
                        backgroundColor: tokens.colors.error[50],
                        border: `1px solid ${tokens.colors.error[200]}`,
                        borderRadius: tokens.borderRadius.md,
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.error[700]
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                            <span>⚠️</span>
                            <span>{lastError}</span>
                        </div>

                        {/* Retry buttons for retryable errors */}
                        {(() => {
                            const acceptRetryKey = `${proposalId}-accept`;
                            const rejectRetryKey = `${proposalId}-reject`;
                            const acceptRetries = retryCount[acceptRetryKey] || 0;
                            const rejectRetries = retryCount[rejectRetryKey] || 0;
                            const canRetryAccept = acceptRetries < MAX_RETRIES;
                            const canRetryReject = rejectRetries < MAX_RETRIES;

                            return (canRetryAccept || canRetryReject) && (
                                <div style={{
                                    marginTop: tokens.spacing[2],
                                    display: 'flex',
                                    gap: tokens.spacing[2],
                                    justifyContent: 'flex-end'
                                }}>
                                    {canRetryReject && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleRetryAction('reject', handleRejectAction)}
                                            disabled={isButtonDisabled}
                                            style={{
                                                borderColor: tokens.colors.error[300],
                                                color: tokens.colors.error[600],
                                                fontSize: tokens.typography.fontSize.xs
                                            }}
                                        >
                                            Retry Reject ({rejectRetries}/{MAX_RETRIES})
                                        </Button>
                                    )}
                                    {canRetryAccept && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleRetryAction('accept', handleAcceptAction)}
                                            disabled={isButtonDisabled}
                                            style={{
                                                borderColor: tokens.colors.success[300],
                                                color: tokens.colors.success[600],
                                                fontSize: tokens.typography.fontSize.xs
                                            }}
                                        >
                                            Retry Accept ({acceptRetries}/{MAX_RETRIES})
                                        </Button>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Enhanced Accept Confirmation Dialog */}
                <ProposalConfirmationDialog
                    isOpen={showAcceptConfirm}
                    actionType="accept"
                    proposalDetails={{
                        proposalId,
                        proposalType,
                        targetTitle,
                    }}
                    loading={actionLoading === 'accept'}
                    onConfirm={async () => {
                        setShowAcceptConfirm(false);
                        await handleAcceptAction();
                    }}
                    onCancel={handleCancelConfirm}
                    customMessage={confirmationOptions.acceptMessage}
                    options={{
                        showKeyboardShortcuts: confirmationOptions.showKeyboardShortcuts,
                        autoFocusConfirm: confirmationOptions.autoFocusConfirm,
                        showProposalDetails: confirmationOptions.showProposalDetails,
                        confirmButtonText: confirmationOptions.acceptButtonText,
                        cancelButtonText: confirmationOptions.cancelButtonText,
                    }}
                />

                {/* Enhanced Reject Confirmation Dialog */}
                <ProposalConfirmationDialog
                    isOpen={showRejectConfirm}
                    actionType="reject"
                    proposalDetails={{
                        proposalId,
                        proposalType,
                        targetTitle,
                    }}
                    loading={actionLoading === 'reject'}
                    onConfirm={async (reason) => {
                        setShowRejectConfirm(false);
                        setRejectionReason(reason || '');
                        await handleRejectAction();
                    }}
                    onCancel={handleCancelConfirm}
                    initialReason={rejectionReason}
                    showReasonField={true}
                    customMessage={confirmationOptions.rejectMessage}
                    options={{
                        showKeyboardShortcuts: confirmationOptions.showKeyboardShortcuts,
                        autoFocusConfirm: confirmationOptions.autoFocusConfirm,
                        showProposalDetails: confirmationOptions.showProposalDetails,
                        confirmButtonText: confirmationOptions.rejectButtonText,
                        cancelButtonText: confirmationOptions.cancelButtonText,
                    }}
                />
            </ProposalErrorBoundary>
        </StuckStateDetector>
    );
};

export default ProposalActionButtons;