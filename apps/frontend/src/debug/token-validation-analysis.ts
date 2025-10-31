/**
 * Token Validation Analysis Utility
 * 
 * This utility analyzes and documents differences in token validation between
 * swap endpoints and targeting endpoints to identify authentication inconsistencies.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

export interface TokenValidationResult {
    timestamp: Date;
    endpoint: string;
    endpointType: 'swap' | 'targeting' | 'other';
    token: {
        present: boolean;
        format: 'valid_jwt' | 'invalid_jwt' | 'malformed' | 'missing';
        length: number;
        header?: any;
        payload?: any;
        signature?: string;
    };
    validation: {
        success: boolean;
        errorType?: 'expired' | 'invalid_signature' | 'malformed' | 'missing_claims' | 'blacklisted' | 'unknown';
        errorMessage?: string;
        validationSteps: TokenValidationStep[];
    };
    serverResponse: {
        status: number;
        headers: Record<string, string>;
        body?: any;
        authenticationPassed: boolean;
    };
    timing: {
        requestStart: number;
        responseReceived: number;
        totalDuration: number;
    };
    context: {
        userId?: string;
        userAgent: string;
        requestId: string;
        hasOutgoingTargets?: boolean;
    };
}

export interface TokenValidationStep {
    step: 'format_check' | 'signature_verification' | 'expiry_check' | 'claims_validation' | 'blacklist_check' | 'user_lookup';
    success: boolean;
    duration: number;
    details?: any;
    errorMessage?: string;
}

export interface ValidationDifference {
    swapEndpoint: TokenValidationResult;
    targetingEndpoint: TokenValidationResult;
    differences: {
        validationOutcome: boolean; // true if different outcomes
        errorTypes: boolean; // true if different error types
        validationSteps: boolean; // true if different validation steps
        timing: boolean; // true if significant timing differences
    };
    analysis: {
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        potentialCause: string;
        impact: string;
        recommendation: string;
    };
}

class TokenValidationAnalyzer {
    private validationResults: TokenValidationResult[] = [];
    private validationDifferences: ValidationDifference[] = [];
    private isAnalyzing = false;

    /**
     * Start comprehensive token validation analysis
     */
    startAnalysis(): void {
        if (this.isAnalyzing) {
            console.warn('Token validation analysis already running');
            return;
        }

        this.isAnalyzing = true;
        console.log('🔍 Starting token validation analysis...');

        // Hook into all API requests to analyze token validation
        this.interceptApiRequests();

        console.log('✅ Token validation analysis started');
    }

    /**
     * Stop analysis and generate report
     */
    stopAnalysis(): TokenValidationAnalysisReport {
        if (!this.isAnalyzing) {
            console.warn('No token validation analysis running');
            return this.generateReport();
        }

        this.isAnalyzing = false;
        console.log('🛑 Stopping token validation analysis...');

        const report = this.generateReport();
        console.log('📊 Token validation analysis complete');

        return report;
    }

    /**
     * Intercept API requests to analyze token validation
     */
    private interceptApiRequests(): void {
        const originalFetch = window.fetch;

        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = typeof input === 'string' ? input : input.toString();
            const requestId = `token-val-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            const requestStart = performance.now();

            // Only analyze API requests
            if (!url.includes('/api/')) {
                return originalFetch(input, init);
            }

            const endpointType = this.classifyEndpoint(url);
            const token = this.extractToken(init);

            try {
                const response = await originalFetch(input, init);
                const responseReceived = performance.now();

                // Analyze token validation
                const validationResult = await this.analyzeTokenValidation(
                    url,
                    endpointType,
                    token,
                    response,
                    requestId,
                    requestStart,
                    responseReceived
                );

                this.validationResults.push(validationResult);

                // Check for validation differences if we have both swap and targeting results
                this.checkForValidationDifferences(validationResult);

                return response;
            } catch (error) {
                const responseReceived = performance.now();

                // Analyze failed request
                const validationResult = await this.analyzeFailedRequest(
                    url,
                    endpointType,
                    token,
                    error,
                    requestId,
                    requestStart,
                    responseReceived
                );

                this.validationResults.push(validationResult);

                throw error;
            }
        };
    }

    /**
     * Classify endpoint type
     */
    private classifyEndpoint(url: string): 'swap' | 'targeting' | 'other' {
        if (url.includes('/swaps') && !this.isTargetingEndpoint(url)) {
            return 'swap';
        }

        if (this.isTargetingEndpoint(url)) {
            return 'targeting';
        }

        return 'other';
    }

    /**
     * Check if endpoint is targeting-related
     */
    private isTargetingEndpoint(url: string): boolean {
        const targetingPatterns = [
            '/target',
            '/retarget',
            '/targeting-status',
            '/targeting-history',
            '/can-target',
            '/targeted-by',
            '/targeting-activity'
        ];

        return targetingPatterns.some(pattern => url.includes(pattern));
    }

    /**
     * Extract token from request
     */
    private extractToken(init?: RequestInit): string {
        const authHeader = init?.headers?.['Authorization'] ||
            (init?.headers as any)?.authorization ||
            '';

        if (authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        return localStorage.getItem('auth_token') || '';
    }

    /**
     * Analyze token validation for successful request
     */
    private async analyzeTokenValidation(
        url: string,
        endpointType: 'swap' | 'targeting' | 'other',
        token: string,
        response: Response,
        requestId: string,
        requestStart: number,
        responseReceived: number
    ): Promise<TokenValidationResult> {
        const tokenAnalysis = this.analyzeTokenStructure(token);
        const validationSteps = await this.simulateValidationSteps(token, response);

        return {
            timestamp: new Date(),
            endpoint: url,
            endpointType,
            token: tokenAnalysis,
            validation: {
                success: response.status >= 200 && response.status < 300,
                errorType: response.status >= 400 ? this.classifyValidationError(response.status) : undefined,
                errorMessage: await this.extractErrorMessage(response),
                validationSteps
            },
            serverResponse: {
                status: response.status,
                headers: this.extractHeaders(response.headers),
                body: await this.extractResponseBody(response),
                authenticationPassed: response.status !== 401 && response.status !== 403
            },
            timing: {
                requestStart,
                responseReceived,
                totalDuration: responseReceived - requestStart
            },
            context: {
                userId: this.getCurrentUserId(),
                userAgent: navigator.userAgent,
                requestId,
                hasOutgoingTargets: this.userHasOutgoingTargets()
            }
        };
    }

    /**
     * Analyze token validation for failed request
     */
    private async analyzeFailedRequest(
        url: string,
        endpointType: 'swap' | 'targeting' | 'other',
        token: string,
        error: any,
        requestId: string,
        requestStart: number,
        responseReceived: number
    ): Promise<TokenValidationResult> {
        const tokenAnalysis = this.analyzeTokenStructure(token);

        return {
            timestamp: new Date(),
            endpoint: url,
            endpointType,
            token: tokenAnalysis,
            validation: {
                success: false,
                errorType: 'unknown',
                errorMessage: error instanceof Error ? error.message : 'Network error',
                validationSteps: []
            },
            serverResponse: {
                status: 0,
                headers: {},
                authenticationPassed: false
            },
            timing: {
                requestStart,
                responseReceived,
                totalDuration: responseReceived - requestStart
            },
            context: {
                userId: this.getCurrentUserId(),
                userAgent: navigator.userAgent,
                requestId
            }
        };
    }

    /**
     * Analyze token structure
     */
    private analyzeTokenStructure(token: string): {
        present: boolean;
        format: 'valid_jwt' | 'invalid_jwt' | 'malformed' | 'missing';
        length: number;
        header?: any;
        payload?: any;
        signature?: string;
    } {
        if (!token) {
            return {
                present: false,
                format: 'missing',
                length: 0
            };
        }

        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                return {
                    present: true,
                    format: 'malformed',
                    length: token.length
                };
            }

            const header = JSON.parse(atob(parts[0]));
            const payload = JSON.parse(atob(parts[1]));
            const signature = parts[2];

            return {
                present: true,
                format: 'valid_jwt',
                length: token.length,
                header,
                payload,
                signature
            };
        } catch (error) {
            return {
                present: true,
                format: 'invalid_jwt',
                length: token.length
            };
        }
    }

    /**
     * Simulate validation steps based on response
     */
    private async simulateValidationSteps(token: string, response: Response): Promise<TokenValidationStep[]> {
        const steps: TokenValidationStep[] = [];
        const stepStart = performance.now();

        // Format check
        const formatCheck: TokenValidationStep = {
            step: 'format_check',
            success: token.split('.').length === 3,
            duration: performance.now() - stepStart
        };
        steps.push(formatCheck);

        if (!formatCheck.success) {
            return steps;
        }

        // Signature verification (simulated based on response)
        const signatureCheck: TokenValidationStep = {
            step: 'signature_verification',
            success: response.status !== 401 || !response.headers.get('www-authenticate')?.includes('invalid_token'),
            duration: 1 // Simulated
        };
        steps.push(signatureCheck);

        // Expiry check
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const now = Math.floor(Date.now() / 1000);
            const expiryCheck: TokenValidationStep = {
                step: 'expiry_check',
                success: !payload.exp || payload.exp > now,
                duration: 0.5, // Simulated
                details: {
                    exp: payload.exp,
                    now,
                    expired: payload.exp && payload.exp <= now
                }
            };
            steps.push(expiryCheck);

            // Claims validation
            const claimsCheck: TokenValidationStep = {
                step: 'claims_validation',
                success: !!(payload.userId && payload.exp),
                duration: 0.5, // Simulated
                details: {
                    hasUserId: !!payload.userId,
                    hasExp: !!payload.exp,
                    hasJti: !!payload.jti
                }
            };
            steps.push(claimsCheck);
        } catch (error) {
            // Token payload couldn't be parsed
        }

        // User lookup (simulated based on response)
        if (response.status !== 404) {
            const userLookup: TokenValidationStep = {
                step: 'user_lookup',
                success: response.status !== 401 || !response.headers.get('www-authenticate')?.includes('user_not_found'),
                duration: 2 // Simulated database lookup time
            };
            steps.push(userLookup);
        }

        return steps;
    }

    /**
     * Classify validation error based on status code
     */
    private classifyValidationError(status: number): 'expired' | 'invalid_signature' | 'malformed' | 'missing_claims' | 'blacklisted' | 'unknown' {
        switch (status) {
            case 401:
                return 'invalid_signature';
            case 403:
                return 'blacklisted';
            default:
                return 'unknown';
        }
    }

    /**
     * Check for validation differences between endpoints
     */
    private checkForValidationDifferences(newResult: TokenValidationResult): void {
        if (newResult.endpointType === 'other') return;

        // Find corresponding result from the other endpoint type
        const otherEndpointType = newResult.endpointType === 'swap' ? 'targeting' : 'swap';
        const correspondingResult = this.findCorrespondingResult(newResult, otherEndpointType);

        if (correspondingResult) {
            const difference = this.analyzeValidationDifference(newResult, correspondingResult);
            if (difference) {
                this.validationDifferences.push(difference);
                console.warn('🚨 Token validation difference detected:', difference);
            }
        }
    }

    /**
     * Find corresponding validation result from different endpoint type
     */
    private findCorrespondingResult(
        result: TokenValidationResult,
        targetEndpointType: 'swap' | 'targeting'
    ): TokenValidationResult | null {
        // Look for recent results from the target endpoint type with same token
        const timeWindow = 30000; // 30 seconds
        const cutoff = result.timestamp.getTime() - timeWindow;

        return this.validationResults
            .filter(r =>
                r.endpointType === targetEndpointType &&
                r.timestamp.getTime() > cutoff &&
                r.token.signature === result.token.signature
            )
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0] || null;
    }

    /**
     * Analyze validation difference between two results
     */
    private analyzeValidationDifference(
        result1: TokenValidationResult,
        result2: TokenValidationResult
    ): ValidationDifference | null {
        const swapResult = result1.endpointType === 'swap' ? result1 : result2;
        const targetingResult = result1.endpointType === 'targeting' ? result1 : result2;

        const differences = {
            validationOutcome: swapResult.validation.success !== targetingResult.validation.success,
            errorTypes: swapResult.validation.errorType !== targetingResult.validation.errorType,
            validationSteps: this.compareValidationSteps(swapResult.validation.validationSteps, targetingResult.validation.validationSteps),
            timing: Math.abs(swapResult.timing.totalDuration - targetingResult.timing.totalDuration) > 100 // 100ms threshold
        };

        // Only create difference if there are actual differences
        if (!differences.validationOutcome && !differences.errorTypes && !differences.validationSteps && !differences.timing) {
            return null;
        }

        return {
            swapEndpoint: swapResult,
            targetingEndpoint: targetingResult,
            differences,
            analysis: this.analyzeValidationDifferenceImpact(swapResult, targetingResult, differences)
        };
    }

    /**
     * Compare validation steps between two results
     */
    private compareValidationSteps(steps1: TokenValidationStep[], steps2: TokenValidationStep[]): boolean {
        if (steps1.length !== steps2.length) return true;

        for (let i = 0; i < steps1.length; i++) {
            if (steps1[i].step !== steps2[i].step || steps1[i].success !== steps2[i].success) {
                return true;
            }
        }

        return false;
    }

    /**
     * Analyze the impact of validation differences
     */
    private analyzeValidationDifferenceImpact(
        swapResult: TokenValidationResult,
        targetingResult: TokenValidationResult,
        differences: any
    ): {
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        potentialCause: string;
        impact: string;
        recommendation: string;
    } {
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
        let description = '';
        let potentialCause = '';
        let impact = '';
        let recommendation = '';

        if (differences.validationOutcome) {
            severity = 'critical';
            description = `Token validation outcome differs: swap endpoint ${swapResult.validation.success ? 'accepts' : 'rejects'} token while targeting endpoint ${targetingResult.validation.success ? 'accepts' : 'rejects'} the same token`;

            if (swapResult.validation.success && !targetingResult.validation.success) {
                potentialCause = 'Targeting endpoints have stricter or different token validation logic';
                impact = 'Users with valid tokens are incorrectly rejected by targeting operations, causing unexpected logouts';
                recommendation = 'Align targeting endpoint authentication with swap endpoint authentication logic';
            } else {
                potentialCause = 'Swap endpoints have stricter or different token validation logic';
                impact = 'Inconsistent authentication behavior across the application';
                recommendation = 'Standardize token validation logic across all endpoints';
            }
        } else if (differences.errorTypes) {
            severity = 'high';
            description = `Different error types: swap endpoint reports "${swapResult.validation.errorType}" while targeting endpoint reports "${targetingResult.validation.errorType}"`;
            potentialCause = 'Different error handling or validation logic between endpoint types';
            impact = 'Inconsistent error reporting makes debugging authentication issues difficult';
            recommendation = 'Standardize error classification and reporting across all endpoints';
        } else if (differences.validationSteps) {
            severity = 'medium';
            description = 'Token validation steps differ between swap and targeting endpoints';
            potentialCause = 'Different authentication middleware or validation sequences';
            impact = 'Potential for subtle authentication inconsistencies';
            recommendation = 'Use consistent authentication middleware across all endpoints';
        } else if (differences.timing) {
            severity = 'low';
            description = `Significant timing difference: swap endpoint took ${swapResult.timing.totalDuration}ms while targeting endpoint took ${targetingResult.timing.totalDuration}ms`;
            potentialCause = 'Different validation complexity or database queries';
            impact = 'Performance inconsistency in authentication';
            recommendation = 'Optimize slower authentication path';
        }

        return { severity, description, potentialCause, impact, recommendation };
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

    private userHasOutgoingTargets(): boolean {
        // This would need to be implemented based on the current user's targeting state
        try {
            const userData = localStorage.getItem('auth_user');
            if (userData) {
                const user = JSON.parse(userData);
                return !!(user.targetingActivity || user.outgoingTargets);
            }
        } catch (error) {
            console.warn('Failed to check user targeting status:', error);
        }
        return false;
    }

    private extractHeaders(headers: Headers): Record<string, string> {
        const result: Record<string, string> = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    private async extractErrorMessage(response: Response): Promise<string | undefined> {
        try {
            const clone = response.clone();
            const body = await clone.json();
            return body?.error?.message || body?.message;
        } catch (error) {
            return undefined;
        }
    }

    private async extractResponseBody(response: Response): Promise<any> {
        try {
            const clone = response.clone();
            return await clone.json();
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Generate comprehensive analysis report
     */
    private generateReport(): TokenValidationAnalysisReport {
        const swapResults = this.validationResults.filter(r => r.endpointType === 'swap');
        const targetingResults = this.validationResults.filter(r => r.endpointType === 'targeting');

        return {
            analysisStarted: new Date(),
            analysisCompleted: new Date(),
            totalValidations: this.validationResults.length,
            swapEndpointValidations: swapResults.length,
            targetingEndpointValidations: targetingResults.length,
            validationDifferences: this.validationDifferences,
            summary: {
                criticalDifferences: this.validationDifferences.filter(d => d.analysis.severity === 'critical').length,
                highPriorityDifferences: this.validationDifferences.filter(d => d.analysis.severity === 'high').length,
                swapEndpointSuccessRate: this.calculateSuccessRate(swapResults),
                targetingEndpointSuccessRate: this.calculateSuccessRate(targetingResults),
                mostCommonValidationError: this.getMostCommonError(this.validationResults),
                averageValidationTime: this.getAverageValidationTime(this.validationResults)
            },
            recommendations: this.generateRecommendations()
        };
    }

    private calculateSuccessRate(results: TokenValidationResult[]): number {
        if (results.length === 0) return 0;
        const successful = results.filter(r => r.validation.success).length;
        return (successful / results.length) * 100;
    }

    private getMostCommonError(results: TokenValidationResult[]): string {
        const errorCounts: Record<string, number> = {};
        results.forEach(r => {
            if (r.validation.errorType) {
                errorCounts[r.validation.errorType] = (errorCounts[r.validation.errorType] || 0) + 1;
            }
        });

        return Object.entries(errorCounts)
            .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none';
    }

    private getAverageValidationTime(results: TokenValidationResult[]): number {
        if (results.length === 0) return 0;
        const totalTime = results.reduce((sum, r) => sum + r.timing.totalDuration, 0);
        return totalTime / results.length;
    }

    private generateRecommendations(): string[] {
        const recommendations = [
            'Implement consistent token validation logic across all API endpoints',
            'Use the same authentication middleware for both swap and targeting endpoints',
            'Add comprehensive logging for token validation steps',
            'Implement token validation error classification system',
            'Create authentication integration tests to catch validation inconsistencies'
        ];

        if (this.validationDifferences.some(d => d.analysis.severity === 'critical')) {
            recommendations.unshift('URGENT: Fix critical token validation differences that cause user logout issues');
        }

        return recommendations;
    }
}

export interface TokenValidationAnalysisReport {
    analysisStarted: Date;
    analysisCompleted: Date;
    totalValidations: number;
    swapEndpointValidations: number;
    targetingEndpointValidations: number;
    validationDifferences: ValidationDifference[];
    summary: {
        criticalDifferences: number;
        highPriorityDifferences: number;
        swapEndpointSuccessRate: number;
        targetingEndpointSuccessRate: number;
        mostCommonValidationError: string;
        averageValidationTime: number;
    };
    recommendations: string[];
}

// Export singleton instance
export const tokenValidationAnalyzer = new TokenValidationAnalyzer();

// Global access for debugging
if (typeof window !== 'undefined') {
    (window as any).tokenValidationAnalyzer = tokenValidationAnalyzer;
}