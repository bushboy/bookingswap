/**
 * Monitoring utilities for realtime service
 * Provides endpoints and utilities for external monitoring systems
 */

import { realtimeService } from '../services/realtimeService';

export interface MonitoringEndpoint {
    path: string;
    method: 'GET' | 'POST';
    handler: () => Promise<any> | any;
}

/**
 * Health check endpoint for load balancers and monitoring systems
 */
export const healthCheckEndpoint = (): any => {
    const healthCheck = realtimeService.getHealthCheck();

    return {
        status: healthCheck.status,
        timestamp: healthCheck.timestamp,
        service: 'realtime-websocket',
        version: '2.0.0',
        checks: {
            connection: healthCheck.connection.isConnected ? 'pass' : 'fail',
            subscriptions: healthCheck.subscriptions.count >= 0 ? 'pass' : 'fail',
            errors: healthCheck.errors.recent === 0 ? 'pass' : 'warn',
        },
        details: healthCheck,
    };
};

/**
 * Metrics endpoint for monitoring systems like Prometheus
 */
export const metricsEndpoint = (): any => {
    const metrics = realtimeService.getMetrics();
    const healthCheck = realtimeService.getHealthCheck();

    // Format metrics in a structure suitable for monitoring systems
    return {
        timestamp: new Date().toISOString(),
        service: 'realtime-websocket',
        metrics: {
            // Connection metrics
            'realtime_connection_status': healthCheck.connection.status,
            'realtime_connection_uptime_seconds': healthCheck.connection.uptime || 0,
            'realtime_connection_is_connected': healthCheck.connection.isConnected ? 1 : 0,

            // Subscription metrics
            'realtime_subscriptions_total': healthCheck.subscriptions.count,
            'realtime_subscriptions_active': healthCheck.subscriptions.active.length,

            // Error metrics
            'realtime_errors_recent_total': healthCheck.errors.recent,

            // Fallback metrics
            'realtime_fallback_enabled': healthCheck.fallback.enabled ? 1 : 0,
            'realtime_fallback_active': healthCheck.fallback.active ? 1 : 0,

            // Performance metrics
            'realtime_reconnect_attempts_total': metrics.connection.attemptCount || 0,
            'realtime_messages_total': 0, // Not tracked in current diagnostics
            'realtime_connection_failures_total': metrics.connection.errorHistory?.length || 0,
        },
        labels: {
            server_url: metrics.config.serverUrl,
            debug_mode: metrics.config.debugMode ? 'true' : 'false',
            log_level: metrics.config.logLevel,
        },
    };
};

/**
 * Diagnostic endpoint for troubleshooting
 */
export const diagnosticsEndpoint = (): any => {
    return realtimeService.getDiagnosticInfo();
};

/**
 * Status endpoint for simple status checks
 */
export const statusEndpoint = (): any => {
    return realtimeService.getStatusReport();
};

/**
 * Connection test endpoint
 */
export const connectionTestEndpoint = async (): Promise<any> => {
    const testResult = await realtimeService.testConnection();

    return {
        timestamp: new Date().toISOString(),
        service: 'realtime-websocket',
        test: 'connection',
        result: testResult,
        status: testResult.success ? 'pass' : 'fail',
    };
};

/**
 * Log endpoint for retrieving recent logs
 */
export const logsEndpoint = (limit: number = 50): any => {
    const logs = realtimeService.getLogHistory().slice(-limit);

    return {
        timestamp: new Date().toISOString(),
        service: 'realtime-websocket',
        logs,
        count: logs.length,
    };
};

/**
 * Configuration endpoint
 */
export const configEndpoint = (): any => {
    const metrics = realtimeService.getMetrics();

    return {
        timestamp: new Date().toISOString(),
        service: 'realtime-websocket',
        config: metrics.config,
        environment: {
            VITE_WS_URL: import.meta.env.VITE_WS_URL,
            VITE_WS_DEBUG_MODE: import.meta.env.VITE_WS_DEBUG_MODE,
            VITE_WS_LOG_LEVEL: import.meta.env.VITE_WS_LOG_LEVEL,
            VITE_ENABLE_FALLBACK: import.meta.env.VITE_ENABLE_FALLBACK,
        },
    };
};

/**
 * All available monitoring endpoints
 */
export const monitoringEndpoints: Record<string, MonitoringEndpoint> = {
    health: {
        path: '/health',
        method: 'GET',
        handler: healthCheckEndpoint,
    },
    metrics: {
        path: '/metrics',
        method: 'GET',
        handler: metricsEndpoint,
    },
    diagnostics: {
        path: '/diagnostics',
        method: 'GET',
        handler: diagnosticsEndpoint,
    },
    status: {
        path: '/status',
        method: 'GET',
        handler: statusEndpoint,
    },
    'connection-test': {
        path: '/connection-test',
        method: 'POST',
        handler: connectionTestEndpoint,
    },
    logs: {
        path: '/logs',
        method: 'GET',
        handler: () => logsEndpoint(),
    },
    config: {
        path: '/config',
        method: 'GET',
        handler: configEndpoint,
    },
};

/**
 * Simple monitoring server for development/debugging
 * This can be used to expose monitoring endpoints during development
 */
export class RealtimeMonitoringServer {
    private endpoints: Record<string, MonitoringEndpoint>;

    constructor(endpoints: Record<string, MonitoringEndpoint> = monitoringEndpoints) {
        this.endpoints = endpoints;
    }

    /**
     * Handle a monitoring request
     */
    async handleRequest(path: string, method: string = 'GET'): Promise<any> {
        const endpoint = Object.values(this.endpoints).find(
            ep => ep.path === path && ep.method === method
        );

        if (!endpoint) {
            return {
                error: 'Endpoint not found',
                available: Object.values(this.endpoints).map(ep => ({
                    path: ep.path,
                    method: ep.method,
                })),
            };
        }

        try {
            return await endpoint.handler();
        } catch (error) {
            return {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * Get all available endpoints
     */
    getEndpoints(): Array<{ path: string; method: string; description: string }> {
        return Object.entries(this.endpoints).map(([name, endpoint]) => ({
            path: endpoint.path,
            method: endpoint.method,
            description: this.getEndpointDescription(name),
        }));
    }

    private getEndpointDescription(name: string): string {
        const descriptions: Record<string, string> = {
            health: 'Health check for load balancers',
            metrics: 'Metrics for monitoring systems',
            diagnostics: 'Detailed diagnostic information',
            status: 'Simple status report',
            'connection-test': 'Test connection latency',
            logs: 'Recent log entries',
            config: 'Current configuration',
        };

        return descriptions[name] || 'Monitoring endpoint';
    }
}

/**
 * Global monitoring server instance
 */
export const monitoringServer = new RealtimeMonitoringServer();

/**
 * Utility to expose monitoring endpoints on window object for debugging
 */
export const exposeMonitoringEndpoints = (): void => {
    if (typeof window !== 'undefined' && import.meta.env.VITE_WS_DEBUG_MODE === 'true') {
        (window as any).realtimeMonitoring = {
            health: healthCheckEndpoint,
            metrics: metricsEndpoint,
            diagnostics: diagnosticsEndpoint,
            status: statusEndpoint,
            connectionTest: connectionTestEndpoint,
            logs: logsEndpoint,
            config: configEndpoint,
            server: monitoringServer,
        };

        console.info('Realtime monitoring endpoints exposed on window.realtimeMonitoring');
    }
};

// Auto-expose in debug mode
if (import.meta.env.VITE_WS_DEBUG_MODE === 'true') {
    exposeMonitoringEndpoints();
}