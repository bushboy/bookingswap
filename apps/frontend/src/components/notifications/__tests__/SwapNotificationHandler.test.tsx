import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SwapNotificationHandler } from '../SwapNotificationHandler';
import notificationSlice from '../../../store/slices/notificationSlice';
import authSlice from '../../../store/slices/authSlice';

// Mock the WebSocket hook
jest.mock('../../../hooks/useSwapWebSocket', () => ({
  useSwapWebSocket: jest.fn(() => ({
    isConnected: true,
  })),
}));

// Mock browser Notification API
Object.defineProperty(window, 'Notification', {
  writable: true,
  value: jest.fn().mockImplementation((title, options) => ({
    title,
    ...options,
    close: jest.fn(),
    onclick: null,
  })),
});

Object.defineProperty(Notification, 'permission', {
  writable: true,
  value: 'granted',
});

Object.defineProperty(Notification, 'requestPermission', {
  writable: true,
  value: jest.fn().mockResolvedValue('granted'),
});

// Mock AudioContext
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    createOscillator: jest.fn(() => ({
      connect: jest.fn(),
      frequency: {
        setValueAtTime: jest.fn(),
      },
      start: jest.fn(),
      stop: jest.fn(),
    })),
    createGain: jest.fn(() => ({
      connect: jest.fn(),
      gain: {
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
    })),
    destination: {},
    currentTime: 0,
  })),
});

const createTestStore = () => {
  return configureStore({
    reducer: {
      notifications: notificationSlice,
      auth: authSlice,
    },
    preloadedState: {
      auth: {
        user: { id: 'user-1', email: 'test@example.com' },
        token: 'test-token',
        isAuthenticated: true,
        loading: false,
        error: null,
      },
      notifications: {
        notifications: [],
        unreadCount: 0,
        total: 0,
        loading: false,
        error: null,
        hasMore: false,
      },
    },
  });
};

describe('SwapNotificationHandler', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  it('renders children without crashing', () => {
    render(
      <Provider store={store}>
        <SwapNotificationHandler>
          <div data-testid="child-content">Test Content</div>
        </SwapNotificationHandler>
      </Provider>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('initializes WebSocket connection for swap updates', () => {
    const { useSwapWebSocket } = require('../../../hooks/useSwapWebSocket');

    render(
      <Provider store={store}>
        <SwapNotificationHandler>
          <div>Test</div>
        </SwapNotificationHandler>
      </Provider>
    );

    expect(useSwapWebSocket).toHaveBeenCalledWith({
      onSwapUpdate: expect.any(Function),
      onProposalReceived: expect.any(Function),
    });
  });

  it('handles swap update notifications', () => {
    const { useSwapWebSocket } = require('../../../hooks/useSwapWebSocket');
    let swapUpdateHandler: Function;

    useSwapWebSocket.mockImplementation(({ onSwapUpdate }: any) => {
      swapUpdateHandler = onSwapUpdate;
      return { isConnected: true };
    });

    render(
      <Provider store={store}>
        <SwapNotificationHandler>
          <div>Test</div>
        </SwapNotificationHandler>
      </Provider>
    );

    // Simulate swap update
    const mockEvent = {
      id: 'event-1',
      type: 'accepted',
      timestamp: new Date(),
      data: { newStatus: 'accepted' },
    };

    swapUpdateHandler('swap-1', mockEvent);

    // Check if notification was added to store
    const state = store.getState();
    expect(state.notifications.notifications).toHaveLength(1);
    expect(state.notifications.notifications[0].type).toBe('swap_accepted');
  });

  it('handles proposal received notifications', () => {
    const { useSwapWebSocket } = require('../../../hooks/useSwapWebSocket');
    let proposalHandler: Function;

    useSwapWebSocket.mockImplementation(({ onProposalReceived }: any) => {
      proposalHandler = onProposalReceived;
      return { isConnected: true };
    });

    render(
      <Provider store={store}>
        <SwapNotificationHandler>
          <div>Test</div>
        </SwapNotificationHandler>
      </Provider>
    );

    // Simulate proposal received
    proposalHandler('swap-1', 'proposal-1');

    // Check if notification was added to store
    const state = store.getState();
    expect(state.notifications.notifications).toHaveLength(1);
    expect(state.notifications.notifications[0].type).toBe('swap_proposal');
    expect(state.notifications.notifications[0].data).toEqual({
      swapId: 'swap-1',
      proposalId: 'proposal-1',
    });
  });

  it('shows browser notification when permission is granted', () => {
    const { useSwapWebSocket } = require('../../../hooks/useSwapWebSocket');
    let swapUpdateHandler: Function;

    useSwapWebSocket.mockImplementation(({ onSwapUpdate }: any) => {
      swapUpdateHandler = onSwapUpdate;
      return { isConnected: true };
    });

    render(
      <Provider store={store}>
        <SwapNotificationHandler>
          <div>Test</div>
        </SwapNotificationHandler>
      </Provider>
    );

    // Simulate swap update
    const mockEvent = {
      id: 'event-1',
      type: 'accepted',
      timestamp: new Date(),
      data: { newStatus: 'accepted' },
    };

    swapUpdateHandler('swap-1', mockEvent);

    // Check if browser notification was created
    expect(window.Notification).toHaveBeenCalledWith(
      'Swap Accepted',
      expect.objectContaining({
        body: 'Your swap proposal has been accepted',
        tag: 'swap-swap-1',
      })
    );
  });

  it('plays notification sound for different event types', () => {
    const { useSwapWebSocket } = require('../../../hooks/useSwapWebSocket');
    let proposalHandler: Function;

    useSwapWebSocket.mockImplementation(({ onProposalReceived }: any) => {
      proposalHandler = onProposalReceived;
      return { isConnected: true };
    });

    render(
      <Provider store={store}>
        <SwapNotificationHandler>
          <div>Test</div>
        </SwapNotificationHandler>
      </Provider>
    );

    // Simulate proposal received (should play sound)
    proposalHandler('swap-1', 'proposal-1');

    // Check if AudioContext was used
    expect(window.AudioContext).toHaveBeenCalled();
  });
});
