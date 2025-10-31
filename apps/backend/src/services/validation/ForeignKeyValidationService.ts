import { Pool } from 'pg';
import {
    ValidationResult,
    ValidationError,
    ValidationWarning,
    PaymentTransactionRequest,
    SwapScenario,
    VALIDATION_ERROR_CODES,
    SwapValidationResult,
    EnhancedSwap,
    OfferMode
} from '../swap/SwapOfferWorkflowService';
import { logger } from '../../utils/logger';

/**
 * Foreign Key Validation Service
 * 
 * This service provides comprehensive validation of foreign key references
 * to prevent database constraint violations during payment transaction creation.
 * It handles both auction and direct swap scenarios with appropriate validation logic.
 * 
 * Features optimized single-query validation for improved performance.
 */
export class ForeignKeyValidationService {
    private useOptimizedValidation: boolean = true;

    constructor(private pool: Pool, options?: { useOptimizedValidation?: boolean }) {
        this.useOptimizedValidation = options?.useOptimizedValidation ?? true;
    }

    /**
     * Validates that a swap exists and accepts the type of offer being submitted
     * Skips auction-specific validation unless user explicitly selects auction mode
     * 
     * Requirements: 1.9, 2.6, 2.10
     */
    async validateSwapForOffer(swapId: string, userSelectedMode?: OfferMode): Promise<SwapValidationResult> {
        try {
            logger.info('Starting swap validation for offer', {
                swapId,
                userSelectedMode
            });

            // Query swap with all necessary details
            const query = `
                SELECT 
                    s.id,
                    s.owner_id,
                    s.status,
                    s.acceptance_strategy,
                    s.payment_types,
                    s.expires_at,
                    s.created_at,
                    s.updated_at,
                    -- Check if there's an active auction
                    sa.id as auction_id,
                    sa.status as auction_status,
                    sa.settings->>'endDate' as auction_end_date
                FROM swaps s
                LEFT JOIN swap_auctions sa ON sa.swap_id = s.id AND sa.status = 'active'
                WHERE s.id = $1 AND s.status NOT IN ('deleted', 'completed', 'cancelled')
            `;

            const result = await this.pool.query(query, [swapId]);

            if (result.rows.length === 0) {
                return {
                    isValid: false,
                    swap: null as any, // Will not be used when invalid
                    scenario: 'first_match',
                    acceptsCashOffers: false,
                    errors: ['Swap not found, deleted, completed, or cancelled'],
                    warnings: []
                };
            }

            const row = result.rows[0];

            // Map to EnhancedSwap
            const swap: EnhancedSwap = {
                id: row.id,
                ownerId: row.owner_id,
                acceptanceStrategy: row.acceptance_strategy || { type: 'first_match' },
                paymentTypes: row.payment_types || { bookingExchange: true, cashPayment: false },
                status: row.status,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };

            const errors: string[] = [];
            const warnings: string[] = [];

            // Check if swap has expired
            if (row.expires_at && new Date(row.expires_at) < new Date()) {
                errors.push('Swap has expired and no longer accepts offers');
            }

            // Determine scenario based on user selection and swap configuration
            let scenario: SwapScenario = 'first_match';

            if (userSelectedMode === 'auction') {
                // User explicitly selected auction mode
                if (swap.acceptanceStrategy.type !== 'auction') {
                    errors.push('User selected auction mode but swap does not support auctions');
                } else if (!row.auction_id) {
                    errors.push('User selected auction mode but no active auction exists for this swap');
                } else if (row.auction_end_date && new Date(row.auction_end_date) < new Date()) {
                    errors.push('User selected auction mode but the auction has already ended');
                } else {
                    scenario = 'auction';
                }
            } else if (userSelectedMode === 'direct') {
                // User explicitly selected direct mode
                scenario = 'first_match';
                // Direct mode is always valid regardless of swap configuration
            } else {
                // No user selection provided - use swap's default strategy
                scenario = swap.acceptanceStrategy.type === 'auction' ? 'auction' : 'first_match';

                // If swap is auction type but no user selection, warn about mode requirement
                if (scenario === 'auction') {
                    warnings.push('Swap supports auctions - user should explicitly select offer mode');
                }
            }

            // Validate payment type acceptance
            const acceptsCashOffers = swap.paymentTypes.cashPayment === true;
            const acceptsBookingOffers = swap.paymentTypes.bookingExchange === true;

            if (!acceptsCashOffers && !acceptsBookingOffers) {
                errors.push('Swap does not accept any type of offers');
            }

            // Additional validation for auction mode
            if (scenario === 'auction' && userSelectedMode === 'auction') {
                // Only perform auction-specific validation when user explicitly selects auction mode
                if (row.auction_status !== 'active') {
                    errors.push('Auction is not active - cannot submit auction proposals');
                }

                if (row.auction_end_date) {
                    const timeToEnd = new Date(row.auction_end_date).getTime() - Date.now();
                    if (timeToEnd < 0) {
                        errors.push('Auction has already ended');
                    } else if (timeToEnd < 60000) { // Less than 1 minute
                        warnings.push('Auction ends very soon - offer may not be processed in time');
                    }
                }
            }

            // Validate minimum cash amount if cash offers are accepted
            if (acceptsCashOffers && swap.paymentTypes.minimumCashAmount) {
                // This is informational - actual amount validation happens during offer submission
                if (swap.paymentTypes.minimumCashAmount > 0) {
                    warnings.push(`Minimum cash amount required: ${swap.paymentTypes.minimumCashAmount}`);
                }
            }

            const isValid = errors.length === 0;

            logger.info('Swap validation for offer completed', {
                swapId,
                userSelectedMode,
                scenario,
                isValid,
                acceptsCashOffers,
                errorCount: errors.length,
                warningCount: warnings.length
            });

            return {
                isValid,
                swap,
                scenario,
                acceptsCashOffers,
                errors,
                warnings
            };

        } catch (error) {
            logger.error('Swap validation for offer failed with exception', {
                error: error instanceof Error ? error.message : String(error),
                swapId,
                userSelectedMode
            });

            return {
                isValid: false,
                swap: null as any,
                scenario: 'first_match',
                acceptsCashOffers: false,
                errors: ['System error during swap validation - please try again'],
                warnings: []
            };
        }
    }

