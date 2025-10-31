/**
 * Data Consistency Validator for Swap Card Display Accuracy
 * Requirements: 6.1, 6.2, 6.3, 6.4 - Check for data integrity issues
 */

import { CompleteSwapData, ValidatedTargeting } from './swapDataValidator';
import { logger } from './logger';

export interface ConsistencyIssue {
    type: 'error' | 'warning' | 'info';
    category: 'data_mismatch' | 'missing_data' | 'invalid_reference' | 'count_mismatch' | 'temporal_inconsistency';
    description: string;
    affectedFields: string[];
    severity: 'high' | 'medium' | 'low';
    recommendation: string;
}

export interface ConsistencyReport {
    swapId: string;
    isConsistent: boolean;
    issues: ConsistencyIssue[];
    summary: {
        errorCount: number;
        warningCount: number;
        infoCount: number;
        highSeverityCount: number;
    };
    timestamp: Date;
}

export interface CrossSwapConsistencyReport {
    totalSwapsChecked: number;
    consistentSwaps: number;
    inconsistentSwaps: number;
    globalIssues: ConsistencyIssue[];
    swapReports: ConsistencyReport[];
    summary: {
        totalIssues: number;
        criticalIssues: number;
        recommendations: string[];
    };
    timestamp: Date;
}

export class DataConsistencyValidator {
    /**
     * Validate consistency of a single swap's data
     * Requirements: 6.1, 6.2, 6.3 - Ensure data consistency across display elements
     */
    static validateSwapConsistency(swapData: CompleteSwapData): ConsistencyReport {
        const issues: ConsistencyIssue[] = [];
        const timestamp = new Date();

        try {
            // Validate basic data integrity
            this.validateBasicDataIntegrity(swapData, issues);

            // Validate targeting consistency
            this.validateTargetingConsistency(swapData.targeting, issues);

            // Validate financial data consistency
            this.validateFinancialConsistency(swapData, issues);

            // Validate temporal consistency
            this.validateTemporalConsistency(swapData, issues);

            // Validate reference integrity
            this.validateReferenceIntegrity(swapData, issues);

            const summary = this.generateSummary(issues);
            const isConsistent = summary.errorCount === 0 && summary.highSeverityCount === 0;

            logger.debug('Swap consistency validation completed', {
                swapId: swapData.id,
                isConsistent,
                issueCount: issues.length
            });

            return {
                swapId: swapData.id,
                isConsistent,
                issues,
                summary,
                timestamp
            };

        } catch (error) {
            logger.error('Error during consistency validation', { error, swapId: swapData.id });

            issues.push({
                type: 'error',
                category: 'data_mismatch',
                description: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                affectedFields: ['all'],
                severity: 'high',
                recommendation: 'Review swap data structure and retry validation'
            });

            return {
                swapId: swapData.id,
                isConsistent: false,
                issues,
                summary: this.generateSummary(issues),
                timestamp
            };
        }
    }

    /**
     * Validate basic data integrity
     * Requirements: 6.4 - Data integrity validation
     */
    private static validateBasicDataIntegrity(swapData: CompleteSwapData, issues: ConsistencyIssue[]): void {
        // Check for required fields
        if (!swapData.id || swapData.id.trim() === '') {
            issues.push({
                type: 'error',
                category: 'missing_data',
                description: 'Swap ID is missing or empty',
                affectedFields: ['id'],
                severity: 'high',
                recommendation: 'Ensure swap ID is properly set from database'
            });
        }

        if (!swapData.ownerId || swapData.ownerId.trim() === '') {
            issues.push({
                type: 'error',
                category: 'missing_data',
                description: 'Owner ID is missing or empty',
                affectedFields: ['ownerId'],
                severity: 'high',
                recommendation: 'Ensure owner ID is properly retrieved from database'
            });
        }

        if (!swapData.title || swapData.title.trim() === '' || swapData.title === 'Untitled Swap') {
            issues.push({
                type: 'warning',
                category: 'missing_data',
                description: 'Swap title is missing or using fallback value',
                affectedFields: ['title'],
                severity: 'medium',
                recommendation: 'Verify swap title is properly stored and retrieved'
            });
        }

        if (!swapData.ownerName || swapData.ownerName === 'Unknown User') {
            issues.push({
                type: 'warning',
                category: 'missing_data',
                description: 'Owner name is missing or using fallback value',
                affectedFields: ['ownerName'],
                severity: 'medium',
                recommendation: 'Ensure user name is included in swap data query'
            });
        }

        // Check for invalid status
        const validStatuses = ['active', 'inactive', 'pending', 'completed', 'cancelled'];
        if (!validStatuses.includes(swapData.status)) {
            issues.push({
                type: 'warning',
                category: 'invalid_reference',
                description: `Invalid swap status: ${swapData.status}`,
                affectedFields: ['status'],
                severity: 'medium',
                recommendation: 'Use valid status values and update database if necessary'
            });
        }
    }

