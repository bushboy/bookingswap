import { logger } from '../../utils/logger';
import { BookingService } from '../booking/BookingService';
import { SwapProposalService } from '../swap/SwapProposalService';

export interface ServiceRecoveryConfig {
    maxRetries: number;
    retryDelayMs: number;
    circuitBreakerThreshold: number;
    healthCheckIntervalMs: number;
    enableFallback: boolean;
}

export interface ServiceHealth {
    serviceName: string;
    isHealthy: boolean;
    lastHealthCheck: Date;
    consecutiveFailures: number;
    circuitBreakerOpen: boolean;
}

export class AutomatedServiceRecovery {
    private config: ServiceRecoveryConfig;
    private serviceHealth: Map<string, ServiceHealth> = new Map();
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private fallbackServices: Map<string, any> = new Map();

    constructor(config: Partial<ServiceRecoveryConfig> = {}) {
        this.config = {
            maxRetries: 3,
            retryDelayMs: 1000,
            circuitBreakerThreshold: 5,
            healthCheckIntervalMs: 30000,
            enableFallback: true,
            ...config
        };

        this.initializeHealthMonitoring();
    }

    /**
     * Register a service for automated recovery monitoring
     */
    registerService(serviceName: string, serviceInstance: any): void {
        this.serviceHealth.set(serviceName, {
            serviceName,
            isHealthy: true,
            lastHealthCheck: new Date(),
            consecutiveFailures: 0,
            circuitBreakerOpen: false
        });

        logger.info(`Registered service for recovery monitoring: ${serviceName}`);
    }

