import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './MonitoringCard';
import { Badge } from './MonitoringBadge';
import { Button } from './MonitoringButton';
import { ServiceMetricsChart } from './ServiceMetricsChart';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, BarChart3 } from 'lucide-react';

interface ServiceHealthStatus {
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

interface ServiceHealthSummary {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    lastUpdate: Date;
}

interface ServiceHealthAlert {
    type: 'warning' | 'critical';
    serviceName: string;
    issue: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

/**
 * Service Health Dashboard Component
 * 
 * Provides real-time monitoring interface for service method availability,
 * visual indicators for service dependency status, and historical tracking.
 * Requirements: 3.1, 3.2
 */
export const ServiceHealthDashboard: React.FC = () => {
    const [healthSummary, setHealthSummary] = useState<ServiceHealthSummary | null>(null);
    const [serviceStatuses, setServiceStatuses] = useState<ServiceHealthStatus[]>([]);
    const [alerts, setAlerts] = useState<ServiceHealthAlert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [selectedServiceForMetrics, setSelectedServiceForMetrics] = useState<string | null>(null);
    const [showMetrics, setShowMetrics] = useState(false);

    // Fetch service health data
    const fetchHealthData = async () => {
        try {
            setIsLoading(true);

            // Fetch health summary
            const summaryResponse = await fetch('/api/monitoring/health/services');
            const summaryData = await summaryResponse.json();
            setHealthSummary(summaryData);

            // Fetch detailed service statuses
            const detailedResponse = await fetch('/api/monitoring/health/services/detailed');
            const detailedData = await detailedResponse.json();
            setServiceStatuses(detailedData.services || []);

            // Fetch recent alerts
            const alertsResponse = await fetch('/api/monitoring/alerts/services?limit=20');
            const alertsData = await alertsResponse.json();
            setAlerts(alertsData.alerts || []);

            setLastRefresh(new Date());
        } catch (error) {
            console.error('Failed to fetch service health data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Manual refresh
    const handleRefresh = () => {
        fetchHealthData();
    };

    // Trigger manual health check
    const triggerHealthCheck = async () => {
        try {
            await fetch('/api/monitoring/health/services/check', { method: 'POST' });
            // Refresh data after health check
            setTimeout(fetchHealthData, 1000);
        } catch (error) {
            console.error('Failed to trigger health check:', error);
        }
    };

    // Auto-refresh effect
    useEffect(() => {
        fetchHealthData();

        if (autoRefresh) {
            const interval = setInterval(fetchHealthData, 30000); // Refresh every 30 seconds
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    // Get status color and icon
    const getStatusDisplay = (status: string) => {
        switch (status) {
            case 'healthy':
                return {
                    color: 'bg-green-100 text-green-800',
                    icon: <CheckCircle className="w-4 h-4" />,
                    text: 'Healthy'
                };
            case 'degraded':
                return {
                    color: 'bg-yellow-100 text-yellow-800',
                    icon: <AlertTriangle className="w-4 h-4" />,
                    text: 'Degraded'
                };
            case 'unhealthy':
                return {
                    color: 'bg-red-100 text-red-800',
                    icon: <XCircle className="w-4 h-4" />,
                    text: 'Unhealthy'
                };
            default:
                return {
                    color: 'bg-gray-100 text-gray-800',
                    icon: <Clock className="w-4 h-4" />,
                    text: 'Unknown'
                };
        }
    };

    // Format time ago
    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - new Date(date).getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    if (isLoading && !healthSummary) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span className="ml-2">Loading service health data...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Service Health Dashboard</h1>
                    <p className="text-gray-600">
                        Monitor service method availability and system health
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        {autoRefresh ? 'Disable Auto-refresh' : 'Enable Auto-refresh'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={triggerHealthCheck}
                    >
                        Run Health Check
                    </Button>
                </div>
            </div>

            {/* Last refresh info */}
            <div className="text-sm text-gray-500">
                Last updated: {formatTimeAgo(lastRefresh)}
                {autoRefresh && ' (Auto-refresh enabled)'}
            </div>

            {/* Health Summary */}
            {healthSummary && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            Overall System Health
                            <Badge className={`ml-2 ${getStatusDisplay(healthSummary.overallStatus).color}`}>
                                {getStatusDisplay(healthSummary.overallStatus).icon}
                                <span className="ml-1">{getStatusDisplay(healthSummary.overallStatus).text}</span>
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{healthSummary.totalServices}</div>
                                <div className="text-sm text-gray-600">Total Services</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{healthSummary.healthyServices}</div>
                                <div className="text-sm text-gray-600">Healthy</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-yellow-600">{healthSummary.degradedServices}</div>
                                <div className="text-sm text-gray-600">Degraded</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-red-600">{healthSummary.unhealthyServices}</div>
                                <div className="text-sm text-gray-600">Unhealthy</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Service Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {serviceStatuses.map((service) => {
                    const statusDisplay = getStatusDisplay(service.status);
                    const availableMethods = Object.entries(service.methodAvailability).filter(([, available]) => available);
                    const unavailableMethods = Object.entries(service.methodAvailability).filter(([, available]) => !available);

                    return (
                        <Card key={service.serviceName} className="relative">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center justify-between text-lg">
                                    <span>{service.serviceName}</span>
                                    <Badge className={statusDisplay.color}>
                                        {statusDisplay.icon}
                                        <span className="ml-1">{statusDisplay.text}</span>
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Response Time */}
                                {service.responseTime && (
                                    <div className="flex justify-between text-sm">
                                        <span>Response Time:</span>
                                        <span className={service.responseTime > 1000 ? 'text-red-600' : 'text-green-600'}>
                                            {service.responseTime}ms
                                        </span>
                                    </div>
                                )}

                                {/* Uptime */}
                                <div className="flex justify-between text-sm">
                                    <span>Uptime:</span>
                                    <span className={service.uptime < 95 ? 'text-red-600' : 'text-green-600'}>
                                        {service.uptime.toFixed(1)}%
                                    </span>
                                </div>

                                {/* Error/Success Counts */}
                                <div className="flex justify-between text-sm">
                                    <span>Success/Error:</span>
                                    <span>
                                        <span className="text-green-600">{service.successCount}</span>
                                        {' / '}
                                        <span className="text-red-600">{service.errorCount}</span>
                                    </span>
                                </div>

                                {/* Method Availability */}
                                <div className="space-y-2">
                                    <div className="text-sm font-medium">Method Availability:</div>

                                    {availableMethods.length > 0 && (
                                        <div className="space-y-1">
                                            <div className="text-xs text-green-600 font-medium">Available:</div>
                                            <div className="flex flex-wrap gap-1">
                                                {availableMethods.map(([method]) => (
                                                    <Badge key={method} variant="outline" className="text-xs bg-green-50 text-green-700">
                                                        {method}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {unavailableMethods.length > 0 && (
                                        <div className="space-y-1">
                                            <div className="text-xs text-red-600 font-medium">Unavailable:</div>
                                            <div className="flex flex-wrap gap-1">
                                                {unavailableMethods.map(([method]) => (
                                                    <Badge key={method} variant="outline" className="text-xs bg-red-50 text-red-700">
                                                        {method}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="pt-2 border-t">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setSelectedServiceForMetrics(service.serviceName);
                                            setShowMetrics(true);
                                        }}
                                        className="w-full"
                                    >
                                        <BarChart3 className="w-4 h-4 mr-2" />
                                        View Metrics
                                    </Button>
                                </div>

                                {/* Last Checked */}
                                <div className="text-xs text-gray-500 pt-2">
                                    Last checked: {formatTimeAgo(service.lastChecked)}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Recent Alerts */}
            {alerts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2" />
                            Recent Alerts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {alerts.slice(0, 10).map((alert, index) => (
                                <div
                                    key={index}
                                    className={`p-3 rounded-lg border-l-4 ${alert.type === 'critical'
                                        ? 'bg-red-50 border-red-400'
                                        : 'bg-yellow-50 border-yellow-400'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <Badge
                                                className={
                                                    alert.type === 'critical'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                                }
                                            >
                                                {alert.type.toUpperCase()}
                                            </Badge>
                                            <span className="ml-2 font-medium">{alert.serviceName}</span>
                                        </div>
                                        <span className="text-sm text-gray-500">
                                            {formatTimeAgo(alert.timestamp)}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-sm text-gray-700">{alert.issue}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Service Metrics Modal */}
            {showMetrics && selectedServiceForMetrics && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Service Metrics: {selectedServiceForMetrics}</h2>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowMetrics(false);
                                    setSelectedServiceForMetrics(null);
                                }}
                            >
                                Close
                            </Button>
                        </div>
                        <div className="p-6">
                            <ServiceMetricsChart serviceName={selectedServiceForMetrics} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};