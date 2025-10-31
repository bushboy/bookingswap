/**
 * Diagnostic utilities for troubleshooting proposal button visibility and functionality
 * This utility helps verify that the accept/reject buttons are working correctly
 */

export interface ButtonDiagnosticReport {
    proposalId: string;
    timestamp: string;
    visibility: {
        shouldShow: boolean;
        reasons: string[];
    };
    permissions: {
        hasUserId: boolean;
        userId: string | null;
        isOwner: boolean;
        canAccept: boolean;
        canReject: boolean;
    };
    proposalState: {
        status: string;
        isExpired: boolean;
        isProcessing: boolean;
    };
    buttonState: {
        acceptEnabled: boolean;
        rejectEnabled: boolean;
        loadingState: string | null;
    };
    debugInfo: {
        debugForceShow: boolean;
        developmentMode: boolean;
        hasErrors: boolean;
        errors: string[];
    };
}

export interface ButtonInteractionEvent {
    proposalId: string;
    action: 'accept' | 'reject' | 'view';
    timestamp: string;
    success: boolean;
    duration?: number;
    error?: string;
    userId?: string;
    userAgent: string;
    sessionId: string;
}

class ProposalButtonDiagnostics {
    private interactions: ButtonInteractionEvent[] = [];
    private sessionId: string;

