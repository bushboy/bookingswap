import { logger } from '../../utils/logger';
import { FallbackBookingService } from './FallbackBookingService';

export interface FallbackServiceConfig {
    enableCaching: boolean;
    cacheTimeout: number;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
}

/**
 * Factory for creating fallback service instances
 * Provides standardized fallback services for when primary services fail
 */
export class FallbackServiceFactory {
    private static instance: FallbackServiceFactory;
    private config: FallbackServiceConfig;
    private fallbackInstances: Map<string, any> = new Map();

    constructor(config: Partial<FallbackServiceConfig> = {}) {
        this.config = {
            enableCaching: true,
            cacheTimeout: 300000, // 5 minutes
            logLevel: 'warn',
            ...config
        };
    }

    /**
     * Get singleton instance
     */
    static getInstance(config?: Partial<FallbackServiceConfig>): FallbackServiceFactory {
        if (!FallbackServiceFactory.instance) {
            FallbackServiceFactory.instance = new FallbackServiceFactory(config);
        }
        return FallbackServiceFactory.instance;
    }

    /**
     * Create or get existing fallback BookingService
     */
    createFallbackBookingService(): FallbackBookingService {
        const serviceName = 'FallbackBookingService';

        if (this.fallbackInstances.has(serviceName)) {
            logger.debug(`Returning existing ${serviceName} instance`);
            return this.fallbackInstances.get(serviceName);
        }

        const fallbackService = new FallbackBookingService();
        this.fallbackInstances.set(serviceName, fallbackService);

        logger.info(`Created new ${serviceName} instance`);
        return fallbackService;
    }

    /**
     * Create a generic fallback service for any service type
     */
    createGenericFallbackService(serviceName: string, requiredMethods: string[]): any {
        const fallbackServiceName = `Fallback${serviceName}`;

        if (this.fallbackInstances.has(fallbackServiceName)) {
            return this.fallbackInstances.get(fallbackServiceName);
        }

        // Create a dynamic fallback service with required methods
        const fallbackService = this.createDynamicFallbackService(serviceName, requiredMethods);
        this.fallbackInstances.set(fallbackServiceName, fallbackService);

        logger.info(`Created generic fallback service for ${serviceName}`);
        return fallbackService;
    }

    /**
     * Create a dynamic fallback service with specified methods
     */
    private createDynamicFallbackService(serviceName: string, requiredMethods: string[]): any {
        const fallbackService: any = {};

        // Add each required method as a fallback implementation
        for (const methodName of requiredMethods) {
            fallbackService[methodName] = async (...args: any[]) => {
                logger.warn(`Fallback method called: ${serviceName}.${methodName}`);

                // Return appropriate fallback responses based on method name patterns
                if (methodName.startsWith('get') || methodName.startsWith('find')) {
                    return this.createFallbackGetResponse(methodName, args);
                } else if (methodName.startsWith('create')) {
                    throw new Error(`${methodName} is not available in fallback mode`);
                } else if (methodName.startsWith('update') || methodName.startsWith('delete')) {
                    throw new Error(`${methodName} is not available in fallback mode`);
                } else {
                    // Generic fallback response
                    return {
                        success: false,
                        message: `${serviceName}.${methodName} executed in fallback mode`,
                        fallback: true,
                        timestamp: new Date().toISOString()
                    };
                }
            };
        }

        // Add health check method
        fallbackService.healthCheck = async () => {
            return true;
        };

        // Add service identification
        fallbackService.isFallbackService = true;
        fallbackService.originalServiceName = serviceName;

        return fallbackService;
    }

