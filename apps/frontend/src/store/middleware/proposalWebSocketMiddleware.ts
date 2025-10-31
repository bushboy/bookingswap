import { Middleware } from '@reduxjs/toolkit';
import { proposalWebSocketService } from '../../services/proposalWebSocketService';
import {
    updateProposal,
    updateLastUpdateTime,
} from '../slices/proposalSlice';
import {
    completeProposalOperation,
    removeOptimisticUpdate,
} from '../slices/proposalAcceptanceSlice';
import {
    connectionThrottlingManager,
    connectionStateChecker
} from '../../utils/connectionThrottling';
import { getServiceConfig, isThrottlingFeatureEnabled } from '../../config/connectionThrottling';

/**
 * WebSocket middleware for handling real-time proposal updates
 * Implements requirements 1.5, 2.5, 7.1, 7.5 from the design document
 * Enhanced with connection throttling (requirements 1.1, 3.1, 3.3)
 */
export const proposalWebSocketMiddleware: Middleware = (store) => {
    let isInitialized = false;
    let currentUserId: string | null = null;

    // Service identifier for throttling
    const SERVICE_ID = 'proposalWebSocketService';

    // Initialize throttling manager with service-specific config
    const throttlingConfig = getServiceConfig(SERVICE_ID);
    connectionThrottlingManager.updateConfig(throttlingConfig);

    /**
     * Throttled connection function that implements debouncing and state checking
     * Requirements: 1.1, 3.1, 3.3
     */
    const throttledConnect = async (): Promise<void> => {
        // Skip if throttling is disabled
        if (!isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            return proposalWebSocketService.connect();
        }

        // Check connection state first (requirement 3.1)
        if (!connectionStateChecker.canConnect(SERVICE_ID)) {
            if (isThrottlingFeatureEnabled('ENABLE_THROTTLING_DEBUG_LOGS')) {
                console.log('ProposalWebSocket: Connection attempt skipped - already connected or throttled');
            }
            return;
        }

        // Use debounced connection (requirement 1.1, 3.3)
        return connectionThrottlingManager.debounceConnection(
            SERVICE_ID,
            async () => {
                try {
                    await proposalWebSocketService.connect();
                    // Update connection state on successful connection
                    connectionStateChecker.setConnectionState(SERVICE_ID, true);

                    if (isThrottlingFeatureEnabled('ENABLE_THROTTLING_DEBUG_LOGS')) {
                        console.log('ProposalWebSocket: Connection established successfully');
                    }
                } catch (error) {
                    // Keep connection state as disconnected on failure
                    connectionStateChecker.setConnectionState(SERVICE_ID, false);
                    throw error;
                }
            }
        );
    };

    // Initialize WebSocket service and event listeners
    const initializeWebSocket = () => {
        if (isInitialized) return;

        // Connection event handlers with state tracking
        proposalWebSocketService.on('connected', () => {
            console.log('Proposal WebSocket connected');
            // Update connection state (requirement 3.1)
            connectionStateChecker.setConnectionState(SERVICE_ID, true);
            // Reset throttling tracking on successful connection
            connectionThrottlingManager.resetConnectionTracking(SERVICE_ID);
        });

        proposalWebSocketService.on('disconnected', () => {
            console.log('Proposal WebSocket disconnected');
            // Update connection state (requirement 3.1)
            connectionStateChecker.setConnectionState(SERVICE_ID, false);
        });

        proposalWebSocketService.on('error', (error) => {
            console.error('Proposal WebSocket error:', error);
            // Update connection state on error (requirement 3.1)
            connectionStateChecker.setConnectionState(SERVICE_ID, false);
        });

        // Proposal status update handlers
        proposalWebSocketService.on('proposal_status_update', (statusUpdate) => {
            const { proposalId, status, respondedBy, respondedAt, rejectionReason } = statusUpdate;

            const state = store.getState();
            const existingProposal = state.proposals.proposalHistory.find((p: any) => p.id === proposalId);

            if (existingProposal) {
                const updatedProposal = {
                    ...existingProposal,
                    status: status as any,
                    respondedAt: respondedAt ? new Date(respondedAt) : undefined,
                    rejectionReason,
                    updatedAt: new Date(),
                };

                store.dispatch(updateProposal(updatedProposal));
                store.dispatch(updateLastUpdateTime());

                // Handle acceptance/rejection completion
                const activeOperation = state.proposalAcceptance.activeOperations[proposalId];
                if (activeOperation?.loading) {
                    // Create a mock result for completion
                    const mockResult = {
                        response: {
                            id: `response-${Date.now()}`,
                            proposalId,
                            responderId: respondedBy || '',
                            action: status as 'accept' | 'reject',
                            reason: rejectionReason,
                            blockchainTransactionId: `blockchain-tx-${Date.now()}`,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                        proposal: updatedProposal,
                        blockchainTransaction: {
                            transactionId: `blockchain-tx-${Date.now()}`,
                            consensusTimestamp: new Date().toISOString(),
                        },
                    };

                    store.dispatch(completeProposalOperation({ proposalId, result: mockResult }));
                    store.dispatch(removeOptimisticUpdate(proposalId));
                }
            }
        });

        // Specific acceptance handler
        proposalWebSocketService.on('proposal_accepted', (statusUpdate) => {
            console.log('Proposal accepted via WebSocket:', statusUpdate);
            // The general status update handler above will handle the state update
        });

        // Specific rejection handler
        proposalWebSocketService.on('proposal_rejected', (statusUpdate) => {
            console.log('Proposal rejected via WebSocket:', statusUpdate);
            // The general status update handler above will handle the state update
        });

        // Payment update handler
        proposalWebSocketService.on('proposal_payment_update', (paymentUpdate) => {
            const { proposalId, paymentTransaction } = paymentUpdate;

            const state = store.getState();
            const existingProposal = state.proposals.proposalHistory.find((p: any) => p.id === proposalId);

            if (existingProposal) {
                const updatedProposal = {
                    ...existingProposal,
                    paymentStatus: paymentTransaction.status,
                    paymentTransactionId: paymentTransaction.id,
                    updatedAt: new Date(),
                };

                store.dispatch(updateProposal(updatedProposal));
                store.dispatch(updateLastUpdateTime());
            }
        });

        // Blockchain update handler
        proposalWebSocketService.on('proposal_blockchain_update', (blockchainUpdate) => {
            const { proposalId, blockchainTransaction } = blockchainUpdate;

            const state = store.getState();
            const existingProposal = state.proposals.proposalHistory.find((p: any) => p.id === proposalId);

            if (existingProposal) {
                const updatedProposal = {
                    ...existingProposal,
                    blockchain: {
                        ...existingProposal.blockchain,
                        responseTransactionId: blockchainTransaction.transactionId,
                    },
                    updatedAt: new Date(),
                };

                store.dispatch(updateProposal(updatedProposal));
                store.dispatch(updateLastUpdateTime());
            }
        });

        isInitialized = true;
    };

    // Subscribe to user proposals when user changes with connection check
    const subscribeToUserProposals = (userId: string) => {
        if (currentUserId !== userId) {
            if (currentUserId) {
                proposalWebSocketService.unsubscribeFromUserProposals([currentUserId]);
            }

            currentUserId = userId;

            // Ensure connection before subscribing (requirement 3.1)
            if (connectionStateChecker.isConnected(SERVICE_ID)) {
                proposalWebSocketService.subscribeToCurrentUserProposals(userId);
            } else {
                // Attempt throttled connection then subscribe
                throttledConnect().then(() => {
                    proposalWebSocketService.subscribeToCurrentUserProposals(userId);
                }).catch((error) => {
                    if (isThrottlingFeatureEnabled('ENABLE_THROTTLING_DEBUG_LOGS')) {
                        console.error('ProposalWebSocket: Failed to connect for user subscription:', error);
                    }
                });
            }
        }
    };

    // Subscribe to specific proposals with connection check
    const subscribeToProposals = (proposalIds: string[]) => {
        if (proposalIds.length > 0) {
            // Ensure connection before subscribing (requirement 3.1)
            if (connectionStateChecker.isConnected(SERVICE_ID)) {
                proposalWebSocketService.subscribeToProposals(proposalIds);
            } else {
                // Attempt throttled connection then subscribe
                throttledConnect().then(() => {
                    proposalWebSocketService.subscribeToProposals(proposalIds);
                }).catch((error) => {
                    if (isThrottlingFeatureEnabled('ENABLE_THROTTLING_DEBUG_LOGS')) {
                        console.error('ProposalWebSocket: Failed to connect for proposal subscription:', error);
                    }
                });
            }
        }
    };

    return (next) => (action) => {
        // Initialize WebSocket service on first action
        if (!isInitialized) {
            initializeWebSocket();
        }

        // Handle auth state changes
        if (action.type === 'auth/setUser' && action.payload?.id) {
            subscribeToUserProposals(action.payload.id);
        }

        if (action.type === 'auth/logout') {
            proposalWebSocketService.unsubscribeFromAll();
            currentUserId = null;
        }

        // Handle proposal data loading
        if (action.type === 'proposals/setProposalHistory') {
            const proposals = action.payload.proposals;
            if (proposals && proposals.length > 0) {
                const proposalIds = proposals.map((p: any) => p.id);
                subscribeToProposals(proposalIds);
            }
        }

        // Handle new proposal creation
        if (action.type === 'proposals/addProposal') {
            const proposal = action.payload;
            if (proposal?.id) {
                subscribeToProposals([proposal.id]);
            }
        }

        // Handle proposal acceptance/rejection operations with throttling
        if (action.type?.startsWith('proposalAcceptance/')) {
            // Use throttled connection instead of direct connect (requirement 1.1, 3.3)
            throttledConnect().catch((error) => {
                if (isThrottlingFeatureEnabled('ENABLE_THROTTLING_DEBUG_LOGS')) {
                    console.error('ProposalWebSocket: Throttled connection failed:', error);
                }
            });
        }

        // Handle specific proposal operations
        if (action.type === 'proposalAcceptance/startProposalOperation') {
            const { proposalId } = action.payload;
            subscribeToProposals([proposalId]);
        }

        // Pass action to next middleware/reducer
        const result = next(action);

        // Handle state persistence for offline support
        if (action.type?.includes('proposal')) {
            const state = store.getState();

            // Store proposal state using persistence utility
            import('../utils/proposalStatePersistence').then(({ ProposalStatePersistence }) => {
                ProposalStatePersistence.saveProposalState({
                    proposals: state.proposals.proposalHistory,
                    receivedProposals: state.proposals.receivedProposals,
                    sentProposals: state.proposals.sentProposals,
                    lastUpdateTime: state.proposals.lastUpdateTime,
                    optimisticUpdates: state.proposalAcceptance.optimisticUpdates,
                });
            }).catch(error => {
                console.warn('Failed to persist proposal state:', error);
            });
        }

        return result;
    };
};

/**
 * Initialize WebSocket connection and restore state from localStorage
 */
export const initializeProposalWebSocket = async (store: any) => {
    // Restore state from localStorage using persistence utility
    try {
        const { ProposalStatePersistence } = await import('../utils/proposalStatePersistence');

        // Validate and repair data if necessary
        ProposalStatePersistence.repairData();

        const storedState = ProposalStatePersistence.loadProposalState();
        if (storedState) {
            // Dispatch actions to restore state
            if (storedState.proposals?.length > 0) {
                store.dispatch({
                    type: 'proposals/setProposalHistory',
                    payload: {
                        proposals: storedState.proposals,
                        pagination: {
                            currentPage: 1,
                            totalPages: 1,
                            totalCount: storedState.proposals.length,
                            hasNext: false,
                            hasPrevious: false,
                        },
                    },
                });
            }

            // Restore received and sent proposals
            if (storedState.receivedProposals?.length > 0) {
                store.dispatch({
                    type: 'proposals/setReceivedProposals',
                    payload: storedState.receivedProposals,
                });
            }

            if (storedState.sentProposals?.length > 0) {
                store.dispatch({
                    type: 'proposals/setSentProposals',
                    payload: storedState.sentProposals,
                });
            }

            // Restore optimistic updates
            if (storedState.optimisticUpdates) {
                storedState.optimisticUpdates.acceptedProposals?.forEach((proposalId: string) => {
                    store.dispatch({ type: 'proposalAcceptance/addOptimisticAcceptance', payload: proposalId });
                });

                storedState.optimisticUpdates.rejectedProposals?.forEach((proposalId: string) => {
                    store.dispatch({ type: 'proposalAcceptance/addOptimisticRejection', payload: proposalId });
                });
            }
        }
    } catch (error) {
        console.warn('Failed to restore proposal state from localStorage:', error);
    }

    // Connect to WebSocket using throttled connection
    const throttledConnect = async (): Promise<void> => {
        // Skip if throttling is disabled
        if (!isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            return proposalWebSocketService.connect();
        }

        // Check connection state first
        if (!connectionStateChecker.canConnect('proposalWebSocketService')) {
            if (isThrottlingFeatureEnabled('ENABLE_THROTTLING_DEBUG_LOGS')) {
                console.log('ProposalWebSocket: Initial connection attempt skipped - already connected or throttled');
            }
            return;
        }

        // Use debounced connection
        return connectionThrottlingManager.debounceConnection(
            'proposalWebSocketService',
            async () => {
                try {
                    await proposalWebSocketService.connect();
                    connectionStateChecker.setConnectionState('proposalWebSocketService', true);
                } catch (error) {
                    connectionStateChecker.setConnectionState('proposalWebSocketService', false);
                    throw error;
                }
            }
        );
    };

    throttledConnect().catch(console.error);
};

/**
 * Cleanup WebSocket connections
 */
export const cleanupProposalWebSocket = () => {
    const SERVICE_ID = 'proposalWebSocketService';

    // Clear any pending throttled connections
    connectionThrottlingManager.clearDebounce(SERVICE_ID);

    // Reset connection state
    connectionStateChecker.resetConnectionState(SERVICE_ID);

    // Cleanup WebSocket service
    proposalWebSocketService.unsubscribeFromAll();
    proposalWebSocketService.disconnect();
};

export default proposalWebSocketMiddleware;