import { ServiceValidator, ServiceValidationResult, ServiceValidationConfig } from '../validation/ServiceValidator';
import { logger } from '../../utils/logger';

export interface StartupServiceValidationResult {
    success: boolean;
    overallValid: boolean;
    totalServices: number;
    validServices: number;
    invalidServices: number;
    serviceResults: Record<string, ServiceValidationResult>;
    criticalFailures: string[];
    warnings: string[];
    timestamp: Date;
}

export interface ServiceRegistration {
    name: string;
    instance: any;
    config: ServiceValidationConfig;
    critical: boolean; // If true, failure will prevent startup
}

/**
 * Service Validation Startup Service
 * 
 * Validates all critical service dependencies during application startup
 * and provides fail-fast behavior for missing required methods.
 * Requirements: 1.4, 3.1, 3.4
 */
export class ServiceValidationStartup {
    private static instance: ServiceValidationStartup;
    private registeredServices: Map<string, ServiceRegistration> = new Map();

    private constructor() { }

    static getInstance(): ServiceValidationStartup {
        if (!ServiceValidationStartup.instance) {
            ServiceValidationStartup.instance = new ServiceValidationStartup();
        }
        return ServiceValidationStartup.instance;
    }

    /**
     * Register a service for startup validation
     */
    registerService(registration: ServiceRegistration): void {
        logger.debug('Registering service for startup validation', {
            serviceName: registration.name,
            critical: registration.critical,
            requiredMethods: registration.config.requiredMethods.length
        });

        this.registeredServices.set(registration.name, registration);
    }

    /**
     * Register BookingService for validation
     */
    registerBookingService(bookingService: any, critical: boolean = true): void {
        this.registerService({
            name: 'BookingService',
            instance: bookingService,
            config: {
                serviceName: 'BookingService',
                requiredMethods: [
                    { name: 'getBookingById', required: true, parameterCount: 1 },
                    { name: 'lockBooking', required: true, parameterCount: 1 },
                    { name: 'unlockBooking', required: true, parameterCount: 1 },
                    { name: 'createBookingListing', required: true, parameterCount: 1 },
                    { name: 'updateBookingStatus', required: true, parameterCount: 2 },
                    { name: 'getUserBookings', required: true, parameterCount: 1 },
                    { name: 'searchBookings', required: true, parameterCount: 1 },
                    { name: 'verifyBooking', required: true, parameterCount: 1 },
                    { name: 'cancelBooking', required: true, parameterCount: 2 },
                    { name: 'validateServiceIntegrity', required: true, parameterCount: 0 }
                ]
            },
            critical
        });
    }

    /**
     * Register SwapProposalService for validation
     */
    registerSwapProposalService(swapProposalService: any, critical: boolean = true): void {
        this.registerService({
            name: 'SwapProposalService',
            instance: swapProposalService,
            config: {
                serviceName: 'SwapProposalService',
                requiredMethods: [
                    { name: 'createEnhancedSwapProposal', required: true, parameterCount: 1 },
                    { name: 'createSwapProposal', required: true, parameterCount: 1 },
                    { name: 'getSwapProposalById', required: true, parameterCount: 1 },
                    { name: 'getUserSwapProposals', required: true, parameterCount: 1 },
                    { name: 'cancelSwapProposal', required: true, parameterCount: 2 }
                ]
            },
            critical
        });
    }

    /**
     * Register AuthService for validation
     */
    registerAuthService(authService: any, critical: boolean = true): void {
        this.registerService({
            name: 'AuthService',
            instance: authService,
            config: {
                serviceName: 'AuthService',
                requiredMethods: [
                    { name: 'authenticateWithWallet', required: true, parameterCount: 1 },
                    { name: 'authenticateWithEmail', required: true, parameterCount: 2 },
                    { name: 'verifyToken', required: true, parameterCount: 1 },
                    { name: 'generateToken', required: true, parameterCount: 1 },
                    { name: 'invalidateAllUserSessions', required: true, parameterCount: 1 }
                ]
            },
            critical
        });
    }

