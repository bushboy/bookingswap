import { logger, enhancedLogger } from '../../utils/logger';
import { AutomatedServiceRecovery, ServiceRecoveryConfig } from './AutomatedServiceRecovery';
import { FallbackBookingService } from './FallbackBookingService';
import { BookingService } from '../booking/BookingService';
import { SwapProposalService } from '../swap/SwapProposalService';

export interface ServiceInstance {
    name: string;
    instance: any;
    fallback?: any;
    critical: boolean;
}

export interface ServiceRecoveryError {
    phase: 'initialization' | 'registration' | 'startup' | 'runtime' | 'shutdown';
    serviceName?: string;
    error: Error;
    timestamp: Date;
    context?: Record<string, any>;
}

export interface InitializationPhase {
    name: string;
    startTime: Date;
    endTime?: Date;
    success: boolean;
    error?: Error;
    duration?: number;
}

/**
 * Manages service recovery across the application
 * Coordinates automated recovery, fallback services, and health monitoring
 */
export class ServiceRecoveryManager {
    private recovery!: AutomatedServiceRecovery;
    private services: Map<string, ServiceInstance> = new Map();
    private initialized: boolean = false;
    private initializationError?: Error;
    private initializationTimestamp?: Date;
    private initializationPhases: InitializationPhase[] = [];
    private gracefulDegradationMode: boolean = false;
    private recoveryErrors: ServiceRecoveryError[] = [];

