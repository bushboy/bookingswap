import { Pool, PoolClient } from 'pg';
import { SwapProposal, ProposalResponse, PaymentTransaction } from '@booking-swap/shared';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface AcceptanceTransactionData {
    proposalId: string;
    userId: string;
    swapId?: string;
    paymentTransactionId?: string;
    blockchainTransactionId: string;
    responseData?: Record<string, any>;
}

export interface RejectionTransactionData {
    proposalId: string;
    userId: string;
    reason?: string;
    blockchainTransactionId: string;
    responseData?: Record<string, any>;
}

export interface AcceptanceTransactionResult {
    proposal: SwapProposal;
    response: ProposalResponse;
    swap?: any; // Will be typed as Swap when available
    payment?: PaymentTransaction;
}

export interface RejectionTransactionResult {
    proposal: SwapProposal;
    response: ProposalResponse;
}

export interface PaymentTransactionData {
    transactionId: string;
    amount: number;
    currency: string;
    status: string;
    gatewayTransactionId?: string;
    platformFee: number;
    netAmount: number;
}

/**
 * ProposalTransactionManager handles atomic database operations for proposal acceptance and rejection.
 * Ensures data integrity through proper transaction management and rollback capabilities.
 * 
 * Requirements: 4.1, 4.2, 6.1, 6.2
 */
export class ProposalTransactionManager {
    constructor(public readonly pool: Pool) { }

    /**
     * Execute proposal acceptance in atomic transaction with rollback capability
     * Updates proposal status, creates response record, and handles related entities
     * 
     * Requirements: 4.1, 4.2, 6.1
     */
    async executeAcceptanceTransaction(
        proposalId: string,
        userId: string,
        paymentData?: PaymentTransactionData
    ): Promise<AcceptanceTransactionResult> {
        return await this.executeInTransaction(async (client: PoolClient) => {
            try {
                logger.info('Starting acceptance transaction', { proposalId, userId });

                // Step 1: Fetch and validate proposal
                const proposal = await this.fetchProposalForUpdate(client, proposalId);
                this.validateProposalForAcceptance(proposal, userId);

                // Step 2: Update proposal status to accepted
                const updatedProposal = await this.updateProposalStatus(
                    client,
                    proposalId,
                    'accepted',
                    userId
                );

                // Step 3: Create proposal response record
                const responseData: AcceptanceTransactionData = {
                    proposalId,
                    userId,
                    swapId: undefined, // Will be set if swap is created
                    paymentTransactionId: paymentData?.transactionId,
                    blockchainTransactionId: '', // Will be set by caller
                    responseData: paymentData ? { paymentDetails: paymentData } : undefined
                };

                const response = await this.createProposalResponse(
                    client,
                    responseData,
                    'accept'
                );

                // Step 4: Handle payment transaction if provided
                let payment: PaymentTransaction | undefined;
                if (paymentData) {
                    payment = await this.recordPaymentTransaction(client, paymentData, proposalId);
                }

                // Step 5: Update related swap records if needed
                let swap: any | undefined;
                if (proposal.proposalType === 'booking' && proposal.targetSwapId) {
                    swap = await this.updateSwapForAcceptance(
                        client,
                        proposal.sourceSwapId,
                        proposal.targetSwapId
                    );

                    // Update response with swap ID
                    await this.updateResponseSwapId(client, response.id, swap.id);
                }

                logger.info('Acceptance transaction completed successfully', {
                    proposalId,
                    responseId: response.id,
                    hasPayment: !!payment,
                    hasSwap: !!swap
                });

                return {
                    proposal: updatedProposal,
                    response,
                    swap,
                    payment
                };
            } catch (error) {
                logger.error('Acceptance transaction failed', { error, proposalId, userId });
                throw error;
            }
        });
    }

