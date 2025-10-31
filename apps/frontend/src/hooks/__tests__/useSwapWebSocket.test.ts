import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwapWebSocket } from '../useSwapWebSocket';

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

// Mock Redux hooks
const mockDispatch = vi.fn();
const mockSelector = vi.fn();

vi.mock('../../store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: () => mockSelector,
}));

describe('useSwapWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelector.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user1' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize WebSocket connection when authenticated', () => {
    renderHook(() => useSwapWebSocket());

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith(
      'disconnect',
      expect.any(Function)
    );
    expect(mockSocket.on).toHaveBeenCalledWith(
      'swap:created',
      expect.any(Function)
    );
    expect(mockSocket.on).toHaveBeenCalledWith(
      'swap:updated',
      expect.any(Function)
    );
    expect(mockSocket.on).toHaveBeenCalledWith(
      'swap:proposal',
      expect.any(Function)
    );
  });

  it('should not initialize when not authenticated', () => {
    mockSelector.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });

    renderHook(() => useSwapWebSocket());

    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  it('should handle swap created events', () => {
    const { result } = renderHook(() => useSwapWebSocket());

    const mockSwap = {
      id: 'swap1',
      sourceBookingId: 'booking1',
      targetBookingId: 'booking2',
      status: 'pending',
    };

    // Simulate swap created event
    act(() => {
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'swap:created'
      )?.[1];
      connectHandler?.(mockSwap);
    });

    expect(mockDispatch).toHaveBeenCalled();
  });

  it('should handle swap updated events', () => {
    renderHook(() => useSwapWebSocket());

    const mockSwapUpdate = {
      id: 'swap1',
      status: 'accepted',
      updatedAt: new Date().toISOString(),
    };

    act(() => {
      const updateHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'swap:updated'
      )?.[1];
      updateHandler?.(mockSwapUpdate);
    });

    expect(mockDispatch).toHaveBeenCalled();
  });

  it('should handle swap proposal events', () => {
    renderHook(() => useSwapWebSocket());

    const mockProposal = {
      id: 'proposal1',
      swapId: 'swap1',
      proposerId: 'user2',
      message: 'Interested in swapping',
    };

    act(() => {
      const proposalHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'swap:proposal'
      )?.[1];
      proposalHandler?.(mockProposal);
    });

    expect(mockDispatch).toHaveBeenCalled();
  });

  it('should provide connection status', () => {
    const { result } = renderHook(() => useSwapWebSocket());

    expect(result.current.isConnected).toBe(false);

    // Simulate connection
    act(() => {
      mockSocket.connected = true;
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('should handle connection errors', () => {
    renderHook(() => useSwapWebSocket());

    const mockError = new Error('Connection failed');

    act(() => {
      const errorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect_error'
      )?.[1];
      errorHandler?.(mockError);
    });

    // Should handle error gracefully
    expect(mockSocket.on).toHaveBeenCalledWith(
      'connect_error',
      expect.any(Function)
    );
  });

  it('should emit join room event on connection', () => {
    mockSelector.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user1' },
    });

    renderHook(() => useSwapWebSocket());

    act(() => {
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('join:user', 'user1');
  });

  it('should provide manual reconnection method', () => {
    const { result } = renderHook(() => useSwapWebSocket());

    act(() => {
      result.current.reconnect();
    });

    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it('should clean up on unmount', () => {
    const { unmount } = renderHook(() => useSwapWebSocket());

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('connect');
    expect(mockSocket.off).toHaveBeenCalledWith('disconnect');
    expect(mockSocket.off).toHaveBeenCalledWith('swap:created');
    expect(mockSocket.off).toHaveBeenCalledWith('swap:updated');
    expect(mockSocket.off).toHaveBeenCalledWith('swap:proposal');
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should handle authentication changes', () => {
    const { rerender } = renderHook(() => useSwapWebSocket());

    // Initially authenticated
    expect(mockSocket.on).toHaveBeenCalled();

    // Change to unauthenticated
    mockSelector.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });

    rerender();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should provide last received event info', () => {
    const { result } = renderHook(() => useSwapWebSocket());

    const mockSwap = {
      id: 'swap1',
      status: 'pending',
    };

    act(() => {
      const updateHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'swap:updated'
      )?.[1];
      updateHandler?.(mockSwap);
    });

    expect(result.current.lastEvent).toEqual({
      type: 'swap:updated',
      data: mockSwap,
      timestamp: expect.any(Date),
    });
  });
});
