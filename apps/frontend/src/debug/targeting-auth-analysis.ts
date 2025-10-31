/**
 * Targeting Authentication Analysis Utility
 * 
 * This utility analyzes and logs authentication issues specifically related to targeting operations.
 * It helps identify where authentication fails for users with outgoing targets.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

export interface AuthenticationAnalysisResult {
    timestamp: Date;
    userId: string;
    operation: string;
    endpoint: string;
    authStatus: 'success' | 'failed' | 'error';
    tokenPresent: boolean;
    tokenValid: boolean;
    errorType?: 'missing_token' | 'invalid_token' | 'expired_token' | 'network_error' | 'server_error';
    errorMessage?: string;
    responseStatus?: number;
    requestHeaders: Record<string, string>;
    responseHeaders?: Record<string, string>;
    duration: number;
    isTargetingRelated: boolean;
    targetingContext?: {
        hasOutgoingTargets: boolean;
        targetingOperationType: 'load_targeting_data' | 'target_swap' | 'retarget' | 'remove_target' | 'get_status';
        sourceSwapId?: string;
        targetSwapId?: string;
    };
}

export interface TargetingAuthenticationIssue {
    issueId: string;
    timestamp: Date;
    userId: string;
    issueType: 'false_positive_auth_failure' | 'targeting_endpoint_auth_mismatch' | 'token_validation_inconsistency';
    description: string;
    affectedEndpoints: string[];
    authenticationFlow: AuthenticationAnalysisResult[];
    reproductionSteps: string[];
    potentialCause: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

class TargetingAuthenticationAnalyzer {
    private analysisResults: AuthenticationAnalysisResult[] = [];
    private identifiedIssues: TargetingAuthenticationIssue[] = [];
    private isAnalyzing = false;

    /**
     * Start comprehensive authentication analysis for targeting operations
     */
    startAnalysis(): void {
        if (this.isAnalyzing) {
            console.warn('Targeting authentication analysis already running');
            return;
        }

        this.isAnalyzing = true;
        console.log('🔍 Starting targeting authentication analysis...');

        // Hook into fetch to monitor all API calls
        this.interceptFetchRequests();

        // Hook into authentication context changes
        this.monitorAuthenticationState();

        // Monitor targeting-specific operations
        this.monitorTargetingOperations();

        console.log('✅ Targeting authentication analysis started');
    }

    /**
     * Stop analysis and generate report
     */
    stopAnalysis(): TargetingAuthenticationAnalysisReport {
        if (!this.isAnalyzing) {
            console.warn('No targeting authentication analysis running');
            return this.generateReport();
        }

        this.isAnalyzing = false;
        console.log('🛑 Stopping targeting authentication analysis...');

        // Restore original fetch
        this.restoreOriginalFetch();

        const report = this.generateReport();
        console.log('📊 Targeting authentication analysis complete');

        return report;
    }

    /**
     * Intercept fetch requests to monitor authentication
     */
    private interceptFetchRequests(): void {
        const originalFetch = window.fetch;

        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const startTime = Date.now();
            const url = typeof input === 'string' ? input : input.toString();
            const isTargetingEndpoint = this.isTargetingRelatedEndpoint(url);

            // Extract authentication information
            const authHeader = init?.headers?.['Authorization'] ||
                (init?.headers as any)?.authorization ||
                localStorage.getItem('auth_token') ? `Bearer ${localStorage.getItem('auth_token')}` : '';

            const requestHeaders: Record<string, string> = {
                'Authorization': authHeader,
                'Content-Type': init?.headers?.['Content-Type'] || 'application/json',
                ...(init?.headers as Record<string, string> || {})
            };

            let analysisResult: AuthenticationAnalysisResult;

            try {
                const response = await originalFetch(input, init);
                const duration = Date.now() - startTime;

                // Analyze authentication status
                const authStatus = this.analyzeAuthenticationStatus(response.status, response.headers);

                analysisResult = {
                    timestamp: new Date(),
                    userId: this.getCurrentUserId(),
                    operation: this.extractOperationFromUrl(url),
                    endpoint: url,
                    authStatus: authStatus.status,
                    tokenPresent: !!authHeader,
                    tokenValid: authStatus.tokenValid,
                    errorType: authStatus.errorType,
                    errorMessage: authStatus.errorMessage,
                    responseStatus: response.status,
                    requestHeaders,
                    responseHeaders: this.extractResponseHeaders(response.headers),
                    duration,
                    isTargetingRelated: isTargetingEndpoint,
                    targetingContext: isTargetingEndpoint ? this.extractTargetingContext(url, init) : undefined
                };

                // Log the analysis result
                this.logAuthenticationResult(analysisResult);

                // Check for potential issues
                if (isTargetingEndpoint && authStatus.status === 'failed') {
                    this.analyzeTargetingAuthenticationIssue(analysisResult);
                }

                return response;
            } catch (error) {
                const duration = Date.now() - startTime;

                analysisResult = {
                    timestamp: new Date(),
                    userId: this.getCurrentUserId(),
                    operation: this.extractOperationFromUrl(url),
                    endpoint: url,
                    authStatus: 'error',
                    tokenPresent: !!authHeader,
                    tokenValid: false,
                    errorType: 'network_error',
                    errorMessage: error instanceof Error ? error.message : 'Unknown network error',
                    requestHeaders,
                    duration,
                    isTargetingRelated: isTargetingEndpoint,
                    targetingContext: isTargetingEndpoint ? this.extractTargetingContext(url, init) : undefined
                };

                this.logAuthenticationResult(analysisResult);

                if (isTargetingEndpoint) {
                    this.analyzeTargetingAuthenticationIssue(analysisResult);
                }

                throw error;
            }
        };
    }

    /**
     * Monitor authentication state changes
     */
    private monitorAuthenticationState(): void {
        // Listen for auth context changes
        window.addEventListener('auth:state-change', (event: any) => {
            console.log('🔐 Authentication state changed:', {
                timestamp: new Date().toISOString(),
                newState: event.detail,
                hasToken: !!localStorage.getItem('auth_token'),
                hasUser: !!localStorage.getItem('auth_user')
            });
        });

        // Listen for token expiration events
        window.addEventListener('auth:token-expired', (event: any) => {
            console.log('⏰ Token expired event:', {
                timestamp: new Date().toISOString(),
                context: event.detail,
                currentUrl: window.location.pathname
            });
        });

        // Monitor localStorage changes for auth tokens
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function (key: string, value: string) {
            if (key === 'auth_token' || key === 'auth_user') {
                console.log('💾 Auth storage changed:', {
                    timestamp: new Date().toISOString(),
                    key,
                    hasValue: !!value,
                    valueLength: value?.length || 0
                });
            }
            return originalSetItem.call(this, key, value);
        };
    }

    /**
     * Monitor targeting-specific operations
     */
    private monitorTargetingOperations(): void {
        // Monitor targeting service calls
        const targetingServices = [
            'swapTargetingService',
            'targetingActionService',
            'swapService'
        ];

        targetingServices.forEach(serviceName => {
            const service = (window as any)[serviceName];
            if (service) {
                this.wrapServiceMethods(service, serviceName);
            }
        });
    }

    /**
     * Wrap service methods to monitor targeting operations
     */
    private wrapServiceMethods(service: any, serviceName: string): void {
        const methodsToWrap = Object.getOwnPropertyNames(Object.getPrototypeOf(service))
            .filter(name => typeof service[name] === 'function' && name !== 'constructor');

        methodsToWrap.forEach(methodName => {
            const originalMethod = service[methodName];

            service[methodName] = async (...args: any[]) => {
                const startTime = Date.now();

                console.log(`🎯 Targeting operation started: ${serviceName}.${methodName}`, {
                    timestamp: new Date().toISOString(),
                    arguments: args,
                    userId: this.getCurrentUserId()
                });

                try {
                    const result = await originalMethod.apply(service, args);
                    const duration = Date.now() - startTime;

                    console.log(`✅ Targeting operation completed: ${serviceName}.${methodName}`, {
                        timestamp: new Date().toISOString(),
                        duration,
                        success: true,
                        resultType: typeof result
                    });

                    return result;
                } catch (error) {
                    const duration = Date.now() - startTime;

                    console.error(`❌ Targeting operation failed: ${serviceName}.${methodName}`, {
                        timestamp: new Date().toISOString(),
                        duration,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        errorType: this.classifyTargetingError(error)
                    });

                    // Analyze if this is an authentication-related failure
                    if (this.isAuthenticationError(error)) {
                        this.analyzeTargetingAuthenticationFailure(serviceName, methodName, error, args);
                    }

                    throw error;
                }
            };
        });
    }

    /**
     * Determine if endpoint is targeting-related
     */
    private isTargetingRelatedEndpoint(url: string): boolean {
        const targetingPatterns = [
            '/api/swaps/.*/target',
            '/api/swaps/.*/retarget',
            '/api/swaps/.*/targeting-status',
            '/api/swaps/.*/targeting-history',
            '/api/swaps/.*/can-target',
            '/api/swaps/.*/targeted-by',
            '/api/users/.*/targeting-activity',
            '/api/targeting'
        ];

        return targetingPatterns.some(pattern => {
            const regex = new RegExp(pattern);
            return regex.test(url);
        });
    }

    /**
     * Analyze authentication status from response
     */
    private analyzeAuthenticationStatus(status: number, headers: Headers): {
        status: 'success' | 'failed' | 'error';
        tokenValid: boolean;
        errorType?: string;
        errorMessage?: string;
    } {
        if (status >= 200 && status < 300) {
            return { status: 'success', tokenValid: true };
        }

        if (status === 401) {
            return {
                status: 'failed',
                tokenValid: false,
                errorType: 'invalid_token',
                errorMessage: 'Authentication failed - token invalid or expired'
            };
        }

        if (status === 403) {
            return {
                status: 'failed',
                tokenValid: true,
                errorType: 'access_denied',
                errorMessage: 'Access denied - insufficient permissions'
            };
        }

        if (status >= 500) {
            return {
                status: 'error',
                tokenValid: true,
                errorType: 'server_error',
                errorMessage: 'Server error during authentication'
            };
        }

        return {
            status: 'error',
            tokenValid: false,
            errorType: 'unknown_error',
            errorMessage: `Unexpected response status: ${status}`
        };
    }

    /**
     * Extract targeting context from request
     */
    private extractTargetingContext(url: string, init?: RequestInit): {
        hasOutgoingTargets: boolean;
        targetingOperationType: 'load_targeting_data' | 'target_swap' | 'retarget' | 'remove_target' | 'get_status';
        sourceSwapId?: string;
        targetSwapId?: string;
    } {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const urlParts = url.split('/');

        let operationType: 'load_targeting_data' | 'target_swap' | 'retarget' | 'remove_target' | 'get_status' = 'load_targeting_data';

        if (url.includes('/target') && init?.method === 'POST') {
            operationType = 'target_swap';
        } else if (url.includes('/retarget')) {
            operationType = 'retarget';
        } else if (url.includes('/target') && init?.method === 'DELETE') {
            operationType = 'remove_target';
        } else if (url.includes('/targeting-status') || url.includes('/can-target')) {
            operationType = 'get_status';
        }

        return {
            hasOutgoingTargets: this.userHasOutgoingTargets(),
            targetingOperationType: operationType,
            sourceSwapId: body.sourceSwapId || this.extractSwapIdFromUrl(url),
            targetSwapId: body.targetSwapId || urlParts[urlParts.indexOf('swaps') + 1]
        };
    }

    /**
     * Check if current user has outgoing targets
     */
    private userHasOutgoingTargets(): boolean {
        // This would need to be implemented based on the current user's targeting state
        // For now, we'll check if there's any targeting data in localStorage or context
        try {
            const userData = localStorage.getItem('auth_user');
            if (userData) {
                const user = JSON.parse(userData);
                // Check if user has any targeting activity
                return !!(user.targetingActivity || user.outgoingTargets);
            }
        } catch (error) {
            console.warn('Failed to check user targeting status:', error);
        }
        return false;
    }

    /**
     * Analyze potential targeting authentication issue
     */
    private analyzeTargetingAuthenticationIssue(result: AuthenticationAnalysisResult): void {
        const issue: TargetingAuthenticationIssue = {
            issueId: `targeting-auth-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            timestamp: result.timestamp,
            userId: result.userId,
            issueType: this.classifyTargetingAuthIssue(result),
            description: this.generateIssueDescription(result),
            affectedEndpoints: [result.endpoint],
            authenticationFlow: [result],
            reproductionSteps: this.generateReproductionSteps(result),
            potentialCause: this.identifyPotentialCause(result),
            severity: this.assessIssueSeverity(result)
        };

        this.identifiedIssues.push(issue);

        console.error('🚨 Targeting authentication issue identified:', issue);
    }

    /**
     * Classify targeting authentication issue type
     */
    private classifyTargetingAuthIssue(result: AuthenticationAnalysisResult): 'false_positive_auth_failure' | 'targeting_endpoint_auth_mismatch' | 'token_validation_inconsistency' {
        if (result.tokenPresent && result.errorType === 'invalid_token' && result.targetingContext?.hasOutgoingTargets) {
            return 'false_positive_auth_failure';
        }

        if (result.isTargetingRelated && result.authStatus === 'failed' && result.tokenPresent) {
            return 'targeting_endpoint_auth_mismatch';
        }

        return 'token_validation_inconsistency';
    }

    /**
     * Generate issue description
     */
    private generateIssueDescription(result: AuthenticationAnalysisResult): string {
        const baseDescription = `Authentication failed for targeting operation on ${result.endpoint}`;

        if (result.targetingContext?.hasOutgoingTargets) {
            return `${baseDescription}. User with outgoing targets experienced authentication failure despite having valid token.`;
        }

        return `${baseDescription}. Token validation failed for targeting-specific endpoint.`;
    }

    /**
     * Generate reproduction steps
     */
    private generateReproductionSteps(result: AuthenticationAnalysisResult): string[] {
        const steps = [
            '1. Log in as a user with outgoing targets',
            '2. Navigate to My Swaps page',
            `3. Trigger ${result.operation} operation`,
            `4. Observe authentication failure on ${result.endpoint}`
        ];

        if (result.targetingContext?.targetingOperationType) {
            steps.push(`5. Note that this occurs specifically during ${result.targetingContext.targetingOperationType} operations`);
        }

        return steps;
    }

    /**
     * Identify potential cause
     */
    private identifyPotentialCause(result: AuthenticationAnalysisResult): string {
        if (result.errorType === 'invalid_token' && result.tokenPresent) {
            return 'Targeting endpoints may use different token validation logic that incorrectly rejects valid tokens';
        }

        if (result.targetingContext?.hasOutgoingTargets) {
            return 'Cross-user data access in targeting operations may trigger incorrect authorization failures';
        }

        return 'Inconsistent authentication validation between main swap endpoints and targeting endpoints';
    }

    /**
     * Assess issue severity
     */
    private assessIssueSeverity(result: AuthenticationAnalysisResult): 'low' | 'medium' | 'high' | 'critical' {
        if (result.targetingContext?.hasOutgoingTargets && result.tokenPresent) {
            return 'critical'; // Users with valid tokens being logged out
        }

        if (result.isTargetingRelated && result.authStatus === 'failed') {
            return 'high'; // Targeting functionality broken
        }

        return 'medium';
    }

    /**
     * Utility methods
     */
    private getCurrentUserId(): string {
        try {
            const userData = localStorage.getItem('auth_user');
            if (userData) {
                const user = JSON.parse(userData);
                return user.id || 'unknown';
            }
        } catch (error) {
            console.warn('Failed to get current user ID:', error);
        }
        return 'unknown';
    }

    private extractOperationFromUrl(url: string): string {
        if (url.includes('/target') && !url.includes('/retarget')) return 'target_swap';
        if (url.includes('/retarget')) return 'retarget_swap';
        if (url.includes('/targeting-status')) return 'get_targeting_status';
        if (url.includes('/targeting-history')) return 'get_targeting_history';
        if (url.includes('/can-target')) return 'check_can_target';
        if (url.includes('/targeted-by')) return 'get_targeted_by';
        if (url.includes('/targeting-activity')) return 'get_targeting_activity';
        return 'unknown_operation';
    }

    private extractSwapIdFromUrl(url: string): string | undefined {
        const match = url.match(/\/swaps\/([^\/]+)/);
        return match ? match[1] : undefined;
    }

    private extractResponseHeaders(headers: Headers): Record<string, string> {
        const result: Record<string, string> = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    private isAuthenticationError(error: any): boolean {
        if (error?.response?.status === 401 || error?.response?.status === 403) {
            return true;
        }

        if (error?.message?.toLowerCase().includes('auth')) {
            return true;
        }

        return false;
    }

    private classifyTargetingError(error: any): string {
        if (error?.response?.status === 401) return 'authentication_error';
        if (error?.response?.status === 403) return 'authorization_error';
        if (error?.response?.status >= 500) return 'server_error';
        if (error?.code === 'NETWORK_ERROR') return 'network_error';
        return 'unknown_error';
    }

    private analyzeTargetingAuthenticationFailure(serviceName: string, methodName: string, error: any, args: any[]): void {
        console.error('🔍 Analyzing targeting authentication failure:', {
            timestamp: new Date().toISOString(),
            service: serviceName,
            method: methodName,
            error: error instanceof Error ? error.message : 'Unknown error',
            arguments: args,
            userId: this.getCurrentUserId(),
            hasToken: !!localStorage.getItem('auth_token'),
            tokenLength: localStorage.getItem('auth_token')?.length || 0
        });
    }

    private logAuthenticationResult(result: AuthenticationAnalysisResult): void {
        this.analysisResults.push(result);

        if (result.isTargetingRelated) {
            const logLevel = result.authStatus === 'failed' ? 'error' : 'info';
            console[logLevel]('🎯 Targeting authentication result:', {
                timestamp: result.timestamp.toISOString(),
                endpoint: result.endpoint,
                status: result.authStatus,
                tokenPresent: result.tokenPresent,
                tokenValid: result.tokenValid,
                duration: result.duration,
                targetingContext: result.targetingContext
            });
        }
    }

    private restoreOriginalFetch(): void {
        // This would restore the original fetch if we stored it
        // For now, we'll just log that analysis is stopping
        console.log('🔄 Restoring original fetch implementation');
    }

    /**
     * Generate comprehensive analysis report
     */
    private generateReport(): TargetingAuthenticationAnalysisReport {
        const targetingResults = this.analysisResults.filter(r => r.isTargetingRelated);
        const failedTargetingResults = targetingResults.filter(r => r.authStatus === 'failed');

        return {
            analysisStarted: new Date(),
            analysisCompleted: new Date(),
            totalRequests: this.analysisResults.length,
            targetingRequests: targetingResults.length,
            failedTargetingRequests: failedTargetingResults.length,
            identifiedIssues: this.identifiedIssues,
            authenticationResults: this.analysisResults,
            summary: {
                criticalIssues: this.identifiedIssues.filter(i => i.severity === 'critical').length,
                highPriorityIssues: this.identifiedIssues.filter(i => i.severity === 'high').length,
                mostCommonErrorType: this.getMostCommonErrorType(failedTargetingResults),
                affectedEndpoints: [...new Set(failedTargetingResults.map(r => r.endpoint))],
                usersWithOutgoingTargets: this.getUsersWithOutgoingTargets(targetingResults)
            },
            recommendations: this.generateRecommendations()
        };
    }

    private getMostCommonErrorType(results: AuthenticationAnalysisResult[]): string {
        const errorCounts: Record<string, number> = {};
        results.forEach(r => {
            if (r.errorType) {
                errorCounts[r.errorType] = (errorCounts[r.errorType] || 0) + 1;
            }
        });

        return Object.entries(errorCounts)
            .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none';
    }

    private getUsersWithOutgoingTargets(results: AuthenticationAnalysisResult[]): string[] {
        return [...new Set(
            results
                .filter(r => r.targetingContext?.hasOutgoingTargets)
                .map(r => r.userId)
        )];
    }

    private generateRecommendations(): string[] {
        const recommendations = [
            'Implement consistent token validation logic across all API endpoints',
            'Add targeting-specific authentication error handling that preserves main auth state',
            'Implement retry logic for targeting operations that doesn\'t affect main authentication',
            'Add comprehensive logging for targeting-related authentication failures',
            'Create authentication error classification system to distinguish targeting vs genuine auth failures'
        ];

        if (this.identifiedIssues.some(i => i.issueType === 'false_positive_auth_failure')) {
            recommendations.push('Fix false positive authentication failures for users with outgoing targets');
        }

        if (this.identifiedIssues.some(i => i.issueType === 'targeting_endpoint_auth_mismatch')) {
            recommendations.push('Align targeting endpoint authentication with main swap endpoint authentication');
        }

        return recommendations;
    }
}

export interface TargetingAuthenticationAnalysisReport {
    analysisStarted: Date;
    analysisCompleted: Date;
    totalRequests: number;
    targetingRequests: number;
    failedTargetingRequests: number;
    identifiedIssues: TargetingAuthenticationIssue[];
    authenticationResults: AuthenticationAnalysisResult[];
    summary: {
        criticalIssues: number;
        highPriorityIssues: number;
        mostCommonErrorType: string;
        affectedEndpoints: string[];
        usersWithOutgoingTargets: string[];
    };
    recommendations: string[];
}

// Export singleton instance
export const targetingAuthAnalyzer = new TargetingAuthenticationAnalyzer();

// Global access for debugging
if (typeof window !== 'undefined') {
    (window as any).targetingAuthAnalyzer = targetingAuthAnalyzer;
}