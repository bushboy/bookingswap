/**
 * Connection Throttling Utility Tests
 * 
 * Tests for the connection throttling and debouncing functionality.
 * Focuses on core functional logic only.
 */

/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    ConnectionThrottlingManager,
    ConnectionStateChecker,
    createThrottledConnection,
} from '../connectionThrottling';

describe('ConnectionThrottlingManager', () => {
    let manager: ConnectionThrottlingManager;
    let mockConnectFn: vi.MockedFunction<() => Promise<void>>;

    beforeEach(() => {
        vi.useFakeTimers();
        manager = new ConnectionThrottlingManager({
            debounceDelay: 100,
            maxRetries: 3,
            retryDelay: 200,
            maxAttemptsPerWindow: 5,
            rateLimitWindow: 1000,
        });
        mockConnectFn = vi.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('debounceConnection', () => {
        it('should debounce connection attempts', async () => {
            const serviceId = 'test-service';

            // Make multiple rapid connection attempts
            const promise1 = manager.debounceConnection(serviceId, mockConnectFn);
            const promise2 = manager.debounceConnection(serviceId, mockConnectFn);
            const promise3 = manager.debounceConnection(serviceId, mockConnectFn);

            // Fast-forward time to trigger debounced connection
            vi.advanceTimersByTime(100);

            // Wait for all promises to settle
            const results = await Promise.allSettled([promise1, promise2, promise3]);

            // Only the last connection attempt should be executed
            expect(mockConnectFn).toHaveBeenCalledTimes(1);

            // The first two should be rejected due to debouncing, the last should resolve
            expect(results[0].status).toBe('rejected');
            expect(results[1].status).toBe('rejected');
            expect(results[2].status).toBe('fulfilled');
        });

        it('should track connection attempts', async () => {
            const serviceId = 'test-service';

            const promise = manager.debounceConnection(serviceId, mockConnectFn);
            vi.advanceTimersByTime(100);
            await promise;

            const status = manager.getConnectionStatus(serviceId);
            expect(status.attemptCount).toBe(0); // Reset after successful connection
            expect(status.lastAttempt).toBeGreaterThan(0);
        });

        it('should respect rate limiting', async () => {
            const serviceId = 'test-service';

            // Make maximum allowed attempts
            for (let i = 0; i < 5; i++) {
                const promise = manager.debounceConnection(serviceId, mockConnectFn);
                vi.advanceTimersByTime(100);
                await promise;
            }

            // Next attempt should be rejected due to rate limiting
            await expect(
                manager.debounceConnection(serviceId, mockConnectFn)
            ).rejects.toThrow('Connection rate limit exceeded');
        });
    });

    describe('canConnect', () => {
        it('should allow connection for new service', () => {
            expect(manager.canConnect('new-service')).toBe(true);
        });

        it('should prevent connection when already connecting', async () => {
            const serviceId = 'test-service';

            // Start a connection (don't await)
            manager.debounceConnection(serviceId, mockConnectFn);

            // Should not allow another connection while one is pending
            expect(manager.canConnect(serviceId)).toBe(false);
        });

        it('should enforce retry delays', async () => {
            const serviceId = 'test-service';
            const failingConnectFn = vi.fn().mockRejectedValue(new Error('Connection failed'));

            // Make a failed connection attempt
            try {
                const promise = manager.debounceConnection(serviceId, failingConnectFn);
                vi.advanceTimersByTime(100);
                await promise;
            } catch {
                // Expected to fail
            }

            // Should not allow immediate retry
            expect(manager.canConnect(serviceId)).toBe(false);

            // Should allow retry after delay
            vi.advanceTimersByTime(200);
            expect(manager.canConnect(serviceId)).toBe(true);
        });
    });

    describe('getConnectionStatus', () => {
        it('should return correct status for new service', () => {
            const status = manager.getConnectionStatus('new-service');

            expect(status.canConnect).toBe(true);
            expect(status.isConnecting).toBe(false);
            expect(status.isPending).toBe(false);
            expect(status.attemptCount).toBe(0);
            expect(status.lastAttempt).toBeNull();
            expect(status.attemptsInWindow).toBe(0);
        });

        it('should track connection state correctly', async () => {
            const serviceId = 'test-service';

            // Start connection
            const promise = manager.debounceConnection(serviceId, mockConnectFn);

            let status = manager.getConnectionStatus(serviceId);
            expect(status.isPending).toBe(true);

            // Complete connection
            vi.advanceTimersByTime(100);
            await promise;

            status = manager.getConnectionStatus(serviceId);
            expect(status.isPending).toBe(false);
            expect(status.attemptCount).toBe(0); // Reset after success
        });
    });

    describe('resetConnectionTracking', () => {
        it('should reset all tracking data', async () => {
            const serviceId = 'test-service';

            // Make a connection attempt
            const promise = manager.debounceConnection(serviceId, mockConnectFn);
            vi.advanceTimersByTime(100);
            await promise;

            // Reset tracking
            manager.resetConnectionTracking(serviceId);

            const status = manager.getConnectionStatus(serviceId);
            expect(status.attemptCount).toBe(0);
            expect(status.lastAttempt).toBeNull();
            expect(status.attemptsInWindow).toBe(0);
        });
    });
});

describe('ConnectionStateChecker', () => {
    let checker: ConnectionStateChecker;

    beforeEach(() => {
        checker = new ConnectionStateChecker();
    });

    describe('connection state management', () => {
        it('should track connection state correctly', () => {
            const serviceId = 'test-service';

            expect(checker.isConnected(serviceId)).toBe(false);

            checker.setConnectionState(serviceId, true);
            expect(checker.isConnected(serviceId)).toBe(true);

            checker.setConnectionState(serviceId, false);
            expect(checker.isConnected(serviceId)).toBe(false);
        });

        it('should prevent connection when already connected', () => {
            const serviceId = 'test-service';

            checker.setConnectionState(serviceId, true);
            expect(checker.canConnect(serviceId)).toBe(false);
        });

        it('should allow connection when not connected', () => {
            const serviceId = 'test-service';

            checker.setConnectionState(serviceId, false);
            expect(checker.canConnect(serviceId)).toBe(true);
        });
    });

    describe('getConnectionStatus', () => {
        it('should return comprehensive status', () => {
            const serviceId = 'test-service';

            const status = checker.getConnectionStatus(serviceId);

            expect(status).toHaveProperty('isConnected');
            expect(status).toHaveProperty('canConnect');
            expect(status).toHaveProperty('throttlingStatus');
            expect(status.throttlingStatus).toHaveProperty('attemptCount');
        });
    });
});

describe('createThrottledConnection', () => {
    let mockConnectFn: vi.MockedFunction<() => Promise<void>>;

    beforeEach(() => {
        vi.useFakeTimers();
        mockConnectFn = vi.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should create a throttled connection function', async () => {
        const throttledConnect = createThrottledConnection('test-service', mockConnectFn);

        // Make multiple rapid calls
        const promise1 = throttledConnect();
        const promise2 = throttledConnect();

        vi.advanceTimersByTime(1000); // Default debounce delay

        await Promise.allSettled([promise1, promise2]);

        // Should only execute once due to throttling
        expect(mockConnectFn).toHaveBeenCalledTimes(1);
    });

    it('should use custom configuration', async () => {
        const throttledConnect = createThrottledConnection(
            'test-service',
            mockConnectFn,
            { debounceDelay: 50 }
        );

        const promise = throttledConnect();
        vi.advanceTimersByTime(50); // Custom delay
        await promise;

        expect(mockConnectFn).toHaveBeenCalledTimes(1);
    });
});