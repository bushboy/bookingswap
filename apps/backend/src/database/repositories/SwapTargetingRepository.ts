import { Pool, PoolClient } from 'pg';
import {
    SwapTarget,
    TargetingHistory,
    CreateSwapTargetRequest,
    CreateTargetingHistoryRequest,
    SwapTargetStatus,
    TargetingAction
} from '@booking-swap/shared';
import { BaseRepository } from './base';
import { logger } from '../../utils/logger';

export class SwapTargetingRepository extends BaseRepository<SwapTarget> {
    constructor(pool: Pool) {
        super(pool, 'swap_targets');
    }

    /**
     * Map database row to SwapTarget entity
     */
    mapRowToEntity(row: any): SwapTarget {
        return {
            id: row.id,
            sourceSwapId: row.source_swap_id,
            targetSwapId: row.target_swap_id,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /**
     * Map SwapTarget entity to database row
     */
    mapEntityToRow(entity: Omit<SwapTarget, 'id' | 'createdAt' | 'updatedAt'>): any {
        return {
            source_swap_id: entity.sourceSwapId,
            target_swap_id: entity.targetSwapId,
            status: entity.status,
        };
    }

    /**
     * Map database row to TargetingHistory entity
     */
    mapRowToHistoryEntity(row: any): TargetingHistory {
        return {
            id: row.id,
            sourceSwapId: row.source_swap_id,
            targetSwapId: row.target_swap_id,
            action: row.action,
            timestamp: row.timestamp,
            metadata: row.metadata,
            createdAt: row.timestamp, // Use timestamp as createdAt for history
            updatedAt: row.timestamp, // History entries are immutable
        };
    }

    /**
     * Create a new swap target
     */
    async createTarget(target: CreateSwapTargetRequest): Promise<SwapTarget> {
        try {
            const query = `
        INSERT INTO swap_targets (source_swap_id, target_swap_id, status)
        VALUES ($1, $2, $3)
        RETURNING *
      `;

            const result = await this.pool.query(query, [
                target.sourceSwapId,
                target.targetSwapId,
                target.status
            ]);

            return this.mapRowToEntity(result.rows[0]);
        } catch (error) {
            logger.error('Failed to create swap target', { error, target });
            throw error;
        }
    }

    /**
     * Create targeting relationship (simplified method without proposal_id)
     */
    async createTargeting(sourceSwapId: string, targetSwapId: string): Promise<SwapTarget> {
        try {
            const query = `
        INSERT INTO swap_targets (source_swap_id, target_swap_id, status)
        VALUES ($1, $2, 'active')
        RETURNING *
      `;

            const result = await this.pool.query(query, [
                sourceSwapId,
                targetSwapId
            ]);

            return this.mapRowToEntity(result.rows[0]);
        } catch (error) {
            logger.error('Failed to create targeting relationship', { error, sourceSwapId, targetSwapId });
            throw error;
        }
    }

    /**
     * Remove targeting relationship
     */
    async removeTargeting(sourceSwapId: string): Promise<void> {
        try {
            const query = `DELETE FROM swap_targets WHERE source_swap_id = $1`;
            await this.pool.query(query, [sourceSwapId]);
        } catch (error) {
            logger.error('Failed to remove targeting relationship', { error, sourceSwapId });
            throw error;
        }
    }

    /**
     * Update a swap target
     */
    async updateTarget(targetId: string, updates: Partial<SwapTarget>): Promise<SwapTarget | null> {
        try {
            const updateFields: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (updates.status !== undefined) {
                updateFields.push(`status = $${paramIndex++}`);
                values.push(updates.status);
            }

            if (updateFields.length === 0) {
                return this.findById(targetId);
            }

            updateFields.push(`updated_at = NOW()`);
            values.push(targetId);

            const query = `
        UPDATE swap_targets
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

            const result = await this.pool.query(query, values);
            return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
        } catch (error) {
            logger.error('Failed to update swap target', { error, targetId, updates });
            throw error;
        }
    }

    /**
     * Delete a swap target
     */
    async deleteTarget(targetId: string): Promise<void> {
        try {
            const query = `DELETE FROM swap_targets WHERE id = $1`;
            await this.pool.query(query, [targetId]);
        } catch (error) {
            logger.error('Failed to delete swap target', { error, targetId });
            throw error;
        }
    }

    /**
     * Find swap target by source swap ID
     */
    async findBySourceSwap(sourceSwapId: string): Promise<SwapTarget | null> {
        try {
            const query = `SELECT * FROM swap_targets WHERE source_swap_id = $1`;
            const result = await this.pool.query(query, [sourceSwapId]);

            return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
        } catch (error) {
            logger.error('Failed to find target by source swap', { error, sourceSwapId });
            throw error;
        }
    }

    /**
     * Find all swap targets for a target swap ID
     */
    async findByTargetSwap(targetSwapId: string): Promise<SwapTarget[]> {
        try {
            const query = `
        SELECT * FROM swap_targets 
        WHERE target_swap_id = $1 
        ORDER BY created_at DESC
      `;
            const result = await this.pool.query(query, [targetSwapId]);

            return result.rows.map(row => this.mapRowToEntity(row));
        } catch (error) {
            logger.error('Failed to find targets by target swap', { error, targetSwapId });
            throw error;
        }
    }

    /**
     * Find active targets for a user (by their swap IDs)
     */
    async findActiveTargets(userId: string): Promise<SwapTarget[]> {
        try {
            const query = `
        SELECT st.* FROM swap_targets st
        JOIN swaps s ON st.source_swap_id = s.id
        JOIN bookings b ON s.source_booking_id = b.id
        WHERE b.user_id = $1 AND st.status = 'active'
        ORDER BY st.created_at DESC
      `;
            const result = await this.pool.query(query, [userId]);

            return result.rows.map(row => this.mapRowToEntity(row));
        } catch (error) {
            logger.error('Failed to find active targets for user', { error, userId });
            throw error;
        }
    }

    /**
     * Create targeting history entry
     */
    async createHistoryEntry(entry: CreateTargetingHistoryRequest): Promise<TargetingHistory> {
        try {
            const query = `
        INSERT INTO swap_targeting_history (source_swap_id, target_swap_id, action, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

            const result = await this.pool.query(query, [
                entry.sourceSwapId,
                entry.targetSwapId || null,
                entry.action,
                entry.metadata ? JSON.stringify(entry.metadata) : null
            ]);

            return this.mapRowToHistoryEntity(result.rows[0]);
        } catch (error) {
            logger.error('Failed to create targeting history entry', { error, entry });
            throw error;
        }
    }

    /**
     * Get targeting history for a swap
     */
    async getTargetingHistory(swapId: string): Promise<TargetingHistory[]> {
        try {
            const query = `
        SELECT * FROM swap_targeting_history 
        WHERE source_swap_id = $1 OR target_swap_id = $1
        ORDER BY timestamp DESC
      `;
            const result = await this.pool.query(query, [swapId]);

            return result.rows.map(row => this.mapRowToHistoryEntity(row));
        } catch (error) {
            logger.error('Failed to get targeting history', { error, swapId });
            throw error;
        }
    }

    /**
     * Check if a swap has an active target
     */
    async hasActiveTarget(sourceSwapId: string): Promise<boolean> {
        try {
            const query = `
        SELECT 1 FROM swap_targets 
        WHERE source_swap_id = $1 AND status = 'active'
        LIMIT 1
      `;
            const result = await this.pool.query(query, [sourceSwapId]);

            return result.rows.length > 0;
        } catch (error) {
            logger.error('Failed to check if swap has active target', { error, sourceSwapId });
            throw error;
        }
    }

    /**
     * Count active targets for a swap
     */
    async countTargetsForSwap(targetSwapId: string): Promise<number> {
        try {
            const query = `
        SELECT COUNT(*) as count FROM swap_targets 
        WHERE target_swap_id = $1 AND status = 'active'
      `;
            const result = await this.pool.query(query, [targetSwapId]);

            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Failed to count targets for swap', { error, targetSwapId });
            throw error;
        }
    }

    /**
     * Check for circular targeting
     */
    async findCircularTargeting(sourceSwapId: string, targetSwapId: string): Promise<boolean> {
        try {
            // Check direct circular targeting (A->B and B->A)
            const directQuery = `
        SELECT 1 FROM swap_targets 
        WHERE source_swap_id = $1 AND target_swap_id = $2 AND status = 'active'
        LIMIT 1
      `;
            const directResult = await this.pool.query(directQuery, [targetSwapId, sourceSwapId]);

            if (directResult.rows.length > 0) {
                return true;
            }

            // Check for indirect circular targeting using recursive CTE
            const indirectQuery = `
        WITH RECURSIVE targeting_chain AS (
          -- Base case: direct targets of the proposed target
          SELECT target_swap_id as chain_target, 1 as depth
          FROM swap_targets 
          WHERE source_swap_id = $1 AND status = 'active'
          
          UNION ALL
          
          -- Recursive case: follow the chain
          SELECT st.target_swap_id, tc.depth + 1
          FROM swap_targets st
          JOIN targeting_chain tc ON st.source_swap_id = tc.chain_target
          WHERE st.status = 'active' AND tc.depth < 10  -- Limit recursion depth
        )
        SELECT 1 FROM targeting_chain 
        WHERE chain_target = $2
        LIMIT 1
      `;
            const indirectResult = await this.pool.query(indirectQuery, [targetSwapId, sourceSwapId]);

            return indirectResult.rows.length > 0;
        } catch (error) {
            logger.error('Failed to check for circular targeting', { error, sourceSwapId, targetSwapId });
            throw error;
        }
    }

    /**
     * Get targeting statistics for a swap
     */
    async getTargetingStats(swapId: string): Promise<{
        timesTargeted: number;
        timesTargeting: number;
        activeTargets: number;
        lastTargetedAt?: Date;
    }> {
        try {
            const query = `
        SELECT 
          (SELECT COUNT(*) FROM swap_targets WHERE target_swap_id = $1) as times_targeted,
          (SELECT COUNT(*) FROM swap_targets WHERE source_swap_id = $1) as times_targeting,
          (SELECT COUNT(*) FROM swap_targets WHERE target_swap_id = $1 AND status = 'active') as active_targets,
          (SELECT MAX(created_at) FROM swap_targets WHERE target_swap_id = $1) as last_targeted_at
      `;
            const result = await this.pool.query(query, [swapId]);

            const row = result.rows[0];
            return {
                timesTargeted: parseInt(row.times_targeted),
                timesTargeting: parseInt(row.times_targeting),
                activeTargets: parseInt(row.active_targets),
                lastTargetedAt: row.last_targeted_at ? new Date(row.last_targeted_at) : undefined,
            };
        } catch (error) {
            logger.error('Failed to get targeting stats', { error, swapId });
            throw error;
        }
    }

    /**
     * Find swaps targeting a specific user's swaps
     */
    async findSwapsTargetingUser(userId: string, limit: number = 100, offset: number = 0): Promise<SwapTarget[]> {
        try {
            const query = `
        SELECT st.* FROM swap_targets st
        JOIN swaps s ON st.target_swap_id = s.id
        JOIN bookings b ON s.source_booking_id = b.id
        WHERE b.user_id = $1 AND st.status = 'active'
        ORDER BY st.created_at DESC
        LIMIT $2 OFFSET $3
      `;
            const result = await this.pool.query(query, [userId, limit, offset]);

            return result.rows.map(row => this.mapRowToEntity(row));
        } catch (error) {
            logger.error('Failed to find swaps targeting user', { error, userId });
            throw error;
        }
    }

    /**
     * Cancel all active targets for a source swap (used during retargeting)
     */
    async cancelActiveTargetsForSwap(sourceSwapId: string): Promise<SwapTarget[]> {
        return this.executeInTransaction(async (client: PoolClient) => {
            try {
                // First get the active targets
                const selectQuery = `
          SELECT * FROM swap_targets 
          WHERE source_swap_id = $1 AND status = 'active'
        `;
                const selectResult = await client.query(selectQuery, [sourceSwapId]);
                const activeTargets = selectResult.rows.map(row => this.mapRowToEntity(row));

                // Update them to cancelled
                const updateQuery = `
          UPDATE swap_targets 
          SET status = 'cancelled', updated_at = NOW()
          WHERE source_swap_id = $1 AND status = 'active'
          RETURNING *
        `;
                await client.query(updateQuery, [sourceSwapId]);

                // Create history entries for each cancelled target
                for (const target of activeTargets) {
                    const historyQuery = `
            INSERT INTO swap_targeting_history (source_swap_id, target_swap_id, action, metadata)
            VALUES ($1, $2, $3, $4)
          `;
                    await client.query(historyQuery, [
                        target.sourceSwapId,
                        target.targetSwapId,
                        'cancelled',
                        JSON.stringify({ reason: 'retargeting', previousTargetId: target.id })
                    ]);
                }

                return activeTargets;
            } catch (error) {
                logger.error('Failed to cancel active targets for swap', { error, sourceSwapId });
                throw error;
            }
        });
    }

    /**
     * Get targeting eligibility information for a swap
     */
    async getTargetingEligibility(targetSwapId: string, sourceUserId: string): Promise<{
        canTarget: boolean;
        hasExistingProposal: boolean;
        isAuctionMode: boolean;
        auctionEndDate?: Date;
        currentProposalCount: number;
        restrictions: string[];
    }> {
        try {
            const query = `
        SELECT 
          s.id,
          b.user_id as owner_id,
          s.status as swap_status,
          s.acceptance_strategy,
          sa.id as auction_id,
          sa.status as auction_status,
          (sa.settings->>'endDate')::timestamp as auction_end_date,
          (SELECT COUNT(*) FROM swap_targets WHERE target_swap_id = s.id AND status = 'active') as proposal_count,
          (SELECT COUNT(*) FROM swap_targets st 
           JOIN swaps ss ON st.source_swap_id = ss.id 
           JOIN bookings sb ON ss.source_booking_id = sb.id 
           WHERE st.target_swap_id = s.id AND sb.user_id = $2 AND st.status = 'active') as user_proposal_count
        FROM swaps s
        JOIN bookings b ON s.source_booking_id = b.id
        LEFT JOIN swap_auctions sa ON s.id = sa.swap_id AND sa.status = 'active'
        WHERE s.id = $1
      `;

            const result = await this.pool.query(query, [targetSwapId, sourceUserId]);

            if (result.rows.length === 0) {
                return {
                    canTarget: false,
                    hasExistingProposal: false,
                    isAuctionMode: false,
                    currentProposalCount: 0,
                    restrictions: ['Swap not found']
                };
            }

            const row = result.rows[0];
            const restrictions: string[] = [];
            let canTarget = true;

            // Check if user owns the swap
            if (row.owner_id === sourceUserId) {
                canTarget = false;
                restrictions.push('Cannot target your own swap');
            }

            // Check swap status
            if (row.swap_status !== 'pending') {
                canTarget = false;
                restrictions.push('Swap is not available for targeting');
            }

            const acceptanceStrategy = typeof row.acceptance_strategy === 'string'
                ? JSON.parse(row.acceptance_strategy)
                : row.acceptance_strategy;

            const isAuctionMode = acceptanceStrategy?.type === 'auction';
            const proposalCount = parseInt(row.proposal_count) || 0;
            const userProposalCount = parseInt(row.user_proposal_count) || 0;

            // Check auction mode rules
            if (isAuctionMode) {
                const auctionEndDate = row.auction_end_date ? new Date(row.auction_end_date) : null;
                if (auctionEndDate && auctionEndDate <= new Date()) {
                    canTarget = false;
                    restrictions.push('Auction has ended');
                }
            } else {
                // One-for-one mode: check for existing proposals
                if (proposalCount > 0 && userProposalCount === 0) {
                    canTarget = false;
                    restrictions.push('Swap already has a pending proposal');
                }
            }

            return {
                canTarget,
                hasExistingProposal: userProposalCount > 0,
                isAuctionMode,
                auctionEndDate: row.auction_end_date ? new Date(row.auction_end_date) : undefined,
                currentProposalCount: proposalCount,
                restrictions
            };
        } catch (error) {
            logger.error('Failed to get targeting eligibility', { error, targetSwapId, sourceUserId });
            throw error;
        }
    }

    /**
     * Cleanup orphaned targeting relationships
     */
    async cleanupOrphanedTargets(): Promise<number> {
        try {
            const query = `
        DELETE FROM swap_targets st
        WHERE NOT EXISTS (
          SELECT 1 FROM swaps s1 WHERE s1.id = st.source_swap_id
        ) OR NOT EXISTS (
          SELECT 1 FROM swaps s2 WHERE s2.id = st.target_swap_id
        )
      `;

            const result = await this.pool.query(query);
            const deletedCount = result.rowCount || 0;

            if (deletedCount > 0) {
                logger.info('Cleaned up orphaned targeting relationships', { deletedCount });
            }

            return deletedCount;
        } catch (error) {
            logger.error('Failed to cleanup orphaned targets', { error });
            throw error;
        }
    }

    /**
     * Get all targeting relationships for user's swaps
     * Enhanced to include both swap_targets and regular swap proposals
     * Requirements: 3.1, 3.2, 3.3, 7.3, 7.4
     */
    async getTargetingDataForUserSwaps(userId: string): Promise<{
        incomingTargets: Array<{
            targetId: string;
            targetSwapId: string;
            sourceSwapId: string;
            sourceSwapDetails: {
                id: string;
                bookingId: string;
                bookingTitle: string;
                bookingLocation: string;
                bookingCheckIn: Date;
                bookingCheckOut: Date;
                bookingPrice: number;
                ownerId: string;
                ownerName: string;
                ownerEmail: string;
            };
            proposalId: string;
            proposalType: 'booking' | 'cash';
            cashOfferAmount?: number;
            cashOfferCurrency?: string;
            status: SwapTargetStatus;
            createdAt: Date;
            updatedAt: Date;
        }>;
        outgoingTargets: Array<{
            targetId: string;
            sourceSwapId: string;
            targetSwapId: string;
            targetSwapDetails: {
                id: string;
                bookingId: string;
                bookingTitle: string;
                bookingLocation: string;
                bookingCheckIn: Date;
                bookingCheckOut: Date;
                bookingPrice: number;
                ownerId: string;
                ownerName: string;
                ownerEmail: string;
                acceptanceStrategy: any;
            };
            proposalId: string;
            status: SwapTargetStatus;
            createdAt: Date;
            updatedAt: Date;
        }>;
    }> {
        try {
            // Query for incoming targets - UNION both swap_targets and swap_proposals
            const incomingQuery = `
                -- Booking-to-booking proposals from swap_targets table
                SELECT 
                    st.id as target_id,
                    st.target_swap_id,
                    st.source_swap_id,
                    st.id as proposal_id,
                    'booking' as proposal_type,
                    NULL::numeric as cash_offer_amount,
                    NULL::varchar as cash_offer_currency,
                    st.status,
                    st.created_at,
                    st.updated_at,
                    s.source_booking_id,
                    b.title as booking_title,
                    b.city as booking_city,
                    b.country as booking_country,
                    b.check_in_date as booking_check_in,
                    b.check_out_date as booking_check_out,
                    b.original_price as booking_price,
                    u.id as owner_id,
                    u.display_name as owner_name,
                    u.email as owner_email,
                    'targeting' as source_type
                FROM swap_targets st
                JOIN swaps ts ON st.target_swap_id = ts.id  -- Target swap (user's swap)
                JOIN swaps s ON st.source_swap_id = s.id    -- Source swap (other user's swap)
                JOIN bookings b ON s.source_booking_id = b.id
                JOIN users u ON b.user_id = u.id
                WHERE ts.source_booking_id IN (
                    SELECT id FROM bookings WHERE user_id = $1
                ) AND st.status = 'active'
                
                UNION ALL
                
                -- Cash proposals from swap_proposals table
                SELECT 
                    sp.id as target_id,
                    sp.target_swap_id,
                    sp.source_swap_id,
                    sp.id as proposal_id,
                    'cash' as proposal_type,
                    sp.cash_offer_amount,
                    sp.cash_offer_currency,
                    sp.status,
                    sp.created_at,
                    sp.updated_at,
                    COALESCE(s.source_booking_id, sp.source_swap_id) as source_booking_id,
                    COALESCE(b.title, 'Cash Offer') as booking_title,
                    COALESCE(b.city, '') as booking_city,
                    COALESCE(b.country, '') as booking_country,
                    COALESCE(b.check_in_date, sp.created_at) as booking_check_in,
                    COALESCE(b.check_out_date, sp.created_at) as booking_check_out,
                    COALESCE(b.original_price, sp.cash_offer_amount) as booking_price,
                    sp.proposer_id as owner_id,
                    u.display_name as owner_name,
                    u.email as owner_email,
                    'cash_proposal' as source_type
                FROM swap_proposals sp
                JOIN swaps ts ON sp.target_swap_id = ts.id  -- Target swap (user's swap)
                LEFT JOIN swaps s ON sp.source_swap_id = s.id
                LEFT JOIN bookings b ON s.source_booking_id = b.id
                LEFT JOIN users u ON sp.proposer_id = u.id
                WHERE ts.source_booking_id IN (
                    SELECT id FROM bookings WHERE user_id = $1
                ) AND sp.status = 'pending'
                
                ORDER BY created_at DESC
            `;

            // Query for outgoing targets - simplified to work without proposal_id
            const outgoingQuery = `
                -- Outgoing targets from swap_targets table (simplified targeting system)
                SELECT 
                    st.id as target_id,
                    st.source_swap_id,
                    st.target_swap_id,
                    st.id as proposal_id,  -- Use swap_targets.id as proposal reference (FIXED: was source_swap_id)
                    st.status,
                    st.created_at,
                    st.updated_at,
                    s.source_booking_id,
                    s.acceptance_strategy,
                    b.title as booking_title,
                    b.city as booking_city,
                    b.country as booking_country,
                    b.check_in_date as booking_check_in,
                    b.check_out_date as booking_check_out,
                    b.original_price as booking_price,
                    u.id as owner_id,
                    u.display_name as owner_name,
                    u.email as owner_email,
                    'targeting' as source_type
                FROM swap_targets st
                JOIN swaps ss ON st.source_swap_id = ss.id  -- Source swap (user's swap)
                JOIN swaps s ON st.target_swap_id = s.id    -- Target swap (other user's swap)
                JOIN bookings b ON s.source_booking_id = b.id
                JOIN users u ON b.user_id = u.id  -- Get user from booking relationship
                WHERE ss.source_booking_id IN (
                    SELECT id FROM bookings WHERE user_id = $1
                ) AND st.status = 'active'
                
                ORDER BY created_at DESC
            `;

            const [incomingResult, outgoingResult] = await Promise.all([
                this.pool.query(incomingQuery, [userId]),
                this.pool.query(outgoingQuery, [userId])
            ]);

            const incomingTargets = incomingResult.rows.map(row => ({
                targetId: row.target_id,
                targetSwapId: row.target_swap_id,
                sourceSwapId: row.source_swap_id,
                sourceSwapDetails: {
                    id: row.source_swap_id,
                    bookingId: row.source_booking_id,
                    bookingTitle: row.booking_title || 'Untitled Booking',
                    bookingLocation: `${row.booking_city || 'Unknown'}, ${row.booking_country || 'Unknown'}`,
                    bookingCheckIn: new Date(row.booking_check_in),
                    bookingCheckOut: new Date(row.booking_check_out),
                    bookingPrice: parseFloat(row.booking_price) || 0,
                    ownerId: row.owner_id,
                    ownerName: row.owner_name || 'Unknown User',
                    ownerEmail: row.owner_email || ''
                },
                proposalId: row.proposal_id,
                proposalType: row.proposal_type as 'booking' | 'cash',
                cashOfferAmount: row.cash_offer_amount ? parseFloat(row.cash_offer_amount) : undefined,
                cashOfferCurrency: row.cash_offer_currency || undefined,
                status: row.status as SwapTargetStatus,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            }));

            const outgoingTargets = outgoingResult.rows.map(row => ({
                targetId: row.target_id,
                sourceSwapId: row.source_swap_id,
                targetSwapId: row.target_swap_id,
                targetSwapDetails: {
                    id: row.target_swap_id,
                    bookingId: row.source_booking_id,
                    bookingTitle: row.booking_title || 'Untitled Booking',
                    bookingLocation: `${row.booking_city || 'Unknown'}, ${row.booking_country || 'Unknown'}`,
                    bookingCheckIn: new Date(row.booking_check_in),
                    bookingCheckOut: new Date(row.booking_check_out),
                    bookingPrice: parseFloat(row.booking_price) || 0,
                    ownerId: row.owner_id,
                    ownerName: row.owner_name || 'Unknown User',
                    ownerEmail: row.owner_email || '',
                    acceptanceStrategy: typeof row.acceptance_strategy === 'string'
                        ? JSON.parse(row.acceptance_strategy)
                        : (row.acceptance_strategy || { type: 'first_match' })
                },
                proposalId: row.proposal_id,
                status: row.status as SwapTargetStatus,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            }));

            return {
                incomingTargets,
                outgoingTargets
            };
        } catch (error) {
            logger.error('Failed to get targeting data for user swaps', { error, userId });
            throw error;
        }
    }

    /**
     * Get paginated targeting data with filters and sorting
     * Requirements: 7.3
     */
    async getPaginatedTargetingData(userId: string, options: {
        limit: number;
        offset: number;
        direction?: 'incoming' | 'outgoing' | 'both';
        status?: string[];
        sortBy?: string;
        sortOrder?: 'ASC' | 'DESC';
    }): Promise<any[]> {
        try {
            const {
                limit,
                offset,
                direction = 'both',
                status = ['active'],
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = options;

            let directionFilter = '';
            if (direction === 'incoming') {
                directionFilter = "AND direction = 'incoming'";
            } else if (direction === 'outgoing') {
                directionFilter = "AND direction = 'outgoing'";
            }

            const paginatedQuery = `
                WITH user_swaps AS (
                    SELECT id, source_booking_id, owner_id, status, acceptance_strategy
                    FROM swaps 
                    WHERE owner_id = $1 AND status IN ('pending', 'accepted')
                ),
                all_targeting_data AS (
                    -- Incoming targets
                    SELECT 
                        'incoming' as direction,
                        st.id as target_id,
                        st.target_swap_id,
                        st.source_swap_id,
                        st.id as proposal_id,  -- Use swap_targets.id as proposal reference (FIXED: was source_swap_id)
                        st.status,
                        st.created_at,
                        st.updated_at,
                        
                        ss.source_booking_id,
                        sb.title as booking_title,
                        sb.city as booking_city,
                        sb.country as booking_country,
                        sb.check_in_date as check_in,
                        sb.check_out_date as check_out,
                        sb.original_price as price,
                        su.display_name as owner_name,
                        su.email as owner_email
                    FROM swap_targets st
                    JOIN user_swaps us ON st.target_swap_id = us.id
                    JOIN swaps ss ON st.source_swap_id = ss.id
                    JOIN bookings sb ON ss.source_booking_id = sb.id
                    JOIN users su ON sb.user_id = su.id  -- Get user from booking relationship
                    WHERE st.status = ANY($2::text[])
                    
                    UNION ALL
                    
                    -- Outgoing targets
                    SELECT 
                        'outgoing' as direction,
                        st.id as target_id,
                        st.source_swap_id as target_swap_id,
                        st.target_swap_id as source_swap_id,
                        st.id as proposal_id,  -- Use swap_targets.id as proposal reference (FIXED: was source_swap_id)
                        st.status,
                        st.created_at,
                        st.updated_at,
                        
                        ts.source_booking_id,
                        tb.title as booking_title,
                        tb.city as booking_city,
                        tb.country as booking_country,
                        tb.check_in_date as check_in,
                        tb.check_out_date as check_out,
                        tb.original_price as price,
                        tu.display_name as owner_name,
                        tu.email as owner_email
                    FROM swap_targets st
                    JOIN user_swaps us ON st.source_swap_id = us.id
                    JOIN swaps ts ON st.target_swap_id = ts.id
                    JOIN bookings tb ON ts.source_booking_id = tb.id
                    JOIN users tu ON tb.user_id = tu.id  -- Get user from booking relationship
                    WHERE st.status = ANY($2::text[])
                )
                SELECT *
                FROM all_targeting_data
                WHERE 1=1 ${directionFilter}
                ORDER BY ${sortBy} ${sortOrder}
                LIMIT $3 OFFSET $4
            `;

            const result = await this.pool.query(paginatedQuery, [userId, status, limit, offset]);

            return result.rows.map(row => ({
                targetId: row.target_id,
                direction: row.direction,
                targetSwapId: row.target_swap_id,
                sourceSwapId: row.source_swap_id,
                proposalId: row.proposal_id,
                status: row.status,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at),
                bookingDetails: {
                    id: row.source_booking_id,
                    title: row.booking_title || 'Untitled Booking',
                    location: `${row.booking_city || 'Unknown'}, ${row.booking_country || 'Unknown'}`,
                    checkIn: new Date(row.check_in),
                    checkOut: new Date(row.check_out),
                    price: parseFloat(row.price) || 0,
                    ownerName: row.owner_name || 'Unknown User',
                    ownerEmail: row.owner_email || ''
                }
            }));
        } catch (error: any) {
            logger.error('Failed to get paginated targeting data with filters', {
                error: error.message,
                userId,
                options
            });
            return [];
        }
    }

    /**
     * Get targeting count for pagination
     * Requirements: 7.2
     */
    async getTargetingCount(userId: string, options: {
        direction?: 'incoming' | 'outgoing' | 'both';
        status?: string[];
    }): Promise<number> {
        try {
            const { direction = 'both', status = ['active'] } = options;

            let directionFilter = '';
            if (direction === 'incoming') {
                directionFilter = "AND direction = 'incoming'";
            } else if (direction === 'outgoing') {
                directionFilter = "AND direction = 'outgoing'";
            }

            const countQuery = `
                WITH user_swaps AS (
                    SELECT id FROM swaps 
                    WHERE owner_id = $1 AND status IN ('pending', 'accepted')
                ),
                all_targeting_data AS (
                    -- Incoming targets
                    SELECT 'incoming' as direction
                    FROM swap_targets st
                    JOIN user_swaps us ON st.target_swap_id = us.id
                    WHERE st.status = ANY($2::text[])
                    
                    UNION ALL
                    
                    -- Outgoing targets
                    SELECT 'outgoing' as direction
                    FROM swap_targets st
                    JOIN user_swaps us ON st.source_swap_id = us.id
                    WHERE st.status = ANY($2::text[])
                )
                SELECT COUNT(*) as total
                FROM all_targeting_data
                WHERE 1=1 ${directionFilter}
            `;

            const result = await this.pool.query(countQuery, [userId, status]);
            return parseInt(result.rows[0].total) || 0;
        } catch (error: any) {
            logger.error('Failed to get targeting count', {
                error: error.message,
                userId,
                options
            });
            return 0;
        }
    }

    /**
     * Get targeting counts for a user with caching support
     * Requirements: 1.1, 1.3, 2.1
     */
    async getTargetingCounts(userId: string): Promise<{
        incomingCount: number;
        outgoingCount: number;
        totalCount: number;
        activeCount: number;
    }> {
        try {
            const query = `
                WITH user_swaps AS (
                    SELECT id FROM swaps 
                    WHERE owner_id = $1 AND status IN ('pending', 'accepted')
                ),
                targeting_counts AS (
                    -- Incoming targets (other users targeting this user's swaps)
                    SELECT 
                        COUNT(*) FILTER (WHERE st.status = 'active') as incoming_active,
                        COUNT(*) as incoming_total
                    FROM swap_targets st
                    JOIN user_swaps us ON st.target_swap_id = us.id
                    
                    UNION ALL
                    
                    -- Outgoing targets (this user targeting other users' swaps)
                    SELECT 
                        COUNT(*) FILTER (WHERE st.status = 'active') as outgoing_active,
                        COUNT(*) as outgoing_total
                    FROM swap_targets st
                    JOIN user_swaps us ON st.source_swap_id = us.id
                )
                SELECT 
                    COALESCE(SUM(CASE WHEN incoming_total > 0 THEN incoming_active ELSE 0 END), 0) as incoming_count,
                    COALESCE(SUM(CASE WHEN outgoing_total > 0 THEN outgoing_active ELSE 0 END), 0) as outgoing_count,
                    COALESCE(SUM(incoming_total + outgoing_total), 0) as total_count,
                    COALESCE(SUM(incoming_active + outgoing_active), 0) as active_count
                FROM targeting_counts
            `;

            const result = await this.pool.query(query, [userId]);
            const row = result.rows[0];

            return {
                incomingCount: parseInt(row.incoming_count) || 0,
                outgoingCount: parseInt(row.outgoing_count) || 0,
                totalCount: parseInt(row.total_count) || 0,
                activeCount: parseInt(row.active_count) || 0,
            };
        } catch (error: any) {
            logger.error('Failed to get targeting counts', {
                error: error.message,
                userId
            });
            // Return fallback zeros on error
            return {
                incomingCount: 0,
                outgoingCount: 0,
                totalCount: 0,
                activeCount: 0,
            };
        }
    }

    /**
     * Get incoming targets for specific swaps
     * Requirements: 3.1, 3.2, 7.3, 7.4
     */
    async getIncomingTargetsForSwaps(swapIds: string[]): Promise<Array<{
        targetId: string;
        targetSwapId: string;
        sourceSwapId: string;
        sourceSwapDetails: any;
        proposalId: string;
        proposalType: 'booking' | 'cash';
        cashOfferAmount?: number;
        cashOfferCurrency?: string;
        status: SwapTargetStatus;
        createdAt: Date;
        updatedAt: Date;
    }>> {
        try {
            if (swapIds.length === 0) {
                return [];
            }

            // UNION query to fetch BOTH booking-to-booking proposals (swap_targets) 
            // AND cash proposals (swap_proposals)
            const query = `
                -- Booking-to-booking proposals from swap_targets table
                SELECT 
                    st.id as target_id,
                    st.target_swap_id,
                    st.source_swap_id,
                    st.id as proposal_id,  -- Use swap_targets.id as proposal reference
                    'booking' as proposal_type,
                    NULL::numeric as cash_offer_amount,
                    NULL::varchar as cash_offer_currency,
                    st.status,
                    st.created_at,
                    st.updated_at,
                    s.source_booking_id,
                    b.title as booking_title,
                    b.city as booking_city,
                    b.country as booking_country,
                    b.check_in_date as booking_check_in,
                    b.check_out_date as booking_check_out,
                    b.original_price as booking_price,
                    u.id as owner_id,
                    u.display_name as owner_name,
                    u.email as owner_email
                FROM swap_targets st
                JOIN swaps s ON st.source_swap_id = s.id
                JOIN bookings b ON s.source_booking_id = b.id
                JOIN users u ON b.user_id = u.id
                WHERE st.target_swap_id = ANY($1) AND st.status = 'active'
                
                UNION ALL
                
                -- Cash proposals from swap_proposals table
                SELECT 
                    sp.id as target_id,
                    sp.target_swap_id,
                    sp.source_swap_id,
                    sp.id as proposal_id,  -- Use swap_proposals.id as proposal reference
                    'cash' as proposal_type,
                    sp.cash_offer_amount,
                    sp.cash_offer_currency,
                    sp.status,
                    sp.created_at,
                    sp.updated_at,
                    COALESCE(s.source_booking_id, sp.source_swap_id) as source_booking_id,
                    COALESCE(b.title, 'Cash Offer') as booking_title,
                    COALESCE(b.city, '') as booking_city,
                    COALESCE(b.country, '') as booking_country,
                    COALESCE(b.check_in_date, sp.created_at) as booking_check_in,
                    COALESCE(b.check_out_date, sp.created_at) as booking_check_out,
                    COALESCE(b.original_price, sp.cash_offer_amount) as booking_price,
                    sp.proposer_id as owner_id,
                    u.display_name as owner_name,
                    u.email as owner_email
                FROM swap_proposals sp
                LEFT JOIN swaps s ON sp.source_swap_id = s.id
                LEFT JOIN bookings b ON s.source_booking_id = b.id
                LEFT JOIN users u ON sp.proposer_id = u.id
                WHERE sp.target_swap_id = ANY($1) AND sp.status = 'pending'
                
                ORDER BY created_at DESC
            `;

            const result = await this.pool.query(query, [swapIds]);

            return result.rows.map(row => ({
                targetId: row.target_id,
                targetSwapId: row.target_swap_id,
                sourceSwapId: row.source_swap_id,
                sourceSwapDetails: {
                    id: row.source_swap_id,
                    bookingId: row.source_booking_id,
                    bookingTitle: row.booking_title,
                    bookingLocation: `${row.booking_city}, ${row.booking_country}`,
                    bookingCheckIn: new Date(row.booking_check_in),
                    bookingCheckOut: new Date(row.booking_check_out),
                    bookingPrice: parseFloat(row.booking_price) || 0,
                    ownerId: row.owner_id,
                    ownerName: row.owner_name,
                    ownerEmail: row.owner_email
                },
                proposalId: row.proposal_id,
                proposalType: row.proposal_type as 'booking' | 'cash',
                cashOfferAmount: row.cash_offer_amount ? parseFloat(row.cash_offer_amount) : undefined,
                cashOfferCurrency: row.cash_offer_currency || undefined,
                status: row.status,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            }));
        } catch (error) {
            logger.error('Failed to get incoming targets for swaps', { error, swapIds });
            throw error;
        }
    }

    /**
     * Get outgoing targets for specific swaps
     * Requirements: 3.1, 3.2, 7.3, 7.4
     */
    async getOutgoingTargetsForSwaps(swapIds: string[]): Promise<Array<{
        targetId: string;
        sourceSwapId: string;
        targetSwapId: string;
        targetSwapDetails: any;
        proposalId: string;
        status: SwapTargetStatus;
        createdAt: Date;
        updatedAt: Date;
    }>> {
        try {
            if (swapIds.length === 0) {
                return [];
            }

            const query = `
                SELECT 
                    st.id as target_id,
                    st.source_swap_id,
                    st.target_swap_id,
                    st.id as proposal_id,  -- Use swap_targets.id as proposal reference (this is the correct proposal identifier)
                    st.status,
                    st.created_at,
                    st.updated_at,
                    s.source_booking_id,
                    s.acceptance_strategy,
                    b.title as booking_title,
                    b.city as booking_city,
                    b.country as booking_country,
                    b.check_in_date as booking_check_in,
                    b.check_out_date as booking_check_out,
                    b.original_price as booking_price,
                    u.id as owner_id,
                    u.display_name as owner_name,
                    u.email as owner_email
                FROM swap_targets st
                JOIN swaps s ON st.target_swap_id = s.id
                JOIN bookings b ON s.source_booking_id = b.id
                JOIN users u ON b.user_id = u.id  -- Get user from booking relationship
                WHERE st.source_swap_id = ANY($1) AND st.status = 'active'
                ORDER BY st.created_at DESC
            `;

            const result = await this.pool.query(query, [swapIds]);

            return result.rows.map(row => ({
                targetId: row.target_id,
                sourceSwapId: row.source_swap_id,
                targetSwapId: row.target_swap_id,
                targetSwapDetails: {
                    id: row.target_swap_id,
                    bookingId: row.source_booking_id,
                    bookingTitle: row.booking_title,
                    bookingLocation: `${row.booking_city}, ${row.booking_country}`,
                    bookingCheckIn: new Date(row.booking_check_in),
                    bookingCheckOut: new Date(row.booking_check_out),
                    bookingPrice: parseFloat(row.booking_price) || 0,
                    ownerId: row.owner_id,
                    ownerName: row.owner_name,
                    ownerEmail: row.owner_email,
                    acceptanceStrategy: typeof row.acceptance_strategy === 'string'
                        ? JSON.parse(row.acceptance_strategy)
                        : row.acceptance_strategy
                },
                proposalId: row.proposal_id,
                status: row.status,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            }));
        } catch (error) {
            logger.error('Failed to get outgoing targets for swaps', { error, swapIds });
            throw error;
        }
    }

    /**
     * Get targeting restrictions for swaps
     * Requirements: 3.3, 7.3, 7.4
     */
    async getTargetingRestrictionsForSwaps(swapIds: string[], userId: string): Promise<Array<{
        swapId: string;
        canReceiveTargets: boolean;
        canTarget: boolean;
        restrictions: Array<{
            type: string;
            message: string;
            severity: 'error' | 'warning' | 'info';
        }>;
        maxIncomingTargets?: number;
        currentIncomingTargets: number;
    }>> {
        try {
            if (swapIds.length === 0) {
                return [];
            }

            const query = `
                SELECT 
                    s.id as swap_id,
                    s.status as swap_status,
                    s.owner_id,
                    s.acceptance_strategy,
                    sa.id as auction_id,
                    sa.status as auction_status,
                    (sa.settings->>'endDate')::timestamp as auction_end_date,
                    (SELECT COUNT(*) FROM swap_targets WHERE target_swap_id = s.id AND status = 'active') as incoming_target_count,
                    (SELECT COUNT(*) FROM swap_targets WHERE source_swap_id = s.id AND status = 'active') as outgoing_target_count
                FROM swaps s
                LEFT JOIN swap_auctions sa ON s.id = sa.swap_id AND sa.status = 'active'
                WHERE s.id = ANY($1)
            `;

            const result = await this.pool.query(query, [swapIds]);

            return result.rows.map(row => {
                const restrictions: Array<{
                    type: string;
                    message: string;
                    severity: 'error' | 'warning' | 'info';
                }> = [];

                let canReceiveTargets = true;
                let canTarget = true;

                // Check swap status
                if (row.swap_status !== 'pending') {
                    canReceiveTargets = false;
                    canTarget = false;
                    restrictions.push({
                        type: 'swap_unavailable',
                        message: 'Swap is not available for targeting',
                        severity: 'error'
                    });
                }

                // Check auction mode restrictions
                const acceptanceStrategy = typeof row.acceptance_strategy === 'string'
                    ? JSON.parse(row.acceptance_strategy)
                    : row.acceptance_strategy;

                const isAuctionMode = acceptanceStrategy?.type === 'auction';
                let maxIncomingTargets: number | undefined;

                if (isAuctionMode) {
                    const auctionEndDate = row.auction_end_date ? new Date(row.auction_end_date) : null;
                    if (auctionEndDate && auctionEndDate <= new Date()) {
                        canReceiveTargets = false;
                        restrictions.push({
                            type: 'auction_ended',
                            message: 'Auction has ended',
                            severity: 'error'
                        });
                    }
                    // Auction mode allows multiple targets
                    maxIncomingTargets = acceptanceStrategy.maxProposals || 10;
                } else {
                    // One-for-one mode: only one target allowed
                    maxIncomingTargets = 1;
                    if (parseInt(row.incoming_target_count) >= 1) {
                        canReceiveTargets = false;
                        restrictions.push({
                            type: 'proposal_pending',
                            message: 'Swap already has a pending proposal',
                            severity: 'error'
                        });
                    }
                }

                // Check if user already has an outgoing target (can only target one at a time)
                if (parseInt(row.outgoing_target_count) > 0) {
                    restrictions.push({
                        type: 'already_targeted',
                        message: 'Swap is already targeting another swap',
                        severity: 'warning'
                    });
                }

                return {
                    swapId: row.swap_id,
                    canReceiveTargets,
                    canTarget,
                    restrictions,
                    maxIncomingTargets,
                    currentIncomingTargets: parseInt(row.incoming_target_count) || 0
                };
            });
        } catch (error) {
            logger.error('Failed to get targeting restrictions for swaps', { error, swapIds, userId });
            throw error;
        }
    }
}