    /**
     * Execute proposal rejection in atomic transaction
     * Updates proposal status and creates response record
     * 
     * Requirements: 4.1, 4.2, 6.1
     */
    async executeRejectionTransaction(
        proposalId: string,
        userId: string,
        reason?: string
    ): Promise<RejectionTransactionResult> {
        return await this.executeInTransaction(async (client: PoolClient) => {
            try {
                logger.info('Starting rejection transaction', { proposalId, userId, reason });

                // Step 1: Fetch and validate proposal
                const proposal = await this.fetchProposalForUpdate(client, proposalId);
                this.validateProposalForRejection(proposal, userId);

                // Step 2: Update proposal status to rejected
                const updatedProposal = await this.updateProposalStatus(
                    client,
                    proposalId,
                    'rejected',
                    userId,
                    reason
                );

                // Step 3: Create proposal response record
                const responseData: RejectionTransactionData = {
                    proposalId,
                    userId,
                    reason,
                    blockchainTransactionId: '', // Will be set by caller
                    responseData: reason ? { rejectionReason: reason } : undefined
                };

                const response = await this.createProposalResponse(
                    client,
                    responseData,
                    'reject',
                    reason
                );

                logger.info('Rejection transaction completed successfully', {
                    proposalId,
                    responseId: response.id,
                    hasReason: !!reason
                });

                return {
                    proposal: updatedProposal,
                    response
                };
            } catch (error) {
                logger.error('Rejection transaction failed', { error, proposalId, userId });
                throw error;
            }
        });
    }

    /**
     * Fetch proposal with row-level locking for update
     * Ensures concurrent access is handled properly
     * 
     * Requirements: 4.2
     */
    private async fetchProposalForUpdate(
        client: PoolClient,
        proposalId: string
    ): Promise<SwapProposal> {
        const query = `
            SELECT 
                id,
                source_swap_id,
                target_swap_id,
                proposer_id,
                target_user_id,
                proposal_type,
                status,
                cash_offer_amount,
                cash_offer_currency,
                escrow_account_id,
                payment_method_id,
                responded_at,
                responded_by,
                rejection_reason,
                blockchain_proposal_transaction_id,
                blockchain_response_transaction_id,
                message,
                conditions,
                expires_at,
                created_at,
                updated_at
            FROM swap_proposals 
            WHERE id = $1 
            FOR UPDATE
        `;

        const result = await client.query(query, [proposalId]);

        if (result.rows.length === 0) {
            throw new Error(`Proposal not found: ${proposalId}`);
        }

        const row = result.rows[0];
        return this.mapRowToProposal(row);
    }

    /**
     * Update proposal status with proper validation
     * 
     * Requirements: 4.1, 4.2
     */
    private async updateProposalStatus(
        client: PoolClient,
        proposalId: string,
        status: 'accepted' | 'rejected',
        userId: string,
        rejectionReason?: string
    ): Promise<SwapProposal> {
        const query = `
            UPDATE swap_proposals 
            SET 
                status = $2,
                responded_at = NOW(),
                responded_by = $3,
                rejection_reason = $4,
                updated_at = NOW()
            WHERE id = $1
            RETURNING 
                id,
                source_swap_id,
                target_swap_id,
                proposer_id,
                target_user_id,
                proposal_type,
                status,
                cash_offer_amount,
                cash_offer_currency,
                escrow_account_id,
                payment_method_id,
                responded_at,
                responded_by,
                rejection_reason,
                blockchain_proposal_transaction_id,
                blockchain_response_transaction_id,
                message,
                conditions,
                expires_at,
                created_at,
                updated_at
        `;

        const result = await client.query(query, [
            proposalId,
            status,
            userId,
            rejectionReason || null
        ]);

        if (result.rows.length === 0) {
            throw new Error(`Failed to update proposal status: ${proposalId}`);
        }

        return this.mapRowToProposal(result.rows[0]);
    }

