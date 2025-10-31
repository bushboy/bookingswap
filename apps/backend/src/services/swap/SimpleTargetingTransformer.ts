import { SwapTargetStatus } from '@booking-swap/shared';
import { logger } from '../../utils/logger';

/**
 * Simple targeting data structure for linear transformation
 * Designed to replace the complex TargetingDataTransformer with a straightforward approach
 * Requirements: 1.1, 1.2
 */
export interface SimpleTargetingData {
    swapId: string;
    incomingTargets: Array<{
        id: string;
        sourceSwapId: string;
        ownerName: string;
        bookingTitle: string;
        status: SwapTargetStatus;
    }>;
    outgoingTarget?: {
        id: string;
        targetSwapId: string;
        ownerName: string;
        bookingTitle: string;
        status: SwapTargetStatus;
    };
}

/**
 * Raw targeting data from repository queries
 */
export interface RawTargetingData {
    direction: 'incoming' | 'outgoing';
    target_id: string;
    target_swap_id: string;
    source_swap_id: string;
    proposal_id: string;
    status: SwapTargetStatus;
    created_at: Date;
    updated_at: Date;
    booking_title: string;
    booking_city: string;
    booking_country: string;
    check_in: Date;
    check_out: Date;
    price: number;
    owner_name: string;
    owner_email: string;
    data_source: 'swap_targets' | 'proposals';
}

/**
 * Validation result for targeting data
 */
export interface TargetingValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    processedCount: number;
    skippedCount: number;
}

/**
 * Debug context for logging
 */
export interface DebugContext {
    step: string;
    userId?: string;
    swapId?: string;
    targetId?: string;
    dataCount?: number;
    [key: string]: any;
}

/**
 * Simple targeting data transformer with comprehensive logging
 * Replaces complex transformation logic with linear, debuggable approach
 * Requirements: 1.1, 1.2
 */
export class SimpleTargetingTransformer {
    private static readonly LOG_PREFIX = '[SimpleTargetingTransformer]';

    /**
     * Transform raw targeting data into simple, display-ready format
     * Uses linear transformation with extensive logging at each step
     * Requirements: 1.1, 1.2
     */
    static transform(rawData: RawTargetingData[]): SimpleTargetingData[] {
        const context: DebugContext = {
            step: 'transform_start',
            dataCount: rawData ? rawData.length : 0
        };

        try {
            // Step 1: Validate input data first (before accessing any properties)
            const validationResult = this.validateInputData(rawData);

            this.logStep('Starting transformation', context);

            if (!validationResult.isValid) {
                this.logError('Input validation failed', {
                    ...context,
                    step: 'input_validation',
                    errors: validationResult.errors,
                    warnings: validationResult.warnings
                });

                if (validationResult.errors.length > 0) {
                    throw new Error(`Input validation failed: ${validationResult.errors.join(', ')}`);
                }
            }

            this.logStep('Input validation completed', {
                ...context,
                step: 'input_validation_complete',
                processedCount: validationResult.processedCount,
                skippedCount: validationResult.skippedCount,
                warnings: validationResult.warnings
            });

            // Step 2: Group data by swap ID
            const groupedData = this.groupDataBySwapId(rawData);

            this.logStep('Data grouped by swap ID', {
                ...context,
                step: 'data_grouping_complete',
                swapCount: groupedData.size,
                swapIds: Array.from(groupedData.keys())
            });

            // Step 3: Transform each group into SimpleTargetingData
            const transformedData: SimpleTargetingData[] = [];

            for (const [swapId, swapData] of groupedData) {
                try {
                    const swapContext: DebugContext = {
                        ...context,
                        step: 'transform_swap',
                        swapId,
                        incomingCount: swapData.incoming.length,
                        outgoingCount: swapData.outgoing.length
                    };

                    this.logStep(`Transforming swap ${swapId}`, swapContext);

                    const simpleData = this.transformSwapData(swapId, swapData);
                    transformedData.push(simpleData);

                    this.logStep(`Successfully transformed swap ${swapId}`, {
                        ...swapContext,
                        step: 'transform_swap_complete',
                        resultIncomingCount: simpleData.incomingTargets.length,
                        hasOutgoingTarget: !!simpleData.outgoingTarget
                    });

                } catch (swapError) {
                    this.logError(`Failed to transform swap ${swapId}`, {
                        ...context,
                        step: 'transform_swap_error',
                        swapId,
                        error: swapError
                    });

                    // Continue with other swaps instead of failing completely
                    continue;
                }
            }

            this.logStep('Transformation completed successfully', {
                ...context,
                step: 'transform_complete',
                inputCount: rawData.length,
                outputCount: transformedData.length,
                swapsProcessed: transformedData.length
            });

            return transformedData;

        } catch (error) {
            this.logError('Transformation failed', {
                ...context,
                step: 'transform_error',
                error
            });
            throw error;
        }
    }