    constructor() {
        this.sessionId = this.generateSessionId();
        this.setupGlobalErrorTracking();
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private setupGlobalErrorTracking(): void {
        // Track unhandled errors that might affect button functionality
        window.addEventListener('error', (event) => {
            if (event.message.toLowerCase().includes('proposal') ||
                event.message.toLowerCase().includes('button')) {
                console.warn('[ProposalButtonDiagnostics] Potential button-related error:', event.error);
            }
        });
    }

    /**
     * Generate a comprehensive diagnostic report for a proposal's button state
     */
    generateDiagnosticReport(
        proposalId: string,
        status: string,
        currentUserId: string | null,
        proposalOwnerId: string | null,
        disabled: boolean = false,
        isProcessing: boolean = false,
        debugForceShow: boolean = false
    ): ButtonDiagnosticReport {
        const reasons: string[] = [];

        // Check visibility conditions
        const statusIsPending = status === 'pending';
        const componentNotDisabled = !disabled;
        const hasUserId = !!currentUserId;
        const hasPermission = !currentUserId || !proposalOwnerId || currentUserId === proposalOwnerId;
        const shouldShow = (statusIsPending && componentNotDisabled && hasPermission) || debugForceShow;

        // Collect reasons for visibility decision
        if (!statusIsPending) reasons.push(`Status is '${status}' (must be 'pending')`);
        if (!componentNotDisabled) reasons.push('Component is disabled');
        if (!hasUserId) reasons.push('No current user ID available');
        if (!hasPermission) reasons.push('User lacks permission (not proposal owner)');
        if (debugForceShow) reasons.push('Debug force show is enabled');

        const report: ButtonDiagnosticReport = {
            proposalId,
            timestamp: new Date().toISOString(),
            visibility: {
                shouldShow,
                reasons: shouldShow ? ['All conditions met'] : reasons
            },
            permissions: {
                hasUserId,
                userId: currentUserId,
                isOwner: hasPermission,
                canAccept: shouldShow && !isProcessing,
                canReject: shouldShow && !isProcessing
            },
            proposalState: {
                status,
                isExpired: status === 'expired',
                isProcessing
            },
            buttonState: {
                acceptEnabled: shouldShow && !isProcessing,
                rejectEnabled: shouldShow && !isProcessing,
                loadingState: isProcessing ? 'processing' : null
            },
            debugInfo: {
                debugForceShow,
                developmentMode: process.env.NODE_ENV === 'development',
                hasErrors: false,
                errors: []
            }
        };

        console.log(`[ProposalButtonDiagnostics] Generated report for ${proposalId}:`, report);
        return report;
    }

    /**
     * Track a button interaction event
     */
    trackInteraction(
        proposalId: string,
        action: 'accept' | 'reject' | 'view',
        success: boolean,
        duration?: number,
        error?: string,
        userId?: string
    ): void {
        const event: ButtonInteractionEvent = {
            proposalId,
            action,
            timestamp: new Date().toISOString(),
            success,
            duration,
            error,
            userId,
            userAgent: navigator.userAgent,
            sessionId: this.sessionId
        };

        this.interactions.push(event);

        // Keep only last 100 interactions to prevent memory issues
        if (this.interactions.length > 100) {
            this.interactions = this.interactions.slice(-100);
        }

        console.log(`[ProposalButtonDiagnostics] Tracked ${action} interaction:`, event);

        // Send to analytics if available
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'proposal_button_interaction', {
                proposal_id: proposalId,
                action,
                success,
                duration,
                error: error ? 'error_occurred' : 'no_error'
            });
        }
    }

    /**
     * Get interaction statistics for analysis
     */
    getInteractionStats(): {
        total: number;
        byAction: Record<string, number>;
        successRate: number;
        averageDuration: number;
        commonErrors: Array<{ error: string; count: number }>;
        recentInteractions: ButtonInteractionEvent[];
    } {
        const total = this.interactions.length;
        const byAction = this.interactions.reduce((acc, interaction) => {
            acc[interaction.action] = (acc[interaction.action] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const successful = this.interactions.filter(i => i.success).length;
        const successRate = total > 0 ? (successful / total) * 100 : 0;

        const durationsWithValues = this.interactions.filter(i => i.duration !== undefined);
        const averageDuration = durationsWithValues.length > 0
            ? durationsWithValues.reduce((sum, i) => sum + (i.duration || 0), 0) / durationsWithValues.length
            : 0;

        const errorCounts = this.interactions
            .filter(i => i.error)
            .reduce((acc, i) => {
                const error = i.error!;
                acc[error] = (acc[error] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        const commonErrors = Object.entries(errorCounts)
            .map(([error, count]) => ({ error, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            total,
            byAction,
            successRate,
            averageDuration,
            commonErrors,
            recentInteractions: this.interactions.slice(-10)
        };
    }

    /**
     * Clear all tracked interactions
     */
    clearInteractions(): void {
        this.interactions = [];
        console.log('[ProposalButtonDiagnostics] Cleared all interaction data');
    }

    /**
     * Export interaction data for analysis
     */
    exportData(): string {
        return JSON.stringify({
            sessionId: this.sessionId,
            exportTimestamp: new Date().toISOString(),
            interactions: this.interactions,
            stats: this.getInteractionStats()
        }, null, 2);
    }

    /**
     * Verify button functionality with a test proposal
     */
    verifyButtonFunctionality(testProposal: {
        id: string;
        status: string;
        currentUserId: string | null;
        proposalOwnerId: string | null;
    }): {
        isWorking: boolean;
        issues: string[];
        recommendations: string[];
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];

        const report = this.generateDiagnosticReport(
            testProposal.id,
            testProposal.status,
            testProposal.currentUserId,
            testProposal.proposalOwnerId
        );

        // Check for common issues
        if (!report.permissions.hasUserId) {
            issues.push('No current user ID available');
            recommendations.push('Ensure user is properly authenticated and user data is loaded');
        }

        if (testProposal.status !== 'pending') {
            issues.push(`Proposal status is '${testProposal.status}' instead of 'pending'`);
            recommendations.push('Only pending proposals should show accept/reject buttons');
        }

        if (!report.permissions.isOwner) {
            issues.push('Current user is not the proposal owner');
            recommendations.push('Verify that the current user ID matches the proposal owner ID');
        }

        const isWorking = report.visibility.shouldShow && issues.length === 0;

        return {
            isWorking,
            issues,
            recommendations
        };
    }
}

// Create global instance
export const proposalButtonDiagnostics = new ProposalButtonDiagnostics();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    (window as any).proposalButtonDiagnostics = proposalButtonDiagnostics;
}

export default proposalButtonDiagnostics;