    /**
     * Create appropriate fallback response for get/find methods
     */
    private createFallbackGetResponse(methodName: string, args: any[]): any {
        const id = args.length > 0 ? args[0] : 'unknown';

        if (methodName.includes('Booking')) {
            return {
                id,
                status: 'unknown',
                eventName: 'Service unavailable',
                fallback: true,
                message: 'Data retrieved from fallback service'
            };
        } else if (methodName.includes('User')) {
            return {
                id,
                name: 'Unknown User',
                email: 'unknown@example.com',
                fallback: true,
                message: 'Data retrieved from fallback service'
            };
        } else if (methodName.includes('Swap')) {
            return {
                id,
                status: 'unknown',
                fallback: true,
                message: 'Data retrieved from fallback service'
            };
        }

        // Generic fallback response
        return {
            id,
            fallback: true,
            message: 'Data retrieved from fallback service',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Register a custom fallback service
     */
    registerCustomFallbackService(serviceName: string, fallbackInstance: any): void {
        this.fallbackInstances.set(`Fallback${serviceName}`, fallbackInstance);
        logger.info(`Registered custom fallback service for ${serviceName}`);
    }

    /**
     * Get all registered fallback services
     */
    getAllFallbackServices(): Map<string, any> {
        return new Map(this.fallbackInstances);
    }

    /**
     * Clear all fallback service instances
     */
    clearAllFallbackServices(): void {
        this.fallbackInstances.clear();
        logger.info('Cleared all fallback service instances');
    }

    /**
     * Get fallback service statistics
     */
    getFallbackStats(): {
        totalFallbackServices: number;
        serviceNames: string[];
        memoryUsage: number;
    } {
        return {
            totalFallbackServices: this.fallbackInstances.size,
            serviceNames: Array.from(this.fallbackInstances.keys()),
            memoryUsage: process.memoryUsage().heapUsed
        };
    }

    /**
     * Create a circuit breaker wrapper for any service
     */
    createCircuitBreakerWrapper(
        serviceName: string,
        originalService: any,
        fallbackService: any,
        options: { threshold?: number; timeout?: number } = {}
    ): any {
        const threshold = options.threshold || 5;
        const timeout = options.timeout || 60000; // 1 minute

        let failureCount = 0;
        let lastFailureTime = 0;
        let circuitOpen = false;

        const wrapper: any = {};

        // Wrap all methods of the original service
        const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(originalService))
            .filter(name => name !== 'constructor' && typeof originalService[name] === 'function');

        for (const methodName of methodNames) {
            wrapper[methodName] = async (...args: any[]) => {
                // Check if circuit is open
                if (circuitOpen) {
                    const timeSinceFailure = Date.now() - lastFailureTime;
                    if (timeSinceFailure < timeout) {
                        logger.warn(`Circuit breaker open for ${serviceName}.${methodName}, using fallback`);
                        return fallbackService[methodName](...args);
                    } else {
                        // Try to close circuit
                        circuitOpen = false;
                        failureCount = 0;
                        logger.info(`Attempting to close circuit breaker for ${serviceName}`);
                    }
                }

                try {
                    const result = await originalService[methodName](...args);
                    // Reset failure count on success
                    failureCount = 0;
                    return result;
                } catch (error) {
                    failureCount++;
                    lastFailureTime = Date.now();

                    if (failureCount >= threshold) {
                        circuitOpen = true;
                        logger.error(`Circuit breaker opened for ${serviceName} after ${failureCount} failures`);
                    }

                    // Use fallback service
                    if (fallbackService && typeof fallbackService[methodName] === 'function') {
                        logger.warn(`Using fallback for ${serviceName}.${methodName} due to error:`, error);
                        return fallbackService[methodName](...args);
                    }

                    throw error;
                }
            };
        }

        // Add circuit breaker status methods
        wrapper.getCircuitBreakerStatus = () => ({
            isOpen: circuitOpen,
            failureCount,
            lastFailureTime: new Date(lastFailureTime),
            threshold,
            timeout
        });

        wrapper.resetCircuitBreaker = () => {
            circuitOpen = false;
            failureCount = 0;
            lastFailureTime = 0;
            logger.info(`Circuit breaker reset for ${serviceName}`);
        };

        return wrapper;
    }
}

// Export singleton instance
export const fallbackServiceFactory = FallbackServiceFactory.getInstance();