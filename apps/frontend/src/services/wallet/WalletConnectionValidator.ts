import { walletService } from '../walletService';

/**
 * Detailed validation check result
 */
export interface ValidationCheck {
    name: string;
    passed: boolean;
    details: string;
    critical: boolean;
}

/**
 * Connection diagnostic information
 */
export interface ConnectionDiagnostics {
    timestamp: Date;
    walletServiceConnected: boolean;
    connectionObjectExists: boolean;
    accountId?: string;
    connectionType: 'mock' | 'real';
    lastStateChange?: Date;
    validationHistory: ValidationAttempt[];
    stateChangeHistory: StateChange[];
    stabilityAnalysis: {
        isStable: boolean;
        stabilityScore: number;
        recentChanges: number;
        recommendations: string[];
    };
}

/**
 * Individual validation attempt record
 */
export interface ValidationAttempt {
    timestamp: Date;
    success: boolean;
    error?: string;
    checks: ValidationCheck[];
}

/**
 * Detailed connection validation result
 */
export interface DetailedConnectionValidation {
    isValid: boolean;
    checks: ValidationCheck[];
    primaryError?: string;
    diagnostics: ConnectionDiagnostics;
    recommendations: string[];
}

/**
 * Connection health status
 */
export interface ConnectionHealthStatus {
    isHealthy: boolean;
    lastChecked: Date;
    issues: string[];
    stability: {
        isStable: boolean;
        recentChanges: number;
        lastChangeTime?: Date;
    };
}

/**
 * Enhanced wallet connection validator with multi-layer validation checks
 * and comprehensive diagnostics collection
 */
/**
 * State change record for tracking connection stability
 */
export interface StateChange {
    timestamp: Date;
    previousState: string;
    newState: string;
    trigger: string;
}

export class WalletConnectionValidator {
    private validationHistory: ValidationAttempt[] = [];
    private lastStateChange?: Date;
    private stateChangeCount = 0;
    private stateChangeHistory: StateChange[] = [];
    private readonly STABILITY_WINDOW_MS = 5000; // 5 seconds
    private readonly MAX_HISTORY_SIZE = 100;

    /**
     * Performs comprehensive wallet connection validation with multiple checks including Kabila-specific validation
     */
    async validateConnection(): Promise<DetailedConnectionValidation> {
        const timestamp = new Date();
        const checks: ValidationCheck[] = [];
        const recommendations: string[] = [];
        let primaryError: string | undefined;

        try {
            // Check 1: Wallet service state
            const serviceStateCheck = this.checkWalletServiceState();
            checks.push(serviceStateCheck);

            // Check 2: Connection object validation
            const connectionObjectCheck = this.checkConnectionObject();
            checks.push(connectionObjectCheck);

            // Check 3: Account ID verification
            const accountIdCheck = this.checkAccountId();
            checks.push(accountIdCheck);

            // Check 4: Connection stability
            const stabilityCheck = this.checkConnectionStability();
            checks.push(stabilityCheck);

            // Check 5: Kabila-specific extension state validation
            const kabilaExtensionCheck = await this.checkKabilaExtensionState();
            checks.push(kabilaExtensionCheck);

            // Check 6: Kabila connection consistency validation
            const kabilaConsistencyCheck = await this.checkKabilaConnectionConsistency();
            checks.push(kabilaConsistencyCheck);

            // Determine overall validation result
            const criticalChecks = checks.filter(check => check.critical);
            const failedCriticalChecks = criticalChecks.filter(check => !check.passed);
            const isValid = failedCriticalChecks.length === 0;

            // Generate primary error and recommendations
            if (!isValid) {
                primaryError = this.generatePrimaryError(failedCriticalChecks);
                recommendations.push(...this.generateRecommendations(checks));
            }

            // Collect diagnostics
            const diagnostics = this.getDiagnostics();

            // Record validation attempt
            const validationAttempt: ValidationAttempt = {
                timestamp,
                success: isValid,
                error: primaryError,
                checks: [...checks]
            };
            this.recordValidationAttempt(validationAttempt);

            return {
                isValid,
                checks,
                primaryError,
                diagnostics,
                recommendations
            };

        } catch (error) {
            // Handle unexpected validation errors
            const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
            primaryError = `Validation failed: ${errorMessage}`;

            const validationAttempt: ValidationAttempt = {
                timestamp,
                success: false,
                error: primaryError,
                checks
            };
            this.recordValidationAttempt(validationAttempt);

            return {
                isValid: false,
                checks,
                primaryError,
                diagnostics: this.getDiagnostics(),
                recommendations: ['Please try reconnecting your wallet', 'Refresh the page and try again']
            };
        }
    }

