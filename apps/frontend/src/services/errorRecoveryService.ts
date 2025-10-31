import { errorLoggingService } from './errorLoggingService';

/**
 * Recovery strategy for different types of errors
 */
export interface RecoveryStrategy {
  name: string;
  description: string;
  action: () => Promise<boolean>;
  riskLevel: 'low' | 'medium' | 'high';
  userFriendlyName: string;
}

/**
 * Recovery options for specific components
 */
export interface ComponentRecoveryOptions {
  componentName: string;
  strategies: RecoveryStrategy[];
  fallbackMessage: string;
}

/**
 * Recovery attempt result
 */
export interface RecoveryResult {
  success: boolean;
  strategyUsed: string;
  message: string;
  timestamp: Date;
  recoveryTime: number;
}

/**
 * Service for managing error recovery strategies and user-facing recovery options
 */
export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private recoveryHistory: Map<string, RecoveryResult[]> = new Map();
  private componentStrategies: Map<string, ComponentRecoveryOptions> = new Map();

  private constructor() {
    this.initializeDefaultStrategies();
  }

  static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  /**
   * Get recovery options for a specific component
   */
  getRecoveryOptions(componentName: string): ComponentRecoveryOptions {
    return this.componentStrategies.get(componentName) || {
      componentName,
      strategies: this.getDefaultStrategies(),
      fallbackMessage: 'Try the available recovery options below.',
    };
  }

  /**
   * Execute a recovery strategy
   */
  async executeRecovery(
    componentName: string,
    strategyName: string,
    errorId?: string
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    const options = this.getRecoveryOptions(componentName);
    const strategy = options.strategies.find(s => s.name === strategyName);

    if (!strategy) {
      throw new Error(`Recovery strategy '${strategyName}' not found for component '${componentName}'`);
    }

    try {
      // Track recovery attempt
      errorLoggingService.trackUserAction('recovery_attempt', {
        component: componentName,
        strategy: strategyName,
        errorId,
      });

      const success = await strategy.action();
      const recoveryTime = Date.now() - startTime;

      const result: RecoveryResult = {
        success,
        strategyUsed: strategyName,
        message: success
          ? `Successfully recovered using ${strategy.userFriendlyName}`
          : `Recovery attempt with ${strategy.userFriendlyName} failed`,
        timestamp: new Date(),
        recoveryTime,
      };

      // Store recovery result
      this.storeRecoveryResult(componentName, result);

      // Log recovery attempt
      if (errorId) {
        errorLoggingService.recordRecoveryAttempt(errorId, success, recoveryTime);
      }

      return result;

    } catch (error) {
      const recoveryTime = Date.now() - startTime;
      const result: RecoveryResult = {
        success: false,
        strategyUsed: strategyName,
        message: `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        recoveryTime,
      };

      this.storeRecoveryResult(componentName, result);
      return result;
    }
  }

  /**
   * Get recovery history for a component
   */
  getRecoveryHistory(componentName: string): RecoveryResult[] {
    return this.recoveryHistory.get(componentName) || [];
  }

  /**
   * Get recovery success rate for a component
   */
  getRecoverySuccessRate(componentName: string): number {
    const history = this.getRecoveryHistory(componentName);
    if (history.length === 0) return 0;

    const successfulRecoveries = history.filter(r => r.success).length;
    return successfulRecoveries / history.length;
  }

  /**
   * Register custom recovery strategies for a component
   */
  registerComponentStrategies(options: ComponentRecoveryOptions): void {
    this.componentStrategies.set(options.componentName, options);
  }

  /**
   * Clear component data (useful for reset strategies)
   */
  async clearComponentData(componentName: string): Promise<boolean> {
    try {
      // Clear localStorage entries related to the component
      const keysToRemove = Object.keys(localStorage).filter(key =>
        key.toLowerCase().includes(componentName.toLowerCase())
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Clear sessionStorage entries
      const sessionKeysToRemove = Object.keys(sessionStorage).filter(key =>
        key.toLowerCase().includes(componentName.toLowerCase())
      );
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

      // Clear any cached API responses
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          for (const request of requests) {
            if (request.url.toLowerCase().includes(componentName.toLowerCase())) {
              await cache.delete(request);
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to clear component data:', error);
      return false;
    }
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeDefaultStrategies(): void {
    // Badge component strategies
    this.registerComponentStrategies({
      componentName: 'Badge',
      strategies: [
        {
          name: 'retry_render',
          userFriendlyName: 'Retry Rendering',
          description: 'Attempt to render the component again',
          riskLevel: 'low',
          action: async () => {
            // Simple retry - just return true to trigger re-render
            await new Promise(resolve => setTimeout(resolve, 100));
            return true;
          },
        },
        {
          name: 'reset_props',
          userFriendlyName: 'Reset Properties',
          description: 'Reset component properties to default values',
          riskLevel: 'low',
          action: async () => {
            // Clear any cached props or state
            return await this.clearComponentData('Badge');
          },
        },
        {
          name: 'fallback_variant',
          userFriendlyName: 'Use Fallback Style',
          description: 'Switch to a basic fallback appearance',
          riskLevel: 'low',
          action: async () => {
            // Set fallback variant in localStorage
            localStorage.setItem('badge_fallback_mode', 'true');
            return true;
          },
        },
      ],
      fallbackMessage: 'The badge component failed to render. Try one of these recovery options:',
    });

    // ConnectionStatusIndicator strategies
    this.registerComponentStrategies({
      componentName: 'ConnectionStatusIndicator',
      strategies: [
        {
          name: 'refresh_status',
          userFriendlyName: 'Refresh Connection Status',
          description: 'Check the connection status again',
          riskLevel: 'low',
          action: async () => {
            // Trigger a connection status check
            try {
              const response = await fetch('/api/health', {
                method: 'HEAD',
                cache: 'no-cache',
              });
              return response.ok;
            } catch {
              return false;
            }
          },
        },
        {
          name: 'text_fallback',
          userFriendlyName: 'Use Text Display',
          description: 'Switch to text-only connection status',
          riskLevel: 'low',
          action: async () => {
            localStorage.setItem('connection_status_text_mode', 'true');
            return true;
          },
        },
        {
          name: 'reset_connection',
          userFriendlyName: 'Reset Connection',
          description: 'Clear connection data and reconnect',
          riskLevel: 'medium',
          action: async () => {
            // Clear connection-related data
            await this.clearComponentData('connection');

            // Trigger reconnection if WebSocket is available
            if (window.WebSocket && (window as any).reconnectWebSocket) {
              try {
                (window as any).reconnectWebSocket();
                return true;
              } catch {
                return false;
              }
            }
            return true;
          },
        },
      ],
      fallbackMessage: 'The connection status indicator failed. Try these recovery options:',
    });

    // Header component strategies
    this.registerComponentStrategies({
      componentName: 'Header',
      strategies: [
        {
          name: 'reload_navigation',
          userFriendlyName: 'Reload Navigation',
          description: 'Refresh the navigation menu',
          riskLevel: 'low',
          action: async () => {
            // Clear navigation cache
            await this.clearComponentData('navigation');
            return true;
          },
        },
        {
          name: 'minimal_header',
          userFriendlyName: 'Use Minimal Header',
          description: 'Switch to a simplified header layout',
          riskLevel: 'low',
          action: async () => {
            localStorage.setItem('header_minimal_mode', 'true');
            return true;
          },
        },
        {
          name: 'refresh_user_data',
          userFriendlyName: 'Refresh User Data',
          description: 'Reload user information and authentication status',
          riskLevel: 'medium',
          action: async () => {
            try {
              // Refresh user authentication
              const response = await fetch('/api/auth/me', {
                credentials: 'include',
                cache: 'no-cache',
              });

              if (response.ok) {
                const userData = await response.json();
                localStorage.setItem('user', JSON.stringify(userData));
                return true;
              }
              return false;
            } catch {
              return false;
            }
          },
        },
      ],
      fallbackMessage: 'The header component encountered an error. Try these recovery options:',
    });
  }

  /**
   * Get default recovery strategies for unknown components
   */
  private getDefaultStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'simple_retry',
        userFriendlyName: 'Retry',
        description: 'Try to render the component again',
        riskLevel: 'low',
        action: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return true;
        },
      },
      {
        name: 'clear_cache',
        userFriendlyName: 'Clear Cache',
        description: 'Clear any cached data for this component',
        riskLevel: 'low',
        action: async () => {
          return await this.clearComponentData('component');
        },
      },
      {
        name: 'page_refresh',
        userFriendlyName: 'Refresh Page',
        description: 'Reload the entire page',
        riskLevel: 'high',
        action: async () => {
          window.location.reload();
          return true; // This won't actually return since page reloads
        },
      },
    ];
  }

  /**
   * Execute a function with retry logic and error recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    operationName: string,
    config: {
      maxAttempts?: number;
      baseDelay?: number;
      maxDelay?: number;
      backoffMultiplier?: number;
      jitter?: boolean;
    } = {}
  ): Promise<{ success: boolean; result?: T; error?: Error }> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 5000,
      backoffMultiplier = 2,
      jitter = true
    } = config;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        return { success: true, result };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on the last attempt
        if (attempt < maxAttempts) {
          const delay = this.calculateRetryDelay(attempt, baseDelay, maxDelay, backoffMultiplier, jitter);
          await this.sleep(delay);
        }
      }
    }

    return { success: false, error: lastError || new Error('Unknown error') };
  }

  /**
   * Calculate retry delay with exponential backoff and optional jitter
   */
  private calculateRetryDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    backoffMultiplier: number,
    jitter: boolean
  ): number {
    const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);

    if (jitter) {
      // Add random jitter to prevent thundering herd
      const jitterAmount = cappedDelay * 0.1; // 10% jitter
      const randomJitter = (Math.random() - 0.5) * 2 * jitterAmount;
      return Math.max(0, cappedDelay + randomJitter);
    }

    return cappedDelay;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Store recovery result in history
   */
  private storeRecoveryResult(componentName: string, result: RecoveryResult): void {
    const history = this.recoveryHistory.get(componentName) || [];
    history.push(result);

    // Keep only the last 10 recovery attempts per component
    if (history.length > 10) {
      history.shift();
    }

    this.recoveryHistory.set(componentName, history);
  }
}

// Export singleton instance
export const errorRecoveryService = ErrorRecoveryService.getInstance();
export default errorRecoveryService;