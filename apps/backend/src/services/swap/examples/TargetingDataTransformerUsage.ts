/**
 * Example usage of TargetingDataTransformer with SwapTargetingRepository
 * This demonstrates how to integrate the transformer with existing targeting functionality
 * Requirements: 1.1, 1.2, 2.1, 2.2, 4.1, 4.2, 4.5
 */

import { Pool } from 'pg';
import { SwapTargetingRepository } from '../../../database/repositories/SwapTargetingRepository';
import { TargetingDataTransformer } from '../TargetingDataTransformer';
import { logger } from '../../../utils/logger';

/**
 * Enhanced service method that uses the TargetingDataTransformer
 * to process bidirectional targeting relationships for display
 */
export class EnhancedSwapTargetingService {
    constructor(
        private swapTargetingRepository: SwapTargetingRepository,
        private pool: Pool
    ) { }

    /**
     * Get enhanced targeting data for user swaps with proper bidirectional display
     * This method demonstrates the integration of the transformer with the repository
     * Requirements: 1.1, 1.2, 2.1, 2.2, 4.1, 4.2, 4.5
     */
    async getEnhancedTargetingDataForUser(userId: string) {
        try {
            logger.info('Getting enhanced targeting data for user', { userId });

            // Step 1: Get raw bidirectional data from repository
            const rawTargetingData = await this.swapTargetingRepository.getTargetingDataForUserSwaps(userId);

            // Step 2: Convert repository data to transformer input format
            const queryResults = this.convertRepositoryDataToQueryResults(rawTargetingData);

            // Step 3: Transform data using TargetingDataTransformer
            const transformedData = TargetingDataTransformer.transformBidirectionalData(queryResults);

            // Step 4: Validate data consistency
            const validationResult = TargetingDataTransformer.validateTargetingConsistency(transformedData);

            if (!validationResult.isValid) {
                logger.warn('Targeting data consistency issues detected', {
                    userId,
                    issues: validationResult.issues,
                    recommendations: validationResult.recommendations
                });
            }

            // Step 5: Convert to enhanced swap card format for frontend
            const enhancedSwapCardData = TargetingDataTransformer.convertToEnhancedSwapCardFormat(transformedData);

            logger.info('Successfully processed enhanced targeting data', {
                userId,
                swapsWithTargeting: transformedData.length,
                totalIncomingTargets: transformedData.reduce((sum, data) => sum + data.incomingCount, 0),
                totalOutgoingTargets: transformedData.reduce((sum, data) => sum + data.outgoingCount, 0),
                validationIssues: validationResult.issues.length
            });

            return {
                transformedData,
                enhancedSwapCardData,
                validationResult,
                metadata: {
                    userId,
                    processedAt: new Date(),
                    swapCount: transformedData.length,
                    hasValidationIssues: !validationResult.isValid
                }
            };

        } catch (error) {
            logger.error('Failed to get enhanced targeting data', { error, userId });
            throw error;
        }
    }

