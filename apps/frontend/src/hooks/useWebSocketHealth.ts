import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

interface ConnectionHealth {
    status: 'connected' | 'connecting' | 'disconnected' | 'error';
    latency: number;
    lastPing: Date | null;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    isHealthy: boolean;
    errorMessage?: string;
}

interface UseWebSocketHealthOptions {
    socket: Socket | null;
    pingInterval?: number;
    healthCheckTimeout?: number;
    maxReconnectAttempts?: number;
    onHealthChange?: (health: ConnectionHealth) => void;
    onReconnectFailed?: () => void;
}

export const useWebSocketHealth = (options: UseWebSocketHealthOptions) => {
    const {
        socket,
        pingInterval = 30000, // 30 seconds
        healthCheckTimeout = 5000, // 5 seconds
        maxReconnectAttempts = 5,
        onHealthChange,
        onReconnectFailed,
    } = options;

    const [health, setHealth] = useState<ConnectionHealth>({
        status: 'disconnected',
        latency: 0,
        lastPing: null,
        reconnectAttempts: 0,
        maxReconnectAttempts,
        isHealthy: false,
    });

    const pingIntervalRef = useRef<NodeJS.Timeout>();
    const healthCheckTimeoutRef = useRef<NodeJS.Timeout>();
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const pingStartTime = useRef<number>(0);

    const updateHealth = useCallback((updates: Partial<ConnectionHealth>) => {
        setHealth(prev => {
            const newHealth = { ...prev, ...updates };
            newHealth.isHealthy =
                newHealth.status === 'connected' &&
                newHealth.latency < 5000 && // Less than 5 seconds latency
                newHealth.reconnectAttempts < newHealth.maxReconnectAttempts;

            onHealthChange?.(newHealth);
            return newHealth;
        });
    }, [onHealthChange]);

    const performHealthCheck = useCallback(() => {
        if (!socket?.connected) {
            updateHealth({
                status: 'disconnected',
                isHealthy: false,
            });
            return;
        }

        pingStartTime.current = Date.now();

        // Clear any existing timeout
        if (healthCheckTimeoutRef.current) {
            clearTimeout(healthCheckTimeoutRef.current);
        }

        // Set timeout for health check
        healthCheckTimeoutRef.current = setTimeout(() => {
            updateHealth({
                status: 'error',
                errorMessage: 'Health check timeout',
                isHealthy: false,
            });
        }, healthCheckTimeout);

        // Send ping
        socket.emit('ping', { timestamp: pingStartTime.current });
    }, [socket, healthCheckTimeout, updateHealth]);

    const handlePong = useCallback((data: { timestamp: number }) => {
        if (healthCheckTimeoutRef.current) {
            clearTimeout(healthCheckTimeoutRef.current);
        }

        const latency = Date.now() - data.timestamp;
        updateHealth({
            status: 'connected',
            latency,
            lastPing: new Date(),
            errorMessage: undefined,
        });
    }, [updateHealth]);

    const startHealthMonitoring = useCallback(() => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
        }

        // Perform initial health check
        performHealthCheck();

        // Set up periodic health checks
        pingIntervalRef.current = setInterval(performHealthCheck, pingInterval);
    }, [performHealthCheck, pingInterval]);

    const stopHealthMonitoring = useCallback(() => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = undefined;
        }
        if (healthCheckTimeoutRef.current) {
            clearTimeout(healthCheckTimeoutRef.current);
            healthCheckTimeoutRef.current = undefined;
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = undefined;
        }
    }, []);

    const attemptReconnect = useCallback(() => {
        if (health.reconnectAttempts >= maxReconnectAttempts) {
            updateHealth({
                status: 'error',
                errorMessage: 'Max reconnection attempts reached',
                isHealthy: false,
            });
            onReconnectFailed?.();
            return;
        }

        updateHealth({
            status: 'connecting',
            reconnectAttempts: health.reconnectAttempts + 1,
        });

        // Exponential backoff for reconnection
        const delay = Math.min(1000 * Math.pow(2, health.reconnectAttempts), 30000);

        reconnectTimeoutRef.current = setTimeout(() => {
            if (socket && !socket.connected) {
                socket.connect();
            }
        }, delay);
    }, [health.reconnectAttempts, maxReconnectAttempts, socket, updateHealth, onReconnectFailed]);

    // Set up socket event listeners
    useEffect(() => {
        if (!socket) {
            updateHealth({
                status: 'disconnected',
                isHealthy: false,
            });
            return;
        }

        const handleConnect = () => {
            updateHealth({
                status: 'connected',
                reconnectAttempts: 0,
                errorMessage: undefined,
            });
            startHealthMonitoring();
        };

        const handleDisconnect = (reason: string) => {
            updateHealth({
                status: 'disconnected',
                errorMessage: reason,
                isHealthy: false,
            });
            stopHealthMonitoring();

            // Auto-reconnect unless it was a manual disconnect
            if (reason !== 'io client disconnect') {
                attemptReconnect();
            }
        };

        const handleConnectError = (error: Error) => {
            updateHealth({
                status: 'error',
                errorMessage: error.message,
                isHealthy: false,
            });
            attemptReconnect();
        };

        const handleReconnect = () => {
            updateHealth({
                status: 'connected',
                reconnectAttempts: 0,
                errorMessage: undefined,
            });
            startHealthMonitoring();
        };

        // Register event listeners
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);
        socket.on('reconnect', handleReconnect);
        socket.on('pong', handlePong);

        // Start monitoring if already connected
        if (socket.connected) {
            handleConnect();
        }

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('connect_error', handleConnectError);
            socket.off('reconnect', handleReconnect);
            socket.off('pong', handlePong);
            stopHealthMonitoring();
        };
    }, [socket, startHealthMonitoring, stopHealthMonitoring, attemptReconnect, handlePong, updateHealth]);

    const manualReconnect = useCallback(() => {
        if (socket) {
            updateHealth({
                status: 'connecting',
                reconnectAttempts: 0,
            });
            socket.disconnect();
            socket.connect();
        }
    }, [socket, updateHealth]);

    const resetReconnectAttempts = useCallback(() => {
        updateHealth({
            reconnectAttempts: 0,
        });
    }, [updateHealth]);

    return {
        health,
        manualReconnect,
        resetReconnectAttempts,
        startHealthMonitoring,
        stopHealthMonitoring,
    };
};