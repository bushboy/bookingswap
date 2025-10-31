import { logger } from '../../utils/logger';

/**
 * Result of service validation
 */
export interface ServiceValidationResult {
    isValid: boolean;
    serviceName: string;
    availableMethods: string[];
    missingMethods: string[];
    errors: string[];
    methodSignatures?: Record<string, string>;
}

/**
 * Configuration for service method validation
 */
export interface ServiceMethodConfig {
    name: string;
    required: boolean;
    expectedSignature?: string;
    parameterCount?: number;
}

/**
 * Service validation configuration
 */
export interface ServiceValidationConfig {
    serviceName: string;
    requiredMethods: ServiceMethodConfig[];
    optionalMethods?: ServiceMethodConfig[];
}

/**
 * Utility class for validating service method availability and integrity
 */
export class ServiceValidator {
    private static readonly BOOKING_SERVICE_METHODS: ServiceMethodConfig[] = [
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
    ];

    /**
     * Validate BookingService instance for required methods
     */
    static validateBookingService(service: any): ServiceValidationResult {
        logger.debug('Validating BookingService instance');

        const config: ServiceValidationConfig = {
            serviceName: 'BookingService',
            requiredMethods: this.BOOKING_SERVICE_METHODS
        };

        return this.validateServiceMethods(service, config);
    }

    /**
     * Generic service method validation
     */
    static validateServiceMethods(service: any, config: ServiceValidationConfig): ServiceValidationResult {
        const result: ServiceValidationResult = {
            isValid: true,
            serviceName: config.serviceName,
            availableMethods: [],
            missingMethods: [],
            errors: [],
            methodSignatures: {}
        };

        try {
            // Check if service instance exists
            if (!service) {
                result.isValid = false;
                result.errors.push(`${config.serviceName} instance is null or undefined`);
                return result;
            }

            // Get all available methods on the service
            const availableMethods = this.getServiceMethods(service);
            result.availableMethods = availableMethods;

            // Validate required methods
            for (const methodConfig of config.requiredMethods) {
                const methodExists = this.validateMethod(service, methodConfig, result);
                if (!methodExists && methodConfig.required) {
                    result.isValid = false;
                    result.missingMethods.push(methodConfig.name);
                }
            }

            // Validate optional methods if provided
            if (config.optionalMethods) {
                for (const methodConfig of config.optionalMethods) {
                    this.validateMethod(service, methodConfig, result);
                }
            }

            // Log validation results
            if (result.isValid) {
                logger.info(`${config.serviceName} validation passed`, {
                    serviceName: config.serviceName,
                    availableMethodsCount: result.availableMethods.length,
                    requiredMethodsCount: config.requiredMethods.length
                });
            } else {
                logger.error(`${config.serviceName} validation failed`, {
                    serviceName: config.serviceName,
                    missingMethods: result.missingMethods,
                    errors: result.errors
                });
            }

        } catch (error) {
            result.isValid = false;
            result.errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
            logger.error(`Service validation threw error for ${config.serviceName}`, { error });
        }

        return result;
    }