    /**
     * Performs connection health check for stability verification
     */
    async performHealthCheck(): Promise<ConnectionHealthStatus> {
        const lastChecked = new Date();
        const issues: string[] = [];

        try {
            // Check if connection is stable
            const stability = {
                isStable: this.isConnectionStable(),
                recentChanges: this.stateChangeCount,
                lastChangeTime: this.lastStateChange
            };

            // Check for recent state changes
            if (!stability.isStable) {
                issues.push('Connection state has changed recently and may be unstable');
            }

            // Check wallet service responsiveness
            try {
                const connection = walletService.getConnection();
                if (!connection) {
                    issues.push('Wallet service is not returning connection information');
                }
            } catch (error) {
                issues.push('Wallet service is not responding properly');
            }

            // Check for excessive validation attempts
            const recentAttempts = this.validationHistory.filter(
                attempt => Date.now() - attempt.timestamp.getTime() < 60000 // Last minute
            );
            if (recentAttempts.length > 10) {
                issues.push('Excessive validation attempts detected - possible connection instability');
            }

            const isHealthy = issues.length === 0;

            return {
                isHealthy,
                lastChecked,
                issues,
                stability
            };

        } catch (error) {
            return {
                isHealthy: false,
                lastChecked,
                issues: ['Health check failed: ' + (error instanceof Error ? error.message : 'Unknown error')],
                stability: {
                    isStable: false,
                    recentChanges: this.stateChangeCount,
                    lastChangeTime: this.lastStateChange
                }
            };
        }
    }

    /**
     * Gets detailed connection state information for debugging
     */
    getDiagnostics(): ConnectionDiagnostics {
        const connection = walletService.getConnection();
        const isServiceConnected = walletService.isConnected();
        const stabilityAnalysis = this.analyzeConnectionStability();

        return {
            timestamp: new Date(),
            walletServiceConnected: isServiceConnected,
            connectionObjectExists: !!connection,
            accountId: connection?.account?.accountId,
            connectionType: this.detectConnectionType(),
            lastStateChange: this.lastStateChange,
            validationHistory: [...this.validationHistory], // Copy to prevent mutation
            stateChangeHistory: [...this.stateChangeHistory], // Copy to prevent mutation
            stabilityAnalysis: {
                isStable: stabilityAnalysis.isStable,
                stabilityScore: stabilityAnalysis.stabilityScore,
                recentChanges: stabilityAnalysis.recentChanges,
                recommendations: stabilityAnalysis.recommendations
            }
        };
    }

    /**
     * Checks if connection is stable (no recent state changes)
     */
    isConnectionStable(): boolean {
        if (!this.lastStateChange) {
            return true; // No recorded state changes
        }

        const timeSinceLastChange = Date.now() - this.lastStateChange.getTime();
        return timeSinceLastChange > this.STABILITY_WINDOW_MS;
    }

    /**
     * Records a state change for stability tracking
     */
    recordStateChange(): void {
        this.lastStateChange = new Date();
        this.stateChangeCount++;

        // Clean up old state change records (keep only recent ones)
        const cutoffTime = Date.now() - (this.STABILITY_WINDOW_MS * 2);
        if (this.lastStateChange.getTime() < cutoffTime) {
            this.stateChangeCount = Math.max(0, this.stateChangeCount - 1);
        }
    }

