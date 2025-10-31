/**
 * Example of Comprehensive Auction Error Handling Implementation
 * Demonstrates how to use the enhanced error handling system for auction operations
 */

import { Request, Response } from 'express';
import { AuctionErrorMonitoringService } from '../services/monitoring/AuctionErrorMonitoringService';
import { AuctionErrorResponseBuilder } from '../utils/AuctionErrorResponseBuilder';
import {
    AuctionCreationError,
    ValidationError,
    DateValidationError,
    AuctionSettingsValidationError,
    AuctionErrorUtils
} from '../utils/AuctionErrors';
import { logger } from '../utils/logger';

/**
 * Example API endpoint with comprehensive error handling
 */
export async function createAuctionWithErrorHandling(req: Request, res: Response) {
    const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}`;
    const errorMonitoringService = AuctionErrorMonitoringService.getInstance();
    const errorResponseBuilder = new AuctionErrorResponseBuilder(requestId);

    try {
        // Step 1: Log the operation start with detailed context
        logger.info('Starting auction creation with comprehensive error handling', {
            category: 'auction_creation',
            requestId,
            userId: (req as any).user?.id,
            auctionSettings: {
                endDate: req.body.auctionSettings?.endDate,
                endDateType: typeof req.body.auctionSettings?.endDate,
                allowBookingProposals: req.body.auctionSettings?.allowBookingProposals,
                allowCashProposals: req.body.auctionSettings?.allowCashProposals
            },
            timestamp: new Date().toISOString()
        });

        // Step 2: Validate auction settings with comprehensive date handling
        const { auctionSettings, swapId } = req.body;

        if (!auctionSettings) {
            throw new ValidationError('Auction settings are required', 'auctionSettings', undefined);
        }

        if (!swapId) {
            throw new ValidationError('Swap ID is required', 'swapId', undefined);
        }

        // Step 3: Perform date validation with detailed error context
        try {
            if (!auctionSettings.endDate) {
                throw new DateValidationError(
                    'Auction end date is required',
                    'endDate',
                    auctionSettings.endDate,
                    'ISO 8601 string or Date object'
                );
            }

            // Validate date format
            let validatedEndDate: Date;
            if (typeof auctionSettings.endDate === 'string') {
                validatedEndDate = new Date(auctionSettings.endDate);
                if (isNaN(validatedEndDate.getTime())) {
                    throw new DateValidationError(
                        'Invalid date format for auction end date',
                        'endDate',
                        auctionSettings.endDate,
                        'ISO 8601 string (e.g., "2025-11-02T15:00:00.000Z")'
                    );
                }
            } else if (auctionSettings.endDate instanceof Date) {
                validatedEndDate = auctionSettings.endDate;
            } else {
                throw new DateValidationError(
                    'Auction end date must be a Date object or ISO string',
                    'endDate',
                    auctionSettings.endDate,
                    'Date object or ISO 8601 string'
                );
            }

            // Validate future date
            if (validatedEndDate <= new Date()) {
                throw new DateValidationError(
                    'Auction end date must be in the future',
                    'endDate',
                    auctionSettings.endDate,
                    'Future date'
                );
            }

            logger.info('Date validation passed', {
                category: 'auction_validation',
                requestId,
                originalEndDate: auctionSettings.endDate,
                validatedEndDate: validatedEndDate.toISOString(),
                dateValidationSuccess: true
            });

        } catch (dateError) {
            // Record date validation error with comprehensive context
            errorMonitoringService.recordAuctionError(
                dateError instanceof Error ? dateError : new Error('Unknown date validation error'),
                {
                    phase: 'validation',
                    operation: 'date_validation',
                    metadata: {
                        requestId,
                        swapId,
                        originalEndDate: auctionSettings.endDate,
                        endDateType: typeof auctionSettings.endDate,
                        validationStep: 'date_format_and_timing'
                    }
                }
            );

            // Create structured error response for date validation
            if (dateError instanceof DateValidationError) {
                const dateErrorResponse = AuctionErrorResponseBuilder.createDateValidationErrorResponse(dateError);
                return res.status(400).json(dateErrorResponse);
            }

            throw dateError;
        }

        // Step 4: Validate auction settings with comprehensive error handling
        try {
            if (typeof auctionSettings.allowBookingProposals !== 'boolean') {
                throw new ValidationError(
                    'allowBookingProposals must be a boolean',
                    'allowBookingProposals',
                    auctionSettings.allowBookingProposals
                );
            }

            if (typeof auctionSettings.allowCashProposals !== 'boolean') {
                throw new ValidationError(
                    'allowCashProposals must be a boolean',
                    'allowCashProposals',
                    auctionSettings.allowCashProposals
                );
            }

            if (!auctionSettings.allowBookingProposals && !auctionSettings.allowCashProposals) {
                const fieldErrors = [
                    {
                        field: 'allowBookingProposals',
                        value: auctionSettings.allowBookingProposals,
                        error: 'At least one proposal type must be allowed',
                        suggestion: 'Set either allowBookingProposals or allowCashProposals to true'
                    },
                    {
                        field: 'allowCashProposals',
                        value: auctionSettings.allowCashProposals,
                        error: 'At least one proposal type must be allowed',
                        suggestion: 'Set either allowBookingProposals or allowCashProposals to true'
                    }
                ];

                throw AuctionSettingsValidationError.fromFieldErrors(fieldErrors);
            }

            logger.info('Auction settings validation passed', {
                category: 'auction_validation',
                requestId,
                swapId,
                allowBookingProposals: auctionSettings.allowBookingProposals,
                allowCashProposals: auctionSettings.allowCashProposals,
                settingsValidationSuccess: true
            });

        } catch (settingsError) {
            // Record settings validation error
            errorMonitoringService.recordAuctionError(
                settingsError instanceof Error ? settingsError : new Error('Unknown settings validation error'),
                {
                    phase: 'validation',
                    operation: 'auction_settings_validation',
                    metadata: {
                        requestId,
                        swapId,
                        auctionSettings,
                        validationStep: 'settings_consistency'
                    }
                }
            );

            throw settingsError;
        }

        // Step 5: Simulate auction creation (would call actual service)
        try {
            logger.info('Creating auction with validated settings', {
                category: 'auction_creation',
                requestId,
                swapId,
                phase: 'creation'
            });

            // Simulate potential blockchain error
            if (Math.random() < 0.1) { // 10% chance of blockchain error for demo
                throw new AuctionCreationError(
                    'Failed to record auction on blockchain: Network timeout',
                    `auction-${Date.now()}`,
                    swapId,
                    new Error('Network timeout'),
                    'blockchain_recording'
                );
            }

            // Simulate successful creation
            const auctionId = `auction-${Date.now()}`;
            const transactionId = `tx-${Date.now()}`;

            logger.info('Auction created successfully with comprehensive monitoring', {
                category: 'auction_creation_success',
                requestId,
                swapId,
                auctionId,
                transactionId,
                endDate: auctionSettings.endDate,
                creationSuccess: true,
                timestamp: new Date().toISOString()
            });

            return res.status(201).json({
                success: true,
                auction: {
                    id: auctionId,
                    swapId,
                    settings: auctionSettings,
                    transactionId,
                    createdAt: new Date().toISOString()
                },
                monitoring: {
                    requestId,
                    errorCount: 0,
                    validationsPassed: ['date_validation', 'settings_validation'],
                    phase: 'completed'
                }
            });

        } catch (creationError) {
            // Record creation error with comprehensive context
            errorMonitoringService.recordAuctionError(
                creationError instanceof Error ? creationError : new Error('Unknown creation error'),
                {
                    phase: creationError instanceof AuctionCreationError ? creationError.phase : 'creation',
                    operation: 'auction_creation',
                    metadata: {
                        requestId,
                        swapId,
                        auctionSettings,
                        creationStep: 'service_call'
                    }
                }
            );

            // Handle blockchain-specific errors
            if (creationError instanceof AuctionCreationError && creationError.phase === 'blockchain_recording') {
                const blockchainErrorResponse = AuctionErrorResponseBuilder.createBlockchainErrorResponse(
                    creationError,
                    'auction_creation'
                );
                return res.status(503).json(blockchainErrorResponse);
            }

            throw creationError;
        }

    } catch (error) {
        // Final error handling with comprehensive logging and monitoring
        errorMonitoringService.recordAuctionError(
            error instanceof Error ? error : new Error('Unknown auction creation error'),
            {
                operation: 'auction_creation_endpoint',
                metadata: {
                    requestId,
                    method: req.method,
                    path: req.path,
                    body: req.body,
                    finalErrorHandler: true
                }
            }
        );

        logger.error('Auction creation failed with comprehensive error context', {
            category: 'auction_creation_failure',
            requestId,
            error: error instanceof Error ? error.message : error,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            stack: error instanceof Error ? error.stack : undefined,
            isAuctionError: AuctionErrorUtils.isAuctionError(error),
            body: req.body,
            timestamp: new Date().toISOString()
        });

        // Create structured error response
        const structuredResponse = errorResponseBuilder.buildErrorResponse(
            error instanceof Error ? error : new Error('Unknown error occurred'),
            {
                operation: 'auction_creation',
                metadata: {
                    requestId,
                    method: req.method,
                    path: req.path
                }
            }
        );

        const statusCode = getStatusCodeForError(error);
        return res.status(statusCode).json(structuredResponse);
    }
}

/**
 * Example of getting error monitoring metrics
 */
export function getAuctionErrorMetrics(req: Request, res: Response) {
    try {
        const errorMonitoringService = AuctionErrorMonitoringService.getInstance();

        // Get comprehensive error metrics
        const errorMetrics = errorMonitoringService.getErrorMetrics();
        const dateValidationMetrics = errorMonitoringService.getDateValidationMetrics();
        const errorSummary = errorMonitoringService.getErrorSummary();

        logger.info('Error monitoring metrics requested', {
            category: 'error_monitoring',
            requestId: req.headers['x-request-id'],
            metricsRequested: true,
            totalErrors: errorMetrics.totalErrors,
            hasRecentErrors: errorSummary.hasRecentErrors
        });

        return res.status(200).json({
            success: true,
            metrics: {
                errors: errorMetrics,
                dateValidation: dateValidationMetrics,
                summary: errorSummary,
                timestamp: new Date().toISOString()
            },
            recommendations: errorSummary.recommendations,
            healthStatus: errorSummary.criticalIssues.length > 0 ? 'critical' :
                errorSummary.hasRecentErrors ? 'warning' : 'healthy'
        });

    } catch (error) {
        logger.error('Failed to get error monitoring metrics', {
            category: 'error_monitoring_failure',
            error: error instanceof Error ? error.message : error
        });

        return res.status(500).json({
            error: {
                code: 'MONITORING_METRICS_FAILED',
                message: 'Failed to retrieve error monitoring metrics',
                timestamp: new Date().toISOString()
            }
        });
    }
}

/**
 * Helper function to determine HTTP status code based on error type
 */
function getStatusCodeForError(error: any): number {
    if (error instanceof DateValidationError ||
        error instanceof ValidationError ||
        error instanceof AuctionSettingsValidationError) {
        return 400; // Bad Request
    }

    if (error instanceof AuctionCreationError) {
        switch (error.phase) {
            case 'validation':
                return 400; // Bad Request
            case 'blockchain_recording':
                return 503; // Service Unavailable
            case 'rollback':
                return 500; // Internal Server Error
            default:
                return 400; // Bad Request
        }
    }

    return 500; // Internal Server Error
}

/**
 * Example of how to use error monitoring in a service method
 */
export class ExampleAuctionService {
    private errorMonitoringService: AuctionErrorMonitoringService;

    constructor() {
        this.errorMonitoringService = AuctionErrorMonitoringService.getInstance();
    }

    async createAuctionWithMonitoring(auctionData: any): Promise<any> {
        try {
            // Log operation start
            logger.info('Starting auction creation with monitoring', {
                category: 'auction_service',
                operation: 'create_auction',
                auctionData: {
                    endDate: auctionData.endDate,
                    endDateType: typeof auctionData.endDate
                }
            });

            // Perform operation with error monitoring
            const result = await this.performAuctionCreation(auctionData);

            logger.info('Auction creation completed successfully', {
                category: 'auction_service',
                operation: 'create_auction',
                success: true,
                auctionId: result.id
            });

            return result;

        } catch (error) {
            // Record error with comprehensive context
            this.errorMonitoringService.recordAuctionError(
                error instanceof Error ? error : new Error('Unknown service error'),
                {
                    phase: 'creation',
                    operation: 'service_create_auction',
                    metadata: {
                        auctionData,
                        serviceMethod: 'createAuctionWithMonitoring'
                    }
                }
            );

            // Re-throw for upstream handling
            throw error;
        }
    }

    private async performAuctionCreation(auctionData: any): Promise<any> {
        // Simulate auction creation logic
        return {
            id: `auction-${Date.now()}`,
            ...auctionData,
            createdAt: new Date().toISOString()
        };
    }
}