    /**
     * Validate incoming targeting data
     * Requirements: 1.1, 1.2
     */
    static validateIncomingTargets(targets: SimpleTargetingData['incomingTargets']): TargetingValidationResult {
        const context: DebugContext = {
            step: 'validate_incoming_targets',
            targetCount: targets.length
        };

        this.logStep('Validating incoming targets', context);

        const errors: string[] = [];
        const warnings: string[] = [];
        let processedCount = 0;
        let skippedCount = 0;

        for (const target of targets) {
            try {
                const targetContext: DebugContext = {
                    ...context,
                    targetId: target.id,
                    sourceSwapId: target.sourceSwapId
                };

                // Validate required fields
                if (!target.id || typeof target.id !== 'string') {
                    errors.push(`Invalid target ID: ${target.id}`);
                    skippedCount++;
                    continue;
                }

                if (!target.sourceSwapId || typeof target.sourceSwapId !== 'string') {
                    errors.push(`Invalid source swap ID for target ${target.id}: ${target.sourceSwapId}`);
                    skippedCount++;
                    continue;
                }

                if (!target.ownerName || typeof target.ownerName !== 'string') {
                    warnings.push(`Missing or invalid owner name for target ${target.id}`);
                }

                if (!target.bookingTitle || typeof target.bookingTitle !== 'string') {
                    warnings.push(`Missing or invalid booking title for target ${target.id}`);
                }

                if (!target.status || !this.isValidTargetStatus(target.status)) {
                    errors.push(`Invalid status for target ${target.id}: ${target.status}`);
                    skippedCount++;
                    continue;
                }

                processedCount++;
                this.logStep(`Validated incoming target ${target.id}`, targetContext);

            } catch (targetError) {
                this.logError(`Error validating incoming target`, {
                    ...context,
                    targetId: target.id,
                    error: targetError
                });
                errors.push(`Validation error for target ${target.id}: ${targetError}`);
                skippedCount++;
            }
        }

        const result: TargetingValidationResult = {
            isValid: errors.length === 0,
            errors,
            warnings,
            processedCount,
            skippedCount
        };

        this.logStep('Incoming targets validation completed', {
            ...context,
            step: 'validate_incoming_complete',
            ...result
        });

        return result;
    }