    /**
     * Validates all foreign key references for a payment transaction request
     * Implements scenario-specific validation (auction vs first-match)
     * 
     * Uses optimized single-query validation by default for better performance.
     * Falls back to multi-query validation if needed.
     * 
     * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
     */
    async validateForeignKeyReferences(request: PaymentTransactionRequest): Promise<ValidationResult> {
        // Use optimized single-query validation by default
        if (this.useOptimizedValidation) {
            try {
                return await this.validateAllReferencesInSingleQuery(request);
            } catch (error) {
                logger.warn('Optimized validation failed, falling back to standard validation', {
                    error: error instanceof Error ? error.message : String(error),
                    swapId: request.swapId
                });
                // Fall back to standard validation
            }
        }

        // Standard multi-query validation (fallback or when optimization is disabled)
        return await this.validateForeignKeyReferencesStandard(request);
    }

    /**
     * Standard multi-query foreign key validation method
     * Kept for fallback and compatibility purposes
     * 
     * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
     */
    private async validateForeignKeyReferencesStandard(request: PaymentTransactionRequest): Promise<ValidationResult> {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const validationType = 'standard_foreign_key_validation';

        try {
            logger.info('Starting foreign key validation', {
                swapId: request.swapId,
                proposalId: request.proposalId,
                payerId: request.payerId,
                recipientId: request.recipientId
            });

            // Step 1: Validate swap exists and determine scenario
            const swapValidation = await this.validateSwapReference(request.swapId);
            if (!swapValidation.isValid) {
                errors.push(...swapValidation.errors);
                return {
                    isValid: false,
                    errors,
                    warnings,
                    metadata: {
                        validatedAt: new Date(),
                        validationType
                    }
                };
            }

            const scenario = swapValidation.scenario!;

            // Step 2: Validate proposal_id based on scenario
            const proposalValidation = await this.validateProposalReference(
                request.proposalId,
                scenario
            );
            if (!proposalValidation.isValid) {
                errors.push(...proposalValidation.errors);
            }

            // Step 3: Validate user references
            const userValidation = await this.validateUserReferences(
                request.payerId,
                request.recipientId
            );
            if (!userValidation.isValid) {
                errors.push(...userValidation.errors);
            }

            // Step 4: Cross-validate proposal belongs to swap (if proposal exists)
            if (request.proposalId && scenario === 'auction') {
                const crossValidation = await this.validateProposalSwapRelationship(
                    request.proposalId,
                    request.swapId
                );
                if (!crossValidation.isValid) {
                    errors.push(...crossValidation.errors);
                }
            }

            const isValid = errors.length === 0;

            logger.info('Foreign key validation completed', {
                swapId: request.swapId,
                proposalId: request.proposalId,
                scenario,
                isValid,
                errorCount: errors.length
            });

            return {
                isValid,
                errors,
                warnings,
                metadata: {
                    validatedAt: new Date(),
                    validationType,
                    scenario
                }
            };

        } catch (error) {
            logger.error('Foreign key validation failed with exception', {
                error: error instanceof Error ? error.message : String(error),
                swapId: request.swapId,
                proposalId: request.proposalId
            });

            return {
                isValid: false,
                errors: [{
                    code: VALIDATION_ERROR_CODES.FOREIGN_KEY_VIOLATION,
                    message: 'Foreign key validation failed due to system error',
                    suggestedFix: 'Please try again or contact support if the issue persists'
                }],
                warnings,
                metadata: {
                    validatedAt: new Date(),
                    validationType
                }
            };
        }
    }

