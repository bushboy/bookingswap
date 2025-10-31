import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './MonitoringCard';
import { Button } from './MonitoringButton';
import { Badge } from './MonitoringBadge';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface ServicePerformanceMetric {
    serviceName: string;
    methodName: string;
    responseTime: number;
    success: boolean;
    timestamp: Date;
    errorMessage?: string;
}

interface MetricsSummary {
    serviceName: string;
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
    trend: 'up' | 'down' | 'stable';
}

/**
 * Service Metrics Chart Component
 * 
 * Displays historical tracking of service health metrics,
 * performance trends, and method-specific analytics.
 * Requirements: 3.1, 3.2
 */
export const ServiceMetricsChart: React.FC<{ serviceName?: string }> = ({ serviceName }) => {
    const [metrics, setMetrics] = useState<ServicePerformanceMetric[]>([]);
    const [summary, setSummary] = useState<MetricsSummary | null>(null);
    const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('1h');
    const [selectedMethod, setSelectedMethod] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);

    // Fetch metrics data
    const fetchMetrics = async () => {
        if (!serviceName) return;

        try {
            setIsLoading(true);

            const url = selectedMethod === 'all'
                ? `/api/monitoring/metrics/services/${serviceName}`
                : `/api/monitoring/metrics/services/${serviceName}?method=${selectedMethod}`;

            const response = await fetch(url);
            const data = await response.json();

            setMetrics(data.metrics || []);

            // Calculate summary
            if (data.metrics && data.metrics.length > 0) {
                const totalRequests = data.metrics.length;
                const successfulRequests = data.metrics.filter((m: ServicePerformanceMetric) => m.success).length;
                const successRate = (successfulRequests / totalRequests) * 100;
                const averageResponseTime = data.metrics.reduce((sum: number, m: ServicePerformanceMetric) => sum + m.responseTime, 0) / totalRequests;
                const errorRate = ((totalRequests - successfulRequests) / totalRequests) * 100;

                // Simple trend calculation (compare first half vs second half)
                const midPoint = Math.floor(totalRequests / 2);
                const firstHalfAvg = data.metrics.slice(0, midPoint).reduce((sum: number, m: ServicePerformanceMetric) => sum + m.responseTime, 0) / midPoint;
                const secondHalfAvg = data.metrics.slice(midPoint).reduce((sum: number, m: ServicePerformanceMetric) => sum + m.responseTime, 0) / (totalRequests - midPoint);

                let trend: 'up' | 'down' | 'stable' = 'stable';
                if (secondHalfAvg > firstHalfAvg * 1.1) trend = 'up';
                else if (secondHalfAvg < firstHalfAvg * 0.9) trend = 'down';

                setSummary({
                    serviceName,
                    totalRequests,
                    successRate,
                    averageResponseTime,
                    errorRate,
                    trend
                });
            }
        } catch (error) {
            console.error('Failed to fetch service metrics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, [serviceName, selectedMethod, timeRange]);

    // Get unique method names
    const availableMethods = Array.from(new Set(metrics.map(m => m.methodName)));

    // Filter metrics by time range
    const getFilteredMetrics = () => {
        const now = new Date();
        const cutoff = new Date();

        switch (timeRange) {
            case '1h':
                cutoff.setHours(now.getHours() - 1);
                break;
            case '24h':
                cutoff.setDate(now.getDate() - 1);
                break;
            case '7d':
                cutoff.setDate(now.getDate() - 7);
                break;
        }

        return metrics.filter(m => new Date(m.timestamp) >= cutoff);
    };

    const filteredMetrics = getFilteredMetrics();

    // Create simple chart data points
    const createChartPoints = () => {
        const points = filteredMetrics.map((metric, index) => ({
            x: index,
            y: metric.responseTime,
            success: metric.success,
            timestamp: metric.timestamp
        }));

        return points;
    };

    const chartPoints = createChartPoints();

    if (!serviceName) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center h-32">
                    <p className="text-gray-500">Select a service to view metrics</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Controls */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center">
                            <Activity className="w-5 h-5 mr-2" />
                            Service Metrics: {serviceName}
                        </span>
                        <div className="flex items-center space-x-2">
                            <select
                                value={selectedMethod}
                                onChange={(e) => setSelectedMethod(e.target.value)}
                                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                            >
                                <option value="all">All Methods</option>
                                {availableMethods.map(method => (
                                    <option key={method} value={method}>{method}</option>
                                ))}
                            </select>
                            <div className="flex border border-gray-300 rounded-md">
                                {(['1h', '24h', '7d'] as const).map((range) => (
                                    <Button
                                        key={range}
                                        variant={timeRange === range ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setTimeRange(range)}
                                        className="rounded-none first:rounded-l-md last:rounded-r-md border-0"
                                    >
                                        {range}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardTitle>
                </CardHeader>
            </Card>

            {/* Summary Stats */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{summary.totalRequests}</div>
                                <div className="text-sm text-gray-600">Total Requests</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="text-center">
                                <div className={`text-2xl font-bold ${summary.successRate >= 95 ? 'text-green-600' : summary.successRate >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {summary.successRate.toFixed(1)}%
                                </div>
                                <div className="text-sm text-gray-600">Success Rate</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="text-center">
                                <div className={`text-2xl font-bold ${summary.averageResponseTime < 1000 ? 'text-green-600' : summary.averageResponseTime < 3000 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {Math.round(summary.averageResponseTime)}ms
                                </div>
                                <div className="text-sm text-gray-600">Avg Response</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="text-center">
                                <div className="flex items-center justify-center">
                                    <span className={`text-2xl font-bold ${summary.errorRate < 5 ? 'text-green-600' : summary.errorRate < 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {summary.errorRate.toFixed(1)}%
                                    </span>
                                    {summary.trend === 'up' && <TrendingUp className="w-4 h-4 ml-1 text-red-500" />}
                                    {summary.trend === 'down' && <TrendingDown className="w-4 h-4 ml-1 text-green-500" />}
                                </div>
                                <div className="text-sm text-gray-600">Error Rate</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Simple Response Time Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Response Time Trend</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="text-gray-500">Loading metrics...</div>
                        </div>
                    ) : chartPoints.length === 0 ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="text-gray-500">No data available for selected time range</div>
                        </div>
                    ) : (
                        <div className="h-32 relative">
                            <svg width="100%" height="100%" className="border border-gray-200 rounded">
                                {/* Simple line chart */}
                                {chartPoints.length > 1 && (
                                    <polyline
                                        fill="none"
                                        stroke="#3B82F6"
                                        strokeWidth="2"
                                        points={chartPoints.map((point, index) => {
                                            const x = (index / (chartPoints.length - 1)) * 100;
                                            const maxY = Math.max(...chartPoints.map(p => p.y));
                                            const y = 100 - (point.y / maxY) * 80; // Leave 20% margin
                                            return `${x}%,${y}%`;
                                        }).join(' ')}
                                    />
                                )}

                                {/* Data points */}
                                {chartPoints.map((point, index) => {
                                    const x = (index / (chartPoints.length - 1)) * 100;
                                    const maxY = Math.max(...chartPoints.map(p => p.y));
                                    const y = 100 - (point.y / maxY) * 80;

                                    return (
                                        <circle
                                            key={index}
                                            cx={`${x}%`}
                                            cy={`${y}%`}
                                            r="3"
                                            fill={point.success ? '#10B981' : '#EF4444'}
                                            className="hover:r-4 transition-all"
                                        >
                                            <title>
                                                {`${point.y}ms at ${new Date(point.timestamp).toLocaleTimeString()}`}
                                            </title>
                                        </circle>
                                    );
                                })}
                            </svg>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recent Errors */}
            {filteredMetrics.some(m => !m.success) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-red-600">Recent Errors</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {filteredMetrics
                                .filter(m => !m.success)
                                .slice(0, 5)
                                .map((metric, index) => (
                                    <div key={index} className="p-2 bg-red-50 border border-red-200 rounded">
                                        <div className="flex items-center justify-between">
                                            <Badge className="bg-red-100 text-red-800">
                                                {metric.methodName}
                                            </Badge>
                                            <span className="text-sm text-gray-500">
                                                {new Date(metric.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        {metric.errorMessage && (
                                            <div className="mt-1 text-sm text-red-700">
                                                {metric.errorMessage}
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};