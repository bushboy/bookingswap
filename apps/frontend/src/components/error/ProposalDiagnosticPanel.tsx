import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';

/**
 * Props for the ProposalDiagnosticPanel component
 */
export interface ProposalDiagnosticPanelProps {
    /** Proposal ID being diagnosed */
    proposalId?: string | null;
    /** Component name that failed */
    componentName?: string;
    /** Error that occurred */
    error?: Error;
    /** Whether to show advanced diagnostic information */
    showAdvanced?: boolean;
    /** Callback when manual refresh is requested */
    onManualRefresh?: () => Promise<void>;
    /** Callback when cache clear is requested */
    onClearCache?: () => Promise<void>;
    /** Callback when diagnostic report is generated */
    onGenerateReport?: () => Promise<string>;
    /** Whether the panel is in compact mode */
    compact?: boolean;
}

/**
 * System diagnostic information
 */
interface SystemDiagnostics {
    timestamp: Date;
    userAgent: string;
    url: string;
    viewport: { width: number; height: number };
    connection: string;
    memory?: any;
    localStorage: { available: boolean; used: number; total: number };
    sessionStorage: { available: boolean; used: number };
    cookies: { enabled: boolean; count: number };
    permissions: Record<string, string>;
}

/**
 * ProposalDiagnosticPanel - Advanced diagnostic and recovery panel for proposal components
 * 
 * Features:
 * - System health checks and diagnostics
 * - Manual refresh and cache clearing capabilities
 * - Diagnostic report generation
 * - Performance monitoring
 * - Browser compatibility checks
 */