    /**
     * Validates that a swap exists and determines its scenario type
     * 
     * Requirements: 2.4, 2.5
     */
    private async validateSwapReference(swapId: string): Promise<ValidationResult & { scenario?: SwapScenario }> {
        const query = `
            SELECT 
                id,
                acceptance_strategy,
                status
            FROM swaps 
            WHERE id = $1 AND status != 'deleted'
        `;

        try {
            const result = await this.pool.query(query, [swapId]);

            if (result.rows.length === 0) {
                return {
                    isValid: false,
                    errors: [{
                        code: VALIDATION_ERROR_CODES.SWAP_NOT_FOUND,
                        message: 'Referenced swap does not exist or has been deleted',
                        field: 'swapId',
                        constraint: 'payment_transactions_swap_id_fkey',
                        suggestedFix: 'Verify the swap ID is correct and the swap still exists'
                    }],
                    warnings: [],
                    metadata: {
                        validatedAt: new Date(),
                        validationType: 'swap_reference_validation'
                    }
                };
            }

            const swap = result.rows[0];
            const acceptanceStrategy = swap.acceptance_strategy;
            const scenario: SwapScenario = acceptanceStrategy?.type === 'auction' ? 'auction' : 'first_match';

            return {
                isValid: true,
                errors: [],
                warnings: [],
                metadata: {
                    validatedAt: new Date(),
                    validationType: 'swap_reference_validation',
                    scenario
                },
                scenario
            };

        } catch (error) {
            logger.error('Swap reference validation failed', {
                swapId,
                error: error instanceof Error ? error.message : String(error)
            });

            return {
                isValid: false,
                errors: [{
                    code: VALIDATION_ERROR_CODES.FOREIGN_KEY_VIOLATION,
                    message: 'Failed to validate swap reference',
                    field: 'swapId',
                    suggestedFix: 'Please try again'
                }],
                warnings: [],
                metadata: {
                    validatedAt: new Date(),
                    validationType: 'swap_reference_validation'
                }
            };
        }
    }

