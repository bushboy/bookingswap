import React, { useState, useCallback } from 'react';
import { Button } from './Button';
import { Card, CardContent } from './Card';
import { LoadingSpinner } from './LoadingIndicator';
import { tokens } from '../../design-system/tokens';
// No imports needed from errorRecoveryService for now

/**
 * Props for the enhanced error message with recovery mechanisms
 */
export interface EnhancedErrorMessageProps {
  error: string | Error;
  title?: string;
  operationName: string;
  onRetry?: () => Promise<void>;
  onManualRetry?: () => Promise<void>;
  onDismiss?: () => void;
  className?: string;
  showCircuitBreakerInfo?: boolean;
}

/**
 * Enhanced error message component with comprehensive recovery mechanisms
 */
export const EnhancedErrorMessage: React.FC<EnhancedErrorMessageProps> = ({
  error,
  title = 'Error',
  operationName: _operationName,
  onRetry,
  onManualRetry,
  onDismiss,
  className = '',
  showCircuitBreakerInfo = true,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isManualRetrying, setIsManualRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastRetryTime, setLastRetryTime] = useState<number | null>(null);

  const errorMessage = typeof error === 'string' ? error : error.message;

  // Update retry tracking
  const updateRetryTracking = useCallback((success: boolean) => {
    if (success) {
      setRetryCount(0);
      setLastRetryTime(null);
    } else {
      setRetryCount(prev => prev + 1);
      setLastRetryTime(Date.now());
    }
  }, []);

  // Handle automatic retry with exponential backoff
  const handleRetry = useCallback(async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry();
      updateRetryTracking(true);
    } catch (error) {
      console.error('Retry failed:', error);
      updateRetryTracking(false);
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry, isRetrying, updateRetryTracking]);

  // Handle manual retry
  const handleManualRetry = useCallback(async () => {
    if (!onManualRetry || isManualRetrying) return;

    setIsManualRetrying(true);
    try {
      await onManualRetry();
      updateRetryTracking(true);
    } catch (error) {
      console.error('Manual retry failed:', error);
      updateRetryTracking(false);
    } finally {
      setIsManualRetrying(false);
    }
  }, [onManualRetry, isManualRetrying, updateRetryTracking]);

  // Reset retry tracking
  const handleResetRetries = useCallback(() => {
    setRetryCount(0);
    setLastRetryTime(null);
  }, []);

  // Get retry status info
  const getRetryStatusInfo = () => {
    if (retryCount === 0) return null;

    const now = Date.now();
    const timeSinceLastRetry = lastRetryTime ? now - lastRetryTime : 0;
    const shouldWait = timeSinceLastRetry < 5000; // Wait 5 seconds between retries

    if (retryCount >= 3) {
      return {
        status: 'Multiple Retry Attempts',
        message: `${retryCount} attempts failed. Consider trying a different recovery option.`,
        color: tokens.colors.warning,
        icon: '⚠️',
        canRetry: !shouldWait,
      };
    }

    if (shouldWait) {
      const waitTime = Math.ceil((5000 - timeSinceLastRetry) / 1000);
      return {
        status: 'Retry Cooldown',
        message: `Please wait ${waitTime} seconds before trying again.`,
        color: tokens.colors.blue,
        icon: '⏱️',
        canRetry: false,
      };
    }

    return {
      status: 'Ready to Retry',
      message: `Previous attempts: ${retryCount}. You can try again.`,
      color: tokens.colors.blue,
      icon: '🔄',
      canRetry: true,
    };
  };

  const retryStatusInfo = getRetryStatusInfo();
  const canRetry = !retryStatusInfo || retryStatusInfo.canRetry;

  return (
    <Card
      variant="outlined"
      className={className}
      style={{
        backgroundColor: tokens.colors.error[50],
        borderColor: tokens.colors.error[200],
        marginBottom: tokens.spacing[4],
      }}
    >
      <CardContent style={{ padding: tokens.spacing[4] }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: tokens.spacing[3],
        }}>
          <div style={{
            fontSize: '20px',
            marginTop: tokens.spacing[1],
          }}>
            ❌
          </div>

          <div style={{ flex: 1 }}>
            <h4 style={{
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.error[800],
              margin: `0 0 ${tokens.spacing[2]} 0`,
            }}>
              {title}
            </h4>

            <p style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.error[700],
              margin: `0 0 ${tokens.spacing[3]} 0`,
              lineHeight: 1.5,
            }}>
              {errorMessage}
            </p>

            {/* Retry Status Information */}
            {showCircuitBreakerInfo && retryStatusInfo && (
              <div style={{
                backgroundColor: retryStatusInfo.color[50],
                border: `1px solid ${retryStatusInfo.color[200]}`,
                borderRadius: tokens.borderRadius.md,
                padding: tokens.spacing[3],
                marginBottom: tokens.spacing[3],
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[2],
                  marginBottom: tokens.spacing[1],
                }}>
                  <span style={{ fontSize: '16px' }}>
                    {retryStatusInfo.icon}
                  </span>
                  <span style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: retryStatusInfo.color[800],
                  }}>
                    {retryStatusInfo.status}
                  </span>
                </div>
                <p style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: retryStatusInfo.color[700],
                  margin: 0,
                }}>
                  {retryStatusInfo.message}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: tokens.spacing[2],
              flexWrap: 'wrap',
            }}>
              {/* Automatic Retry with Exponential Backoff */}
              {canRetry && onRetry && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isRetrying || isManualRetrying}
                  aria-label={isRetrying ? 'Retrying with backoff...' : 'Retry with exponential backoff'}
                >
                  {isRetrying ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                      <LoadingSpinner size="sm" />
                      <span>Retrying...</span>
                    </div>
                  ) : (
                    'Smart Retry'
                  )}
                </Button>
              )}

              {/* Manual Retry */}
              {canRetry && onManualRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualRetry}
                  disabled={isRetrying || isManualRetrying}
                  aria-label={isManualRetrying ? 'Manual retry in progress...' : 'Try again immediately'}
                >
                  {isManualRetrying ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                      <LoadingSpinner size="sm" />
                      <span>Trying...</span>
                    </div>
                  ) : (
                    'Try Now'
                  )}
                </Button>
              )}

              {/* Reset Retry Count */}
              {retryCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetRetries}
                  disabled={isRetrying || isManualRetrying}
                  aria-label="Reset retry attempts"
                >
                  Reset Attempts
                </Button>
              )}

              {/* Dismiss */}
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  disabled={isRetrying || isManualRetrying}
                  aria-label="Dismiss error"
                >
                  Dismiss
                </Button>
              )}
            </div>
          </div>

          {onDismiss && (
            <button
              onClick={onDismiss}
              disabled={isRetrying || isManualRetrying}
              style={{
                background: 'none',
                border: 'none',
                color: tokens.colors.error[600],
                cursor: isRetrying || isManualRetrying ? 'not-allowed' : 'pointer',
                fontSize: '18px',
                padding: tokens.spacing[1],
                opacity: isRetrying || isManualRetrying ? 0.5 : 0.7,
              }}
              aria-label="Close error message"
            >
              ×
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Props for the error status component
 */
export interface ErrorStatusProps {
  operationName: string;
  errorCount?: number;
  lastErrorTime?: Date;
  className?: string;
  showDetails?: boolean;
}

/**
 * Error status display component
 */
export const ErrorStatus: React.FC<ErrorStatusProps> = ({
  operationName: _operationName,
  errorCount = 0,
  lastErrorTime,
  className = '',
  showDetails = false,
}) => {
  const getStatusConfig = () => {
    if (errorCount === 0) {
      return {
        color: tokens.colors.success,
        icon: '✅',
        label: 'No Errors',
        description: 'Operation is working normally.',
      };
    } else if (errorCount < 3) {
      return {
        color: tokens.colors.warning,
        icon: '⚠️',
        label: 'Minor Issues',
        description: 'Some errors detected but operation is still functional.',
      };
    } else {
      return {
        color: tokens.colors.error,
        icon: '❌',
        label: 'Multiple Errors',
        description: 'Multiple errors detected. Operation may be unstable.',
      };
    }
  };

  const config = getStatusConfig();
  const timeSinceError = lastErrorTime ? Date.now() - lastErrorTime.getTime() : null;

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
        padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
        backgroundColor: config.color[50],
        border: `1px solid ${config.color[200]}`,
        borderRadius: tokens.borderRadius.md,
        fontSize: tokens.typography.fontSize.sm,
      }}
    >
      <span style={{ fontSize: '14px' }}>
        {config.icon}
      </span>

      <div>
        <span style={{
          fontWeight: tokens.typography.fontWeight.medium,
          color: config.color[800],
        }}>
          {config.label}
        </span>

        {showDetails && (
          <div style={{
            fontSize: tokens.typography.fontSize.xs,
            color: config.color[600],
            marginTop: tokens.spacing[1],
          }}>
            <div>{config.description}</div>
            {errorCount > 0 && (
              <div>Error count: {errorCount}</div>
            )}
            {timeSinceError && (
              <div>Last error: {Math.ceil(timeSinceError / 1000)}s ago</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Props for the simple retry indicator component
 */
export interface RetryIndicatorProps {
  isRetrying: boolean;
  retryCount: number;
  maxRetries?: number;
  className?: string;
}

/**
 * Simple retry indicator component
 */
export const RetryIndicator: React.FC<RetryIndicatorProps> = ({
  isRetrying,
  retryCount,
  maxRetries = 5,
  className = '',
}) => {
  const progressPercentage = (retryCount / maxRetries) * 100;

  return (
    <div
      className={className}
      style={{
        padding: tokens.spacing[3],
        backgroundColor: tokens.colors.blue[50],
        border: `1px solid ${tokens.colors.blue[200]}`,
        borderRadius: tokens.borderRadius.md,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: tokens.spacing[2],
      }}>
        <span style={{
          fontSize: tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.medium,
          color: tokens.colors.blue[800],
        }}>
          Retry Status
        </span>

        <span style={{
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.blue[600],
        }}>
          {retryCount}/{maxRetries}
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{
        width: '100%',
        height: '6px',
        backgroundColor: tokens.colors.blue[100],
        borderRadius: tokens.borderRadius.sm,
        overflow: 'hidden',
        marginBottom: tokens.spacing[2],
      }}>
        <div style={{
          width: `${progressPercentage}%`,
          height: '100%',
          backgroundColor: tokens.colors.blue[500],
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
        fontSize: tokens.typography.fontSize.sm,
        color: tokens.colors.blue[700],
      }}>
        {isRetrying ? (
          <>
            <LoadingSpinner size="sm" />
            <span>Retrying...</span>
          </>
        ) : retryCount > 0 ? (
          <>
            <span>⏸️</span>
            <span>Ready for next attempt</span>
          </>
        ) : (
          <>
            <span>✅</span>
            <span>No retries needed</span>
          </>
        )}
      </div>
    </div>
  );
};