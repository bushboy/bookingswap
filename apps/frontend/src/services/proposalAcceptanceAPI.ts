import { apiClient } from './apiClient';
import { logger } from '@/utils/logger';
import { ProposalErrorHandler } from './proposalErrorHandler';

/**
 * Request interface for accepting a proposal
 */
export interface AcceptProposalRequest {
    proposalId: string;
    userId: string;
    autoProcessPayment?: boolean;
    swapTargetId?: string; // Target swap ID for booking proposals
}

/**
 * Request interface for rejecting a proposal
 */
export interface RejectProposalRequest {
    proposalId: string;
    userId: string;
    reason?: string;
    swapTargetId?: string; // Target swap ID for booking proposals
}

/**
 * Response interface for proposal acceptance/rejection
 */
export interface ProposalActionResponse {
    success: boolean;
    proposal: {
        id: string;
        status: 'accepted' | 'rejected';
        respondedAt: string;
        respondedBy: string;
        rejectionReason?: string;
    };
    swap?: {
        id: string;
        status: string;
    };
    paymentTransaction?: {
        id: string;
        status: string;
        amount: number;
        currency: string;
    };
    blockchainTransaction: {
        transactionId: string;
        consensusTimestamp?: string;
    };
}

/**
 * Response interface for proposal status
 */
export interface ProposalStatusResponse {
    proposalId: string;
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    respondedAt?: string;
    respondedBy?: string;
    rejectionReason?: string;
    paymentStatus?: 'processing' | 'completed' | 'failed';
    blockchainTransactionId?: string;
}

/**
 * Error response interface for proposal operations
 */
export interface ProposalErrorResponse {
    error: {
        code: string;
        message: string;
        details?: Record<string, any>;
    };
    timestamp: string;
    requestId: string;
}

/**
 * Retry configuration for failed API requests
 */
interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    retryableErrors: string[];
}

/**
 * API service for proposal acceptance and rejection operations
 * Implements requirements 1.3, 1.4, 2.3, 2.4 from the design document
 */