    /**
     * Validates proposal_id reference based on scenario
     * For auction scenarios: proposal_id must exist in auction_proposals
     * For direct scenarios: proposal_id should be null
     * 
     * Requirements: 2.1, 2.2, 2.3
     */
    private async validateProposalReference(
        proposalId: string | null | undefined,
        scenario: SwapScenario
    ): Promise<ValidationResult> {

        // For direct/first-match scenarios, proposal_id should be null
        if (scenario === 'first_match') {
            if (proposalId !== null && proposalId !== undefined) {
                return {
                    isValid: false,
                    errors: [{
                        code: VALIDATION_ERROR_CODES.SCENARIO_MISMATCH,
                        message: 'Direct swap transactions should not reference auction proposals',
                        field: 'proposalId',
                        suggestedFix: 'Set proposalId to null for direct swap transactions'
                    }],
                    warnings: [],
                    metadata: {
                        validatedAt: new Date(),
                        validationType: 'proposal_reference_validation'
                    }
                };
            }

            // Valid case: null proposal_id for direct swap
            return {
                isValid: true,
                errors: [],
                warnings: [],
                metadata: {
                    validatedAt: new Date(),
                    validationType: 'proposal_reference_validation'
                }
            };
        }

        // For auction scenarios, proposal_id must exist
        if (scenario === 'auction') {
            if (!proposalId) {
                return {
                    isValid: false,
                    errors: [{
                        code: VALIDATION_ERROR_CODES.INVALID_PROPOSAL_REFERENCE,
                        message: 'Auction transactions must reference a valid auction proposal',
                        field: 'proposalId',
                        constraint: 'payment_transactions_proposal_id_fkey',
                        suggestedFix: 'Ensure auction proposal is created before payment transaction'
                    }],
                    warnings: [],
                    metadata: {
                        validatedAt: new Date(),
                        validationType: 'proposal_reference_validation'
                    }
                };
            }

            // Validate proposal exists in database
            const query = `
                SELECT id, status 
                FROM auction_proposals 
                WHERE id = $1 AND status != 'deleted'
            `;

            try {
                const result = await this.pool.query(query, [proposalId]);

                if (result.rows.length === 0) {
                    return {
                        isValid: false,
                        errors: [{
                            code: VALIDATION_ERROR_CODES.PROPOSAL_NOT_FOUND,
                            message: 'Referenced auction proposal does not exist or has been deleted',
                            field: 'proposalId',
                            constraint: 'payment_transactions_proposal_id_fkey',
                            suggestedFix: 'Verify the proposal ID is correct and the proposal still exists'
                        }],
                        warnings: [],
                        metadata: {
                            validatedAt: new Date(),
                            validationType: 'proposal_reference_validation'
                        }
                    };
                }

                return {
                    isValid: true,
                    errors: [],
                    warnings: [],
                    metadata: {
                        validatedAt: new Date(),
                        validationType: 'proposal_reference_validation'
                    }
                };

            } catch (error) {
                logger.error('Proposal reference validation failed', {
                    proposalId,
                    error: error instanceof Error ? error.message : String(error)
                });

                return {
                    isValid: false,
                    errors: [{
                        code: VALIDATION_ERROR_CODES.FOREIGN_KEY_VIOLATION,
                        message: 'Failed to validate proposal reference',
                        field: 'proposalId',
                        suggestedFix: 'Please try again'
                    }],
                    warnings: [],
                    metadata: {
                        validatedAt: new Date(),
                        validationType: 'proposal_reference_validation'
                    }
                };
            }
        }

        // Should not reach here, but handle unknown scenario
        return {
            isValid: false,
            errors: [{
                code: VALIDATION_ERROR_CODES.SCENARIO_MISMATCH,
                message: `Unknown scenario type: ${scenario}`,
                field: 'scenario',
                suggestedFix: 'Contact support - invalid scenario detected'
            }],
            warnings: [],
            metadata: {
                validatedAt: new Date(),
                validationType: 'proposal_reference_validation'
            }
        };
    }