    /**
     * Validate outgoing targeting data
     * Requirements: 1.1, 1.2
     */
    static validateOutgoingTarget(target: SimpleTargetingData['outgoingTarget']): TargetingValidationResult {
        const context: DebugContext = {
            step: 'validate_outgoing_target',
            hasTarget: !!target
        };

        this.logStep('Validating outgoing target', context);

        const errors: string[] = [];
        const warnings: string[] = [];

        if (!target) {
            this.logStep('No outgoing target to validate', context);
            return {
                isValid: true,
                errors: [],
                warnings: [],
                processedCount: 0,
                skippedCount: 0
            };
        }

        try {
            const targetContext: DebugContext = {
                ...context,
                targetId: target.id,
                targetSwapId: target.targetSwapId
            };

            // Validate required fields
            if (!target.id || typeof target.id !== 'string') {
                errors.push(`Invalid target ID: ${target.id}`);
            }

            if (!target.targetSwapId || typeof target.targetSwapId !== 'string') {
                errors.push(`Invalid target swap ID: ${target.targetSwapId}`);
            }

            if (!target.ownerName || typeof target.ownerName !== 'string') {
                warnings.push(`Missing or invalid owner name for outgoing target ${target.id}`);
            }

            if (!target.bookingTitle || typeof target.bookingTitle !== 'string') {
                warnings.push(`Missing or invalid booking title for outgoing target ${target.id}`);
            }

            if (!target.status || !this.isValidTargetStatus(target.status)) {
                errors.push(`Invalid status for outgoing target ${target.id}: ${target.status}`);
            }

            this.logStep('Outgoing target validation completed', {
                ...targetContext,
                step: 'validate_outgoing_complete',
                isValid: errors.length === 0,
                errorCount: errors.length,
                warningCount: warnings.length
            });

        } catch (targetError) {
            this.logError('Error validating outgoing target', {
                ...context,
                targetId: target?.id,
                error: targetError
            });
            errors.push(`Validation error for outgoing target: ${targetError}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            processedCount: errors.length === 0 ? 1 : 0,
            skippedCount: errors.length > 0 ? 1 : 0
        };
    }

    /**
     * Handle transformation errors with detailed context logging
     * Requirements: 1.1, 1.2
     */
    static handleTransformationError(error: Error, context: DebugContext): SimpleTargetingData[] {
        const errorContext: DebugContext = {
            ...context,
            step: 'error_handling',
            errorType: error.constructor.name,
            errorMessage: error.message
        };

        this.logError('Handling transformation error', errorContext);

        // Log error details for debugging
        this.logError('Detailed error information', {
            ...errorContext,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // Return empty array as fallback
        this.logStep('Returning empty array as fallback', errorContext);
        return [];
    }

    /**
     * Group raw data by swap ID for processing
     * Private helper method with logging
     */
    private static groupDataBySwapId(rawData: RawTargetingData[]): Map<string, { incoming: RawTargetingData[], outgoing: RawTargetingData[] }> {
        const context: DebugContext = {
            step: 'group_data_by_swap_id',
            inputCount: rawData.length
        };

        this.logStep('Grouping data by swap ID', context);

        const groupedData = new Map<string, { incoming: RawTargetingData[], outgoing: RawTargetingData[] }>();

        for (const item of rawData) {
            try {
                const swapId = item.direction === 'incoming' ? item.target_swap_id : item.source_swap_id;

                if (!groupedData.has(swapId)) {
                    groupedData.set(swapId, { incoming: [], outgoing: [] });
                }

                const group = groupedData.get(swapId)!;

                if (item.direction === 'incoming') {
                    group.incoming.push(item);
                } else {
                    group.outgoing.push(item);
                }

                this.logStep(`Added ${item.direction} target for swap ${swapId}`, {
                    ...context,
                    swapId,
                    targetId: item.target_id,
                    direction: item.direction
                });

            } catch (itemError) {
                this.logError('Error processing item during grouping', {
                    ...context,
                    targetId: item.target_id,
                    direction: item.direction,
                    error: itemError
                });
                continue;
            }
        }

        this.logStep('Data grouping completed', {
            ...context,
            step: 'group_data_complete',
            groupCount: groupedData.size,
            swapIds: Array.from(groupedData.keys())
        });

        return groupedData;
    }

    /**
     * Transform grouped data for a single swap
     * Private helper method with logging
     */
    private static transformSwapData(
        swapId: string,
        swapData: { incoming: RawTargetingData[], outgoing: RawTargetingData[] }
    ): SimpleTargetingData {
        const context: DebugContext = {
            step: 'transform_swap_data',
            swapId,
            incomingCount: swapData.incoming.length,
            outgoingCount: swapData.outgoing.length
        };

        this.logStep(`Transforming data for swap ${swapId}`, context);

        // Transform incoming targets
        const incomingTargets = swapData.incoming.map((item, index) => {
            try {
                const target = {
                    id: item.target_id,
                    sourceSwapId: item.source_swap_id,
                    ownerName: item.owner_name || 'Unknown User',
                    bookingTitle: item.booking_title || 'Untitled Booking',
                    status: item.status
                };

                this.logStep(`Transformed incoming target ${index + 1}/${swapData.incoming.length}`, {
                    ...context,
                    targetId: target.id,
                    sourceSwapId: target.sourceSwapId,
                    ownerName: target.ownerName
                });

                return target;
            } catch (targetError) {
                this.logError(`Error transforming incoming target ${index + 1}`, {
                    ...context,
                    targetId: item.target_id,
                    error: targetError
                });
                throw targetError;
            }
        });

        // Transform outgoing target (only one allowed)
        let outgoingTarget: SimpleTargetingData['outgoingTarget'] = undefined;

        if (swapData.outgoing.length > 0) {
            if (swapData.outgoing.length > 1) {
                this.logStep(`Warning: Multiple outgoing targets found for swap ${swapId}, using first one`, {
                    ...context,
                    outgoingCount: swapData.outgoing.length,
                    targetIds: swapData.outgoing.map(t => t.target_id)
                });
            }

            try {
                const item = swapData.outgoing[0];

                if (!item) {
                    throw new Error('Outgoing target item is undefined');
                }

                outgoingTarget = {
                    id: item.target_id,
                    targetSwapId: item.target_swap_id,
                    ownerName: item.owner_name || 'Unknown User',
                    bookingTitle: item.booking_title || 'Untitled Booking',
                    status: item.status
                };

                this.logStep('Transformed outgoing target', {
                    ...context,
                    targetId: outgoingTarget.id,
                    targetSwapId: outgoingTarget.targetSwapId,
                    ownerName: outgoingTarget.ownerName
                });

            } catch (targetError) {
                this.logError('Error transforming outgoing target', {
                    ...context,
                    targetId: swapData.outgoing[0]?.target_id,
                    error: targetError
                });
                throw targetError;
            }
        }

        const result: SimpleTargetingData = {
            swapId,
            incomingTargets,
            outgoingTarget
        };

        this.logStep(`Completed transformation for swap ${swapId}`, {
            ...context,
            step: 'transform_swap_data_complete',
            resultIncomingCount: result.incomingTargets.length,
            hasOutgoingTarget: !!result.outgoingTarget
        });

        return result;
    }

    /**
     * Validate input data structure
     * Private helper method with logging
     */
    private static validateInputData(rawData: RawTargetingData[]): TargetingValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        let processedCount = 0;
        let skippedCount = 0;

        // Handle null/undefined input first
        if (rawData === null || rawData === undefined) {
            errors.push('Input data cannot be null or undefined');
            return { isValid: false, errors, warnings, processedCount: 0, skippedCount: 1 };
        }

        if (!Array.isArray(rawData)) {
            errors.push('Input data must be an array');
            return { isValid: false, errors, warnings, processedCount: 0, skippedCount: 1 };
        }

        const context: DebugContext = {
            step: 'validate_input_data',
            inputCount: rawData.length
        };

        this.logStep('Validating input data', context);

        if (rawData.length === 0) {
            this.logStep('Input data is empty, returning valid result', context);
            return { isValid: true, errors: [], warnings: [], processedCount: 0, skippedCount: 0 };
        }

        for (let i = 0; i < rawData.length; i++) {
            const item = rawData[i];

            // Skip if item is null or undefined
            if (!item) {
                errors.push(`Item ${i}: Item is null or undefined`);
                skippedCount++;
                continue;
            }

            const itemContext: DebugContext = {
                ...context,
                itemIndex: i,
                targetId: item.target_id
            };

            try {
                // Validate required fields
                if (!item.target_id) {
                    errors.push(`Item ${i}: Missing target_id`);
                    skippedCount++;
                    continue;
                }

                if (!item.direction || !['incoming', 'outgoing'].includes(item.direction)) {
                    errors.push(`Item ${i}: Invalid direction: ${item.direction}`);
                    skippedCount++;
                    continue;
                }

                if (!item.status || !this.isValidTargetStatus(item.status)) {
                    errors.push(`Item ${i}: Invalid status: ${item.status}`);
                    skippedCount++;
                    continue;
                }

                if (!item.owner_name) {
                    warnings.push(`Item ${i}: Missing owner_name`);
                }

                if (!item.booking_title) {
                    warnings.push(`Item ${i}: Missing booking_title`);
                }

                processedCount++;
                this.logStep(`Validated input item ${i}`, itemContext);

            } catch (itemError) {
                this.logError(`Error validating input item ${i}`, {
                    ...itemContext,
                    error: itemError
                });
                errors.push(`Item ${i}: Validation error: ${itemError}`);
                skippedCount++;
            }
        }

        const result: TargetingValidationResult = {
            isValid: errors.length === 0,
            errors,
            warnings,
            processedCount,
            skippedCount
        };

        this.logStep('Input validation completed', {
            ...context,
            step: 'validate_input_complete',
            ...result
        });

        return result;
    }

    /**
     * Check if a status is valid
     * Private helper method
     */
    private static isValidTargetStatus(status: any): status is SwapTargetStatus {
        return typeof status === 'string' &&
            ['active', 'cancelled', 'accepted', 'rejected'].includes(status);
    }

    /**
     * Log transformation step with context
     * Private helper method for consistent logging
     */
    private static logStep(message: string, context: DebugContext): void {
        logger.info(`${this.LOG_PREFIX} ${message}`, {
            component: 'SimpleTargetingTransformer',
            ...context,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Log transformation error with context
     * Private helper method for consistent error logging
     */
    private static logError(message: string, context: DebugContext): void {
        logger.error(`${this.LOG_PREFIX} ${message}`, {
            component: 'SimpleTargetingTransformer',
            ...context,
            timestamp: new Date().toISOString()
        });
    }
}