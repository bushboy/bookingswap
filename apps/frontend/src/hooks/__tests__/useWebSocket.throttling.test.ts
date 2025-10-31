/**
 * Test for useWebSocket hook throttling implementation
 * Verifies that the connection loop fixes are working correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useWebSocket } from '../useWebSocket';
import { connectionThrottlingManager, connectionStateChecker } from '../../utils/connectionThrottling';
import React from 'react';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
    io: vi.fn(() => ({
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        disconnect: vi.fn(),
        connected: false,
    })),
}));

// Mock useWebSocketHealth
vi.mock('../useWebSocketHealth', () => ({
    useWebSocketHealth: vi.fn(() => ({
        health: { status: 'disconnected' },
        manualReconnect: vi.fn(),
        resetReconnectAttempts: vi.fn(),
    })),
}));

// Create a mock store
const createMockStore = () => configureStore({
    reducer: {
        auth: (state = { isAuthenticated: true }, action) => state,
    },
});

// Mock localStorage
const mockLocalStorage = {
    getItem: vi.fn(() => 'mock-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
});

describe('useWebSocket Throttling Implementation', () => {
    let store: ReturnType<typeof createMockStore>;

    beforeEach(() => {
        store = createMockStore();
        vi.clearAllMocks();
        // Reset throttling state
        connectionThrottlingManager.resetConnectionTracking('useWebSocket');
        connectionStateChecker.resetConnectionState('useWebSocket');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const renderUseWebSocket = (options = {}) => {
        return renderHook(() => useWebSocket(options), {
            wrapper: ({ children }: { children: React.ReactNode }) =>
                React.createElement(Provider, { store }, children),
        });
    };

    it('should use throttling manager for connection attempts', () => {
        const debounceConnectionSpy = vi.spyOn(connectionThrottlingManager, 'debounceConnection');

        renderUseWebSocket();

        // Verify that debounceConnection was called
        expect(debounceConnectionSpy).toHaveBeenCalledWith(
            'useWebSocket',
            expect.any(Function),
            expect.any(Number)
        );
    });

    it('should use connection state checker', () => {
        const canConnectSpy = vi.spyOn(connectionStateChecker, 'canConnect');

        renderUseWebSocket();

        // The canConnect method should be called during connection setup
        expect(canConnectSpy).toHaveBeenCalledWith('useWebSocket');
    });

    it('should not use forceNew option in socket connection', () => {
        const ioMock = vi.mocked(require('socket.io-client').io);

        renderUseWebSocket();

        // Verify that io was called without forceNew: true
        expect(ioMock).toHaveBeenCalled();
        const connectionOptions = ioMock.mock.calls[0]?.[1];
        expect(connectionOptions?.forceNew).toBeUndefined();
    });

    it('should clean up throttling state on unmount', () => {
        const clearDebounceSpy = vi.spyOn(connectionThrottlingManager, 'clearDebounce');
        const setConnectionStateSpy = vi.spyOn(connectionStateChecker, 'setConnectionState');

        const { unmount } = renderUseWebSocket();

        unmount();

        // Verify cleanup was called
        expect(clearDebounceSpy).toHaveBeenCalledWith('useWebSocket');
        expect(setConnectionStateSpy).toHaveBeenCalledWith('useWebSocket', false);
    });
});