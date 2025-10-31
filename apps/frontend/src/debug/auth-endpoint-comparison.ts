/**
 * Authentication Endpoint Comparison Utility
 * 
 * This utility compares authentication behavior between swap endpoints and targeting endpoints
 * to identify differences in token validation logic.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

export interface EndpointAuthComparison {
    timestamp: Date;
    userId: string;
    token: string;
    swapEndpointResult: EndpointAuthResult;
    targetingEndpointResult: EndpointAuthResult;
    comparisonResult: {
        consistent: boolean;
        differences: string[];
        potentialIssues: string[];
    };
}

export interface EndpointAuthResult {
    endpoint: string;
    method: string;
    requestHeaders: Record<string, string>;
    responseStatus: number;
    responseHeaders: Record<string, string>;
    responseBody?: any;
    duration: number;
    authenticationSuccess: boolean;
    errorType?: string;
    errorMessage?: string;
    tokenValidationDetails?: {
        tokenPresent: boolean;
        tokenFormat: 'valid' | 'invalid' | 'missing';
        tokenExpiry?: Date;
        tokenClaims?: any;
    };
}

class AuthEndpointComparator {
    private comparisons: EndpointAuthComparison[] = [];

    /**
     * Compare authentication behavior between swap and targeting endpoints
     */
    async compareEndpointAuthentication(userId: string): Promise<EndpointAuthComparison> {
        const token = localStorage.getItem('auth_token') || '';
        const timestamp = new Date();

        console.log('🔍 Starting endpoint authentication comparison for user:', userId);

        // Test swap endpoint authentication
        const swapResult = await this.testSwapEndpointAuth(userId, token);

        // Test targeting endpoint authentication
        const targetingResult = await this.testTargetingEndpointAuth(userId, token);

        // Compare results
        const comparison: EndpointAuthComparison = {
            timestamp,
            userId,
            token: token.substring(0, 20) + '...', // Truncate for security
            swapEndpointResult: swapResult,
            targetingEndpointResult: targetingResult,
            comparisonResult: this.analyzeComparison(swapResult, targetingResult)
        };

        this.comparisons.push(comparison);

        console.log('📊 Endpoint authentication comparison completed:', comparison);

        return comparison;
    }

    /**
     * Test authentication on swap endpoints
     */
    private async testSwapEndpointAuth(userId: string, token: string): Promise<EndpointAuthResult> {
        const endpoint = `/api/swaps?userId=${userId}`;
        const startTime = Date.now();

        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const duration = Date.now() - startTime;
            const responseBody = await response.json().catch(() => null);

            return {
                endpoint,
                method: 'GET',
                requestHeaders: {
                    'Authorization': `Bearer ${token.substring(0, 20)}...`,
                    'Content-Type': 'application/json'
                },
                responseStatus: response.status,
                responseHeaders: this.extractHeaders(response.headers),
                responseBody,
                duration,
                authenticationSuccess: response.status >= 200 && response.status < 300,
                errorType: response.status >= 400 ? this.classifyErrorType(response.status) : undefined,
                errorMessage: responseBody?.error?.message || responseBody?.message,
                tokenValidationDetails: this.analyzeTokenValidation(token, response.status, responseBody)
            };
        } catch (error) {
            const duration = Date.now() - startTime;

            return {
                endpoint,
                method: 'GET',
                requestHeaders: {
                    'Authorization': `Bearer ${token.substring(0, 20)}...`,
                    'Content-Type': 'application/json'
                },
                responseStatus: 0,
                responseHeaders: {},
                duration,
                authenticationSuccess: false,
                errorType: 'network_error',
                errorMessage: error instanceof Error ? error.message : 'Network error',
                tokenValidationDetails: this.analyzeTokenValidation(token, 0, null)
            };
        }
    }

    /**
     * Test authentication on targeting endpoints
     */
    private async testTargetingEndpointAuth(userId: string, token: string): Promise<EndpointAuthResult> {
        const endpoint = `/api/users/${userId}/targeting-activity`;
        const startTime = Date.now();

        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const duration = Date.now() - startTime;
            const responseBody = await response.json().catch(() => null);

            return {
                endpoint,
                method: 'GET',
                requestHeaders: {
                    'Authorization': `Bearer ${token.substring(0, 20)}...`,
                    'Content-Type': 'application/json'
                },
                responseStatus: response.status,
                responseHeaders: this.extractHeaders(response.headers),
                responseBody,
                duration,
                authenticationSuccess: response.status >= 200 && response.status < 300,
                errorType: response.status >= 400 ? this.classifyErrorType(response.status) : undefined,
                errorMessage: responseBody?.error?.message || responseBody?.message,
                tokenValidationDetails: this.analyzeTokenValidation(token, response.status, responseBody)
            };
        } catch (error) {
            const duration = Date.now() - startTime;

            return {
                endpoint,
                method: 'GET',
                requestHeaders: {
                    'Authorization': `Bearer ${token.substring(0, 20)}...`,
                    'Content-Type': 'application/json'
                },
                responseStatus: 0,
                responseHeaders: {},
                duration,
                authenticationSuccess: false,
                errorType: 'network_error',
                errorMessage: error instanceof Error ? error.message : 'Network error',
                tokenValidationDetails: this.analyzeTokenValidation(token, 0, null)
            };
        }
    }

    /**
     * Analyze token validation details
     */
    private analyzeTokenValidation(token: string, responseStatus: number, responseBody: any): {
        tokenPresent: boolean;
        tokenFormat: 'valid' | 'invalid' | 'missing';
        tokenExpiry?: Date;
        tokenClaims?: any;
    } {
        if (!token) {
            return {
                tokenPresent: false,
                tokenFormat: 'missing'
            };
        }

        try {
            // Decode JWT token to analyze claims
            const parts = token.split('.');
            if (parts.length !== 3) {
                return {
                    tokenPresent: true,
                    tokenFormat: 'invalid'
                };
            }

            const payload = JSON.parse(atob(parts[1]));
            const expiry = payload.exp ? new Date(payload.exp * 1000) : undefined;

            return {
                tokenPresent: true,
                tokenFormat: 'valid',
                tokenExpiry: expiry,
                tokenClaims: {
                    userId: payload.userId,
                    email: payload.email,
                    username: payload.username,
                    iat: payload.iat,
                    exp: payload.exp,
                    jti: payload.jti
                }
            };
        } catch (error) {
            return {
                tokenPresent: true,
                tokenFormat: 'invalid'
            };
        }
    }

    /**
     * Analyze comparison between swap and targeting endpoint results
     */
    private analyzeComparison(swapResult: EndpointAuthResult, targetingResult: EndpointAuthResult): {
        consistent: boolean;
        differences: string[];
        potentialIssues: string[];
    } {
        const differences: string[] = [];
        const potentialIssues: string[] = [];

        // Compare authentication success
        if (swapResult.authenticationSuccess !== targetingResult.authenticationSuccess) {
            differences.push(`Authentication success differs: swap=${swapResult.authenticationSuccess}, targeting=${targetingResult.authenticationSuccess}`);

            if (swapResult.authenticationSuccess && !targetingResult.authenticationSuccess) {
                potentialIssues.push('Targeting endpoint rejects valid token that swap endpoint accepts');
            } else if (!swapResult.authenticationSuccess && targetingResult.authenticationSuccess) {
                potentialIssues.push('Swap endpoint rejects valid token that targeting endpoint accepts');
            }
        }

        // Compare response status codes
        if (swapResult.responseStatus !== targetingResult.responseStatus) {
            differences.push(`Response status differs: swap=${swapResult.responseStatus}, targeting=${targetingResult.responseStatus}`);

            if (swapResult.responseStatus === 200 && targetingResult.responseStatus === 401) {
                potentialIssues.push('Targeting endpoint has stricter authentication validation');
            } else if (swapResult.responseStatus === 401 && targetingResult.responseStatus === 200) {
                potentialIssues.push('Swap endpoint has stricter authentication validation');
            }
        }

        // Compare error types
        if (swapResult.errorType !== targetingResult.errorType) {
            differences.push(`Error type differs: swap=${swapResult.errorType || 'none'}, targeting=${targetingResult.errorType || 'none'}`);
        }

        // Compare error messages
        if (swapResult.errorMessage !== targetingResult.errorMessage) {
            differences.push(`Error message differs: swap="${swapResult.errorMessage || 'none'}", targeting="${targetingResult.errorMessage || 'none'}"`);
        }

        // Compare response headers for authentication-related headers
        const swapAuthHeaders = this.extractAuthHeaders(swapResult.responseHeaders);
        const targetingAuthHeaders = this.extractAuthHeaders(targetingResult.responseHeaders);

        if (JSON.stringify(swapAuthHeaders) !== JSON.stringify(targetingAuthHeaders)) {
            differences.push('Authentication-related response headers differ');
            potentialIssues.push('Different authentication middleware or configuration between endpoints');
        }

        // Check for token validation inconsistencies
        const swapTokenValid = swapResult.tokenValidationDetails?.tokenFormat === 'valid';
        const targetingTokenValid = targetingResult.tokenValidationDetails?.tokenFormat === 'valid';

        if (swapTokenValid && targetingTokenValid && swapResult.authenticationSuccess !== targetingResult.authenticationSuccess) {
            potentialIssues.push('Token validation logic differs between endpoints despite valid token format');
        }

        return {
            consistent: differences.length === 0,
            differences,
            potentialIssues
        };
    }

    /**
     * Extract authentication-related headers
     */
    private extractAuthHeaders(headers: Record<string, string>): Record<string, string> {
        const authHeaders: Record<string, string> = {};

        Object.entries(headers).forEach(([key, value]) => {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('auth') || lowerKey.includes('token') || lowerKey === 'www-authenticate') {
                authHeaders[key] = value;
            }
        });

        return authHeaders;
    }

    /**
     * Extract headers from Response object
     */
    private extractHeaders(headers: Headers): Record<string, string> {
        const result: Record<string, string> = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    /**
     * Classify error type based on status code
     */
    private classifyErrorType(status: number): string {
        if (status === 401) return 'authentication_error';
        if (status === 403) return 'authorization_error';
        if (status === 404) return 'not_found_error';
        if (status >= 500) return 'server_error';
        if (status >= 400) return 'client_error';
        return 'unknown_error';
    }

    /**
     * Run comprehensive endpoint comparison test
     */
    async runComprehensiveComparison(userId: string): Promise<{
        comparisons: EndpointAuthComparison[];
        summary: {
            totalTests: number;
            consistentResults: number;
            inconsistentResults: number;
            criticalIssues: string[];
            recommendations: string[];
        };
    }> {
        console.log('🚀 Starting comprehensive endpoint authentication comparison...');

        const comparisons: EndpointAuthComparison[] = [];

        // Test multiple scenarios
        const scenarios = [
            'normal_token',
            'expired_token_simulation',
            'malformed_token_simulation',
            'missing_token_simulation'
        ];

        for (const scenario of scenarios) {
            console.log(`🧪 Testing scenario: ${scenario}`);

            try {
                const comparison = await this.testScenario(userId, scenario);
                comparisons.push(comparison);
            } catch (error) {
                console.error(`❌ Failed to test scenario ${scenario}:`, error);
            }
        }

        const summary = this.generateComparisonSummary(comparisons);

        console.log('✅ Comprehensive endpoint authentication comparison completed');
        console.log('📊 Summary:', summary);

        return { comparisons, summary };
    }

    /**
     * Test specific authentication scenario
     */
    private async testScenario(userId: string, scenario: string): Promise<EndpointAuthComparison> {
        let token = localStorage.getItem('auth_token') || '';

        // Modify token based on scenario
        switch (scenario) {
            case 'expired_token_simulation':
                // Create a token with expired timestamp (this is just for testing)
                token = this.createExpiredTokenSimulation(token);
                break;
            case 'malformed_token_simulation':
                token = 'malformed.token.here';
                break;
            case 'missing_token_simulation':
                token = '';
                break;
            default:
                // Use normal token
                break;
        }

        return this.compareEndpointAuthentication(userId);
    }

    /**
     * Create expired token simulation (for testing purposes)
     */
    private createExpiredTokenSimulation(originalToken: string): string {
        try {
            const parts = originalToken.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                // Set expiry to past date
                payload.exp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
                parts[1] = btoa(JSON.stringify(payload));
                return parts.join('.');
            }
        } catch (error) {
            console.warn('Failed to create expired token simulation:', error);
        }
        return originalToken;
    }

    /**
     * Generate comparison summary
     */
    private generateComparisonSummary(comparisons: EndpointAuthComparison[]): {
        totalTests: number;
        consistentResults: number;
        inconsistentResults: number;
        criticalIssues: string[];
        recommendations: string[];
    } {
        const totalTests = comparisons.length;
        const consistentResults = comparisons.filter(c => c.comparisonResult.consistent).length;
        const inconsistentResults = totalTests - consistentResults;

        const criticalIssues: string[] = [];
        const recommendations: string[] = [];

        // Analyze critical issues
        comparisons.forEach(comparison => {
            comparison.comparisonResult.potentialIssues.forEach(issue => {
                if (!criticalIssues.includes(issue)) {
                    criticalIssues.push(issue);
                }
            });
        });

        // Generate recommendations
        if (inconsistentResults > 0) {
            recommendations.push('Implement consistent authentication middleware across all endpoints');
        }

        if (criticalIssues.some(issue => issue.includes('stricter authentication'))) {
            recommendations.push('Align authentication validation logic between swap and targeting endpoints');
        }

        if (criticalIssues.some(issue => issue.includes('rejects valid token'))) {
            recommendations.push('Fix false positive authentication failures in targeting endpoints');
        }

        recommendations.push('Add comprehensive authentication logging to identify validation differences');
        recommendations.push('Implement authentication error classification to distinguish endpoint-specific issues');

        return {
            totalTests,
            consistentResults,
            inconsistentResults,
            criticalIssues,
            recommendations
        };
    }

    /**
     * Get all comparisons
     */
    getComparisons(): EndpointAuthComparison[] {
        return [...this.comparisons];
    }

    /**
     * Clear comparison history
     */
    clearComparisons(): void {
        this.comparisons = [];
    }

    /**
     * Export comparison data for analysis
     */
    exportComparisonData(): string {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            comparisons: this.comparisons,
            summary: this.generateComparisonSummary(this.comparisons)
        }, null, 2);
    }
}

// Export singleton instance
export const authEndpointComparator = new AuthEndpointComparator();

// Global access for debugging
if (typeof window !== 'undefined') {
    (window as any).authEndpointComparator = authEndpointComparator;
}