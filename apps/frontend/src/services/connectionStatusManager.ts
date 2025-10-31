/**
 * Connection Status Manager
 * 
 * Manages WebSocket connection status tracking, metrics collection,
 * and status change notifications for the realtime service.
 */

export enum ConnectionStatus {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    RECONNECTING = 'reconnecting',
    FAILED = 'failed',
    FALLBACK = 'fallback'
}

export interface ConnectionMetrics {
    uptime: number;
    totalConnections: number;
    failedConnections: number;
    averageLatency: number;
    lastConnectedAt?: Date;
    lastFailureAt?: Date;
    lastFailureReason?: string;
    connectionHistory: ConnectionHistoryEntry[];
    currentSessionDuration: number;
    totalAttempts: number;
    successRate: number;
    minLatency: number;
    maxLatency: number;
}

export interface ConnectionHistoryEntry {
    timestamp: Date;
    event: 'attempt' | 'success' | 'failure' | 'disconnect';
    latency?: number;
    error?: string;
    duration?: number; // For disconnect events
}

type StatusChangeCallback = (status: ConnectionStatus) => void;

export class ConnectionStatusManager {
    private currentStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
    private subscribers: Set<StatusChangeCallback> = new Set();
    private metrics: ConnectionMetrics = {
        uptime: 0,
        totalConnections: 0,
        failedConnections: 0,
        averageLatency: 0,
        connectionHistory: [],
        currentSessionDuration: 0,
        totalAttempts: 0,
        successRate: 0,
        minLatency: Infinity,
        maxLatency: 0,
    };
    private connectionStartTime?: Date;
    private latencyMeasurements: number[] = [];
    private readonly maxHistoryEntries = 100;

