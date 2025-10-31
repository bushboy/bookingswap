import React, { useState, useEffect } from 'react';
import { errorLoggingService, ErrorMetrics, ErrorDetails, ErrorType, ErrorSeverity } from '@/services/errorLoggingService';
import './ErrorMonitoring.css';

/**
 * Props for the ErrorMonitoringDashboard component
 */
interface ErrorMonitoringDashboardProps {
    /** Whether to show detailed error information */
    showDetails?: boolean;
    /** Refresh interval in milliseconds */
    refreshInterval?: number;
    /** Maximum number of recent errors to display */
    maxRecentErrors?: number;
}

/**
 * Error monitoring dashboard for development and debugging
 */
export const ErrorMonitoringDashboard: React.FC<ErrorMonitoringDashboardProps> = ({
    showDetails = true,
    refreshInterval = 5000,
    maxRecentErrors = 10,
}) => {
    const [metrics, setMetrics] = useState<ErrorMetrics | null>(null);
    const [selectedError, setSelectedError] = useState<ErrorDetails | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const updateMetrics = () => {
            const currentMetrics = errorLoggingService.getMetrics();
            setMetrics(currentMetrics);
        };

        // Initial load
        updateMetrics();

        // Set up refresh interval
        const interval = setInterval(updateMetrics, refreshInterval);

        return () => clearInterval(interval);
    }, [refreshInterval]);

    if (!metrics) {
        return <div className="error-monitoring-loading">Loading error metrics...</div>;
    }

    const recentErrors = metrics.sessionErrors.slice(-maxRecentErrors).reverse();

    return (
        <div className="error-monitoring-dashboard">
            <div className="error-monitoring-header">
                <h3>Error Monitoring Dashboard</h3>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="error-monitoring-toggle"
                    type="button"
                >
                    {isExpanded ? 'Collapse' : 'Expand'}
                </button>
            </div>

            {isExpanded && (
                <div className="error-monitoring-content">
                    {/* Summary Statistics */}
                    <div className="error-metrics-summary">
                        <div className="metric-card">
                            <h4>Total Errors</h4>
                            <span className="metric-value">{metrics.totalErrors}</span>
                        </div>
                        <div className="metric-card">
                            <h4>Recovery Rate</h4>
                            <span className="metric-value">
                                {(metrics.recoverySuccessRate * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="metric-card">
                            <h4>Avg Recovery Time</h4>
                            <span className="metric-value">
                                {metrics.averageRecoveryTime.toFixed(0)}ms
                            </span>
                        </div>
                        <div className="metric-card">
                            <h4>Session Errors</h4>
                            <span className="metric-value">{metrics.sessionErrors.length}</span>
                        </div>
                    </div>

                    {/* Error Breakdown Charts */}
                    <div className="error-breakdown">
                        <div className="breakdown-section">
                            <h4>Errors by Component</h4>
                            <div className="breakdown-list">
                                {Object.entries(metrics.errorsByComponent).map(([component, count]) => (
                                    <div key={component} className="breakdown-item">
                                        <span className="breakdown-label">{component}</span>
                                        <span className="breakdown-count">{count}</span>
                                        <div
                                            className="breakdown-bar"
                                            style={{
                                                width: `${(count / Math.max(...Object.values(metrics.errorsByComponent))) * 100}%`
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="breakdown-section">
                            <h4>Errors by Type</h4>
                            <div className="breakdown-list">
                                {Object.entries(metrics.errorsByType).map(([type, count]) => (
                                    <div key={type} className="breakdown-item">
                                        <span className="breakdown-label">{type.replace('_', ' ')}</span>
                                        <span className="breakdown-count">{count}</span>
                                        <div
                                            className="breakdown-bar"
                                            style={{
                                                width: `${(count / Math.max(...Object.values(metrics.errorsByType))) * 100}%`
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="breakdown-section">
                            <h4>Errors by Severity</h4>
                            <div className="breakdown-list">
                                {Object.entries(metrics.errorsBySeverity).map(([severity, count]) => (
                                    <div key={severity} className="breakdown-item">
                                        <span className={`breakdown-label severity-${severity}`}>
                                            {severity.toUpperCase()}
                                        </span>
                                        <span className="breakdown-count">{count}</span>
                                        <div
                                            className={`breakdown-bar severity-${severity}`}
                                            style={{
                                                width: `${(count / Math.max(...Object.values(metrics.errorsBySeverity))) * 100}%`
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Top Error Messages */}
                    {metrics.topErrorMessages.length > 0 && (
                        <div className="top-errors-section">
                            <h4>Most Common Error Messages</h4>
                            <div className="top-errors-list">
                                {metrics.topErrorMessages.slice(0, 5).map((errorMsg, index) => (
                                    <div key={index} className="top-error-item">
                                        <span className="error-rank">#{index + 1}</span>
                                        <span className="error-message">{errorMsg.message}</span>
                                        <span className="error-count">{errorMsg.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Errors */}
                    {recentErrors.length > 0 && (
                        <div className="recent-errors-section">
                            <h4>Recent Errors</h4>
                            <div className="recent-errors-list">
                                {recentErrors.map((error) => (
                                    <div
                                        key={error.errorId}
                                        className={`recent-error-item severity-${error.severity}`}
                                        onClick={() => setSelectedError(error)}
                                    >
                                        <div className="error-summary">
                                            <span className="error-component">{error.componentName}</span>
                                            <span className="error-type">{error.errorType}</span>
                                            <span className="error-time">
                                                {error.timestamp.toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="error-message-preview">
                                            {error.errorMessage.substring(0, 100)}
                                            {error.errorMessage.length > 100 && '...'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error Details Modal */}
                    {selectedError && showDetails && (
                        <div className="error-details-modal">
                            <div className="error-details-content">
                                <div className="error-details-header">
                                    <h4>Error Details</h4>
                                    <button
                                        onClick={() => setSelectedError(null)}
                                        className="error-details-close"
                                        type="button"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="error-details-body">
                                    <div className="error-detail-section">
                                        <h5>Basic Information</h5>
                                        <div className="error-detail-grid">
                                            <div className="error-detail-item">
                                                <strong>Error ID:</strong> {selectedError.errorId}
                                            </div>
                                            <div className="error-detail-item">
                                                <strong>Component:</strong> {selectedError.componentName}
                                            </div>
                                            <div className="error-detail-item">
                                                <strong>Type:</strong> {selectedError.errorType}
                                            </div>
                                            <div className="error-detail-item">
                                                <strong>Severity:</strong> {selectedError.severity}
                                            </div>
                                            <div className="error-detail-item">
                                                <strong>Timestamp:</strong> {selectedError.timestamp.toLocaleString()}
                                            </div>
                                            <div className="error-detail-item">
                                                <strong>Recovery Attempts:</strong> {selectedError.recoveryAttempts || 0}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="error-detail-section">
                                        <h5>Error Message</h5>
                                        <pre className="error-message-full">{selectedError.errorMessage}</pre>
                                    </div>

                                    {selectedError.errorStack && (
                                        <div className="error-detail-section">
                                            <h5>Stack Trace</h5>
                                            <pre className="error-stack">{selectedError.errorStack}</pre>
                                        </div>
                                    )}

                                    {selectedError.componentStack && (
                                        <div className="error-detail-section">
                                            <h5>Component Stack</h5>
                                            <pre className="error-component-stack">{selectedError.componentStack}</pre>
                                        </div>
                                    )}

                                    {selectedError.userActions && selectedError.userActions.length > 0 && (
                                        <div className="error-detail-section">
                                            <h5>User Actions Leading to Error</h5>
                                            <div className="user-actions-list">
                                                {selectedError.userActions.map((action, index) => (
                                                    <div key={index} className="user-action-item">
                                                        <span className="action-type">{action.type}</span>
                                                        <span className="action-time">
                                                            {action.timestamp.toLocaleTimeString()}
                                                        </span>
                                                        {action.details && (
                                                            <pre className="action-details">
                                                                {JSON.stringify(action.details, null, 2)}
                                                            </pre>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedError.context && (
                                        <div className="error-detail-section">
                                            <h5>Additional Context</h5>
                                            <pre className="error-context">
                                                {JSON.stringify(selectedError.context, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ErrorMonitoringDashboard;