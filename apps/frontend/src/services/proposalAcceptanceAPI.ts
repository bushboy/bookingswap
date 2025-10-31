import { apiClient } from './apiClient';
import { logger } from '@/utils/logger';
import { ProposalErrorHandler } from './proposalErrorHandler';
import { SwapCompletionResult, CompletionValidationResult, SwapCompletionErrorCodes } from '@booking-swap/shared';

/**
 * Request interface for accepting a proposal
 */
export interface AcceptProposalRequest {
    proposalId: string;
    userId: string;
    autoProcessPayment?: boolean;
    swapTargetId?: string; // Target swap ID for booking proposals
    ensureCompletion?: boolean; // New flag for completion workflow
    validationLevel?: 'basic' | 'comprehensive'; // New validation option
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
    completion?: SwapCompletionResult; // New completion details
    validation?: CompletionValidationResult; // New validation results
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
    completionStatus?: 'initiated' | 'completed' | 'failed' | 'rolled_back'; // New completion status
    completionId?: string; // New completion tracking ID
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
            'BLOCKCHAIN_RECORDING_FAILED',
            'DATABASE_TRANSACTION_FAILED',
            'COMPLETION_VALIDATION_FAILED'
        ]
    };

    /**
     * Accept a proposal with comprehensive error handling and retry logic
     * Enhanced with completion workflow support
     * Requirements: 1.1, 1.3, 1.4, 4.1, 8.1
     */
    async acceptProposal(request: AcceptProposalRequest): Promise<ProposalActionResponse> {
        const {
            proposalId,
            userId,
            autoProcessPayment = true,
            swapTargetId,
            ensureCompletion = true,
            validationLevel = 'basic'
        } = request;

        logger.info('Accepting proposal with completion workflow', {
            proposalId,
            userId,
            autoProcessPayment,
            swapTargetId,
            ensureCompletion,
            validationLevel
        });

        return this.executeWithRetry(async () => {
            try {
                const requestBody: any = {
                    userId,
                    autoProcessPayment,
                    ensureCompletion,
                    validationLevel
                };

                // Use swapTargetId as the URL parameter if provided (it's the correct ID for booking proposals)
                // Fall back to proposalId for cash proposals
                const urlProposalId = swapTargetId || proposalId;

                // Always include swapTargetId if provided (for backend's additional validation)
                if (swapTargetId) {
                    requestBody.swapTargetId = swapTargetId;
                }

                logger.info('Using URL proposal ID with completion workflow', {
                    originalProposalId: proposalId,
                    swapTargetId,
                    urlProposalId,
                    usingSwapTargetIdInUrl: !!swapTargetId,
                    ensureCompletion,
                    validationLevel
                });

                const response = await apiClient.post<ProposalActionResponse>(
                    `/proposals/${urlProposalId}/accept`,
                    requestBody
                );

                logger.info('Proposal accepted successfully with completion', {
                    proposalId,
                    status: response.data.proposal.status,
                    hasPayment: !!response.data.paymentTransaction,
                    hasCompletion: !!response.data.completion,
                    completionValid: response.data.validation?.isValid,
                    completedSwaps: response.data.completion?.completedSwaps?.length || 0,
                    updatedBookings: response.data.completion?.updatedBookings?.length || 0
                });

                // Start completion status polling if completion is in progress
                if (response.data.completion && ensureCompletion) {
                    this.startCompletionStatusPolling(proposalId, response.data.completion);
                }

                return response.data;
            } catch (error: any) {
                logger.error('Failed to accept proposal with completion', {
                    proposalId,
                    error: error.message,
                    status: error.response?.status,
                    data: error.response?.data,
                    isCompletionError: this.isCompletionError(error)
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
     * Check if an error is retryable using enhanced error handler with completion support
     * Requirements: 4.1, 8.1
     */
    private isRetryableError(error: any): boolean {
        // Check completion-specific retryable errors first
        const errorCode = error.response?.data?.error?.code || error.code;

        if (this.retryConfig.retryableErrors.includes(errorCode)) {
            return true;
        }

        // Use existing error handler for other cases
        return ProposalErrorHandler.isRetryableError(error);
    }



    /**
     * Start completion status polling for long-running operations
     * Requirements: 1.1, 4.1
     */
    private startCompletionStatusPolling(proposalId: string, completion: SwapCompletionResult): void {
        const pollInterval = 2000; // 2 seconds
        const maxPollTime = 30000; // 30 seconds
        const startTime = Date.now();

        logger.debug('Starting completion status polling', {
            proposalId,
            completedSwaps: completion.completedSwaps.length,
            updatedBookings: completion.updatedBookings.length,
            completionTimestamp: completion.completionTimestamp
        });

        const poll = async () => {
            try {
                if (Date.now() - startTime > maxPollTime) {
                    logger.warn('Completion status polling timeout', { proposalId });
                    return;
                }

                const status = await this.getProposalStatus(proposalId);

                logger.debug('Completion status poll result', {
                    proposalId,
                    completionStatus: status.completionStatus,
                    paymentStatus: status.paymentStatus
                });

                if (status.completionStatus === 'completed') {
                    logger.info('Completion workflow finished successfully', { proposalId });
                    return;
                } else if (status.completionStatus === 'failed' || status.completionStatus === 'rolled_back') {
                    logger.error('Completion workflow failed', {
                        proposalId,
                        completionStatus: status.completionStatus
                    });
                    return;
                }

                // Continue polling if still in progress
                if (status.completionStatus === 'initiated') {
                    setTimeout(poll, pollInterval);
                }
            } catch (error: any) {
                logger.error('Error during completion status polling', {
                    proposalId,
                    error: error.message
                });
            }
        };

        // Start polling after a short delay
        setTimeout(poll, pollInterval);
    }

    /**
     * Check if an error is completion-related
     * Requirements: 4.1, 8.1
     */
    private isCompletionError(error: any): boolean {
        const errorCode = error.response?.data?.error?.code || error.code;

        const completionErrorCodes = [
            SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED,
            SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
            SwapCompletionErrorCodes.BLOCKCHAIN_RECORDING_FAILED,
            SwapCompletionErrorCodes.INCONSISTENT_ENTITY_STATES,
            SwapCompletionErrorCodes.AUTOMATIC_CORRECTION_FAILED,
            SwapCompletionErrorCodes.ROLLBACK_FAILED
        ];

        return completionErrorCodes.includes(errorCode);
    }

    /**
     * Enhanced error handling for completion-specific error codes
     * Requirements: 4.1, 8.1
     */
    private handleApiError(error: any): Error {
        const enhancedError = ProposalErrorHandler.handleApiError(error);
        const errorCode = error.response?.data?.error?.code || error.code;

        // Handle completion-specific errors
        if (this.isCompletionError(error)) {
            switch (errorCode) {
                case SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED:
                    enhancedError.message = 'Completion validation failed. Some entities may be in an inconsistent state.';
                    enhancedError.userAction = 'Please check the status of your swaps and bookings, then try again.';
                    break;
                case SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED:
                    enhancedError.message = 'Database transaction failed during completion. Please try again.';
                    enhancedError.shouldRetry = true;
                    enhancedError.retryDelay = 3000;
                    break;
                case SwapCompletionErrorCodes.BLOCKCHAIN_RECORDING_FAILED:
                    enhancedError.message = 'Blockchain recording failed. The operation may be retried automatically.';
                    enhancedError.shouldRetry = true;
                    enhancedError.retryDelay = 5000;
                    break;
                case SwapCompletionErrorCodes.INCONSISTENT_ENTITY_STATES:
                    enhancedError.message = 'Inconsistent entity states detected. Manual intervention may be required.';
                    enhancedError.shouldRetry = false;
                    enhancedError.userAction = 'Please contact support for assistance with this completion issue.';
                    break;
                case SwapCompletionErrorCodes.ROLLBACK_FAILED:
                    enhancedError.message = 'Completion rollback failed. Please contact support immediately.';
                    enhancedError.shouldRetry = false;
                    enhancedError.userAction = 'Contact support immediately - manual intervention required.';
                    break;
            }
        }

        const apiError = new Error(enhancedError.message);

        // Attach additional error information
        (apiError as any).code = enhancedError.code;
        (apiError as any).shouldRetry = enhancedError.shouldRetry;
        (apiError as any).shouldRedirectToLogin = enhancedError.shouldRedirectToLogin;
        (apiError as any).userAction = enhancedError.userAction;
        (apiError as any).retryDelay = enhancedError.retryDelay;
        (apiError as any).isCompletionError = this.isCompletionError(error);

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