    /**
     * Validate targeting data consistency
     * Requirements: 6.1, 6.2 - Consistent targeting information across display elements
     */
    private static validateTargetingConsistency(targeting: ValidatedTargeting, issues: ConsistencyIssue[]): void {
        // Check proposal count consistency
        if (targeting.totalIncomingCount !== targeting.incomingProposals.length) {
            issues.push({
                type: 'error',
                category: 'count_mismatch',
                description: `Proposal count mismatch: totalIncomingCount (${targeting.totalIncomingCount}) != actual proposals (${targeting.incomingProposals.length})`,
                affectedFields: ['targeting.totalIncomingCount', 'targeting.incomingProposals'],
                severity: 'high',
                recommendation: 'Recalculate proposal count or fix proposal array'
            });
        }

        // Check for duplicate proposals
        const proposalIds = targeting.incomingProposals.map(p => p.id);
        const uniqueIds = new Set(proposalIds);
        if (proposalIds.length !== uniqueIds.size) {
            issues.push({
                type: 'warning',
                category: 'data_mismatch',
                description: 'Duplicate proposals detected in incoming proposals array',
                affectedFields: ['targeting.incomingProposals'],
                severity: 'medium',
                recommendation: 'Remove duplicate proposals and update count'
            });
        }

        // Validate individual proposals
        targeting.incomingProposals.forEach((proposal, index) => {
            if (!proposal.proposerId || proposal.proposerId === 'unknown') {
                issues.push({
                    type: 'warning',
                    category: 'missing_data',
                    description: `Proposal ${index + 1} has missing or invalid proposer ID`,
                    affectedFields: [`targeting.incomingProposals[${index}].proposerId`],
                    severity: 'medium',
                    recommendation: 'Ensure proposer information is included in targeting query'
                });
            }

            if (!proposal.proposerName || proposal.proposerName === 'Unknown User') {
                issues.push({
                    type: 'info',
                    category: 'missing_data',
                    description: `Proposal ${index + 1} has missing proposer name`,
                    affectedFields: [`targeting.incomingProposals[${index}].proposerName`],
                    severity: 'low',
                    recommendation: 'Include user names in proposal data retrieval'
                });
            }

            // Check for invalid proposal status
            const validProposalStatuses = ['pending', 'accepted', 'rejected'];
            if (!validProposalStatuses.includes(proposal.status)) {
                issues.push({
                    type: 'warning',
                    category: 'invalid_reference',
                    description: `Proposal ${index + 1} has invalid status: ${proposal.status}`,
                    affectedFields: [`targeting.incomingProposals[${index}].status`],
                    severity: 'medium',
                    recommendation: 'Use valid proposal status values'
                });
            }
        });

        // Validate outgoing target if present
        if (targeting.outgoingTarget) {
            if (!targeting.outgoingTarget.targetSwapId) {
                issues.push({
                    type: 'warning',
                    category: 'missing_data',
                    description: 'Outgoing target has missing target swap ID',
                    affectedFields: ['targeting.outgoingTarget.targetSwapId'],
                    severity: 'medium',
                    recommendation: 'Ensure target swap ID is properly stored'
                });
            }

            if (!targeting.outgoingTarget.targetOwnerName || targeting.outgoingTarget.targetOwnerName === 'Unknown User') {
                issues.push({
                    type: 'info',
                    category: 'missing_data',
                    description: 'Outgoing target has missing target owner name',
                    affectedFields: ['targeting.outgoingTarget.targetOwnerName'],
                    severity: 'low',
                    recommendation: 'Include target owner name in targeting query'
                });
            }
        }
    }

