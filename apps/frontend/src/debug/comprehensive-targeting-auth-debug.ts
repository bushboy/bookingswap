/**
 * Comprehensive Targeting Authentication Debug Utility
 * 
 * This is the main debugging script that integrates all targeting authentication analysis tools
 * to provide a complete picture of authentication issues for users with outgoing targets.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { targetingAuthAnalyzer, TargetingAuthenticationAnalysisReport } from './targeting-auth-analysis';
import { authEndpointComparator, EndpointAuthComparison } from './auth-endpoint-comparison';
import { tokenValidationAnalyzer, TokenValidationAnalysisReport } from './token-validation-analysis';

export interface ComprehensiveAuthDebugReport {
    timestamp: Date;
    userId: string;
    userHasOutgoingTargets: boolean;
    analysisResults: {
        targetingAuthAnalysis: TargetingAuthenticationAnalysisReport;
        endpointComparison: {
            comparisons: EndpointAuthComparison[];
            summary: any;
        };
        tokenValidationAnalysis: TokenValidationAnalysisReport;
    };
    criticalFindings: CriticalFinding[];
    recommendations: string[];
    reproductionSteps: string[];
    debugCommands: string[];
}

export interface CriticalFinding {
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'authentication_failure' | 'token_validation_inconsistency' | 'endpoint_mismatch' | 'user_experience';
    title: string;
    description: string;
    evidence: any[];
    impact: string;
    recommendation: string;
}

class ComprehensiveTargetingAuthDebugger {
    private isDebugging = false;
    private debugSession: {
        startTime: Date;
        userId: string;
        sessionId: string;
    } | null = null;

    /**
     * Start comprehensive debugging session
     */
    async startDebugSession(userId?: string): Promise<string> {
        if (this.isDebugging) {
            console.warn('Debug session already running');
            return this.debugSession?.sessionId || '';
        }

        const sessionId = `debug-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const currentUserId = userId || this.getCurrentUserId();

        this.debugSession = {
            startTime: new Date(),
            userId: currentUserId,
            sessionId
        };

        this.isDebugging = true;

        console.log('🚀 Starting comprehensive targeting authentication debug session:', {
            sessionId,
            userId: currentUserId,
            timestamp: new Date().toISOString()
        });

        // Start all analysis tools
        targetingAuthAnalyzer.startAnalysis();
        tokenValidationAnalyzer.startAnalysis();

        // Log initial state
        this.logInitialState(currentUserId);

        return sessionId;
    }

    /**
     * Stop debugging session and generate comprehensive report
     */
    async stopDebugSession(): Promise<ComprehensiveAuthDebugReport> {
        if (!this.isDebugging || !this.debugSession) {
            console.warn('No debug session running');
            return this.generateEmptyReport();
        }

        console.log('🛑 Stopping comprehensive debug session:', this.debugSession.sessionId);

        // Stop all analysis tools and collect reports
        const targetingAuthReport = targetingAuthAnalyzer.stopAnalysis();
        const tokenValidationReport = tokenValidationAnalyzer.stopAnalysis();

        // Run endpoint comparison
        const endpointComparison = await authEndpointComparator.runComprehensiveComparison(this.debugSession.userId);

        // Generate comprehensive report
        const report = await this.generateComprehensiveReport(
            targetingAuthReport,
            endpointComparison,
            tokenValidationReport
        );

        this.isDebugging = false;
        this.debugSession = null;

        console.log('✅ Comprehensive debug session completed');
        console.log('📊 Debug Report:', report);

        return report;
    }

    /**
     * Quick debug check for immediate issues
     */
    async quickDebugCheck(userId?: string): Promise<{
        hasIssues: boolean;
        immediateIssues: string[];
        quickFixes: string[];
        needsFullAnalysis: boolean;
    }> {
        const currentUserId = userId || this.getCurrentUserId();

        console.log('⚡ Running quick debug check for user:', currentUserId);

        const issues: string[] = [];
        const quickFixes: string[] = [];

        // Check authentication state
        const authState = this.checkAuthenticationState();
        if (!authState.isValid) {
            issues.push(`Authentication state invalid: ${authState.reason}`);
            quickFixes.push('Re-authenticate user');
        }

        // Check token validity
        const tokenState = this.checkTokenState();
        if (!tokenState.isValid) {
            issues.push(`Token state invalid: ${tokenState.reason}`);
            quickFixes.push('Refresh authentication token');
        }

        // Check for targeting-specific issues
        const targetingState = await this.checkTargetingState(currentUserId);
        if (targetingState.hasIssues) {
            issues.push(...targetingState.issues);
            quickFixes.push(...targetingState.quickFixes);
        }

        // Quick endpoint test
        const endpointTest = await this.quickEndpointTest(currentUserId);
        if (!endpointTest.consistent) {
            issues.push('Endpoint authentication inconsistency detected');
            quickFixes.push('Run full endpoint comparison analysis');
        }

        return {
            hasIssues: issues.length > 0,
            immediateIssues: issues,
            quickFixes,
            needsFullAnalysis: issues.length > 2 || endpointTest.criticalIssue
        };
    }

    /**
     * Test specific targeting authentication scenario
     */
    async testTargetingScenario(scenario: 'user_with_outgoing_targets' | 'targeting_data_load' | 'targeting_operation'): Promise<{
        success: boolean;
        issues: string[];
        evidence: any[];
        recommendation: string;
    }> {
        console.log(`🧪 Testing targeting authentication scenario: ${scenario}`);

        const evidence: any[] = [];
        const issues: string[] = [];
        let recommendation = '';

        switch (scenario) {
            case 'user_with_outgoing_targets':
                return await this.testUserWithOutgoingTargets(evidence, issues);

            case 'targeting_data_load':
                return await this.testTargetingDataLoad(evidence, issues);

            case 'targeting_operation':
                return await this.testTargetingOperation(evidence, issues);

            default:
                return {
                    success: false,
                    issues: ['Unknown scenario'],
                    evidence: [],
                    recommendation: 'Use a valid scenario name'
                };
        }
    }

    /**
     * Log initial authentication state
     */
    private logInitialState(userId: string): void {
        const authState = this.checkAuthenticationState();
        const tokenState = this.checkTokenState();
        const userState = this.checkUserState(userId);

        console.log('📋 Initial Debug State:', {
            timestamp: new Date().toISOString(),
            userId,
            authentication: authState,
            token: tokenState,
            user: userState,
            browser: {
                userAgent: navigator.userAgent,
                localStorage: {
                    hasAuthToken: !!localStorage.getItem('auth_token'),
                    hasAuthUser: !!localStorage.getItem('auth_user'),
                    tokenLength: localStorage.getItem('auth_token')?.length || 0
                }
            }
        });
    }

    /**
     * Check authentication state
     */
    private checkAuthenticationState(): {
        isValid: boolean;
        reason?: string;
        details: any;
    } {
        const token = localStorage.getItem('auth_token');
        const user = localStorage.getItem('auth_user');

        if (!token) {
            return {
                isValid: false,
                reason: 'No authentication token found',
                details: { hasToken: false, hasUser: !!user }
            };
        }

        if (!user) {
            return {
                isValid: false,
                reason: 'No user data found',
                details: { hasToken: true, hasUser: false }
            };
        }

        try {
            const userData = JSON.parse(user);
            if (!userData.id) {
                return {
                    isValid: false,
                    reason: 'User data missing ID',
                    details: { hasToken: true, hasUser: true, userData }
                };
            }

            return {
                isValid: true,
                details: { hasToken: true, hasUser: true, userId: userData.id }
            };
        } catch (error) {
            return {
                isValid: false,
                reason: 'Invalid user data format',
                details: { hasToken: true, hasUser: true, parseError: error }
            };
        }
    }

    /**
     * Check token state
     */
    private checkTokenState(): {
        isValid: boolean;
        reason?: string;
        details: any;
    } {
        const token = localStorage.getItem('auth_token');

        if (!token) {
            return {
                isValid: false,
                reason: 'Token not found',
                details: { present: false }
            };
        }

        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                return {
                    isValid: false,
                    reason: 'Invalid JWT format',
                    details: { present: true, format: 'invalid', parts: parts.length }
                };
            }

            const payload = JSON.parse(atob(parts[1]));
            const now = Math.floor(Date.now() / 1000);
            const isExpired = payload.exp && payload.exp <= now;

            if (isExpired) {
                return {
                    isValid: false,
                    reason: 'Token expired',
                    details: {
                        present: true,
                        format: 'valid',
                        expired: true,
                        exp: payload.exp,
                        now,
                        expiredBy: now - payload.exp
                    }
                };
            }

            return {
                isValid: true,
                details: {
                    present: true,
                    format: 'valid',
                    expired: false,
                    payload: {
                        userId: payload.userId,
                        email: payload.email,
                        exp: payload.exp,
                        iat: payload.iat
                    }
                }
            };
        } catch (error) {
            return {
                isValid: false,
                reason: 'Token parsing failed',
                details: { present: true, format: 'malformed', error }
            };
        }
    }

    /**
     * Check user state
     */
    private checkUserState(userId: string): {
        hasOutgoingTargets: boolean;
        targetingActivity: any;
        details: any;
    } {
        try {
            const userData = localStorage.getItem('auth_user');
            if (userData) {
                const user = JSON.parse(userData);
                return {
                    hasOutgoingTargets: !!(user.targetingActivity || user.outgoingTargets),
                    targetingActivity: user.targetingActivity || null,
                    details: {
                        id: user.id,
                        email: user.email,
                        username: user.username,
                        verificationLevel: user.verificationLevel
                    }
                };
            }
        } catch (error) {
            console.warn('Failed to check user state:', error);
        }

        return {
            hasOutgoingTargets: false,
            targetingActivity: null,
            details: { error: 'Could not parse user data' }
        };
    }

    /**
     * Check targeting-specific state
     */
    private async checkTargetingState(userId: string): Promise<{
        hasIssues: boolean;
        issues: string[];
        quickFixes: string[];
    }> {
        const issues: string[] = [];
        const quickFixes: string[] = [];

        try {
            // Test targeting endpoint accessibility
            const response = await fetch(`/api/users/${userId}/targeting-activity`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                issues.push('Targeting endpoint rejects authentication');
                quickFixes.push('Check targeting endpoint authentication middleware');
            } else if (response.status === 403) {
                issues.push('Targeting endpoint denies access');
                quickFixes.push('Check user permissions for targeting operations');
            } else if (!response.ok) {
                issues.push(`Targeting endpoint error: ${response.status}`);
                quickFixes.push('Check targeting endpoint server logs');
            }
        } catch (error) {
            issues.push('Cannot reach targeting endpoints');
            quickFixes.push('Check network connectivity and API server status');
        }

        return {
            hasIssues: issues.length > 0,
            issues,
            quickFixes
        };
    }

    /**
     * Quick endpoint consistency test
     */
    private async quickEndpointTest(userId: string): Promise<{
        consistent: boolean;
        criticalIssue: boolean;
        details: any;
    }> {
        try {
            const comparison = await authEndpointComparator.compareEndpointAuthentication(userId);

            return {
                consistent: comparison.comparisonResult.consistent,
                criticalIssue: comparison.comparisonResult.potentialIssues.some(issue =>
                    issue.includes('rejects valid token')
                ),
                details: comparison.comparisonResult
            };
        } catch (error) {
            return {
                consistent: false,
                criticalIssue: true,
                details: { error: error instanceof Error ? error.message : 'Unknown error' }
            };
        }
    }

    /**
     * Test user with outgoing targets scenario
     */
    private async testUserWithOutgoingTargets(evidence: any[], issues: string[]): Promise<{
        success: boolean;
        issues: string[];
        evidence: any[];
        recommendation: string;
    }> {
        // This would simulate or test the specific scenario
        // For now, we'll provide a framework for the test

        evidence.push({
            test: 'user_with_outgoing_targets',
            timestamp: new Date().toISOString(),
            userState: this.checkUserState(this.getCurrentUserId())
        });

        // Add specific tests for this scenario
        const authState = this.checkAuthenticationState();
        if (!authState.isValid) {
            issues.push('User authentication state is invalid');
        }

        return {
            success: issues.length === 0,
            issues,
            evidence,
            recommendation: issues.length > 0
                ? 'Fix authentication state before testing targeting functionality'
                : 'User authentication state is valid for targeting operations'
        };
    }

    /**
     * Test targeting data load scenario
     */
    private async testTargetingDataLoad(evidence: any[], issues: string[]): Promise<{
        success: boolean;
        issues: string[];
        evidence: any[];
        recommendation: string;
    }> {
        // Test targeting data loading
        try {
            const userId = this.getCurrentUserId();
            const startTime = performance.now();

            const response = await fetch(`/api/users/${userId}/targeting-activity`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json'
                }
            });

            const endTime = performance.now();

            evidence.push({
                test: 'targeting_data_load',
                timestamp: new Date().toISOString(),
                duration: endTime - startTime,
                status: response.status,
                success: response.ok
            });

            if (!response.ok) {
                issues.push(`Targeting data load failed with status ${response.status}`);
            }
        } catch (error) {
            issues.push(`Targeting data load error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return {
            success: issues.length === 0,
            issues,
            evidence,
            recommendation: issues.length > 0
                ? 'Fix targeting data loading authentication issues'
                : 'Targeting data loading works correctly'
        };
    }

    /**
     * Test targeting operation scenario
     */
    private async testTargetingOperation(evidence: any[], issues: string[]): Promise<{
        success: boolean;
        issues: string[];
        evidence: any[];
        recommendation: string;
    }> {
        // This would test actual targeting operations
        // For now, we'll provide a framework

        evidence.push({
            test: 'targeting_operation',
            timestamp: new Date().toISOString(),
            note: 'Targeting operation test framework - implement specific operation tests'
        });

        return {
            success: true,
            issues,
            evidence,
            recommendation: 'Implement specific targeting operation tests'
        };
    }

    /**
     * Generate comprehensive report
     */
    private async generateComprehensiveReport(
        targetingAuthReport: TargetingAuthenticationAnalysisReport,
        endpointComparison: any,
        tokenValidationReport: TokenValidationAnalysisReport
    ): Promise<ComprehensiveAuthDebugReport> {
        const userId = this.debugSession?.userId || 'unknown';
        const userState = this.checkUserState(userId);

        const criticalFindings = this.identifyCriticalFindings(
            targetingAuthReport,
            endpointComparison,
            tokenValidationReport
        );

        const recommendations = this.generateConsolidatedRecommendations(
            targetingAuthReport,
            endpointComparison,
            tokenValidationReport,
            criticalFindings
        );

        return {
            timestamp: new Date(),
            userId,
            userHasOutgoingTargets: userState.hasOutgoingTargets,
            analysisResults: {
                targetingAuthAnalysis: targetingAuthReport,
                endpointComparison,
                tokenValidationAnalysis: tokenValidationReport
            },
            criticalFindings,
            recommendations,
            reproductionSteps: this.generateReproductionSteps(criticalFindings),
            debugCommands: this.generateDebugCommands()
        };
    }

    /**
     * Identify critical findings across all analyses
     */
    private identifyCriticalFindings(
        targetingAuthReport: TargetingAuthenticationAnalysisReport,
        endpointComparison: any,
        tokenValidationReport: TokenValidationAnalysisReport
    ): CriticalFinding[] {
        const findings: CriticalFinding[] = [];

        // Check targeting auth issues
        targetingAuthReport.identifiedIssues.forEach((issue, index) => {
            if (issue.severity === 'critical' || issue.severity === 'high') {
                findings.push({
                    id: `targeting-auth-${index}`,
                    severity: issue.severity,
                    category: 'authentication_failure',
                    title: `Targeting Authentication Issue: ${issue.issueType}`,
                    description: issue.description,
                    evidence: issue.authenticationFlow,
                    impact: 'Users with outgoing targets experience unexpected logouts',
                    recommendation: 'Fix targeting-specific authentication validation'
                });
            }
        });

        // Check endpoint comparison issues
        if (endpointComparison.summary.inconsistentResults > 0) {
            findings.push({
                id: 'endpoint-inconsistency',
                severity: 'high',
                category: 'endpoint_mismatch',
                title: 'Authentication Inconsistency Between Endpoints',
                description: `${endpointComparison.summary.inconsistentResults} inconsistent authentication results between swap and targeting endpoints`,
                evidence: endpointComparison.comparisons,
                impact: 'Unpredictable authentication behavior across the application',
                recommendation: 'Standardize authentication logic across all endpoints'
            });
        }

        // Check token validation issues
        if (tokenValidationReport.summary.criticalDifferences > 0) {
            findings.push({
                id: 'token-validation-critical',
                severity: 'critical',
                category: 'token_validation_inconsistency',
                title: 'Critical Token Validation Differences',
                description: `${tokenValidationReport.summary.criticalDifferences} critical differences in token validation between endpoint types`,
                evidence: tokenValidationReport.validationDifferences,
                impact: 'Valid tokens incorrectly rejected, causing user logout',
                recommendation: 'Align token validation logic across all endpoints'
            });
        }

        return findings;
    }

    /**
     * Generate consolidated recommendations
     */
    private generateConsolidatedRecommendations(
        targetingAuthReport: TargetingAuthenticationAnalysisReport,
        endpointComparison: any,
        tokenValidationReport: TokenValidationAnalysisReport,
        criticalFindings: CriticalFinding[]
    ): string[] {
        const recommendations = new Set<string>();

        // Add recommendations from all reports
        targetingAuthReport.recommendations.forEach(rec => recommendations.add(rec));
        endpointComparison.summary.recommendations.forEach(rec => recommendations.add(rec));
        tokenValidationReport.recommendations.forEach(rec => recommendations.add(rec));

        // Add critical finding recommendations
        criticalFindings.forEach(finding => recommendations.add(finding.recommendation));

        // Add comprehensive recommendations
        recommendations.add('Implement comprehensive authentication integration tests');
        recommendations.add('Add authentication state monitoring and alerting');
        recommendations.add('Create authentication debugging tools for production use');

        return Array.from(recommendations);
    }

    /**
     * Generate reproduction steps
     */
    private generateReproductionSteps(criticalFindings: CriticalFinding[]): string[] {
        const steps = [
            '1. Log in as a user with outgoing targets',
            '2. Navigate to My Swaps page',
            '3. Monitor network requests for authentication failures',
            '4. Check browser console for authentication errors',
            '5. Verify token validity and format',
            '6. Test both swap and targeting endpoints with same token'
        ];

        if (criticalFindings.some(f => f.category === 'authentication_failure')) {
            steps.push('7. Observe unexpected logout during targeting operations');
        }

        if (criticalFindings.some(f => f.category === 'endpoint_mismatch')) {
            steps.push('8. Compare authentication responses between different endpoint types');
        }

        return steps;
    }

    /**
     * Generate debug commands
     */
    private generateDebugCommands(): string[] {
        return [
            'targetingAuthAnalyzer.startAnalysis()',
            'tokenValidationAnalyzer.startAnalysis()',
            'authEndpointComparator.runComprehensiveComparison(userId)',
            'comprehensiveTargetingAuthDebugger.quickDebugCheck()',
            'comprehensiveTargetingAuthDebugger.testTargetingScenario("user_with_outgoing_targets")',
            'localStorage.getItem("auth_token")',
            'localStorage.getItem("auth_user")',
            'console.log("Current auth state:", { token: !!localStorage.getItem("auth_token"), user: !!localStorage.getItem("auth_user") })'
        ];
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

    private generateEmptyReport(): ComprehensiveAuthDebugReport {
        return {
            timestamp: new Date(),
            userId: 'unknown',
            userHasOutgoingTargets: false,
            analysisResults: {
                targetingAuthAnalysis: {} as any,
                endpointComparison: { comparisons: [], summary: {} },
                tokenValidationAnalysis: {} as any
            },
            criticalFindings: [],
            recommendations: ['Start a debug session to analyze authentication issues'],
            reproductionSteps: [],
            debugCommands: []
        };
    }
}

// Export singleton instance
export const comprehensiveTargetingAuthDebugger = new ComprehensiveTargetingAuthDebugger();

// Global access for debugging
if (typeof window !== 'undefined') {
    (window as any).comprehensiveTargetingAuthDebugger = comprehensiveTargetingAuthDebugger;

    // Add convenient global debug functions
    (window as any).debugTargetingAuth = {
        start: () => comprehensiveTargetingAuthDebugger.startDebugSession(),
        stop: () => comprehensiveTargetingAuthDebugger.stopDebugSession(),
        quickCheck: () => comprehensiveTargetingAuthDebugger.quickDebugCheck(),
        testScenario: (scenario: string) => comprehensiveTargetingAuthDebugger.testTargetingScenario(scenario as any)
    };
}