export const ProposalDiagnosticPanel: React.FC<ProposalDiagnosticPanelProps> = ({
    proposalId,
    componentName = 'Unknown',
    error,
    showAdvanced = false,
    onManualRefresh,
    onClearCache,
    onGenerateReport,
    compact = false,
}) => {
    const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
    const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isClearingCache, setIsClearingCache] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [showDiagnostics, setShowDiagnostics] = useState(false);

    // Run system diagnostics
    const runSystemDiagnostics = useCallback(async (): Promise<SystemDiagnostics> => {
        const diagnostics: SystemDiagnostics = {
            timestamp: new Date(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
            connection: (navigator as any).connection?.effectiveType || 'unknown',
            localStorage: {
                available: typeof Storage !== 'undefined',
                used: 0,
                total: 0,
            },
            sessionStorage: {
                available: typeof Storage !== 'undefined',
                used: 0,
            },
            cookies: {
                enabled: navigator.cookieEnabled,
                count: document.cookie.split(';').length,
            },
            permissions: {},
        };

        // Check localStorage usage
        if (diagnostics.localStorage.available) {
            try {
                let totalSize = 0;
                for (let key in localStorage) {
                    if (localStorage.hasOwnProperty(key)) {
                        totalSize += localStorage[key].length + key.length;
                    }
                }
                diagnostics.localStorage.used = totalSize;
                diagnostics.localStorage.total = 5 * 1024 * 1024; // Approximate 5MB limit
            } catch (e) {
                diagnostics.localStorage.available = false;
            }
        }

        // Check sessionStorage usage
        if (diagnostics.sessionStorage.available) {
            try {
                let totalSize = 0;
                for (let key in sessionStorage) {
                    if (sessionStorage.hasOwnProperty(key)) {
                        totalSize += sessionStorage[key].length + key.length;
                    }
                }
                diagnostics.sessionStorage.used = totalSize;
            } catch (e) {
                diagnostics.sessionStorage.available = false;
            }
        }

        // Check memory (if available)
        if ('memory' in performance) {
            diagnostics.memory = (performance as any).memory;
        }

        // Check permissions (basic ones)
        const permissionsToCheck = ['clipboard-write', 'notifications'];
        for (const permission of permissionsToCheck) {
            try {
                const result = await navigator.permissions.query({ name: permission as any });
                diagnostics.permissions[permission] = result.state;
            } catch (e) {
                diagnostics.permissions[permission] = 'unavailable';
            }
        }

        return diagnostics;
    }, []);

    // Handle manual refresh
    const handleManualRefresh = useCallback(async () => {
        if (!onManualRefresh) return;

        setIsRefreshing(true);
        try {
            await onManualRefresh();
        } catch (error) {
            console.error('Manual refresh failed:', error);
        } finally {
            setIsRefreshing(false);
        }
    }, [onManualRefresh]);

    // Handle cache clearing
    const handleClearCache = useCallback(async () => {
        setIsClearingCache(true);
        try {
            // Clear proposal-related localStorage items
            if (proposalId) {
                const keysToRemove = Object.keys(localStorage).filter(key =>
                    key.includes(proposalId) || key.includes('proposal')
                );
                keysToRemove.forEach(key => {
                    try {
                        localStorage.removeItem(key);
                    } catch (e) {
                        console.warn('Failed to remove localStorage key:', key);
                    }
                });
            }

            // Clear sessionStorage
            try {
                sessionStorage.clear();
            } catch (e) {
                console.warn('Failed to clear sessionStorage');
            }

            // Call custom cache clear if provided
            if (onClearCache) {
                await onClearCache();
            }

            // Force a small delay to show the action completed
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error('Cache clearing failed:', error);
        } finally {
            setIsClearingCache(false);
        }
    }, [proposalId, onClearCache]);

    // Handle diagnostic report generation
    const handleGenerateReport = useCallback(async () => {
        setIsGeneratingReport(true);
        try {
            let report = '';

            if (onGenerateReport) {
                report = await onGenerateReport();
            } else {
                // Generate default report
                const systemDiag = diagnostics || await runSystemDiagnostics();
                report = `
Proposal Component Diagnostic Report
===================================
Generated: ${new Date().toISOString()}
Proposal ID: ${proposalId || 'Not provided'}
Component: ${componentName}
Error: ${error?.message || 'No error provided'}

System Information:
- User Agent: ${systemDiag.userAgent}
- URL: ${systemDiag.url}
- Viewport: ${systemDiag.viewport.width}x${systemDiag.viewport.height}
- Connection: ${systemDiag.connection}
- Cookies Enabled: ${systemDiag.cookies.enabled}

Storage Information:
- localStorage Available: ${systemDiag.localStorage.available}
- localStorage Used: ${(systemDiag.localStorage.used / 1024).toFixed(2)} KB
- sessionStorage Available: ${systemDiag.sessionStorage.available}
- sessionStorage Used: ${(systemDiag.sessionStorage.used / 1024).toFixed(2)} KB

${error ? `
Error Details:
- Name: ${error.name}
- Message: ${error.message}
- Stack: ${error.stack}
` : ''}

Permissions:
${Object.entries(systemDiag.permissions).map(([key, value]) => `- ${key}: ${value}`).join('\n')}
                `.trim();
            }

            // Copy to clipboard or download
            try {
                await navigator.clipboard.writeText(report);
                alert('Diagnostic report copied to clipboard');
            } catch (e) {
                // Fallback: create download
                const blob = new Blob([report], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `proposal-diagnostic-${proposalId || 'unknown'}-${Date.now()}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                alert('Diagnostic report downloaded');
            }
        } catch (error) {
            console.error('Report generation failed:', error);
            alert('Failed to generate diagnostic report');
        } finally {
            setIsGeneratingReport(false);
        }
    }, [diagnostics, onGenerateReport, proposalId, componentName, error, runSystemDiagnostics]);

    // Run diagnostics on mount
    useEffect(() => {
        if (showAdvanced) {
            setIsRunningDiagnostics(true);
            runSystemDiagnostics()
                .then(setDiagnostics)
                .finally(() => setIsRunningDiagnostics(false));
        }
    }, [showAdvanced, runSystemDiagnostics]);

    if (compact) {
        return (
            <div style={{
                padding: tokens.spacing[2],
                backgroundColor: tokens.colors.neutral[50],
                border: `1px solid ${tokens.colors.neutral[200]}`,
                borderRadius: tokens.borderRadius.md,
                fontSize: tokens.typography.fontSize.xs,
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                }}>
                    <span style={{ color: tokens.colors.neutral[600] }}>
                        🔧 Diagnostic Tools
                    </span>
                    <div style={{ display: 'flex', gap: tokens.spacing[1] }}>
                        {onManualRefresh && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleManualRefresh}
                                disabled={isRefreshing}
                                loading={isRefreshing}
                                style={{ fontSize: tokens.typography.fontSize.xs }}
                            >
                                🔄
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearCache}
                            disabled={isClearingCache}
                            loading={isClearingCache}
                            style={{ fontSize: tokens.typography.fontSize.xs }}
                        >
                            🗑️
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateReport}
                            disabled={isGeneratingReport}
                            loading={isGeneratingReport}
                            style={{ fontSize: tokens.typography.fontSize.xs }}
                        >
                            📋
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            padding: tokens.spacing[3],
            backgroundColor: tokens.colors.neutral[50],
            border: `1px solid ${tokens.colors.neutral[200]}`,
            borderRadius: tokens.borderRadius.md,
            fontSize: tokens.typography.fontSize.sm,
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: tokens.spacing[3],
            }}>
                <h4 style={{
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[800],
                    margin: 0,
                }}>
                    🔧 Diagnostic & Recovery Tools
                </h4>

                {showAdvanced && (
                    <button
                        onClick={() => setShowDiagnostics(!showDiagnostics)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: tokens.colors.primary[600],
                            fontSize: tokens.typography.fontSize.sm,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                        }}
                    >
                        {showDiagnostics ? '▼ Hide' : '▶ Show'} System Info
                    </button>
                )}
            </div>

            {/* Action Buttons */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: tokens.spacing[2],
                marginBottom: showDiagnostics ? tokens.spacing[3] : 0,
            }}>
                {onManualRefresh && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        loading={isRefreshing}
                        style={{
                            borderColor: tokens.colors.primary[300],
                            color: tokens.colors.primary[700],
                        }}
                    >
                        🔄 Manual Refresh
                    </Button>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearCache}
                    disabled={isClearingCache}
                    loading={isClearingCache}
                    style={{
                        borderColor: tokens.colors.warning[300],
                        color: tokens.colors.warning[700],
                    }}
                >
                    🗑️ Clear Cache
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateReport}
                    disabled={isGeneratingReport}
                    loading={isGeneratingReport}
                    style={{
                        borderColor: tokens.colors.neutral[300],
                        color: tokens.colors.neutral[700],
                    }}
                >
                    📋 Generate Report
                </Button>

                {showAdvanced && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setIsRunningDiagnostics(true);
                            runSystemDiagnostics()
                                .then(setDiagnostics)
                                .finally(() => setIsRunningDiagnostics(false));
                        }}
                        disabled={isRunningDiagnostics}
                        loading={isRunningDiagnostics}
                        style={{
                            borderColor: tokens.colors.secondary[300],
                            color: tokens.colors.secondary[700],
                        }}
                    >
                        🔍 Run Diagnostics
                    </Button>
                )}
            </div>

            {/* System Diagnostics Display */}
            {showDiagnostics && diagnostics && (
                <div style={{
                    backgroundColor: tokens.colors.neutral[100],
                    border: `1px solid ${tokens.colors.neutral[200]}`,
                    borderRadius: tokens.borderRadius.sm,
                    padding: tokens.spacing[3],
                    fontSize: tokens.typography.fontSize.xs,
                    fontFamily: 'monospace',
                }}>
                    <div style={{ marginBottom: tokens.spacing[2] }}>
                        <strong>System Health Check</strong>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacing[2] }}>
                        <div>
                            <div><strong>Browser:</strong></div>
                            <div>Connection: {diagnostics.connection}</div>
                            <div>Viewport: {diagnostics.viewport.width}×{diagnostics.viewport.height}</div>
                            <div>Cookies: {diagnostics.cookies.enabled ? '✅' : '❌'}</div>
                        </div>

                        <div>
                            <div><strong>Storage:</strong></div>
                            <div>localStorage: {diagnostics.localStorage.available ? '✅' : '❌'}
                                ({(diagnostics.localStorage.used / 1024).toFixed(1)}KB used)
                            </div>
                            <div>sessionStorage: {diagnostics.sessionStorage.available ? '✅' : '❌'}
                                ({(diagnostics.sessionStorage.used / 1024).toFixed(1)}KB used)
                            </div>
                            {diagnostics.memory && (
                                <div>Memory: {(diagnostics.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB</div>
                            )}
                        </div>
                    </div>

                    {Object.keys(diagnostics.permissions).length > 0 && (
                        <div style={{ marginTop: tokens.spacing[2] }}>
                            <div><strong>Permissions:</strong></div>
                            {Object.entries(diagnostics.permissions).map(([key, value]) => (
                                <div key={key}>
                                    {key}: {value === 'granted' ? '✅' : value === 'denied' ? '❌' : '⚠️'} {value}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Quick Tips */}
            <div style={{
                marginTop: tokens.spacing[3],
                padding: tokens.spacing[2],
                backgroundColor: tokens.colors.primary[50],
                border: `1px solid ${tokens.colors.primary[200]}`,
                borderRadius: tokens.borderRadius.sm,
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.primary[700],
            }}>
                <div style={{ fontWeight: tokens.typography.fontWeight.medium, marginBottom: tokens.spacing[1] }}>
                    💡 Quick Recovery Tips:
                </div>
                <ul style={{ margin: 0, paddingLeft: tokens.spacing[4] }}>
                    <li>Try manual refresh first - it reloads component data</li>
                    <li>Clear cache if you see stale or corrupted data</li>
                    <li>Generate report to share with support if issues persist</li>
                    <li>Check browser console for additional error details</li>
                </ul>
            </div>
        </div>
    );
};

export default ProposalDiagnosticPanel;