export class ProposalAcceptanceAPI {
    private readonly retryConfig: RetryConfig = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        retryableErrors: [
            'NETWORK_ERROR',
            'TIMEOUT',
            'INTERNAL_SERVER_ERROR',
            'SERVICE_UNAVAILABLE',
            'BLOCKCHAIN_RECORDING_FAILED'
        ]
    };

    /**
     * Accept a proposal with comprehensive error handling and retry logic
     * Requirements: 1.3, 1.4
     */
    async acceptProposal(request: AcceptProposalRequest): Promise<ProposalActionResponse> {
        const { proposalId, userId, autoProcessPayment = true, swapTargetId } = request;

        logger.info('Accepting proposal', { proposalId, userId, autoProcessPayment, swapTargetId });

        return this.executeWithRetry(async () => {
            try {
                const requestBody: any = {
                    userId,
                    autoProcessPayment
                };

                // Use swapTargetId as the URL parameter if provided (it's the correct ID for booking proposals)
                // Fall back to proposalId for cash proposals
                const urlProposalId = swapTargetId || proposalId;

                // Always include swapTargetId if provided (for backend's additional validation)
                if (swapTargetId) {
                    requestBody.swapTargetId = swapTargetId;
                }

                logger.info('Using URL proposal ID', {
                    originalProposalId: proposalId,
                    swapTargetId,
                    urlProposalId,
                    usingSwapTargetIdInUrl: !!swapTargetId
                });

                const response = await apiClient.post<ProposalActionResponse>(
                    `/proposals/${urlProposalId}/accept`,
                    requestBody
                );

                logger.info('Proposal accepted successfully', {
                    proposalId,
                    status: response.data.proposal.status,
                    hasPayment: !!response.data.paymentTransaction
                });

                return response.data;
            } catch (error: any) {
                logger.error('Failed to accept proposal', {
                    proposalId,
                    error: error.message,
                    status: error.response?.status,
                    data: error.response?.data
                });

                throw this.handleApiError(error);
            }
        }, `acceptProposal-${proposalId}`);
    }

    /**
     * Reject a proposal with reason support and error handling
     * Requirements: 2.3, 2.4
     */
    async rejectProposal(request: RejectProposalRequest): Promise<ProposalActionResponse> {
        const { proposalId, userId, reason, swapTargetId } = request;

        logger.info('Rejecting proposal', { proposalId, userId, hasReason: !!reason, swapTargetId });

        return this.executeWithRetry(async () => {
            try {
                const requestBody: any = {
                    userId,
                    reason
                };

                // Use swapTargetId as the URL parameter if provided (it's the correct ID for booking proposals)
                // Fall back to proposalId for cash proposals
                const urlProposalId = swapTargetId || proposalId;

                // Always include swapTargetId if provided (for backend's additional validation)
                if (swapTargetId) {
                    requestBody.swapTargetId = swapTargetId;
                }

                logger.info('Using URL proposal ID for rejection', {
                    originalProposalId: proposalId,
                    swapTargetId,
                    urlProposalId,
                    usingSwapTargetIdInUrl: !!swapTargetId
                });

                const response = await apiClient.post<ProposalActionResponse>(
                    `/proposals/${urlProposalId}/reject`,
                    requestBody
                );

                logger.info('Proposal rejected successfully', {
                    proposalId,
                    status: response.data.proposal.status,
                    reason: response.data.proposal.rejectionReason
                });

                return response.data;
            } catch (error: any) {
                logger.error('Failed to reject proposal', {
                    proposalId,
                    error: error.message,
                    status: error.response?.status,
                    data: error.response?.data
                });

                throw this.handleApiError(error);
            }
        }, `rejectProposal-${proposalId}`);
    }

    /**
     * Get real-time proposal status for updates
     * Requirements: 1.3, 1.4
     */
    async getProposalStatus(proposalId: string): Promise<ProposalStatusResponse> {
        logger.debug('Getting proposal status', { proposalId });

        return this.executeWithRetry(async () => {
            try {
                const response = await apiClient.get<ProposalStatusResponse>(
                    `/proposals/${proposalId}/status`
                );

                logger.debug('Proposal status retrieved', {
                    proposalId,
                    status: response.data.status,
                    paymentStatus: response.data.paymentStatus
                });

                return response.data;
            } catch (error: any) {
                logger.error('Failed to get proposal status', {
                    proposalId,
                    error: error.message,
                    status: error.response?.status
                });

                throw this.handleApiError(error);
            }
        }, `getProposalStatus-${proposalId}`);
    }

    /**
     * Execute API call with retry logic for failed requests
     */
    private async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationId: string
    ): Promise<T> {
        let lastError: Error;
        let delay = this.retryConfig.baseDelay;

        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;

                // Don't retry on the last attempt or for non-retryable errors
                if (attempt === this.retryConfig.maxRetries || !this.isRetryableError(error)) {
                    break;
                }

                logger.warn('API call failed, retrying', {
                    operationId,
                    attempt: attempt + 1,
                    maxRetries: this.retryConfig.maxRetries,
                    delay,
                    error: error.message
                });

                // Wait before retrying with exponential backoff
                await this.sleep(delay);
                delay = Math.min(delay * 2, this.retryConfig.maxDelay);
            }
        }

        throw lastError!;
    }

    /**
     * Check if an error is retryable using enhanced error handler
     */
    private isRetryableError(error: any): boolean {
        return ProposalErrorHandler.isRetryableError(error);
    }

    /**
     * Handle API errors using enhanced error handler
     */
    private handleApiError(error: any): Error {
        const enhancedError = ProposalErrorHandler.handleApiError(error);
        const apiError = new Error(enhancedError.message);

        // Attach additional error information
        (apiError as any).code = enhancedError.code;
        (apiError as any).shouldRetry = enhancedError.shouldRetry;
        (apiError as any).shouldRedirectToLogin = enhancedError.shouldRedirectToLogin;
        (apiError as any).userAction = enhancedError.userAction;
        (apiError as any).retryDelay = enhancedError.retryDelay;

        return apiError;
    }

    /**
     * Sleep utility for retry delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
export const proposalAcceptanceAPI = new ProposalAcceptanceAPI();
export default proposalAcceptanceAPI;