    /**
     * Validate financial data consistency
     * Requirements: 4.1, 4.2, 4.3 - Financial data integrity
     */
    private static validateFinancialConsistency(swapData: CompleteSwapData, issues: ConsistencyIssue[]): void {
        const pricing = swapData.pricing;

        // Check for pricing data consistency
        if (pricing.amount === null && pricing.formatted !== 'Price not set') {
            issues.push({
                type: 'warning',
                category: 'data_mismatch',
                description: 'Null amount but formatted price is not "Price not set"',
                affectedFields: ['pricing.amount', 'pricing.formatted'],
                severity: 'medium',
                recommendation: 'Ensure formatted price matches amount value'
            });
        }

        if (pricing.amount !== null && pricing.formatted === 'Price not set') {
            issues.push({
                type: 'error',
                category: 'data_mismatch',
                description: 'Valid amount but formatted price shows "Price not set"',
                affectedFields: ['pricing.amount', 'pricing.formatted'],
                severity: 'high',
                recommendation: 'Recalculate formatted price from amount'
            });
        }

        // Check for invalid formatted prices
        if (pricing.formatted.includes('NaN') || pricing.formatted.includes('undefined')) {
            issues.push({
                type: 'error',
                category: 'data_mismatch',
                description: `Invalid formatted price contains NaN or undefined: ${pricing.formatted}`,
                affectedFields: ['pricing.formatted'],
                severity: 'high',
                recommendation: 'Fix price formatting logic to handle invalid values'
            });
        }

        // Validate currency consistency
        if (!pricing.currency || pricing.currency.trim() === '') {
            issues.push({
                type: 'warning',
                category: 'missing_data',
                description: 'Currency is missing or empty',
                affectedFields: ['pricing.currency'],
                severity: 'medium',
                recommendation: 'Set default currency or retrieve from user preferences'
            });
        }

        // Check proposal pricing consistency
        swapData.targeting.incomingProposals.forEach((proposal, index) => {
            const proposalPricing = proposal.proposedTerms.pricing;

            if (proposalPricing.formatted.includes('NaN') || proposalPricing.formatted.includes('undefined')) {
                issues.push({
                    type: 'error',
                    category: 'data_mismatch',
                    description: `Proposal ${index + 1} has invalid formatted price: ${proposalPricing.formatted}`,
                    affectedFields: [`targeting.incomingProposals[${index}].proposedTerms.pricing.formatted`],
                    severity: 'high',
                    recommendation: 'Fix proposal price formatting'
                });
            }
        });
    }

    /**
     * Validate temporal consistency
     * Requirements: 6.3 - Data synchronization and consistency
     */
    private static validateTemporalConsistency(swapData: CompleteSwapData, issues: ConsistencyIssue[]): void {
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

        // Check swap creation date
        if (swapData.createdAt > now) {
            issues.push({
                type: 'error',
                category: 'temporal_inconsistency',
                description: 'Swap creation date is in the future',
                affectedFields: ['createdAt'],
                severity: 'high',
                recommendation: 'Verify system clock and database timestamps'
            });
        }

        if (swapData.createdAt < oneYearAgo) {
            issues.push({
                type: 'info',
                category: 'temporal_inconsistency',
                description: 'Swap is older than one year',
                affectedFields: ['createdAt'],
                severity: 'low',
                recommendation: 'Consider archiving old swaps'
            });
        }

        // Check updated date consistency
        if (swapData.updatedAt < swapData.createdAt) {
            issues.push({
                type: 'error',
                category: 'temporal_inconsistency',
                description: 'Updated date is before creation date',
                affectedFields: ['updatedAt', 'createdAt'],
                severity: 'high',
                recommendation: 'Fix timestamp logic in database updates'
            });
        }

        // Check proposal dates
        swapData.targeting.incomingProposals.forEach((proposal, index) => {
            if (proposal.createdAt < swapData.createdAt) {
                issues.push({
                    type: 'error',
                    category: 'temporal_inconsistency',
                    description: `Proposal ${index + 1} created before the target swap`,
                    affectedFields: [`targeting.incomingProposals[${index}].createdAt`, 'createdAt'],
                    severity: 'high',
                    recommendation: 'Verify proposal and swap creation timestamps'
                });
            }

            if (proposal.createdAt > oneYearFromNow) {
                issues.push({
                    type: 'error',
                    category: 'temporal_inconsistency',
                    description: `Proposal ${index + 1} creation date is too far in the future`,
                    affectedFields: [`targeting.incomingProposals[${index}].createdAt`],
                    severity: 'high',
                    recommendation: 'Check system clock and proposal creation logic'
                });
            }
        });
    }

