import { useState, useEffect } from 'react';
import {
    ConnectionStatus,
    ConnectionMetrics,
    connectionStatusManager
} from '@/services/connectionStatusManager';

export interface UseConnectionStatusReturn {
    status: ConnectionStatus;
    metrics: ConnectionMetrics;
    isHealthy: boolean;
    statusDescription: string;
    successRate: number;
    showDiagnostics: () => void;
    hideDiagnostics: () => void;
    isDiagnosticsOpen: boolean;
}

export const useConnectionStatus = (): UseConnectionStatusReturn => {
    const [status, setStatus] = useState<ConnectionStatus>(
        connectionStatusManager.getStatus()
    );
    const [metrics, setMetrics] = useState<ConnectionMetrics>(
        connectionStatusManager.getMetrics()
    );
    const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

    useEffect(() => {
        // Subscribe to status changes
        const unsubscribe = connectionStatusManager.subscribe(setStatus);

        // Update metrics periodically
        const updateMetrics = () => {
            setMetrics(connectionStatusManager.getMetrics());
        };

        // Update metrics immediately and then every 5 seconds
        updateMetrics();
        const interval = setInterval(updateMetrics, 5000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, []);

    const isHealthy = connectionStatusManager.isHealthy();
    const statusDescription = connectionStatusManager.getStatusDescription();
    const successRate = connectionStatusManager.getSuccessRate();

    const showDiagnostics = () => setIsDiagnosticsOpen(true);
    const hideDiagnostics = () => setIsDiagnosticsOpen(false);

    return {
        status,
        metrics,
        isHealthy,
        statusDescription,
        successRate,
        showDiagnostics,
        hideDiagnostics,
        isDiagnosticsOpen,
    };
};