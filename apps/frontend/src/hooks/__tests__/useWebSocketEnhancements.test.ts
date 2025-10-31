import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import { useConflictResolution } from '../useConflictResolution';
import { useWebSocketHealth } from '../useWebSocketHealth';


// Mock socket for health monitoring
const mockSocket = {
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
};

describe('WebSocket Enhancement Hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('useOptimisticUpdates', () => {
        it('should add and confirm optimistic updates', () => {
            const { result } = renderHook(() => useOptimisticUpdates());

            const originalData = { id: '1', status: 'pending' };
            const optimisticData = { id: '1', status: 'accepted' };

            act(() => {
                result.current.addOptimisticUpdate(
                    'test-id',
                    'proposal_accept',
                    originalData,
                    optimisticData
                );
            });

            expect(result.current.hasOptimisticUpdate('test-id')).toBe(true);
            expect(result.current.isUpdateProcessing('test-id')).toBe(true);

            act(() => {
                result.current.confirmUpdate('test-id');
            });

            expect(result.current.hasOptimisticUpdate('test-id')).toBe(false);
            expect(result.current.isUpdateProcessing('test-id')).toBe(false);
        });

        it('should rollback optimistic updates on timeout', () => {
            const onRollback = vi.fn();
            const { result } = renderHook(() =>
                useOptimisticUpdates({ timeoutMs: 1000, onRollback })
            );

            act(() => {
                result.current.addOptimisticUpdate(
                    'test-id',
                    'proposal_accept',
                    { id: '1', status: 'pending' },
                    { id: '1', status: 'accepted' }
                );
            });

            expect(result.current.hasOptimisticUpdate('test-id')).toBe(true);

            // Fast-forward time to trigger timeout
            act(() => {
                vi.advanceTimersByTime(1000);
            });

            expect(onRollback).toHaveBeenCalled();
            expect(result.current.hasOptimisticUpdate('test-id')).toBe(false);
        });
    });

    describe('useConflictResolution', () => {
        it('should detect and resolve conflicts', () => {
            const onConflictDetected = vi.fn();
            const onConflictResolved = vi.fn();

            const { result } = renderHook(() =>
                useConflictResolution({ onConflictDetected, onConflictResolved })
            );

            const localData = { id: '1', status: 'pending', lastModified: 1000 };
            const remoteData = { id: '1', status: 'accepted', lastModified: 2000 };

            act(() => {
                const conflict = result.current.detectConflict('test-id', localData, remoteData, 'proposal_status');
                expect(conflict).toBeTruthy();
                expect(onConflictDetected).toHaveBeenCalled();
            });

            act(() => {
                const resolution = result.current.resolveConflict('test-id');
                expect(resolution).toBeTruthy();
                expect(onConflictResolved).toHaveBeenCalled();
            });
        });

        it('should resolve proposal conflicts with merge strategy', () => {
            const { result } = renderHook(() => useConflictResolution());

            const localProposal = {
                id: '1',
                status: 'pending',
                lastModified: 1000,
                isProcessing: true
            };
            const remoteProposal = {
                id: '1',
                status: 'accepted',
                lastModified: 2000,
                isProcessing: false
            };

            act(() => {
                const resolved = result.current.resolveProposalConflict('test-id', localProposal, remoteProposal);

                // Should prefer remote status but keep local processing state
                expect(resolved.status).toBe('accepted');
                expect(resolved.isProcessing).toBe(true);
            });
        });
    });

    describe('useWebSocketHealth', () => {
        it('should monitor connection health', () => {
            const onHealthChange = vi.fn();

            const { result } = renderHook(() =>
                useWebSocketHealth({
                    socket: mockSocket as any,
                    onHealthChange,
                    pingInterval: 1000
                })
            );

            expect(result.current.health.status).toBe('disconnected');
            expect(result.current.health.isHealthy).toBe(false);

            // Simulate connection
            act(() => {
                mockSocket.connected = true;
                const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
                connectHandler?.();
            });

            expect(onHealthChange).toHaveBeenCalled();
        });

        it('should handle reconnection attempts', () => {
            const onReconnectFailed = vi.fn();

            const { result } = renderHook(() =>
                useWebSocketHealth({
                    socket: mockSocket as any,
                    maxReconnectAttempts: 2,
                    onReconnectFailed
                })
            );

            // Simulate multiple connection failures
            act(() => {
                const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1];
                errorHandler?.(new Error('Connection failed'));
                errorHandler?.(new Error('Connection failed'));
                errorHandler?.(new Error('Connection failed'));
            });

            expect(onReconnectFailed).toHaveBeenCalled();
        });
    });


});