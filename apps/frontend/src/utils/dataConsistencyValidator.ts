import { SwapCardData, EnhancedSwapCardData } from '@booking-swap/shared';

/**
 * Data Consistency Validator
 * 
 * This utility provides comprehensive validation and consistency checking
 * for swap data across all display elements.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    score: number; // 0-100, where 100 is perfect consistency
}

export interface ValidationError {
    field: string;
    message: string;
    severity: 'critical' | 'major' | 'minor';
    suggestion?: string;
}

export interface ValidationWarning {
    field: string;
    message: string;
    impact: 'display' | 'functionality' | 'user_experience';
}

export interface ConsistencyCheckResult {
    swapId: string;
    timestamp: Date;
    isConsistent: boolean;
    discrepancies: DataDiscrepancy[];
    overallScore: number;
}

export interface DataDiscrepancy {
    type: 'missing_data' | 'invalid_format' | 'inconsistent_values' | 'stale_data';
    field: string;
    expected: any;
    actual: any;
    impact: 'low' | 'medium' | 'high';
    description: string;
}

class DataConsistencyValidator {
    private readonly CRITICAL_FIELDS = [
        'userSwap.id',
        'userSwap.status',
        'userSwap.bookingDetails.title'
    ];

    private readonly FINANCIAL_FIELDS = [
        'userSwap.bookingDetails.swapValue',
        'userSwap.bookingDetails.currency'
    ];

    private readonly TARGETING_FIELDS = [
        'targeting.incomingTargets',
        'targeting.outgoingTarget'
    ];

    /**
     * Validate swap card data for consistency and completeness
     */
    validateSwapData(data: SwapCardData): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Validate critical fields
        this.validateCriticalFields(data, errors);

        // Validate financial data
        this.validateFinancialData(data, errors, warnings);

        // Validate targeting data if present
        if ('targeting' in data) {
            this.validateTargetingData(data as EnhancedSwapCardData, errors, warnings);
        }

        // Validate data freshness
        this.validateDataFreshness(data, warnings);

        // Calculate consistency score
        const score = this.calculateConsistencyScore(errors, warnings);

        return {
            isValid: errors.filter(e => e.severity === 'critical').length === 0,
            errors,
            warnings,
            score
        };
    }

    /**
     * Check consistency between multiple data sources
     */
    checkDataConsistency(
        swapData: SwapCardData,
        alternativeData?: Partial<SwapCardData>
    ): ConsistencyCheckResult {
        const discrepancies: DataDiscrepancy[] = [];

        if (alternativeData) {
            // Compare swap IDs
            if (alternativeData.userSwap?.id && alternativeData.userSwap.id !== swapData.userSwap.id) {
                discrepancies.push({
                    type: 'inconsistent_values',
                    field: 'userSwap.id',
                    expected: swapData.userSwap.id,
                    actual: alternativeData.userSwap.id,
                    impact: 'high',
                    description: 'Swap ID mismatch between data sources'
                });
            }

            // Compare status
            if (alternativeData.userSwap?.status && alternativeData.userSwap.status !== swapData.userSwap.status) {
                discrepancies.push({
                    type: 'inconsistent_values',
                    field: 'userSwap.status',
                    expected: swapData.userSwap.status,
                    actual: alternativeData.userSwap.status,
                    impact: 'high',
                    description: 'Status mismatch between data sources'
                });
            }

            // Compare financial data
            if (alternativeData.userSwap?.bookingDetails?.swapValue !== undefined &&
                alternativeData.userSwap.bookingDetails.swapValue !== swapData.userSwap.bookingDetails.swapValue) {
                discrepancies.push({
                    type: 'inconsistent_values',
                    field: 'userSwap.bookingDetails.swapValue',
                    expected: swapData.userSwap.bookingDetails.swapValue,
                    actual: alternativeData.userSwap.bookingDetails.swapValue,
                    impact: 'medium',
                    description: 'Swap value mismatch between data sources'
                });
            }
        }

        // Check for internal consistency issues
        this.checkInternalConsistency(swapData, discrepancies);

        const overallScore = this.calculateOverallConsistencyScore(discrepancies);

        return {
            swapId: swapData.userSwap.id,
            timestamp: new Date(),
            isConsistent: discrepancies.filter(d => d.impact === 'high').length === 0,
            discrepancies,
            overallScore
        };
    }

    /**
     * Detect and log data discrepancies
     */
    detectDiscrepancies(
        currentData: SwapCardData,
        previousData?: SwapCardData,
        externalData?: any
    ): DataDiscrepancy[] {
        const discrepancies: DataDiscrepancy[] = [];

        // Compare with previous data if available
        if (previousData) {
            this.compareDataVersions(currentData, previousData, discrepancies);
        }

        // Compare with external data sources if available
        if (externalData) {
            this.compareWithExternalData(currentData, externalData, discrepancies);
        }

        // Log discrepancies for monitoring
        if (discrepancies.length > 0) {
            console.warn(`Data discrepancies detected for swap ${currentData.userSwap.id}:`, discrepancies);
        }

        return discrepancies;
    }

    /**
     * Validate that all display elements show the same underlying data
     */
    validateDisplayConsistency(
        swapData: SwapCardData,
        displayElements: { [elementName: string]: any }
    ): { isConsistent: boolean; issues: string[] } {
        const issues: string[] = [];

        // Check each display element against the source data
        Object.entries(displayElements).forEach(([elementName, elementData]) => {
            if (elementData.swapId !== swapData.userSwap.id) {
                issues.push(`${elementName}: Swap ID mismatch`);
            }

            if (elementData.status !== swapData.userSwap.status) {
                issues.push(`${elementName}: Status mismatch`);
            }

            if (elementData.title !== swapData.userSwap.bookingDetails.title) {
                issues.push(`${elementName}: Title mismatch`);
            }

            // Check financial data consistency
            if (elementData.swapValue !== swapData.userSwap.bookingDetails.swapValue) {
                issues.push(`${elementName}: Swap value mismatch`);
            }
        });

        return {
            isConsistent: issues.length === 0,
            issues
        };
    }

    // Private validation methods

    private validateCriticalFields(data: SwapCardData, errors: ValidationError[]): void {
        try {
            // Validate swap ID
            if (!data?.userSwap?.id || data.userSwap.id.trim().length === 0) {
                errors.push({
                    field: 'userSwap.id',
                    message: 'Swap ID is missing or empty',
                    severity: 'critical',
                    suggestion: 'Ensure swap ID is properly set from the database'
                });
            }

            // Validate status
            if (!data?.userSwap?.status) {
                errors.push({
                    field: 'userSwap.status',
                    message: 'Swap status is missing',
                    severity: 'critical',
                    suggestion: 'Set a valid swap status (pending, accepted, rejected, etc.)'
                });
            }

            // Validate booking details exist
            if (!data?.userSwap?.bookingDetails) {
                errors.push({
                    field: 'userSwap.bookingDetails',
                    message: 'Booking details are missing',
                    severity: 'critical',
                    suggestion: 'Ensure booking details are properly fetched from the database'
                });
                return; // Don't continue if booking details are null
            }

            // Validate booking title
            if (!data.userSwap.bookingDetails.title || data.userSwap.bookingDetails.title === 'Untitled Booking') {
                errors.push({
                    field: 'userSwap.bookingDetails.title',
                    message: 'Booking title is missing or using default value',
                    severity: 'major',
                    suggestion: 'Fetch the actual booking title from the database'
                });
            }
        } catch (error) {
            errors.push({
                field: 'data_structure',
                message: 'Data structure is malformed',
                severity: 'critical',
                suggestion: 'Ensure data follows the expected SwapCardData interface'
            });
        }
    }

    private validateFinancialData(
        data: SwapCardData,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        try {
            // Check if booking details exist
            if (!data?.userSwap?.bookingDetails) {
                return; // Already handled in validateCriticalFields
            }

            const { swapValue, currency } = data.userSwap.bookingDetails;

            // Check for null swap value (should be handled gracefully)
            if (swapValue === null) {
                warnings.push({
                    field: 'userSwap.bookingDetails.swapValue',
                    message: 'Swap value is null - should display "Price not set"',
                    impact: 'display'
                });
            }

            // Check for invalid swap value
            if (swapValue !== null && (isNaN(swapValue) || swapValue < 0)) {
                errors.push({
                    field: 'userSwap.bookingDetails.swapValue',
                    message: 'Swap value is invalid (NaN or negative)',
                    severity: 'major',
                    suggestion: 'Validate and sanitize financial data before display'
                });
            }

            // Check currency
            if (!currency || currency.trim().length === 0) {
                warnings.push({
                    field: 'userSwap.bookingDetails.currency',
                    message: 'Currency is missing',
                    impact: 'display'
                });
            }
        } catch (error) {
            errors.push({
                field: 'financial_data',
                message: 'Error validating financial data',
                severity: 'major',
                suggestion: 'Check financial data structure'
            });
        }
    }

    private validateTargetingData(
        data: EnhancedSwapCardData,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        const { targeting } = data;

        if (!targeting) {
            warnings.push({
                field: 'targeting',
                message: 'Targeting data is missing from enhanced swap data',
                impact: 'functionality'
            });
            return;
        }

        // Validate incoming targets
        targeting.incomingTargets.forEach((target, index) => {
            if (!target.proposerName || target.proposerName === 'Unknown User') {
                warnings.push({
                    field: `targeting.incomingTargets[${index}].proposerName`,
                    message: 'Proposer name is missing or unknown',
                    impact: 'user_experience'
                });
            }

            if (!target.proposerSwapTitle || target.proposerSwapTitle === 'Untitled Swap') {
                warnings.push({
                    field: `targeting.incomingTargets[${index}].proposerSwapTitle`,
                    message: 'Proposer swap title is missing or using default',
                    impact: 'user_experience'
                });
            }
        });

        // Validate outgoing target
        if (targeting.outgoingTarget) {
            if (!targeting.outgoingTarget.targetOwnerName || targeting.outgoingTarget.targetOwnerName === 'Unknown User') {
                warnings.push({
                    field: 'targeting.outgoingTarget.targetOwnerName',
                    message: 'Target owner name is missing or unknown',
                    impact: 'user_experience'
                });
            }
        }
    }

    private validateDataFreshness(data: SwapCardData, warnings: ValidationWarning[]): void {
        const now = new Date();
        const createdAt = new Date(data.userSwap.createdAt);
        const ageInMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

        // Warn if data seems stale (older than 5 minutes without updates)
        if (ageInMinutes > 5) {
            warnings.push({
                field: 'userSwap.createdAt',
                message: 'Data may be stale - consider refreshing',
                impact: 'user_experience'
            });
        }
    }

    private calculateConsistencyScore(errors: ValidationError[], warnings: ValidationWarning[]): number {
        let score = 100;

        // Deduct points for errors
        errors.forEach(error => {
            switch (error.severity) {
                case 'critical':
                    score -= 30;
                    break;
                case 'major':
                    score -= 15;
                    break;
                case 'minor':
                    score -= 5;
                    break;
            }
        });

        // Deduct points for warnings
        warnings.forEach(warning => {
            switch (warning.impact) {
                case 'functionality':
                    score -= 10;
                    break;
                case 'user_experience':
                    score -= 5;
                    break;
                case 'display':
                    score -= 2;
                    break;
            }
        });

        return Math.max(0, score);
    }

    private checkInternalConsistency(data: SwapCardData, discrepancies: DataDiscrepancy[]): void {
        // Check if dates make sense
        if (data.userSwap.expiresAt && data.userSwap.expiresAt < data.userSwap.createdAt) {
            discrepancies.push({
                type: 'invalid_format',
                field: 'userSwap.expiresAt',
                expected: 'Date after creation',
                actual: data.userSwap.expiresAt,
                impact: 'medium',
                description: 'Expiration date is before creation date'
            });
        }

        // Check location consistency
        if (!data.userSwap.bookingDetails.location.city && data.userSwap.bookingDetails.location.country) {
            discrepancies.push({
                type: 'missing_data',
                field: 'userSwap.bookingDetails.location.city',
                expected: 'City name',
                actual: null,
                impact: 'low',
                description: 'Country is specified but city is missing'
            });
        }
    }

    private compareDataVersions(
        current: SwapCardData,
        previous: SwapCardData,
        discrepancies: DataDiscrepancy[]
    ): void {
        // Compare critical fields that shouldn't change
        if (current.userSwap.id !== previous.userSwap.id) {
            discrepancies.push({
                type: 'inconsistent_values',
                field: 'userSwap.id',
                expected: previous.userSwap.id,
                actual: current.userSwap.id,
                impact: 'high',
                description: 'Swap ID changed between data versions'
            });
        }

        // Compare booking details that shouldn't change frequently
        if (current.userSwap.bookingDetails.title !== previous.userSwap.bookingDetails.title) {
            discrepancies.push({
                type: 'inconsistent_values',
                field: 'userSwap.bookingDetails.title',
                expected: previous.userSwap.bookingDetails.title,
                actual: current.userSwap.bookingDetails.title,
                impact: 'medium',
                description: 'Booking title changed unexpectedly'
            });
        }
    }

    private compareWithExternalData(
        current: SwapCardData,
        external: any,
        discrepancies: DataDiscrepancy[]
    ): void {
        // Compare with external data source (e.g., direct API response)
        if (external.id && external.id !== current.userSwap.id) {
            discrepancies.push({
                type: 'inconsistent_values',
                field: 'userSwap.id',
                expected: external.id,
                actual: current.userSwap.id,
                impact: 'high',
                description: 'Swap ID differs from external data source'
            });
        }

        if (external.status && external.status !== current.userSwap.status) {
            discrepancies.push({
                type: 'stale_data',
                field: 'userSwap.status',
                expected: external.status,
                actual: current.userSwap.status,
                impact: 'high',
                description: 'Status is outdated compared to external source'
            });
        }
    }

    private calculateOverallConsistencyScore(discrepancies: DataDiscrepancy[]): number {
        let score = 100;

        discrepancies.forEach(discrepancy => {
            switch (discrepancy.impact) {
                case 'high':
                    score -= 25;
                    break;
                case 'medium':
                    score -= 10;
                    break;
                case 'low':
                    score -= 3;
                    break;
            }
        });

        return Math.max(0, score);
    }
}

// Export singleton instance
export const dataConsistencyValidator = new DataConsistencyValidator();
export default dataConsistencyValidator;