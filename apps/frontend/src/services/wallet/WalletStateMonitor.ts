import { WalletConnection, AccountInfo } from '../../types/wallet';
import { WalletService } from './WalletService';

/**
 * Represents a change in wallet state
 */
export interface StateChange {
    timestamp: Date;
    previousState: WalletState | null;
    newState: WalletState;
    changeType: 'connect' | 'disconnect' | 'account_change' | 'network_change' | 'provider_change';
    details?: string;
}

/**
 * Represents the current wallet state
 */
export interface WalletState {
    isConnected: boolean;
    accountId?: string;
    network?: string;
    providerId?: string;
    lastValidated: Date;
    stateChanges: StateChange[];
    isStable: boolean;
    connectionStrength: 'strong' | 'weak' | 'unstable';
}

/**
 * Callback function type for state change notifications
 */
export type StateChangeCallback = (state: WalletState) => void;

/**
 * Configuration options for the wallet state monitor
 */
export interface WalletStateMonitorConfig {
    stabilityThreshold: number; // milliseconds to consider connection stable
    maxHistorySize: number; // maximum number of state changes to keep
    monitoringInterval: number; // milliseconds between state checks
    rapidChangeThreshold: number; // number of changes in short period to consider unstable
    rapidChangeWindow: number; // time window for rapid change detection (ms)
    connectionTimeoutThreshold: number; // milliseconds to consider connection timed out
}

/**
 * Default configuration for the wallet state monitor
 */
const DEFAULT_CONFIG: WalletStateMonitorConfig = {
    stabilityThreshold: 5000, // 5 seconds
    maxHistorySize: 50,
    monitoringInterval: 1000, // 1 second
    rapidChangeThreshold: 5, // 5 changes in rapid window
    rapidChangeWindow: 10000, // 10 seconds
    connectionTimeoutThreshold: 30000, // 30 seconds
};

/**
 * Monitors wallet connection state changes and provides real-time updates
 * Tracks connection stability and maintains state history for debugging
 */
export class WalletStateMonitor {
    private walletService: WalletService;
    private config: WalletStateMonitorConfig;
    private isMonitoring: boolean = false;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private currentState: WalletState | null = null;
    private stateChangeCallbacks: StateChangeCallback[] = [];
    private stateHistory: StateChange[] = [];

    constructor(walletService: WalletService, config?: Partial<WalletStateMonitorConfig>) {
        this.walletService = walletService;
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Initialize with current state
        this.updateCurrentState();

        // Set up wallet service event listeners
        this.setupWalletServiceListeners();
    }

    /**
     * Start monitoring wallet state changes
     */
    public startMonitoring(): void {
        if (this.isMonitoring) {
            console.warn('WalletStateMonitor: Already monitoring');
            return;
        }

        console.log('WalletStateMonitor: Starting state monitoring');
        this.isMonitoring = true;

        // Start periodic state checking
        this.monitoringInterval = setInterval(() => {
            this.checkStateChanges();
        }, this.config.monitoringInterval);

        // Initial state update
        this.updateCurrentState();
    }