    /**
     * Records a detailed state change with context
     */
    recordDetailedStateChange(previousState: string, newState: string, trigger: string): void {
        const stateChange: StateChange = {
            timestamp: new Date(),
            previousState,
            newState,
            trigger
        };

        this.stateChangeHistory.push(stateChange);
        this.recordStateChange();

        // Maintain history size limit
        if (this.stateChangeHistory.length > this.MAX_HISTORY_SIZE) {
            this.stateChangeHistory = this.stateChangeHistory.slice(-this.MAX_HISTORY_SIZE);
        }

        console.log('WalletConnectionValidator: State change recorded', {
            previousState,
            newState,
            trigger,
            timestamp: stateChange.timestamp.toISOString(),
            totalChanges: this.stateChangeCount
        });
    }

    /**
     * Gets the connection state change history
     */
    getStateChangeHistory(): StateChange[] {
        return [...this.stateChangeHistory];
    }

    /**
     * Gets recent state changes within the specified time window
     */
    getRecentStateChanges(windowMs: number = this.STABILITY_WINDOW_MS): StateChange[] {
        const cutoffTime = Date.now() - windowMs;
        return this.stateChangeHistory.filter(
            change => change.timestamp.getTime() > cutoffTime
        );
    }

    /**
     * Analyzes connection stability patterns
     */
    analyzeConnectionStability(): {
        isStable: boolean;
        stabilityScore: number; // 0-100, higher is more stable
        recentChanges: number;
        averageTimeBetweenChanges?: number;
        mostCommonTrigger?: string;
        recommendations: string[];
    } {
        const recentChanges = this.getRecentStateChanges();
        const recommendations: string[] = [];

        // Calculate stability score
        let stabilityScore = 100;

        // Penalize for recent changes
        stabilityScore -= Math.min(recentChanges.length * 10, 50);

        // Penalize for rapid changes
        if (recentChanges.length > 1) {
            const timeDiffs = [];
            for (let i = 1; i < recentChanges.length; i++) {
                const diff = recentChanges[i].timestamp.getTime() - recentChanges[i - 1].timestamp.getTime();
                timeDiffs.push(diff);
            }
            const avgTimeBetweenChanges = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;

            if (avgTimeBetweenChanges < 1000) { // Less than 1 second between changes
                stabilityScore -= 30;
                recommendations.push('Connection is changing too rapidly - check wallet extension stability');
            }
        }

        // Analyze triggers
        const triggerCounts = new Map<string, number>();
        recentChanges.forEach(change => {
            triggerCounts.set(change.trigger, (triggerCounts.get(change.trigger) || 0) + 1);
        });

        const mostCommonTrigger = triggerCounts.size > 0
            ? Array.from(triggerCounts.entries()).reduce((a, b) => a[1] > b[1] ? a : b)[0]
            : undefined;

        // Generate recommendations based on patterns
        if (mostCommonTrigger === 'wallet_disconnect') {
            recommendations.push('Frequent disconnections detected - check wallet extension settings');
        } else if (mostCommonTrigger === 'network_change') {
            recommendations.push('Network changes detected - ensure wallet is on correct network');
        } else if (mostCommonTrigger === 'account_change') {
            recommendations.push('Account changes detected - verify correct account is selected');
        }

        const isStable = stabilityScore >= 70 && recentChanges.length <= 2;

        return {
            isStable,
            stabilityScore: Math.max(0, stabilityScore),
            recentChanges: recentChanges.length,
            averageTimeBetweenChanges: recentChanges.length > 1
                ? recentChanges.reduce((sum, change, i) => {
                    if (i === 0) return sum;
                    return sum + (change.timestamp.getTime() - recentChanges[i - 1].timestamp.getTime());
                }, 0) / (recentChanges.length - 1)
                : undefined,
            mostCommonTrigger,
            recommendations
        };
    }

