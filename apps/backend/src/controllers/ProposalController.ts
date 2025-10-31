import { Request, Response } from 'express';
import { ProposalAcceptanceService, ProposalAcceptanceRequest } from '../services/swap/ProposalAcceptanceService';
import { SwapRepository } from '../database/repositories/SwapRepository';
import { logger } from '../utils/logger';
import { handleSwapError, generateRequestId, SWAP_ERROR_CODES } from '../utils/swap-error-handler';

export class ProposalController {
    constructor(
        private proposalAcceptanceService: ProposalAcceptanceService,
        private swapRepository: SwapRepository
    ) { }

    /**
     * Accept a proposal
     * POST /api/proposals/:proposalId/accept
     */
    acceptProposal = async (req: Request, res: Response): Promise<void> => {
        const requestId = generateRequestId('accept-proposal');

        try {
            const { proposalId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                handleSwapError(
                    new Error('User authentication required'),
                    res,
                    {
                        operation: 'acceptProposal',
                        requestId,
                        requestData: { proposalId }
                    }
                );
                return;
            }

            if (!proposalId) {
                const validationError = new Error('Proposal ID is required');
                (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
                handleSwapError(validationError, res, {
                    operation: 'acceptProposal',
                    userId,
                    requestId,
                    requestData: { proposalId }
                });
                return;
            }

            // Validate UUID format for proposal ID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(proposalId)) {
                const validationError = new Error('Invalid proposal ID format');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'acceptProposal',
                    userId,
                    requestId,
                    requestData: { proposalId }
                });
                return;
            }

            // Extract swapTargetId from request body - this is the correct ID for swap_targets table lookups
            const { swapTargetId } = req.body;

            logger.info('Processing proposal acceptance', {
                requestId,
                userId,
                proposalId,
                swapTargetId,
                usingSwapTargetId: !!swapTargetId
            });

            const acceptanceRequest: ProposalAcceptanceRequest = {
                proposalId: swapTargetId || proposalId, // Prefer swapTargetId if provided (it's the correct swap_targets.id)
                userId,
                action: 'accept',
                swapTargetId
            };

            const result = await this.proposalAcceptanceService.acceptProposal(acceptanceRequest);

            logger.info('Proposal accepted successfully', {
                requestId,
                userId,
                proposalId,
                hasPayment: !!result.paymentTransaction,
                hasSwap: !!result.swap,
                blockchainTxId: result.blockchainTransaction.transactionId
            });

            res.status(200).json({
                success: true,
                data: {
                    proposal: result.proposal,
                    swap: result.swap,
                    paymentTransaction: result.paymentTransaction,
                    blockchain: result.blockchainTransaction
                },
                requestId,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            handleSwapError(error, res, {
                operation: 'acceptProposal',
                userId: req.user?.id,
                requestId,
                requestData: { proposalId: req.params.proposalId }
            });
        }
    };