    /**
     * Stop monitoring wallet state changes
     */
    public stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }

        console.log('WalletStateMonitor: Stopping state monitoring');
        this.isMonitoring = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Get the current wallet state with comprehensive information
     */
    public getCurrentState(): WalletState {
        if (!this.currentState) {
            this.updateCurrentState();
        }

        return this.currentState!;
    }

    /**
     * Register a callback for state change notifications
     */
    public onStateChange(callback: StateChangeCallback): void {
        this.stateChangeCallbacks.push(callback);
    }

    /**
     * Remove a state change callback
     */
    public removeStateChangeCallback(callback: StateChangeCallback): void {
        const index = this.stateChangeCallbacks.indexOf(callback);
        if (index > -1) {
            this.stateChangeCallbacks.splice(index, 1);
        }
    }

    /**
     * Get the complete state change history
     */
    public getStateHistory(): StateChange[] {
        return [...this.stateHistory];
    }

    /**
     * Clear the state change history
     */
    public clearStateHistory(): void {
        this.stateHistory = [];
        if (this.currentState) {
            this.currentState.stateChanges = [];
        }
    }

    /**
     * Check if the connection is currently stable
     */
    public isConnectionStable(): boolean {
        return this.currentState?.isStable ?? false;
    }

    /**
     * Get connection strength assessment
     */
    public getConnectionStrength(): 'strong' | 'weak' | 'unstable' {
        return this.currentState?.connectionStrength ?? 'unstable';
    }

    /**
     * Force a state update check
     */
    public forceStateUpdate(): void {
        this.updateCurrentState();
    }

    /**
     * Get monitoring status
     */
    public isCurrentlyMonitoring(): boolean {
        return this.isMonitoring;
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<WalletStateMonitorConfig>): void {
        this.config = { ...this.config, ...newConfig };

        // Restart monitoring with new config if currently monitoring
        if (this.isMonitoring) {
            this.stopMonitoring();
            this.startMonitoring();
        }
    }

    /**
     * Get current configuration
     */
    public getConfig(): WalletStateMonitorConfig {
        return { ...this.config };
    }

    /**
     * Analyze connection stability patterns based on state history
     */
    public analyzeConnectionStability(): {
        isStable: boolean;
        stabilityScore: number; // 0-100, higher is more stable
        recentChanges: number;
        rapidChanges: number;
        longestStablePeriod: number; // milliseconds
        averageStablePeriod: number; // milliseconds
        instabilityReasons: string[];
    } {
        const now = new Date();
        const recentWindow = this.config.stabilityThreshold;
        const rapidWindow = this.config.rapidChangeWindow;

        // Count recent changes
        const recentChanges = this.stateHistory.filter(
            change => now.getTime() - change.timestamp.getTime() < recentWindow
        ).length;

        // Count rapid changes
        const rapidChanges = this.stateHistory.filter(
            change => now.getTime() - change.timestamp.getTime() < rapidWindow
        ).length;

        // Calculate stability periods
        const stablePeriods = this.calculateStablePeriods();
        const longestStablePeriod = Math.max(...stablePeriods, 0);
        const averageStablePeriod = stablePeriods.length > 0
            ? stablePeriods.reduce((sum, period) => sum + period, 0) / stablePeriods.length
            : 0;

        // Determine instability reasons
        const instabilityReasons: string[] = [];
        if (recentChanges > 0) {
            instabilityReasons.push(`${recentChanges} changes in last ${recentWindow}ms`);
        }
        if (rapidChanges >= this.config.rapidChangeThreshold) {
            instabilityReasons.push(`${rapidChanges} rapid changes detected`);
        }
        if (averageStablePeriod < this.config.stabilityThreshold) {
            instabilityReasons.push('Short average stable periods');
        }

        // Calculate stability score (0-100)
        let stabilityScore = 100;
        stabilityScore -= Math.min(recentChanges * 20, 60); // Recent changes penalty
        stabilityScore -= Math.min(rapidChanges * 10, 30); // Rapid changes penalty
        if (averageStablePeriod < this.config.stabilityThreshold) {
            stabilityScore -= 20; // Short stable periods penalty
        }
        stabilityScore = Math.max(0, stabilityScore);

        const isStable = recentChanges === 0 && rapidChanges < this.config.rapidChangeThreshold;

        return {
            isStable,
            stabilityScore,
            recentChanges,
            rapidChanges,
            longestStablePeriod,
            averageStablePeriod,
            instabilityReasons,
        };
    }

    /**
     * Get detailed state change statistics
     */
    public getStateChangeStatistics(): {
        totalChanges: number;
        changesByType: Record<StateChange['changeType'], number>;
        changesInLastHour: number;
        changesInLastDay: number;
        mostFrequentChangeType: StateChange['changeType'] | null;
        averageTimeBetweenChanges: number; // milliseconds
    } {
        const now = new Date();
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * oneHour;

        // Count changes by type
        const changesByType: Record<StateChange['changeType'], number> = {
            connect: 0,
            disconnect: 0,
            account_change: 0,
            network_change: 0,
            provider_change: 0,
        };

        this.stateHistory.forEach(change => {
            changesByType[change.changeType]++;
        });

        // Count recent changes
        const changesInLastHour = this.stateHistory.filter(
            change => now.getTime() - change.timestamp.getTime() < oneHour
        ).length;

        const changesInLastDay = this.stateHistory.filter(
            change => now.getTime() - change.timestamp.getTime() < oneDay
        ).length;

        // Find most frequent change type
        let mostFrequentChangeType: StateChange['changeType'] | null = null;
        let maxCount = 0;
        Object.entries(changesByType).forEach(([type, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostFrequentChangeType = type as StateChange['changeType'];
            }
        });

        // Calculate average time between changes
        let averageTimeBetweenChanges = 0;
        if (this.stateHistory.length > 1) {
            const timeDifferences: number[] = [];
            for (let i = 1; i < this.stateHistory.length; i++) {
                const timeDiff = this.stateHistory[i].timestamp.getTime() -
                    this.stateHistory[i - 1].timestamp.getTime();
                timeDifferences.push(timeDiff);
            }
            averageTimeBetweenChanges = timeDifferences.reduce((sum, diff) => sum + diff, 0) / timeDifferences.length;
        }

        return {
            totalChanges: this.stateHistory.length,
            changesByType,
            changesInLastHour,
            changesInLastDay,
            mostFrequentChangeType,
            averageTimeBetweenChanges,
        };
    }

    /**
     * Get filtered state history based on criteria
     */
    public getFilteredStateHistory(filter: {
        changeType?: StateChange['changeType'];
        timeRange?: { start: Date; end: Date };
        limit?: number;
    }): StateChange[] {
        let filtered = [...this.stateHistory];

        // Filter by change type
        if (filter.changeType) {
            filtered = filtered.filter(change => change.changeType === filter.changeType);
        }

        // Filter by time range
        if (filter.timeRange) {
            filtered = filtered.filter(change =>
                change.timestamp >= filter.timeRange!.start &&
                change.timestamp <= filter.timeRange!.end
            );
        }

        // Apply limit
        if (filter.limit) {
            filtered = filtered.slice(-filter.limit);
        }

        return filtered;
    }

    /**
     * Export state history and analysis for debugging
     */
    public exportDiagnosticData(): {
        currentState: WalletState | null;
        stateHistory: StateChange[];
        stabilityAnalysis: {
            isStable: boolean;
            stabilityScore: number;
            recentChanges: number;
            rapidChanges: number;
            longestStablePeriod: number;
            averageStablePeriod: number;
            instabilityReasons: string[];
        };
        statistics: {
            totalChanges: number;
            changesByType: Record<StateChange['changeType'], number>;
            changesInLastHour: number;
            changesInLastDay: number;
            mostFrequentChangeType: StateChange['changeType'] | null;
            averageTimeBetweenChanges: number;
        };
        config: WalletStateMonitorConfig;
        exportTimestamp: Date;
    } {
        return {
            currentState: this.currentState,
            stateHistory: this.getStateHistory(),
            stabilityAnalysis: this.analyzeConnectionStability(),
            statistics: this.getStateChangeStatistics(),
            config: this.getConfig(),
            exportTimestamp: new Date(),
        };
    }

    /**
     * Set up event listeners for wallet service events
     */
    private setupWalletServiceListeners(): void {
        this.walletService.addEventListener('connect', (connection: WalletConnection) => {
            this.handleWalletEvent('connect', { connection });
        });

        this.walletService.addEventListener('disconnect', () => {
            this.handleWalletEvent('disconnect');
        });

        this.walletService.addEventListener('accountChanged', (accountInfo: AccountInfo) => {
            this.handleWalletEvent('account_change', { accountInfo });
        });

        this.walletService.addEventListener('networkChanged', (network: string) => {
            this.handleWalletEvent('network_change', { network });
        });

        this.walletService.addEventListener('providerChanged', (providerId: string) => {
            this.handleWalletEvent('provider_change', { providerId });
        });
    }

    /**
     * Handle wallet service events and update state accordingly
     */
    private handleWalletEvent(eventType: StateChange['changeType'], details?: any): void {
        console.log(`WalletStateMonitor: Handling wallet event: ${eventType}`, details);

        // Update state immediately when events occur
        this.updateCurrentState(eventType, details);
    }

    /**
     * Check for state changes during periodic monitoring
     */
    private checkStateChanges(): void {
        const previousState = this.currentState ? { ...this.currentState } : null;
        this.updateCurrentState();

        // Compare with previous state to detect changes not caught by events
        if (previousState && this.currentState) {
            const hasChanged = this.hasStateChanged(previousState, this.currentState);
            if (hasChanged) {
                console.log('WalletStateMonitor: Detected state change during periodic check');
            }
        }
    }

    /**
     * Update the current state based on wallet service information
     */
    private updateCurrentState(changeType?: StateChange['changeType'], eventDetails?: any): void {
        const previousState = this.currentState ? { ...this.currentState } : null;
        const now = new Date();

        // Get current connection information
        const connection = this.walletService.getConnection();
        const isConnected = this.walletService.isConnected();
        const currentProvider = this.walletService.getCurrentProvider();

        // Create new state
        const newState: WalletState = {
            isConnected,
            accountId: connection?.accountId,
            network: connection?.network,
            providerId: currentProvider?.id,
            lastValidated: now,
            stateChanges: this.stateHistory.slice(-10), // Keep last 10 changes in state
            isStable: this.calculateStability(now),
            connectionStrength: this.calculateConnectionStrength(isConnected, now),
        };

        // Check if state actually changed
        const hasChanged = !previousState || this.hasStateChanged(previousState, newState);

        if (hasChanged) {
            // Create state change record
            const stateChange: StateChange = {
                timestamp: now,
                previousState,
                newState: { ...newState },
                changeType: changeType || this.determineChangeType(previousState, newState),
                details: eventDetails ? JSON.stringify(eventDetails) : undefined,
            };

            // Add to history
            this.addStateChange(stateChange);

            // Update current state
            this.currentState = newState;

            // Notify callbacks
            this.notifyStateChangeCallbacks(newState);

            console.log('WalletStateMonitor: State updated', {
                changeType: stateChange.changeType,
                isConnected: newState.isConnected,
                accountId: newState.accountId,
                isStable: newState.isStable,
                connectionStrength: newState.connectionStrength,
            });
        } else {
            // Update timestamps even if no change
            if (this.currentState) {
                this.currentState.lastValidated = now;
                this.currentState.isStable = this.calculateStability(now);
                this.currentState.connectionStrength = this.calculateConnectionStrength(isConnected, now);
            }
        }
    }

    /**
     * Check if two states are different
     */
    private hasStateChanged(state1: WalletState, state2: WalletState): boolean {
        return (
            state1.isConnected !== state2.isConnected ||
            state1.accountId !== state2.accountId ||
            state1.network !== state2.network ||
            state1.providerId !== state2.providerId
        );
    }

    /**
     * Determine the type of change between two states
     */
    private determineChangeType(previousState: WalletState | null, newState: WalletState): StateChange['changeType'] {
        if (!previousState) {
            return newState.isConnected ? 'connect' : 'disconnect';
        }

        if (previousState.isConnected !== newState.isConnected) {
            return newState.isConnected ? 'connect' : 'disconnect';
        }

        if (previousState.accountId !== newState.accountId) {
            return 'account_change';
        }

        if (previousState.network !== newState.network) {
            return 'network_change';
        }

        if (previousState.providerId !== newState.providerId) {
            return 'provider_change';
        }

        return 'connect'; // Default fallback
    }

    /**
     * Calculate connection stability based on recent state changes
     */
    private calculateStability(currentTime: Date): boolean {
        if (this.stateHistory.length === 0) {
            return true; // No changes means stable
        }

        // Check if there have been recent changes within the stability threshold
        const recentChanges = this.stateHistory.filter(
            change => currentTime.getTime() - change.timestamp.getTime() < this.config.stabilityThreshold
        );

        return recentChanges.length === 0;
    }

    /**
     * Calculate connection strength based on stability and connection status
     */
    private calculateConnectionStrength(isConnected: boolean, currentTime: Date): 'strong' | 'weak' | 'unstable' {
        if (!isConnected) {
            return 'unstable';
        }

        const isStable = this.calculateStability(currentTime);
        if (!isStable) {
            return 'unstable';
        }

        // Check frequency of recent changes
        const recentWindow = 30000; // 30 seconds
        const recentChanges = this.stateHistory.filter(
            change => currentTime.getTime() - change.timestamp.getTime() < recentWindow
        );

        if (recentChanges.length === 0) {
            return 'strong';
        } else if (recentChanges.length <= 2) {
            return 'weak';
        } else {
            return 'unstable';
        }
    }

    /**
     * Calculate stable periods between state changes
     */
    private calculateStablePeriods(): number[] {
        if (this.stateHistory.length < 2) {
            return [];
        }

        const stablePeriods: number[] = [];

        for (let i = 1; i < this.stateHistory.length; i++) {
            const timeDiff = this.stateHistory[i].timestamp.getTime() -
                this.stateHistory[i - 1].timestamp.getTime();
            stablePeriods.push(timeDiff);
        }

        return stablePeriods;
    }

    /**
     * Add a state change to the history
     */
    private addStateChange(stateChange: StateChange): void {
        this.stateHistory.push(stateChange);

        // Trim history if it exceeds max size
        if (this.stateHistory.length > this.config.maxHistorySize) {
            this.stateHistory = this.stateHistory.slice(-this.config.maxHistorySize);
        }
    }

    /**
     * Notify all registered callbacks of state changes
     */
    private notifyStateChangeCallbacks(newState: WalletState): void {
        this.stateChangeCallbacks.forEach(callback => {
            try {
                callback(newState);
            } catch (error) {
                console.error('WalletStateMonitor: Error in state change callback:', error);
            }
        });
    }

    /**
     * Clean up resources when monitor is destroyed
     */
    public destroy(): void {
        this.stopMonitoring();
        this.stateChangeCallbacks = [];
        this.stateHistory = [];
        this.currentState = null;
    }
}