import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { tokens } from '@/design-system/tokens';
import {
    ConnectionStatus,
    ConnectionMetrics,
    ConnectionHistoryEntry,
    connectionStatusManager
} from '@/services/connectionStatusManager';

interface ConnectionDiagnosticsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ConnectionDiagnosticsModal: React.FC<ConnectionDiagnosticsModalProps> = ({
    isOpen,
    onClose,
}) => {
    const [status, setStatus] = useState<ConnectionStatus>(
        connectionStatusManager.getStatus()
    );
    const [metrics, setMetrics] = useState<ConnectionMetrics>(
        connectionStatusManager.getMetrics()
    );

    useEffect(() => {
        const unsubscribe = connectionStatusManager.subscribe(setStatus);

        // Update metrics every second when modal is open
        const interval = isOpen ? setInterval(() => {
            setMetrics(connectionStatusManager.getMetrics());
        }, 1000) : null;

        return () => {
            unsubscribe();
            if (interval) clearInterval(interval);
        };
    }, [isOpen]);

    const formatDuration = (milliseconds: number): string => {
        if (milliseconds < 1000) return `${milliseconds}ms`;

        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    };

    const formatTimestamp = (date: Date): string => {
        return date.toLocaleString();
    };

    const getEventIcon = (event: ConnectionHistoryEntry['event']): string => {
        switch (event) {
            case 'attempt': return '🔄';
            case 'success': return '✅';
            case 'failure': return '❌';
            case 'disconnect': return '🔌';
            default: return '❓';
        }
    };

    const getEventColor = (event: ConnectionHistoryEntry['event']): string => {
        switch (event) {
            case 'attempt': return tokens.colors.blue[600];
            case 'success': return tokens.colors.success[600];
            case 'failure': return tokens.colors.error[600];
            case 'disconnect': return tokens.colors.warning[600];
            default: return tokens.colors.neutral[600];
        }
    };

    const sectionStyles = {
        marginBottom: tokens.spacing[6],
    };

    const gridStyles = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: tokens.spacing[4],
        marginBottom: tokens.spacing[4],
    };

    const metricCardStyles = {
        padding: tokens.spacing[4],
        textAlign: 'center' as const,
    };

    const metricValueStyles = {
        fontSize: tokens.typography.fontSize['2xl'],
        fontWeight: tokens.typography.fontWeight.bold,
        color: tokens.colors.primary[600],
        marginBottom: tokens.spacing[1],
    };

    const metricLabelStyles = {
        fontSize: tokens.typography.fontSize.sm,
        color: tokens.colors.neutral[600],
    };

    const historyListStyles = {
        maxHeight: '300px',
        overflowY: 'auto' as const,
        border: `1px solid ${tokens.colors.neutral[200]}`,
        borderRadius: tokens.borderRadius.md,
        padding: tokens.spacing[2],
    };

    const historyItemStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[3],
        padding: tokens.spacing[2],
        borderBottom: `1px solid ${tokens.colors.neutral[100]}`,
        fontSize: tokens.typography.fontSize.sm,
    };

    const currentStatusConfig = {
        [ConnectionStatus.CONNECTED]: { variant: 'success' as const, text: 'Connected' },
        [ConnectionStatus.CONNECTING]: { variant: 'warning' as const, text: 'Connecting' },
        [ConnectionStatus.RECONNECTING]: { variant: 'warning' as const, text: 'Reconnecting' },
        [ConnectionStatus.DISCONNECTED]: { variant: 'error' as const, text: 'Disconnected' },
        [ConnectionStatus.FAILED]: { variant: 'error' as const, text: 'Failed' },
        [ConnectionStatus.FALLBACK]: { variant: 'info' as const, text: 'Fallback Mode' },
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Connection Diagnostics"
            size="lg"
        >
            <div style={{ padding: tokens.spacing[4] }}>
                {/* Current Status */}
                <div style={sectionStyles}>
                    <h3 style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        marginBottom: tokens.spacing[3],
                        color: tokens.colors.neutral[800],
                    }}>
                        Current Status
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[3] }}>
                        <Badge
                            variant={currentStatusConfig[status]?.variant || 'default'}
                            size="md"
                        >
                            {currentStatusConfig[status]?.text || 'Unknown'}
                        </Badge>
                        <span style={{ color: tokens.colors.neutral[600] }}>
                            {connectionStatusManager.getStatusDescription()}
                        </span>
                    </div>
                </div>

                {/* Connection Metrics */}
                <div style={sectionStyles}>
                    <h3 style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        marginBottom: tokens.spacing[3],
                        color: tokens.colors.neutral[800],
                    }}>
                        Connection Metrics
                    </h3>
                    <div style={gridStyles}>
                        <Card style={metricCardStyles}>
                            <div style={metricValueStyles}>
                                {formatDuration(metrics.uptime)}
                            </div>
                            <div style={metricLabelStyles}>Total Uptime</div>
                        </Card>

                        <Card style={metricCardStyles}>
                            <div style={metricValueStyles}>
                                {formatDuration(metrics.currentSessionDuration)}
                            </div>
                            <div style={metricLabelStyles}>Current Session</div>
                        </Card>

                        <Card style={metricCardStyles}>
                            <div style={metricValueStyles}>
                                {metrics.successRate.toFixed(1)}%
                            </div>
                            <div style={metricLabelStyles}>Success Rate</div>
                        </Card>

                        <Card style={metricCardStyles}>
                            <div style={metricValueStyles}>
                                {metrics.averageLatency}ms
                            </div>
                            <div style={metricLabelStyles}>Avg Latency</div>
                        </Card>

                        <Card style={metricCardStyles}>
                            <div style={metricValueStyles}>
                                {metrics.totalConnections}
                            </div>
                            <div style={metricLabelStyles}>Successful Connections</div>
                        </Card>

                        <Card style={metricCardStyles}>
                            <div style={metricValueStyles}>
                                {metrics.failedConnections}
                            </div>
                            <div style={metricLabelStyles}>Failed Connections</div>
                        </Card>
                    </div>
                </div>

                {/* Latency Information */}
                {metrics.minLatency !== Infinity && (
                    <div style={sectionStyles}>
                        <h3 style={{
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            marginBottom: tokens.spacing[3],
                            color: tokens.colors.neutral[800],
                        }}>
                            Latency Details
                        </h3>
                        <div style={gridStyles}>
                            <Card style={metricCardStyles}>
                                <div style={metricValueStyles}>
                                    {metrics.minLatency}ms
                                </div>
                                <div style={metricLabelStyles}>Minimum</div>
                            </Card>

                            <Card style={metricCardStyles}>
                                <div style={metricValueStyles}>
                                    {metrics.maxLatency}ms
                                </div>
                                <div style={metricLabelStyles}>Maximum</div>
                            </Card>
                        </div>
                    </div>
                )}

                {/* Last Failure Information */}
                {metrics.lastFailureAt && (
                    <div style={sectionStyles}>
                        <h3 style={{
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            marginBottom: tokens.spacing[3],
                            color: tokens.colors.neutral[800],
                        }}>
                            Last Failure
                        </h3>
                        <Card style={{ padding: tokens.spacing[4] }}>
                            <div style={{ marginBottom: tokens.spacing[2] }}>
                                <strong>Time:</strong> {formatTimestamp(metrics.lastFailureAt)}
                            </div>
                            <div>
                                <strong>Reason:</strong> {metrics.lastFailureReason || 'Unknown'}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Connection History */}
                <div style={sectionStyles}>
                    <h3 style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        marginBottom: tokens.spacing[3],
                        color: tokens.colors.neutral[800],
                    }}>
                        Recent Activity
                    </h3>
                    <div style={historyListStyles}>
                        {metrics.connectionHistory.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                color: tokens.colors.neutral[500],
                                padding: tokens.spacing[4],
                            }}>
                                No connection history available
                            </div>
                        ) : (
                            metrics.connectionHistory
                                .slice()
                                .reverse()
                                .map((entry, index) => (
                                    <div key={index} style={historyItemStyles}>
                                        <span style={{ fontSize: '16px' }}>
                                            {getEventIcon(entry.event)}
                                        </span>
                                        <span style={{
                                            color: getEventColor(entry.event),
                                            fontWeight: tokens.typography.fontWeight.medium,
                                            minWidth: '80px',
                                        }}>
                                            {entry.event.toUpperCase()}
                                        </span>
                                        <span style={{ color: tokens.colors.neutral[600] }}>
                                            {formatTimestamp(entry.timestamp)}
                                        </span>
                                        {entry.latency && (
                                            <span style={{ color: tokens.colors.neutral[500] }}>
                                                ({entry.latency}ms)
                                            </span>
                                        )}
                                        {entry.duration && (
                                            <span style={{ color: tokens.colors.neutral[500] }}>
                                                (lasted {formatDuration(entry.duration)})
                                            </span>
                                        )}
                                        {entry.error && (
                                            <span style={{
                                                color: tokens.colors.error[600],
                                                fontSize: tokens.typography.fontSize.xs,
                                            }}>
                                                {entry.error}
                                            </span>
                                        )}
                                    </div>
                                ))
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: tokens.spacing[3],
                    paddingTop: tokens.spacing[4],
                    borderTop: `1px solid ${tokens.colors.neutral[200]}`,
                }}>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
};