/**
 * Configuration for WebSocket/Socket.IO realtime service
 * Handles environment variables and provides typed configuration
 */

export interface RealtimeConfig {
    // Connection Settings
    serverUrl: string;
    reconnectInterval: number;
    maxReconnectAttempts: number;
    connectionTimeout: number;

    // Heartbeat Settings
    heartbeatInterval: number;
    heartbeatTimeout: number;

    // Fallback Settings
    enableFallback: boolean;
    fallbackPollingInterval: number;
    fallbackEndpoints: string[];

    // Debug Settings
    debugMode: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
}

/**
 * Parse environment variable as number with fallback
 */
const parseEnvNumber = (value: string | undefined, fallback: number): number => {
    if (!value) return fallback;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
};

/**
 * Parse environment variable as boolean with fallback
 */
const parseEnvBoolean = (value: string | undefined, fallback: boolean): boolean => {
    if (!value) return fallback;
    return value.toLowerCase() === 'true';
};

/**
 * Parse log level with validation
 */
const parseLogLevel = (value: string | undefined): 'error' | 'warn' | 'info' | 'debug' => {
    const validLevels = ['error', 'warn', 'info', 'debug'] as const;
    if (!value || !validLevels.includes(value as any)) {
        return 'warn';
    }
    return value as 'error' | 'warn' | 'info' | 'debug';
};

/**
 * Get realtime service configuration from environment variables
 */
export const getRealtimeConfig = (): RealtimeConfig => {
    const config: RealtimeConfig = {
        // Connection Settings
        serverUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3001',
        reconnectInterval: parseEnvNumber(import.meta.env.VITE_WS_RECONNECT_INTERVAL, 5000),
        maxReconnectAttempts: parseEnvNumber(import.meta.env.VITE_WS_RECONNECT_ATTEMPTS, 10),
        connectionTimeout: parseEnvNumber(import.meta.env.VITE_WS_CONNECTION_TIMEOUT, 10000),

        // Heartbeat Settings
        heartbeatInterval: parseEnvNumber(import.meta.env.VITE_WS_HEARTBEAT_INTERVAL, 30000),
        heartbeatTimeout: parseEnvNumber(import.meta.env.VITE_WS_HEARTBEAT_TIMEOUT, 5000),

        // Fallback Settings
        enableFallback: parseEnvBoolean(import.meta.env.VITE_ENABLE_FALLBACK, true),
        fallbackPollingInterval: parseEnvNumber(import.meta.env.VITE_FALLBACK_POLLING_INTERVAL, 30000),
        fallbackEndpoints: [
            '/api/bookings/updates',
            '/api/swaps/updates',
            '/api/proposals/updates'
        ],

        // Debug Settings
        debugMode: parseEnvBoolean(import.meta.env.VITE_WS_DEBUG_MODE, false),
        logLevel: parseLogLevel(import.meta.env.VITE_WS_LOG_LEVEL),
    };

    // Validate configuration
    if (!config.serverUrl) {
        throw new Error('VITE_WS_URL environment variable is required');
    }

    if (config.maxReconnectAttempts < 1) {
        throw new Error('VITE_WS_RECONNECT_ATTEMPTS must be at least 1');
    }

    if (config.reconnectInterval < 1000) {
        throw new Error('VITE_WS_RECONNECT_INTERVAL must be at least 1000ms');
    }

    return config;
};

/**
 * Default configuration for testing and fallback
 */
export const DEFAULT_REALTIME_CONFIG: RealtimeConfig = {
    serverUrl: 'http://localhost:3001',
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    connectionTimeout: 10000,
    heartbeatInterval: 30000,
    heartbeatTimeout: 5000,
    enableFallback: true,
    fallbackPollingInterval: 30000,
    fallbackEndpoints: [
        '/api/bookings/updates',
        '/api/swaps/updates',
        '/api/proposals/updates'
    ],
    debugMode: false,
    logLevel: 'warn',
};