    constructor(config?: Partial<ServiceRecoveryConfig>) {
        try {
            this.recovery = new AutomatedServiceRecovery(config);
            enhancedLogger.info('ServiceRecoveryManager constructor completed', {
                category: 'service_recovery',
                phase: 'constructor',
                config: config ? Object.keys(config) : 'default'
            });
        } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            const recoveryError: ServiceRecoveryError = {
                phase: 'initialization',
                error: errorInstance,
                timestamp: new Date(),
                context: { phase: 'constructor', config }
            };
            this.recoveryErrors.push(recoveryError);

            enhancedLogger.logError(errorInstance, {
                operation: 'ServiceRecoveryManager.constructor',
                metadata: {
                    category: 'service_recovery',
                    phase: 'constructor',
                    config
                }
            });

            // Enable graceful degradation mode
            this.gracefulDegradationMode = true;
            enhancedLogger.warn('ServiceRecoveryManager entering graceful degradation mode due to constructor failure', {
                category: 'service_recovery',
                degradationReason: 'constructor_failure',
                error: errorInstance.message
            });
        }
    }

    /**
     * Initialize the service recovery system
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            enhancedLogger.warn('ServiceRecoveryManager already initialized', {
                category: 'service_recovery',
                phase: 'initialization',
                previousInitTimestamp: this.initializationTimestamp?.toISOString(),
                gracefulDegradationMode: this.gracefulDegradationMode
            });
            return;
        }

        const initializationStartTime = new Date();
        enhancedLogger.info('Starting ServiceRecoveryManager initialization', {
            category: 'service_recovery',
            phase: 'initialization_start',
            startTime: initializationStartTime.toISOString(),
            gracefulDegradationMode: this.gracefulDegradationMode
        });

        // Clear previous state
        this.initializationError = undefined;
        this.initializationPhases = [];
        this.recoveryErrors = this.recoveryErrors.filter(e => e.phase !== 'initialization');

        try {
            // Phase 1: Initialize fallback services
            await this.executeInitializationPhase('fallback_services', async () => {
                await this.initializeFallbackServices();
            });

            // Phase 2: Register critical services for monitoring
            await this.executeInitializationPhase('critical_services', async () => {
                await this.registerCriticalServices();
            });

            // Phase 3: Perform initial health checks
            await this.executeInitializationPhase('health_checks', async () => {
                await this.performInitialHealthChecks();
            });

            // Phase 4: Validate recovery system readiness
            await this.executeInitializationPhase('readiness_validation', async () => {
                await this.validateRecoverySystemReadiness();
            });

            this.initialized = true;
            this.initializationTimestamp = new Date();

            const totalDuration = this.initializationTimestamp.getTime() - initializationStartTime.getTime();

            enhancedLogger.info('ServiceRecoveryManager initialization completed successfully', {
                category: 'service_recovery',
                phase: 'initialization_complete',
                totalDuration,
                phasesCompleted: this.initializationPhases.length,
                successfulPhases: this.initializationPhases.filter(p => p.success).length,
                gracefulDegradationMode: this.gracefulDegradationMode,
                initializationTimestamp: this.initializationTimestamp.toISOString()
            });

        } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            this.initializationError = errorInstance;
            const totalDuration = new Date().getTime() - initializationStartTime.getTime();

            const recoveryError: ServiceRecoveryError = {
                phase: 'initialization',
                error: errorInstance,
                timestamp: new Date(),
                context: {
                    totalDuration,
                    completedPhases: this.initializationPhases.filter(p => p.success).length,
                    totalPhases: this.initializationPhases.length,
                    failedPhase: this.initializationPhases.find(p => !p.success)?.name
                }
            };
            this.recoveryErrors.push(recoveryError);

            enhancedLogger.logError(errorInstance, {
                operation: 'ServiceRecoveryManager.initialize',
                metadata: {
                    category: 'service_recovery',
                    phase: 'initialization_failed',
                    totalDuration,
                    completedPhases: this.initializationPhases.filter(p => p.success).length,
                    totalPhases: this.initializationPhases.length,
                    failedPhase: this.initializationPhases.find(p => !p.success)?.name,
                    gracefulDegradationMode: this.gracefulDegradationMode
                }
            });

            // Implement graceful degradation
            await this.enableGracefulDegradation(errorInstance);

            // Re-throw error to maintain existing behavior for callers
            throw new Error(`ServiceRecoveryManager initialization failed: ${errorInstance.message}. System will continue with graceful degradation. Check logs for detailed phase information.`);
        }
    }

    /**
     * Execute an initialization phase with detailed logging and error handling
     */
    private async executeInitializationPhase(phaseName: string, phaseFunction: () => Promise<void>): Promise<void> {
        const phase: InitializationPhase = {
            name: phaseName,
            startTime: new Date(),
            success: false
        };

        enhancedLogger.info(`Starting initialization phase: ${phaseName}`, {
            category: 'service_recovery',
            phase: `initialization_phase_${phaseName}`,
            startTime: phase.startTime.toISOString()
        });

        try {
            await phaseFunction();
            phase.success = true;
            phase.endTime = new Date();
            phase.duration = phase.endTime.getTime() - phase.startTime.getTime();

            enhancedLogger.info(`Completed initialization phase: ${phaseName}`, {
                category: 'service_recovery',
                phase: `initialization_phase_${phaseName}_complete`,
                duration: phase.duration,
                success: true
            });

        } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            phase.success = false;
            phase.error = errorInstance;
            phase.endTime = new Date();
            phase.duration = phase.endTime.getTime() - phase.startTime.getTime();

            enhancedLogger.logError(errorInstance, {
                operation: `ServiceRecoveryManager.initialize.${phaseName}`,
                metadata: {
                    category: 'service_recovery',
                    phase: `initialization_phase_${phaseName}_failed`,
                    duration: phase.duration,
                    phaseName
                }
            });

            throw new Error(`Initialization phase '${phaseName}' failed: ${errorInstance.message}`);
        } finally {
            this.initializationPhases.push(phase);
        }
    }

    /**
     * Enable graceful degradation mode when initialization fails
     */
    private async enableGracefulDegradation(initializationError: Error): Promise<void> {
        this.gracefulDegradationMode = true;

        enhancedLogger.warn('Enabling graceful degradation mode for ServiceRecoveryManager', {
            category: 'service_recovery',
            phase: 'graceful_degradation_enabled',
            reason: initializationError.message,
            completedPhases: this.initializationPhases.filter(p => p.success).map(p => p.name),
            failedPhases: this.initializationPhases.filter(p => !p.success).map(p => p.name),
            degradationCapabilities: [
                'basic_error_logging',
                'service_registration_tracking',
                'limited_health_status_reporting'
            ]
        });

        // In graceful degradation mode, we still track services but without recovery capabilities
        try {
            // Attempt to initialize minimal logging and tracking
            enhancedLogger.info('Graceful degradation mode: Minimal service tracking enabled', {
                category: 'service_recovery',
                phase: 'graceful_degradation_setup'
            });
        } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            enhancedLogger.error('Failed to setup graceful degradation mode', {
                category: 'service_recovery',
                phase: 'graceful_degradation_setup_failed',
                error: errorInstance.message
            });
        }
    }

    /**
     * Validate that the recovery system is ready for operation
     */
    private async validateRecoverySystemReadiness(): Promise<void> {
        enhancedLogger.info('Validating recovery system readiness', {
            category: 'service_recovery',
            phase: 'readiness_validation'
        });

        const validationChecks = [
            { name: 'recovery_instance', check: () => this.recovery !== null && this.recovery !== undefined },
            { name: 'services_map', check: () => this.services instanceof Map },
            { name: 'initialization_phases', check: () => Array.isArray(this.initializationPhases) },
            { name: 'error_tracking', check: () => Array.isArray(this.recoveryErrors) }
        ];

        const failedChecks: string[] = [];

        for (const validation of validationChecks) {
            try {
                if (!validation.check()) {
                    failedChecks.push(validation.name);
                }
            } catch (error: unknown) {
                const errorInstance = error instanceof Error ? error : new Error(String(error));
                failedChecks.push(validation.name);
                enhancedLogger.warn(`Readiness validation check failed: ${validation.name}`, {
                    category: 'service_recovery',
                    phase: 'readiness_validation_check_failed',
                    checkName: validation.name,
                    error: errorInstance.message
                });
            }
        }

        if (failedChecks.length > 0) {
            throw new Error(`Recovery system readiness validation failed. Failed checks: ${failedChecks.join(', ')}`);
        }

        enhancedLogger.info('Recovery system readiness validation passed', {
            category: 'service_recovery',
            phase: 'readiness_validation_complete',
            validatedChecks: validationChecks.length
        });
    }

    /**
     * Check if the manager is properly initialized
     */
    private ensureInitialized(): void {
        if (!this.initialized && !this.gracefulDegradationMode) {
            const errorMessage = this.initializationError
                ? `ServiceRecoveryManager is not initialized. Previous initialization failed: ${this.initializationError.message}. Check initialization logs for detailed phase information.`
                : 'ServiceRecoveryManager is not initialized. Call initialize() first.';

            enhancedLogger.warn('ServiceRecoveryManager method called before initialization', {
                category: 'service_recovery',
                phase: 'method_call_before_init',
                hasInitializationError: !!this.initializationError,
                gracefulDegradationMode: this.gracefulDegradationMode,
                completedPhases: this.initializationPhases.filter(p => p.success).length,
                totalPhases: this.initializationPhases.length
            });

            throw new Error(errorMessage);
        }

        if (this.gracefulDegradationMode) {
            enhancedLogger.warn('ServiceRecoveryManager operating in graceful degradation mode', {
                category: 'service_recovery',
                phase: 'graceful_degradation_operation',
                limitedFunctionality: true
            });
        }
    }

    /**
     * Get initialization status
     */
    getInitializationStatus(): {
        isInitialized: boolean;
        initializationError?: Error;
        initializationTimestamp?: Date;
    } {
        return {
            isInitialized: this.initialized,
            initializationError: this.initializationError,
            initializationTimestamp: this.initializationTimestamp
        };
    }

    /**
     * Register a service with the recovery system
     */
    registerService(
        name: string,
        instance: any,
        options: { fallback?: any; critical?: boolean } = {}
    ): void {
        try {
            this.ensureInitialized();

            const serviceInstance: ServiceInstance = {
                name,
                instance,
                fallback: options.fallback,
                critical: options.critical || false
            };

            // In graceful degradation mode, only track services without recovery capabilities
            if (this.gracefulDegradationMode) {
                this.services.set(name, serviceInstance);
                enhancedLogger.warn(`Service registered in graceful degradation mode: ${name}`, {
                    category: 'service_recovery',
                    phase: 'service_registration_degraded',
                    serviceName: name,
                    critical: serviceInstance.critical,
                    hasFallback: !!options.fallback,
                    limitedFunctionality: true
                });
                return;
            }

            this.services.set(name, serviceInstance);

            try {
                this.recovery.registerService(name, instance);

                if (options.fallback) {
                    this.recovery.registerFallbackService(name, options.fallback);
                }

                enhancedLogger.info(`Service registered successfully: ${name}`, {
                    category: 'service_recovery',
                    phase: 'service_registration',
                    serviceName: name,
                    critical: serviceInstance.critical,
                    hasFallback: !!options.fallback,
                    totalServices: this.services.size
                });

            } catch (recoveryError: unknown) {
                const errorInstance = recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError));
                // Log recovery registration error but continue with basic tracking
                const serviceError: ServiceRecoveryError = {
                    phase: 'registration',
                    serviceName: name,
                    error: errorInstance,
                    timestamp: new Date(),
                    context: { critical: serviceInstance.critical, hasFallback: !!options.fallback }
                };
                this.recoveryErrors.push(serviceError);

                enhancedLogger.logError(errorInstance, {
                    operation: 'ServiceRecoveryManager.registerService.recovery',
                    metadata: {
                        category: 'service_recovery',
                        phase: 'service_registration_recovery_failed',
                        serviceName: name,
                        critical: serviceInstance.critical
                    }
                });

                enhancedLogger.warn(`Service registered with limited recovery capabilities: ${name}`, {
                    category: 'service_recovery',
                    phase: 'service_registration_limited',
                    serviceName: name,
                    critical: serviceInstance.critical,
                    recoveryError: errorInstance.message
                });
            }

        } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            const serviceError: ServiceRecoveryError = {
                phase: 'registration',
                serviceName: name,
                error: errorInstance,
                timestamp: new Date(),
                context: { critical: options.critical, hasFallback: !!options.fallback }
            };
            this.recoveryErrors.push(serviceError);

            enhancedLogger.logError(errorInstance, {
                operation: 'ServiceRecoveryManager.registerService',
                metadata: {
                    category: 'service_recovery',
                    phase: 'service_registration_failed',
                    serviceName: name,
                    critical: options.critical
                }
            });

            throw new Error(`Failed to register service '${name}': ${errorInstance.message}`);
        }
    }

    /**
     * Execute a service method with automatic recovery
     */
    async executeServiceMethod<T>(
        serviceName: string,
        methodName: string,
        args: any[] = []
    ): Promise<T> {
        const executionStartTime = new Date();

        try {
            this.ensureInitialized();
            const serviceInstance = this.services.get(serviceName);

            if (!serviceInstance) {
                const error = new Error(`Service ${serviceName} not registered with ServiceRecoveryManager`);
                enhancedLogger.logError(error, {
                    operation: 'ServiceRecoveryManager.executeServiceMethod',
                    metadata: {
                        category: 'service_recovery',
                        phase: 'service_execution_not_found',
                        serviceName,
                        methodName,
                        registeredServices: Array.from(this.services.keys())
                    }
                });
                throw error;
            }

            // In graceful degradation mode, execute directly without recovery
            if (this.gracefulDegradationMode) {
                enhancedLogger.warn(`Executing service method in graceful degradation mode: ${serviceName}.${methodName}`, {
                    category: 'service_recovery',
                    phase: 'service_execution_degraded',
                    serviceName,
                    methodName,
                    critical: serviceInstance.critical
                });

                try {
                    const result = await serviceInstance.instance[methodName](...args);
                    const duration = new Date().getTime() - executionStartTime.getTime();

                    enhancedLogger.info(`Service method executed successfully in degraded mode: ${serviceName}.${methodName}`, {
                        category: 'service_recovery',
                        phase: 'service_execution_degraded_success',
                        serviceName,
                        methodName,
                        duration
                    });

                    return result;
                } catch (directError: unknown) {
                    const errorInstance = directError instanceof Error ? directError : new Error(String(directError));
                    const duration = new Date().getTime() - executionStartTime.getTime();

                    enhancedLogger.logError(errorInstance, {
                        operation: `ServiceRecoveryManager.executeServiceMethod.degraded.${serviceName}.${methodName}`,
                        metadata: {
                            category: 'service_recovery',
                            phase: 'service_execution_degraded_failed',
                            serviceName,
                            methodName,
                            duration,
                            critical: serviceInstance.critical
                        }
                    });

                    throw directError;
                }
            }

            // Normal execution with recovery
            try {
                const result = await this.recovery.executeWithRecovery<T>(
                    serviceName,
                    methodName,
                    serviceInstance.instance,
                    args
                );

                const duration = new Date().getTime() - executionStartTime.getTime();
                enhancedLogger.info(`Service method executed successfully: ${serviceName}.${methodName}`, {
                    category: 'service_recovery',
                    phase: 'service_execution_success',
                    serviceName,
                    methodName,
                    duration,
                    critical: serviceInstance.critical
                });

                return result;

            } catch (recoveryError: unknown) {
                const errorInstance = recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError));
                const duration = new Date().getTime() - executionStartTime.getTime();

                const serviceError: ServiceRecoveryError = {
                    phase: 'runtime',
                    serviceName,
                    error: errorInstance,
                    timestamp: new Date(),
                    context: {
                        methodName,
                        duration,
                        critical: serviceInstance.critical,
                        argsCount: args.length
                    }
                };
                this.recoveryErrors.push(serviceError);

                enhancedLogger.logError(errorInstance, {
                    operation: `ServiceRecoveryManager.executeServiceMethod.${serviceName}.${methodName}`,
                    metadata: {
                        category: 'service_recovery',
                        phase: 'service_execution_failed',
                        serviceName,
                        methodName,
                        duration,
                        critical: serviceInstance.critical,
                        argsCount: args.length
                    }
                });

                // If this is a critical service, attempt additional recovery measures
                if (serviceInstance.critical) {
                    enhancedLogger.warn(`Attempting recovery for critical service: ${serviceName}`, {
                        category: 'service_recovery',
                        phase: 'critical_service_recovery_attempt',
                        serviceName,
                        methodName
                    });

                    try {
                        await this.attemptServiceRecovery(serviceName);
                    } catch (recoveryAttemptError: unknown) {
                        const recoveryErrorInstance = recoveryAttemptError instanceof Error ? recoveryAttemptError : new Error(String(recoveryAttemptError));
                        enhancedLogger.logError(recoveryErrorInstance, {
                            operation: `ServiceRecoveryManager.attemptServiceRecovery.${serviceName}`,
                            metadata: {
                                category: 'service_recovery',
                                phase: 'critical_service_recovery_failed',
                                serviceName,
                                originalError: errorInstance.message
                            }
                        });
                    }
                }

                throw new Error(`Service method execution failed: ${serviceName}.${methodName} - ${errorInstance.message}`);
            }

        } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            const duration = new Date().getTime() - executionStartTime.getTime();

            enhancedLogger.logError(errorInstance, {
                operation: `ServiceRecoveryManager.executeServiceMethod.${serviceName}.${methodName}`,
                metadata: {
                    category: 'service_recovery',
                    phase: 'service_execution_error',
                    serviceName,
                    methodName,
                    duration,
                    gracefulDegradationMode: this.gracefulDegradationMode
                }
            });

            throw error;
        }
    }

    /**
     * Get service health status
     */
    getServiceHealth(serviceName?: string) {
        this.ensureInitialized();
        if (serviceName) {
            return this.recovery.getServiceHealth(serviceName);
        }
        return this.recovery.getAllServiceHealth();
    }

    /**
     * Reset circuit breaker for a service
     */
    resetServiceCircuitBreaker(serviceName: string): void {
        this.ensureInitialized();
        this.recovery.resetCircuitBreaker(serviceName);
        logger.info(`Circuit breaker reset for service: ${serviceName}`);
    }

    /**
     * Register a fallback service
     */
    registerFallbackService(serviceName: string, fallbackInstance: any): void {
        this.ensureInitialized();
        this.recovery.registerFallbackService(serviceName, fallbackInstance);
        logger.info(`Registered fallback service for: ${serviceName}`);
    }

    /**
     * Start recovery monitoring with specified interval
     */
    startRecovery(intervalMs: number = 30000): void {
        try {
            this.ensureInitialized();

            enhancedLogger.info(`Starting service recovery monitoring`, {
                category: 'service_recovery',
                phase: 'recovery_monitoring_start',
                intervalMs,
                registeredServices: this.services.size,
                gracefulDegradationMode: this.gracefulDegradationMode,
                criticalServices: Array.from(this.services.values()).filter(s => s.critical).length
            });

            if (this.gracefulDegradationMode) {
                enhancedLogger.warn('Service recovery monitoring started in graceful degradation mode', {
                    category: 'service_recovery',
                    phase: 'recovery_monitoring_degraded',
                    intervalMs,
                    limitedCapabilities: [
                        'basic_health_status_tracking',
                        'error_logging',
                        'service_registration_tracking'
                    ]
                });
            } else {
                // The AutomatedServiceRecovery starts monitoring automatically when services are registered
                // This method serves as a placeholder for explicit start calls
                enhancedLogger.info(`Service recovery monitoring is active with full capabilities`, {
                    category: 'service_recovery',
                    phase: 'recovery_monitoring_active',
                    intervalMs,
                    capabilities: [
                        'automated_recovery',
                        'circuit_breaker_management',
                        'fallback_service_activation',
                        'health_monitoring'
                    ]
                });
            }

            // Perform initial health checks to ensure all services are ready
            this.performHealthChecks().catch(error => {
                const errorInstance = error instanceof Error ? error : new Error(String(error));
                const serviceError: ServiceRecoveryError = {
                    phase: 'startup',
                    error: errorInstance,
                    timestamp: new Date(),
                    context: { operation: 'initial_health_checks', intervalMs }
                };
                this.recoveryErrors.push(serviceError);

                enhancedLogger.logError(errorInstance, {
                    operation: 'ServiceRecoveryManager.startRecovery.initialHealthChecks',
                    metadata: {
                        category: 'service_recovery',
                        phase: 'initial_health_checks_failed',
                        intervalMs,
                        gracefulDegradationMode: this.gracefulDegradationMode
                    }
                });
            });

        } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            const serviceError: ServiceRecoveryError = {
                phase: 'startup',
                error: errorInstance,
                timestamp: new Date(),
                context: { operation: 'start_recovery', intervalMs }
            };
            this.recoveryErrors.push(serviceError);

            enhancedLogger.logError(errorInstance, {
                operation: 'ServiceRecoveryManager.startRecovery',
                metadata: {
                    category: 'service_recovery',
                    phase: 'recovery_monitoring_start_failed',
                    intervalMs,
                    gracefulDegradationMode: this.gracefulDegradationMode
                }
            });

            // In graceful degradation mode, don't throw - just log and continue
            if (this.gracefulDegradationMode) {
                enhancedLogger.warn('Service recovery monitoring start failed in graceful degradation mode, continuing with limited functionality', {
                    category: 'service_recovery',
                    phase: 'recovery_monitoring_start_degraded_continue',
                    error: errorInstance.message
                });
            } else {
                throw new Error(`Failed to start service recovery monitoring: ${errorInstance.message}`);
            }
        }
    }

    /**
     * Perform health check on all services
     */
    async performHealthChecks(): Promise<Map<string, boolean>> {
        this.ensureInitialized();
        const results = new Map<string, boolean>();

        for (const [serviceName, serviceInstance] of this.services.entries()) {
            try {
                const isHealthy = await this.recovery.performHealthCheck(
                    serviceName,
                    serviceInstance.instance
                );
                results.set(serviceName, isHealthy);

                if (!isHealthy && serviceInstance.critical) {
                    logger.error(`Critical service ${serviceName} failed health check`);
                    await this.attemptServiceRecovery(serviceName);
                }
            } catch (error: unknown) {
                const errorInstance = error instanceof Error ? error : new Error(String(error));
                logger.error(`Health check failed for ${serviceName}:`, errorInstance);
                results.set(serviceName, false);
            }
        }

        return results;
    }

    /**
     * Attempt to recover a failed service
     */
    private async attemptServiceRecovery(serviceName: string): Promise<void> {
        logger.info(`Attempting recovery for service: ${serviceName}`);

        const serviceInstance = this.services.get(serviceName);
        if (!serviceInstance) {
            logger.error(`Cannot recover unknown service: ${serviceName}`);
            return;
        }

        try {
            // Reset circuit breaker
            this.recovery.resetCircuitBreaker(serviceName);

            // Attempt to reinitialize the service if it has an init method
            if (serviceInstance.instance && typeof serviceInstance.instance.initialize === 'function') {
                await serviceInstance.instance.initialize();
                logger.info(`Reinitialized service: ${serviceName}`);
            }

            // Perform health check
            const isHealthy = await this.recovery.performHealthCheck(
                serviceName,
                serviceInstance.instance
            );

            if (isHealthy) {
                logger.info(`Successfully recovered service: ${serviceName}`);
            } else {
                logger.warn(`Service recovery failed for: ${serviceName}`);
            }

        } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            logger.error(`Service recovery failed for ${serviceName}:`, errorInstance);
        }
    }

    /**
     * Initialize fallback services
     */
    private async initializeFallbackServices(): Promise<void> {
        enhancedLogger.info('Initializing fallback services', {
            category: 'service_recovery',
            phase: 'fallback_services_init',
            gracefulDegradationMode: this.gracefulDegradationMode,
            hasRecoveryInstance: !!this.recovery
        });

        try {
            // Only initialize fallback services if we have a recovery instance and not in degraded mode
            if (this.recovery && !this.gracefulDegradationMode) {
                // Initialize fallback BookingService
                const fallbackBookingService = new FallbackBookingService();
                this.recovery.registerFallbackService('BookingService', fallbackBookingService);

                enhancedLogger.info('Fallback services initialized successfully', {
                    category: 'service_recovery',
                    phase: 'fallback_services_init_complete',
                    registeredServices: ['BookingService']
                });
            } else if (this.gracefulDegradationMode) {
                enhancedLogger.info('Fallback services initialization skipped (graceful degradation mode)', {
                    category: 'service_recovery',
                    phase: 'fallback_services_init_skipped_degraded'
                });
            } else {
                enhancedLogger.warn('Fallback services initialization skipped (no recovery instance)', {
                    category: 'service_recovery',
                    phase: 'fallback_services_init_skipped_no_recovery'
                });
            }
        } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));

            enhancedLogger.logError(errorInstance, {
                operation: 'ServiceRecoveryManager.initializeFallbackServices',
                metadata: {
                    category: 'service_recovery',
                    phase: 'fallback_services_init_failed',
                    gracefulDegradationMode: this.gracefulDegradationMode
                }
            });

            // In graceful degradation mode, don't throw - just log and continue
            if (this.gracefulDegradationMode) {
                enhancedLogger.warn('Fallback services initialization failed in graceful degradation mode, continuing', {
                    category: 'service_recovery',
                    phase: 'fallback_services_init_degraded_continue',
                    error: errorInstance.message
                });
            } else {
                throw errorInstance;
            }
        }
    }

    /**
     * Register critical services for monitoring
     */
    private async registerCriticalServices(): Promise<void> {
        // Note: In a real application, these services would be injected
        // For now, we'll register them when they're provided to the manager
        logger.info('Critical services registration completed');
    }

    /**
     * Perform initial health checks during initialization
     * This method doesn't call ensureInitialized() to avoid circular dependency
     */
    private async performInitialHealthChecks(): Promise<void> {
        enhancedLogger.info('Performing initial health checks during initialization', {
            category: 'service_recovery',
            phase: 'initial_health_checks',
            registeredServices: this.services.size
        });

        const healthResults = new Map<string, boolean>();
        let healthyServices = 0;
        let totalServices = 0;

        // Perform health checks without calling ensureInitialized()
        for (const [serviceName, serviceInstance] of this.services.entries()) {
            totalServices++;
            try {
                // Only perform health checks if we have the recovery instance and it's not in degraded mode
                if (this.recovery && !this.gracefulDegradationMode) {
                    const isHealthy = await this.recovery.performHealthCheck(
                        serviceName,
                        serviceInstance.instance
                    );
                    healthResults.set(serviceName, isHealthy);

                    if (isHealthy) {
                        healthyServices++;
                    }

                    enhancedLogger.info(`Initial health check for ${serviceName}: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`, {
                        category: 'service_recovery',
                        phase: 'initial_health_check_result',
                        serviceName,
                        isHealthy,
                        critical: serviceInstance.critical
                    });

                    if (!isHealthy && serviceInstance.critical) {
                        enhancedLogger.warn(`Critical service ${serviceName} failed initial health check`, {
                            category: 'service_recovery',
                            phase: 'initial_health_check_critical_failure',
                            serviceName
                        });
                    }
                } else {
                    // In degraded mode or without recovery instance, assume services are healthy for initialization
                    healthResults.set(serviceName, true);
                    healthyServices++;

                    enhancedLogger.info(`Initial health check for ${serviceName}: ASSUMED HEALTHY (degraded mode)`, {
                        category: 'service_recovery',
                        phase: 'initial_health_check_degraded',
                        serviceName,
                        gracefulDegradationMode: this.gracefulDegradationMode
                    });
                }
            } catch (error: unknown) {
                const errorInstance = error instanceof Error ? error : new Error(String(error));
                healthResults.set(serviceName, false);

                enhancedLogger.logError(errorInstance, {
                    operation: `ServiceRecoveryManager.performInitialHealthChecks.${serviceName}`,
                    metadata: {
                        category: 'service_recovery',
                        phase: 'initial_health_check_error',
                        serviceName,
                        critical: serviceInstance.critical
                    }
                });
            }
        }

        enhancedLogger.info(`Initial health check completed: ${healthyServices}/${totalServices} services healthy`, {
            category: 'service_recovery',
            phase: 'initial_health_checks_complete',
            healthyServices,
            totalServices,
            healthPercentage: totalServices > 0 ? Math.round((healthyServices / totalServices) * 100) : 100
        });

        // Store health check results for later reference
        if (totalServices === 0) {
            enhancedLogger.info('No services registered for initial health checks', {
                category: 'service_recovery',
                phase: 'initial_health_checks_no_services'
            });
        }
    }

    /**
     * Get recovery statistics
     */
    getRecoveryStats(): {
        totalServices: number;
        healthyServices: number;
        servicesWithFallback: number;
        criticalServices: number;
        gracefulDegradationMode: boolean;
        totalErrors: number;
        recentErrors: number;
        initializationStatus: string;
    } {
        try {
            this.ensureInitialized();

            let healthyServices = 0;
            if (!this.gracefulDegradationMode) {
                try {
                    const allHealth = this.recovery.getAllServiceHealth();
                    healthyServices = allHealth.filter(h => h.isHealthy).length;
                } catch (healthError: unknown) {
                    const errorInstance = healthError instanceof Error ? healthError : new Error(String(healthError));
                    enhancedLogger.warn('Failed to get service health information for stats', {
                        category: 'service_recovery',
                        phase: 'stats_health_check_failed',
                        error: errorInstance.message
                    });
                    healthyServices = 0;
                }
            }

            const servicesWithFallback = Array.from(this.services.values())
                .filter(s => s.fallback).length;
            const criticalServices = Array.from(this.services.values())
                .filter(s => s.critical).length;

            // Count recent errors (last 5 minutes)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const recentErrors = this.recoveryErrors.filter(e => e.timestamp > fiveMinutesAgo).length;

            const initializationStatus = this.initialized
                ? (this.gracefulDegradationMode ? 'degraded' : 'healthy')
                : (this.initializationError ? 'failed' : 'not_initialized');

            return {
                totalServices: this.services.size,
                healthyServices,
                servicesWithFallback,
                criticalServices,
                gracefulDegradationMode: this.gracefulDegradationMode,
                totalErrors: this.recoveryErrors.length,
                recentErrors,
                initializationStatus
            };

        } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            enhancedLogger.logError(errorInstance, {
                operation: 'ServiceRecoveryManager.getRecoveryStats',
                metadata: {
                    category: 'service_recovery',
                    phase: 'stats_collection_failed'
                }
            });

            // Return basic stats even if detailed collection fails
            return {
                totalServices: this.services.size,
                healthyServices: 0,
                servicesWithFallback: 0,
                criticalServices: 0,
                gracefulDegradationMode: this.gracefulDegradationMode,
                totalErrors: this.recoveryErrors.length,
                recentErrors: 0,
                initializationStatus: 'error'
            };
        }
    }

    /**
     * Get detailed error information for troubleshooting
     */
    getErrorSummary(): {
        totalErrors: number;
        errorsByPhase: Record<string, number>;
        recentErrors: ServiceRecoveryError[];
        initializationPhases: InitializationPhase[];
        recommendations: string[];
    } {
        const errorsByPhase: Record<string, number> = {};

        for (const error of this.recoveryErrors) {
            errorsByPhase[error.phase] = (errorsByPhase[error.phase] || 0) + 1;
        }

        // Get recent errors (last 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentErrors = this.recoveryErrors
            .filter(e => e.timestamp > tenMinutesAgo)
            .slice(-10); // Last 10 recent errors

        const recommendations: string[] = [];

        // Generate recommendations based on error patterns
        if (this.gracefulDegradationMode) {
            recommendations.push('System is running in graceful degradation mode - check initialization logs');
        }

        if ((errorsByPhase.initialization || 0) > 0) {
            recommendations.push('Initialization errors detected - verify service dependencies and configuration');
        }

        if ((errorsByPhase.runtime || 0) > 5) {
            recommendations.push('High number of runtime errors - check service health and network connectivity');
        }

        if ((errorsByPhase.registration || 0) > 0) {
            recommendations.push('Service registration errors - verify service instances and recovery system state');
        }

        const failedInitPhases = this.initializationPhases.filter(p => !p.success);
        if (failedInitPhases.length > 0) {
            recommendations.push(`Failed initialization phases: ${failedInitPhases.map(p => p.name).join(', ')}`);
        }

        return {
            totalErrors: this.recoveryErrors.length,
            errorsByPhase,
            recentErrors,
            initializationPhases: this.initializationPhases,
            recommendations
        };
    }

    /**
     * Get comprehensive system status for monitoring
     */
    getSystemStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy' | 'not_initialized';
        initialized: boolean;
        gracefulDegradationMode: boolean;
        services: {
            total: number;
            critical: number;
            withFallback: number;
        };
        errors: {
            total: number;
            recent: number;
            byPhase: Record<string, number>;
        };
        initialization: {
            timestamp?: string;
            phases: {
                total: number;
                successful: number;
                failed: number;
            };
        };
        uptime?: number;
    } {
        const stats = this.getRecoveryStats();
        const errorSummary = this.getErrorSummary();

        let status: 'healthy' | 'degraded' | 'unhealthy' | 'not_initialized';

        if (!this.initialized) {
            status = 'not_initialized';
        } else if (this.gracefulDegradationMode) {
            status = 'degraded';
        } else if (errorSummary.recentErrors.length > 5) {
            status = 'unhealthy';
        } else {
            status = 'healthy';
        }

        const uptime = this.initializationTimestamp
            ? new Date().getTime() - this.initializationTimestamp.getTime()
            : undefined;

        return {
            status,
            initialized: this.initialized,
            gracefulDegradationMode: this.gracefulDegradationMode,
            services: {
                total: stats.totalServices,
                critical: stats.criticalServices,
                withFallback: stats.servicesWithFallback
            },
            errors: {
                total: errorSummary.totalErrors,
                recent: errorSummary.recentErrors.length,
                byPhase: errorSummary.errorsByPhase
            },
            initialization: {
                timestamp: this.initializationTimestamp?.toISOString(),
                phases: {
                    total: this.initializationPhases.length,
                    successful: this.initializationPhases.filter(p => p.success).length,
                    failed: this.initializationPhases.filter(p => !p.success).length
                }
            },
            uptime
        };
    }

    /**
     * Stop recovery monitoring
     * Handles both initialized and uninitialized states gracefully
     */
    stopRecovery(): void {
        enhancedLogger.info('Stopping service recovery monitoring', {
            category: 'service_recovery',
            phase: 'stop_recovery_start',
            initialized: this.initialized,
            gracefulDegradationMode: this.gracefulDegradationMode
        });

        try {
            if (this.initialized && !this.gracefulDegradationMode && this.recovery) {
                this.recovery.shutdown();
                enhancedLogger.info('Service recovery monitoring stopped successfully', {
                    category: 'service_recovery',
                    phase: 'stop_recovery_complete'
                });
            } else if (this.gracefulDegradationMode) {
                enhancedLogger.info('Service recovery monitoring stop skipped (graceful degradation mode)', {
                    category: 'service_recovery',
                    phase: 'stop_recovery_skipped_degraded'
                });
            } else {
                enhancedLogger.info('Service recovery monitoring stop skipped (not initialized)', {
                    category: 'service_recovery',
                    phase: 'stop_recovery_skipped_not_initialized'
                });
            }
        } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));

            const serviceError: ServiceRecoveryError = {
                phase: 'shutdown',
                error: errorInstance,
                timestamp: new Date(),
                context: { operation: 'stopRecovery' }
            };
            this.recoveryErrors.push(serviceError);

            enhancedLogger.logError(errorInstance, {
                operation: 'ServiceRecoveryManager.stopRecovery',
                metadata: {
                    category: 'service_recovery',
                    phase: 'stop_recovery_failed',
                    initialized: this.initialized,
                    gracefulDegradationMode: this.gracefulDegradationMode
                }
            });

            // Don't re-throw the error during shutdown - log and continue
            enhancedLogger.warn('Service recovery monitoring stop failed, continuing with shutdown', {
                category: 'service_recovery',
                phase: 'stop_recovery_error_handled',
                error: errorInstance.message
            });
        }
    }

    /**
     * Shutdown the recovery system
     */
    shutdown(): void {
        const shutdownStartTime = new Date();

        enhancedLogger.info('Starting ServiceRecoveryManager shutdown', {
            category: 'service_recovery',
            phase: 'shutdown_start',
            initialized: this.initialized,
            gracefulDegradationMode: this.gracefulDegradationMode,
            registeredServices: this.services.size,
            totalErrors: this.recoveryErrors.length
        });

        const shutdownPhases: { name: string; success: boolean; error?: Error; duration?: number }[] = [];

        try {
            // Phase 1: Shutdown recovery system
            const recoveryShutdownStart = new Date();
            try {
                if (this.initialized && !this.gracefulDegradationMode) {
                    this.recovery.shutdown();
                    shutdownPhases.push({
                        name: 'recovery_system_shutdown',
                        success: true,
                        duration: new Date().getTime() - recoveryShutdownStart.getTime()
                    });
                    enhancedLogger.info('Recovery system shutdown completed', {
                        category: 'service_recovery',
                        phase: 'recovery_system_shutdown_complete'
                    });
                } else {
                    shutdownPhases.push({
                        name: 'recovery_system_shutdown',
                        success: true,
                        duration: new Date().getTime() - recoveryShutdownStart.getTime()
                    });
                    enhancedLogger.info('Recovery system shutdown skipped (not initialized or in degraded mode)', {
                        category: 'service_recovery',
                        phase: 'recovery_system_shutdown_skipped',
                        initialized: this.initialized,
                        gracefulDegradationMode: this.gracefulDegradationMode
                    });
                }
            } catch (recoveryShutdownError: unknown) {
                const errorInstance = recoveryShutdownError instanceof Error ? recoveryShutdownError : new Error(String(recoveryShutdownError));
                shutdownPhases.push({
                    name: 'recovery_system_shutdown',
                    success: false,
                    error: errorInstance,
                    duration: new Date().getTime() - recoveryShutdownStart.getTime()
                });

                const serviceError: ServiceRecoveryError = {
                    phase: 'shutdown',
                    error: errorInstance,
                    timestamp: new Date(),
                    context: { shutdownPhase: 'recovery_system_shutdown' }
                };
                this.recoveryErrors.push(serviceError);

                enhancedLogger.logError(errorInstance, {
                    operation: 'ServiceRecoveryManager.shutdown.recoverySystem',
                    metadata: {
                        category: 'service_recovery',
                        phase: 'recovery_system_shutdown_failed'
                    }
                });
            }

            // Phase 2: Clear services and state
            const stateCleanupStart = new Date();
            try {
                const serviceCount = this.services.size;
                const errorCount = this.recoveryErrors.length;
                const phaseCount = this.initializationPhases.length;

                this.services.clear();
                this.initialized = false;
                this.initializationError = undefined;
                this.initializationTimestamp = undefined;
                this.gracefulDegradationMode = false;
                this.initializationPhases = [];
                this.recoveryErrors = [];

                shutdownPhases.push({
                    name: 'state_cleanup',
                    success: true,
                    duration: new Date().getTime() - stateCleanupStart.getTime()
                });

                enhancedLogger.info('ServiceRecoveryManager state cleanup completed', {
                    category: 'service_recovery',
                    phase: 'state_cleanup_complete',
                    clearedServices: serviceCount,
                    clearedErrors: errorCount,
                    clearedPhases: phaseCount
                });

            } catch (stateCleanupError: unknown) {
                const errorInstance = stateCleanupError instanceof Error ? stateCleanupError : new Error(String(stateCleanupError));
                shutdownPhases.push({
                    name: 'state_cleanup',
                    success: false,
                    error: errorInstance,
                    duration: new Date().getTime() - stateCleanupStart.getTime()
                });

                enhancedLogger.logError(errorInstance, {
                    operation: 'ServiceRecoveryManager.shutdown.stateCleanup',
                    metadata: {
                        category: 'service_recovery',
                        phase: 'state_cleanup_failed'
                    }
                });

                // Force reset state even if cleanup fails
                this.initialized = false;
                this.initializationError = undefined;
                this.initializationTimestamp = undefined;
                this.gracefulDegradationMode = false;
            }

            const totalShutdownDuration = new Date().getTime() - shutdownStartTime.getTime();
            const successfulPhases = shutdownPhases.filter(p => p.success).length;

            enhancedLogger.info('ServiceRecoveryManager shutdown completed', {
                category: 'service_recovery',
                phase: 'shutdown_complete',
                totalDuration: totalShutdownDuration,
                successfulPhases,
                totalPhases: shutdownPhases.length,
                shutdownPhases: shutdownPhases.map(p => ({
                    name: p.name,
                    success: p.success,
                    duration: p.duration,
                    error: p.error?.message
                }))
            });

        } catch (error: unknown) {
            const errorInstance = error instanceof Error ? error : new Error(String(error));
            const totalShutdownDuration = new Date().getTime() - shutdownStartTime.getTime();

            enhancedLogger.logError(errorInstance, {
                operation: 'ServiceRecoveryManager.shutdown',
                metadata: {
                    category: 'service_recovery',
                    phase: 'shutdown_failed',
                    totalDuration: totalShutdownDuration,
                    completedPhases: shutdownPhases.filter(p => p.success).length,
                    totalPhases: shutdownPhases.length
                }
            });

            // Still reset the state even if shutdown fails completely
            this.initialized = false;
            this.initializationError = undefined;
            this.initializationTimestamp = undefined;
            this.gracefulDegradationMode = false;

            enhancedLogger.warn('ServiceRecoveryManager state forcibly reset after shutdown failure', {
                category: 'service_recovery',
                phase: 'shutdown_force_reset'
            });
        }
    }
}

// Export singleton instance
export const serviceRecoveryManager = new ServiceRecoveryManager();