    /**
     * Validate reference integrity
     * Requirements: 6.4 - Data integrity validation
     */
    private static validateReferenceIntegrity(swapData: CompleteSwapData, issues: ConsistencyIssue[]): void {
        // Check for self-referencing proposals (user proposing to their own swap)
        swapData.targeting.incomingProposals.forEach((proposal, index) => {
            if (proposal.proposerId === swapData.ownerId) {
                issues.push({
                    type: 'error',
                    category: 'invalid_reference',
                    description: `Proposal ${index + 1} is a self-proposal (user proposing to their own swap)`,
                    affectedFields: [`targeting.incomingProposals[${index}].proposerId`, 'ownerId'],
                    severity: 'high',
                    recommendation: 'Implement self-exclusion filtering in proposal queries'
                });
            }
        });

        // Check for circular targeting
        if (swapData.targeting.outgoingTarget) {
            const targetSwapId = swapData.targeting.outgoingTarget.targetSwapId;

            // Check if any incoming proposal is from the swap we're targeting
            const circularProposal = swapData.targeting.incomingProposals.find(
                proposal => proposal.proposerSwapId === targetSwapId
            );

            if (circularProposal) {
                issues.push({
                    type: 'warning',
                    category: 'invalid_reference',
                    description: 'Circular targeting detected: targeting a swap that is also proposing to this swap',
                    affectedFields: ['targeting.outgoingTarget', 'targeting.incomingProposals'],
                    severity: 'medium',
                    recommendation: 'Review targeting logic to prevent circular references'
                });
            }
        }
    }

    /**
     * Generate summary statistics for issues
     */
    private static generateSummary(issues: ConsistencyIssue[]): ConsistencyReport['summary'] {
        return {
            errorCount: issues.filter(i => i.type === 'error').length,
            warningCount: issues.filter(i => i.type === 'warning').length,
            infoCount: issues.filter(i => i.type === 'info').length,
            highSeverityCount: issues.filter(i => i.severity === 'high').length
        };
    }

    /**
     * Validate consistency across multiple swaps
     * Requirements: 6.1, 6.2, 6.3 - Cross-swap data consistency
     */
    static validateCrossSwapConsistency(swapDataArray: CompleteSwapData[]): CrossSwapConsistencyReport {
        const timestamp = new Date();
        const swapReports: ConsistencyReport[] = [];
        const globalIssues: ConsistencyIssue[] = [];

        // Validate each swap individually
        swapDataArray.forEach(swapData => {
            const report = this.validateSwapConsistency(swapData);
            swapReports.push(report);
        });

        // Check for cross-swap issues
        this.validateCrossSwapReferences(swapDataArray, globalIssues);
        this.validateUserConsistency(swapDataArray, globalIssues);

        const consistentSwaps = swapReports.filter(r => r.isConsistent).length;
        const inconsistentSwaps = swapReports.length - consistentSwaps;

        const totalIssues = swapReports.reduce((sum, report) => sum + report.issues.length, 0) + globalIssues.length;
        const criticalIssues = swapReports.reduce((sum, report) => sum + report.summary.highSeverityCount, 0) +
            globalIssues.filter(i => i.severity === 'high').length;

        const recommendations = this.generateGlobalRecommendations(swapReports, globalIssues);

        return {
            totalSwapsChecked: swapDataArray.length,
            consistentSwaps,
            inconsistentSwaps,
            globalIssues,
            swapReports,
            summary: {
                totalIssues,
                criticalIssues,
                recommendations
            },
            timestamp
        };
    }

