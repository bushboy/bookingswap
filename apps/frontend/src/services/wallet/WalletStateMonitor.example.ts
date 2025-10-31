/**
 * Example usage of WalletStateMonitor
 * This file demonstrates how to use the WalletStateMonitor for tracking wallet connection states
 */

import { WalletStateMonitor, walletService } from './index';

// Example: Basic usage
export function createBasicWalletMonitor() {
    // Create a monitor instance
    const monitor = new WalletStateMonitor(walletService);

    // Set up state change callback
    monitor.onStateChange((state) => {
        console.log('Wallet state changed:', {
            isConnected: state.isConnected,
            accountId: state.accountId,
            isStable: state.isStable,
            connectionStrength: state.connectionStrength,
        });
    });

    // Start monitoring
    monitor.startMonitoring();

    return monitor;
}

// Example: Advanced usage with custom configuration
export function createAdvancedWalletMonitor() {
    // Create monitor with custom configuration
    const monitor = new WalletStateMonitor(walletService, {
        stabilityThreshold: 3000, // 3 seconds
        maxHistorySize: 100,
        monitoringInterval: 500, // 0.5 seconds
        rapidChangeThreshold: 3,
        rapidChangeWindow: 5000, // 5 seconds
        connectionTimeoutThreshold: 20000, // 20 seconds
    });

    // Set up detailed state change callback
    monitor.onStateChange((state) => {
        const stability = monitor.analyzeConnectionStability();
        const stats = monitor.getStateChangeStatistics();

        console.log('Detailed wallet state update:', {
            state,
            stability,
            recentChanges: stats.changesInLastHour,
            mostFrequentChange: stats.mostFrequentChangeType,
        });

        // Handle unstable connections
        if (stability.stabilityScore < 50) {
            console.warn('Wallet connection is unstable:', stability.instabilityReasons);
        }
    });

    // Start monitoring
    monitor.startMonitoring();

    return monitor;
}

// Example: Debugging and diagnostics
export function demonstrateDebuggingFeatures(monitor: WalletStateMonitor) {
    // Get current state
    const currentState = monitor.getCurrentState();
    console.log('Current wallet state:', currentState);

    // Analyze connection stability
    const stability = monitor.analyzeConnectionStability();
    console.log('Connection stability analysis:', stability);

    // Get statistics
    const stats = monitor.getStateChangeStatistics();
    console.log('State change statistics:', stats);

    // Get filtered history (last 10 connect/disconnect events)
    const connectionEvents = monitor.getFilteredStateHistory({
        changeType: 'connect',
        limit: 10,
    });
    console.log('Recent connection events:', connectionEvents);

    // Export diagnostic data for support
    const diagnosticData = monitor.exportDiagnosticData();
    console.log('Full diagnostic data:', diagnosticData);
}

// Example: React hook for wallet state monitoring
export function useWalletStateMonitor() {
    // This would be implemented as a React hook in a real application
    // const [walletState, setWalletState] = useState(null);
    // const [monitor, setMonitor] = useState(null);

    // useEffect(() => {
    //   const newMonitor = new WalletStateMonitor(walletService);
    //   newMonitor.onStateChange(setWalletState);
    //   newMonitor.startMonitoring();
    //   setMonitor(newMonitor);
    //   
    //   return () => {
    //     newMonitor.destroy();
    //   };
    // }, []);

    // return { walletState, monitor };
}

// Example: Integration with validation service
export function integrateWithValidation(monitor: WalletStateMonitor) {
    monitor.onStateChange((state) => {
        // Trigger validation when state changes
        if (state.isConnected && state.isStable) {
            console.log('Connection is stable, safe to perform validation');
        } else if (state.isConnected && !state.isStable) {
            console.log('Connection exists but unstable, waiting for stabilization');
        } else {
            console.log('No connection detected');
        }
    });
}