import { ServiceValidator, ServiceValidationResult } from '../validation/ServiceValidator';
import { ServiceValidationStartup } from '../startup/ServiceValidationStartup';
import { logger } from '../../utils/logger';

export interface ServiceHealthStatus {
    serviceName: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastChecked: Date;
    methodAvailability: Record<string, boolean>;
    responseTime?: number;
    errorCount: number;
    successCount: number;
    uptime: number;
    metadata?: Record<string, any>;
}

export interface ServiceHealthAlert {
    type: 'warning' | 'critical';
    serviceName: string;
    issue: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export interface ServicePerformanceMetric {
    serviceName: string;
    methodName: string;
    responseTime: number;
    success: boolean;
    timestamp: Date;
    errorMessage?: string;
}

export interface ServiceHealthSummary {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    lastUpdate: Date;
}

/**
 * Service Health Monitoring System
 * 
 * Provides periodic health checks for service method availability,
 * performance monitoring, and alerting for service degradation.
 * Requirements: 3.1, 3.2, 5.2
 */
export class ServiceHealthMonitor {
    private static instance: ServiceHealthMonitor;
    private serviceStatuses: Map<string, ServiceHealthStatus> = new Map();
    private performanceMetrics: Map<string, ServicePerformanceMetric[]> = new Map();
    private alerts: ServiceHealthAlert[] = [];
    private monitoringInterval?: NodeJS.Timeout;
    private isMonitoring: boolean = false;
    private healthCheckInterval: number = 60000; // 1 minute default
    private maxMetricsHistory: number = 1000;
    private maxAlertsHistory: number = 100;

    private constructor() { }

    static getInstance(): ServiceHealthMonitor {
        if (!ServiceHealthMonitor.instance) {
            ServiceHealthMonitor.instance = new ServiceHealthMonitor();
        }
        return ServiceHealthMonitor.instance;
    }

    /**
     * Start periodic health monitoring
     */
    startMonitoring(intervalMs: number = 60000): void {
        if (this.isMonitoring) {
            logger.warn('Service health monitoring is already running');
            return;
        }

        this.healthCheckInterval = intervalMs;
        this.isMonitoring = true;

        logger.info('Starting service health monitoring', { intervalMs });

        // Perform initial health check
        this.performHealthCheck();

        // Set up periodic monitoring
        this.monitoringInterval = setInterval(() => {
            this.performHealthCheck();
        }, intervalMs);
    }

    /**
     * Stop periodic health monitoring
     */
    stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }

        this.isMonitoring = false;
        logger.info('Service health monitoring stopped');
    }

    /**
     * Perform health check for all registered services
     */
    async performHealthCheck(): Promise<void> {
        try {
            logger.debug('Performing service health check');

            const serviceValidationStartup = ServiceValidationStartup.getInstance();
            const validationReport = serviceValidationStartup.getValidationReport();

            // Check each registered service
            for (const serviceName of validationReport.serviceNames) {
                await this.checkServiceHealth(serviceName);
            }

            // Clean up old metrics and alerts
            this.cleanupOldData();

            logger.debug('Service health check completed', {
                totalServices: validationReport.registeredServices,
                healthyServices: this.getHealthyServicesCount(),
                degradedServices: this.getDegradedServicesCount(),
                unhealthyServices: this.getUnhealthyServicesCount()
            });

        } catch (error) {
            logger.error('Error during service health check', { error });
        }
    }

    /**
     * Check health of a specific service
     */
    async checkServiceHealth(serviceName: string): Promise<ServiceHealthStatus> {
        const startTime = Date.now();
        let status: ServiceHealthStatus;

        try {
            const serviceValidationStartup = ServiceValidationStartup.getInstance();
            const validationResult = await serviceValidationStartup.validateSpecificService(serviceName);

            if (!validationResult) {
                status = {
                    serviceName,
                    status: 'unhealthy',
                    lastChecked: new Date(),
                    methodAvailability: {},
                    errorCount: this.getServiceErrorCount(serviceName) + 1,
                    successCount: this.getServiceSuccessCount(serviceName),
                    uptime: this.calculateServiceUptime(serviceName),
                    metadata: { error: 'Service not registered for validation' }
                };
            } else {
                const responseTime = Date.now() - startTime;
                const methodAvailability: Record<string, boolean> = {};

                // Check method availability
                for (const method of validationResult.availableMethods) {
                    methodAvailability[method] = true;
                }
                for (const method of validationResult.missingMethods) {
                    methodAvailability[method] = false;
                }

                // Determine health status
                let healthStatus: 'healthy' | 'degraded' | 'unhealthy';
                if (validationResult.isValid) {
                    healthStatus = 'healthy';
                } else if (validationResult.missingMethods.length > 0) {
                    healthStatus = 'unhealthy';
                } else {
                    healthStatus = 'degraded';
                }

                status = {
                    serviceName,
                    status: healthStatus,
                    lastChecked: new Date(),
                    methodAvailability,
                    responseTime,
                    errorCount: validationResult.isValid ? this.getServiceErrorCount(serviceName) : this.getServiceErrorCount(serviceName) + 1,
                    successCount: validationResult.isValid ? this.getServiceSuccessCount(serviceName) + 1 : this.getServiceSuccessCount(serviceName),
                    uptime: this.calculateServiceUptime(serviceName),
                    metadata: {
                        availableMethods: validationResult.availableMethods.length,
                        missingMethods: validationResult.missingMethods.length,
                        errors: validationResult.errors
                    }
                };

                // Record performance metric
                this.recordPerformanceMetric({
                    serviceName,
                    methodName: 'healthCheck',
                    responseTime,
                    success: validationResult.isValid,
                    timestamp: new Date(),
                    errorMessage: validationResult.errors.length > 0 ? validationResult.errors.join(', ') : undefined
                });

                // Check for alerts
                this.checkForAlerts(status, validationResult);
            }

        } catch (error) {
            status = {
                serviceName,
                status: 'unhealthy',
                lastChecked: new Date(),
                methodAvailability: {},
                errorCount: this.getServiceErrorCount(serviceName) + 1,
                successCount: this.getServiceSuccessCount(serviceName),
                uptime: this.calculateServiceUptime(serviceName),
                metadata: { error: error instanceof Error ? error.message : String(error) }
            };

            logger.error(`Service health check failed for ${serviceName}`, { error });
        }

        // Update service status
        this.serviceStatuses.set(serviceName, status);
        return status;
    }

    /**
     * Record performance metric for a service method
     */
    recordPerformanceMetric(metric: ServicePerformanceMetric): void {
        const key = `${metric.serviceName}.${metric.methodName}`;

        if (!this.performanceMetrics.has(key)) {
            this.performanceMetrics.set(key, []);
        }

        const metrics = this.performanceMetrics.get(key)!;
        metrics.push(metric);

        // Keep only recent metrics
        if (metrics.length > this.maxMetricsHistory) {
            metrics.splice(0, metrics.length - this.maxMetricsHistory);
        }
    }

    /**
     * Check for service alerts based on health status
     */
    private checkForAlerts(status: ServiceHealthStatus, validationResult: ServiceValidationResult): void {
        // Alert for unhealthy services
        if (status.status === 'unhealthy') {
            this.addAlert({
                type: 'critical',
                serviceName: status.serviceName,
                issue: `Service is unhealthy: ${validationResult.errors.join(', ')}`,
                timestamp: new Date(),
                metadata: {
                    missingMethods: validationResult.missingMethods,
                    errors: validationResult.errors
                }
            });
        }

        // Alert for degraded services
        if (status.status === 'degraded') {
            this.addAlert({
                type: 'warning',
                serviceName: status.serviceName,
                issue: 'Service is degraded',
                timestamp: new Date(),
                metadata: {
                    responseTime: status.responseTime,
                    errors: validationResult.errors
                }
            });
        }

        // Alert for high error rates
        const errorRate = this.calculateErrorRate(status.serviceName);
        if (errorRate > 0.1) { // 10% error rate threshold
            this.addAlert({
                type: errorRate > 0.5 ? 'critical' : 'warning',
                serviceName: status.serviceName,
                issue: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
                timestamp: new Date(),
                metadata: { errorRate }
            });
        }

        // Alert for slow response times
        if (status.responseTime && status.responseTime > 5000) { // 5 second threshold
            this.addAlert({
                type: status.responseTime > 10000 ? 'critical' : 'warning',
                serviceName: status.serviceName,
                issue: `Slow response time: ${status.responseTime}ms`,
                timestamp: new Date(),
                metadata: { responseTime: status.responseTime }
            });
        }
    }

    /**
     * Add an alert
     */
    private addAlert(alert: ServiceHealthAlert): void {
        this.alerts.push(alert);

        // Keep only recent alerts
        if (this.alerts.length > this.maxAlertsHistory) {
            this.alerts.splice(0, this.alerts.length - this.maxAlertsHistory);
        }

        // Log the alert
        if (alert.type === 'critical') {
            logger.error(`Service health alert: ${alert.serviceName} - ${alert.issue}`, alert.metadata);
        } else {
            logger.warn(`Service health alert: ${alert.serviceName} - ${alert.issue}`, alert.metadata);
        }
    }

    /**
     * Get current health summary
     */
    getHealthSummary(): ServiceHealthSummary {
        const totalServices = this.serviceStatuses.size;
        const healthyServices = this.getHealthyServicesCount();
        const degradedServices = this.getDegradedServicesCount();
        const unhealthyServices = this.getUnhealthyServicesCount();

        let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
        if (unhealthyServices > 0) {
            overallStatus = 'unhealthy';
        } else if (degradedServices > 0) {
            overallStatus = 'degraded';
        } else {
            overallStatus = 'healthy';
        }

        return {
            totalServices,
            healthyServices,
            degradedServices,
            unhealthyServices,
            overallStatus,
            lastUpdate: new Date()
        };
    }

    /**
     * Get health status for all services
     */
    getAllServiceStatuses(): ServiceHealthStatus[] {
        return Array.from(this.serviceStatuses.values());
    }

    /**
     * Get health status for a specific service
     */
    getServiceStatus(serviceName: string): ServiceHealthStatus | undefined {
        return this.serviceStatuses.get(serviceName);
    }

    /**
     * Get recent alerts
     */
    getRecentAlerts(limit: number = 50): ServiceHealthAlert[] {
        return this.alerts.slice(-limit);
    }

    /**
     * Get performance metrics for a service method
     */
    getPerformanceMetrics(serviceName: string, methodName?: string): ServicePerformanceMetric[] {
        if (methodName) {
            const key = `${serviceName}.${methodName}`;
            return this.performanceMetrics.get(key) || [];
        }

        // Get all metrics for the service
        const allMetrics: ServicePerformanceMetric[] = [];
        for (const [key, metrics] of this.performanceMetrics) {
            if (key.startsWith(`${serviceName}.`)) {
                allMetrics.push(...metrics);
            }
        }
        return allMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    /**
     * Calculate error rate for a service
     */
    private calculateErrorRate(serviceName: string): number {
        const metrics = this.getPerformanceMetrics(serviceName);
        if (metrics.length === 0) return 0;

        const recentMetrics = metrics.filter(m =>
            Date.now() - m.timestamp.getTime() < 300000 // Last 5 minutes
        );

        if (recentMetrics.length === 0) return 0;

        const errorCount = recentMetrics.filter(m => !m.success).length;
        return errorCount / recentMetrics.length;
    }

    /**
     * Calculate service uptime
     */
    private calculateServiceUptime(serviceName: string): number {
        const status = this.serviceStatuses.get(serviceName);
        if (!status) return 0;

        // Simple uptime calculation based on health checks
        const metrics = this.getPerformanceMetrics(serviceName);
        if (metrics.length === 0) return 100;

        const recentMetrics = metrics.filter(m =>
            Date.now() - m.timestamp.getTime() < 3600000 // Last hour
        );

        if (recentMetrics.length === 0) return 100;

        const successCount = recentMetrics.filter(m => m.success).length;
        return (successCount / recentMetrics.length) * 100;
    }

    /**
     * Get service error count
     */
    private getServiceErrorCount(serviceName: string): number {
        const status = this.serviceStatuses.get(serviceName);
        return status?.errorCount || 0;
    }

    /**
     * Get service success count
     */
    private getServiceSuccessCount(serviceName: string): number {
        const status = this.serviceStatuses.get(serviceName);
        return status?.successCount || 0;
    }

    /**
     * Get count of healthy services
     */
    private getHealthyServicesCount(): number {
        return Array.from(this.serviceStatuses.values()).filter(s => s.status === 'healthy').length;
    }

    /**
     * Get count of degraded services
     */
    private getDegradedServicesCount(): number {
        return Array.from(this.serviceStatuses.values()).filter(s => s.status === 'degraded').length;
    }

    /**
     * Get count of unhealthy services
     */
    private getUnhealthyServicesCount(): number {
        return Array.from(this.serviceStatuses.values()).filter(s => s.status === 'unhealthy').length;
    }

    /**
     * Clean up old data
     */
    private cleanupOldData(): void {
        const cutoffTime = Date.now() - 86400000; // 24 hours ago

        // Clean up old performance metrics
        for (const [key, metrics] of this.performanceMetrics) {
            const recentMetrics = metrics.filter(m => m.timestamp.getTime() > cutoffTime);
            this.performanceMetrics.set(key, recentMetrics);
        }

        // Clean up old alerts
        this.alerts = this.alerts.filter(a => a.timestamp.getTime() > cutoffTime);
    }

    /**
     * Get monitoring status
     */
    getMonitoringStatus(): {
        isMonitoring: boolean;
        intervalMs: number;
        totalServices: number;
        lastHealthCheck?: Date;
    } {
        const statuses = Array.from(this.serviceStatuses.values());
        const lastHealthCheck = statuses.length > 0
            ? new Date(Math.max(...statuses.map(s => s.lastChecked.getTime())))
            : undefined;

        return {
            isMonitoring: this.isMonitoring,
            intervalMs: this.healthCheckInterval,
            totalServices: this.serviceStatuses.size,
            lastHealthCheck
        };
    }
}