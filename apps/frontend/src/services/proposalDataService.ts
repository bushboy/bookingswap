import { apiClient } from './apiClient';
import { proposalWebSocketService } from './proposalWebSocketService';
import { logger } from '@/utils/logger';

/**
 * Interface representing a swap proposal with comprehensive data
 */
export interface SwapProposal {
    id: string;
    sourceSwapId: string;
    targetSwapId?: string;
    proposerId: string;
    targetUserId: string;
    proposalType: 'booking' | 'cash';
    status: 'pending' | 'accepted' | 'rejected' | 'expired';

    // Financial proposal fields
    cashOffer?: {
        amount: number;
        currency: string;
        escrowAccountId?: string;
        paymentMethodId: string;
    };

    // Response tracking
    respondedAt?: Date;
    respondedBy?: string;
    rejectionReason?: string;

    // Blockchain tracking
    blockchain: {
        proposalTransactionId?: string;
        responseTransactionId?: string;
    };

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Interface for real-time proposal updates
 */
export interface ProposalUpdate {
    proposalId: string;
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    updatedAt: Date;
    respondedBy?: string;
    rejectionReason?: string;
    paymentStatus?: 'processing' | 'completed' | 'failed';
}

/**
 * Interface for proposal data loading service
 * Implements requirements 4.1, 4.2, 4.3, 4.4 from the design document
 */
export interface ProposalDataService {
    /**
     * Fetch proposals for a specific user
     * Requirements: 4.1, 4.2
     */
    getUserProposals(userId: string): Promise<SwapProposal[]>;

    /**
     * Fetch individual proposal details
     * Requirements: 4.3, 4.4
     */
    getProposalDetails(proposalId: string): Promise<SwapProposal>;

    /**
     * Subscribe to real-time proposal updates for a user
     * Requirements: 4.1, 4.2
     */
    subscribeToProposalUpdates(userId: string, callback: (update: ProposalUpdate) => void): void;

    /**
     * Unsubscribe from real-time proposal updates
     */
    unsubscribeFromProposalUpdates(userId: string): void;

    /**
     * Check if service is connected for real-time updates
     */
    isConnected(): boolean;
}

/**
 * Implementation of ProposalDataService with API integration
 * Integrates with existing apiClient for consistent error handling and authentication
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export class ProposalDataServiceImpl implements ProposalDataService {
    private updateCallbacks: Map<string, (update: ProposalUpdate) => void> = new Map();
    private isInitialized: boolean = false;

    constructor() {
        this.initialize();
    }

    /**
     * Initialize the service and set up WebSocket event handlers
     */
    private initialize(): void {
        if (this.isInitialized) {
            return;
        }

        // Set up WebSocket event handlers for real-time updates
        proposalWebSocketService.on('proposal_status_update', this.handleProposalStatusUpdate.bind(this));
        proposalWebSocketService.on('proposal_accepted', this.handleProposalStatusUpdate.bind(this));
        proposalWebSocketService.on('proposal_rejected', this.handleProposalStatusUpdate.bind(this));

        this.isInitialized = true;
        logger.info('ProposalDataService initialized');
    }

    /**
     * Fetch proposals for a specific user
     * Requirements: 4.1, 4.2
     */
    async getUserProposals(userId: string): Promise<SwapProposal[]> {
        try {
            if (!userId || userId.trim().length === 0) {
                throw new Error('User ID is required');
            }

            logger.debug('Fetching user proposals', { userId });

            const response = await apiClient.get<{
                success: boolean;
                data: SwapProposal[];
            }>(`/proposals/user/${userId}`);

            if (!response.data.success) {
                throw new Error('Failed to fetch user proposals');
            }

            const proposals = response.data.data || [];

            // Transform date strings to Date objects
            const transformedProposals = proposals.map(proposal => ({
                ...proposal,
                createdAt: new Date(proposal.createdAt),
                updatedAt: new Date(proposal.updatedAt),
                respondedAt: proposal.respondedAt ? new Date(proposal.respondedAt) : undefined,
            }));

            logger.info('User proposals fetched successfully', {
                userId,
                proposalCount: transformedProposals.length
            });

            return transformedProposals;
        } catch (error: any) {
            logger.error('Failed to fetch user proposals', {
                userId,
                error: error.message,
                status: error.response?.status
            });

            // Handle specific error cases
            if (error.response?.status === 404) {
                // No proposals found - return empty array
                return [];
            }

            if (error.response?.status === 401) {
                throw new Error('Authentication required. Please log in and try again.');
            }

            if (error.response?.status === 403) {
                throw new Error('You do not have permission to view these proposals.');
            }

            throw new Error(
                error.response?.data?.error?.message ||
                error.message ||
                'Failed to fetch user proposals'
            );
        }
    }