    /**
     * Validate cross-swap references
     */
    private static validateCrossSwapReferences(swapDataArray: CompleteSwapData[], globalIssues: ConsistencyIssue[]): void {
        const swapIds = new Set(swapDataArray.map(s => s.id));
        const userIds = new Set(swapDataArray.map(s => s.ownerId));

        swapDataArray.forEach(swap => {
            // Check if outgoing targets reference valid swaps
            if (swap.targeting.outgoingTarget) {
                const targetSwapId = swap.targeting.outgoingTarget.targetSwapId;
                if (!swapIds.has(targetSwapId)) {
                    globalIssues.push({
                        type: 'warning',
                        category: 'invalid_reference',
                        description: `Swap ${swap.id} targets non-existent swap ${targetSwapId}`,
                        affectedFields: ['targeting.outgoingTarget.targetSwapId'],
                        severity: 'medium',
                        recommendation: 'Verify target swap exists or clean up stale references'
                    });
                }
            }

            // Check if proposal references are valid
            swap.targeting.incomingProposals.forEach(proposal => {
                if (!userIds.has(proposal.proposerId)) {
                    globalIssues.push({
                        type: 'warning',
                        category: 'invalid_reference',
                        description: `Proposal from unknown user ${proposal.proposerId} to swap ${swap.id}`,
                        affectedFields: ['targeting.incomingProposals.proposerId'],
                        severity: 'medium',
                        recommendation: 'Verify proposer user exists or clean up stale proposals'
                    });
                }
            });
        });
    }

    /**
     * Validate user data consistency across swaps
     */
    private static validateUserConsistency(swapDataArray: CompleteSwapData[], globalIssues: ConsistencyIssue[]): void {
        const userNames = new Map<string, string>();

        // Collect user names from all swaps
        swapDataArray.forEach(swap => {
            if (swap.ownerId && swap.ownerName && swap.ownerName !== 'Unknown User') {
                const existingName = userNames.get(swap.ownerId);
                if (existingName && existingName !== swap.ownerName) {
                    globalIssues.push({
                        type: 'warning',
                        category: 'data_mismatch',
                        description: `Inconsistent user name for user ${swap.ownerId}: "${existingName}" vs "${swap.ownerName}"`,
                        affectedFields: ['ownerName'],
                        severity: 'medium',
                        recommendation: 'Ensure consistent user name retrieval across all queries'
                    });
                } else {
                    userNames.set(swap.ownerId, swap.ownerName);
                }
            }
        });
    }

    /**
     * Generate global recommendations
     */
    private static generateGlobalRecommendations(swapReports: ConsistencyReport[], globalIssues: ConsistencyIssue[]): string[] {
        const recommendations = new Set<string>();

        // Add recommendations from individual swap reports
        swapReports.forEach(report => {
            report.issues.forEach(issue => {
                if (issue.severity === 'high') {
                    recommendations.add(issue.recommendation);
                }
            });
        });

        // Add recommendations from global issues
        globalIssues.forEach(issue => {
            if (issue.severity === 'high' || issue.severity === 'medium') {
                recommendations.add(issue.recommendation);
            }
        });

        // Add general recommendations based on patterns
        const totalErrors = swapReports.reduce((sum, report) => sum + report.summary.errorCount, 0);
        const totalHighSeverity = swapReports.reduce((sum, report) => sum + report.summary.highSeverityCount, 0);

        if (totalErrors > 0) {
            recommendations.add('Review and fix data retrieval queries to ensure complete information');
        }

        if (totalHighSeverity > swapReports.length * 0.1) {
            recommendations.add('High number of critical issues detected - consider comprehensive data audit');
        }

        return Array.from(recommendations);
    }
}