import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';

/**
 * Props for the StuckStateDetector component
 */
export interface StuckStateDetectorProps {
    /** Unique identifier for the component being monitored */
    componentId: string;
    /** Whether the component is currently in a loading state */
    isLoading: boolean;
    /** Maximum time (in ms) before considering the state "stuck" */
    maxLoadingTime?: number;
    /** Callback when stuck state is detected */
    onStuckStateDetected?: (componentId: string, duration: number) => void;
    /** Callback to recover from stuck state */
    onRecovery?: (componentId: string) => Promise<void>;
    /** Whether to show the stuck state UI */
    showStuckStateUI?: boolean;
    /** Custom message for stuck state */
    stuckStateMessage?: string;
    /** Whether to auto-recover when stuck state is detected */
    autoRecover?: boolean;
    /** Children to render when not stuck */
    children: React.ReactNode;
}

/**
 * StuckStateDetector - Detects and provides recovery for components stuck in loading states
 * 
 * Features:
 * - Automatic detection of stuck loading states
 * - Manual refresh capabilities for stuck states (Requirement 5.2)
 * - Timeout detection and recovery (Requirement 5.4)
 * - Visual feedback for stuck states
 * - Auto-recovery mechanisms
 */
export const StuckStateDetector: React.FC<StuckStateDetectorProps> = ({
    componentId,
    isLoading,
    maxLoadingTime = 30000, // 30 seconds default
    onStuckStateDetected,
    onRecovery,
    showStuckStateUI = true,
    stuckStateMessage = 'This component appears to be stuck. You can try to recover it.',
    autoRecover = false,
    children,
}) => {
    const [isStuck, setIsStuck] = useState(false);
    const [stuckDuration, setStuckDuration] = useState(0);
    const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
    const [isRecovering, setIsRecovering] = useState(false);
    const [recoveryAttempts, setRecoveryAttempts] = useState(0);

    // Track loading state changes
    useEffect(() => {
        if (isLoading && !loadingStartTime) {
            // Loading started
            setLoadingStartTime(Date.now());
            setIsStuck(false);
            setStuckDuration(0);
        } else if (!isLoading && loadingStartTime) {
            // Loading finished
            setLoadingStartTime(null);
            setIsStuck(false);
            setStuckDuration(0);
        }
    }, [isLoading, loadingStartTime]);

    // Monitor for stuck state
    useEffect(() => {
        if (!isLoading || !loadingStartTime) return;

        const checkInterval = setInterval(() => {
            const currentTime = Date.now();
            const duration = currentTime - loadingStartTime;
            setStuckDuration(duration);

            if (duration > maxLoadingTime && !isStuck) {
                console.warn(`[StuckStateDetector] Component ${componentId} appears stuck after ${duration}ms`);
                setIsStuck(true);

                // Notify parent component
                if (onStuckStateDetected) {
                    onStuckStateDetected(componentId, duration);
                }

                // Auto-recover if enabled
                if (autoRecover && onRecovery) {
                    handleRecovery();
                }
            }
        }, 1000); // Check every second

        return () => clearInterval(checkInterval);
    }, [isLoading, loadingStartTime, maxLoadingTime, isStuck, componentId, onStuckStateDetected, autoRecover, onRecovery]);

    // Handle manual recovery
    const handleRecovery = useCallback(async () => {
        if (!onRecovery || isRecovering) return;

        console.log(`[StuckStateDetector] Attempting recovery for component ${componentId} (attempt ${recoveryAttempts + 1})`);

        setIsRecovering(true);
        setRecoveryAttempts(prev => prev + 1);

        try {
            await onRecovery(componentId);

            // Reset stuck state after successful recovery
            setIsStuck(false);
            setStuckDuration(0);
            setLoadingStartTime(null);

            console.log(`[StuckStateDetector] Recovery successful for component ${componentId}`);
        } catch (error) {
            console.error(`[StuckStateDetector] Recovery failed for component ${componentId}:`, error);
        } finally {
            setIsRecovering(false);
        }
    }, [onRecovery, componentId, isRecovering, recoveryAttempts]);

    // Format duration for display
    const formatDuration = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);

        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    };

    // If stuck and should show UI, render stuck state
    if (isStuck && showStuckStateUI) {
        return (
            <div style={{
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.warning[50],
                border: `2px solid ${tokens.colors.warning[200]}`,
                borderRadius: tokens.borderRadius.lg,
                textAlign: 'center',
                maxWidth: '400px',
                margin: '0 auto',
            }}>
                <div style={{ fontSize: '24px', marginBottom: tokens.spacing[2] }}>
                    ⏳
                </div>

                <h4 style={{
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.warning[800],
                    margin: `0 0 ${tokens.spacing[2]} 0`,
                }}>
                    Component Appears Stuck
                </h4>

                <p style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.warning[700],
                    marginBottom: tokens.spacing[3],
                }}>
                    {stuckStateMessage}
                </p>

                <div style={{
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.warning[600],
                    marginBottom: tokens.spacing[3],
                }}>
                    <div>Component: {componentId}</div>
                    <div>Stuck for: {formatDuration(stuckDuration)}</div>
                    <div>Recovery attempts: {recoveryAttempts}</div>
                </div>

                {onRecovery && (
                    <div style={{
                        display: 'flex',
                        gap: tokens.spacing[2],
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                    }}>
                        <Button
                            variant="primary"
                            size="md"
                            onClick={handleRecovery}
                            disabled={isRecovering}
                            loading={isRecovering}
                            style={{
                                backgroundColor: tokens.colors.warning[600],
                                borderColor: tokens.colors.warning[600],
                            }}
                        >
                            🔄 Recover Component
                        </Button>

                        <Button
                            variant="outline"
                            size="md"
                            onClick={() => window.location.reload()}
                            disabled={isRecovering}
                            style={{
                                borderColor: tokens.colors.neutral[300],
                                color: tokens.colors.neutral[700],
                            }}
                        >
                            🔧 Reload Page
                        </Button>
                    </div>
                )}

                {/* Debug information */}
                {process.env.NODE_ENV === 'development' && (
                    <details style={{
                        marginTop: tokens.spacing[3],
                        textAlign: 'left',
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.neutral[600],
                    }}>
                        <summary style={{ cursor: 'pointer', marginBottom: tokens.spacing[1] }}>
                            Debug Information
                        </summary>
                        <div style={{
                            backgroundColor: tokens.colors.neutral[100],
                            padding: tokens.spacing[2],
                            borderRadius: tokens.borderRadius.sm,
                            fontFamily: 'monospace',
                        }}>
                            <div>Component ID: {componentId}</div>
                            <div>Loading Start: {loadingStartTime ? new Date(loadingStartTime).toLocaleTimeString() : 'N/A'}</div>
                            <div>Max Loading Time: {maxLoadingTime}ms</div>
                            <div>Current Duration: {stuckDuration}ms</div>
                            <div>Is Loading: {isLoading ? 'Yes' : 'No'}</div>
                            <div>Is Stuck: {isStuck ? 'Yes' : 'No'}</div>
                            <div>Is Recovering: {isRecovering ? 'Yes' : 'No'}</div>
                            <div>Auto Recover: {autoRecover ? 'Yes' : 'No'}</div>
                        </div>
                    </details>
                )}
            </div>
        );
    }

    // Render children normally
    return <>{children}</>;
};

export default StuckStateDetector;