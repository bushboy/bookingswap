/**
 * Swap Display Validation Utilities - Main Export
 * Requirements: 4.1, 4.2, 4.3, 6.4 - Comprehensive data validation and sanitization
 */

// Import types and classes for internal use
import {
    CompleteSwapData,
    SwapDataValidator,
    ValidationResult
} from './swapDataValidator';
import {
    DataConsistencyValidator,
    ConsistencyReport,
    CrossSwapConsistencyReport
} from './dataConsistencyValidator';
import { FallbackDataProvider } from './fallbackDataProvider';

// Export all validation utilities
export { FinancialDataHandler, ValidatedPricing, CurrencyConfig } from './financialDataHandler';
export {
    SwapDataValidator,
    CompleteSwapData,
    ProposalDetail,
    TargetDetail,
    ValidatedTargeting,
    ValidationResult
} from './swapDataValidator';
export {
    DataConsistencyValidator,
    ConsistencyIssue,
    ConsistencyReport,
    CrossSwapConsistencyReport
} from './dataConsistencyValidator';
export {
    FallbackDataProvider,
    FallbackConfig,
    FallbackContext
} from './fallbackDataProvider';

/**
 * Convenience class that combines all validation utilities
 * Requirements: 4.1, 4.2, 4.3, 6.4 - Unified validation interface
 */
export class SwapDisplayValidationService {
    /**
     * Complete validation and sanitization pipeline
     */
    static async validateCompleteSwapData(rawSwapData: any): Promise<{
        validatedData: CompleteSwapData | null;
        consistencyReport: ConsistencyReport | null;
        hasErrors: boolean;
        summary: {
            validationPassed: boolean;
            consistencyPassed: boolean;
            errorCount: number;
            warningCount: number;
            recommendations: string[];
        };
    }> {
        try {
            // Step 1: Validate and sanitize the raw data
            const validationResult = SwapDataValidator.validateAndSanitize(rawSwapData);

            if (!validationResult.isValid || !validationResult.sanitizedData) {
                // Provide fallback data when validation fails
                const fallbackData = FallbackDataProvider.getEmptySwapData(
                    rawSwapData?.id || 'unknown',
                    {
                        attemptedOperation: 'validateCompleteSwapData',
                        originalError: new Error('Validation failed')
                    }
                );

                return {
                    validatedData: fallbackData,
                    consistencyReport: null,
                    hasErrors: true,
                    summary: {
                        validationPassed: false,
                        consistencyPassed: false,
                        errorCount: validationResult.errors.length,
                        warningCount: validationResult.warnings.length,
                        recommendations: [
                            'Fix data validation errors before proceeding',
                            ...validationResult.errors.map((error: string) => `Validation: ${error}`)
                        ]
                    }
                };
            }

            // Step 2: Check data consistency
            const consistencyReport = DataConsistencyValidator.validateSwapConsistency(validationResult.sanitizedData);

            const totalErrors = validationResult.errors.length + consistencyReport.summary.errorCount;
            const totalWarnings = validationResult.warnings.length + consistencyReport.summary.warningCount;

            const recommendations: string[] = [];

            // Add validation recommendations
            if (validationResult.errors.length > 0) {
                recommendations.push(...validationResult.errors.map((error: string) => `Validation: ${error}`));
            }

            // Add consistency recommendations
            consistencyReport.issues
                .filter(issue => issue.severity === 'high' || issue.severity === 'medium')
                .forEach(issue => recommendations.push(`Consistency: ${issue.recommendation}`));

            return {
                validatedData: validationResult.sanitizedData,
                consistencyReport,
                hasErrors: totalErrors > 0,
                summary: {
                    validationPassed: validationResult.isValid,
                    consistencyPassed: consistencyReport.isConsistent,
                    errorCount: totalErrors,
                    warningCount: totalWarnings,
                    recommendations
                }
            };

        } catch (error: any) {
            // Use fallback data provider for error handling
            const fallbackData = FallbackDataProvider.getContextualFallback(
                error instanceof Error ? error : new Error(String(error)),
                rawSwapData?.id
            );

            return {
                validatedData: fallbackData,
                consistencyReport: null,
                hasErrors: true,
                summary: {
                    validationPassed: false,
                    consistencyPassed: false,
                    errorCount: 1,
                    warningCount: 0,
                    recommendations: [
                        'Critical validation error occurred - using fallback data',
                        'Review data source and validation logic'
                    ]
                }
            };
        }
    }

    /**
     * Batch validation for multiple swaps
     */
    static async validateBatchSwapData(rawSwapDataArray: any[]): Promise<{
        validatedSwaps: CompleteSwapData[];
        consistencyReport: CrossSwapConsistencyReport | null;
        hasErrors: boolean;
        summary: {
            totalProcessed: number;
            validationPassed: number;
            validationFailed: number;
            consistencyPassed: number;
            consistencyFailed: number;
            recommendations: string[];
        };
    }> {
        try {
            // Step 1: Batch validation
            const batchResult = SwapDataValidator.validateBatch(rawSwapDataArray);

            // Step 2: Cross-swap consistency validation
            let consistencyReport: CrossSwapConsistencyReport | null = null;
            if (batchResult.validSwaps.length > 0) {
                consistencyReport = DataConsistencyValidator.validateCrossSwapConsistency(batchResult.validSwaps);
            }

            const recommendations: string[] = [];

            if (batchResult.invalidSwaps.length > 0) {
                recommendations.push(`${batchResult.invalidSwaps.length} swaps failed validation`);
                recommendations.push('Review data source quality and completeness');
            }

            if (consistencyReport && consistencyReport.summary.criticalIssues > 0) {
                recommendations.push(...consistencyReport.summary.recommendations);
            }

            return {
                validatedSwaps: batchResult.validSwaps,
                consistencyReport,
                hasErrors: batchResult.invalidSwaps.length > 0 || (consistencyReport?.summary.criticalIssues || 0) > 0,
                summary: {
                    totalProcessed: rawSwapDataArray.length,
                    validationPassed: batchResult.validSwaps.length,
                    validationFailed: batchResult.invalidSwaps.length,
                    consistencyPassed: consistencyReport?.consistentSwaps || 0,
                    consistencyFailed: consistencyReport?.inconsistentSwaps || 0,
                    recommendations
                }
            };

        } catch (error: any) {
            return {
                validatedSwaps: [],
                consistencyReport: null,
                hasErrors: true,
                summary: {
                    totalProcessed: rawSwapDataArray.length,
                    validationPassed: 0,
                    validationFailed: rawSwapDataArray.length,
                    consistencyPassed: 0,
                    consistencyFailed: 0,
                    recommendations: [
                        'Batch validation failed completely',
                        'Check data format and validation service availability'
                    ]
                }
            };
        }
    }

    /**
     * Safe data retrieval with automatic validation and fallbacks
     */
    static async safeGetValidatedSwapData(
        swapId: string,
        dataProvider: () => Promise<any>
    ): Promise<CompleteSwapData> {
        return FallbackDataProvider.safeGetSwapData(
            swapId,
            async () => {
                const rawData = await dataProvider();
                const validationResult = await this.validateCompleteSwapData(rawData);

                if (validationResult.validatedData) {
                    return validationResult.validatedData;
                }

                throw new Error(`Validation failed: ${validationResult.summary.recommendations.join(', ')}`);
            },
            { attemptedOperation: 'safeGetValidatedSwapData' }
        );
    }
}