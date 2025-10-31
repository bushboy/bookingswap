import { BaseEntity } from './base.js';

/**
 * Response action types for swap proposals
 */
export type ProposalResponseAction = 'accept' | 'reject';

/**
 * Interface for proposal response data
 */
export interface ProposalResponse extends BaseEntity {
    /** ID of the proposal being responded to */
    proposalId: string;

    /** ID of the user responding to the proposal */
    responderId: string;

    /** Action taken on the proposal */
    action: ProposalResponseAction;

    /** Optional reason for rejection */
    reason?: string;

    /** ID of swap created if proposal was accepted */
    swapId?: string;

    /** Payment transaction ID for financial proposals */
    paymentTransactionId?: string;

    /** Blockchain transaction ID for the response */
    blockchainTransactionId: string;

    /** Additional response metadata */
    responseData?: Record<string, any>;
}

/**
 * Request interface for creating a proposal response
 */
export interface CreateProposalResponseRequest {
    /** ID of the proposal to respond to */
    proposalId: string;

    /** ID of the user responding */
    responderId: string;

    /** Action to take on the proposal */
    action: ProposalResponseAction;

    /** Optional reason for rejection */
    reason?: string;

    /** Additional response data */
    responseData?: Record<string, any>;
}

/**
 * Result interface for proposal response operations
 */
export interface ProposalResponseResult {
    /** The created proposal response */
    response: ProposalResponse;

    /** The updated proposal */
    proposal: any; // Will be typed as SwapProposal when imported

    /** Created swap if proposal was accepted */
    swap?: any; // Will be typed as Swap when imported

    /** Payment transaction if financial proposal */
    paymentTransaction?: any; // Will be typed as PaymentTransaction when imported

    /** Blockchain transaction details */
    blockchainTransaction: {
        transactionId: string;
        consensusTimestamp?: string;
    };
}

/**
 * Interface for querying proposal responses
 */
export interface ProposalResponseQuery {
    /** Filter by responder ID */
    responderId?: string;

    /** Filter by action type */
    action?: ProposalResponseAction;

    /** Filter by date range */
    dateRange?: {
        start?: Date;
        end?: Date;
    };

    /** Pagination */
    limit?: number;
    offset?: number;

    /** Sorting */
    sortBy?: 'created_at' | 'action';
    sortOrder?: 'asc' | 'desc';
}

/**
 * Response for proposal response list queries
 */
export interface ProposalResponseListResult {
    /** List of proposal responses */
    responses: ProposalResponse[];

    /** Pagination metadata */
    pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
    };
}