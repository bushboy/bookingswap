import {
    SwapTarget,
    TargetingHistory,
    TargetingResult,
    TargetingValidation,
    TargetingRequest,
    AuctionEligibilityResult,
    OneForOneValidationResult,
    TargetingRestriction,
    AuctionInfo,
    SwapTargetStatus,
    TargetingAction
} from '@booking-swap/shared';
import { SwapTargetingRepository } from '../../database/repositories/SwapTargetingRepository';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { SwapProposalService } from './SwapProposalService';
import { AuctionRepository } from '../../database/repositories/AuctionRepository';
import { logger } from '../../utils/logger';
import { Pool, PoolClient } from 'pg';

export class SwapTargetingService {
    constructor(
        private swapTargetingRepository: SwapTargetingRepository,
        private swapRepository: SwapRepository,
        private swapProposalService: SwapProposalService,
        private auctionRepository: AuctionRepository,
        private pool: Pool
    ) { }

    /**
     * Target a swap with another swap
     * Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 5.4
     */
    async targetSwap(sourceSwapId: string, targetSwapId: string, userId: string): Promise<TargetingResult> {
        try {
            logger.info('Attempting to target swap', { sourceSwapId, targetSwapId, userId });

            // Step 1: Validate targeting eligibility
            const validation = await this.validateTargeting(sourceSwapId, targetSwapId, userId);
            if (!validation.canTarget) {
                return {
                    success: false,
                    error: validation.restrictions.map(r => r.message).join(', '),
                    warnings: validation.warnings
                };
            }

            // Step 2: Execute targeting in transaction
            return await this.executeInTransaction(async (client: PoolClient) => {
                // Check if source swap already has an active target
                const existingTarget = await this.swapTargetingRepository.findBySourceSwap(sourceSwapId);
                if (existingTarget && existingTarget.status === 'active') {
                    throw new Error('Source swap already has an active target. Use retargetSwap to change targets.');
                }

                // Create proposal from targeting request
                const proposalResult = await this.createProposalFromTargeting({
                    sourceSwapId,
                    targetSwapId,
                    userId
                });

                // Create targeting relationship
                const target = await this.swapTargetingRepository.createTarget({
                    sourceSwapId,
                    targetSwapId,
                    proposalId: proposalResult.proposalId!,
                    status: 'active'
                });

                // Create history entry
                await this.swapTargetingRepository.createHistoryEntry({
                    sourceSwapId,
                    targetSwapId,
                    action: 'targeted',
                    metadata: {
                        proposalId: proposalResult.proposalId,
                        userId,
                        timestamp: new Date()
                    }
                });

                logger.info('Successfully targeted swap', {
                    targetId: target.id,
                    proposalIdFromTargeting: proposalResult.proposalId,
                    actualProposalId: target.id,
                    sourceSwapId,
                    targetSwapId
                });

                // Return the swap_targets.id as the proposalId
                // This is the actual proposal/targeting relationship ID
                return {
                    success: true,
                    targetId: target.id,
                    proposalId: target.id, // Use the swap_target ID as the proposal ID
                    warnings: validation.warnings
                };
            });

        } catch (error) {
            logger.error('Failed to target swap', { error, sourceSwapId, targetSwapId, userId });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                warnings: []
            };
        }
    }

    /**
     * Retarget a swap to a different target
     * Requirements: 1.2, 1.3, 4.1, 4.2, 4.3, 5.4
     */
    async retargetSwap(sourceSwapId: string, newTargetSwapId: string, userId: string): Promise<TargetingResult> {
        try {
            logger.info('Attempting to retarget swap', { sourceSwapId, newTargetSwapId, userId });

            // Step 1: Validate new targeting eligibility
            const validation = await this.validateTargeting(sourceSwapId, newTargetSwapId, userId);
            if (!validation.canTarget) {
                return {
                    success: false,
                    error: validation.restrictions.map(r => r.message).join(', '),
                    warnings: validation.warnings
                };
            }

            // Step 2: Execute retargeting in transaction
            return await this.executeInTransaction(async (client: PoolClient) => {
                // Cancel existing active targets
                const cancelledTargets = await this.swapTargetingRepository.cancelActiveTargetsForSwap(sourceSwapId);

                if (cancelledTargets.length === 0) {
                    throw new Error('No active target found to retarget');
                }

                // Update existing swap with new target (for retargeting)
                const proposalResult = await this.updateSwapTargetForRetargeting({
                    sourceSwapId,
                    targetSwapId: newTargetSwapId,
                    userId
                });

                // Create new targeting relationship
                const newTarget = await this.swapTargetingRepository.createTarget({
                    sourceSwapId,
                    targetSwapId: newTargetSwapId,
                    proposalId: proposalResult.proposalId!,
                    status: 'active'
                });

                // Create history entry for retargeting
                await this.swapTargetingRepository.createHistoryEntry({
                    sourceSwapId,
                    targetSwapId: newTargetSwapId,
                    action: 'retargeted',
                    metadata: {
                        proposalId: proposalResult.proposalId,
                        previousTargets: cancelledTargets.map(t => ({ id: t.id, targetSwapId: t.targetSwapId })),
                        userId,
                        timestamp: new Date()
                    }
                });

                logger.info('Successfully retargeted swap', {
                    newTargetId: newTarget.id,
                    proposalIdFromTargeting: proposalResult.proposalId,
                    actualProposalId: newTarget.id,
                    sourceSwapId,
                    newTargetSwapId,
                    cancelledTargetsCount: cancelledTargets.length
                });

                // Return the swap_targets.id as the proposalId
                // This is the actual proposal/targeting relationship ID
                return {
                    success: true,
                    targetId: newTarget.id,
                    proposalId: newTarget.id, // Use the swap_target ID as the proposal ID
                    warnings: validation.warnings
                };
            });

        } catch (error) {
            logger.error('Failed to retarget swap', { error, sourceSwapId, newTargetSwapId, userId });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                warnings: []
            };
        }
    }

    /**
     * Remove targeting relationship
     * Requirements: 1.3, 5.4
     */
    async removeTarget(sourceSwapId: string, userId: string): Promise<void> {
        try {
            logger.info('Attempting to remove target', { sourceSwapId, userId });

            await this.executeInTransaction(async (client: PoolClient) => {
                // Find active target
                const activeTarget = await this.swapTargetingRepository.findBySourceSwap(sourceSwapId);
                if (!activeTarget || activeTarget.status !== 'active') {
                    throw new Error('No active target found to remove');
                }

                // Verify ownership
                const sourceSwap = await this.swapRepository.findById(sourceSwapId);
                if (!sourceSwap || sourceSwap.ownerId !== userId) {
                    throw new Error('User does not own the source swap');
                }

                // Cancel the targeting relationship
                await this.swapTargetingRepository.updateTarget(activeTarget.id, { status: 'cancelled' });

                // Note: The targeting relationship is now handled entirely by the swap_targets table.
                // No need to update the swaps table - the target_booking_id column no longer exists.

                // Cancel associated proposal if it exists
                if (activeTarget.proposalId) {
                    try {
                        await this.cancelProposalFromRetargeting(activeTarget.proposalId, 'Target removed by user');
                    } catch (proposalError) {
                        logger.warn('Failed to cancel proposal during target removal', {
                            proposalId: activeTarget.proposalId,
                            error: proposalError
                        });
                    }
                }

                logger.info('Successfully cleared target booking from source swap', {
                    sourceSwapId,
                    previousTargetSwapId: activeTarget.targetSwapId
                });

                // Create history entry
                await this.swapTargetingRepository.createHistoryEntry({
                    sourceSwapId,
                    targetSwapId: activeTarget.targetSwapId,
                    action: 'removed',
                    metadata: {
                        targetId: activeTarget.id,
                        proposalId: activeTarget.proposalId,
                        userId,
                        timestamp: new Date()
                    }
                });

                logger.info('Successfully removed target', {
                    targetId: activeTarget.id,
                    sourceSwapId,
                    targetSwapId: activeTarget.targetSwapId
                });
            });

        } catch (error) {
            logger.error('Failed to remove target', { error, sourceSwapId, userId });
            throw error;
        }
    }

    /**
     * Get current swap target
     * Requirements: 1.1, 1.2, 1.3
     */
    async getSwapTarget(swapId: string): Promise<SwapTarget | null> {
        try {
            return await this.swapTargetingRepository.findBySourceSwap(swapId);
        } catch (error) {
            logger.error('Failed to get swap target', { error, swapId });
            throw error;
        }
    }



    /**
     * Get swaps targeting the current user
     * Requirements: 1.1, 1.2
     */
    async getSwapsTargetingMe(userId: string): Promise<SwapTarget[]> {
        try {
            return await this.swapTargetingRepository.findSwapsTargetingUser(userId);
        } catch (error) {
            logger.error('Failed to get swaps targeting user', { error, userId });
            throw error;
        }
    }

    /**
     * Validate targeting eligibility with comprehensive checks
     * Requirements: 1.4, 4.3, 4.4, 5.7, 8.1, 8.2, 8.3
     */
    async validateTargeting(sourceSwapId: string, targetSwapId: string, userId: string): Promise<TargetingValidation> {
        try {
            logger.debug('Starting targeting validation', { sourceSwapId, targetSwapId, userId });

            const restrictions: TargetingRestriction[] = [];
            const warnings: string[] = [];
            let canTarget = true;

            // Basic validation
            if (sourceSwapId === targetSwapId) {
                restrictions.push({
                    type: 'own_swap',
                    message: 'Cannot target the same swap',
                    severity: 'error'
                });
                canTarget = false;
            }

            // Get swaps
            const sourceSwap = await this.swapRepository.findById(sourceSwapId);
            const targetSwap = await this.swapRepository.findById(targetSwapId);

            logger.debug('Retrieved swaps for validation', {
                sourceSwapId,
                targetSwapId,
                sourceSwapFound: !!sourceSwap,
                targetSwapFound: !!targetSwap,
                sourceSwapStatus: sourceSwap?.status,
                targetSwapStatus: targetSwap?.status,
                sourceSwapOwnerId: sourceSwap?.ownerId,
                targetSwapOwnerId: targetSwap?.ownerId
            });

            if (!sourceSwap) {
                restrictions.push({
                    type: 'swap_unavailable',
                    message: 'Source swap not found',
                    severity: 'error'
                });
                canTarget = false;
            }

            if (!targetSwap) {
                restrictions.push({
                    type: 'swap_unavailable',
                    message: 'Target swap not found',
                    severity: 'error'
                });
                canTarget = false;
            }

            if (!sourceSwap || !targetSwap) {
                return {
                    canTarget: false,
                    restrictions,
                    warnings,
                    isValid: false,
                    errors: restrictions.map(r => r.message)
                };
            }

            // Check ownership
            if (sourceSwap.ownerId !== userId) {
                restrictions.push({
                    type: 'own_swap',
                    message: `User does not own the source swap (swap owner: ${sourceSwap.ownerId}, requesting user: ${userId})`,
                    severity: 'error'
                });
                canTarget = false;
                logger.warn('Ownership validation failed', {
                    sourceSwapId,
                    swapOwnerId: sourceSwap.ownerId,
                    requestingUserId: userId
                });
            }

            if (targetSwap.ownerId === userId) {
                restrictions.push({
                    type: 'own_swap',
                    message: 'Cannot target your own swap',
                    severity: 'error'
                });
                canTarget = false;
            }

            // Check swap statuses
            if (sourceSwap.status !== 'pending') {
                restrictions.push({
                    type: 'swap_unavailable',
                    message: `Source swap is not available for targeting (current status: ${sourceSwap.status}, required: pending)`,
                    severity: 'error'
                });
                canTarget = false;
                logger.warn('Source swap status validation failed', {
                    sourceSwapId,
                    currentStatus: sourceSwap.status,
                    requiredStatus: 'pending'
                });
            }

            if (targetSwap.status !== 'pending') {
                restrictions.push({
                    type: 'swap_unavailable',
                    message: `Target swap is not available for targeting (current status: ${targetSwap.status}, required: pending)`,
                    severity: 'error'
                });
                canTarget = false;
                logger.warn('Target swap status validation failed', {
                    targetSwapId,
                    currentStatus: targetSwap.status,
                    requiredStatus: 'pending'
                });
            }

            // Check for circular targeting
            const hasCircularTargeting = await this.swapTargetingRepository.findCircularTargeting(sourceSwapId, targetSwapId);
            if (hasCircularTargeting) {
                restrictions.push({
                    type: 'circular_targeting',
                    message: 'Circular targeting detected - this would create a targeting loop',
                    severity: 'error'
                });
                canTarget = false;
            }

            // Get auction and proposal validation
            const auctionValidation = await this.checkAuctionEligibility(targetSwapId);
            const oneForOneValidation = await this.enforceOneForOneRules(targetSwapId, userId);

            // Apply auction mode restrictions
            if (!auctionValidation.canTarget) {
                restrictions.push({
                    type: 'auction_ended',
                    message: auctionValidation.reason || 'Auction restrictions prevent targeting',
                    severity: 'error'
                });
                canTarget = false;
                logger.warn('Auction eligibility validation failed', {
                    targetSwapId,
                    auctionActive: auctionValidation.auctionActive,
                    proposalCount: auctionValidation.currentProposalCount,
                    reason: auctionValidation.reason
                });
            }

            // Apply one-for-one restrictions
            if (!oneForOneValidation.canTarget) {
                const enhancedMessage = oneForOneValidation.hasExistingProposal
                    ? `${oneForOneValidation.reason} (existing proposal: ${oneForOneValidation.existingProposalId || 'unknown'})`
                    : oneForOneValidation.reason || 'One-for-one restrictions prevent targeting';

                restrictions.push({
                    type: 'proposal_pending',
                    message: enhancedMessage,
                    severity: 'error'
                });
                canTarget = false;
                logger.warn('One-for-one rules validation failed', {
                    targetSwapId,
                    userId,
                    hasExistingProposal: oneForOneValidation.hasExistingProposal,
                    existingProposalId: oneForOneValidation.existingProposalId,
                    mustWaitForResolution: oneForOneValidation.mustWaitForResolution,
                    reason: oneForOneValidation.reason
                });
            }

            // Add warnings for edge cases
            if (auctionValidation.auctionActive && auctionValidation.currentProposalCount > 5) {
                warnings.push('This auction already has many proposals - consider the competition');
            }

            const auctionInfo: AuctionInfo = {
                isAuction: auctionValidation.auctionActive,
                endDate: auctionValidation.auctionEndDate,
                proposalCount: auctionValidation.currentProposalCount,
                canReceiveMoreProposals: auctionValidation.canTarget
            };

            const result = {
                canTarget,
                restrictions,
                warnings,
                auctionInfo,
                isValid: canTarget,
                errors: restrictions.filter(r => r.severity === 'error').map(r => r.message)
            };

            logger.debug('Targeting validation complete', {
                sourceSwapId,
                targetSwapId,
                userId,
                canTarget,
                restrictionCount: restrictions.length,
                warningCount: warnings.length,
                restrictions: restrictions.map(r => ({ type: r.type, message: r.message })),
                errors: result.errors
            });

            return result;

        } catch (error) {
            logger.error('Failed to validate targeting', { error, sourceSwapId, targetSwapId, userId });
            return {
                canTarget: false,
                restrictions: [{
                    type: 'swap_unavailable',
                    message: 'Validation failed due to system error',
                    severity: 'error'
                }],
                warnings: [],
                isValid: false,
                errors: ['Validation failed due to system error']
            };
        }
    }

    /**
     * Check if user can target a specific swap
     * Requirements: 1.4, 4.3, 4.4, 8.1, 8.2, 8.3
     */
    async canTargetSwap(targetSwapId: string, userId: string): Promise<boolean> {
        try {
            // Get user's active swap
            const userSwaps = await this.swapRepository.findByUserId(userId, 1, 0);
            const activeUserSwap = userSwaps.find(swap => swap.status === 'pending');

            if (!activeUserSwap) {
                return false; // User has no active swap to target with
            }

            const validation = await this.validateTargeting(activeUserSwap.id, targetSwapId, userId);
            return validation.canTarget;
        } catch (error) {
            logger.error('Failed to check if user can target swap', { error, targetSwapId, userId });
            return false;
        }
    }

    /**
     * Check auction eligibility for targeting
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
     */
    async checkAuctionEligibility(targetSwapId: string): Promise<AuctionEligibilityResult> {
        try {
            // Get target swap details
            const targetSwap = await this.swapRepository.findById(targetSwapId);
            if (!targetSwap) {
                return {
                    canTarget: false,
                    auctionActive: false,
                    currentProposalCount: 0,
                    reason: 'Target swap not found'
                };
            }

            // Check if swap has acceptance strategy defined
            const acceptanceStrategy = (targetSwap as any).acceptanceStrategy;
            if (!acceptanceStrategy) {
                // Default to one-for-one mode if no strategy is defined
                return {
                    canTarget: true,
                    auctionActive: false,
                    currentProposalCount: 0,
                    reason: 'No acceptance strategy defined, defaulting to one-for-one mode'
                };
            }

            const isAuctionMode = acceptanceStrategy.type === 'auction';

            if (!isAuctionMode) {
                // Not auction mode, return basic eligibility
                return {
                    canTarget: true,
                    auctionActive: false,
                    currentProposalCount: 0,
                    reason: 'Swap is in one-for-one mode'
                };
            }

            // Get auction details
            const auction = await this.auctionRepository.findBySwapId(targetSwapId);
            if (!auction) {
                return {
                    canTarget: false,
                    auctionActive: false,
                    currentProposalCount: 0,
                    reason: 'Auction mode enabled but no auction found'
                };
            }

            // Check auction status
            if (auction.status !== 'active') {
                return {
                    canTarget: false,
                    auctionActive: false,
                    currentProposalCount: 0,
                    reason: `Auction is ${auction.status}`
                };
            }

            // Check auction end date
            const auctionEndDate = new Date(auction.settings.endDate);
            const now = new Date();

            if (auctionEndDate <= now) {
                return {
                    canTarget: false,
                    auctionActive: false,
                    auctionEndDate,
                    currentProposalCount: 0,
                    reason: 'Auction has ended'
                };
            }

            // Get current proposal count for the target swap
            const proposalCount = await this.getProposalCountForSwap(targetSwapId);

            return {
                canTarget: true,
                auctionActive: true,
                auctionEndDate,
                currentProposalCount: proposalCount,
                reason: 'Auction is active and accepting proposals'
            };

        } catch (error) {
            logger.error('Failed to check auction eligibility', { error, targetSwapId });
            return {
                canTarget: false,
                auctionActive: false,
                currentProposalCount: 0,
                reason: 'Error checking auction eligibility'
            };
        }
    }

    /**
     * Enforce one-for-one proposal rules
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
     */
    async enforceOneForOneRules(targetSwapId: string, userId: string): Promise<OneForOneValidationResult> {
        try {
            // Get target swap details
            const targetSwap = await this.swapRepository.findById(targetSwapId);
            if (!targetSwap) {
                return {
                    canTarget: false,
                    hasExistingProposal: false,
                    mustWaitForResolution: false,
                    reason: 'Target swap not found'
                };
            }

            // Check acceptance strategy
            const acceptanceStrategy = (targetSwap as any).acceptanceStrategy;
            const isAuctionMode = acceptanceStrategy?.type === 'auction';

            if (isAuctionMode) {
                // Auction mode allows multiple proposals, so one-for-one rules don't apply
                return {
                    canTarget: true,
                    hasExistingProposal: false,
                    mustWaitForResolution: false,
                    reason: 'Auction mode allows multiple proposals'
                };
            }

            // One-for-one mode: check for existing proposals
            const proposalCount = await this.getProposalCountForSwap(targetSwapId);
            const userHasExistingProposal = await this.userHasProposalForSwap(targetSwapId, userId);

            if (proposalCount > 0 && !userHasExistingProposal) {
                // There's already a proposal from another user
                const existingProposalId = await this.getExistingProposalId(targetSwapId);
                return {
                    canTarget: false,
                    hasExistingProposal: true,
                    existingProposalId,
                    mustWaitForResolution: true,
                    reason: 'Swap already has a pending proposal in one-for-one mode'
                };
            }

            if (userHasExistingProposal) {
                // User already has a proposal for this swap
                const existingProposalId = await this.getUserProposalId(targetSwapId, userId);
                return {
                    canTarget: false,
                    hasExistingProposal: true,
                    existingProposalId,
                    mustWaitForResolution: false,
                    reason: 'User already has a proposal for this swap'
                };
            }

            return {
                canTarget: true,
                hasExistingProposal: false,
                mustWaitForResolution: false,
                reason: 'No existing proposals, targeting allowed'
            };

        } catch (error) {
            logger.error('Failed to enforce one-for-one rules', { error, targetSwapId, userId });
            return {
                canTarget: false,
                hasExistingProposal: false,
                mustWaitForResolution: false,
                reason: 'Error checking one-for-one rules'
            };
        }
    }

    /**
     * Create proposal from targeting request
     * Private method to handle proposal creation during targeting
     */
    private async createProposalFromTargeting(request: TargetingRequest): Promise<{ proposalId: string }> {
        try {
            // Get source and target swaps
            const sourceSwap = await this.swapRepository.findById(request.sourceSwapId);
            const targetSwap = await this.swapRepository.findById(request.targetSwapId);

            if (!sourceSwap || !targetSwap) {
                throw new Error('Source or target swap not found');
            }

            // Debug logging to understand the swap data
            logger.info('Swap data for targeting', {
                sourceSwap: {
                    id: sourceSwap.id,
                    sourceBookingId: sourceSwap.sourceBookingId,
                    targetBookingId: sourceSwap.targetBookingId,
                    status: sourceSwap.status,
                    ownerId: sourceSwap.ownerId
                },
                targetSwap: {
                    id: targetSwap.id,
                    sourceBookingId: targetSwap.sourceBookingId,
                    targetBookingId: targetSwap.targetBookingId,
                    status: targetSwap.status,
                    ownerId: targetSwap.ownerId
                }
            });

            // Validate that source swap has a source booking
            if (!sourceSwap.sourceBookingId) {
                throw new Error(`Source swap ${sourceSwap.id} has no source booking ID. This indicates data corruption or invalid swap state.`);
            }

            // Validate that target swap has a source booking
            if (!targetSwap.sourceBookingId) {
                throw new Error(`Target swap ${targetSwap.id} has no source booking ID. This indicates data corruption or invalid swap state.`);
            }

            // Validate that the user owns the source swap
            if (sourceSwap.ownerId !== request.userId) {
                throw new Error(`User ${request.userId} does not own source swap ${sourceSwap.id}`);
            }

            // Note: Validation of existing targets is now handled by swap_targets table
            // The targeting relationship is managed entirely through swap_targets

            logger.info('Proposal from targeting completed (swap_targets table manages the relationship)', {
                swapId: sourceSwap.id,
                sourceBookingId: sourceSwap.sourceBookingId,
                targetSwapId: targetSwap.id,
                userId: request.userId
            });

            // Return the source swap ID as the proposal ID
            // The targeting relationship is managed in swap_targets table
            return { proposalId: sourceSwap.id };
        } catch (error) {
            logger.error('Failed to create proposal from targeting', { error, request });
            throw error;
        }
    }

    /**
     * Update existing swap target for retargeting
     * Private method to handle retargeting by updating the existing swap
     */
    private async updateSwapTargetForRetargeting(request: TargetingRequest): Promise<{ proposalId: string }> {
        try {
            // Get source and target swaps
            const sourceSwap = await this.swapRepository.findById(request.sourceSwapId);
            const targetSwap = await this.swapRepository.findById(request.targetSwapId);

            if (!sourceSwap || !targetSwap) {
                throw new Error('Source or target swap not found');
            }

            // Note: The targeting relationship is now handled entirely by swap_targets table
            // Retargeting is managed by updating the swap_targets entry, not the swaps table

            logger.info('Successfully retargeted existing swap', {
                swapId: sourceSwap.id,
                sourceBookingId: sourceSwap.sourceBookingId,
                newTargetSwapId: targetSwap.id,
                userId: request.userId
            });

            return { proposalId: sourceSwap.id };
        } catch (error) {
            logger.error('Failed to update swap target for retargeting', { error, request });
            throw error;
        }
    }

    /**
     * Cancel proposal during retargeting
     * Private method to handle proposal cancellation
     */
    private async cancelProposalFromRetargeting(proposalId: string, reason: string): Promise<void> {
        try {
            // Update proposal status to cancelled
            await this.swapRepository.updateStatus(proposalId, 'cancelled');

            logger.info('Cancelled proposal from retargeting', { proposalId, reason });
        } catch (error) {
            logger.error('Failed to cancel proposal from retargeting', { error, proposalId, reason });
            throw error;
        }
    }

    /**
     * Get proposal count for a swap
     * Private helper method
     */
    private async getProposalCountForSwap(targetSwapId: string): Promise<number> {
        try {
            // Get target swap to find the source booking ID
            const targetSwap = await this.swapRepository.findById(targetSwapId);
            if (!targetSwap) {
                return 0;
            }

            // Count proposals targeting this swap's booking (excluding the target swap itself)
            const proposals = await this.swapRepository.findPendingProposalsForBooking(targetSwap.sourceBookingId);
            const otherProposals = proposals.filter(p => p.id !== targetSwapId);
            return otherProposals.length;
        } catch (error) {
            logger.error('Failed to get proposal count for swap', { error, targetSwapId });
            return 0;
        }
    }

    /**
     * Check if user has existing proposal for swap
     * Private helper method
     */
    private async userHasProposalForSwap(targetSwapId: string, userId: string): Promise<boolean> {
        try {
            const targetSwap = await this.swapRepository.findById(targetSwapId);
            if (!targetSwap) {
                return false;
            }

            // Get proposals targeting this swap's booking (excluding the target swap itself)
            const proposals = await this.swapRepository.findPendingProposalsForBooking(targetSwap.sourceBookingId);
            const otherProposals = proposals.filter(p => p.id !== targetSwapId);
            return otherProposals.some((p: any) => p.ownerId === userId);
        } catch (error) {
            logger.error('Failed to check if user has proposal for swap', { error, targetSwapId, userId });
            return false;
        }
    }

    /**
     * Get existing proposal ID for swap
     * Private helper method
     */
    private async getExistingProposalId(targetSwapId: string): Promise<string | undefined> {
        try {
            const targetSwap = await this.swapRepository.findById(targetSwapId);
            if (!targetSwap) {
                return undefined;
            }

            // Get proposals targeting this swap's booking (excluding the target swap itself)
            const proposals = await this.swapRepository.findPendingProposalsForBooking(targetSwap.sourceBookingId);
            const otherProposals = proposals.filter(p => p.id !== targetSwapId);
            const pendingProposal = otherProposals.find((p: any) => p.status === 'pending');
            return pendingProposal?.id;
        } catch (error) {
            logger.error('Failed to get existing proposal ID', { error, targetSwapId });
            return undefined;
        }
    }

    /**
     * Get user's proposal ID for swap
     * Private helper method
     */
    private async getUserProposalId(targetSwapId: string, userId: string): Promise<string | undefined> {
        try {
            const targetSwap = await this.swapRepository.findById(targetSwapId);
            if (!targetSwap) {
                return undefined;
            }

            // Get proposals targeting this swap's booking (excluding the target swap itself)
            const proposals = await this.swapRepository.findPendingProposalsForBooking(targetSwap.sourceBookingId);
            const otherProposals = proposals.filter(p => p.id !== targetSwapId);
            const userProposal = otherProposals.find((p: any) => p.ownerId === userId);
            return userProposal?.id;
        } catch (error) {
            logger.error('Failed to get user proposal ID', { error, targetSwapId, userId });
            return undefined;
        }
    }

    /**
     * Get targeting history for a swap
     * Requirements: 5.4, 8.1, 8.2, 8.5, 8.6
     */
    async getTargetingHistory(swapIdOrRequest: string | {
        swapId?: string;
        userId?: string;
        filters?: any;
        sorting?: { field: string; direction: string };
        pagination?: { page: number; limit: number };
    }): Promise<TargetingHistory[] | any> {
        try {
            // Handle simple use case: just a swapId string
            if (typeof swapIdOrRequest === 'string') {
                return await this.swapTargetingRepository.getTargetingHistory(swapIdOrRequest);
            }

            // Handle advanced use case: request object with filtering/pagination
            const request = swapIdOrRequest;
            const {
                swapId,
                userId,
                filters = {},
                sorting = { field: 'timestamp', direction: 'desc' },
                pagination = { page: 1, limit: 50 }
            } = request;

            logger.info('Getting targeting history', {
                swapId,
                userId,
                filters,
                sorting,
                pagination
            });

            // Build base query conditions
            const conditions: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            // Filter by swap ID if provided
            if (swapId) {
                conditions.push(`(th.source_swap_id = $${paramIndex} OR th.target_swap_id = $${paramIndex})`);
                params.push(swapId);
                paramIndex++;
            }

            // Filter by user ID if provided (user must be involved in the targeting)
            if (userId) {
                conditions.push(`(
                    th.actor_id = $${paramIndex} OR 
                    ss.owner_id = $${paramIndex} OR 
                    ts.owner_id = $${paramIndex}
                )`);
                params.push(userId);
                paramIndex++;
            }

            // Apply additional filters
            if (filters.eventTypes && filters.eventTypes.length > 0) {
                conditions.push(`th.event_type = ANY($${paramIndex})`);
                params.push(filters.eventTypes);
                paramIndex++;
            }

            if (filters.severity && filters.severity.length > 0) {
                conditions.push(`th.severity = ANY($${paramIndex})`);
                params.push(filters.severity);
                paramIndex++;
            }

            if (filters.startDate) {
                conditions.push(`th.created_at >= $${paramIndex}`);
                params.push(filters.startDate);
                paramIndex++;
            }

            if (filters.endDate) {
                conditions.push(`th.created_at <= $${paramIndex}`);
                params.push(filters.endDate);
                paramIndex++;
            }

            if (filters.searchQuery) {
                conditions.push(`(
                    th.title ILIKE $${paramIndex} OR 
                    th.description ILIKE $${paramIndex} OR
                    au.name ILIKE $${paramIndex} OR
                    sb.title ILIKE $${paramIndex} OR
                    tb.title ILIKE $${paramIndex}
                )`);
                params.push(`%${filters.searchQuery}%`);
                paramIndex++;
            }

            // Build WHERE clause
            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Build ORDER BY clause
            const validSortFields = {
                'timestamp': 'th.created_at',
                'type': 'th.event_type',
                'actor': 'au.name',
                'severity': 'th.severity'
            };
            const sortField = validSortFields[sorting.field as keyof typeof validSortFields] || 'th.created_at';
            const sortDirection = sorting.direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
            const orderClause = `ORDER BY ${sortField} ${sortDirection}`;

            // Calculate pagination
            const offset = (pagination.page - 1) * pagination.limit;
            const limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(pagination.limit, offset);

            // Main query to get targeting history events
            const query = `
                SELECT 
                    th.id,
                    th.event_type,
                    th.severity,
                    th.created_at as timestamp,
                    th.title,
                    th.description,
                    th.previous_status,
                    th.new_status,
                    th.metadata,
                    
                    -- Actor information
                    au.id as actor_id,
                    au.name as actor_name,
                    au.avatar as actor_avatar,
                    
                    -- Source swap information
                    th.source_swap_id,
                    ss.owner_id as source_owner_id,
                    su.name as source_owner_name,
                    sb.id as source_booking_id,
                    sb.title as source_booking_title,
                    sb.location as source_booking_location,
                    sb.check_in_date as source_booking_check_in,
                    sb.check_out_date as source_booking_check_out,
                    sb.price as source_booking_price,
                    
                    -- Target swap information
                    th.target_swap_id,
                    ts.owner_id as target_owner_id,
                    tu.name as target_owner_name,
                    tb.id as target_booking_id,
                    tb.title as target_booking_title,
                    tb.location as target_booking_location,
                    tb.check_in_date as target_booking_check_in,
                    tb.check_out_date as target_booking_check_out,
                    tb.price as target_booking_price
                    
                FROM targeting_history th
                LEFT JOIN users au ON th.actor_id = au.id
                LEFT JOIN swaps ss ON th.source_swap_id = ss.id
                LEFT JOIN users su ON ss.owner_id = su.id
                LEFT JOIN bookings sb ON ss.source_booking_id = sb.id
                LEFT JOIN swaps ts ON th.target_swap_id = ts.id
                LEFT JOIN users tu ON ts.owner_id = tu.id
                LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
                ${whereClause}
                ${orderClause}
                ${limitClause}
            `;

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM targeting_history th
                LEFT JOIN users au ON th.actor_id = au.id
                LEFT JOIN swaps ss ON th.source_swap_id = ss.id
                LEFT JOIN users su ON ss.owner_id = su.id
                LEFT JOIN bookings sb ON ss.source_booking_id = sb.id
                LEFT JOIN swaps ts ON th.target_swap_id = ts.id
                LEFT JOIN users tu ON ts.owner_id = tu.id
                LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
                ${whereClause}
            `;

            // Execute queries
            const [eventsResult, countResult] = await Promise.all([
                this.pool.query(query, params.slice(0, -2).concat(params.slice(-2))),
                this.pool.query(countQuery, params.slice(0, -2))
            ]);

            const totalEvents = parseInt(countResult.rows[0]?.total || '0');
            const totalPages = Math.ceil(totalEvents / pagination.limit);
            const hasMore = pagination.page < totalPages;

            // Transform results to TargetingEvent format
            const events = eventsResult.rows.map(row => ({
                id: row.id,
                type: row.event_type,
                severity: row.severity,
                timestamp: row.timestamp,
                title: row.title,
                description: row.description,
                previousStatus: row.previous_status,
                newStatus: row.new_status,
                actor: {
                    id: row.actor_id,
                    name: row.actor_name,
                    avatar: row.actor_avatar
                },
                sourceSwap: {
                    id: row.source_swap_id,
                    ownerId: row.source_owner_id,
                    ownerName: row.source_owner_name,
                    bookingDetails: {
                        id: row.source_booking_id,
                        title: row.source_booking_title,
                        location: row.source_booking_location,
                        checkInDate: row.source_booking_check_in,
                        checkOutDate: row.source_booking_check_out,
                        price: row.source_booking_price
                    }
                },
                targetSwap: {
                    id: row.target_swap_id,
                    ownerId: row.target_owner_id,
                    ownerName: row.target_owner_name,
                    bookingDetails: {
                        id: row.target_booking_id,
                        title: row.target_booking_title,
                        location: row.target_booking_location,
                        checkInDate: row.target_booking_check_in,
                        checkOutDate: row.target_booking_check_out,
                        price: row.target_booking_price
                    }
                },
                metadata: row.metadata
            }));

            logger.info('Successfully retrieved targeting history', {
                totalEvents,
                returnedEvents: events.length,
                page: pagination.page,
                totalPages,
                hasMore
            });

            return {
                events,
                pagination: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total: totalEvents,
                    totalPages,
                    hasMore
                },
                filters,
                sorting,
                hasMore
            };

        } catch (error) {
            logger.error('Failed to get targeting history', {
                error,
                swapIdOrRequest: typeof swapIdOrRequest === 'string' ? { swapId: swapIdOrRequest } : swapIdOrRequest
            });
            throw error;
        }
    }

    /**
     * Check if user has access to targeting data for a swap
     * Requirements: 8.7
     */
    async hasTargetingAccess(userId: string, swapId: string): Promise<boolean> {
        try {
            // Check if user has participated in any targeting activity for this swap
            const query = `
                SELECT COUNT(*) as count
                FROM targeting_history th
                LEFT JOIN swaps ss ON th.source_swap_id = ss.id
                LEFT JOIN swaps ts ON th.target_swap_id = ts.id
                WHERE 
                    (th.source_swap_id = $1 OR th.target_swap_id = $1) AND
                    (th.actor_id = $2 OR ss.owner_id = $2 OR ts.owner_id = $2)
            `;

            const result = await this.pool.query(query, [swapId, userId]);
            const count = parseInt(result.rows[0]?.count || '0');

            return count > 0;
        } catch (error) {
            logger.error('Failed to check targeting access', { error, userId, swapId });
            return false;
        }
    }

    /**
     * Create targeting history entry
     * Requirements: 8.1, 8.2, 8.3, 8.4
     */
    async createTargetingHistoryEntry(entry: {
        eventType: string;
        severity: string;
        actorId: string;
        sourceSwapId: string;
        targetSwapId: string;
        title: string;
        description: string;
        previousStatus?: string;
        newStatus?: string;
        metadata?: any;
    }): Promise<void> {
        try {
            const query = `
                INSERT INTO targeting_history (
                    id,
                    event_type,
                    severity,
                    actor_id,
                    source_swap_id,
                    target_swap_id,
                    title,
                    description,
                    previous_status,
                    new_status,
                    metadata,
                    created_at
                ) VALUES (
                    gen_random_uuid(),
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
                )
            `;

            await this.pool.query(query, [
                entry.eventType,
                entry.severity,
                entry.actorId,
                entry.sourceSwapId,
                entry.targetSwapId,
                entry.title,
                entry.description,
                entry.previousStatus,
                entry.newStatus,
                entry.metadata ? JSON.stringify(entry.metadata) : null
            ]);

            logger.info('Created targeting history entry', {
                eventType: entry.eventType,
                actorId: entry.actorId,
                sourceSwapId: entry.sourceSwapId,
                targetSwapId: entry.targetSwapId
            });

        } catch (error) {
            logger.error('Failed to create targeting history entry', { error, entry });
            throw error;
        }
    }

    /**
     * Execute operation in database transaction
     */
    private async executeInTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await operation(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}