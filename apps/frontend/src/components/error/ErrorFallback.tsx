import React, { useState } from 'react';
import { ErrorFallbackProps } from './ComponentErrorBoundary';
import { errorLoggingService } from '@/services/errorLoggingService';
import ErrorRecoveryPanel from './ErrorRecoveryPanel';
import './ErrorBoundary.css';

/**
 * Generic error fallback component for general component errors
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
    error,
    resetError,
    componentName = 'Component',
    errorInfo,
}) => {
    const [isReporting, setIsReporting] = useState(false);
    const [reportSent, setReportSent] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [showDetails, setShowDetails] = useState(false);

    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
        errorLoggingService.trackUserAction('error_retry', {
            component: componentName,
            retryCount: retryCount + 1,
        });
        resetError();
    };

    const handleResetComponent = () => {
        errorLoggingService.trackUserAction('error_reset', {
            component: componentName,
        });

        // Clear any cached data or state related to this component
        if (componentName && window.localStorage) {
            const keysToRemove = Object.keys(localStorage).filter(key =>
                key.toLowerCase().includes(componentName.toLowerCase())
            );
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }

        // Force a hard reset
        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    const handleReportIssue = async () => {
        setIsReporting(true);

        try {
            const errorReport = {
                component: componentName,
                error: error.message,
                stack: error.stack,
                componentStack: errorInfo?.componentStack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                userId: getCurrentUserId(),
                sessionId: getSessionId(),
                retryCount,
                userActions: await getUserRecentActions(),
            };

            // Track the report action
            errorLoggingService.trackUserAction('error_report', {
                component: componentName,
                errorMessage: error.message,
            });

            // In production, this would send to an error reporting service
            await sendErrorReport(errorReport);

            setReportSent(true);

            // Show success message
            setTimeout(() => {
                setReportSent(false);
            }, 3000);

        } catch (reportError) {
            console.error('Failed to send error report:', reportError);
            alert('Failed to send error report. Please try again or contact support directly.');
        } finally {
            setIsReporting(false);
        }
    };

    const getCurrentUserId = (): string | null => {
        try {
            const user = localStorage.getItem('user');
            return user ? JSON.parse(user).id : null;
        } catch {
            return null;
        }
    };

    const getSessionId = (): string => {
        let sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    };

    const getUserRecentActions = async (): Promise<any[]> => {
        // Get recent user actions from the error logging service
        try {
            const metrics = errorLoggingService.getMetrics();
            return metrics.sessionErrors.slice(-5).map(error => ({
                timestamp: error.timestamp,
                component: error.componentName,
                action: 'error_occurred',
                details: { message: error.errorMessage },
            }));
        } catch {
            return [];
        }
    };

    const sendErrorReport = async (report: any): Promise<void> => {
        // Simulate API call - in production, this would send to your error reporting service
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.1) { // 90% success rate simulation
                    console.log('Error report sent:', report);
                    resolve();
                } else {
                    reject(new Error('Network error'));
                }
            }, 1000);
        });
    };

    return (
        <div className="error-boundary-fallback" role="alert">
            <div className="error-boundary-content">
                <div className="error-icon">⚠️</div>
                <h2>Oops! Something went wrong</h2>
                <p>
                    The {componentName} component encountered an unexpected error and couldn't render properly.
                </p>

                {reportSent && (
                    <div className="error-success-message">
                        ✅ Error report sent successfully! Our team will investigate this issue.
                    </div>
                )}

                <div className="error-actions">
                    <button
                        onClick={handleRetry}
                        className="error-boundary-retry-button primary"
                        type="button"
                        disabled={isReporting}
                    >
                        🔄 Try Again {retryCount > 0 && `(${retryCount})`}
                    </button>

                    <button
                        onClick={handleResetComponent}
                        className="error-boundary-reset-button secondary"
                        type="button"
                        disabled={isReporting}
                        title="This will refresh the page and clear any cached data"
                    >
                        🔧 Reset Component
                    </button>

                    <button
                        onClick={handleReportIssue}
                        className="error-boundary-report-button tertiary"
                        type="button"
                        disabled={isReporting || reportSent}
                    >
                        {isReporting ? '📤 Sending...' : reportSent ? '✅ Reported' : '📋 Report Issue'}
                    </button>
                </div>

                {/* Enhanced Recovery Panel */}
                <ErrorRecoveryPanel
                    componentName={componentName}
                    error={error}
                    onRecoverySuccess={() => {
                        errorLoggingService.trackUserAction('recovery_panel_success', {
                            component: componentName,
                        });
                        resetError();
                    }}
                    onRecoveryFailure={(errorMessage) => {
                        errorLoggingService.trackUserAction('recovery_panel_failure', {
                            component: componentName,
                            error: errorMessage,
                        });
                    }}
                    showAdvanced={process.env.NODE_ENV === 'development'}
                />

                <div className="error-help-section">
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="error-details-toggle"
                        type="button"
                    >
                        {showDetails ? '▼ Hide Details' : '▶ Show Details'}
                    </button>
                </div>

                {showDetails && (
                    <div className="error-details-expanded">
                        <div className="error-info">
                            <h4>What happened?</h4>
                            <p>
                                The {componentName} component failed to render due to an unexpected error.
                                This could be caused by invalid data, network issues, or a bug in the code.
                            </p>

                            <h4>What can you do?</h4>
                            <ul>
                                <li><strong>Try Again:</strong> Click the retry button to attempt loading the component again</li>
                                <li><strong>Reset Component:</strong> Clear any cached data and refresh the page</li>
                                <li><strong>Report Issue:</strong> Send details to our team so we can fix the problem</li>
                                <li><strong>Continue:</strong> Other parts of the application should still work normally</li>
                            </ul>

                            {process.env.NODE_ENV === 'development' && (
                                <details className="error-technical-details">
                                    <summary>Technical Details (Development Only)</summary>
                                    <div className="technical-info">
                                        <h5>Error Message:</h5>
                                        <pre>{error.message}</pre>

                                        <h5>Stack Trace:</h5>
                                        <pre>{error.stack}</pre>

                                        {errorInfo && (
                                            <>
                                                <h5>Component Stack:</h5>
                                                <pre>{errorInfo.componentStack}</pre>
                                            </>
                                        )}

                                        <h5>Debug Info:</h5>
                                        <pre>{JSON.stringify({
                                            component: componentName,
                                            timestamp: new Date().toISOString(),
                                            url: window.location.href,
                                            userAgent: navigator.userAgent,
                                            retryCount,
                                        }, null, 2)}</pre>
                                    </div>
                                </details>
                            )}
                        </div>
                    </div>
                )}

                <div className="error-footer">
                    <small>
                        Error ID: {error.name}_{Date.now().toString(36)} |
                        Time: {new Date().toLocaleTimeString()}
                    </small>
                </div>
            </div>
        </div>
    );
};

export default ErrorFallback;