    /**
     * Validates that both payer and recipient users exist
     * 
     * Requirements: 2.5
     */
    private async validateUserReferences(payerId: string, recipientId: string): Promise<ValidationResult> {
        const query = `
            SELECT 
                u1.id as payer_exists,
                u2.id as recipient_exists
            FROM (SELECT $1 as payer_id, $2 as recipient_id) params
            LEFT JOIN users u1 ON u1.id = params.payer_id
            LEFT JOIN users u2 ON u2.id = params.recipient_id
        `;

        try {
            const result = await this.pool.query(query, [payerId, recipientId]);
            const row = result.rows[0];
            const errors: ValidationError[] = [];

            if (!row.payer_exists) {
                errors.push({
                    code: VALIDATION_ERROR_CODES.USER_NOT_FOUND,
                    message: 'Payer user does not exist',
                    field: 'payerId',
                    constraint: 'payment_transactions_payer_id_fkey',
                    suggestedFix: 'Verify the payer user ID is correct'
                });
            }

            if (!row.recipient_exists) {
                errors.push({
                    code: VALIDATION_ERROR_CODES.USER_NOT_FOUND,
                    message: 'Recipient user does not exist',
                    field: 'recipientId',
                    constraint: 'payment_transactions_recipient_id_fkey',
                    suggestedFix: 'Verify the recipient user ID is correct'
                });
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings: [],
                metadata: {
                    validatedAt: new Date(),
                    validationType: 'user_reference_validation'
                }
            };

        } catch (error) {
            logger.error('User reference validation failed', {
                payerId,
                recipientId,
                error: error instanceof Error ? error.message : String(error)
            });

            return {
                isValid: false,
                errors: [{
                    code: VALIDATION_ERROR_CODES.FOREIGN_KEY_VIOLATION,
                    message: 'Failed to validate user references',
                    field: 'userIds',
                    suggestedFix: 'Please try again'
                }],
                warnings: [],
                metadata: {
                    validatedAt: new Date(),
                    validationType: 'user_reference_validation'
                }
            };
        }
    }

    /**
     * Validates that a proposal belongs to the specified swap
     * This prevents cross-swap proposal references
     */
    private async validateProposalSwapRelationship(
        proposalId: string,
        swapId: string
    ): Promise<ValidationResult> {
        const query = `
            SELECT ap.id, sa.swap_id
            FROM auction_proposals ap
            JOIN swap_auctions sa ON ap.auction_id = sa.id
            WHERE ap.id = $1 AND sa.swap_id = $2
        `;

        try {
            const result = await this.pool.query(query, [proposalId, swapId]);

            if (result.rows.length === 0) {
                return {
                    isValid: false,
                    errors: [{
                        code: VALIDATION_ERROR_CODES.INVALID_PROPOSAL_REFERENCE,
                        message: 'Proposal does not belong to the specified swap',
                        field: 'proposalId',
                        suggestedFix: 'Ensure the proposal ID matches the swap being processed'
                    }],
                    warnings: [],
                    metadata: {
                        validatedAt: new Date(),
                        validationType: 'proposal_swap_relationship_validation'
                    }
                };
            }

            return {
                isValid: true,
                errors: [],
                warnings: [],
                metadata: {
                    validatedAt: new Date(),
                    validationType: 'proposal_swap_relationship_validation'
                }
            };

        } catch (error) {
            logger.error('Proposal-swap relationship validation failed', {
                proposalId,
                swapId,
                error: error instanceof Error ? error.message : String(error)
            });

            return {
                isValid: false,
                errors: [{
                    code: VALIDATION_ERROR_CODES.FOREIGN_KEY_VIOLATION,
                    message: 'Failed to validate proposal-swap relationship',
                    suggestedFix: 'Please try again'
                }],
                warnings: [],
                metadata: {
                    validatedAt: new Date(),
                    validationType: 'proposal_swap_relationship_validation'
                }
            };
        }
    }

