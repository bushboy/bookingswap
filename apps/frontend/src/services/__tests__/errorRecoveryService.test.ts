import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    ErrorRecoveryService,
    CircuitBreakerState,
    errorRecoveryService
} from '../errorRecoveryService';
import { SwapPlatformError, ERROR_CODES } from '@booking-swap/shared';

describe('ErrorRecoveryService', () => {
    let service: ErrorRecoveryService;

    beforeEach(() => {
        service = new ErrorRecoveryService();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    describe('executeWithRecovery', () => {
        it('should succeed on first attempt when operation succeeds', async () => {
            const mockOperation = vi.fn().mockResolvedValue('success');

            const result = await service.executeWithRecovery(
                mockOperation,
                'test-operation'
            );

            expect(result.success).toBe(true);
            expect(result.data).toBe('success');
            expect(result.attemptCount).toBe(1);
            expect(result.totalDelay).toBe(0);
            expect(result.circuitBreakerTriggered).toBe(false);
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });

        it('should retry with exponential backoff on retryable errors', async () => {
            const mockOperation = vi
                .fn()
                .mockRejectedValueOnce(new Error('Network timeout'))
                .mockRejectedValueOnce(new Error('Connection failed'))
                .mockResolvedValue('success');

            const resultPromise = service.executeWithRecovery(
                mockOperation,
                'test-operation',
                { maxAttempts: 3, baseDelay: 1000 }
            );

            // Fast-forward through delays
            await vi.advanceTimersByTimeAsync(1000); // First retry delay
            await vi.advanceTimersByTimeAsync(2000); // Second retry delay

            const result = await resultPromise;

            expect(result.success).toBe(true);
            expect(result.data).toBe('success');
            expect(result.attemptCount).toBe(3);
            expect(result.totalDelay).toBeGreaterThan(0);
            expect(mockOperation).toHaveBeenCalledTimes(3);
        });

        it('should not retry non-retryable errors', async () => {
            const mockOperation = vi
                .fn()
                .mockRejectedValue(new SwapPlatformError(
                    ERROR_CODES.ACCESS_DENIED,
                    'Access denied',
                    'authorization',
                    false // Not retryable
                ));

            const result = await service.executeWithRecovery(
                mockOperation,
                'test-operation'
            );

            expect(result.success).toBe(false);
            expect(result.attemptCount).toBe(1);
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });

        it('should respect max attempts limit', async () => {
            const mockOperation = vi.fn().mockRejectedValue(new Error('Network error'));

            const result = await service.executeWithRecovery(
                mockOperation,
                'test-operation',
                { maxAttempts: 2, baseDelay: 100 }
            );

            // Fast-forward through delay
            await vi.advanceTimersByTimeAsync(200);

            expect(result.success).toBe(false);
            expect(result.attemptCount).toBe(2);
            expect(mockOperation).toHaveBeenCalledTimes(2);
        });

        it('should apply jitter to delays when enabled', async () => {
            const mockOperation = vi
                .fn()
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValue('success');

            // Mock Math.random to return predictable values
            const originalRandom = Math.random;
            Math.random = vi.fn().mockReturnValue(0.5);

            const resultPromise = service.executeWithRecovery(
                mockOperation,
                'test-operation',
                { maxAttempts: 2, baseDelay: 1000, jitter: true }
            );

            // The delay should be modified by jitter
            await vi.advanceTimersByTimeAsync(1000);

            const result = await resultPromise;

            expect(result.success).toBe(true);
            expect(mockOperation).toHaveBeenCalledTimes(2);

            // Restore Math.random
            Math.random = originalRandom;
        });
    });

    describe('Circuit Breaker', () => {
        it('should open circuit after failure threshold is reached', async () => {
            const mockOperation = vi.fn().mockRejectedValue(new Error('Service error'));

            // Trigger failures to reach threshold (default is 5)
            for (let i = 0; i < 5; i++) {
                await service.executeWithRecovery(
                    mockOperation,
                    'circuit-test',
                    { maxAttempts: 1 }
                );
            }

            const stats = service.getCircuitBreakerStats('circuit-test');
            expect(stats?.state).toBe(CircuitBreakerState.OPEN);
            expect(stats?.failureCount).toBe(5);
        });

        it('should prevent execution when circuit is open', async () => {
            const mockOperation = vi.fn().mockRejectedValue(new Error('Service error'));

            // Trigger failures to open circuit
            for (let i = 0; i < 5; i++) {
                await service.executeWithRecovery(
                    mockOperation,
                    'circuit-test',
                    { maxAttempts: 1 }
                );
            }

            // Reset mock to track new calls
            mockOperation.mockClear();

            // Try to execute when circuit is open
            const result = await service.executeWithRecovery(
                mockOperation,
                'circuit-test',
                { maxAttempts: 1 }
            );

            expect(result.success).toBe(false);
            expect(result.circuitBreakerTriggered).toBe(true);
            expect(mockOperation).not.toHaveBeenCalled();
        });

        it('should transition to half-open after recovery timeout', async () => {
            const mockOperation = vi.fn().mockRejectedValue(new Error('Service error'));

            // Open the circuit
            for (let i = 0; i < 5; i++) {
                await service.executeWithRecovery(
                    mockOperation,
                    'circuit-test',
                    { maxAttempts: 1 },
                    { recoveryTimeout: 1000 }
                );
            }

            expect(service.getCircuitBreakerStats('circuit-test')?.state).toBe(CircuitBreakerState.OPEN);

            // Fast-forward past recovery timeout
            await vi.advanceTimersByTimeAsync(1000);

            // Next execution should be allowed (half-open state)
            mockOperation.mockResolvedValueOnce('success');
            const result = await service.executeWithRecovery(
                mockOperation,
                'circuit-test',
                { maxAttempts: 1 }
            );

            expect(result.success).toBe(true);
            expect(service.getCircuitBreakerStats('circuit-test')?.state).toBe(CircuitBreakerState.CLOSED);
        });

        it('should reset circuit breaker', async () => {
            const mockOperation = vi.fn().mockRejectedValue(new Error('Service error'));

            // Open the circuit
            for (let i = 0; i < 5; i++) {
                await service.executeWithRecovery(
                    mockOperation,
                    'circuit-test',
                    { maxAttempts: 1 }
                );
            }

            expect(service.getCircuitBreakerStats('circuit-test')?.state).toBe(CircuitBreakerState.OPEN);

            // Reset the circuit breaker
            service.resetCircuitBreaker('circuit-test');

            const stats = service.getCircuitBreakerStats('circuit-test');
            expect(stats?.state).toBe(CircuitBreakerState.CLOSED);
            expect(stats?.failureCount).toBe(0);
        });
    });

    describe('createManualRetry', () => {
        it('should create a manual retry function that executes immediately', async () => {
            const mockOperation = vi.fn().mockResolvedValue('manual success');
            const onSuccess = vi.fn();
            const onError = vi.fn();

            const manualRetry = service.createManualRetry(
                mockOperation,
                'manual-test',
                onSuccess,
                onError
            );

            await manualRetry();

            expect(mockOperation).toHaveBeenCalledTimes(1);
            expect(onSuccess).toHaveBeenCalledWith('manual success');
            expect(onError).not.toHaveBeenCalled();
        });

        it('should handle manual retry errors', async () => {
            const mockOperation = vi.fn().mockRejectedValue(new Error('Manual retry failed'));
            const onSuccess = vi.fn();
            const onError = vi.fn();

            const manualRetry = service.createManualRetry(
                mockOperation,
                'manual-test',
                onSuccess,
                onError
            );

            await manualRetry();

            expect(mockOperation).toHaveBeenCalledTimes(1);
            expect(onSuccess).not.toHaveBeenCalled();
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('Error Classification', () => {
        it('should identify retryable SwapPlatformError', async () => {
            const retryableError = new SwapPlatformError(
                ERROR_CODES.NETWORK_ERROR,
                'Network error',
                'integration',
                true
            );

            const mockOperation = vi
                .fn()
                .mockRejectedValueOnce(retryableError)
                .mockResolvedValue('success');

            const result = await service.executeWithRecovery(
                mockOperation,
                'retry-test',
                { maxAttempts: 2, baseDelay: 100 }
            );

            await vi.advanceTimersByTimeAsync(200);

            expect(result.success).toBe(true);
            expect(mockOperation).toHaveBeenCalledTimes(2);
        });

        it('should not retry AbortError', async () => {
            const abortError = new Error('Request aborted');
            abortError.name = 'AbortError';

            const mockOperation = vi.fn().mockRejectedValue(abortError);

            const result = await service.executeWithRecovery(
                mockOperation,
                'abort-test'
            );

            expect(result.success).toBe(false);
            expect(result.attemptCount).toBe(1);
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });

        it('should retry network-related errors', async () => {
            const networkErrors = [
                new Error('Network timeout'),
                new Error('Connection failed'),
                new Error('fetch failed'),
                new Error('ECONNRESET'),
                new Error('ENOTFOUND'),
            ];

            for (const error of networkErrors) {
                const mockOperation = vi
                    .fn()
                    .mockRejectedValueOnce(error)
                    .mockResolvedValue('success');

                const result = await service.executeWithRecovery(
                    mockOperation,
                    `network-test-${error.message}`,
                    { maxAttempts: 2, baseDelay: 100 }
                );

                await vi.advanceTimersByTimeAsync(200);

                expect(result.success).toBe(true);
                expect(mockOperation).toHaveBeenCalledTimes(2);
            }
        });
    });

    describe('Statistics and Monitoring', () => {
        it('should provide circuit breaker statistics', async () => {
            const mockOperation = vi.fn().mockRejectedValue(new Error('Test error'));

            await service.executeWithRecovery(
                mockOperation,
                'stats-test',
                { maxAttempts: 1 }
            );

            const stats = service.getCircuitBreakerStats('stats-test');
            expect(stats).toBeDefined();
            expect(stats?.failureCount).toBe(1);
            expect(stats?.lastFailureTime).toBeGreaterThan(0);
        });

        it('should provide all circuit breaker statistics', async () => {
            const mockOperation1 = vi.fn().mockRejectedValue(new Error('Error 1'));
            const mockOperation2 = vi.fn().mockResolvedValue('Success 2');

            await service.executeWithRecovery(mockOperation1, 'test-1', { maxAttempts: 1 });
            await service.executeWithRecovery(mockOperation2, 'test-2', { maxAttempts: 1 });

            const allStats = service.getAllCircuitBreakerStats();
            expect(Object.keys(allStats)).toHaveLength(2);
            expect(allStats['test-1']).toBeDefined();
            expect(allStats['test-2']).toBeDefined();
        });

        it('should return null for non-existent circuit breaker', () => {
            const stats = service.getCircuitBreakerStats('non-existent');
            expect(stats).toBeNull();
        });
    });

    describe('Configuration', () => {
        it('should use custom retry configuration', async () => {
            const mockOperation = vi
                .fn()
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValue('success');

            const customConfig = {
                maxAttempts: 5,
                baseDelay: 500,
                maxDelay: 2000,
                backoffMultiplier: 3,
                jitter: false,
            };

            const resultPromise = service.executeWithRecovery(
                mockOperation,
                'custom-config-test',
                customConfig
            );

            // Fast-forward through the custom delay
            await vi.advanceTimersByTimeAsync(500);

            const result = await resultPromise;

            expect(result.success).toBe(true);
            expect(result.attemptCount).toBe(2);
            expect(mockOperation).toHaveBeenCalledTimes(2);
        });

        it('should use custom circuit breaker configuration', async () => {
            const mockOperation = vi.fn().mockRejectedValue(new Error('Service error'));

            const customCircuitConfig = {
                failureThreshold: 2, // Lower threshold
                recoveryTimeout: 500,
                monitoringPeriod: 1000,
                successThreshold: 1,
            };

            // Trigger failures to reach custom threshold
            for (let i = 0; i < 2; i++) {
                await service.executeWithRecovery(
                    mockOperation,
                    'custom-circuit-test',
                    { maxAttempts: 1 },
                    customCircuitConfig
                );
            }

            const stats = service.getCircuitBreakerStats('custom-circuit-test');
            expect(stats?.state).toBe(CircuitBreakerState.OPEN);
            expect(stats?.failureCount).toBe(2);
        });
    });
});

describe('Singleton errorRecoveryService', () => {
    it('should be a singleton instance', () => {
        expect(errorRecoveryService).toBeInstanceOf(ErrorRecoveryService);
    });

    it('should maintain state across calls', async () => {
        const mockOperation = vi.fn().mockRejectedValue(new Error('Test error'));

        await errorRecoveryService.executeWithRecovery(
            mockOperation,
            'singleton-test',
            { maxAttempts: 1 }
        );

        const stats = errorRecoveryService.getCircuitBreakerStats('singleton-test');
        expect(stats?.failureCount).toBe(1);
    });
});