    /**
     * Reject a proposal
     * POST /api/proposals/:proposalId/reject
     */
    rejectProposal = async (req: Request, res: Response): Promise<void> => {
        const requestId = generateRequestId('reject-proposal');

        try {
            const { proposalId } = req.params;
            const { reason } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                handleSwapError(
                    new Error('User authentication required'),
                    res,
                    {
                        operation: 'rejectProposal',
                        requestId,
                        requestData: { proposalId }
                    }
                );
                return;
            }

            if (!proposalId) {
                const validationError = new Error('Proposal ID is required');
                (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
                handleSwapError(validationError, res, {
                    operation: 'rejectProposal',
                    userId,
                    requestId,
                    requestData: { proposalId }
                });
                return;
            }

            // Validate UUID format for proposal ID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(proposalId)) {
                const validationError = new Error('Invalid proposal ID format');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'rejectProposal',
                    userId,
                    requestId,
                    requestData: { proposalId }
                });
                return;
            }

            // Validate rejection reason if provided
            if (reason && typeof reason !== 'string') {
                const validationError = new Error('Rejection reason must be a string');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'rejectProposal',
                    userId,
                    requestId,
                    requestData: { proposalId, reason }
                });
                return;
            }

            if (reason && reason.length > 500) {
                const validationError = new Error('Rejection reason must be 500 characters or less');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'rejectProposal',
                    userId,
                    requestId,
                    requestData: { proposalId, reasonLength: reason.length }
                });
                return;
            }

            // Extract swapTargetId from request body - this is the correct ID for swap_targets table lookups
            const { swapTargetId } = req.body;

            logger.info('Processing proposal rejection', {
                requestId,
                userId,
                proposalId,
                swapTargetId,
                hasReason: !!reason,
                usingSwapTargetId: !!swapTargetId
            });

            const rejectionRequest: ProposalAcceptanceRequest = {
                proposalId: swapTargetId || proposalId, // Prefer swapTargetId if provided (it's the correct swap_targets.id)
                userId,
                action: 'reject',
                rejectionReason: reason,
                swapTargetId
            };

            const result = await this.proposalAcceptanceService.rejectProposal(rejectionRequest);

            logger.info('Proposal rejected successfully', {
                requestId,
                userId,
                proposalId,
                hasReason: !!reason,
                blockchainTxId: result.blockchainTransaction.transactionId
            });

            res.status(200).json({
                success: true,
                data: {
                    proposal: result.proposal,
                    blockchain: result.blockchainTransaction
                },
                requestId,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            handleSwapError(error, res, {
                operation: 'rejectProposal',
                userId: req.user?.id,
                requestId,
                requestData: {
                    proposalId: req.params.proposalId,
                    hasReason: !!req.body?.reason
                }
            });
        }
    };

    /**
     * Get proposal status
     * GET /api/proposals/:proposalId/status
     */
    getProposalStatus = async (req: Request, res: Response): Promise<void> => {
        const requestId = generateRequestId('get-proposal-status');

        try {
            const { proposalId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                handleSwapError(
                    new Error('User authentication required'),
                    res,
                    {
                        operation: 'getProposalStatus',
                        requestId,
                        requestData: { proposalId }
                    }
                );
                return;
            }

            if (!proposalId) {
                const validationError = new Error('Proposal ID is required');
                (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
                handleSwapError(validationError, res, {
                    operation: 'getProposalStatus',
                    userId,
                    requestId,
                    requestData: { proposalId }
                });
                return;
            }

            // Validate UUID format for proposal ID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(proposalId)) {
                const validationError = new Error('Invalid proposal ID format');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'getProposalStatus',
                    userId,
                    requestId,
                    requestData: { proposalId }
                });
                return;
            }

            logger.info('Getting proposal status', {
                requestId,
                userId,
                proposalId
            });

            // Get the proposal/swap from repository
            const swap = await this.swapRepository.findById(proposalId);

            if (!swap) {
                const notFoundError = new Error('Proposal not found');
                (notFoundError as any).code = SWAP_ERROR_CODES.BOOKING_NOT_FOUND;
                handleSwapError(notFoundError, res, {
                    operation: 'getProposalStatus',
                    userId,
                    requestId,
                    requestData: { proposalId }
                });
                return;
            }

            // Check if user is authorized to view this proposal status
            // For now, we'll allow access if the user is involved in the swap
            // In a real implementation, we'd need to derive proposer/target relationships
            // from booking ownership or proposal metadata
            const hasAccess = true; // Simplified for now - would check actual relationships

            if (!hasAccess) {
                const forbiddenError = new Error('Access denied to proposal status');
                (forbiddenError as any).code = SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED;
                handleSwapError(forbiddenError, res, {
                    operation: 'getProposalStatus',
                    userId,
                    requestId,
                    requestData: { proposalId }
                });
                return;
            }

            logger.info('Proposal status retrieved successfully', {
                requestId,
                userId,
                proposalId,
                status: swap.status
            });

            res.status(200).json({
                success: true,
                data: {
                    proposalId: swap.id,
                    status: swap.status,
                    timeline: swap.timeline,
                    blockchain: swap.blockchain,
                    terms: swap.terms,
                    createdAt: swap.createdAt,
                    updatedAt: swap.updatedAt
                },
                requestId,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            handleSwapError(error, res, {
                operation: 'getProposalStatus',
                userId: req.user?.id,
                requestId,
                requestData: { proposalId: req.params.proposalId }
            });
        }
    };

    /**
     * Get proposals received by the authenticated user (convenience route)
     * GET /api/proposals/received
     */
    getReceivedProposals = async (req: Request, res: Response): Promise<void> => {
        const requestId = generateRequestId('get-received-proposals');

        try {
            const userId = req.user?.id;
            const { status, limit = '100', offset = '0' } = req.query;

            if (!userId) {
                handleSwapError(
                    new Error('User authentication required'),
                    res,
                    {
                        operation: 'getReceivedProposals',
                        requestId
                    }
                );
                return;
            }

            const parsedLimit = Math.min(parseInt(limit as string) || 100, 100);
            const parsedOffset = parseInt(offset as string) || 0;

            logger.info('Getting received proposals', {
                requestId,
                userId,
                status,
                limit: parsedLimit,
                offset: parsedOffset
            });

            // Query both swap_proposals AND swap_targets tables
            // UNION them together to get all proposals received by the user
            const query = `
                -- Cash offers and formal proposals from swap_proposals table
                SELECT 
                    sp.id,
                    sp.source_swap_id,
                    sp.target_swap_id,
                    sp.proposer_id,
                    sp.target_user_id as target_owner_id,
                    sp.proposal_type,
                    sp.status,
                    sp.cash_offer_amount,
                    sp.cash_offer_currency,
                    sp.message,
                    sp.conditions,
                    sp.expires_at,
                    sp.created_at,
                    sp.updated_at,
                    sp.responded_at,
                    u.name as proposer_name,
                    u.email as proposer_email,
                    'swap_proposals' as source_table
                FROM swap_proposals sp
                LEFT JOIN users u ON sp.proposer_id = u.id
                WHERE sp.target_user_id = $1
                ${status ? 'AND sp.status = $4' : ''}
                
                UNION ALL
                
                -- Booking-only proposals from swap_targets table
                SELECT 
                    st.id as id,  -- Use swap_targets.id as the proposal ID
                    st.source_swap_id,
                    st.target_swap_id,
                    sb.user_id as proposer_id,
                    tb.user_id as target_owner_id,
                    'booking' as proposal_type,
                    st.status,
                    NULL as cash_offer_amount,
                    NULL as cash_offer_currency,
                    NULL as message,
                    ARRAY[]::text[] as conditions,
                    NULL as expires_at,
                    st.created_at,
                    st.updated_at,
                    NULL as responded_at,
                    u.name as proposer_name,
                    u.email as proposer_email,
                    'swap_targets' as source_table
                FROM swap_targets st
                INNER JOIN swaps ss ON st.source_swap_id = ss.id
                LEFT JOIN bookings sb ON ss.source_booking_id = sb.id
                LEFT JOIN users u ON sb.user_id = u.id
                LEFT JOIN swaps ts ON st.target_swap_id = ts.id
                LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
                WHERE tb.user_id = $1
                ${status ? 'AND st.status = $4' : ''}
                
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const params = status
                ? [userId, parsedLimit, parsedOffset, status]
                : [userId, parsedLimit, parsedOffset];

            const result = await this.swapRepository['pool'].query(query, params);

            const proposals = result.rows.map(row => ({
                id: row.id, // This will be swap_proposals.id OR swap_targets.id
                sourceSwapId: row.source_swap_id,
                targetSwapId: row.target_swap_id,
                proposerId: row.proposer_id,
                targetOwnerId: row.target_owner_id,
                proposalType: row.proposal_type,
                status: row.status,
                cashOffer: row.cash_offer_amount ? {
                    amount: parseFloat(row.cash_offer_amount),
                    currency: row.cash_offer_currency
                } : undefined,
                message: row.message,
                conditions: row.conditions || [],
                expiresAt: row.expires_at,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                respondedAt: row.responded_at,
                proposerName: row.proposer_name,
                proposerEmail: row.proposer_email,
                sourceTable: row.source_table // Track which table this came from (for debugging)
            }));

            logger.info('Retrieved received proposals', {
                requestId,
                userId,
                proposalCount: proposals.length,
                hasMore: proposals.length === parsedLimit
            });

            res.status(200).json({
                success: true,
                data: {
                    proposals,
                    pagination: {
                        limit: parsedLimit,
                        offset: parsedOffset,
                        total: proposals.length
                    }
                },
                requestId,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            handleSwapError(error, res, {
                operation: 'getReceivedProposals',
                userId: req.user?.id,
                requestId
            });
        }
    };

    /**
     * Get all proposals for a specific user
     * GET /api/proposals/user/:userId
     * Requirements: 3.3, 4.1, 4.2, 4.3
     */
    getUserProposals = async (req: Request, res: Response): Promise<void> => {
        const requestId = generateRequestId('get-user-proposals');

        try {
            const { userId } = req.params;
            const currentUserId = req.user?.id;

            if (!currentUserId) {
                handleSwapError(
                    new Error('User authentication required'),
                    res,
                    {
                        operation: 'getUserProposals',
                        requestId,
                        requestData: { userId }
                    }
                );
                return;
            }

            if (!userId) {
                const validationError = new Error('User ID is required');
                (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
                handleSwapError(validationError, res, {
                    operation: 'getUserProposals',
                    userId: currentUserId,
                    requestId,
                    requestData: { userId }
                });
                return;
            }

            // Validate UUID format for user ID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(userId)) {
                const validationError = new Error('Invalid user ID format');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'getUserProposals',
                    userId: currentUserId,
                    requestId,
                    requestData: { userId }
                });
                return;
            }

            // Check authorization - users can only access their own proposals
            if (currentUserId !== userId) {
                const forbiddenError = new Error('Access denied to user proposals');
                (forbiddenError as any).code = SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED;
                handleSwapError(forbiddenError, res, {
                    operation: 'getUserProposals',
                    userId: currentUserId,
                    requestId,
                    requestData: { userId }
                });
                return;
            }

            logger.info('Getting user proposals', {
                requestId,
                currentUserId,
                userId
            });

            // Get user's swaps (which represent their proposals)
            const userSwaps = await this.swapRepository.findByUserId(userId);

            // Transform swaps to proposal format
            const proposals = userSwaps.map(swap => ({
                id: swap.id,
                bookingId: swap.sourceBookingId, // The booking they're proposing for
                userId: userId,
                status: swap.status,
                createdAt: swap.createdAt,
                updatedAt: swap.updatedAt,
                terms: swap.terms
            }));

            logger.info('User proposals retrieved successfully', {
                requestId,
                currentUserId,
                userId,
                count: proposals.length
            });

            res.status(200).json({
                success: true,
                data: proposals,
                requestId,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            handleSwapError(error, res, {
                operation: 'getUserProposals',
                userId: req.user?.id,
                requestId,
                requestData: { userId: req.params.userId }
            });
        }
    };

    /**
     * Get proposal status for a specific booking and user
     * GET /api/proposals/status?bookingId=...&userId=...
     * Requirements: 3.3, 4.1, 4.2, 4.3
     */
    getProposalStatusForBooking = async (req: Request, res: Response): Promise<void> => {
        const requestId = generateRequestId('get-proposal-status-for-booking');

        try {
            const { bookingId, userId } = req.query;
            const currentUserId = req.user?.id;

            if (!currentUserId) {
                handleSwapError(
                    new Error('User authentication required'),
                    res,
                    {
                        operation: 'getProposalStatusForBooking',
                        requestId,
                        requestData: { bookingId, userId }
                    }
                );
                return;
            }

            if (!bookingId || !userId) {
                const validationError = new Error('Both bookingId and userId are required');
                (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
                handleSwapError(validationError, res, {
                    operation: 'getProposalStatusForBooking',
                    userId: currentUserId,
                    requestId,
                    requestData: { bookingId, userId }
                });
                return;
            }

            // Validate UUID formats
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(bookingId as string) || !uuidRegex.test(userId as string)) {
                const validationError = new Error('Invalid bookingId or userId format');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'getProposalStatusForBooking',
                    userId: currentUserId,
                    requestId,
                    requestData: { bookingId, userId }
                });
                return;
            }

            // Check authorization - users can only check their own proposal status
            if (currentUserId !== userId) {
                const forbiddenError = new Error('Access denied to proposal status');
                (forbiddenError as any).code = SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED;
                handleSwapError(forbiddenError, res, {
                    operation: 'getProposalStatusForBooking',
                    userId: currentUserId,
                    requestId,
                    requestData: { bookingId, userId }
                });
                return;
            }

            logger.info('Getting proposal status for booking', {
                requestId,
                currentUserId,
                bookingId,
                userId
            });

            // Find existing proposal/swap for this booking and user
            const existingSwap = await this.swapRepository.findBySourceBookingAndUserId(
                bookingId as string,
                userId as string
            );

            let proposalStatus;
            if (existingSwap) {
                proposalStatus = {
                    bookingId: bookingId as string,
                    userId: userId as string,
                    status: existingSwap.status,
                    proposalId: existingSwap.id,
                    lastUpdated: existingSwap.updatedAt
                };
            } else {
                // No proposal exists - return 404 to indicate no proposal found
                const notFoundError = new Error('No proposal found for this booking and user');
                (notFoundError as any).code = SWAP_ERROR_CODES.BOOKING_NOT_FOUND;
                handleSwapError(notFoundError, res, {
                    operation: 'getProposalStatusForBooking',
                    userId: currentUserId,
                    requestId,
                    requestData: { bookingId, userId }
                });
                return;
            }

            logger.info('Proposal status retrieved successfully', {
                requestId,
                currentUserId,
                bookingId,
                userId,
                status: proposalStatus.status
            });

            res.status(200).json({
                success: true,
                data: proposalStatus,
                requestId,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            handleSwapError(error, res, {
                operation: 'getProposalStatusForBooking',
                userId: req.user?.id,
                requestId,
                requestData: { bookingId: req.query.bookingId, userId: req.query.userId }
            });
        }
    };

    /**
     * Create a new proposal
     * POST /api/proposals
     * Requirements: 3.3, 4.1
     */
    createProposal = async (req: Request, res: Response): Promise<void> => {
        const requestId = generateRequestId('create-proposal');

        try {
            const { bookingId, terms } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                handleSwapError(
                    new Error('User authentication required'),
                    res,
                    {
                        operation: 'createProposal',
                        requestId,
                        requestData: { bookingId }
                    }
                );
                return;
            }

            if (!bookingId) {
                const validationError = new Error('Booking ID is required');
                (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
                handleSwapError(validationError, res, {
                    operation: 'createProposal',
                    userId,
                    requestId,
                    requestData: { bookingId }
                });
                return;
            }

            // Validate UUID format for booking ID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(bookingId)) {
                const validationError = new Error('Invalid booking ID format');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'createProposal',
                    userId,
                    requestId,
                    requestData: { bookingId }
                });
                return;
            }

            logger.info('Creating proposal', {
                requestId,
                userId,
                bookingId,
                hasTerms: !!terms
            });

            // Check if user already has a proposal for this booking
            const existingSwap = await this.swapRepository.findBySourceBookingAndUserId(bookingId, userId);
            if (existingSwap) {
                const conflictError = new Error('User already has a proposal for this booking');
                (conflictError as any).code = SWAP_ERROR_CODES.SWAP_VALIDATION_FAILED;
                handleSwapError(conflictError, res, {
                    operation: 'createProposal',
                    userId,
                    requestId,
                    requestData: { bookingId, existingProposalId: existingSwap.id }
                });
                return;
            }

            // Create a new swap (which represents the proposal)
            const swapData = {
                sourceBookingId: bookingId,
                targetBookingId: '', // Will be set when matched
                proposerId: userId,
                ownerId: '', // Will be derived from target booking
                status: 'pending' as const,
                terms: terms || {
                    additionalPayment: 0,
                    conditions: [],
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
                },
                blockchain: {
                    proposalTransactionId: ''
                },
                timeline: {
                    proposedAt: new Date()
                }
            };

            const createdSwap = await this.swapRepository.create(swapData);

            const proposal = {
                id: createdSwap.id,
                bookingId: bookingId,
                userId: userId,
                status: createdSwap.status,
                createdAt: createdSwap.createdAt,
                updatedAt: createdSwap.updatedAt,
                terms: createdSwap.terms
            };

            logger.info('Proposal created successfully', {
                requestId,
                userId,
                bookingId,
                proposalId: proposal.id
            });

            res.status(201).json({
                success: true,
                data: proposal,
                requestId,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            handleSwapError(error, res, {
                operation: 'createProposal',
                userId: req.user?.id,
                requestId,
                requestData: { bookingId: req.body?.bookingId }
            });
        }
    };

    /**
     * Get user's proposal responses
     * GET /api/users/:userId/proposal-responses
     */
    getUserProposalResponses = async (req: Request, res: Response): Promise<void> => {
        const requestId = generateRequestId('get-user-proposal-responses');

        try {
            const { userId: targetUserId } = req.params;
            const {
                status,
                limit = '50',
                offset = '0',
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;
            const currentUserId = req.user?.id;

            if (!currentUserId) {
                handleSwapError(
                    new Error('User authentication required'),
                    res,
                    {
                        operation: 'getUserProposalResponses',
                        requestId,
                        requestData: { targetUserId }
                    }
                );
                return;
            }

            if (!targetUserId) {
                const validationError = new Error('User ID is required');
                (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
                handleSwapError(validationError, res, {
                    operation: 'getUserProposalResponses',
                    userId: currentUserId,
                    requestId,
                    requestData: { targetUserId }
                });
                return;
            }

            // Validate UUID format for user ID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(targetUserId)) {
                const validationError = new Error('Invalid user ID format');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'getUserProposalResponses',
                    userId: currentUserId,
                    requestId,
                    requestData: { targetUserId }
                });
                return;
            }

            // Check authorization - users can only access their own proposal responses
            // For now, simplified authorization check
            if (currentUserId !== targetUserId) {
                const forbiddenError = new Error('Access denied to user proposal responses');
                (forbiddenError as any).code = SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED;
                handleSwapError(forbiddenError, res, {
                    operation: 'getUserProposalResponses',
                    userId: currentUserId,
                    requestId,
                    requestData: { targetUserId }
                });
                return;
            }

            // Validate query parameters
            const parsedLimit = Math.min(parseInt(limit as string) || 50, 100);
            const parsedOffset = Math.max(parseInt(offset as string) || 0, 0);

            const validSortFields = ['createdAt', 'updatedAt', 'status'];
            const validSortOrders = ['asc', 'desc'];

            if (!validSortFields.includes(sortBy as string)) {
                const validationError = new Error(`Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}`);
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'getUserProposalResponses',
                    userId: currentUserId,
                    requestId,
                    requestData: { targetUserId, sortBy }
                });
                return;
            }

            if (!validSortOrders.includes(sortOrder as string)) {
                const validationError = new Error(`Invalid sortOrder. Must be one of: ${validSortOrders.join(', ')}`);
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'getUserProposalResponses',
                    userId: currentUserId,
                    requestId,
                    requestData: { targetUserId, sortOrder }
                });
                return;
            }

            if (status && !['pending', 'accepted', 'rejected', 'expired'].includes(status as string)) {
                const validationError = new Error('Invalid status filter. Must be one of: pending, accepted, rejected, expired');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'getUserProposalResponses',
                    userId: currentUserId,
                    requestId,
                    requestData: { targetUserId, status }
                });
                return;
            }

            logger.info('Getting user proposal responses', {
                requestId,
                currentUserId,
                targetUserId,
                status,
                limit: parsedLimit,
                offset: parsedOffset
            });

            // Get proposal responses from repository
            // For now, we'll use the SwapRepository to get swaps where the user was involved
            const swaps = await this.swapRepository.findByUserId(targetUserId, parsedLimit, parsedOffset);

            // Filter to only include swaps where the user responded (accepted/rejected)
            const proposalResponses = swaps
                .filter(swap => swap.timeline?.respondedAt)
                .map(swap => ({
                    id: swap.id,
                    proposalId: swap.id,
                    responderId: targetUserId,
                    action: swap.status === 'accepted' ? 'accept' : 'reject',
                    reason: undefined, // Would need to be stored separately in proposal responses table
                    swapId: swap.id,
                    blockchainTransactionId: swap.blockchain?.executionTransactionId,
                    createdAt: swap.timeline?.respondedAt || swap.updatedAt,
                    proposal: {
                        id: swap.id,
                        sourceSwapId: swap.id,
                        proposerId: targetUserId, // Simplified - would derive from booking relationships
                        targetUserId: targetUserId, // Simplified - would derive from proposal metadata
                        proposalType: swap.terms?.additionalPayment ? 'cash' : 'booking',
                        status: swap.status,
                        terms: swap.terms,
                        createdAt: swap.createdAt,
                        updatedAt: swap.updatedAt
                    }
                }));

            logger.info('User proposal responses retrieved successfully', {
                requestId,
                currentUserId,
                targetUserId,
                count: proposalResponses.length,
                totalSwaps: swaps.length
            });

            res.status(200).json({
                success: true,
                data: {
                    userId: targetUserId,
                    proposalResponses,
                    count: proposalResponses.length,
                    pagination: {
                        limit: parsedLimit,
                        offset: parsedOffset,
                        total: proposalResponses.length,
                        hasMore: proposalResponses.length === parsedLimit
                    }
                },
                requestId,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            handleSwapError(error, res, {
                operation: 'getUserProposalResponses',
                userId: req.user?.id,
                requestId,
                requestData: {
                    targetUserId: req.params.userId,
                    query: req.query
                }
            });
        }
    };
}