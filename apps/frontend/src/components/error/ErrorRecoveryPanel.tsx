import React, { useState, useEffect } from 'react';
import { errorRecoveryService, RecoveryStrategy, RecoveryResult } from '@/services/errorRecoveryService';
import { errorLoggingService } from '@/services/errorLoggingService';
import './ErrorRecovery.css';

/**
 * Props for the ErrorRecoveryPanel component
 */
interface ErrorRecoveryPanelProps {
    /** Name of the component that errored */
    componentName: string;
    /** The error that occurred */
    error: Error;
    /** Error ID for tracking */
    errorId?: string;
    /** Callback when recovery is successful */
    onRecoverySuccess?: () => void;
    /** Callback when recovery fails */
    onRecoveryFailure?: (error: string) => void;
    /** Whether to show advanced options */
    showAdvanced?: boolean;
}

/**
 * User-friendly error recovery panel with multiple recovery strategies
 */
export const ErrorRecoveryPanel: React.FC<ErrorRecoveryPanelProps> = ({
    componentName,
    error,
    errorId,
    onRecoverySuccess,
    onRecoveryFailure,
    showAdvanced = false,
}) => {
    const [recoveryOptions, setRecoveryOptions] = useState(errorRecoveryService.getRecoveryOptions(componentName));
    const [isRecovering, setIsRecovering] = useState(false);
    const [recoveryResults, setRecoveryResults] = useState<RecoveryResult[]>([]);
    const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [autoRecoveryEnabled, setAutoRecoveryEnabled] = useState(true);

    useEffect(() => {
        // Load recovery history
        const history = errorRecoveryService.getRecoveryHistory(componentName);
        setRecoveryResults(history);

        // Auto-recovery for low-risk strategies
        if (autoRecoveryEnabled && history.length === 0) {
            const lowRiskStrategy = recoveryOptions.strategies.find(s => s.riskLevel === 'low');
            if (lowRiskStrategy) {
                handleRecovery(lowRiskStrategy.name, true);
            }
        }
    }, [componentName, autoRecoveryEnabled, recoveryOptions.strategies]);

    const handleRecovery = async (strategyName: string, isAutomatic = false) => {
        setIsRecovering(true);
        setSelectedStrategy(strategyName);

        try {
            const result = await errorRecoveryService.executeRecovery(
                componentName,
                strategyName,
                errorId
            );

            setRecoveryResults(prev => [result, ...prev]);

            if (result.success) {
                errorLoggingService.trackUserAction('recovery_success', {
                    component: componentName,
                    strategy: strategyName,
                    automatic: isAutomatic,
                });

                if (onRecoverySuccess) {
                    onRecoverySuccess();
                }
            } else {
                errorLoggingService.trackUserAction('recovery_failure', {
                    component: componentName,
                    strategy: strategyName,
                    automatic: isAutomatic,
                    error: result.message,
                });

                if (onRecoveryFailure) {
                    onRecoveryFailure(result.message);
                }
            }
        } catch (recoveryError) {
            const errorMessage = recoveryError instanceof Error ? recoveryError.message : 'Unknown error';

            if (onRecoveryFailure) {
                onRecoveryFailure(errorMessage);
            }
        } finally {
            setIsRecovering(false);
            setSelectedStrategy(null);
        }
    };

    const getStrategyIcon = (riskLevel: string): string => {
        switch (riskLevel) {
            case 'low': return '🟢';
            case 'medium': return '🟡';
            case 'high': return '🔴';
            default: return '⚪';
        }
    };

    const getResultIcon = (success: boolean): string => {
        return success ? '✅' : '❌';
    };

    const successRate = errorRecoveryService.getRecoverySuccessRate(componentName);

    return (
        <div className="error-recovery-panel">
            <div className="recovery-header">
                <h3>Recovery Options</h3>
                <div className="recovery-stats">
                    {recoveryResults.length > 0 && (
                        <span className="success-rate">
                            Success Rate: {(successRate * 100).toFixed(0)}%
                        </span>
                    )}
                </div>
            </div>

            <div className="recovery-message">
                <p>{recoveryOptions.fallbackMessage}</p>
            </div>

            <div className="recovery-strategies">
                {recoveryOptions.strategies.map((strategy) => (
                    <div key={strategy.name} className={`recovery-strategy ${strategy.riskLevel}-risk`}>
                        <div className="strategy-header">
                            <span className="strategy-icon">{getStrategyIcon(strategy.riskLevel)}</span>
                            <span className="strategy-name">{strategy.userFriendlyName}</span>
                            <span className="strategy-risk">{strategy.riskLevel} risk</span>
                        </div>

                        <p className="strategy-description">{strategy.description}</p>

                        <button
                            onClick={() => handleRecovery(strategy.name)}
                            disabled={isRecovering}
                            className={`recovery-button ${strategy.riskLevel}-risk ${selectedStrategy === strategy.name ? 'active' : ''
                                }`}
                            type="button"
                        >
                            {isRecovering && selectedStrategy === strategy.name ? (
                                <>
                                    <span className="spinner">⏳</span>
                                    Trying...
                                </>
                            ) : (
                                `Try ${strategy.userFriendlyName}`
                            )}
                        </button>
                    </div>
                ))}
            </div>

            {recoveryResults.length > 0 && (
                <div className="recovery-history-section">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="history-toggle"
                        type="button"
                    >
                        {showHistory ? '▼' : '▶'} Recovery History ({recoveryResults.length})
                    </button>

                    {showHistory && (
                        <div className="recovery-history">
                            {recoveryResults.slice(0, 5).map((result, index) => (
                                <div key={index} className={`recovery-result ${result.success ? 'success' : 'failure'}`}>
                                    <div className="result-header">
                                        <span className="result-icon">{getResultIcon(result.success)}</span>
                                        <span className="result-strategy">{result.strategyUsed}</span>
                                        <span className="result-time">
                                            {result.timestamp.toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <div className="result-message">{result.message}</div>
                                    <div className="result-timing">
                                        Recovery time: {result.recoveryTime}ms
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showAdvanced && (
                <div className="recovery-advanced">
                    <details className="advanced-options">
                        <summary>Advanced Options</summary>

                        <div className="advanced-content">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={autoRecoveryEnabled}
                                    onChange={(e) => setAutoRecoveryEnabled(e.target.checked)}
                                />
                                Enable automatic recovery for low-risk strategies
                            </label>

                            <div className="error-details">
                                <h4>Error Information</h4>
                                <div className="error-info-grid">
                                    <div className="info-item">
                                        <strong>Component:</strong> {componentName}
                                    </div>
                                    <div className="info-item">
                                        <strong>Error Type:</strong> {error.name}
                                    </div>
                                    <div className="info-item">
                                        <strong>Message:</strong> {error.message}
                                    </div>
                                    {errorId && (
                                        <div className="info-item">
                                            <strong>Error ID:</strong> {errorId}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="recovery-actions">
                                <button
                                    onClick={() => {
                                        errorLoggingService.clearSessionErrors();
                                        setRecoveryResults([]);
                                    }}
                                    className="clear-history-button"
                                    type="button"
                                >
                                    Clear Recovery History
                                </button>

                                <button
                                    onClick={() => {
                                        const report = {
                                            component: componentName,
                                            error: error.message,
                                            recoveryAttempts: recoveryResults.length,
                                            successRate: successRate,
                                            timestamp: new Date().toISOString(),
                                        };
                                        console.log('Recovery Report:', report);
                                        navigator.clipboard?.writeText(JSON.stringify(report, null, 2));
                                    }}
                                    className="export-report-button"
                                    type="button"
                                >
                                    Copy Recovery Report
                                </button>
                            </div>
                        </div>
                    </details>
                </div>
            )}

            <div className="recovery-footer">
                <small>
                    If none of these options work, try refreshing the page or contact support.
                </small>
            </div>
        </div>
    );
};

export default ErrorRecoveryPanel;