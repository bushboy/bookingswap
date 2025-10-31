/**
 * Utility to reset throttling state for all WebSocket services
 * Useful for debugging and recovering from throttling issues
 */

import { connectionThrottlingManager, connectionStateChecker } from './connectionThrottling';

/**
 * Reset throttling state for all known WebSocket services
 */
export function resetAllThrottling(): void {
    const services = [
        'useWebSocket',
        'proposalWebSocketService',
        'completionWebSocketService',
        'targetingWebSocketService',
    ];

    services.forEach(serviceId => {
        connectionThrottlingManager.resetConnectionTracking(serviceId);
        connectionStateChecker.resetConnectionState(serviceId);
    });

    console.log('Reset throttling state for all WebSocket services:', services);
}

/**
 * Reset throttling state for a specific service
 */
export function resetServiceThrottling(serviceId: string): void {
    connectionThrottlingManager.resetConnectionTracking(serviceId);
    connectionStateChecker.resetConnectionState(serviceId);
    console.log(`Reset throttling state for service: ${serviceId}`);
}

/**
 * Get throttling status for all services (for debugging)
 */
export function getAllThrottlingStatus(): Record<string, any> {
    const services = [
        'useWebSocket',
        'proposalWebSocketService',
        'completionWebSocketService',
        'targetingWebSocketService',
    ];

    const status: Record<string, any> = {};

    services.forEach(serviceId => {
        status[serviceId] = connectionStateChecker.getConnectionStatus(serviceId);
    });

    return status;
}

// Make functions available globally for debugging in browser console
if (typeof window !== 'undefined') {
    (window as any).resetAllThrottling = resetAllThrottling;
    (window as any).resetServiceThrottling = resetServiceThrottling;
    (window as any).getAllThrottlingStatus = getAllThrottlingStatus;
}

export default {
    resetAllThrottling,
    resetServiceThrottling,
    getAllThrottlingStatus,
};