    /**
     * Monitors connection state and detects changes
     */
    monitorConnectionState(): {
        currentState: string;
        hasChanged: boolean;
        changeDetails?: {
            previousState: string;
            trigger: string;
        };
    } {
        const connection = walletService.getConnection();
        const isServiceConnected = walletService.isConnected();
        // Note: Simple walletService doesn't have getCurrentProvider

        // Build current state signature
        const currentState = JSON.stringify({
            serviceConnected: isServiceConnected,
            hasConnection: !!connection,
            isConnected: connection?.isConnected || false,
            accountId: connection?.account?.accountId || null,
            providerId: null // Simple walletService doesn't track provider ID
        });

        // Check if state has changed (simple implementation for now)
        const lastValidation = this.validationHistory[this.validationHistory.length - 1];
        const hasChanged = lastValidation ?
            JSON.stringify(lastValidation.checks.map(c => ({ name: c.name, passed: c.passed }))) !==
            JSON.stringify(this.getCurrentValidationState()) : false;

        return {
            currentState,
            hasChanged,
            changeDetails: hasChanged ? {
                previousState: 'previous_state', // Simplified for now
                trigger: 'state_monitor'
            } : undefined
        };
    }

    /**
     * Gets current validation state for comparison
     */
    private getCurrentValidationState(): Array<{ name: string; passed: boolean }> {
        // Perform quick validation checks without full validation
        const serviceCheck = this.checkWalletServiceState();
        const connectionCheck = this.checkConnectionObject();
        const accountCheck = this.checkAccountId();
        const stabilityCheck = this.checkConnectionStability();

        return [
            { name: serviceCheck.name, passed: serviceCheck.passed },
            { name: connectionCheck.name, passed: connectionCheck.passed },
            { name: accountCheck.name, passed: accountCheck.passed },
            { name: stabilityCheck.name, passed: stabilityCheck.passed }
        ];
    }

    /**
     * Check wallet service state
     */
    private checkWalletServiceState(): ValidationCheck {
        try {
            const isConnected = walletService.isConnected();

            return {
                name: 'Wallet Service State',
                passed: isConnected,
                details: isConnected
                    ? 'Wallet service reports connected state'
                    : 'Wallet service reports disconnected state',
                critical: true
            };
        } catch (error) {
            return {
                name: 'Wallet Service State',
                passed: false,
                details: `Error checking wallet service state: ${error instanceof Error ? error.message : 'Unknown error'}`,
                critical: true
            };
        }
    }

    /**
     * Check connection object validity
     */
    private checkConnectionObject(): ValidationCheck {
        try {
            const connection = walletService.getConnection();

            if (!connection) {
                return {
                    name: 'Connection Object',
                    passed: false,
                    details: 'No connection object returned from wallet service',
                    critical: true
                };
            }

            if (!connection.isConnected) {
                return {
                    name: 'Connection Object',
                    passed: false,
                    details: 'Connection object exists but isConnected is false',
                    critical: true
                };
            }

            return {
                name: 'Connection Object',
                passed: true,
                details: 'Valid connection object with isConnected=true',
                critical: true
            };
        } catch (error) {
            return {
                name: 'Connection Object',
                passed: false,
                details: `Error accessing connection object: ${error instanceof Error ? error.message : 'Unknown error'}`,
                critical: true
            };
        }
    }

