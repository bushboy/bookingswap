import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { errorLoggingService } from '../../services/errorLoggingService';

/**
 * Props for the ProposalErrorBoundary component
 */
export interface ProposalErrorBoundaryProps {
    /** Custom fallback component to render when an error occurs */
    fallback?: React.ComponentType<ProposalErrorFallbackProps>;
    /** Callback function called when an error is caught */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    /** Whether to reset error state when props change */
    resetOnPropsChange?: boolean;
    /** Proposal ID for error tracking */
    proposalId?: string;
    /** Component name for error tracking */
    componentName?: string;
    /** Children components to wrap */
    children: ReactNode;
    /** Whether to show debug information in development */
    showDebugInfo?: boolean;
    /** Maximum number of recovery attempts */
    maxRecoveryAttempts?: number;
    /** Callback when error recovery is attempted */
    onRecoveryAttempt?: (attempt: number, success: boolean) => void;
}

/**
 * Props passed to proposal error fallback components
 */
export interface ProposalErrorFallbackProps {
    /** The error that occurred */
    error: Error;
    /** Function to reset the error boundary */
    resetError: () => void;
    /** Proposal ID that errored */
    proposalId?: string | null;
    /** Name of the component that errored */
    componentName?: string;
    /** Additional error context */
    errorInfo?: ErrorInfo;
    /** Number of recovery attempts made */
    recoveryAttempts: number;
    /** Maximum recovery attempts allowed */
    maxRecoveryAttempts: number;
    /** Whether debug info should be shown */
    showDebugInfo?: boolean;
}

/**
 * Internal state for the proposal error boundary
 */
interface ProposalErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
    errorId: string;
    timestamp: Date;
    recoveryAttempts: number;
    lastRecoveryAttempt?: Date;
}

/**
 * ProposalErrorBoundary - A specialized React error boundary for proposal-related components
 * 
 * Features:
 * - Proposal-specific error handling and logging
 * - Graceful degradation for proposal action components
 * - Enhanced error reporting with proposal context
 * - Recovery mechanisms with retry limits
 * - Development-friendly debugging information
 */
export class ProposalErrorBoundary extends Component<
    ProposalErrorBoundaryProps,
    ProposalErrorBoundaryState
