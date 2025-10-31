import React, { Component, ErrorInfo, ReactNode } from 'react';
import { FEATURE_FLAGS } from '@/config/featureFlags';
import { errorLoggingService } from '@/services/errorLoggingService';
import './FeatureFlagErrorBoundary.css';

/**
 * Props for the FeatureFlagErrorBoundary component
 */
export interface FeatureFlagErrorBoundaryProps {
    /** Children components to wrap */
    children: ReactNode;
    /** Custom fallback component to render when a feature flag error occurs */
    fallback?: React.ComponentType<FeatureFlagErrorFallbackProps>;
    /** Feature flag context for better error reporting */
    featureContext?: string;
    /** Whether to show detailed error information in development */
    showDetails?: boolean;
}

/**
 * Props passed to feature flag error fallback components
 */
export interface FeatureFlagErrorFallbackProps {
    /** The error that occurred */
    error: Error;
    /** Function to reset the error boundary */
    resetError: () => void;
    /** Feature context where the error occurred */
    featureContext?: string;
    /** Whether this appears to be a feature flag mismatch */
    isFeatureFlagError: boolean;
}

/**
 * Internal state for the feature flag error boundary
 */
interface FeatureFlagErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
    isFeatureFlagError: boolean;
    errorId: string;
    timestamp: Date;
}

/**
 * Feature flag error patterns to detect mismatches
 */
const FEATURE_FLAG_ERROR_PATTERNS = [
    /auction/i,
    /cash.*swap/i,
    /cash.*payment/i,
    /cash.*offer/i,
    /cash.*proposal/i,
    /auction.*mode/i,
    /auction.*settings/i,
    /acceptance.*strategy/i,
    /payment.*types/i,
    /feature.*flag/i,
    /ENABLE_AUCTION_MODE/i,
    /ENABLE_CASH_SWAPS/i,
    /ENABLE_CASH_PROPOSALS/i,
];

/**
 * Check if an error is likely related to feature flag mismatches
 */
const isFeatureFlagRelatedError = (error: Error): boolean => {
    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || '';

    return FEATURE_FLAG_ERROR_PATTERNS.some(pattern =>
        pattern.test(errorMessage) || pattern.test(errorStack)
    );
};

/**
 * FeatureFlagErrorBoundary - A specialized error boundary for handling feature flag related errors
 * 
 * This component specifically handles errors that occur when there are mismatches between
 * feature flag states and component expectations. It provides graceful degradation and
 * helpful debugging information without breaking the entire UI.
 * 
 * Features:
 * - Detects feature flag related errors
 * - Provides graceful fallback UI
 * - Logs warnings for debugging
 * - Maintains UI stability during feature transitions
 */
export class FeatureFlagErrorBoundary extends Component<
    FeatureFlagErrorBoundaryProps,
    FeatureFlagErrorBoundaryState
