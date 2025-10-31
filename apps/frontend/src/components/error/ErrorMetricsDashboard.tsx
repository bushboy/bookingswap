import React, { useState } from 'react';
import { useErrorMetrics } from '@/hooks/useErrorMetrics';

import './ErrorBoundary.css';

/**
 * Development dashboard for viewing error metrics and debugging
 * Only shown in development mode
 */
export const ErrorMetricsDashboard: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { metrics, getErrorSummary, clearErrors } = useErrorMetrics();

    // Only show in development
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    const summary = getErrorSummary();

    const dashboardStyles = {
        position: 'fixed' as const,
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        fontFamily: 'system-ui, -apple-system, sans-serif',
    };

    const toggleButtonStyles = {
        backgroundColor: summary.hasCriticalErrors ? '#dc2626' : summary.hasErrors ? '#ca8a04' : '#16a34a',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        width: '50px',
        height: '50px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 'bold',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    };

    const panelStyles = {
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
        width: '400px',
        maxHeight: '500px',
        overflow: 'auto',
        marginBottom: '10px',
    };

    const headerStyles = {
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        borderRadius: '8px 8px 0 0',
    };

    const contentStyles = {
        padding: '16px',
    };

    const sectionStyles = {
        marginBottom: '16px',
    };

    const statStyles = {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 0',
        fontSize: '14px',
    };

    const buttonStyles = {
        backgroundColor: '#6b7280',
        color: 'white',
        border: 'none',
        padding: '6px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        cursor: 'pointer',
        marginRight: '8px',
    };

    return (
        <div style={dashboardStyles}>
            {isOpen && (
                <div style={panelStyles}>
                    <div style={headerStyles}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Error Metrics</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{ ...buttonStyles, backgroundColor: '#dc2626' }}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    <div style={contentStyles}>
                        {/* Summary */}
                        <div style={sectionStyles}>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>Summary</h4>
                            <div style={statStyles}>
                                <span>Total Errors:</span>
                                <span style={{ fontWeight: 'bold', color: summary.totalErrors > 0 ? '#dc2626' : '#16a34a' }}>
                                    {summary.totalErrors}
                                </span>
                            </div>
                            <div style={statStyles}>
                                <span>Critical Errors:</span>
                                <span style={{ fontWeight: 'bold', color: summary.criticalErrors > 0 ? '#dc2626' : '#16a34a' }}>
                                    {summary.criticalErrors}
                                </span>
                            </div>
                            <div style={statStyles}>
                                <span>Recovery Rate:</span>
                                <span style={{ fontWeight: 'bold', color: summary.recoveryRate > 80 ? '#16a34a' : '#ca8a04' }}>
                                    {summary.recoveryRate}%
                                </span>
                            </div>
                        </div>

                        {/* Errors by Component */}
                        {Object.keys(metrics.errorsByComponent).length > 0 && (
                            <div style={sectionStyles}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>By Component</h4>
                                {Object.entries(metrics.errorsByComponent)
                                    .sort(([, a], [, b]) => b - a)
                                    .slice(0, 5)
                                    .map(([component, count]) => (
                                        <div key={component} style={statStyles}>
                                            <span>{component}:</span>
                                            <span style={{ fontWeight: 'bold' }}>{count}</span>
                                        </div>
                                    ))}
                            </div>
                        )}

                        {/* Errors by Type */}
                        {Object.keys(metrics.errorsByType).length > 0 && (
                            <div style={sectionStyles}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>By Type</h4>
                                {Object.entries(metrics.errorsByType).map(([type, count]) => (
                                    <div key={type} style={statStyles}>
                                        <span>{type.replace('_', ' ')}:</span>
                                        <span style={{ fontWeight: 'bold' }}>{count}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Top Error Messages */}
                        {metrics.topErrorMessages.length > 0 && (
                            <div style={sectionStyles}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>Top Messages</h4>
                                {metrics.topErrorMessages.slice(0, 3).map((error, index) => (
                                    <div key={index} style={{ ...statStyles, flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>
                                            Count: {error.count}
                                        </div>
                                        <div style={{ fontSize: '12px', wordBreak: 'break-word' }}>
                                            {error.message.length > 60 ? `${error.message.substring(0, 60)}...` : error.message}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Actions */}
                        <div style={sectionStyles}>
                            <button onClick={clearErrors} style={buttonStyles}>
                                Clear Errors
                            </button>
                            <button
                                onClick={() => console.log('Full metrics:', metrics)}
                                style={buttonStyles}
                            >
                                Log to Console
                            </button>
                        </div>

                        {/* Last Error */}
                        {metrics.lastError && (
                            <div style={sectionStyles}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>Last Error</h4>
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    <div><strong>Component:</strong> {metrics.lastError.componentName}</div>
                                    <div><strong>Type:</strong> {metrics.lastError.errorType}</div>
                                    <div><strong>Severity:</strong> {metrics.lastError.severity}</div>
                                    <div><strong>Time:</strong> {metrics.lastError.timestamp.toLocaleTimeString()}</div>
                                    <div><strong>Message:</strong> {metrics.lastError.errorMessage}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                style={toggleButtonStyles}
                title={`Errors: ${summary.totalErrors} | Critical: ${summary.criticalErrors}`}
            >
                {summary.hasCriticalErrors ? '🚨' : summary.hasErrors ? '⚠️' : '✅'}
                <br />
                {summary.totalErrors}
            </button>
        </div>
    );
};

export default ErrorMetricsDashboard;