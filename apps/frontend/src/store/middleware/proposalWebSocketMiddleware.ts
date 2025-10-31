import { Middleware } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { proposalWebSocketService } from '../../services/proposalWebSocketService';
import {
    updateProposal,
    updateLastUpdateTime,
} from '../slices/proposalSlice';
import {
    completeProposalOperation,
    removeOptimisticUpdate,
} from '../slices/proposalAcceptanceSlice';

/**
 * WebSocket middleware for handling real-time proposal updates
 * Implements requirements 1.5, 2.5, 7.1, 7.5 from the design document
 */
export const proposalWebSocketMiddleware: Middleware = (store) => {
    let isInitialized = false;
    let currentUserId: string | null = null;

    // Initialize WebSocket service and event listeners
    const initializeWebSocket = () => {
        if (isInitialized) return;

        // Connection event handlers
        proposalWebSocketService.on('connected', () => {
            console.log('Proposal WebSocket connected');
        });

        proposalWebSocketService.on('disconnected', () => {
            console.log('Proposal WebSocket disconnected');
        });

        proposalWebSocketService.on('error', (error) => {
            console.error('Proposal WebSocket error:', error);
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

    // Subscribe to user proposals when user changes
    const subscribeToUserProposals = (userId: string) => {
        if (currentUserId !== userId) {
            if (currentUserId) {
                proposalWebSocketService.unsubscribeFromUserProposals([currentUserId]);
            }

            currentUserId = userId;
            proposalWebSocketService.subscribeToCurrentUserProposals(userId);
        }
    };

    // Subscribe to specific proposals
    const subscribeToProposals = (proposalIds: string[]) => {
        if (proposalIds.length > 0) {
            proposalWebSocketService.subscribeToProposals(proposalIds);
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

        // Handle proposal acceptance/rejection operations
        if (action.type?.startsWith('proposalAcceptance/')) {
            // Connect to WebSocket if not already connected
            if (!proposalWebSocketService.isConnected()) {
                proposalWebSocketService.connect().catch(console.error);
            }
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

    // Connect to WebSocket
    proposalWebSocketService.connect().catch(console.error);
};

/**
 * Cleanup WebSocket connections
 */
export const cleanupProposalWebSocket = () => {
    proposalWebSocketService.unsubscribeFromAll();
    proposalWebSocketService.disconnect();
};

export default proposalWebSocketMiddleware;