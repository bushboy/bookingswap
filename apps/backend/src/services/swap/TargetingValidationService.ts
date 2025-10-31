import {
    SwapCardData,
    EnhancedSwapCardData,
    TargetingValidationResult,
    EnhancedTargetingRestriction
} from '@booking-swap/shared';
import {
    TargetingDisplayData,
    TargetingValidationResult as DisplayValidationResult
} from './TargetingDataTransformer';
import { TargetingDisplayErrorHandler } from './TargetingDisplayErrorHandler';
import { logger } from '../../utils/logger';

/**
 * Service for validating and handling targeting display data
 * Integrates error handling with the targeting display pipeline
 * Requirements: 3.5, 3.6
 */
export class TargetingValidationService {

    /**
     * Validate and process targeting data with error handling
     * Requirements: 3.5, 3.6
     */
    static async validateAndProcessTargetingData(
        swapData: SwapCardData[],
        rawTargetingData: Partial<TargetingDisplayData>[]
    ): Promise<{
        enhancedSwapData: EnhancedSwapCardData[];
        validationResult: DisplayValidationResult;
        userMessages: { [swapId: string]: string[] };
    }> {
        try {
            logger.info('Validating and processing targeting data', {
                swapCount: swapData.length,
                targetingDataCount: rawTargetingData.length
            });

            // Step 1: Handle partial or missing targeting data
            const enhancedSwapData = TargetingDisplayErrorHandler.handlePartialTargetingData(
                swapData,
                rawTargetingData
            );

            // Step 2: Validate consistency of available targeting data
            const completeTargetingData = rawTargetingData.filter(
                data => data.swapId && this.isCompleteTargetingData(data)
            ) as TargetingDisplayData[];

            const validationResult = TargetingDisplayErrorHandler.validateTargetingConsistency(
                completeTargetingData
            );

            // Step 3: Generate user-friendly messages
            const userMessages = TargetingDisplayErrorHandler.generateUserFriendlyErrorMessages(
                validationResult.issues
            );

            // Step 4: Log validation results for monitoring
            if (!validationResult.isValid) {
                logger.warn('Targeting data validation issues detected', {
                    issueCount: validationResult.issues.length,
                    highSeverityIssues: validationResult.issues.filter(i => i.severity === 'high').length,
                    affectedSwaps: [...new Set(validationResult.issues.flatMap(i => i.affectedSwapIds))]
                });
            }

            return {
                enhancedSwapData,
                validationResult,
                userMessages
            };

        } catch (error) {
            logger.error('Failed to validate and process targeting data', { error });

            // Return safe fallback data
            const fallbackSwapData = swapData.map(swap => ({
                ...swap,
                targeting: {
                    incomingTargets: [],
                    incomingTargetCount: 0,
                    outgoingTarget: undefined,
                    canReceiveTargets: false,
                    canTarget: false,
                    targetingRestrictions: [{
                        type: 'swap_unavailable' as const,
                        message: 'Error processing targeting data',
                        severity: 'error' as const
                    }]
                }
            }));

            return {
                enhancedSwapData: fallbackSwapData,
                validationResult: {
                    isValid: false,
                    issues: [{
                        type: 'orphaned_target',
                        description: 'System error during validation',
                        affectedSwapIds: swapData.map(s => s.userSwap.id),
                        severity: 'high'
                    }],
                    recommendations: ['Contact system administrator']
                },
                userMessages: {}
            };
        }
    }

    /**
     * Validate targeting data for a specific swap
     * Requirements: 3.5, 3.6
     */
    static async validateSwapTargetingData(
        swapId: string,
        targetingData?: Partial<TargetingDisplayData>
    ): Promise<{
        isValid: boolean;
        restrictions: EnhancedTargetingRestriction[];
        fallbackData?: TargetingDisplayData;
    }> {
        try {
            if (!targetingData) {
                return {
                    isValid: false,
                    restrictions: [{
                        type: 'swap_unavailable',
                        message: 'No targeting data available',
                        severity: 'warning'
                    }],
                    fallbackData: TargetingDisplayErrorHandler.createFallbackTargetingDisplay(
                        swapId,
                        'no_data'
                    )
                };
            }

            // Check data completeness
            const isComplete = this.isCompleteTargetingData(targetingData);
            if (!isComplete) {
                const recoveredData = TargetingDisplayErrorHandler.recoverFromDataCorruption(targetingData);

                return {
                    isValid: false,
                    restrictions: [{
                        type: 'swap_unavailable',
                        message: 'Targeting data is incomplete',
                        severity: 'warning'
                    }],
                    fallbackData: recoveredData
                };
            }

            // Validate consistency
            const validationResult = TargetingDisplayErrorHandler.validateTargetingConsistency([
                targetingData as TargetingDisplayData
            ]);

            if (!validationResult.isValid) {
                const restrictions: EnhancedTargetingRestriction[] = validationResult.issues.map(issue => ({
                    type: 'swap_unavailable',
                    message: issue.description,
                    severity: issue.severity === 'high' ? 'error' : 'warning'
                }));

                return {
                    isValid: false,
                    restrictions,
                    fallbackData: TargetingDisplayErrorHandler.recoverFromDataCorruption(targetingData)
                };
            }

            return {
                isValid: true,
                restrictions: []
            };

        } catch (error) {
            logger.error('Failed to validate swap targeting data', { error, swapId });

            return {
                isValid: false,
                restrictions: [{
                    type: 'swap_unavailable',
                    message: 'Validation error',
                    severity: 'error'
                }],
                fallbackData: TargetingDisplayErrorHandler.createFallbackTargetingDisplay(
                    swapId,
                    'validation_error'
                )
            };
        }
    }

    /**
     * Create enhanced targeting restrictions from validation issues
     * Requirements: 3.6
     */
    static createRestrictionsFromValidation(
        validationResult: TargetingValidationResult
    ): EnhancedTargetingRestriction[] {
        const restrictions: EnhancedTargetingRestriction[] = [];

        if (!validationResult.isValid) {
            validationResult.errors.forEach(error => {
                restrictions.push({
                    type: 'swap_unavailable',
                    message: error,
                    severity: 'error'
                });
            });
        }

        validationResult.warnings.forEach(warning => {
            restrictions.push({
                type: 'swap_unavailable',
                message: warning,
                severity: 'warning'
            });
        });

        return restrictions;
    }

    /**
     * Check if targeting data is complete and valid
     */
    private static isCompleteTargetingData(data: Partial<TargetingDisplayData>): data is TargetingDisplayData {
        return !!(
            data.swapId &&
            typeof data.incomingCount === 'number' &&
            typeof data.outgoingCount === 'number' &&
            Array.isArray(data.incomingTargets) &&
            Array.isArray(data.outgoingTargets) &&
            data.incomingCount === data.incomingTargets.length &&
            data.outgoingCount === data.outgoingTargets.length
        );
    }

    /**
     * Get user-friendly message for validation issue types
     */
    private static getIssueUserMessage(issueType: string): string {
        switch (issueType) {
            case 'missing_bidirectional':
                return 'Some targeting relationships may not be displayed correctly.';
            case 'duplicate_relationship':
                return 'Duplicate targeting information detected.';
            case 'orphaned_target':
                return 'Some targeting connections appear to be broken.';
            case 'status_mismatch':
                return 'Targeting status information may be outdated.';
            default:
                return 'Targeting information may not be fully accurate.';
        }
    }
}