    /**
     * Optimized single-query validation method that combines all foreign key validations
     * into one database query for improved performance
     * 
     * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
     */
    async validateAllReferencesInSingleQuery(request: PaymentTransactionRequest): Promise<ValidationResult> {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const validationType = 'optimized_foreign_key_validation';

        try {
            logger.info('Starting optimized single-query foreign key validation', {
                swapId: request.swapId,
                proposalId: request.proposalId,
                payerId: request.payerId,
                recipientId: request.recipientId
            });

            // Single comprehensive query to validate all foreign key references
            const query = `
                WITH validation_data AS (
                    SELECT 
                        -- Swap validation
                        s.id as swap_exists,
                        s.status as swap_status,
                        s.acceptance_strategy,
                        s.payment_types,
                        s.owner_id as swap_owner_id,
                        
                        -- User validation
                        u_payer.id as payer_exists,
                        u_recipient.id as recipient_exists,
                        
                        -- Proposal validation (only when proposal_id is provided)
                        CASE 
                            WHEN $2::uuid IS NOT NULL THEN ap.id
                            ELSE NULL
                        END as proposal_exists,
                        CASE 
                            WHEN $2::uuid IS NOT NULL THEN ap.status
                            ELSE NULL
                        END as proposal_status,
                        
                        -- Auction validation (for proposal-swap relationship)
                        CASE 
                            WHEN $2::uuid IS NOT NULL THEN sa.swap_id
                            ELSE NULL
                        END as proposal_swap_id,
                        
                        -- Active auction check
                        sa_active.id as active_auction_exists,
                        sa_active.status as active_auction_status
                        
                    FROM swaps s
                    LEFT JOIN users u_payer ON u_payer.id = $3::uuid
                    LEFT JOIN users u_recipient ON u_recipient.id = $4::uuid
                    LEFT JOIN auction_proposals ap ON ap.id = $2::uuid AND ap.status != 'deleted'
                    LEFT JOIN swap_auctions sa ON sa.id = ap.auction_id
                    LEFT JOIN swap_auctions sa_active ON sa_active.swap_id = s.id AND sa_active.status = 'active'
                    WHERE s.id = $1::uuid AND s.status != 'deleted'
                )
                SELECT * FROM validation_data
            `;

            const result = await this.pool.query(query, [
                request.swapId,
                request.proposalId || null,
                request.payerId,
                request.recipientId
            ]);

            if (result.rows.length === 0) {
                errors.push({
                    code: VALIDATION_ERROR_CODES.SWAP_NOT_FOUND,
                    message: 'Referenced swap does not exist or has been deleted',
                    field: 'swapId',
                    constraint: 'payment_transactions_swap_id_fkey',
                    suggestedFix: 'Verify the swap ID is correct and the swap still exists'
                });

                return {
                    isValid: false,
                    errors,
                    warnings,
                    metadata: {
                        validatedAt: new Date(),
                        validationType
                    }
                };
            }

            const data = result.rows[0];

            // Determine scenario from swap configuration
            const acceptanceStrategy = data.acceptance_strategy || { type: 'first_match' };
            const scenario: SwapScenario = acceptanceStrategy.type === 'auction' ? 'auction' : 'first_match';

            // Validate payer exists
            if (!data.payer_exists) {
                errors.push({
                    code: VALIDATION_ERROR_CODES.USER_NOT_FOUND,
                    message: 'Payer user does not exist',
                    field: 'payerId',
                    constraint: 'payment_transactions_payer_id_fkey',
                    suggestedFix: 'Verify the payer user ID is correct'
                });
            }

            // Validate recipient exists
            if (!data.recipient_exists) {
                errors.push({
                    code: VALIDATION_ERROR_CODES.USER_NOT_FOUND,
                    message: 'Recipient user does not exist',
                    field: 'recipientId',
                    constraint: 'payment_transactions_recipient_id_fkey',
                    suggestedFix: 'Verify the recipient user ID is correct'
                });
            }

            // Validate proposal_id based on scenario
            if (scenario === 'auction') {
                if (!request.proposalId) {
                    errors.push({
                        code: VALIDATION_ERROR_CODES.INVALID_PROPOSAL_REFERENCE,
                        message: 'Auction transactions must reference a valid auction proposal',
                        field: 'proposalId',
                        constraint: 'payment_transactions_proposal_id_fkey',
                        suggestedFix: 'Ensure auction proposal is created before payment transaction'
                    });
                } else {
                    // Check if proposal exists
                    if (!data.proposal_exists) {
                        errors.push({
                            code: VALIDATION_ERROR_CODES.PROPOSAL_NOT_FOUND,
                            message: 'Referenced auction proposal does not exist or has been deleted',
                            field: 'proposalId',
                            constraint: 'payment_transactions_proposal_id_fkey',
                            suggestedFix: 'Verify the proposal ID is correct and the proposal still exists'
                        });
                    } else {
                        // Check if proposal belongs to the correct swap
                        if (data.proposal_swap_id !== request.swapId) {
                            errors.push({
                                code: VALIDATION_ERROR_CODES.INVALID_PROPOSAL_REFERENCE,
                                message: 'Proposal does not belong to the specified swap',
                                field: 'proposalId',
                                suggestedFix: 'Ensure the proposal ID matches the swap being processed'
                            });
                        }
                    }

                    // Check if there's an active auction for auction scenarios
                    if (!data.active_auction_exists) {
                        errors.push({
                            code: VALIDATION_ERROR_CODES.AUCTION_NOT_ACTIVE,
                            message: 'No active auction exists for this swap',
                            field: 'swapId',
                            suggestedFix: 'Verify the auction is still active'
                        });
                    }
                }
            } else if (scenario === 'first_match') {
                // For direct/first-match scenarios, proposal_id should be null
                if (request.proposalId !== null && request.proposalId !== undefined) {
                    errors.push({
                        code: VALIDATION_ERROR_CODES.SCENARIO_MISMATCH,
                        message: 'Direct swap transactions should not reference auction proposals',
                        field: 'proposalId',
                        suggestedFix: 'Set proposalId to null for direct swap transactions'
                    });
                }
            }

            // Additional swap status validation
            if (data.swap_status === 'completed') {
                errors.push({
                    code: VALIDATION_ERROR_CODES.SWAP_NOT_FOUND,
                    message: 'Swap has already been completed and cannot accept new offers',
                    field: 'swapId',
                    suggestedFix: 'Find an active swap to submit offers to'
                });
            } else if (data.swap_status === 'cancelled') {
                errors.push({
                    code: VALIDATION_ERROR_CODES.SWAP_NOT_FOUND,
                    message: 'Swap has been cancelled and cannot accept new offers',
                    field: 'swapId',
                    suggestedFix: 'Find an active swap to submit offers to'
                });
            }

            // Validate users are not the same
            if (request.payerId === request.recipientId) {
                errors.push({
                    code: VALIDATION_ERROR_CODES.USER_NOT_FOUND,
                    message: 'Payer and recipient cannot be the same user',
                    field: 'payerId',
                    suggestedFix: 'Ensure different users for payer and recipient'
                });
            }

            // Add performance warning if using multiple separate queries would be better
            if (errors.length === 0) {
                warnings.push({
                    code: 'OPTIMIZED_VALIDATION_SUCCESS',
                    message: 'All foreign key references validated in single query',
                    severity: 'low'
                });
            }

            const isValid = errors.length === 0;

            logger.info('Optimized single-query foreign key validation completed', {
                swapId: request.swapId,
                proposalId: request.proposalId,
                scenario,
                isValid,
                errorCount: errors.length,
                warningCount: warnings.length,
                performanceOptimized: true
            });

            return {
                isValid,
                errors,
                warnings,
                metadata: {
                    validatedAt: new Date(),
                    validationType,
                    scenario
                }
            };

        } catch (error) {
            logger.error('Optimized single-query foreign key validation failed with exception', {
                error: error instanceof Error ? error.message : String(error),
                swapId: request.swapId,
                proposalId: request.proposalId
            });

            return {
                isValid: false,
                errors: [{
                    code: VALIDATION_ERROR_CODES.FOREIGN_KEY_VIOLATION,
                    message: 'Optimized foreign key validation failed due to system error',
                    suggestedFix: 'Please try again or contact support if the issue persists'
                }],
                warnings,
                metadata: {
                    validatedAt: new Date(),
                    validationType
                }
            };
        }
    }

