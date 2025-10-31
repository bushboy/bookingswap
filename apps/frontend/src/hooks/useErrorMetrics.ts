import { useState, useEffect } from 'react';
import { errorLoggingService, ErrorMetrics, ErrorType, ErrorSeverity } from '@/services/errorLoggingService';

/**
 * Hook for accessing error metrics and logging functionality
 */
export const useErrorMetrics = () => {
    const [metrics, setMetrics] = useState<ErrorMetrics>(errorLoggingService.getMetrics());

    useEffect(() => {
        // Update metrics periodically
        const interval = setInterval(() => {
            setMetrics(errorLoggingService.getMetrics());
        }, 5000); // Update every 5 seconds

        return () => clearInterval(interval);
    }, []);

    /**
     * Track a user action for error context
     */
    const trackUserAction = (type: string, details?: Record<string, any>) => {
        errorLoggingService.trackUserAction(type, details);
    };

    /**
     * Get errors for a specific component
     */
    const getComponentErrors = (componentName: string) => {
        return errorLoggingService.getErrorsByComponent(componentName);
    };

    /**
     * Get errors by type
     */
    const getErrorsByType = (type: ErrorType) => {
        return errorLoggingService.getErrorsByType(type);
    };

    /**
     * Record a recovery attempt
     */
    const recordRecovery = (errorId: string, success: boolean, recoveryTime?: number) => {
        errorLoggingService.recordRecoveryAttempt(errorId, success, recoveryTime);
        // Update metrics immediately after recording recovery
        setMetrics(errorLoggingService.getMetrics());
    };

    /**
     * Clear session errors (useful for testing/debugging)
     */
    const clearErrors = () => {
        errorLoggingService.clearSessionErrors();
        setMetrics(errorLoggingService.getMetrics());
    };

    /**
     * Get error summary for display
     */
    const getErrorSummary = () => {
        const { totalErrors, errorsByComponent, errorsBySeverity, recoverySuccessRate } = metrics;

        const topComponent = Object.entries(errorsByComponent)
            .sort(([, a], [, b]) => b - a)[0];

        const criticalErrors = errorsBySeverity[ErrorSeverity.CRITICAL] || 0;
        const highErrors = errorsBySeverity[ErrorSeverity.HIGH] || 0;

        return {
            totalErrors,
            topErrorComponent: topComponent ? topComponent[0] : null,
            topErrorCount: topComponent ? topComponent[1] : 0,
            criticalErrors,
            highErrors,
            recoveryRate: Math.round(recoverySuccessRate * 100),
            hasErrors: totalErrors > 0,
            hasCriticalErrors: criticalErrors > 0,
        };
    };

    return {
        metrics,
        trackUserAction,
        getComponentErrors,
        getErrorsByType,
        recordRecovery,
        clearErrors,
        getErrorSummary,
    };
};

export default useErrorMetrics;