    /**
     * Convert repository data format to transformer input format
     * This bridges the gap between the repository output and transformer input
     */
    private convertRepositoryDataToQueryResults(repositoryData: any) {
        const queryResults: any[] = [];

        // Process incoming targets
        if (repositoryData.incomingTargets) {
            repositoryData.incomingTargets.forEach((target: any) => {
                queryResults.push({
                    direction: 'incoming' as const,
                    target_id: target.targetId,
                    target_swap_id: target.targetSwapId,
                    source_swap_id: target.sourceSwapId,
                    proposal_id: target.proposalId,
                    status: target.status,
                    created_at: target.createdAt,
                    updated_at: target.updatedAt,
                    booking_title: target.sourceSwapDetails?.bookingTitle || 'Untitled Booking',
                    booking_city: target.sourceSwapDetails?.bookingLocation?.split(',')[0]?.trim() || 'Unknown',
                    booking_country: target.sourceSwapDetails?.bookingLocation?.split(',')[1]?.trim() || 'Unknown',
                    check_in: target.sourceSwapDetails?.bookingCheckIn || new Date(),
                    check_out: target.sourceSwapDetails?.bookingCheckOut || new Date(),
                    price: target.sourceSwapDetails?.bookingPrice || 0,
                    owner_name: target.sourceSwapDetails?.ownerName || 'Unknown User',
                    owner_email: target.sourceSwapDetails?.ownerEmail || '',
                    data_source: 'swap_targets' as const
                });
            });
        }

        // Process outgoing targets
        if (repositoryData.outgoingTargets) {
            repositoryData.outgoingTargets.forEach((target: any) => {
                queryResults.push({
                    direction: 'outgoing' as const,
                    target_id: target.targetId,
                    target_swap_id: target.targetSwapId,
                    source_swap_id: target.sourceSwapId,
                    proposal_id: target.proposalId,
                    status: target.status,
                    created_at: target.createdAt,
                    updated_at: target.updatedAt,
                    booking_title: target.targetSwapDetails?.bookingTitle || 'Untitled Booking',
                    booking_city: target.targetSwapDetails?.bookingLocation?.split(',')[0]?.trim() || 'Unknown',
                    booking_country: target.targetSwapDetails?.bookingLocation?.split(',')[1]?.trim() || 'Unknown',
                    check_in: target.targetSwapDetails?.bookingCheckIn || new Date(),
                    check_out: target.targetSwapDetails?.bookingCheckOut || new Date(),
                    price: target.targetSwapDetails?.bookingPrice || 0,
                    owner_name: target.targetSwapDetails?.ownerName || 'Unknown User',
                    owner_email: target.targetSwapDetails?.ownerEmail || '',
                    data_source: 'swap_targets' as const
                });
            });
        }

        return queryResults;
    }

    /**
     * Get targeting indicators for a specific swap
     * Useful for displaying targeting status badges in the UI
     */
    async getTargetingIndicatorsForSwap(swapId: string, userId: string) {
        try {
            const enhancedData = await this.getEnhancedTargetingDataForUser(userId);
            const swapData = enhancedData.transformedData.find(data => data.swapId === swapId);

            return swapData?.indicators || [];
        } catch (error) {
            logger.error('Failed to get targeting indicators for swap', { error, swapId, userId });
            return [];
        }
    }

    /**
     * Get targeting summary for user dashboard
     * Provides aggregated targeting statistics
     */
    async getTargetingSummaryForUser(userId: string) {
        try {
            const enhancedData = await this.getEnhancedTargetingDataForUser(userId);

            const summary = {
                totalSwapsWithTargeting: enhancedData.transformedData.length,
                totalIncomingTargets: enhancedData.transformedData.reduce((sum, data) => sum + data.incomingCount, 0),
                totalOutgoingTargets: enhancedData.transformedData.reduce((sum, data) => sum + data.outgoingCount, 0),
                swapsWithBidirectionalTargeting: enhancedData.transformedData.filter(data =>
                    data.incomingCount > 0 && data.outgoingCount > 0
                ).length,
                hasValidationIssues: !enhancedData.validationResult.isValid,
                validationIssueCount: enhancedData.validationResult.issues.length
            };

            return summary;
        } catch (error) {
            logger.error('Failed to get targeting summary for user', { error, userId });
            throw error;
        }
    }
}

/**
 * Example usage in a controller or service method
 */
export async function exampleUsage() {
    // This would typically be injected via dependency injection
    const pool = new Pool(/* database config */);
    const swapTargetingRepository = new SwapTargetingRepository(pool);
    const enhancedService = new EnhancedSwapTargetingService(swapTargetingRepository, pool);

    const userId = 'example-user-id';

    try {
        // Get enhanced targeting data
        const enhancedData = await enhancedService.getEnhancedTargetingDataForUser(userId);

        console.log('Enhanced targeting data:', {
            swapsWithTargeting: enhancedData.transformedData.length,
            validationResult: enhancedData.validationResult,
            metadata: enhancedData.metadata
        });

        // Get targeting summary
        const summary = await enhancedService.getTargetingSummaryForUser(userId);
        console.log('Targeting summary:', summary);

        // Get indicators for a specific swap
        const swapId = 'example-swap-id';
        const indicators = await enhancedService.getTargetingIndicatorsForSwap(swapId, userId);
        console.log('Targeting indicators:', indicators);

    } catch (error) {
        console.error('Example usage failed:', error);
    }
}