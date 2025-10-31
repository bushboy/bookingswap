/**
 * Targeting Authentication Debug Tools Index
 * 
 * This file exports all targeting authentication debugging utilities
 * and provides easy access to the debugging tools.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

// Export all debugging utilities
export { targetingAuthAnalyzer } from './targeting-auth-analysis';
export { authEndpointComparator } from './auth-endpoint-comparison';
export { tokenValidationAnalyzer } from './token-validation-analysis';
export { comprehensiveTargetingAuthDebugger } from './comprehensive-targeting-auth-debug';

// Export types
export type {
    TargetingAuthenticationAnalysisReport,
    TargetingAuthenticationIssue,
    AuthenticationAnalysisResult
} from './targeting-auth-analysis';

export type {
    EndpointAuthComparison,
    EndpointAuthResult
} from './auth-endpoint-comparison';

export type {
    TokenValidationAnalysisReport,
    TokenValidationResult,
    ValidationDifference
} from './token-validation-analysis';

export type {
    ComprehensiveAuthDebugReport,
    CriticalFinding
} from './comprehensive-targeting-auth-debug';

/**
 * Initialize debugging tools for targeting authentication issues
 * Call this function to set up all debugging utilities
 */
export function initializeTargetingAuthDebug(): void {
    console.log('🔧 Initializing targeting authentication debug tools...');

    // Make tools globally available for easy debugging
    if (typeof window !== 'undefined') {
        // Add debug tools to window for console access
        (window as any).targetingAuthDebug = {
            // Quick access functions
            startAnalysis: () => {
                console.log('🚀 Starting comprehensive targeting auth analysis...');
                return (window as any).comprehensiveTargetingAuthDebugger.startDebugSession();
            },

            stopAnalysis: () => {
                console.log('🛑 Stopping targeting auth analysis...');
                return (window as any).comprehensiveTargetingAuthDebugger.stopDebugSession();
            },

            quickCheck: () => {
                console.log('⚡ Running quick targeting auth check...');
                return (window as any).comprehensiveTargetingAuthDebugger.quickDebugCheck();
            },

            compareEndpoints: (userId?: string) => {
                console.log('🔍 Comparing endpoint authentication...');
                const currentUserId = userId || getCurrentUserId();
                return (window as any).authEndpointComparator.runComprehensiveComparison(currentUserId);
            },

            analyzeToken: () => {
                console.log('🎫 Starting token validation analysis...');
                (window as any).tokenValidationAnalyzer.startAnalysis();
                return 'Token validation analysis started. Use stopTokenAnalysis() to get results.';
            },

            stopTokenAnalysis: () => {
                console.log('📊 Stopping token validation analysis...');
                return (window as any).tokenValidationAnalyzer.stopAnalysis();
            },

            // Test specific scenarios
            testUserWithTargets: () => {
                console.log('🧪 Testing user with outgoing targets scenario...');
                return (window as any).comprehensiveTargetingAuthDebugger.testTargetingScenario('user_with_outgoing_targets');
            },

            testTargetingDataLoad: () => {
                console.log('📊 Testing targeting data load scenario...');
                return (window as any).comprehensiveTargetingAuthDebugger.testTargetingScenario('targeting_data_load');
            },

            testTargetingOperation: () => {
                console.log('⚙️ Testing targeting operation scenario...');
                return (window as any).comprehensiveTargetingAuthDebugger.testTargetingScenario('targeting_operation');
            },

            // Utility functions
            getCurrentAuthState: () => {
                const token = localStorage.getItem('auth_token');
                const user = localStorage.getItem('auth_user');

                return {
                    hasToken: !!token,
                    hasUser: !!user,
                    tokenLength: token?.length || 0,
                    userId: user ? JSON.parse(user).id : null,
                    tokenValid: token ? isTokenValid(token) : false
                };
            },

            logCurrentState: () => {
                const state = (window as any).targetingAuthDebug.getCurrentAuthState();
                console.log('📋 Current Authentication State:', state);
                return state;
            },

            // Export data functions
            exportAnalysisData: () => {
                console.log('💾 Exporting analysis data...');
                return {
                    endpointComparisons: (window as any).authEndpointComparator.exportComparisonData(),
                    timestamp: new Date().toISOString()
                };
            },

            // Help function
            help: () => {
                console.log(`
🔧 Targeting Authentication Debug Tools Help

Quick Commands:
- targetingAuthDebug.startAnalysis()     - Start comprehensive analysis
- targetingAuthDebug.stopAnalysis()      - Stop analysis and get report
- targetingAuthDebug.quickCheck()        - Quick authentication check
- targetingAuthDebug.compareEndpoints()  - Compare swap vs targeting endpoints
- targetingAuthDebug.analyzeToken()      - Start token validation analysis
- targetingAuthDebug.getCurrentAuthState() - Get current auth state
- targetingAuthDebug.logCurrentState()   - Log current state to console

Test Scenarios:
- targetingAuthDebug.testUserWithTargets()    - Test user with outgoing targets
- targetingAuthDebug.testTargetingDataLoad()  - Test targeting data loading
- targetingAuthDebug.testTargetingOperation() - Test targeting operations

Utilities:
- targetingAuthDebug.exportAnalysisData() - Export analysis data
- targetingAuthDebug.help()               - Show this help

For detailed analysis, run startAnalysis(), perform the actions that cause issues, then run stopAnalysis().
        `);
            }
        };

        console.log('✅ Targeting authentication debug tools initialized');
        console.log('💡 Use targetingAuthDebug.help() for available commands');
    }
}

/**
 * Utility function to get current user ID
 */
function getCurrentUserId(): string {
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

/**
 * Utility function to check if token is valid
 */
function isTokenValid(token: string): boolean {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;

        const payload = JSON.parse(atob(parts[1]));
        const now = Math.floor(Date.now() / 1000);

        return !payload.exp || payload.exp > now;
    } catch (error) {
        return false;
    }
}

/**
 * Auto-initialize debug tools in development
 */
if (typeof window !== 'undefined' && import.meta.env.DEV) {
    // Auto-initialize in development mode
    setTimeout(() => {
        initializeTargetingAuthDebug();
    }, 1000);
}