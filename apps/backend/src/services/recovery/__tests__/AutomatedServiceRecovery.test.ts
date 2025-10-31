import { AutomatedServiceRecovery } from '../AutomatedServiceRecovery';
import { FallbackBookingService } from '../FallbackBookingService';

// Mock logger
jest.mock('../../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

describe('AutomatedServiceRecovery', () => {
    let recovery: AutomatedServiceRecovery;
    let mockService: any;
    let fallbackService: FallbackBookingService;

    beforeEach(() => {
        recovery = new AutomatedServiceRecovery({
            maxRetries: 2,
            retryDelayMs: 100,
            circuitBreakerThreshold: 3,
            healthCheckIntervalMs: 1000,
            enableFallback: true
        });

        mockService = {
            testMethod: jest.fn(),
            getBookingById: jest.fn(),
            createBooking: jest.fn()
        };

        fallbackService = new FallbackBookingService();
    });

    afterEach(() => {
        recovery.shutdown();
    });

    describe('Service Registration', () => {
        it('should register a service for monitoring', () => {
            recovery.registerService('TestService', mockService);

            const health = recovery.getServiceHealth('TestService');
            expect(health).toBeTruthy();
            expect(health?.serviceName).toBe('TestService');
            expect(health?.isHealthy).toBe(true);
        });

        it('should register fallback service', () => {
            recovery.registerFallbackService('TestService', fallbackService);

            // This should not throw when fallback is used
            expect(() => {
                recovery.registerFallbackService('TestService', fallbackService);
            }).not.toThrow();
        });
    });

    describe('Method Execution with Recovery', () => {
        beforeEach(() => {
            recovery.registerService('TestService', mockService);
            recovery.registerFallbackService('TestService', fallbackService);
        });

        it('should execute method successfully on first try', async () => {
            const expectedResult = { success: true };
            mockService.testMethod.mockResolvedValue(expectedResult);

            const result = await recovery.executeWithRecovery(
                'TestService',
                'testMethod',
                mockService,
                ['arg1', 'arg2']
            );

            expect(result).toEqual(expectedResult);
            expect(mockService.testMethod).toHaveBeenCalledWith('arg1', 'arg2');
            expect(mockService.testMethod).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure and succeed', async () => {
            const expectedResult = { success: true };
            mockService.testMethod
                .mockRejectedValueOnce(new Error('First failure'))
                .mockResolvedValue(expectedResult);

            const result = await recovery.executeWithRecovery(
                'TestService',
                'testMethod',
                mockService,
                ['arg1']
            );

            expect(result).toEqual(expectedResult);
            expect(mockService.testMethod).toHaveBeenCalledTimes(2);
        });

        it('should use fallback after max retries', async () => {
            mockService.testMethod.mockRejectedValue(new Error('Persistent failure'));

            // Mock fallback method
            const fallbackResult = { id: 'test', isFallback: true };
            jest.spyOn(fallbackService, 'getBookingById').mockResolvedValue(fallbackResult);

            const result = await recovery.executeWithRecovery(
                'TestService',
                'getBookingById',
                mockService,
                ['booking123']
            );

            expect(result).toEqual(fallbackResult);
            expect(mockService.testMethod).toHaveBeenCalledTimes(2); // maxRetries
        });

        it('should open circuit breaker after threshold failures', async () => {
            mockService.testMethod.mockRejectedValue(new Error('Persistent failure'));

            // Execute enough times to trigger circuit breaker
            for (let i = 0; i < 3; i++) {
                try {
                    await recovery.executeWithRecovery('TestService', 'testMethod', mockService);
                } catch (error) {
                    // Expected to fail
                }
            }

            const health = recovery.getServiceHealth('TestService');
            expect(health?.circuitBreakerOpen).toBe(true);
        });

        it('should throw error when method does not exist', async () => {
            await expect(
                recovery.executeWithRecovery('TestService', 'nonExistentMethod', mockService)
            ).rejects.toThrow('Method nonExistentMethod not available on service TestService');
        });

        it('should throw error when service is not registered', async () => {
            await expect(
                recovery.executeWithRecovery('UnknownService', 'testMethod', mockService)
            ).rejects.toThrow('Service UnknownService not registered for recovery');
        });
    });

    describe('Health Checks', () => {
        it('should perform health check on BookingService', async () => {
            const bookingService = {
                getBookingById: jest.fn(),
                createBooking: jest.fn(),
                updateBooking: jest.fn()
            };

            const isHealthy = await recovery.performHealthCheck('BookingService', bookingService);
            expect(isHealthy).toBe(true);
        });

        it('should fail health check for BookingService missing methods', async () => {
            const incompleteService = {
                getBookingById: jest.fn()
                // Missing createBooking and updateBooking
            };

            const isHealthy = await recovery.performHealthCheck('BookingService', incompleteService);
            expect(isHealthy).toBe(false);
        });

        it('should handle health check errors gracefully', async () => {
            const isHealthy = await recovery.performHealthCheck('TestService', null);
            expect(isHealthy).toBe(false);
        });
    });

    describe('Circuit Breaker', () => {
        beforeEach(() => {
            recovery.registerService('TestService', mockService);
        });

        it('should reset circuit breaker', () => {
            // Manually set circuit breaker to open
            const health = recovery.getServiceHealth('TestService');
            if (health) {
                health.circuitBreakerOpen = true;
                health.consecutiveFailures = 5;
            }

            recovery.resetCircuitBreaker('TestService');

            const updatedHealth = recovery.getServiceHealth('TestService');
            expect(updatedHealth?.circuitBreakerOpen).toBe(false);
            expect(updatedHealth?.consecutiveFailures).toBe(0);
        });

        it('should get all service health statuses', () => {
            recovery.registerService('Service1', mockService);
            recovery.registerService('Service2', mockService);

            const allHealth = recovery.getAllServiceHealth();
            expect(allHealth).toHaveLength(2);
            expect(allHealth.map(h => h.serviceName)).toContain('Service1');
            expect(allHealth.map(h => h.serviceName)).toContain('Service2');
        });
    });

    describe('Fallback Execution', () => {
        it('should execute fallback when circuit breaker is open', async () => {
            recovery.registerService('TestService', mockService);
            recovery.registerFallbackService('TestService', fallbackService);

            // Open circuit breaker
            const health = recovery.getServiceHealth('TestService');
            if (health) {
                health.circuitBreakerOpen = true;
            }

            const fallbackResult = { id: 'test', isFallback: true };
            jest.spyOn(fallbackService, 'getBookingById').mockResolvedValue(fallbackResult);

            const result = await recovery.executeWithRecovery(
                'TestService',
                'getBookingById',
                mockService,
                ['booking123']
            );

            expect(result).toEqual(fallbackResult);
            expect(mockService.getBookingById).not.toHaveBeenCalled();
        });

        it('should throw error when fallback is not available', async () => {
            recovery.registerService('TestService', mockService);
            // No fallback registered

            mockService.testMethod.mockRejectedValue(new Error('Service failure'));

            await expect(
                recovery.executeWithRecovery('TestService', 'testMethod', mockService)
            ).rejects.toThrow();
        });
    });

    describe('Configuration', () => {
        it('should use custom configuration', () => {
            const customRecovery = new AutomatedServiceRecovery({
                maxRetries: 5,
                retryDelayMs: 2000,
                circuitBreakerThreshold: 10,
                enableFallback: false
            });

            expect(customRecovery).toBeDefined();
            customRecovery.shutdown();
        });

        it('should use default configuration when none provided', () => {
            const defaultRecovery = new AutomatedServiceRecovery();
            expect(defaultRecovery).toBeDefined();
            defaultRecovery.shutdown();
        });
    });
});