    /**
     * Create proposal response record
     * 
     * Requirements: 4.1
     */
    private async createProposalResponse(
        client: PoolClient,
        data: AcceptanceTransactionData | RejectionTransactionData,
        action: 'accept' | 'reject',
        reason?: string
    ): Promise<ProposalResponse> {
        const responseId = uuidv4();

        const query = `
            INSERT INTO proposal_responses (
                id,
                proposal_id,
                responder_id,
                action,
                reason,
                swap_id,
                payment_transaction_id,
                blockchain_transaction_id,
                response_data,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            RETURNING 
                id,
                proposal_id,
                responder_id,
                action,
                reason,
                swap_id,
                payment_transaction_id,
                blockchain_transaction_id,
                response_data,
                created_at
        `;

        const values = [
            responseId,
            data.proposalId,
            data.userId,
            action,
            reason || null,
            ('swapId' in data ? data.swapId : null) || null,
            ('paymentTransactionId' in data ? data.paymentTransactionId : null) || null,
            data.blockchainTransactionId || '',
            data.responseData ? JSON.stringify(data.responseData) : null
        ];

        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            throw new Error('Failed to create proposal response');
        }

        return this.mapRowToResponse(result.rows[0]);
    }

    /**
     * Record payment transaction details
     * 
     * Requirements: 4.1
     */
    private async recordPaymentTransaction(
        client: PoolClient,
        paymentData: PaymentTransactionData,
        proposalId: string
    ): Promise<PaymentTransaction> {
        // This would integrate with the existing payment transaction table
        // For now, we'll create a simplified record
        const query = `
            INSERT INTO payment_transactions (
                id,
                proposal_id,
                amount,
                currency,
                status,
                gateway_transaction_id,
                platform_fee,
                net_amount,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                updated_at = NOW()
            RETURNING *
        `;

        const values = [
            paymentData.transactionId,
            proposalId,
            paymentData.amount,
            paymentData.currency,
            paymentData.status,
            paymentData.gatewayTransactionId || null,
            paymentData.platformFee,
            paymentData.netAmount
        ];

        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            throw new Error('Failed to record payment transaction');
        }

        return result.rows[0] as PaymentTransaction;
    }

    /**
     * Update swap records for booking proposal acceptance
     * 
     * Requirements: 4.1, 4.2
     */
    private async updateSwapForAcceptance(
        client: PoolClient,
        sourceSwapId: string,
        targetSwapId: string
    ): Promise<any> {
        // This would update the swaps table to reflect the accepted proposal
        // Implementation depends on the existing swap table structure
        const query = `
            UPDATE swaps 
            SET 
                status = 'matched',
                matched_with = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `;

        const result = await client.query(query, [sourceSwapId, targetSwapId]);

        if (result.rows.length === 0) {
            throw new Error(`Failed to update swap: ${sourceSwapId}`);
        }

        return result.rows[0];
    }

    /**
     * Update response record with swap ID
     * 
     * Requirements: 4.1
     */
    private async updateResponseSwapId(
        client: PoolClient,
        responseId: string,
        swapId: string
    ): Promise<void> {
        const query = `
            UPDATE proposal_responses 
            SET swap_id = $2
            WHERE id = $1
        `;

        await client.query(query, [responseId, swapId]);
    }

    /**
     * Validate proposal can be accepted
     * 
     * Requirements: 6.1
     */
    private validateProposalForAcceptance(proposal: SwapProposal, userId: string): void {
        if (proposal.status !== 'pending') {
            throw new Error(`Cannot accept proposal with status: ${proposal.status}`);
        }

        if (proposal.targetUserId !== userId) {
            throw new Error('User is not authorized to accept this proposal');
        }

        if (proposal.expiresAt && new Date() > proposal.expiresAt) {
            throw new Error('Proposal has expired');
        }
    }

    /**
     * Validate proposal can be rejected
     * 
     * Requirements: 6.1
     */
    private validateProposalForRejection(proposal: SwapProposal, userId: string): void {
        if (proposal.status !== 'pending') {
            throw new Error(`Cannot reject proposal with status: ${proposal.status}`);
        }

        if (proposal.targetUserId !== userId) {
            throw new Error('User is not authorized to reject this proposal');
        }
    }

    /**
     * Execute operation in database transaction with proper error handling
     * Provides automatic rollback on failure and connection management
     * 
     * Requirements: 4.2, 6.1, 6.2
     */
    private async executeInTransaction<T>(
        operation: (client: PoolClient) => Promise<T>
    ): Promise<T> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Set transaction isolation level for consistency
            await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');

            const result = await operation(client);

            await client.query('COMMIT');

            logger.debug('Transaction committed successfully');
            return result;

        } catch (error) {
            await client.query('ROLLBACK');

            logger.error('Transaction rolled back due to error', {
                error: error instanceof Error ? error.message : String(error)
            });

            throw error;

        } finally {
            client.release();
        }
    }

    /**
     * Map database row to SwapProposal object
     */
    private mapRowToProposal(row: any): SwapProposal {
        return {
            id: row.id,
            sourceSwapId: row.source_swap_id,
            targetSwapId: row.target_swap_id,
            proposerId: row.proposer_id,
            targetUserId: row.target_user_id,
            proposalType: row.proposal_type,
            status: row.status,
            cashOffer: row.cash_offer_amount ? {
                amount: parseFloat(row.cash_offer_amount),
                currency: row.cash_offer_currency,
                escrowAccountId: row.escrow_account_id,
                paymentMethodId: row.payment_method_id
            } : undefined,
            respondedAt: row.responded_at,
            respondedBy: row.responded_by,
            rejectionReason: row.rejection_reason,
            blockchain: {
                proposalTransactionId: row.blockchain_proposal_transaction_id,
                responseTransactionId: row.blockchain_response_transaction_id
            },
            message: row.message,
            conditions: row.conditions || [],
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        } as SwapProposal;
    }

    /**
     * Map database row to ProposalResponse object
     */
    private mapRowToResponse(row: any): ProposalResponse {
        return {
            id: row.id,
            proposalId: row.proposal_id,
            responderId: row.responder_id,
            action: row.action,
            reason: row.reason,
            swapId: row.swap_id,
            paymentTransactionId: row.payment_transaction_id,
            blockchainTransactionId: row.blockchain_transaction_id,
            responseData: row.response_data ? JSON.parse(row.response_data) : undefined,
            createdAt: row.created_at
        } as ProposalResponse;
    }
    /**
     * Update blockchain transaction ID in proposal response
     * Called after blockchain transaction is successfully recorded
     * 
     * Requirements: 4.1
     */
    async updateResponseBlockchainTransaction(
        responseId: string,
        blockchainTransactionId: string
    ): Promise<void> {
        return await this.executeInTransaction(async (client: PoolClient) => {
            const query = `
                UPDATE proposal_responses 
                SET blockchain_transaction_id = $2
                WHERE id = $1
            `;

            await client.query(query, [responseId, blockchainTransactionId]);

            logger.debug('Updated response blockchain transaction ID', {
                responseId,
                blockchainTransactionId
            });
        });
    }

    /**
     * Update proposal blockchain response transaction ID
     * Called after blockchain transaction is successfully recorded
     * 
     * Requirements: 4.1
     */
    async updateProposalBlockchainResponse(
        proposalId: string,
        blockchainTransactionId: string
    ): Promise<void> {
        return await this.executeInTransaction(async (client: PoolClient) => {
            const query = `
                UPDATE swap_proposals 
                SET blockchain_response_transaction_id = $2,
                    updated_at = NOW()
                WHERE id = $1
            `;

            await client.query(query, [proposalId, blockchainTransactionId]);

            logger.debug('Updated proposal blockchain response transaction ID', {
                proposalId,
                blockchainTransactionId
            });
        });
    }

    /**
     * Rollback acceptance transaction in case of failure
     * Reverts proposal status and removes response record
     * 
     * Requirements: 6.1, 6.2
     */
    async rollbackAcceptanceTransaction(
        proposalId: string,
        responseId?: string
    ): Promise<void> {
        return await this.executeInTransaction(async (client: PoolClient) => {
            try {
                logger.info('Starting acceptance rollback', { proposalId, responseId });

                // Step 1: Revert proposal status to pending
                await client.query(`
                    UPDATE swap_proposals 
                    SET 
                        status = 'pending',
                        responded_at = NULL,
                        responded_by = NULL,
                        blockchain_response_transaction_id = NULL,
                        updated_at = NOW()
                    WHERE id = $1
                `, [proposalId]);

                // Step 2: Remove proposal response record if it exists
                if (responseId) {
                    await client.query(`
                        DELETE FROM proposal_responses 
                        WHERE id = $1
                    `, [responseId]);
                }

                // Step 3: Revert any swap status changes
                await client.query(`
                    UPDATE swaps 
                    SET 
                        status = 'pending',
                        matched_with = NULL,
                        updated_at = NOW()
                    WHERE id IN (
                        SELECT source_swap_id FROM swap_proposals WHERE id = $1
                        UNION
                        SELECT target_swap_id FROM swap_proposals WHERE id = $1 AND target_swap_id IS NOT NULL
                    )
                `, [proposalId]);

                logger.info('Acceptance rollback completed successfully', { proposalId });
            } catch (error) {
                logger.error('Acceptance rollback failed', { error, proposalId, responseId });
                throw error;
            }
        });
    }

    /**
     * Rollback rejection transaction in case of failure
     * Reverts proposal status and removes response record
     * 
     * Requirements: 6.1, 6.2
     */
    async rollbackRejectionTransaction(
        proposalId: string,
        responseId?: string
    ): Promise<void> {
        return await this.executeInTransaction(async (client: PoolClient) => {
            try {
                logger.info('Starting rejection rollback', { proposalId, responseId });

                // Step 1: Revert proposal status to pending
                await client.query(`
                    UPDATE swap_proposals 
                    SET 
                        status = 'pending',
                        responded_at = NULL,
                        responded_by = NULL,
                        rejection_reason = NULL,
                        blockchain_response_transaction_id = NULL,
                        updated_at = NOW()
                    WHERE id = $1
                `, [proposalId]);

                // Step 2: Remove proposal response record if it exists
                if (responseId) {
                    await client.query(`
                        DELETE FROM proposal_responses 
                        WHERE id = $1
                    `, [responseId]);
                }

                logger.info('Rejection rollback completed successfully', { proposalId });
            } catch (error) {
                logger.error('Rejection rollback failed', { error, proposalId, responseId });
                throw error;
            }
        });
    }

    /**
     * Get proposal response by proposal ID
     * Used for checking if a response already exists
     * 
     * Requirements: 4.1
     */
    async getProposalResponse(proposalId: string): Promise<ProposalResponse | null> {
        const client = await this.pool.connect();

        try {
            const query = `
                SELECT 
                    id,
                    proposal_id,
                    responder_id,
                    action,
                    reason,
                    swap_id,
                    payment_transaction_id,
                    blockchain_transaction_id,
                    response_data,
                    created_at
                FROM proposal_responses 
                WHERE proposal_id = $1
            `;

            const result = await client.query(query, [proposalId]);

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapRowToResponse(result.rows[0]);
        } finally {
            client.release();
        }
    }

    /**
     * Check if proposal exists and get basic info without locking
     * Used for validation before starting transactions
     * 
     * Requirements: 6.1
     */
    async validateProposalExists(proposalId: string): Promise<{
        exists: boolean;
        status?: string;
        targetUserId?: string;
        expiresAt?: Date;
    }> {
        const client = await this.pool.connect();

        try {
            const query = `
                SELECT status, target_user_id, expires_at
                FROM swap_proposals 
                WHERE id = $1
            `;

            const result = await client.query(query, [proposalId]);

            if (result.rows.length === 0) {
                return { exists: false };
            }

            const row = result.rows[0];
            return {
                exists: true,
                status: row.status,
                targetUserId: row.target_user_id,
                expiresAt: row.expires_at
            };
        } finally {
            client.release();
        }
    }
}