    /**
     * Execute a service method with automatic recovery and circuit breaker
     */
    async executeWithRecovery<T>(
        serviceName: string,
        methodName: string,
        serviceInstance: any,
        args: any[] = []
    ): Promise<T> {
        const health = this.serviceHealth.get(serviceName);

        if (!health) {
            throw new Error(`Service ${serviceName} not registered for recovery`);
        }

        // Check circuit breaker
        if (health.circuitBreakerOpen) {
            logger.warn(`Circuit breaker open for ${serviceName}.${methodName}`);
            return this.executeFallback(serviceName, methodName, args);
        }

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                // Validate method exists
                if (!serviceInstance || typeof serviceInstance[methodName] !== 'function') {
                    throw new Error(`Method ${methodName} not available on service ${serviceName}`);
                }

                // Execute the method
                const result = await serviceInstance[methodName](...args);

                // Reset failure count on success
                health.consecutiveFailures = 0;
                health.isHealthy = true;
                health.lastHealthCheck = new Date();

                logger.debug(`Successfully executed ${serviceName}.${methodName} on attempt ${attempt}`);
                return result;

            } catch (error) {
                lastError = error as Error;
                health.consecutiveFailures++;
                health.isHealthy = false;
                health.lastHealthCheck = new Date();

                logger.warn(`Failed to execute ${serviceName}.${methodName} on attempt ${attempt}:`, error);

                // Open circuit breaker if threshold reached
                if (health.consecutiveFailures >= this.config.circuitBreakerThreshold) {
                    health.circuitBreakerOpen = true;
                    logger.error(`Circuit breaker opened for ${serviceName} after ${health.consecutiveFailures} failures`);
                    break;
                }

                // Wait before retry (except on last attempt)
                if (attempt < this.config.maxRetries) {
                    await this.delay(this.config.retryDelayMs * attempt);
                }
            }
        }

        // All retries failed, try fallback if available
        if (this.config.enableFallback) {
            try {
                return await this.executeFallback(serviceName, methodName, args);
            } catch (fallbackError) {
                logger.error(`Fallback also failed for ${serviceName}.${methodName}:`, fallbackError);
            }
        }

        throw lastError || new Error(`Service ${serviceName}.${methodName} failed after ${this.config.maxRetries} attempts`);
    }

    /**
     * Register a fallback service instance
     */
    registerFallbackService(serviceName: string, fallbackInstance: any): void {
        this.fallbackServices.set(serviceName, fallbackInstance);
        logger.info(`Registered fallback service for ${serviceName}`);
    }

    /**
     * Execute fallback service method
     */
    private async executeFallback<T>(serviceName: string, methodName: string, args: any[]): Promise<T> {
        const fallbackService = this.fallbackServices.get(serviceName);

        if (!fallbackService) {
            throw new Error(`No fallback service available for ${serviceName}`);
        }

        if (typeof fallbackService[methodName] !== 'function') {
            throw new Error(`Fallback method ${methodName} not available on fallback service for ${serviceName}`);
        }

        logger.info(`Executing fallback for ${serviceName}.${methodName}`);
        return await fallbackService[methodName](...args);
    }

    /**
     * Perform health check on a service
     */
    async performHealthCheck(serviceName: string, serviceInstance: any): Promise<boolean> {
        try {
            // Basic health check - verify service instance exists and has expected methods
            if (!serviceInstance) {
                return false;
            }

            // Service-specific health checks
            if (serviceName === 'BookingService') {
                return this.checkBookingServiceHealth(serviceInstance);
            } else if (serviceName === 'SwapProposalService') {
                return this.checkSwapProposalServiceHealth(serviceInstance);
            }

            // Generic health check - verify service has basic methods
            return typeof serviceInstance.constructor === 'function';

        } catch (error) {
            logger.error(`Health check failed for ${serviceName}:`, error);
            return false;
        }
    }

    /**
     * Check BookingService health
     */
    private async checkBookingServiceHealth(bookingService: BookingService): Promise<boolean> {
        try {
            // Check if required methods exist
            const requiredMethods = ['getBookingById', 'createBooking', 'updateBooking'];

            for (const method of requiredMethods) {
                if (typeof bookingService[method as keyof BookingService] !== 'function') {
                    logger.warn(`BookingService missing required method: ${method}`);
                    return false;
                }
            }

            return true;
        } catch (error) {
            logger.error('BookingService health check failed:', error);
            return false;
        }
    }

    /**
     * Check SwapProposalService health
     */
    private async checkSwapProposalServiceHealth(swapService: SwapProposalService): Promise<boolean> {
        try {
            // Check if required methods exist
            const requiredMethods = ['createSwapProposal', 'createEnhancedProposal'];

            for (const method of requiredMethods) {
                if (typeof swapService[method as keyof SwapProposalService] !== 'function') {
                    logger.warn(`SwapProposalService missing required method: ${method}`);
                    return false;
                }
            }

            return true;
        } catch (error) {
            logger.error('SwapProposalService health check failed:', error);
            return false;
        }
    }

    /**
     * Reset circuit breaker for a service
     */
    resetCircuitBreaker(serviceName: string): void {
        const health = this.serviceHealth.get(serviceName);
        if (health) {
            health.circuitBreakerOpen = false;
            health.consecutiveFailures = 0;
            health.isHealthy = true;
            health.lastHealthCheck = new Date();
            logger.info(`Circuit breaker reset for ${serviceName}`);
        }
    }

    /**
     * Get service health status
     */
    getServiceHealth(serviceName: string): ServiceHealth | null {
        return this.serviceHealth.get(serviceName) || null;
    }

    /**
     * Get all service health statuses
     */
    getAllServiceHealth(): ServiceHealth[] {
        return Array.from(this.serviceHealth.values());
    }

    /**
     * Initialize health monitoring
     */
    private initializeHealthMonitoring(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(async () => {
            for (const [serviceName, health] of this.serviceHealth.entries()) {
                // Auto-reset circuit breaker after some time if service might be recovered
                if (health.circuitBreakerOpen) {
                    const timeSinceLastCheck = Date.now() - health.lastHealthCheck.getTime();
                    if (timeSinceLastCheck > this.config.healthCheckIntervalMs * 2) {
                        logger.info(`Attempting to reset circuit breaker for ${serviceName}`);
                        this.resetCircuitBreaker(serviceName);
                    }
                }
            }
        }, this.config.healthCheckIntervalMs);

        logger.info('Automated service recovery health monitoring initialized');
    }

    /**
     * Shutdown recovery system
     */
    shutdown(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        logger.info('Automated service recovery system shutdown');
    }

    /**
     * Utility method for delays
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance for global use
export const serviceRecovery = new AutomatedServiceRecovery();