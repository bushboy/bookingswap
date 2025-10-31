import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionManager, ConnectionStatus } from '../connectionManager';
import { ExponentialBackoff } from '../exponentialBackoff';

// Mock Socket.IO
const mockSocket = {
    connected: false,
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    auth: {}
};

vi.mock('socket.io-client', () => ({
    io: vi.fn(() => mockSocket)
}));

describe('ExponentialBackoff', () => {
    let backoff: ExponentialBackoff;

    beforeEach(() => {
        backoff = new ExponentialBackoff(1000, 10000, false); // No jitter for predictable tests
    });

    it('should calculate exponential delays correctly', () => {
        expect(backoff.getNextDelay()).toBe(1000); // 2^0 * 1000

        backoff.increment();
        expect(backoff.getNextDelay()).toBe(2000); // 2^1 * 1000

        backoff.increment();
        expect(backoff.getNextDelay()).toBe(4000); // 2^2 * 1000

        backoff.increment();
        expect(backoff.getNextDelay()).toBe(8000); // 2^3 * 1000

        backoff.increment();
        expect(backoff.getNextDelay()).toBe(10000); // Capped at maxDelay
    });

    it('should reset attempt counter', () => {
        backoff.increment();
        backoff.increment();
        expect(backoff.getCurrentAttempt()).toBe(2);

        backoff.reset();
        expect(backoff.getCurrentAttempt()).toBe(0);
        expect(backoff.getNextDelay()).toBe(1000);
    });

    it('should add jitter when enabled', () => {
        const backoffWithJitter = new ExponentialBackoff(1000, 10000, true);
        const delay1 = backoffWithJitter.getNextDelay();
        const delay2 = backoffWithJitter.getNextDelay();

        // With jitter, delays should be different (though this could rarely fail)
        expect(delay1).toBeGreaterThanOrEqual(1000);
        expect(delay1).toBeLessThanOrEqual(2000);
    });

    it('should detect when at max delay', () => {
        expect(backoff.isAtMaxDelay()).toBe(false);

        // Increment enough times to reach max delay
        for (let i = 0; i < 5; i++) {
            backoff.increment();
        }

        expect(backoff.isAtMaxDelay()).toBe(true);
    });
});

describe('ConnectionManager', () => {
    let connectionManager: ConnectionManager;
    let mockConfig: any;

    beforeEach(() => {
        mockConfig = {
            url: 'http://localhost:3001',
            maxReconnectAttempts: 3,
            connectionTimeout: 5000,
            heartbeatInterval: 30000,
            heartbeatTimeout: 5000
        };

        connectionManager = new ConnectionManager(mockConfig);

        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn(() => 'mock-token'),
                setItem: vi.fn(),
                removeItem: vi.fn(),
            },
            writable: true,
        });
    });

    afterEach(() => {
        connectionManager.disconnect();
        vi.clearAllMocks();
    });

    it('should initialize with disconnected status', () => {
        expect(connectionManager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should emit status change events', () => {
        const statusChangeSpy = vi.fn();
        connectionManager.on('statusChanged', statusChangeSpy);

        // Manually trigger status change for testing
        connectionManager['setStatus'](ConnectionStatus.CONNECTING);

        expect(statusChangeSpy).toHaveBeenCalledWith({
            status: ConnectionStatus.CONNECTING,
            previousStatus: ConnectionStatus.DISCONNECTED
        });
    });

    it('should handle disconnection and schedule reconnection', () => {
        const disconnectedSpy = vi.fn();
        connectionManager.on('disconnected', disconnectedSpy);

        connectionManager.handleDisconnection('network_error');

        expect(disconnectedSpy).toHaveBeenCalledWith({
            reason: 'network_error',
            willReconnect: true
        });
        expect(connectionManager.getStatus()).toBe(ConnectionStatus.RECONNECTING);
    });

    it('should not reconnect on server disconnect', () => {
        const disconnectedSpy = vi.fn();
        connectionManager.on('disconnected', disconnectedSpy);

        connectionManager.handleDisconnection('io server disconnect');

        expect(disconnectedSpy).toHaveBeenCalledWith({
            reason: 'io server disconnect',
            willReconnect: false
        });
        expect(connectionManager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should emit permanent failure after max attempts', () => {
        const permanentFailureSpy = vi.fn();
        connectionManager.on('permanentFailure', permanentFailureSpy);

        // Simulate reaching max attempts
        for (let i = 0; i < mockConfig.maxReconnectAttempts + 1; i++) {
            connectionManager.handleDisconnection('network_error');
        }

        expect(permanentFailureSpy).toHaveBeenCalledWith({
            reason: 'Max reconnection attempts reached'
        });
        expect(connectionManager.getStatus()).toBe(ConnectionStatus.FAILED);
    });

    it('should check connection health correctly', () => {
        // Mock socket as disconnected
        connectionManager['socket'] = null;
        expect(connectionManager.checkConnectionHealth()).toBe(false);

        // Mock socket as connected with recent heartbeat
        connectionManager['socket'] = { connected: true, disconnect: vi.fn() } as any;
        connectionManager['lastHeartbeatResponse'] = Date.now() - 1000; // 1 second ago
        expect(connectionManager.checkConnectionHealth()).toBe(true);

        // Mock socket as connected with old heartbeat
        connectionManager['lastHeartbeatResponse'] = Date.now() - 70000; // 70 seconds ago
        expect(connectionManager.checkConnectionHealth()).toBe(false);
    });
});