> {
    private maxRecoveryAttempts: number;

    constructor(props: ProposalErrorBoundaryProps) {
        super(props);

        this.maxRecoveryAttempts = props.maxRecoveryAttempts || 3;

        this.state = {
            hasError: false,
            errorId: '',
            timestamp: new Date(),
            recoveryAttempts: 0,
        };
    }

    /**
     * Static method called when an error is thrown during rendering
     */
    static getDerivedStateFromError(error: Error): Partial<ProposalErrorBoundaryState> {
        // Generate unique error ID for tracking
        const errorId = `proposal_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return {
            hasError: true,
            error,
            errorId,
            timestamp: new Date(),
        };
    }

    /**
     * Called when an error is caught by the error boundary
     */
    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        const { componentName = 'ProposalComponent', proposalId, onError } = this.props;

        // Update state with error info
        this.setState(prevState => ({
            ...prevState,
            errorInfo,
        }));

        // Enhanced error logging with proposal context
        const enhancedErrorInfo = {
            ...errorInfo,
            proposalId,
            componentName,
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString(),
        };

        // Log detailed error information
        const errorId = errorLoggingService.logError(error, enhancedErrorInfo, componentName);

        // Store error ID for recovery tracking
        this.setState(prevState => ({
            ...prevState,
            errorId,
        }));

        // Log proposal-specific error metrics
        console.error(`[ProposalErrorBoundary] Error in ${componentName}:`, {
            proposalId,
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            errorId,
        });

        // Call custom error handler if provided
        if (onError) {
            try {
                onError(error, errorInfo);
            } catch (handlerError) {
                console.error('Error in custom proposal error handler:', handlerError);
            }
        }
    }

    /**
     * Check if props have changed and reset error if needed
     */
    componentDidUpdate(prevProps: ProposalErrorBoundaryProps): void {
        const { resetOnPropsChange, proposalId } = this.props;
        const { hasError, recoveryAttempts } = this.state;

        // Reset if proposal ID changes (different proposal loaded)
        if (hasError && proposalId && prevProps.proposalId !== proposalId) {
            this.resetErrorBoundary();
            return;
        }

        // Reset if children change and resetOnPropsChange is enabled
        if (resetOnPropsChange && hasError && prevProps.children !== this.props.children) {
            if (recoveryAttempts < this.maxRecoveryAttempts) {
                this.resetErrorBoundary();
            }
        }
    }

    /**
     * Reset the error boundary state
     */
    resetErrorBoundary = (): void => {
        const { recoveryAttempts, errorId } = this.state;
        const { onRecoveryAttempt } = this.props;

        if (recoveryAttempts < this.maxRecoveryAttempts) {
            const startTime = Date.now();
            const newAttempts = recoveryAttempts + 1;

            this.setState({
                hasError: false,
                error: undefined,
                errorInfo: undefined,
                errorId: '',
                timestamp: new Date(),
                recoveryAttempts: newAttempts,
                lastRecoveryAttempt: new Date(),
            });

            // Record recovery attempt
            if (errorId) {
                const recoveryTime = Date.now() - startTime;
                errorLoggingService.recordRecoveryAttempt(errorId, true, recoveryTime);
            }

            // Notify parent of recovery attempt
            if (onRecoveryAttempt) {
                onRecoveryAttempt(newAttempts, true);
            }

            console.log(`[ProposalErrorBoundary] Recovery attempt ${newAttempts}/${this.maxRecoveryAttempts} for proposal ${this.props.proposalId}`);
        }
    };

    /**
     * Force refresh the component by reloading the page
     */
    forceRefresh = (): void => {
        const { proposalId } = this.props;

        console.log(`[ProposalErrorBoundary] Force refresh requested for proposal ${proposalId}`);

        // Track the force refresh action
        errorLoggingService.trackUserAction('proposal_force_refresh', {
            proposalId,
            recoveryAttempts: this.state.recoveryAttempts,
        });

        // Clear any proposal-related cached data
        if (proposalId && window.localStorage) {
            const keysToRemove = Object.keys(localStorage).filter(key =>
                key.includes(proposalId) || key.includes('proposal')
            );
            keysToRemove.forEach(key => {
                try {
                    localStorage.removeItem(key);
                } catch (e) {
                    console.warn('Failed to remove localStorage key:', key, e);
                }
            });
        }

        // Reload the page
        window.location.reload();
    };

    /**
     * Render the component
     */
    render(): ReactNode {
        const { hasError, error, errorInfo, recoveryAttempts, lastRecoveryAttempt } = this.state;
        const {
            fallback: FallbackComponent,
            children,
            componentName,
            proposalId,
            showDebugInfo = process.env.NODE_ENV === 'development'
        } = this.props;

        if (hasError && error) {
            // Use custom fallback component if provided
            if (FallbackComponent) {
                return (
                    <FallbackComponent
                        error={error}
                        resetError={this.resetErrorBoundary}
                        proposalId={proposalId}
                        componentName={componentName}
                        errorInfo={errorInfo}
                        recoveryAttempts={recoveryAttempts}
                        maxRecoveryAttempts={this.maxRecoveryAttempts}
                        showDebugInfo={showDebugInfo}
                    />
                );
            }

            // Default proposal error fallback UI
            return (
                <div
                    style={{
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.error[50],
                        border: `2px solid ${tokens.colors.error[200]}`,
                        borderRadius: tokens.borderRadius.lg,
                        textAlign: 'center',
                        maxWidth: '500px',
                        margin: '0 auto',
                    }}
                    role="alert"
                >
                    <div style={{ fontSize: '32px', marginBottom: tokens.spacing[2] }}>
                        ⚠️
                    </div>

                    <h3 style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.error[800],
                        margin: `0 0 ${tokens.spacing[2]} 0`,
                    }}>
                        Proposal Component Error
                    </h3>

                    <p style={{
                        fontSize: tokens.typography.fontSize.base,
                        color: tokens.colors.error[700],
                        marginBottom: tokens.spacing[3],
                    }}>
                        {componentName ? `The ${componentName} component` : 'A proposal component'}
                        {proposalId ? ` for proposal ${proposalId}` : ''} encountered an error and couldn't render properly.
                    </p>

                    {/* Recovery Actions */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: tokens.spacing[2],
                        marginBottom: tokens.spacing[3],
                    }}>
                        {recoveryAttempts < this.maxRecoveryAttempts ? (
                            <Button
                                variant="primary"
                                size="md"
                                onClick={this.resetErrorBoundary}
                                style={{
                                    backgroundColor: tokens.colors.error[600],
                                    borderColor: tokens.colors.error[600],
                                }}
                            >
                                🔄 Try Again ({this.maxRecoveryAttempts - recoveryAttempts} attempts left)
                            </Button>
                        ) : (
                            <div style={{
                                padding: tokens.spacing[2],
                                backgroundColor: tokens.colors.warning[50],
                                border: `1px solid ${tokens.colors.warning[200]}`,
                                borderRadius: tokens.borderRadius.md,
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.warning[800],
                            }}>
                                Maximum recovery attempts reached
                            </div>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={this.forceRefresh}
                            style={{
                                borderColor: tokens.colors.error[300],
                                color: tokens.colors.error[700],
                            }}
                        >
                            🔧 Refresh Page
                        </Button>
                    </div>

                    {/* Debug Information */}
                    {showDebugInfo && (
                        <details style={{
                            textAlign: 'left',
                            backgroundColor: tokens.colors.neutral[50],
                            border: `1px solid ${tokens.colors.neutral[200]}`,
                            borderRadius: tokens.borderRadius.md,
                            padding: tokens.spacing[3],
                            marginTop: tokens.spacing[3],
                        }}>
                            <summary style={{
                                cursor: 'pointer',
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[700],
                                marginBottom: tokens.spacing[2],
                            }}>
                                Debug Information (Development)
                            </summary>

                            <div style={{
                                fontSize: tokens.typography.fontSize.xs,
                                fontFamily: 'monospace',
                                color: tokens.colors.neutral[600],
                            }}>
                                <div><strong>Proposal ID:</strong> {proposalId || 'Not provided'}</div>
                                <div><strong>Component:</strong> {componentName || 'Unknown'}</div>
                                <div><strong>Recovery Attempts:</strong> {recoveryAttempts}/{this.maxRecoveryAttempts}</div>
                                <div><strong>Last Recovery:</strong> {lastRecoveryAttempt?.toLocaleTimeString() || 'None'}</div>
                                <div><strong>Error:</strong> {error.message}</div>

                                <details style={{ marginTop: tokens.spacing[2] }}>
                                    <summary>Stack Trace</summary>
                                    <pre style={{
                                        whiteSpace: 'pre-wrap',
                                        fontSize: tokens.typography.fontSize.xs,
                                        backgroundColor: tokens.colors.neutral[100],
                                        padding: tokens.spacing[2],
                                        borderRadius: tokens.borderRadius.sm,
                                        marginTop: tokens.spacing[1],
                                        overflow: 'auto',
                                        maxHeight: '200px',
                                    }}>
                                        {error.stack}
                                    </pre>
                                </details>

                                {errorInfo && (
                                    <details style={{ marginTop: tokens.spacing[2] }}>
                                        <summary>Component Stack</summary>
                                        <pre style={{
                                            whiteSpace: 'pre-wrap',
                                            fontSize: tokens.typography.fontSize.xs,
                                            backgroundColor: tokens.colors.neutral[100],
                                            padding: tokens.spacing[2],
                                            borderRadius: tokens.borderRadius.sm,
                                            marginTop: tokens.spacing[1],
                                            overflow: 'auto',
                                            maxHeight: '200px',
                                        }}>
                                            {errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        </details>
                    )}

                    {/* Error ID for support */}
                    <div style={{
                        marginTop: tokens.spacing[3],
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.neutral[500],
                    }}>
                        Error ID: {this.state.errorId} | {new Date().toLocaleTimeString()}
                    </div>
                </div>
            );
        }

        return children;
    }
}

export default ProposalErrorBoundary;