    /**
     * Validate a specific method on a service
     */
    private static validateMethod(service: any, methodConfig: ServiceMethodConfig, result: ServiceValidationResult): boolean {
        try {
            const method = service[methodConfig.name];

            if (typeof method !== 'function') {
                if (methodConfig.required) {
                    result.errors.push(`Required method '${methodConfig.name}' is not a function (type: ${typeof method})`);
                }
                return false;
            }

            // Check method binding - ensure it's bound to the service instance
            if (!this.isMethodBound(service, methodConfig.name)) {
                result.errors.push(`Method '${methodConfig.name}' is not properly bound to service instance`);
                if (methodConfig.required) {
                    return false;
                }
            }

            // Validate parameter count if specified
            if (methodConfig.parameterCount !== undefined) {
                const actualParamCount = method.length;
                if (actualParamCount < methodConfig.parameterCount) {
                    result.errors.push(`Method '${methodConfig.name}' expects ${methodConfig.parameterCount} parameters but has ${actualParamCount}`);
                }
            }

            // Store method signature information
            result.methodSignatures![methodConfig.name] = this.getMethodSignature(method);

            return true;
        } catch (error) {
            result.errors.push(`Error validating method '${methodConfig.name}': ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Get all methods available on a service instance
     */
    private static getServiceMethods(service: any): string[] {
        const methods: string[] = [];

        try {
            // Get methods from the instance
            const instanceMethods = Object.getOwnPropertyNames(service)
                .filter(name => typeof service[name] === 'function');
            methods.push(...instanceMethods);

            // Get methods from the prototype chain
            let prototype = Object.getPrototypeOf(service);
            while (prototype && prototype !== Object.prototype) {
                const prototypeMethods = Object.getOwnPropertyNames(prototype)
                    .filter(name =>
                        name !== 'constructor' &&
                        typeof prototype[name] === 'function' &&
                        !methods.includes(name)
                    );
                methods.push(...prototypeMethods);
                prototype = Object.getPrototypeOf(prototype);
            }
        } catch (error) {
            logger.warn('Error getting service methods', { error });
        }

        return methods.sort();
    }

    /**
     * Check if a method is properly bound to the service instance
     */
    private static isMethodBound(service: any, methodName: string): boolean {
        try {
            const method = service[methodName];
            if (typeof method !== 'function') {
                return false;
            }

            // Check if method has proper 'this' binding by examining the function
            // This is a heuristic check - bound methods typically have different toString() output
            const methodString = method.toString();

            // If the method is an arrow function or bound function, it should be properly bound
            const isArrowFunction = methodString.includes('=>');
            const isBoundFunction = methodString.includes('[native code]') && method.name.includes('bound');

            // For regular methods, check if they're defined on the prototype
            const isPrototypeMethod = Object.getPrototypeOf(service)[methodName] === method;

            return isArrowFunction || isBoundFunction || isPrototypeMethod;
        } catch (error) {
            logger.warn(`Error checking method binding for ${methodName}`, { error });
            return false;
        }
    }

    /**
     * Get method signature information
     */
    private static getMethodSignature(method: Function): string {
        try {
            const methodString = method.toString();
            const signatureMatch = methodString.match(/^[^{]+/);
            return signatureMatch ? signatureMatch[0].trim() : 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Validate multiple services at once
     */
    static validateServices(services: Record<string, { instance: any; config: ServiceValidationConfig }>): Record<string, ServiceValidationResult> {
        const results: Record<string, ServiceValidationResult> = {};

        for (const [serviceName, { instance, config }] of Object.entries(services)) {
            try {
                results[serviceName] = this.validateServiceMethods(instance, config);
            } catch (error) {
                results[serviceName] = {
                    isValid: false,
                    serviceName: config.serviceName,
                    availableMethods: [],
                    missingMethods: config.requiredMethods.map(m => m.name),
                    errors: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`]
                };
            }
        }

        return results;
    }

    /**
     * Create a validation report summary
     */
    static createValidationReport(results: Record<string, ServiceValidationResult>): {
        overallValid: boolean;
        totalServices: number;
        validServices: number;
        invalidServices: number;
        summary: string[];
    } {
        const validServices = Object.values(results).filter(r => r.isValid).length;
        const totalServices = Object.keys(results).length;
        const invalidServices = totalServices - validServices;
        const overallValid = invalidServices === 0;

        const summary: string[] = [];

        for (const [serviceName, result] of Object.entries(results)) {
            if (result.isValid) {
                summary.push(`✓ ${serviceName}: ${result.availableMethods.length} methods available`);
            } else {
                summary.push(`✗ ${serviceName}: ${result.missingMethods.length} missing methods, ${result.errors.length} errors`);
                result.missingMethods.forEach(method => {
                    summary.push(`  - Missing: ${method}`);
                });
                result.errors.forEach(error => {
                    summary.push(`  - Error: ${error}`);
                });
            }
        }

        return {
            overallValid,
            totalServices,
            validServices,
            invalidServices,
            summary
        };
    }
}