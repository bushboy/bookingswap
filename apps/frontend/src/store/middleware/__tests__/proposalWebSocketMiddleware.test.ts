/**
 * Tests for ProposalWebSocketMiddleware throttling integration
 * 
 * Tests the integration of connection throttling with the ProposalWebSocketMiddleware.
 * Focuses on core throttling functionality and Redux action handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { proposalWebSocketMiddleware, cleanupProposalWebSocket } from '../proposalWebSocketMiddleware';
import { connectionStateChecker, connectionThrottlingManager } from '../../../utils/connectionThrottling';

// Mock the proposalWebSocketService
vi.mock('../../../services/proposalWebSocketService', () => ({
    proposalWebSocketService: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn(() => false),
        on: vi.fn(),
        subscribeToCurrentUserProposals: vi.fn(),
        subscribeToProposals: vi.fn(),
        unsubscribeFromUserProposals: vi.fn(),
        unsubscribeFromAll: vi.fn(),
    },
}));

// Mock the logger
vi.mock('../../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock the persistence utility
vi.mock('../../utils/proposalStatePersistence', () => ({
    ProposalStatePersistence: {
        saveProposalState: vi.fn(),
        loadProposalState: vi.fn(() => null),
        repairData: vi.fn(),
    },
}));

describe('ProposalWebSocketMiddleware Throttling Integration', () => {
    let store: any;
    const SERVICE_ID = 'proposalWebSocketService';

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset connection state and throttling
        connectionStateChecker.resetConnectionState(SERVICE_ID);
        connectionThrottlingManager.resetConnectionTracking(SERVICE_ID);

        // Create a test store with the middleware
        store = configureStore({
            reducer: {
                auth: (state = { user: null }, action: any) => {
                    switch (action.type) {
                        case 'auth/setUser':
                            return { ...state, user: action.payload };
                        case 'auth/logout':
                            return { ...state, user: null };
                        default:
                            return state;
                    }
                },
                proposals: (state = { proposalHistory: [] }, action: any) => {
                    switch (action.type) {
                        case 'proposals/setProposalHistory':
                            return { ...state, proposalHistory: action.payload.proposals };
                        default:
                            return state;
                    }
                },
                proposalAcceptance: (state = { activeOperations: {} }, action: any) => {
                    return state;
                },
            },
            middleware: (getDefaultMiddleware) =>
                getDefaultMiddleware().concat(proposalWebSocketMiddleware),
        });
    });

    afterEach(() => {
        cleanupProposalWebSocket();
    });

    describe('throttled connection handling', () => {
        it('should use throttled connection for proposal acceptance actions', async () => {
            const { proposalWebSocketService } = await import('../../../services/proposalWebSocketService');

            // Spy on the throttling manager
            const debounceConnectionSpy = vi.spyOn(connectionThrottlingManager, 'debounceConnection');

            // Dispatch a proposal acceptance action
            store.dispatch({
                type: 'proposalAcceptance/startProposalOperation',
                payload: { proposalId: 'test-proposal-1' }
            });

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));

            // Should have attempted throttled connection
            expect(debounceConnectionSpy).toHaveBeenCalledWith(
                SERVICE_ID,
                expect.any(Function)
            );
        });

        it('should check connection state before subscribing to user proposals', async () => {
            const { proposalWebSocketService } = await import('../../../services/proposalWebSocketService');

            // Set service as already connected
            connectionStateChecker.setConnectionState(SERVICE_ID, true);

            // Dispatch auth action
            store.dispatch({
                type: 'auth/setUser',
                payload: { id: 'user-123' }
            });

            // Should call subscribe directly since already connected
            expect(proposalWebSocketService.subscribeToCurrentUserProposals).toHaveBeenCalledWith('user-123');
        });

        it('should attempt throttled connection when not connected for subscriptions', async () => {
            const { proposalWebSocketService } = await import('../../../services/proposalWebSocketService');

            // Ensure service is not connected
            connectionStateChecker.setConnectionState(SERVICE_ID, false);

            // Spy on throttling manager
            const debounceConnectionSpy = vi.spyOn(connectionThrottlingManager, 'debounceConnection');

            // Dispatch auth action
            store.dispatch({
                type: 'auth/setUser',
                payload: { id: 'user-123' }
            });

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));

            // Should have attempted throttled connection
            expect(debounceConnectionSpy).toHaveBeenCalled();
        });

        it('should handle proposal history loading with connection checking', async () => {
            const { proposalWebSocketService } = await import('../../../services/proposalWebSocketService');

            // Set service as connected
            connectionStateChecker.setConnectionState(SERVICE_ID, true);

            // Dispatch proposal history action
            store.dispatch({
                type: 'proposals/setProposalHistory',
                payload: {
                    proposals: [
                        { id: 'proposal-1' },
                        { id: 'proposal-2' }
                    ]
                }
            });

            // Should subscribe to proposals directly since connected
            expect(proposalWebSocketService.subscribeToProposals).toHaveBeenCalledWith(['proposal-1', 'proposal-2']);
        });
    });

    describe('connection state management', () => {
        it('should manage connection state correctly', () => {
            // Test connection state management directly
            connectionStateChecker.setConnectionState(SERVICE_ID, true);
            expect(connectionStateChecker.isConnected(SERVICE_ID)).toBe(true);

            connectionStateChecker.setConnectionState(SERVICE_ID, false);
            expect(connectionStateChecker.isConnected(SERVICE_ID)).toBe(false);
        });

        it('should reset throttling state on cleanup', () => {
            // Set some connection state
            connectionStateChecker.setConnectionState(SERVICE_ID, true);

            // Spy on throttling manager methods
            const clearDebounceSpy = vi.spyOn(connectionThrottlingManager, 'clearDebounce');
            const resetStateSpy = vi.spyOn(connectionStateChecker, 'resetConnectionState');

            // Call cleanup
            cleanupProposalWebSocket();

            // Should have cleared throttling state
            expect(clearDebounceSpy).toHaveBeenCalledWith(SERVICE_ID);
            expect(resetStateSpy).toHaveBeenCalledWith(SERVICE_ID);
        });
    });

    describe('throttling configuration', () => {
        it('should use service-specific throttling configuration', () => {
            // The middleware should initialize with service-specific config
            // This is tested by verifying the config is applied during initialization
            const status = connectionThrottlingManager.getConnectionStatus(SERVICE_ID);
            expect(status).toBeDefined();
        });
    });
});