    /**
     * Perform startup service validation for all registered services
     */
    async performStartupValidation(): Promise<StartupServiceValidationResult> {
        logger.info('Starting service validation during application startup', {
            totalServices: this.registeredServices.size
        });

        const result: StartupServiceValidationResult = {
            success: true,
            overallValid: true,
            totalServices: this.registeredServices.size,
            validServices: 0,
            invalidServices: 0,
            serviceResults: {},
            criticalFailures: [],
            warnings: [],
            timestamp: new Date()
        };

        try {
            // Validate each registered service
            for (const [serviceName, registration] of this.registeredServices) {
                logger.debug('Validating service', { serviceName, critical: registration.critical });

                try {
                    const validationResult = ServiceValidator.validateServiceMethods(
                        registration.instance,
                        registration.config
                    );

                    result.serviceResults[serviceName] = validationResult;

                    if (validationResult.isValid) {
                        result.validServices++;
                        logger.info(`Service validation passed: ${serviceName}`, {
                            availableMethods: validationResult.availableMethods.length
                        });
                    } else {
                        result.invalidServices++;
                        result.overallValid = false;

                        const errorMessage = `Service validation failed: ${serviceName} - Missing methods: ${validationResult.missingMethods.join(', ')}`;

                        if (registration.critical) {
                            result.criticalFailures.push(errorMessage);
                            result.success = false;
                            logger.error('Critical service validation failure', {
                                serviceName,
                                missingMethods: validationResult.missingMethods,
                                errors: validationResult.errors
                            });
                        } else {
                            result.warnings.push(errorMessage);
                            logger.warn('Non-critical service validation failure', {
                                serviceName,
                                missingMethods: validationResult.missingMethods,
                                errors: validationResult.errors
                            });
                        }
                    }
                } catch (error) {
                    const errorMessage = `Service validation error for ${serviceName}: ${error instanceof Error ? error.message : String(error)}`;

                    if (registration.critical) {
                        result.criticalFailures.push(errorMessage);
                        result.success = false;
                        result.overallValid = false;
                    } else {
                        result.warnings.push(errorMessage);
                    }

                    logger.error('Service validation threw error', {
                        serviceName,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // Log summary
            if (result.success && result.overallValid) {
                logger.info('All service validations passed successfully', {
                    totalServices: result.totalServices,
                    validServices: result.validServices
                });
            } else if (result.success) {
                logger.warn('Service validation completed with warnings', {
                    totalServices: result.totalServices,
                    validServices: result.validServices,
                    warnings: result.warnings.length
                });
            } else {
                logger.error('Service validation failed with critical errors', {
                    totalServices: result.totalServices,
                    validServices: result.validServices,
                    invalidServices: result.invalidServices,
                    criticalFailures: result.criticalFailures.length
                });
            }

        } catch (error) {
            result.success = false;
            result.overallValid = false;
            const errorMessage = `Service validation process failed: ${error instanceof Error ? error.message : String(error)}`;
            result.criticalFailures.push(errorMessage);

            logger.error('Service validation process failed', { error });
        }

        return result;
    }

    /**
     * Perform quick health check for critical services
     */
    async performQuickServiceHealthCheck(): Promise<boolean> {
        logger.debug('Performing quick service health check');

        try {
            const criticalServices = Array.from(this.registeredServices.values())
                .filter(registration => registration.critical);

            for (const registration of criticalServices) {
                // Quick check - just verify the service instance exists and has basic methods
                if (!registration.instance) {
                    logger.error(`Critical service ${registration.name} instance is null/undefined`);
                    return false;
                }

                // Check if at least one critical method exists
                const firstRequiredMethod = registration.config.requiredMethods.find(m => m.required);
                if (firstRequiredMethod && typeof registration.instance[firstRequiredMethod.name] !== 'function') {
                    logger.error(`Critical service ${registration.name} missing required method ${firstRequiredMethod.name}`);
                    return false;
                }
            }

            logger.debug('Quick service health check passed');
            return true;
        } catch (error) {
            logger.error('Quick service health check failed', { error });
            return false;
        }
    }

    /**
     * Get validation report for monitoring
     */
    getValidationReport(): {
        registeredServices: number;
        criticalServices: number;
        nonCriticalServices: number;
        serviceNames: string[];
    } {
        const services = Array.from(this.registeredServices.values());
        const criticalServices = services.filter(s => s.critical).length;
        const nonCriticalServices = services.filter(s => !s.critical).length;

        return {
            registeredServices: this.registeredServices.size,
            criticalServices,
            nonCriticalServices,
            serviceNames: Array.from(this.registeredServices.keys())
        };
    }

    /**
     * Clear all registered services (useful for testing)
     */
    clearRegistrations(): void {
        this.registeredServices.clear();
        logger.debug('All service registrations cleared');
    }

    /**
     * Validate a specific service by name
     */
    async validateSpecificService(serviceName: string): Promise<ServiceValidationResult | null> {
        const registration = this.registeredServices.get(serviceName);
        if (!registration) {
            logger.warn(`Service ${serviceName} not registered for validation`);
            return null;
        }

        logger.debug(`Validating specific service: ${serviceName}`);
        return ServiceValidator.validateServiceMethods(registration.instance, registration.config);
    }
}