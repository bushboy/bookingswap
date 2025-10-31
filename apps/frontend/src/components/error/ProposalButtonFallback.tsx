import React, { useState, useCallback } from 'react';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { ProposalErrorFallbackProps } from './ProposalErrorBoundary';
import ProposalDiagnosticPanel from './ProposalDiagnosticPanel';

/**
 * Props for the ProposalButtonFallback component
 */
export interface ProposalButtonFallbackProps extends ProposalErrorFallbackProps {
    /** Callback to manually accept the proposal */
    onManualAccept?: (proposalId: string) => Promise<void>;
    /** Callback to manually reject the proposal */
    onManualReject?: (proposalId: string, reason?: string) => Promise<void>;
    /** Callback to refresh proposal data */
    onRefreshProposal?: (proposalId: string) => Promise<void>;
    /** Whether manual actions are available */
    allowManualActions?: boolean;
    /** Current proposal status */
    proposalStatus?: 'pending' | 'accepted' | 'rejected' | 'expired';
    /** Error type for specialized handling */
    errorType?: 'timeout' | 'invalid_state' | 'network' | 'permission' | 'unknown';
    /** Last action timestamp for timeout detection */
    lastActionTimestamp?: Date;
    /** Whether the error was caused by a timeout */
    isTimeoutError?: boolean;
    /** Whether the error was caused by invalid state */
    isInvalidStateError?: boolean;
}

/**
 * Diagnostic information about the button failure
 */
interface DiagnosticInfo {
    timestamp: Date;
    userAgent: string;
    url: string;
    proposalId?: string | null;
    errorType: string;
    componentStack?: string;
    possibleCauses: string[];
    suggestedActions: string[];
}

/**
 * ProposalButtonFallback - Specialized fallback UI for failed proposal action buttons
 * 
 * Features:
 * - Alternative action methods when buttons fail (Requirement 5.2)
 * - Manual refresh capabilities for stuck states (Requirement 5.2)
 * - Diagnostic information display for troubleshooting (Requirement 5.4)
 * - Graceful degradation with manual controls
 * - Timeout detection and recovery (Requirement 5.4)
 * - Invalid state detection and auto-refresh (Requirement 5.2)
 */
