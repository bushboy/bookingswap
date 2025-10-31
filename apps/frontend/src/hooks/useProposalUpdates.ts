import { useEffect, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { proposalWebSocketService, ProposalStatusUpdate, ProposalPaymentUpdate, ProposalBlockchainUpdate } from '../services/proposalWebSocketService';
import {
    updateProposalStatusFromWebSocket,
    setWebSocketConnectionStatus,
} from '../store/slices/proposalAcceptanceSlice';
import { logger } from '@/utils/logger';

/**
 * Options for the useProposalUpdates hook
 */
export interface UseProposalUpdatesOptions {
    /** User ID to subscribe to proposal updates for */
    userId?: string;

    /** Specific proposal IDs to subscribe to */
    proposalIds?: string[];

    /** Whether to automatically connect on mount */
    autoConnect?: boolean;

    /** Custom handler for proposal status updates */
    onProposalStatusUpdate?: (update: ProposalStatusUpdate) => void;

    /** Custom handler for payment updates */
    onPaymentUpdate?: (update: ProposalPaymentUpdate) => void;

    /** Custom handler for blockchain updates */
    onBlockchainUpdate?: (update: ProposalBlockchainUpdate) => void;

    /** Custom handler for connection events */
    onConnectionChange?: (isConnected: boolean) => void;

    /** Custom handler for connection errors */
    onConnectionError?: (error: any) => void;
}

/**
 * Hook for managing real-time proposal status updates via WebSocket
 * Implements requirements 3.1, 3.2, 3.3, 3.4 from the specification
 */
export const useProposalUpdates = (options: UseProposalUpdatesOptions = {}) => {
    const dispatch = useDispatch<AppDispatch>();
    const { token } = useAuth();

    const {
        userId,
        proposalIds = [],
        autoConnect = true,
        onProposalStatusUpdate,
        onPaymentUpdate,
        onBlockchainUpdate,
        onConnectionChange,
        onConnectionError,
    } = options;

    // Track connection state
    const connectionStateRef = useRef<{
        isConnected: boolean;
        isConnecting: boolean;
        retryCount: number;
    }>({
        isConnected: false,
        isConnecting: false,
        retryCount: 0,
    });

    /**
     * Handle proposal status updates from WebSocket
     * Requirements: 3.2, 3.3
     */
    const handleProposalStatusUpdate = useCallback((update: ProposalStatusUpdate) => {
        logger.info('Received proposal status update', {
            proposalId: update.proposalId,
            status: update.status
        });

        try {
            // Update Redux store with the real-time status update
            dispatch(updateProposalStatusFromWebSocket({
                proposalId: update.proposalId,
                status: update.status,
                respondedBy: update.respondedBy,
                respondedAt: update.respondedAt,
                rejectionReason: update.rejectionReason,
                paymentStatus: update.paymentStatus,
            }));

            // Call custom handler if provided
            onProposalStatusUpdate?.(update);

        } catch (error) {
            logger.error('Error handling proposal status update', {
                error,
                proposalId: update.proposalId
            });
        }
    }, [dispatch, onProposalStatusUpdate]);

    /**
     * Handle payment updates from WebSocket
     * Requirements: 3.2, 3.3
     */
    const handlePaymentUpdate = useCallback((update: ProposalPaymentUpdate) => {
        logger.info('Received payment update', {
            proposalId: update.proposalId,
            status: update.paymentTransaction.status
        });

        try {
            // Call custom handler if provided
            onPaymentUpdate?.(update);

            // Note: Payment updates don't directly update proposal acceptance state
            // They are handled by the payment-specific Redux slices

        } catch (error) {
            logger.error('Error handling payment update', {
                error,
                proposalId: update.proposalId
            });
        }
    }, [onPaymentUpdate]);

    /**
     * Handle blockchain updates from WebSocket
     * Requirements: 3.2, 3.3
     */
    const handleBlockchainUpdate = useCallback((update: ProposalBlockchainUpdate) => {
        logger.info('Received blockchain update', {
            proposalId: update.proposalId,
            transactionId: update.blockchainTransaction.transactionId
        });

        try {
            // Call custom handler if provided
            onBlockchainUpdate?.(update);

            // Note: Blockchain updates don't directly update proposal acceptance state
            // They are handled by blockchain-specific Redux slices

        } catch (error) {
            logger.error('Error handling blockchain update', {
                error,
                proposalId: update.proposalId
            });
        }
    }, [onBlockchainUpdate]);

    /**
     * Handle WebSocket connection events
     * Requirements: 3.4
     */
    const handleConnectionChange = useCallback((isConnected: boolean) => {
        connectionStateRef.current.isConnected = isConnected;
        connectionStateRef.current.isConnecting = false;

        if (isConnected) {
            connectionStateRef.current.retryCount = 0;
        }

        // Update Redux store with connection status
        dispatch(setWebSocketConnectionStatus({ isConnected }));

        logger.info('Proposal WebSocket connection changed', { isConnected });
        onConnectionChange?.(isConnected);
    }, [dispatch, onConnectionChange]);

    /**
     * Handle WebSocket connection errors with retry logic
     * Requirements: 3.4
     */
    const handleConnectionError = useCallback((error: any) => {
        connectionStateRef.current.isConnecting = false;
        connectionStateRef.current.retryCount++;

        // Update Redux store with connection error
        dispatch(setWebSocketConnectionStatus({
            isConnected: false,
            error: error?.message || 'Connection error'
        }));

        logger.error('Proposal WebSocket connection error', {
            error,
            retryCount: connectionStateRef.current.retryCount
        });

        onConnectionError?.(error);

        // Implement exponential backoff retry logic
        if (connectionStateRef.current.retryCount <= 5) {
            const retryDelay = Math.min(1000 * Math.pow(2, connectionStateRef.current.retryCount - 1), 30000);

            setTimeout(() => {
                if (token && !connectionStateRef.current.isConnected) {
                    logger.info('Retrying proposal WebSocket connection', {
                        attempt: connectionStateRef.current.retryCount,
                        delay: retryDelay
                    });
                    connectToProposalUpdates();
                }
            }, retryDelay);
        }
    }, [dispatch, onConnectionError, token]);

    /**
     * Connect to proposal WebSocket updates
     * Requirements: 3.1, 3.4
     */
    const connectToProposalUpdates = useCallback(async () => {
        if (!token || connectionStateRef.current.isConnecting || connectionStateRef.current.isConnected) {
            return;
        }

        try {
            connectionStateRef.current.isConnecting = true;

            // Set up event listeners
            proposalWebSocketService.on('proposal_status_update', handleProposalStatusUpdate);
            proposalWebSocketService.on('proposal_accepted', handleProposalStatusUpdate);
            proposalWebSocketService.on('proposal_rejected', handleProposalStatusUpdate);
            proposalWebSocketService.on('proposal_payment_update', handlePaymentUpdate);
            proposalWebSocketService.on('proposal_blockchain_update', handleBlockchainUpdate);
            proposalWebSocketService.on('connected', () => handleConnectionChange(true));
            proposalWebSocketService.on('disconnected', () => handleConnectionChange(false));
            proposalWebSocketService.on('error', handleConnectionError);

            // Connect to WebSocket service
            await proposalWebSocketService.connect();

            // Subscribe to user proposals if userId provided
            if (userId) {
                proposalWebSocketService.subscribeToCurrentUserProposals(userId);
            }

            // Subscribe to specific proposals if provided
            if (proposalIds.length > 0) {
                proposalWebSocketService.subscribeToProposals(proposalIds);
            }

            logger.info('Connected to proposal updates', { userId, proposalIds });

        } catch (error) {
            logger.error('Failed to connect to proposal updates', { error });
            handleConnectionError(error);
        }
    }, [
        token,
        userId,
        proposalIds,
        handleProposalStatusUpdate,
        handlePaymentUpdate,
        handleBlockchainUpdate,
        handleConnectionChange,
        handleConnectionError
    ]);

    /**
     * Disconnect from proposal WebSocket updates
     */
    const disconnectFromProposalUpdates = useCallback(() => {
        try {
            // Remove event listeners
            proposalWebSocketService.removeAllListeners('proposal_status_update');
            proposalWebSocketService.removeAllListeners('proposal_accepted');
            proposalWebSocketService.removeAllListeners('proposal_rejected');
            proposalWebSocketService.removeAllListeners('proposal_payment_update');
            proposalWebSocketService.removeAllListeners('proposal_blockchain_update');
            proposalWebSocketService.removeAllListeners('connected');
            proposalWebSocketService.removeAllListeners('disconnected');
            proposalWebSocketService.removeAllListeners('error');

            // Unsubscribe from all updates
            proposalWebSocketService.unsubscribeFromAll();

            // Disconnect from WebSocket service
            proposalWebSocketService.disconnect();

            connectionStateRef.current.isConnected = false;
            connectionStateRef.current.isConnecting = false;
            connectionStateRef.current.retryCount = 0;

            logger.info('Disconnected from proposal updates');

        } catch (error) {
            logger.error('Error disconnecting from proposal updates', { error });
        }
    }, []);

    /**
     * Subscribe to additional proposal IDs
     */
    const subscribeToProposals = useCallback((newProposalIds: string[]) => {
        if (connectionStateRef.current.isConnected && newProposalIds.length > 0) {
            proposalWebSocketService.subscribeToProposals(newProposalIds);
            logger.info('Subscribed to additional proposals', { proposalIds: newProposalIds });
        }
    }, []);

    /**
     * Unsubscribe from specific proposal IDs
     */
    const unsubscribeFromProposals = useCallback((proposalIdsToRemove: string[]) => {
        if (connectionStateRef.current.isConnected && proposalIdsToRemove.length > 0) {
            proposalWebSocketService.unsubscribeFromProposals(proposalIdsToRemove);
            logger.info('Unsubscribed from proposals', { proposalIds: proposalIdsToRemove });
        }
    }, []);

    /**
     * Manually trigger reconnection
     */
    const reconnect = useCallback(() => {
        disconnectFromProposalUpdates();
        setTimeout(() => {
            connectToProposalUpdates();
        }, 1000);
    }, [disconnectFromProposalUpdates, connectToProposalUpdates]);

    // Auto-connect on mount if enabled and token is available
    useEffect(() => {
        if (autoConnect && token) {
            connectToProposalUpdates();
        }

        return () => {
            disconnectFromProposalUpdates();
        };
    }, [autoConnect, token, connectToProposalUpdates, disconnectFromProposalUpdates]);

    // Handle token changes
    useEffect(() => {
        if (!token && connectionStateRef.current.isConnected) {
            disconnectFromProposalUpdates();
        } else if (token && autoConnect && !connectionStateRef.current.isConnected && !connectionStateRef.current.isConnecting) {
            connectToProposalUpdates();
        }
    }, [token, autoConnect, connectToProposalUpdates, disconnectFromProposalUpdates]);

    // Handle userId changes
    useEffect(() => {
        if (userId && connectionStateRef.current.isConnected) {
            proposalWebSocketService.subscribeToCurrentUserProposals(userId);
        }
    }, [userId]);

    // Handle proposalIds changes
    useEffect(() => {
        if (proposalIds.length > 0 && connectionStateRef.current.isConnected) {
            proposalWebSocketService.subscribeToProposals(proposalIds);
        }
    }, [proposalIds]);

    return {
        // Connection state
        isConnected: connectionStateRef.current.isConnected,
        isConnecting: connectionStateRef.current.isConnecting,
        retryCount: connectionStateRef.current.retryCount,

        // Connection management
        connect: connectToProposalUpdates,
        disconnect: disconnectFromProposalUpdates,
        reconnect,

        // Subscription management
        subscribeToProposals,
        unsubscribeFromProposals,

        // Service status
        getSubscriptionStatus: () => proposalWebSocketService.getSubscriptionStatus(),
    };
};

export default useProposalUpdates;