    /**
     * Set the current connection status and notify subscribers
     */
    setStatus(status: ConnectionStatus): void {
        const previousStatus = this.currentStatus;
        this.currentStatus = status;

        // Track connection timing for uptime calculation
        if (status === ConnectionStatus.CONNECTED && previousStatus !== ConnectionStatus.CONNECTED) {
            this.connectionStartTime = new Date();
            this.metrics.lastConnectedAt = this.connectionStartTime;
        } else if (status === ConnectionStatus.DISCONNECTED && this.connectionStartTime) {
            // Add to uptime when disconnecting
            const connectionDuration = Date.now() - this.connectionStartTime.getTime();
            this.metrics.uptime += connectionDuration;

            // Record disconnect event in history
            this.addHistoryEntry({
                timestamp: new Date(),
                event: 'disconnect',
                duration: connectionDuration
            });

            this.connectionStartTime = undefined;
        }

        // Notify all subscribers of status change
        this.subscribers.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('Error in status change callback:', error);
            }
        });
    }

    /**
     * Get the current connection status
     */
    getStatus(): ConnectionStatus {
        return this.currentStatus;
    }

    /**
     * Subscribe to status change notifications
     */
    subscribe(callback: StatusChangeCallback): () => void {
        this.subscribers.add(callback);

        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * Record a connection attempt
     */
    recordConnectionAttempt(): void {
        this.metrics.totalAttempts++;
        this.addHistoryEntry({
            timestamp: new Date(),
            event: 'attempt'
        });
        this.updateSuccessRate();
    }

    /**
     * Record a successful connection
     */
    recordConnectionSuccess(latency?: number): void {
        this.metrics.totalConnections++;

        if (latency !== undefined) {
            this.latencyMeasurements.push(latency);
            // Keep only last 100 measurements for average calculation
            if (this.latencyMeasurements.length > 100) {
                this.latencyMeasurements.shift();
            }
            this.updateLatencyMetrics(latency);
        }

        this.addHistoryEntry({
            timestamp: new Date(),
            event: 'success',
            latency
        });
        this.updateSuccessRate();
    }

    /**
     * Record a connection failure with error details
     */
    recordConnectionFailure(error: Error): void {
        this.metrics.failedConnections++;
        this.metrics.lastFailureAt = new Date();
        this.metrics.lastFailureReason = error.message;

        this.addHistoryEntry({
            timestamp: new Date(),
            event: 'failure',
            error: error.message
        });
        this.updateSuccessRate();
    }

    /**
     * Get comprehensive connection metrics
     */
    getMetrics(): ConnectionMetrics {
        // Calculate current uptime if connected
        let currentUptime = this.metrics.uptime;
        let currentSessionDuration = 0;

        if (this.connectionStartTime && this.currentStatus === ConnectionStatus.CONNECTED) {
            currentSessionDuration = Date.now() - this.connectionStartTime.getTime();
            currentUptime += currentSessionDuration;
        }

        return {
            ...this.metrics,
            uptime: currentUptime,
            currentSessionDuration,
            successRate: this.getSuccessRate(),
        };
    }

    /**
     * Reset all metrics (useful for testing or fresh starts)
     */
    resetMetrics(): void {
        this.metrics = {
            uptime: 0,
            totalConnections: 0,
            failedConnections: 0,
            averageLatency: 0,
            connectionHistory: [],
            currentSessionDuration: 0,
            totalAttempts: 0,
            successRate: 0,
            minLatency: Infinity,
            maxLatency: 0,
        };
        this.latencyMeasurements = [];
        this.connectionStartTime = undefined;
    }

    /**
     * Get connection success rate as a percentage
     */
    getSuccessRate(): number {
        const totalAttempts = this.metrics.totalConnections + this.metrics.failedConnections;
        if (totalAttempts === 0) return 0;
        return (this.metrics.totalConnections / totalAttempts) * 100;
    }

    /**
     * Check if connection is in a healthy state
     */
    isHealthy(): boolean {
        return this.currentStatus === ConnectionStatus.CONNECTED;
    }

    /**
     * Get human-readable status description
     */
    getStatusDescription(): string {
        switch (this.currentStatus) {
            case ConnectionStatus.CONNECTED:
                return 'Connected and receiving real-time updates';
            case ConnectionStatus.CONNECTING:
                return 'Establishing connection...';
            case ConnectionStatus.RECONNECTING:
                return 'Reconnecting to server...';
            case ConnectionStatus.DISCONNECTED:
                return 'Disconnected from server';
            case ConnectionStatus.FAILED:
                return 'Connection failed - check your internet connection';
            case ConnectionStatus.FALLBACK:
                return 'Using fallback mode - limited real-time features';
            default:
                return 'Unknown connection status';
        }
    }

    /**
     * Add entry to connection history with size limit
     */
    private addHistoryEntry(entry: ConnectionHistoryEntry): void {
        this.metrics.connectionHistory.push(entry);

        // Keep only the most recent entries
        if (this.metrics.connectionHistory.length > this.maxHistoryEntries) {
            this.metrics.connectionHistory.shift();
        }
    }

    /**
     * Update success rate percentage
     */
    private updateSuccessRate(): void {
        if (this.metrics.totalAttempts === 0) {
            this.metrics.successRate = 0;
            return;
        }

        this.metrics.successRate = Math.round(
            (this.metrics.totalConnections / this.metrics.totalAttempts) * 100
        );
    }

    /**
     * Update latency metrics including min, max, and average
     */
    private updateLatencyMetrics(latency: number): void {
        // Update min/max latency
        if (latency < this.metrics.minLatency) {
            this.metrics.minLatency = latency;
        }
        if (latency > this.metrics.maxLatency) {
            this.metrics.maxLatency = latency;
        }

        // Update average latency
        this.updateAverageLatency();
    }

    private updateAverageLatency(): void {
        if (this.latencyMeasurements.length === 0) {
            this.metrics.averageLatency = 0;
            return;
        }

        const sum = this.latencyMeasurements.reduce((acc, latency) => acc + latency, 0);
        this.metrics.averageLatency = Math.round(sum / this.latencyMeasurements.length);
    }
}

// Export singleton instance
export const connectionStatusManager = new ConnectionStatusManager();