    /**
     * Enables or disables optimized validation
     */
    setOptimizedValidation(enabled: boolean): void {
        this.useOptimizedValidation = enabled;
        logger.info('Foreign key validation optimization setting changed', {
            optimizedValidation: enabled
        });
    }

    /**
     * Gets current validation configuration and statistics
     */
    getValidationStats(): ValidationStats {
        return {
            optimizedValidationEnabled: this.useOptimizedValidation,
            validationMethod: this.useOptimizedValidation ? 'single_query_optimized' : 'multi_query_standard',
            supportedScenarios: ['auction', 'first_match'],
            supportedValidations: [
                'swap_reference',
                'proposal_reference',
                'user_references',
                'proposal_swap_relationship'
            ]
        };
    }

    /**
     * Validates foreign key references using both methods and compares performance
     * Useful for testing and performance analysis
     */
    async compareValidationMethods(request: PaymentTransactionRequest): Promise<ValidationComparison> {
        const startTime = Date.now();

        // Run optimized validation
        const optimizedStart = Date.now();
        const optimizedResult = await this.validateAllReferencesInSingleQuery(request);
        const optimizedTime = Date.now() - optimizedStart;

        // Run standard validation
        const standardStart = Date.now();
        const standardResult = await this.validateForeignKeyReferencesStandard(request);
        const standardTime = Date.now() - standardStart;

        const totalTime = Date.now() - startTime;

        return {
            optimizedResult,
            standardResult,
            performanceComparison: {
                optimizedTime,
                standardTime,
                totalTime,
                performanceGain: standardTime > 0 ? ((standardTime - optimizedTime) / standardTime) * 100 : 0,
                recommendation: optimizedTime < standardTime ? 'use_optimized' : 'use_standard'
            },
            resultsMatch: this.compareValidationResults(optimizedResult, standardResult)
        };
    }

    /**
     * Compares two validation results to ensure they match
     */
    private compareValidationResults(result1: ValidationResult, result2: ValidationResult): boolean {
        return result1.isValid === result2.isValid &&
            result1.errors.length === result2.errors.length &&
            result1.warnings.length === result2.warnings.length;
    }
}

// Additional type definitions for the optimization features
interface ValidationStats {
    optimizedValidationEnabled: boolean;
    validationMethod: 'single_query_optimized' | 'multi_query_standard';
    supportedScenarios: string[];
    supportedValidations: string[];
}

interface ValidationComparison {
    optimizedResult: ValidationResult;
    standardResult: ValidationResult;
    performanceComparison: {
        optimizedTime: number;
        standardTime: number;
        totalTime: number;
        performanceGain: number;
        recommendation: 'use_optimized' | 'use_standard';
    };
    resultsMatch: boolean;
}

export { ValidationStats, ValidationComparison };