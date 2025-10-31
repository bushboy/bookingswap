import { ErrorDetails, errorLoggingService } from '@/services/errorLoggingService';
import { errorAnalyticsService } from '@/services/errorAnalyticsService';
import { errorRecoveryService } from '@/services/errorRecoveryService';

/**
 * Debug information for error analysis
 */
export interface ErrorDebugInfo {
    errorDetails: ErrorDetails;
    componentState?: any;
    propsSnapshot?: any;
    domSnapshot?: string;
    networkRequests?: any[];
    consoleMessages?: any[];
    performanceMetrics?: any;
    browserInfo: {
        userAgent: string;
        viewport: { width: number; height: number };
        url: string;
        timestamp: Date;
        memory?: any;
    };
}

/**
 * Debug session for tracking error investigation
 */
export interface DebugSession {
    sessionId: string;
    startTime: Date;
    errors: ErrorDebugInfo[];
    actions: Array<{
        type: string;
        timestamp: Date;
        details: any;
    }>;
    notes: string[];
}

/**
 * Comprehensive error debugging utility for development
 */
export class ErrorDebugger {
    private static instance: ErrorDebugger;
    private debugSessions: Map<string, DebugSession> = new Map();
    private currentSession: DebugSession | null = null;
    private isEnabled: boolean = import.meta.env.DEV;
    private consoleMessages: any[] = [];
    private networkRequests: any[] = [];

    private constructor() {
        if (this.isEnabled) {
            this.setupDebugHooks();
        }
    }

    static getInstance(): ErrorDebugger {
        if (!ErrorDebugger.instance) {
            ErrorDebugger.instance = new ErrorDebugger();
        }
        return ErrorDebugger.instance;
    }

    /**
     * Start a new debug session
     */
    startDebugSession(sessionName?: string): string {
        if (!this.isEnabled) return '';

        const sessionId = sessionName || `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const session: DebugSession = {
            sessionId,
            startTime: new Date(),
            errors: [],
            actions: [],
            notes: [],
        };

        this.debugSessions.set(sessionId, session);
        this.currentSession = session;

        console.log(`🐛 Debug session started: ${sessionId}`);

        return sessionId;
    }

    /**
     * End the current debug session
     */
    endDebugSession(): DebugSession | null {
        if (!this.isEnabled || !this.currentSession) return null;

        const session = this.currentSession;
        this.currentSession = null;

        console.log(`🐛 Debug session ended: ${session.sessionId}`, {
            duration: Date.now() - session.startTime.getTime(),
            errorsRecorded: session.errors.length,
            actionsRecorded: session.actions.length,
        });

        return session;
    }

    /**
     * Capture detailed error information for debugging
     */
    captureErrorDebugInfo(error: Error, componentName: string, additionalContext?: any): ErrorDebugInfo {
        if (!this.isEnabled) {
            return {} as ErrorDebugInfo;
        }

        const errorDetails: ErrorDetails = {
            errorId: `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            componentName,
            errorMessage: error.message,
            errorStack: error.stack,
            userAgent: navigator.userAgent,
            url: window.location.href,
            errorType: (error as any).errorType || 'unknown',
            severity: (error as any).severity || 'medium',
            context: additionalContext,
        };

        const debugInfo: ErrorDebugInfo = {
            errorDetails,
            componentState: this.captureComponentState(componentName),
            propsSnapshot: this.capturePropsSnapshot(componentName),
            domSnapshot: this.captureDOMSnapshot(componentName),
            networkRequests: [...this.networkRequests].slice(-10), // Last 10 requests
            consoleMessages: [...this.consoleMessages].slice(-20), // Last 20 messages
            performanceMetrics: this.capturePerformanceMetrics(),
            browserInfo: {
                userAgent: navigator.userAgent,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
                url: window.location.href,
                timestamp: new Date(),
                memory: (performance as any).memory ? {
                    usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
                    totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
                    jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
                } : undefined,
            },
        };

        // Add to current debug session
        if (this.currentSession) {
            this.currentSession.errors.push(debugInfo);
        }

