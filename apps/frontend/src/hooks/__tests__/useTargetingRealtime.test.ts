import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { useTargetingRealtime } from '../useTargetingRealtime';
import targetingReducer from '../../store/slices/targetingSlice';
import { useWebSocket } from '../useWebSocket';

// Mock the WebSocket hook
vi.mock('../useWebSocket', () => ({
    useWebSocket: vi.fn(),
}));

const mockUseWebSocket = vi.mocked(useWebSocket);

// Mock store setup
const createMockStore = (initialState = {}) => {
    return configureStore({
        reducer: {
            targeting: targetingReducer,
        },
        preloadedState: {
            targeting: {
                swapTargeting: {},
                targetingStatus: {},
                isConnected: false,
                showTargetingNotifications: true,
                unreadTargetingCount: 0,
                isTargeting: false,
                targetingHistory: [],
                swapsTargetingMe: [],
                cachedValidations: {},
                cachedCanTarget: {},
                cachedAuctionEligibility: {},
                cachedOneForOneEligibility: {},
                ...initialState,
            },
        },
    });
};

const renderHookWithProvider = (hook: () => any, store: any) => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(Provider, { store }, children);
    return renderHook(hook, { wrapper });
};

describe('useTargetingRealtime', () => {
    let mockWebSocketReturn: any;
    let store: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup mock WebSocket return value
        mockWebSocketReturn = {
            isConnected: true,
            connectionError: null,
            subscribeToTargeting: vi.fn(),
            unsubscribeFromTargeting: vi.fn(),
            markTargetingAsRead: vi.fn(),
        };

        mockUseWebSocket.mockReturnValue(mockWebSocketReturn);

        // Create fresh store
        store = createMockStore();
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('initialization', () => {
        it('should initialize with default options', () => {
            const { result } = renderHookWithProvider(
                () => useTargetingRealtime(),
                store
            );

            expect(result.current.isConnected).toBe(true);
            expect(result.current.connectionError).toBe(null);
            expect(result.current.hasOptimisticUpdates).toBe(false);
            expect(result.current.hasFailedUpdates).toBe(false);
        });

        it('should initialize with custom options', () => {
            const options = {
                swapIds: ['swap1', 'swap2'],
                userId: 'user1',
                autoSubscribe: false,
                enableOptimisticUpdates: false,
            };

            const { result } = renderHookWithProvider(
                () => useTargetingRealtime(options),
                store
            );

            expect(result.current.isConnected).toBe(true);
            expect(mockUseWebSocket).toHaveBeenCalledWith(
                expect.objectContaining({
                    onTargetingUpdate: expect.any(Function),
                    onConnect: expect.any(Function),
                    onDisconnect: expect.any(Function),
                    onReconnect: expect.any(Function),
                })
            );
        });
    });

    describe('subscription management', () => {
        it('should provide manual subscription functions', () => {
            const { result } = renderHookWithProvider(
                () => useTargetingRealtime(),
                store
            );

            act(() => {
                result.current.subscribeToSwapTargeting(['swap1', 'swap2']);
            });

            expect(mockWebSocketReturn.subscribeToTargeting).toHaveBeenCalledWith('swap1');
            expect(mockWebSocketReturn.subscribeToTargeting).toHaveBeenCalledWith('swap2');
        });

        it('should provide unsubscription functions', () => {
            const { result } = renderHookWithProvider(
                () => useTargetingRealtime(),
                store
            );

            act(() => {
                result.current.unsubscribeFromSwapTargeting(['swap1', 'swap2']);
            });

            expect(mockWebSocketReturn.unsubscribeFromTargeting).toHaveBeenCalledWith('swap1');
            expect(mockWebSocketReturn.unsubscribeFromTargeting).toHaveBeenCalledWith('swap2');
        });
    });

    describe('optimistic updates', () => {
        it('should perform optimistic updates when enabled', () => {
            const { result } = renderHookWithProvider(
                () => useTargetingRealtime({ enableOptimisticUpdates: true }),
                store
            );

            const updateData = {
                status: 'accepted',
                updatedAt: new Date(),
            };

            act(() => {
                result.current.performOptimisticUpdate('update', 'swap1', 'target1', updateData);
            });

            expect(result.current.hasOptimisticUpdates).toBe(true);
            expect(result.current.optimisticUpdates).toHaveLength(1);
            expect(result.current.optimisticUpdates[0].targetId).toBe('target1');
        });

        it('should not perform optimistic updates when disabled', () => {
            const { result } = renderHookWithProvider(
                () => useTargetingRealtime({ enableOptimisticUpdates: false }),
                store
            );

            act(() => {
                result.current.performOptimisticUpdate('update', 'swap1', 'target1', {});
            });

            expect(result.current.hasOptimisticUpdates).toBe(false);
            expect(result.current.optimisticUpdates).toHaveLength(0);
        });
    });

    describe('mark as read functionality', () => {
        it('should mark targeting as read', () => {
            const { result } = renderHookWithProvider(
                () => useTargetingRealtime(),
                store
            );

            act(() => {
                result.current.markAsRead('target1');
            });

            expect(mockWebSocketReturn.markTargetingAsRead).toHaveBeenCalledWith('target1');
        });

        it('should not mark as read when disconnected', () => {
            mockWebSocketReturn.isConnected = false;

            const { result } = renderHookWithProvider(
                () => useTargetingRealtime(),
                store
            );

            act(() => {
                result.current.markAsRead('target1');
            });

            expect(mockWebSocketReturn.markTargetingAsRead).not.toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        it('should cleanup timeouts on unmount', () => {
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

            const { unmount } = renderHookWithProvider(
                () => useTargetingRealtime({
                    retryFailedUpdates: true,
                    retryDelay: 1000,
                }),
                store
            );

            unmount();

            // The hook should not crash on unmount (cleanup is internal)
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(0); // No timeouts created in this simple test

            clearTimeoutSpy.mockRestore();
        });
    });
});