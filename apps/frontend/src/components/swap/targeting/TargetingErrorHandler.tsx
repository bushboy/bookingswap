import React from 'react';
import { TargetingRestriction } from '@booking-swap/shared';
import './targeting-display.module.css';

/**
 * Enhanced targeting restriction with error handling properties
 */
interface EnhancedTargetingRestriction extends TargetingRestriction {
    userFriendlyMessage?: string;
    recoveryAction?: string;
    affectedSwapIds?: string[];
}

/**
 * Props for the TargetingErrorHandler component
 */
interface TargetingErrorHandlerProps {
    restrictions: (TargetingRestriction | EnhancedTargetingRestriction)[];
    onRetry?: () => void;
    onRefresh?: () => void;
    className?: string;
}



/**
 * Get user-friendly message from restriction
 */
function getUserFriendlyMessage(restriction: TargetingRestriction | EnhancedTargetingRestriction): string {
    const enhanced = restriction as EnhancedTargetingRestriction;
    if (enhanced.userFriendlyMessage) {
        return enhanced.userFriendlyMessage;
    }
    return restriction.message;
}

/**
 * Get recovery action from restriction
 */
function getRecoveryAction(restriction: TargetingRestriction | EnhancedTargetingRestriction): string | undefined {
    const enhanced = restriction as EnhancedTargetingRestriction;
    return enhanced.recoveryAction;
}

/**
 * Get user-friendly text for recovery actions
 */
function getRecoveryActionText(action: string): string {
    switch (action) {
        case 'refresh_page':
            return 'Refresh Page';
        case 'refresh_data':
            return 'Refresh Data';
        case 'retry':
            return 'Try Again';
        case 'contact_support':
            return 'Contact Support';
        default:
            return 'Try Again';
    }
}

/**
 * Error display component for targeting-related issues
 * Requirements: 3.5, 3.6
 */
export const TargetingErrorHandler: React.FC<TargetingErrorHandlerProps> = ({
    restrictions,
    onRetry,
    onRefresh,
    className = ''
}) => {
    if (!restrictions || restrictions.length === 0) {
        return null;
    }

    const handleRecoveryAction = (action?: string) => {
        switch (action) {
            case 'refresh_page':
            case 'refresh_data':
                if (onRefresh) {
                    onRefresh();
                } else {
                    window.location.reload();
                }
                break;
            case 'retry':
                if (onRetry) {
                    onRetry();
                }
                break;
            case 'contact_support':
                // Could open a support modal or redirect to support page
                console.log('Contact support action triggered');
                break;
            default:
                if (onRetry) {
                    onRetry();
                }
        }
    };

    const getIconForSeverity = (severity: 'error' | 'warning') => {
        switch (severity) {
            case 'error':
                return '⚠️';
            case 'warning':
                return '⚡';

            default:
                return '⚠️';
        }
    };

    const getColorForSeverity = (severity: 'error' | 'warning') => {
        switch (severity) {
            case 'error':
                return '#ef4444'; // red
            case 'warning':
                return '#f59e0b'; // amber

            default:
                return '#6b7280'; // gray
        }
    };

    // Group restrictions by severity
    const errorRestrictions = restrictions.filter(r => r.severity === 'error');
    const warningRestrictions = restrictions.filter(r => r.severity === 'warning');

    return (
        <div className={`targeting-error-handler ${className}`}>
            {/* Error messages */}
            {errorRestrictions.length > 0 && (
                <div className="targeting-error-section error">
                    {errorRestrictions.map((restriction, index) => (
                        <div key={index} className="targeting-error-item">
                            <div className="targeting-error-content">
                                <span
                                    className="targeting-error-icon"
                                    style={{ color: getColorForSeverity(restriction.severity) }}
                                >
                                    {getIconForSeverity(restriction.severity)}
                                </span>
                                <div className="targeting-error-text">
                                    <p className="targeting-error-message">
                                        {getUserFriendlyMessage(restriction)}
                                    </p>
                                    {getRecoveryAction(restriction) && (
                                        <button
                                            className="targeting-error-action"
                                            onClick={() => handleRecoveryAction(getRecoveryAction(restriction))}
                                        >
                                            {getRecoveryActionText(getRecoveryAction(restriction)!)}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Warning messages */}
            {warningRestrictions.length > 0 && (
                <div className="targeting-error-section warning">
                    {warningRestrictions.map((restriction, index) => (
                        <div key={index} className="targeting-error-item">
                            <div className="targeting-error-content">
                                <span
                                    className="targeting-error-icon"
                                    style={{ color: getColorForSeverity(restriction.severity) }}
                                >
                                    {getIconForSeverity(restriction.severity)}
                                </span>
                                <div className="targeting-error-text">
                                    <p className="targeting-error-message">
                                        {getUserFriendlyMessage(restriction)}
                                    </p>
                                    {getRecoveryAction(restriction) && (
                                        <button
                                            className="targeting-error-action"
                                            onClick={() => handleRecoveryAction(getRecoveryAction(restriction))}
                                        >
                                            {getRecoveryActionText(getRecoveryAction(restriction)!)}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}


        </div>
    );
};

/**
 * Fallback error display for critical targeting failures
 * Requirements: 3.5, 3.6
 */
export const TargetingFallbackDisplay: React.FC<{
    swapId: string;
    onRetry?: () => void;
    className?: string;
}> = ({ onRetry, className = '' }) => {
    return (
        <div className={`targeting-fallback-display ${className}`}>
            <div className="targeting-fallback-content">
                <div className="targeting-fallback-icon">⚠️</div>
                <div className="targeting-fallback-text">
                    <h4>Targeting Information Unavailable</h4>
                    <p>
                        We're having trouble loading targeting information for this swap.
                        This doesn't affect your ability to use other features.
                    </p>
                    {onRetry && (
                        <button
                            className="targeting-fallback-retry"
                            onClick={onRetry}
                        >
                            Try Loading Again
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Partial data warning component
 * Requirements: 3.5, 3.6
 */
export const TargetingPartialDataWarning: React.FC<{
    missingDataTypes: string[];
    onRefresh?: () => void;
    className?: string;
}> = ({ missingDataTypes, onRefresh, className = '' }) => {
    if (!missingDataTypes || missingDataTypes.length === 0) {
        return null;
    }

    return (
        <div className={`targeting-partial-warning ${className}`}>
            <div className="targeting-partial-content">
                <span className="targeting-partial-icon">⚡</span>
                <div className="targeting-partial-text">
                    <p>
                        Some targeting information may be incomplete
                        ({missingDataTypes.join(', ')}).
                    </p>
                    {onRefresh && (
                        <button
                            className="targeting-partial-refresh"
                            onClick={onRefresh}
                        >
                            Refresh
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TargetingErrorHandler;