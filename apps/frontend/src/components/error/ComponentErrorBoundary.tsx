import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorLoggingService } from '@/services/errorLoggingService';

/**
 * Props for the ComponentErrorBoundary component
 */
export interface ComponentErrorBoundaryProps {
    /** Custom fallback component to render when an error occurs */
    fallback?: React.ComponentType<ErrorFallbackProps>;
    /** Callback function called when an error is caught */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    /** Whether to reset error state when props change */
    resetOnPropsChange?: boolean;
    /** Component name for error tracking */
    componentName?: string;
    /** Children components to wrap */
    children: ReactNode;
}

/**
 * Props passed to error fallback components
 */
export interface ErrorFallbackProps {
    /** The error that occurred */
    error: Error;
    /** Function to reset the error boundary */
    resetError: () => void;
    /** Name of the component that errored */
    componentName?: string;
    /** Additional error context */
    errorInfo?: ErrorInfo;
}

/**
 * Internal state for the error boundary
 */
interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
    errorId: string;
    timestamp: Date;
    recoveryAttempts: number;
}

/**
 * Error metrics for monitoring and debugging
 */
interface ErrorMetrics {
    totalErrors: number;
    errorsByComponent: Record<string, number>;
    errorsByType: Record<string, number>;
    lastError?: ErrorBoundaryState;
    recoverySuccessRate: number;
}

/**
 * Global error metrics storage
 */
class ErrorMetricsCollector {
    private static instance: ErrorMetricsCollector;
    private metrics: ErrorMetrics = {
        totalErrors: 0,
        errorsByComponent: {},
        errorsByType: {},
        recoverySuccessRate: 0,
    };

    static getInstance(): ErrorMetricsCollector {
        if (!ErrorMetricsCollector.instance) {
            ErrorMetricsCollector.instance = new ErrorMetricsCollector();
        }
        return ErrorMetricsCollector.instance;
    }

    recordError(componentName: string, error: Error): void {
        this.metrics.totalErrors++;
        this.metrics.errorsByComponent[componentName] =
            (this.metrics.errorsByComponent[componentName] || 0) + 1;
        this.metrics.errorsByType[error.name] =
            (this.metrics.errorsByType[error.name] || 0) + 1;
    }

    recordRecovery(success: boolean): void {
        // Simple recovery rate calculation
        const totalRecoveries = Object.values(this.metrics.errorsByComponent).reduce((a, b) => a + b, 0);
        if (totalRecoveries > 0) {
            this.metrics.recoverySuccessRate = success ?
                (this.metrics.recoverySuccessRate + 1) / 2 :
                this.metrics.recoverySuccessRate * 0.9;
        }
    }

    getMetrics(): ErrorMetrics {
        return { ...this.metrics };
    }
}

/**
 * ComponentErrorBoundary - A React error boundary component that catches JavaScript errors
 * anywhere in the child component tree, logs those errors, and displays a fallback UI.
 * 
 * Features:
 * - Comprehensive error catching and logging
 * - Customizable fallback UI components
 * - Error recovery mechanisms
 * - Error metrics collection
 * - Development-friendly error details
 */
export class ComponentErrorBoundary extends Component<
    ComponentErrorBoundaryProps,
    ErrorBoundaryState
> {
    private metricsCollector = ErrorMetricsCollector.getInstance();
    private maxRecoveryAttempts = 3;

    constructor(props: ComponentErrorBoundaryProps) {
        super(props);

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
    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        // Generate unique error ID for tracking
        const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
        const { componentName = 'Unknown', onError } = this.props;

        // Update state with error info
        this.setState(prevState => ({
            ...prevState,
            errorInfo,
        }));

        // Record error metrics
        this.metricsCollector.recordError(componentName, error);

        // Log detailed error information using the new service
        const errorId = errorLoggingService.logError(error, errorInfo, componentName);

        // Store error ID for recovery tracking
        this.setState(prevState => ({
            ...prevState,
            errorId,
        }));

        // Call custom error handler if provided
        if (onError) {
            try {
                onError(error, errorInfo);
            } catch (handlerError) {
                console.error('Error in custom error handler:', handlerError);
            }
        }
    }

    /**
     * Check if props have changed and reset error if needed
     */
    componentDidUpdate(prevProps: ComponentErrorBoundaryProps): void {
        const { resetOnPropsChange } = this.props;
        const { hasError, recoveryAttempts } = this.state;

        if (resetOnPropsChange && hasError && prevProps.children !== this.props.children) {
            // Props changed, attempt recovery
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

        if (recoveryAttempts < this.maxRecoveryAttempts) {
            const startTime = Date.now();

            this.setState({
                hasError: false,
                error: undefined,
                errorInfo: undefined,
                errorId: '',
                timestamp: new Date(),
                recoveryAttempts: recoveryAttempts + 1,
            });

            // Record recovery attempt with the new service
            if (errorId) {
                const recoveryTime = Date.now() - startTime;
                errorLoggingService.recordRecoveryAttempt(errorId, true, recoveryTime);
            }

            // Record recovery attempt in old metrics collector
            this.metricsCollector.recordRecovery(true);
        }
    };



    /**
     * Render the component
     */
    render(): ReactNode {
        const { hasError, error, errorInfo, recoveryAttempts } = this.state;
        const { fallback: FallbackComponent, children, componentName } = this.props;

        if (hasError && error) {
            // Use custom fallback component if provided
            if (FallbackComponent) {
                return (
                    <FallbackComponent
                        error={error}
                        resetError={this.resetErrorBoundary}
                        componentName={componentName}
                        errorInfo={errorInfo}
                    />
                );
            }

            // Default fallback UI
            return (
                <div className="error-boundary-fallback" role="alert">
                    <div className="error-boundary-content">
                        <h2>Something went wrong</h2>
                        <p>
                            {componentName ? `The ${componentName} component` : 'A component'} encountered an error.
                        </p>

                        {process.env.NODE_ENV === 'development' && (
                            <details className="error-details">
                                <summary>Error Details (Development)</summary>
                                <pre>{error.message}</pre>
                                <pre>{error.stack}</pre>
                                {errorInfo && (
                                    <pre>{errorInfo.componentStack}</pre>
                                )}
                            </details>
                        )}

                        {recoveryAttempts < this.maxRecoveryAttempts && (
                            <button
                                onClick={this.resetErrorBoundary}
                                className="error-boundary-retry-button"
                                type="button"
                            >
                                Try Again ({this.maxRecoveryAttempts - recoveryAttempts} attempts left)
                            </button>
                        )}

                        {recoveryAttempts >= this.maxRecoveryAttempts && (
                            <p className="error-boundary-max-attempts">
                                Maximum recovery attempts reached. Please refresh the page.
                            </p>
                        )}
                    </div>
                </div>
            );
        }

        return children;
    }
}

/**
 * Hook to access error metrics (for debugging and monitoring)
 */
export const useErrorMetrics = (): ErrorMetrics => {
    const metricsCollector = ErrorMetricsCollector.getInstance();
    return metricsCollector.getMetrics();
};

export default ComponentErrorBoundary;