        return debugInfo;
    }

    /**
     * Add a debug note to the current session
     */
    addDebugNote(note: string): void {
        if (!this.isEnabled || !this.currentSession) return;

        this.currentSession.notes.push(`[${new Date().toISOString()}] ${note}`);
        console.log(`🐛 Debug note: ${note}`);
    }

    /**
     * Track a debug action
     */
    trackDebugAction(type: string, details: any): void {
        if (!this.isEnabled || !this.currentSession) return;

        this.currentSession.actions.push({
            type,
            timestamp: new Date(),
            details,
        });
    }

    /**
     * Generate a comprehensive debug report
     */
    generateDebugReport(sessionId?: string): any {
        if (!this.isEnabled) return null;

        const session = sessionId
            ? this.debugSessions.get(sessionId)
            : this.currentSession;

        if (!session) return null;

        const analytics = errorAnalyticsService.generateReport(1); // Last hour
        const metrics = errorLoggingService.getMetrics();

        return {
            session: {
                id: session.sessionId,
                startTime: session.startTime,
                duration: Date.now() - session.startTime.getTime(),
                errorsCount: session.errors.length,
                actionsCount: session.actions.length,
                notesCount: session.notes.length,
            },
            errors: session.errors,
            actions: session.actions,
            notes: session.notes,
            analytics: {
                summary: analytics.summary,
                trends: analytics.trends,
                insights: analytics.insights,
                alerts: analytics.alerts,
            },
            metrics: {
                totalErrors: metrics.totalErrors,
                errorsByComponent: metrics.errorsByComponent,
                errorsByType: metrics.errorsByType,
                recoverySuccessRate: metrics.recoverySuccessRate,
            },
            environment: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
                memory: (performance as any).memory,
            },
        };
    }

    /**
     * Export debug report as JSON
     */
    exportDebugReport(sessionId?: string): string {
        const report = this.generateDebugReport(sessionId);
        return JSON.stringify(report, null, 2);
    }

    /**
     * Get all debug sessions
     */
    getDebugSessions(): DebugSession[] {
        return Array.from(this.debugSessions.values());
    }

    /**
     * Clear debug data
     */
    clearDebugData(): void {
        this.debugSessions.clear();
        this.currentSession = null;
        this.consoleMessages = [];
        this.networkRequests = [];
        console.log('🐛 Debug data cleared');
    }

    /**
     * Enable/disable debugging
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled && import.meta.env.DEV;

        if (this.isEnabled) {
            this.setupDebugHooks();
        }
    }

    /**
     * Setup debugging hooks and listeners
     */
    private setupDebugHooks(): void {
        // Capture console messages
        const originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
        };

        console.log = (...args) => {
            this.consoleMessages.push({
                type: 'log',
                timestamp: new Date(),
                args: args.map(arg => this.serializeForDebug(arg)),
            });
            originalConsole.log(...args);
        };

        console.warn = (...args) => {
            this.consoleMessages.push({
                type: 'warn',
                timestamp: new Date(),
                args: args.map(arg => this.serializeForDebug(arg)),
            });
            originalConsole.warn(...args);
        };

        console.error = (...args) => {
            this.consoleMessages.push({
                type: 'error',
                timestamp: new Date(),
                args: args.map(arg => this.serializeForDebug(arg)),
            });
            originalConsole.error(...args);
        };

        // Capture network requests
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const startTime = Date.now();
            const request = {
                url: args[0],
                options: args[1],
                timestamp: new Date(),
                startTime,
            };

            try {
                const response = await originalFetch(...args);
                this.networkRequests.push({
                    ...request,
                    status: response.status,
                    statusText: response.statusText,
                    duration: Date.now() - startTime,
                    success: response.ok,
                });
                return response;
            } catch (error) {
                this.networkRequests.push({
                    ...request,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    duration: Date.now() - startTime,
                    success: false,
                });
                throw error;
            }
        };

        // Capture unhandled errors
        window.addEventListener('error', (event) => {
            if (this.currentSession) {
                this.trackDebugAction('unhandled_error', {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    error: event.error,
                });
            }
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            if (this.currentSession) {
                this.trackDebugAction('unhandled_rejection', {
                    reason: event.reason,
                    promise: 'Promise object',
                });
            }
        });
    }

    /**
     * Capture component state (if available)
     */
    private captureComponentState(componentName: string): any {
        try {
            // Try to find React DevTools data
            const reactFiber = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
            if (reactFiber) {
                // This is a simplified approach - in a real implementation,
                // you'd need to traverse the React fiber tree
                return { note: 'React DevTools integration needed for full state capture' };
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Capture props snapshot (if available)
     */
    private capturePropsSnapshot(componentName: string): any {
        try {
            // Similar to state capture, this would need React DevTools integration
            return { note: 'Props snapshot requires React DevTools integration' };
        } catch {
            return null;
        }
    }

    /**
     * Capture DOM snapshot around the component
     */
    private captureDOMSnapshot(componentName: string): string {
        try {
            // Find elements that might be related to the component
            const elements = document.querySelectorAll(`[data-component="${componentName}"], .${componentName.toLowerCase()}`);

            if (elements.length > 0) {
                return Array.from(elements)
                    .map(el => el.outerHTML)
                    .join('\n');
            }

            // Fallback: capture body HTML (truncated)
            const bodyHTML = document.body.innerHTML;
            return bodyHTML.length > 5000
                ? bodyHTML.substring(0, 5000) + '...[truncated]'
                : bodyHTML;
        } catch {
            return 'Failed to capture DOM snapshot';
        }
    }

    /**
     * Capture performance metrics
     */
    private capturePerformanceMetrics(): any {
        try {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            const paint = performance.getEntriesByType('paint');

            return {
                navigation: navigation ? {
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                    totalTime: navigation.loadEventEnd - navigation.fetchStart,
                } : null,
                paint: paint.map(entry => ({
                    name: entry.name,
                    startTime: entry.startTime,
                })),
                memory: (performance as any).memory,
                timing: performance.timing,
            };
        } catch {
            return null;
        }
    }

    /**
     * Serialize objects for debug storage
     */
    private serializeForDebug(obj: any): any {
        try {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return obj;
            if (obj instanceof Error) {
                return {
                    name: obj.name,
                    message: obj.message,
                    stack: obj.stack,
                };
            }
            if (typeof obj === 'object') {
                return JSON.parse(JSON.stringify(obj, null, 2));
            }
            return String(obj);
        } catch {
            return '[Unserializable object]';
        }
    }
}

// Export singleton instance
export const errorDebugger = ErrorDebugger.getInstance();
export default errorDebugger;