    /**
     * Check account ID presence and validity
     */
    private checkAccountId(): ValidationCheck {
        try {
            const connection = walletService.getConnection();

            if (!connection) {
                return {
                    name: 'Account ID',
                    passed: false,
                    details: 'No connection available to check account ID',
                    critical: true
                };
            }

            if (!connection.account?.accountId) {
                return {
                    name: 'Account ID',
                    passed: false,
                    details: 'Connection exists but no account ID present',
                    critical: true
                };
            }

            const accountId = connection.account.accountId;

            // Basic account ID format validation (Hedera format: 0.0.xxxxx)
            const accountIdPattern = /^0\.0\.\d+$/;
            if (!accountIdPattern.test(accountId)) {
                return {
                    name: 'Account ID',
                    passed: false,
                    details: `Account ID format appears invalid: ${accountId}`,
                    critical: false // Non-critical as some mock implementations might use different formats
                };
            }

            return {
                name: 'Account ID',
                passed: true,
                details: `Valid account ID: ${accountId}`,
                critical: true
            };
        } catch (error) {
            return {
                name: 'Account ID',
                passed: false,
                details: `Error checking account ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
                critical: true
            };
        }
    }

    /**
     * Check connection stability
     */
    private checkConnectionStability(): ValidationCheck {
        const isStable = this.isConnectionStable();

        if (!isStable) {
            return {
                name: 'Connection Stability',
                passed: false,
                details: `Connection state changed recently (${this.stateChangeCount} changes, last: ${this.lastStateChange?.toISOString()})`,
                critical: false // Non-critical as connection might still work
            };
        }

        return {
            name: 'Connection Stability',
            passed: true,
            details: this.lastStateChange
                ? `Connection stable since ${this.lastStateChange.toISOString()}`
                : 'No recent connection state changes detected',
            critical: false
        };
    }

    /**
     * Check Kabila extension state and availability
     */
    private async checkKabilaExtensionState(): Promise<ValidationCheck> {
        try {
            // Check if we're dealing with a Kabila connection
            const connection = walletService.getConnection();
            const isKabilaConnection = this.isKabilaConnection(connection);

            if (!isKabilaConnection) {
                return {
                    name: 'Kabila Extension State',
                    passed: true,
                    details: 'Not a Kabila connection - check skipped',
                    critical: false
                };
            }

            // Check if window.kabila exists
            if (typeof window === 'undefined' || !window.kabila) {
                return {
                    name: 'Kabila Extension State',
                    passed: false,
                    details: 'Kabila extension not detected - window.kabila is undefined',
                    critical: true
                };
            }

            // Check if extension is available (not locked)
            if (window.kabila.isAvailable === false) {
                return {
                    name: 'Kabila Extension State',
                    passed: false,
                    details: 'Kabila extension is locked or unavailable - please unlock your wallet',
                    critical: true
                };
            }

            // Check if extension reports connected state
            let extensionConnected = false;
            try {
                extensionConnected = window.kabila.isConnected();
            } catch (error) {
                return {
                    name: 'Kabila Extension State',
                    passed: false,
                    details: `Failed to check Kabila extension connection state: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    critical: true
                };
            }

            if (!extensionConnected) {
                return {
                    name: 'Kabila Extension State',
                    passed: false,
                    details: 'Kabila extension reports disconnected state',
                    critical: true
                };
            }

            return {
                name: 'Kabila Extension State',
                passed: true,
                details: 'Kabila extension is available and connected',
                critical: false
            };

        } catch (error) {
            return {
                name: 'Kabila Extension State',
                passed: false,
                details: `Error checking Kabila extension state: ${error instanceof Error ? error.message : 'Unknown error'}`,
                critical: true
            };
        }
    }

    /**
     * Check consistency between Kabila extension state and wallet service connection
     */
    private async checkKabilaConnectionConsistency(): Promise<ValidationCheck> {
        try {
            const connection = walletService.getConnection();
            const isKabilaConnection = this.isKabilaConnection(connection);

            if (!isKabilaConnection) {
                return {
                    name: 'Kabila Connection Consistency',
                    passed: true,
                    details: 'Not a Kabila connection - consistency check skipped',
                    critical: false
                };
            }

            if (!window.kabila) {
                return {
                    name: 'Kabila Connection Consistency',
                    passed: false,
                    details: 'Cannot verify consistency - Kabila extension not available',
                    critical: true
                };
            }

            // Check if extension is connected
            let extensionConnected = false;
            let extensionAccountInfo: { accountId: string; network: string } | null = null;

            try {
                extensionConnected = window.kabila.isConnected();
                if (extensionConnected) {
                    extensionAccountInfo = await window.kabila.getAccountInfo();
                }
            } catch (error) {
                return {
                    name: 'Kabila Connection Consistency',
                    passed: false,
                    details: `Failed to get Kabila extension account info: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    critical: true
                };
            }

            // Check consistency between service and extension
            const serviceConnected = connection?.isConnected;
            const serviceAccountId = connection?.account?.accountId;

            if (serviceConnected && !extensionConnected) {
                return {
                    name: 'Kabila Connection Consistency',
                    passed: false,
                    details: 'Service reports connected but Kabila extension reports disconnected',
                    critical: true
                };
            }

            if (!serviceConnected && extensionConnected) {
                return {
                    name: 'Kabila Connection Consistency',
                    passed: false,
                    details: 'Kabila extension reports connected but service reports disconnected',
                    critical: true
                };
            }

            if (serviceConnected && extensionConnected && extensionAccountInfo) {
                if (serviceAccountId !== extensionAccountInfo.accountId) {
                    return {
                        name: 'Kabila Connection Consistency',
                        passed: false,
                        details: `Account ID mismatch - Service: ${serviceAccountId}, Extension: ${extensionAccountInfo.accountId}`,
                        critical: true
                    };
                }
            }

            return {
                name: 'Kabila Connection Consistency',
                passed: true,
                details: 'Kabila connection state is consistent between service and extension',
                critical: false
            };

        } catch (error) {
            return {
                name: 'Kabila Connection Consistency',
                passed: false,
                details: `Error checking Kabila connection consistency: ${error instanceof Error ? error.message : 'Unknown error'}`,
                critical: true
            };
        }
    }

    /**
     * Determines if the current connection is a Kabila wallet connection
     */
    private isKabilaConnection(connection: any): boolean {
        if (!connection) return false;

        // Check if connection has Kabila-specific properties or patterns
        // This is a heuristic approach since we don't have explicit provider type info

        // Check for Kabila-specific account ID format (Hedera format)
        const accountId = connection.account?.accountId;
        if (accountId && typeof accountId === 'string') {
            // Hedera account ID format: 0.0.xxxxx
            const hederaPattern = /^0\.0\.\d+$/;
            if (hederaPattern.test(accountId)) {
                return true;
            }
        }

        // Check if window.kabila exists and is connected (strong indicator)
        if (typeof window !== 'undefined' && window.kabila) {
            try {
                if (window.kabila.isConnected && window.kabila.isConnected()) {
                    return true;
                }
            } catch (error) {
                // Extension might be in an error state, but still likely Kabila
                return true;
            }
        }

        // Check for network type that suggests Hedera/Kabila
        const network = connection.network;
        if (network === 'mainnet' || network === 'testnet') {
            // These are common Hedera networks, likely Kabila
            return true;
        }

        return false;
    }

    /**
     * Generate primary error message from failed critical checks
     */
    private generatePrimaryError(failedChecks: ValidationCheck[]): string {
        if (failedChecks.length === 0) {
            return 'Unknown validation error';
        }

        // Prioritize Kabila-specific errors first
        const kabilaExtensionError = failedChecks.find(check => check.name === 'Kabila Extension State');
        if (kabilaExtensionError) {
            if (kabilaExtensionError.details.includes('not detected')) {
                return 'Kabila wallet extension is not installed or not detected';
            } else if (kabilaExtensionError.details.includes('locked') || kabilaExtensionError.details.includes('unavailable')) {
                return 'Kabila wallet is locked - please unlock your wallet';
            } else if (kabilaExtensionError.details.includes('disconnected')) {
                return 'Kabila wallet extension is not connected';
            }
            return 'Kabila wallet extension issue detected';
        }

        const kabilaConsistencyError = failedChecks.find(check => check.name === 'Kabila Connection Consistency');
        if (kabilaConsistencyError) {
            if (kabilaConsistencyError.details.includes('mismatch')) {
                return 'Kabila wallet connection state is inconsistent - please reconnect';
            }
            return 'Kabila wallet connection state synchronization issue';
        }

        // Fall back to general error types
        const serviceStateError = failedChecks.find(check => check.name === 'Wallet Service State');
        if (serviceStateError) {
            return 'Wallet service is not connected - please connect your wallet';
        }

        const connectionObjectError = failedChecks.find(check => check.name === 'Connection Object');
        if (connectionObjectError) {
            return 'Wallet connection is not properly established';
        }

        const accountIdError = failedChecks.find(check => check.name === 'Account ID');
        if (accountIdError) {
            return 'Wallet account information is missing or invalid';
        }

        return failedChecks[0].details;
    }

    /**
     * Generate actionable recommendations based on validation results
     */
    private generateRecommendations(checks: ValidationCheck[]): string[] {
        const recommendations: string[] = [];
        const failedChecks = checks.filter(check => !check.passed);

        for (const check of failedChecks) {
            switch (check.name) {
                case 'Wallet Service State':
                    recommendations.push('Try disconnecting and reconnecting your wallet');
                    recommendations.push('Ensure your wallet extension is unlocked and accessible');
                    break;
                case 'Connection Object':
                    recommendations.push('Refresh the page and reconnect your wallet');
                    recommendations.push('Check if your wallet extension is responding properly');
                    break;
                case 'Account ID':
                    recommendations.push('Verify your wallet is properly connected and account is selected');
                    recommendations.push('Try switching accounts in your wallet and reconnecting');
                    break;
                case 'Connection Stability':
                    recommendations.push('Wait a moment for the connection to stabilize before trying again');
                    break;
                case 'Kabila Extension State':
                    if (check.details.includes('not detected')) {
                        recommendations.push('Install the Kabila wallet extension from the Chrome Web Store');
                        recommendations.push('Refresh the page after installing the extension');
                    } else if (check.details.includes('locked') || check.details.includes('unavailable')) {
                        recommendations.push('Unlock your Kabila wallet by clicking the extension icon');
                        recommendations.push('Enter your password in the Kabila wallet extension');
                    } else if (check.details.includes('disconnected')) {
                        recommendations.push('Connect your Kabila wallet through the extension');
                        recommendations.push('Ensure you approve the connection request in Kabila');
                    }
                    break;
                case 'Kabila Connection Consistency':
                    if (check.details.includes('mismatch')) {
                        recommendations.push('Disconnect and reconnect your Kabila wallet to sync state');
                        recommendations.push('Ensure the same account is selected in both the app and extension');
                    } else if (check.details.includes('Service reports connected but')) {
                        recommendations.push('Refresh the page to reset connection state');
                        recommendations.push('Reconnect your Kabila wallet');
                    } else if (check.details.includes('Extension reports connected but')) {
                        recommendations.push('Try connecting your wallet in the app');
                        recommendations.push('Check if the wallet selection modal shows Kabila as available');
                    }
                    break;
            }
        }

        // Remove duplicates
        return [...new Set(recommendations)];
    }

    /**
     * Detect if we're using mock or real wallet connection
     */
    private detectConnectionType(): 'mock' | 'real' {
        // Check if we're in development/test environment
        if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
            return 'mock';
        }

        // Check if the connection looks like a mock (simple implementation)
        const connection = walletService.getConnection();
        if (connection?.account?.accountId === '123456' || connection?.balance?.includes('1,234.56')) {
            return 'mock';
        }

        return 'real';
    }

    /**
     * Record validation attempt in history
     */
    private recordValidationAttempt(attempt: ValidationAttempt): void {
        this.validationHistory.push(attempt);

        // Keep only recent validation attempts (last 50)
        if (this.validationHistory.length > 50) {
            this.validationHistory = this.validationHistory.slice(-50);
        }
    }
}