    /**
     * Fetch individual proposal details
     * Requirements: 4.3, 4.4
     */
    async getProposalDetails(proposalId: string): Promise<SwapProposal> {
        try {
            if (!proposalId || proposalId.trim().length === 0) {
                throw new Error('Proposal ID is required');
            }

            logger.debug('Fetching proposal details', { proposalId });

            const response = await apiClient.get<{
                success: boolean;
                data: SwapProposal;
            }>(`/proposals/${proposalId}`);

            if (!response.data.success) {
                throw new Error('Failed to fetch proposal details');
            }

            const proposal = response.data.data;

            // Transform date strings to Date objects
            const transformedProposal: SwapProposal = {
                ...proposal,
                createdAt: new Date(proposal.createdAt),
                updatedAt: new Date(proposal.updatedAt),
                respondedAt: proposal.respondedAt ? new Date(proposal.respondedAt) : undefined,
            };

            logger.info('Proposal details fetched successfully', {
                proposalId,
                status: transformedProposal.status,
                proposalType: transformedProposal.proposalType
            });

            return transformedProposal;
        } catch (error: any) {
            logger.error('Failed to fetch proposal details', {
                proposalId,
                error: error.message,
                status: error.response?.status
            });

            // Handle specific error cases
            if (error.response?.status === 404) {
                throw new Error('Proposal not found. It may have been removed or expired.');
            }

            if (error.response?.status === 401) {
                throw new Error('Authentication required. Please log in and try again.');
            }

            if (error.response?.status === 403) {
                throw new Error('You do not have permission to view this proposal.');
            }

            throw new Error(
                error.response?.data?.error?.message ||
                error.message ||
                'Failed to fetch proposal details'
            );
        }
    }

    /**
     * Subscribe to real-time proposal updates for a user
     * Requirements: 4.1, 4.2
     */
    subscribeToProposalUpdates(userId: string, callback: (update: ProposalUpdate) => void): void {
        try {
            if (!userId || userId.trim().length === 0) {
                throw new Error('User ID is required');
            }

            if (typeof callback !== 'function') {
                throw new Error('Callback function is required');
            }

            logger.debug('Subscribing to proposal updates', { userId });

            // Store the callback for this user
            this.updateCallbacks.set(userId, callback);

            // Subscribe to WebSocket updates for this user
            proposalWebSocketService.subscribeToCurrentUserProposals(userId);

            // Ensure WebSocket connection is established
            if (!proposalWebSocketService.isConnected()) {
                proposalWebSocketService.connect().catch(error => {
                    logger.error('Failed to connect to proposal WebSocket', { error });
                });
            }

            logger.info('Subscribed to proposal updates', { userId });
        } catch (error: any) {
            logger.error('Failed to subscribe to proposal updates', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Unsubscribe from real-time proposal updates
     */
    unsubscribeFromProposalUpdates(userId: string): void {
        try {
            if (!userId || userId.trim().length === 0) {
                throw new Error('User ID is required');
            }

            logger.debug('Unsubscribing from proposal updates', { userId });

            // Remove the callback for this user
            this.updateCallbacks.delete(userId);

            // Unsubscribe from WebSocket updates for this user
            proposalWebSocketService.unsubscribeFromUserProposals([userId]);

            logger.info('Unsubscribed from proposal updates', { userId });
        } catch (error: any) {
            logger.error('Failed to unsubscribe from proposal updates', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Check if service is connected for real-time updates
     */
    isConnected(): boolean {
        return proposalWebSocketService.isConnected();
    }

    /**
     * Handle proposal status updates from WebSocket
     */
    private handleProposalStatusUpdate(statusUpdate: any): void {
        try {
            const update: ProposalUpdate = {
                proposalId: statusUpdate.proposalId,
                status: statusUpdate.status,
                updatedAt: new Date(statusUpdate.respondedAt || Date.now()),
                respondedBy: statusUpdate.respondedBy,
                rejectionReason: statusUpdate.rejectionReason,
                paymentStatus: statusUpdate.paymentStatus,
            };

            logger.debug('Received proposal status update', {
                proposalId: update.proposalId,
                status: update.status
            });

            // Notify all subscribed callbacks
            this.updateCallbacks.forEach((callback, userId) => {
                try {
                    callback(update);
                } catch (error: any) {
                    logger.error('Error in proposal update callback', {
                        userId,
                        proposalId: update.proposalId,
                        error: error.message
                    });
                }
            });
        } catch (error: any) {
            logger.error('Error handling proposal status update', {
                error: error.message,
                statusUpdate
            });
        }
    }
}

// Export singleton instance
export const proposalDataService = new ProposalDataServiceImpl();
export default proposalDataService;