export const ProposalButtonFallback: React.FC<ProposalButtonFallbackProps> = ({
    error,
    resetError,
    proposalId,
    componentName = 'ProposalActionButtons',
    errorInfo,
    recoveryAttempts,
    maxRecoveryAttempts,
    showDebugInfo = false,
    onManualAccept,
    onManualReject,
    onRefreshProposal,
    allowManualActions = true,
    proposalStatus = 'pending',
    errorType = 'unknown',
    lastActionTimestamp,
    isTimeoutError = false,
    isInvalidStateError = false,
}) => {
    const [isManualActionLoading, setIsManualActionLoading] = useState<'accept' | 'reject' | 'refresh' | 'auto_refresh' | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [manualActionError, setManualActionError] = useState<string | null>(null);
    const [autoRefreshAttempts, setAutoRefreshAttempts] = useState(0);
    const [timeoutDetected, setTimeoutDetected] = useState(false);
    const [invalidStateDetected, setInvalidStateDetected] = useState(false);

    // Enhanced error detection
    const detectErrorType = useCallback((error: Error): {
        type: 'timeout' | 'invalid_state' | 'network' | 'permission' | 'unknown';
        isTimeout: boolean;
        isInvalidState: boolean;
        shouldAutoRefresh: boolean;
        message: string;
    } => {
        const errorMessage = error?.message?.toLowerCase() || '';
        const errorStack = error?.stack?.toLowerCase() || '';

        // Timeout detection
        if (errorMessage.includes('timeout') ||
            errorMessage.includes('timed out') ||
            errorMessage.includes('request timeout') ||
            errorStack.includes('timeout') ||
            isTimeoutError) {
            return {
                type: 'timeout',
                isTimeout: true,
                isInvalidState: false,
                shouldAutoRefresh: true,
                message: 'The action timed out. This may be due to network issues or server load.'
            };
        }

        // Invalid state detection
        if (errorMessage.includes('invalid state') ||
            errorMessage.includes('already processed') ||
            errorMessage.includes('expired') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('state mismatch') ||
            isInvalidStateError) {
            return {
                type: 'invalid_state',
                isTimeout: false,
                isInvalidState: true,
                shouldAutoRefresh: true,
                message: 'The proposal state has changed. Refreshing data to get the latest information.'
            };
        }

        // Network errors
        if (errorMessage.includes('network') ||
            errorMessage.includes('fetch') ||
            errorMessage.includes('connection') ||
            errorMessage.includes('cors')) {
            return {
                type: 'network',
                isTimeout: false,
                isInvalidState: false,
                shouldAutoRefresh: false,
                message: 'Network connection issue. Please check your internet connection.'
            };
        }

        // Permission errors
        if (errorMessage.includes('unauthorized') ||
            errorMessage.includes('forbidden') ||
            errorMessage.includes('permission')) {
            return {
                type: 'permission',
                isTimeout: false,
                isInvalidState: false,
                shouldAutoRefresh: false,
                message: 'You don\'t have permission to perform this action.'
            };
        }

        return {
            type: 'unknown',
            isTimeout: false,
            isInvalidState: false,
            shouldAutoRefresh: false,
            message: 'An unexpected error occurred.'
        };
    }, [isTimeoutError, isInvalidStateError]);

    // Auto-refresh for invalid state errors (Requirement 5.2)
    const handleAutoRefresh = useCallback(async () => {
        if (!onRefreshProposal || !proposalId || autoRefreshAttempts >= 3) return;

        console.log(`[ProposalButtonFallback] Auto-refreshing proposal ${proposalId} due to invalid state (attempt ${autoRefreshAttempts + 1})`);

        setIsManualActionLoading('auto_refresh');
        setAutoRefreshAttempts(prev => prev + 1);

        try {
            await onRefreshProposal(proposalId);
            // Reset error state after successful refresh
            resetError();
        } catch (refreshError) {
            console.error('Auto-refresh failed:', refreshError);
            setManualActionError('Failed to refresh proposal data automatically');
        } finally {
            setIsManualActionLoading(null);
        }
    }, [onRefreshProposal, proposalId, autoRefreshAttempts, resetError]);

    // Detect error types and set states
    React.useEffect(() => {
        const errorAnalysis = detectErrorType(error);

        setTimeoutDetected(errorAnalysis.isTimeout);
        setInvalidStateDetected(errorAnalysis.isInvalidState);

        // Auto-refresh for invalid state errors (Requirement 5.2)
        if (errorAnalysis.shouldAutoRefresh && errorAnalysis.isInvalidState && autoRefreshAttempts === 0) {
            const timer = setTimeout(() => {
                handleAutoRefresh();
            }, 1000); // Wait 1 second before auto-refresh

            return () => clearTimeout(timer);
        }
    }, [error, detectErrorType, handleAutoRefresh, autoRefreshAttempts]);

    // Generate enhanced diagnostic information
    const errorAnalysis = detectErrorType(error);
    const diagnosticInfo: DiagnosticInfo = {
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        proposalId: proposalId,
        errorType: errorAnalysis.type,
        componentStack: errorInfo?.componentStack,
        possibleCauses: errorAnalysis.type === 'timeout' ? [
            'Network latency or slow connection',
            'Server overload or high response times',
            'Large payload processing delays',
            'Database query timeouts',
            'Third-party service delays',
        ] : errorAnalysis.type === 'invalid_state' ? [
            'Proposal was modified by another user',
            'Proposal expired during action',
            'Concurrent actions on the same proposal',
            'Stale data in browser cache',
            'WebSocket synchronization issues',
        ] : [
            'Network connectivity issues',
            'Server-side validation errors',
            'Component state corruption',
            'Permission or authentication problems',
            'Browser compatibility issues',
            'Cached data conflicts',
        ],
        suggestedActions: errorAnalysis.type === 'timeout' ? [
            'Wait a moment and try again',
            'Check your internet connection speed',
            'Try using manual action buttons below',
            'Refresh the page if the issue persists',
            'Contact support if timeouts continue',
        ] : errorAnalysis.type === 'invalid_state' ? [
            'Proposal data will be refreshed automatically',
            'Check if another user modified the proposal',
            'Verify the proposal is still in pending state',
            'Try the action again after refresh',
            'Contact the proposal owner if needed',
        ] : [
            'Try refreshing the proposal data',
            'Check your internet connection',
            'Clear browser cache and cookies',
            'Try using manual action buttons below',
            'Contact support if the issue persists',
        ],
    };

    // Handle manual accept action
    const handleManualAccept = useCallback(async () => {
        if (!proposalId || !onManualAccept) return;

        setIsManualActionLoading('accept');
        setManualActionError(null);

        try {
            await onManualAccept(proposalId);
            // Success - the parent component should handle the state update
        } catch (error) {
            console.error('Manual accept failed:', error);
            setManualActionError(error instanceof Error ? error.message : 'Failed to accept proposal');
        } finally {
            setIsManualActionLoading(null);
        }
    }, [proposalId, onManualAccept]);

    // Handle manual reject action
    const handleManualReject = useCallback(async () => {
        if (!proposalId || !onManualReject) return;

        setIsManualActionLoading('reject');
        setManualActionError(null);

        try {
            const reason = rejectionReason.trim();
            await onManualReject(proposalId, reason.length > 0 ? reason : undefined);
            setRejectionReason(''); // Clear reason on success
        } catch (error) {
            console.error('Manual reject failed:', error);
            setManualActionError(error instanceof Error ? error.message : 'Failed to reject proposal');
        } finally {
            setIsManualActionLoading(null);
        }
    }, [proposalId, onManualReject, rejectionReason]);

    // Handle manual refresh
    const handleManualRefresh = useCallback(async () => {
        if (!proposalId || !onRefreshProposal) return;

        setIsManualActionLoading('refresh');
        setManualActionError(null);

        try {
            await onRefreshProposal(proposalId);
            // After successful refresh, try to reset the error boundary
            resetError();
        } catch (error) {
            console.error('Manual refresh failed:', error);
            setManualActionError(error instanceof Error ? error.message : 'Failed to refresh proposal');
        } finally {
            setIsManualActionLoading(null);
        }
    }, [proposalId, onRefreshProposal, resetError]);

    // Copy diagnostic info to clipboard
    const copyDiagnosticInfo = useCallback(async () => {
        const diagnosticText = `
Proposal Button Error Diagnostic Report
=====================================
Timestamp: ${diagnosticInfo.timestamp.toISOString()}
Proposal ID: ${proposalId || 'Not provided'}
Component: ${componentName}
Error Type: ${diagnosticInfo.errorType}
Error Message: ${error.message}
Recovery Attempts: ${recoveryAttempts}/${maxRecoveryAttempts}

Browser Information:
- User Agent: ${diagnosticInfo.userAgent}
- URL: ${diagnosticInfo.url}

Error Stack:
${error.stack || 'Not available'}

Component Stack:
${diagnosticInfo.componentStack || 'Not available'}

Possible Causes:
${diagnosticInfo.possibleCauses.map(cause => `- ${cause}`).join('\n')}

Suggested Actions:
${diagnosticInfo.suggestedActions.map(action => `- ${action}`).join('\n')}
        `.trim();

        try {
            await navigator.clipboard.writeText(diagnosticText);
            alert('Diagnostic information copied to clipboard');
        } catch (err) {
            console.error('Failed to copy diagnostic info:', err);
            // Fallback: show the text in a new window
            const newWindow = window.open('', '_blank');
            if (newWindow) {
                newWindow.document.write(`<pre>${diagnosticText}</pre>`);
                newWindow.document.title = 'Proposal Button Error Diagnostic';
            }
        }
    }, [diagnosticInfo, proposalId, componentName, error, recoveryAttempts, maxRecoveryAttempts]);

    const canTakeActions = proposalStatus === 'pending' && allowManualActions;
    const isAnyActionLoading = isManualActionLoading !== null;

    return (
        <div
            style={{
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.warning[50],
                border: `2px solid ${tokens.colors.warning[200]}`,
                borderRadius: tokens.borderRadius.lg,
                maxWidth: '600px',
                margin: '0 auto',
            }}
            role="alert"
        >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: tokens.spacing[4] }}>
                <div style={{ fontSize: '32px', marginBottom: tokens.spacing[2] }}>
                    {timeoutDetected ? '⏱️' : invalidStateDetected ? '🔄' : '🔧'}
                </div>
                <h3 style={{
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: timeoutDetected ? tokens.colors.error[800] :
                        invalidStateDetected ? tokens.colors.primary[800] :
                            tokens.colors.warning[800],
                    margin: `0 0 ${tokens.spacing[2]} 0`,
                }}>
                    {timeoutDetected ? 'Action Timed Out' :
                        invalidStateDetected ? 'Proposal State Changed' :
                            'Action Buttons Unavailable'}
                </h3>
                <p style={{
                    fontSize: tokens.typography.fontSize.base,
                    color: timeoutDetected ? tokens.colors.error[700] :
                        invalidStateDetected ? tokens.colors.primary[700] :
                            tokens.colors.warning[700],
                    marginBottom: 0,
                }}>
                    {timeoutDetected ?
                        'The action took too long to complete. This may be due to network issues or server load.' :
                        invalidStateDetected ?
                            'The proposal state has changed since you last viewed it. The data is being refreshed automatically.' :
                            'The proposal action buttons encountered an error. You can still take actions using the manual controls below.'}
                </p>
            </div>

            {/* Auto-refresh status for invalid state */}
            {invalidStateDetected && isManualActionLoading === 'auto_refresh' && (
                <div style={{
                    padding: tokens.spacing[3],
                    backgroundColor: tokens.colors.primary[50],
                    border: `1px solid ${tokens.colors.primary[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    marginBottom: tokens.spacing[3],
                    textAlign: 'center',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: tokens.spacing[2] }}>
                        <span style={{ fontSize: '16px' }}>🔄</span>
                        <span style={{ color: tokens.colors.primary[700] }}>
                            Refreshing proposal data automatically... (Requirement 5.2)
                        </span>
                    </div>
                </div>
            )}

            {/* Timeout-specific guidance */}
            {timeoutDetected && (
                <div style={{
                    padding: tokens.spacing[3],
                    backgroundColor: tokens.colors.error[50],
                    border: `1px solid ${tokens.colors.error[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    marginBottom: tokens.spacing[3],
                }}>
                    <div style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.error[700],
                        marginBottom: tokens.spacing[2],
                    }}>
                        <strong>⏱️ Timeout Detected (Requirement 5.4)</strong>
                    </div>
                    <div style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.error[600],
                    }}>
                        {lastActionTimestamp && (
                            <div>Last action attempt: {lastActionTimestamp.toLocaleTimeString()}</div>
                        )}
                        <div>The action exceeded the expected response time. This could be due to:</div>
                        <ul style={{ margin: `${tokens.spacing[1]} 0`, paddingLeft: tokens.spacing[4] }}>
                            <li>Slow network connection</li>
                            <li>Server processing delays</li>
                            <li>High system load</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Invalid state specific guidance */}
            {invalidStateDetected && (
                <div style={{
                    padding: tokens.spacing[3],
                    backgroundColor: tokens.colors.primary[50],
                    border: `1px solid ${tokens.colors.primary[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    marginBottom: tokens.spacing[3],
                }}>
                    <div style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.primary[700],
                        marginBottom: tokens.spacing[2],
                    }}>
                        <strong>🔄 Invalid State Detected (Requirement 5.2)</strong>
                    </div>
                    <div style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.primary[600],
                    }}>
                        <div>The proposal state has changed and needs to be refreshed. This could be because:</div>
                        <ul style={{ margin: `${tokens.spacing[1]} 0`, paddingLeft: tokens.spacing[4] }}>
                            <li>Another user modified the proposal</li>
                            <li>The proposal expired</li>
                            <li>Concurrent actions occurred</li>
                        </ul>
                        {autoRefreshAttempts > 0 && (
                            <div style={{ marginTop: tokens.spacing[2], fontStyle: 'italic' }}>
                                Auto-refresh attempts: {autoRefreshAttempts}/3
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Manual Action Error Display */}
            {manualActionError && (
                <div style={{
                    padding: tokens.spacing[3],
                    backgroundColor: tokens.colors.error[50],
                    border: `1px solid ${tokens.colors.error[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    marginBottom: tokens.spacing[3],
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.error[700],
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                        <span>⚠️</span>
                        <span>{manualActionError}</span>
                    </div>
                </div>
            )}

            {/* Recovery Actions */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[3],
                marginBottom: tokens.spacing[4],
            }}>
                {/* Primary Recovery */}
                <div style={{
                    display: 'flex',
                    gap: tokens.spacing[2],
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                }}>
                    {/* Timeout-specific recovery */}
                    {timeoutDetected && (
                        <Button
                            variant="primary"
                            size="md"
                            onClick={resetError}
                            disabled={isAnyActionLoading}
                            style={{
                                backgroundColor: tokens.colors.error[600],
                                borderColor: tokens.colors.error[600],
                            }}
                        >
                            ⏱️ Retry After Timeout
                        </Button>
                    )}

                    {/* Invalid state recovery */}
                    {invalidStateDetected && onRefreshProposal && (
                        <Button
                            variant="primary"
                            size="md"
                            onClick={handleManualRefresh}
                            disabled={isAnyActionLoading}
                            loading={isManualActionLoading === 'refresh' || isManualActionLoading === 'auto_refresh'}
                            style={{
                                backgroundColor: tokens.colors.primary[600],
                                borderColor: tokens.colors.primary[600],
                            }}
                        >
                            🔄 Force Refresh State
                        </Button>
                    )}

                    {/* General recovery for other errors */}
                    {!timeoutDetected && !invalidStateDetected && recoveryAttempts < maxRecoveryAttempts && (
                        <Button
                            variant="primary"
                            size="md"
                            onClick={resetError}
                            disabled={isAnyActionLoading}
                            style={{
                                backgroundColor: tokens.colors.warning[600],
                                borderColor: tokens.colors.warning[600],
                            }}
                        >
                            🔄 Retry Buttons ({maxRecoveryAttempts - recoveryAttempts} left)
                        </Button>
                    )}

                    {/* Manual refresh for non-invalid-state errors */}
                    {!invalidStateDetected && onRefreshProposal && (
                        <Button
                            variant="outline"
                            size="md"
                            onClick={handleManualRefresh}
                            disabled={isAnyActionLoading}
                            loading={isManualActionLoading === 'refresh'}
                            style={{
                                borderColor: tokens.colors.primary[300],
                                color: tokens.colors.primary[700],
                            }}
                        >
                            🔄 Refresh Data
                        </Button>
                    )}
                </div>

                {/* Manual Actions */}
                {canTakeActions && (onManualAccept || onManualReject) && (
                    <div style={{
                        padding: tokens.spacing[3],
                        backgroundColor: tokens.colors.primary[50],
                        border: `1px solid ${tokens.colors.primary[200]}`,
                        borderRadius: tokens.borderRadius.md,
                    }}>
                        <h4 style={{
                            fontSize: tokens.typography.fontSize.base,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.primary[800],
                            margin: `0 0 ${tokens.spacing[2]} 0`,
                            textAlign: 'center',
                        }}>
                            Manual Actions Available
                        </h4>

                        {/* Rejection Reason Input */}
                        {onManualReject && (
                            <div style={{ marginBottom: tokens.spacing[3] }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: tokens.colors.neutral[700],
                                    marginBottom: tokens.spacing[1],
                                }}>
                                    Rejection Reason (Optional):
                                </label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Enter reason for rejection..."
                                    disabled={isAnyActionLoading}
                                    style={{
                                        width: '100%',
                                        minHeight: '60px',
                                        padding: tokens.spacing[2],
                                        border: `1px solid ${tokens.colors.neutral[300]}`,
                                        borderRadius: tokens.borderRadius.md,
                                        fontSize: tokens.typography.fontSize.sm,
                                        fontFamily: 'inherit',
                                        resize: 'vertical',
                                    }}
                                />
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{
                            display: 'flex',
                            gap: tokens.spacing[2],
                            justifyContent: 'center',
                            flexWrap: 'wrap',
                        }}>
                            {onManualReject && (
                                <Button
                                    variant="outline"
                                    size="md"
                                    onClick={handleManualReject}
                                    disabled={isAnyActionLoading}
                                    loading={isManualActionLoading === 'reject'}
                                    style={{
                                        borderColor: tokens.colors.error[300],
                                        color: tokens.colors.error[700],
                                    }}
                                >
                                    ❌ Reject Proposal
                                </Button>
                            )}

                            {onManualAccept && (
                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={handleManualAccept}
                                    disabled={isAnyActionLoading}
                                    loading={isManualActionLoading === 'accept'}
                                    style={{
                                        backgroundColor: tokens.colors.success[600],
                                        borderColor: tokens.colors.success[600],
                                    }}
                                >
                                    ✅ Accept Proposal
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Status Message for Non-Pending Proposals */}
                {!canTakeActions && proposalStatus !== 'pending' && (
                    <div style={{
                        padding: tokens.spacing[3],
                        backgroundColor: tokens.colors.neutral[50],
                        border: `1px solid ${tokens.colors.neutral[200]}`,
                        borderRadius: tokens.borderRadius.md,
                        textAlign: 'center',
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                    }}>
                        This proposal is {proposalStatus} and no longer accepts actions.
                    </div>
                )}
            </div>

            {/* Enhanced Diagnostic Panel */}
            <div style={{
                borderTop: `1px solid ${tokens.colors.neutral[200]}`,
                paddingTop: tokens.spacing[3],
            }}>
                <ProposalDiagnosticPanel
                    proposalId={proposalId}
                    componentName={componentName}
                    error={error}
                    showAdvanced={showDebugInfo}
                    onManualRefresh={onRefreshProposal && proposalId ? () => onRefreshProposal(proposalId!) : undefined}
                    onClearCache={async () => {
                        // Clear proposal-specific cache
                        if (proposalId && window.localStorage) {
                            const keysToRemove = Object.keys(localStorage).filter(key =>
                                key.includes(proposalId) || key.includes('proposal')
                            );
                            keysToRemove.forEach(key => {
                                try {
                                    localStorage.removeItem(key);
                                } catch (e) {
                                    console.warn('Failed to remove localStorage key:', key);
                                }
                            });
                        }
                    }}
                    onGenerateReport={async () => {
                        const report = `
Proposal Button Error Report
===========================
Generated: ${new Date().toISOString()}
Proposal ID: ${proposalId || 'Not provided'}
Component: ${componentName}
Recovery Attempts: ${recoveryAttempts}/${maxRecoveryAttempts}

Error Information:
- Type: ${diagnosticInfo.errorType}
- Message: ${error.message}
- Stack: ${error.stack || 'Not available'}

Possible Causes:
${diagnosticInfo.possibleCauses.map(cause => `- ${cause}`).join('\n')}

Suggested Actions:
${diagnosticInfo.suggestedActions.map(action => `- ${action}`).join('\n')}

Browser Information:
- User Agent: ${diagnosticInfo.userAgent}
- URL: ${diagnosticInfo.url}
- Timestamp: ${diagnosticInfo.timestamp.toISOString()}

${showDebugInfo ? `
Technical Details:
${JSON.stringify({
                            error: {
                                name: error.name,
                                message: error.message,
                                stack: error.stack,
                            },
                            componentStack: errorInfo?.componentStack,
                            diagnosticInfo,
                        }, null, 2)}
` : ''}
                        `.trim();
                        return report;
                    }}
                    compact={false}
                />

                {/* Quick Copy Button */}
                <div style={{
                    marginTop: tokens.spacing[2],
                    textAlign: 'center',
                }}>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyDiagnosticInfo}
                        style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.neutral[600],
                        }}
                    >
                        📋 Copy Basic Info to Clipboard
                    </Button>
                </div>
            </div>

            {/* Footer */}
            <div style={{
                marginTop: tokens.spacing[3],
                textAlign: 'center',
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[500],
            }}>
                If manual actions don't work, please contact support with the diagnostic information above.
            </div>
        </div>
    );
};

export default ProposalButtonFallback;