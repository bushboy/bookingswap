/**
 * Tests for realtime configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRealtimeConfig, DEFAULT_REALTIME_CONFIG } from '../realtimeConfig';

// Mock import.meta.env
const mockEnv = {
    VITE_WS_URL: 'http://test:3001',
    VITE_WS_RECONNECT_INTERVAL: '3000',
    VITE_WS_RECONNECT_ATTEMPTS: '5',
    VITE_WS_CONNECTION_TIMEOUT: '8000',
    VITE_WS_HEARTBEAT_INTERVAL: '25000',
    VITE_WS_HEARTBEAT_TIMEOUT: '4000',
    VITE_ENABLE_FALLBACK: 'true',
    VITE_FALLBACK_POLLING_INTERVAL: '20000',
    VITE_WS_DEBUG_MODE: 'true',
    VITE_WS_LOG_LEVEL: 'debug',
};

vi.stubGlobal('import', {
    meta: {
        env: mockEnv,
    },
});

describe('RealtimeConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getRealtimeConfig', () => {
        it('should return configuration with environment variables', () => {
            const config = getRealtimeConfig();

            expect(config).toEqual({
                serverUrl: 'http://test:3001',
                reconnectInterval: 3000,
                maxReconnectAttempts: 5,
                connectionTimeout: 8000,
                heartbeatInterval: 25000,
                heartbeatTimeout: 4000,
                enableFallback: true,
                fallbackPollingInterval: 20000,
                fallbackEndpoints: [
                    '/api/bookings/updates',
                    '/api/swaps/updates',
                    '/api/proposals/updates'
                ],
                debugMode: true,
                logLevel: 'debug',
            });
        });

        it('should use default values when environment variables are not set', () => {
            vi.stubGlobal('import', {
                meta: {
                    env: {},
                },
            });

            const config = getRealtimeConfig();

            expect(config.serverUrl).toBe('http://localhost:3001');
            expect(config.reconnectInterval).toBe(5000);
            expect(config.maxReconnectAttempts).toBe(10);
            expect(config.connectionTimeout).toBe(10000);
            expect(config.heartbeatInterval).toBe(30000);
            expect(config.heartbeatTimeout).toBe(5000);
            expect(config.enableFallback).toBe(true);
            expect(config.fallbackPollingInterval).toBe(30000);
            expect(config.debugMode).toBe(false);
            expect(config.logLevel).toBe('warn');
        });

        it('should handle invalid numeric values gracefully', () => {
            vi.stubGlobal('import', {
                meta: {
                    env: {
                        VITE_WS_RECONNECT_INTERVAL: 'invalid',
                        VITE_WS_RECONNECT_ATTEMPTS: 'not-a-number',
                    },
                },
            });

            const config = getRealtimeConfig();

            expect(config.reconnectInterval).toBe(5000); // fallback
            expect(config.maxReconnectAttempts).toBe(10); // fallback
        });

        it('should handle invalid boolean values gracefully', () => {
            vi.stubGlobal('import', {
                meta: {
                    env: {
                        VITE_ENABLE_FALLBACK: 'invalid',
                        VITE_WS_DEBUG_MODE: 'not-boolean',
                    },
                },
            });

            const config = getRealtimeConfig();

            expect(config.enableFallback).toBe(true); // fallback
            expect(config.debugMode).toBe(false); // fallback
        });

        it('should handle invalid log level gracefully', () => {
            vi.stubGlobal('import', {
                meta: {
                    env: {
                        VITE_WS_LOG_LEVEL: 'invalid-level',
                    },
                },
            });

            const config = getRealtimeConfig();

            expect(config.logLevel).toBe('warn'); // fallback
        });

        it('should validate required configuration', () => {
            vi.stubGlobal('import', {
                meta: {
                    env: {
                        VITE_WS_URL: '',
                    },
                },
            });

            expect(() => getRealtimeConfig()).toThrow('VITE_WS_URL environment variable is required');
        });

        it('should validate reconnection attempts', () => {
            vi.stubGlobal('import', {
                meta: {
                    env: {
                        VITE_WS_URL: 'http://localhost:3001',
                        VITE_WS_RECONNECT_ATTEMPTS: '0',
                    },
                },
            });

            expect(() => getRealtimeConfig()).toThrow('VITE_WS_RECONNECT_ATTEMPTS must be at least 1');
        });

        it('should validate reconnection interval', () => {
            vi.stubGlobal('import', {
                meta: {
                    env: {
                        VITE_WS_URL: 'http://localhost:3001',
                        VITE_WS_RECONNECT_INTERVAL: '500',
                    },
                },
            });

            expect(() => getRealtimeConfig()).toThrow('VITE_WS_RECONNECT_INTERVAL must be at least 1000ms');
        });
    });

    describe('DEFAULT_REALTIME_CONFIG', () => {
        it('should have valid default configuration', () => {
            expect(DEFAULT_REALTIME_CONFIG).toEqual({
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
            });
        });
    });
});