> {
    constructor(props: FeatureFlagErrorBoundaryProps) {
        super(props);

        this.state = {
            hasError: false,
            isFeatureFlagError: false,
            errorId: '',
            timestamp: new Date(),
        };
    }

    /**
     * Static method called when an error is thrown during rendering
     */
    static getDerivedStateFromError(error: Error): Partial<FeatureFlagErrorBoundaryState> {
        const isFeatureFlagError = isFeatureFlagRelatedError(error);
        const errorId = `ff_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return {
            hasError: true,
            error,
            isFeatureFlagError,
            errorId,
            timestamp: new Date(),
        };
    }

    /**
     * Called when an error is caught by the error boundary
     */
    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        const { featureContext = 'Unknown' } = this.props;
        const isFeatureFlagError = isFeatureFlagRelatedError(error);

        // Update state with error info
        this.setState(prevState => ({
            ...prevState,
            errorInfo,
        }));

        if (isFeatureFlagError) {
            // Log feature flag specific warning
            console.warn(
                `Feature flag mismatch detected in ${featureContext}:`,
                {
                    error: error.message,
                    featureFlags: FEATURE_FLAGS,
                    componentStack: errorInfo.componentStack,
                    timestamp: new Date().toISOString(),
                }
            );

            // Log to error service with feature flag context
            const errorId = errorLoggingService.logError(
                error,
                errorInfo,
                `FeatureFlag-${featureContext}`,
                {
                    featureFlags: FEATURE_FLAGS,
                    isFeatureFlagError: true,
                    featureContext,
                }
            );

            this.setState(prevState => ({
                ...prevState,
                errorId,
            }));
        } else {
            // Regular error logging
            console.error('Non-feature-flag error caught by FeatureFlagErrorBoundary:', error);

            const errorId = errorLoggingService.logError(
                error,
                errorInfo,
                `FeatureFlag-${featureContext}-NonFF`
            );

            this.setState(prevState => ({
                ...prevState,
                errorId,
            }));
        }
    }

    /**
     * Reset the error boundary state
     */
    resetErrorBoundary = (): void => {
        this.setState({
            hasError: false,
            error: undefined,
            errorInfo: undefined,
            isFeatureFlagError: false,
            errorId: '',
            timestamp: new Date(),
        });
    };

    /**
     * Render the component
     */
    render(): ReactNode {
        const { hasError, error, errorInfo, isFeatureFlagError } = this.state;
        const {
            children,
            fallback: FallbackComponent,
            featureContext,
            showDetails = process.env.NODE_ENV === 'development'
        } = this.props;

        if (hasError && error) {
            // Use custom fallback component if provided
            if (FallbackComponent) {
                return (
                    <FallbackComponent
                        error={error}
                        resetError={this.resetErrorBoundary}
                        featureContext={featureContext}
                        isFeatureFlagError={isFeatureFlagError}
                    />
                );
            }

            // Feature flag specific fallback UI
            if (isFeatureFlagError) {
                return (
                    <div className="feature-flag-error-boundary" role="alert">
                        <div className="feature-flag-error-content">
                            <h3>Feature Temporarily Unavailable</h3>
                            <p>
                                {featureContext
                                    ? `The ${featureContext} feature is currently unavailable.`
                                    : 'This feature is currently unavailable.'
                                }
                            </p>
                            <p>Please try refreshing the page or contact support if the issue persists.</p>

                            {showDetails && (
                                <details className="feature-flag-error-details">
                                    <summary>Technical Details (Development)</summary>
                                    <div className="error-info">
                                        <h4>Error Message:</h4>
                                        <pre>{error.message}</pre>

                                        <h4>Current Feature Flags:</h4>
                                        <pre>{JSON.stringify(FEATURE_FLAGS, null, 2)}</pre>

                                        {errorInfo && (
                                            <>
                                                <h4>Component Stack:</h4>
                                                <pre>{errorInfo.componentStack}</pre>
                                            </>
                                        )}
                                    </div>
                                </details>
                            )}

                            <button
                                onClick={this.resetErrorBoundary}
                                className="feature-flag-retry-button"
                                type="button"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                );
            }

            // Default fallback for non-feature-flag errors
            return (
                <div className="feature-flag-error-boundary" role="alert">
                    <div className="feature-flag-error-content">
                        <h3>Something went wrong</h3>
                        <p>An unexpected error occurred. Please try again.</p>

                        {showDetails && (
                            <details className="feature-flag-error-details">
                                <summary>Error Details (Development)</summary>
                                <pre>{error.message}</pre>
                                <pre>{error.stack}</pre>
                            </details>
                        )}

                        <button
                            onClick={this.resetErrorBoundary}
                            className="feature-flag-retry-button"
                            type="button"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return children;
    }
}

/**
 * Higher-order component for wrapping components with feature flag error boundary
 */
export function withFeatureFlagErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    featureContext?: string,
    fallback?: React.ComponentType<FeatureFlagErrorFallbackProps>
) {
    const WrappedComponent = (props: P) => (
        <FeatureFlagErrorBoundary
            featureContext={featureContext}
            fallback={fallback}
        >
            <Component {...props} />
        </FeatureFlagErrorBoundary>
    );

    WrappedComponent.displayName = `withFeatureFlagErrorBoundary(${Component.displayName || Component.name})`;

    return WrappedComponent;
}

/**
 * Hook for using feature flag error boundary functionality in functional components
 */
export function useFeatureFlagErrorBoundary() {
    const [error, setError] = React.useState<Error | null>(null);

    const resetError = React.useCallback(() => {
        setError(null);
    }, []);

    const captureError = React.useCallback((error: Error) => {
        if (isFeatureFlagRelatedError(error)) {
            console.warn('Feature flag error captured:', error);
            setError(error);
        } else {
            // Re-throw non-feature-flag errors
            throw error;
        }
    }, []);

    return {
        error,
        resetError,
        captureError,
        hasError: error !== null,
        isFeatureFlagError: error ? isFeatureFlagRelatedError(error) : false,
    };
}

export default FeatureFlagErrorBoundary;