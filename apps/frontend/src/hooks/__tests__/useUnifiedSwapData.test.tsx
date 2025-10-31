import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUnifiedSwapData, useMultipleUnifiedSwapData, useDataConsistencyMonitor } from '../useUnifiedSwapData';
import { unifiedSwapDataService } from '../../services/unifiedSwapDataService';

/**
 * Tests for Unified Swap Data Hooks
 * 
 * These tests ensure that the hooks correctly manage data fetching,
 * synchronization, and consistency monitoring.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

// Mock the unified swap data service
vi.mock('../../services/unifiedSwapDataService');

describe('useUnifiedSwapData', () => {
    const mockSwapId = 'swap-123';
    const mockSwapData = {
        userSwap: {
            id: mockSwapId,
            status: 'pending',
            bookingDetails: {
                id: 'booking-456',
                title: 'Luxury Hotel in Paris',
                type: 'hotel',
                location: { city: 'Paris', country: 'France' },
                dateRange: { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-07') },
                swapValue: 1200,
                currency: 'EUR'
            },
            createdAt: new Date('2024-01-15T10:00:00Z'),
            expiresAt: new Date('2024-06-01T10:00:00Z')
        }
    };

    const mockConsistencyReport = {
        swapId: mockSwapId,
        timestamp: new Date(),
        isConsistent: true,
        discrepancies: [],
        overallScore: 100
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mock implementations
        vi.mocked(unifiedSwapDataService.getUnifiedSwapData).mockResolvedValue(mockSwapData as any);
        vi.mocked(unifiedSwapDataService.getConsistencyReport).mockReturnValue(mockConsistencyReport);
        vi.mocked(unifiedSwapDataService.registerSyncCallback).mockReturnValue(() => { });
        vi.mocked(unifiedSwapDataService.synchronizeSwapData).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should fetch data on mount', async () => {
        const { result } = renderHook(() => useUnifiedSwapData(mockSwapId));

        expect(result.current.loading).toBe(true);
        expect(result.current.data).toBeNull();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.data).toEqual(mockSwapData);
        expect(result.current.error).toBeNull();
        expect(unifiedSwapDataService.getUnifiedSwapData).toHaveBeenCalledWith(mockSwapId, {
            includeTargeting: true,
            includeProposals: true,
            validateConsistency: true,
            forceRefresh: false
        });
    });

    it('should register for sync callbacks', async () => {
        renderHook(() => useUnifiedSwapData(mockSwapId));

        await waitFor(() => {
            expect(unifiedSwapDataService.registerSyncCallback).toHaveBeenCalledWith(
                mockSwapId,
                expect.any(Function)
            );
        });
    });

    it('should handle fetch errors gracefully', async () => {
        const errorMessage = 'Failed to fetch swap data';
        vi.mocked(unifiedSwapDataService.getUnifiedSwapData).mockRejectedValue(new Error(errorMessage));

        const { result } = renderHook(() => useUnifiedSwapData(mockSwapId));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.data).toBeNull();
        expect(result.current.error).toBe(errorMessage);
    });

    it('should refresh data when refresh is called', async () => {
        const { result } = renderHook(() => useUnifiedSwapData(mockSwapId));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.refresh();
        });

        expect(unifiedSwapDataService.getUnifiedSwapData).toHaveBeenCalledTimes(2);
        expect(unifiedSwapDataService.getUnifiedSwapData).toHaveBeenLastCalledWith(mockSwapId, {
            includeTargeting: true,
            includeProposals: true,
            validateConsistency: true,
            forceRefresh: true
        });
    });

    it('should synchronize data when synchronize is called', async () => {
        const { result } = renderHook(() => useUnifiedSwapData(mockSwapId));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.synchronize();
        });

        expect(unifiedSwapDataService.synchronizeSwapData).toHaveBeenCalledWith(mockSwapId);
    });

    it('should update consistency report when validation is enabled', async () => {
        const { result } = renderHook(() =>
            useUnifiedSwapData(mockSwapId, { validateConsistency: true })
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.consistencyReport).toEqual(mockConsistencyReport);
        expect(result.current.isConsistent).toBe(true);
    });

    it('should handle sync callback updates', async () => {
        let syncCallback: ((data: any) => void) | undefined;

        vi.mocked(unifiedSwapDataService.registerSyncCallback).mockImplementation((swapId, callback) => {
            syncCallback = callback;
            return () => { };
        });

        const { result } = renderHook(() => useUnifiedSwapData(mockSwapId));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Simulate sync callback
        const updatedData = {
            ...mockSwapData,
            userSwap: {
                ...mockSwapData.userSwap,
                status: 'accepted'
            }
        };

        act(() => {
            syncCallback?.(updatedData);
        });

        expect(result.current.data).toEqual(updatedData);
    });

    it('should respect custom options', async () => {
        const options = {
            includeTargeting: false,
            includeProposals: false,
            validateConsistency: false,
            autoRefresh: false
        };

        renderHook(() => useUnifiedSwapData(mockSwapId, options));

        await waitFor(() => {
            expect(unifiedSwapDataService.getUnifiedSwapData).toHaveBeenCalledWith(mockSwapId, {
                ...options,
                forceRefresh: false
            });
        });
    });

    it('should handle empty swapId gracefully', async () => {
        const { result } = renderHook(() => useUnifiedSwapData(''));

        expect(result.current.loading).toBe(true);
        expect(result.current.data).toBeNull();
        expect(unifiedSwapDataService.getUnifiedSwapData).not.toHaveBeenCalled();
    });

    it('should cleanup on unmount', () => {
        const unregisterMock = vi.fn();
        vi.mocked(unifiedSwapDataService.registerSyncCallback).mockReturnValue(unregisterMock);

        const { unmount } = renderHook(() => useUnifiedSwapData(mockSwapId));

        unmount();

        expect(unregisterMock).toHaveBeenCalled();
    });
});

describe('useMultipleUnifiedSwapData', () => {
    const mockSwapIds = ['swap-1', 'swap-2', 'swap-3'];
    const mockMultipleSwapData = mockSwapIds.map(id => ({
        userSwap: {
            id,
            status: 'pending',
            bookingDetails: {
                id: `booking-${id}`,
                title: `Hotel ${id}`,
                type: 'hotel',
                location: { city: 'Paris', country: 'France' },
                dateRange: { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-07') },
                swapValue: 1200,
                currency: 'EUR'
            },
            createdAt: new Date('2024-01-15T10:00:00Z'),
            expiresAt: new Date('2024-06-01T10:00:00Z')
        }
    }));

    beforeEach(() => {
        vi.mocked(unifiedSwapDataService.getMultipleUnifiedSwapData).mockResolvedValue(mockMultipleSwapData as any);
        vi.mocked(unifiedSwapDataService.synchronizeSwapData).mockResolvedValue(undefined);
    });

    it('should fetch multiple swap data', async () => {
        const { result } = renderHook(() => useMultipleUnifiedSwapData(mockSwapIds));

        expect(result.current.loading).toBe(true);
        expect(result.current.data).toEqual([]);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.data).toEqual(mockMultipleSwapData);
        expect(result.current.error).toBeNull();
        expect(unifiedSwapDataService.getMultipleUnifiedSwapData).toHaveBeenCalledWith(mockSwapIds, {});
    });

    it('should handle empty swap IDs array', async () => {
        const { result } = renderHook(() => useMultipleUnifiedSwapData([]));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.data).toEqual([]);
        expect(unifiedSwapDataService.getMultipleUnifiedSwapData).not.toHaveBeenCalled();
    });

    it('should refresh all data when refresh is called', async () => {
        const { result } = renderHook(() => useMultipleUnifiedSwapData(mockSwapIds));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.refresh();
        });

        expect(unifiedSwapDataService.getMultipleUnifiedSwapData).toHaveBeenCalledTimes(2);
        expect(unifiedSwapDataService.getMultipleUnifiedSwapData).toHaveBeenLastCalledWith(mockSwapIds, {
            forceRefresh: true
        });
    });

    it('should synchronize all data when synchronizeAll is called', async () => {
        const { result } = renderHook(() => useMultipleUnifiedSwapData(mockSwapIds));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.synchronizeAll();
        });

        // Should call synchronize for each swap ID
        expect(unifiedSwapDataService.synchronizeSwapData).toHaveBeenCalledTimes(3);
        mockSwapIds.forEach(id => {
            expect(unifiedSwapDataService.synchronizeSwapData).toHaveBeenCalledWith(id);
        });
    });

    it('should handle fetch errors for multiple swaps', async () => {
        const errorMessage = 'Failed to fetch multiple swap data';
        vi.mocked(unifiedSwapDataService.getMultipleUnifiedSwapData).mockRejectedValue(new Error(errorMessage));

        const { result } = renderHook(() => useMultipleUnifiedSwapData(mockSwapIds));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.data).toEqual([]);
        expect(result.current.error).toBe(errorMessage);
    });
});

describe('useDataConsistencyMonitor', () => {
    const mockSwapIds = ['swap-1', 'swap-2', 'swap-3'];

    beforeEach(() => {
        // Mock consistency reports
        vi.mocked(unifiedSwapDataService.getConsistencyReport).mockImplementation((swapId) => {
            if (swapId === 'swap-2') {
                return {
                    swapId,
                    timestamp: new Date(),
                    isConsistent: false,
                    discrepancies: ['Missing data'],
                    overallScore: 60
                };
            }
            return {
                swapId,
                timestamp: new Date(),
                isConsistent: true,
                discrepancies: [],
                overallScore: 100
            };
        });
    });

    it('should check consistency for multiple swaps', async () => {
        const { result } = renderHook(() => useDataConsistencyMonitor());

        expect(result.current.inconsistentSwaps).toEqual([]);
        expect(result.current.totalChecked).toBe(0);
        expect(result.current.hasInconsistencies).toBe(false);

        await act(async () => {
            await result.current.checkConsistency(mockSwapIds);
        });

        expect(result.current.inconsistentSwaps).toEqual(['swap-2']);
        expect(result.current.totalChecked).toBe(3);
        expect(result.current.hasInconsistencies).toBe(true);
    });

    it('should clear inconsistencies', async () => {
        const { result } = renderHook(() => useDataConsistencyMonitor());

        // First check consistency
        await act(async () => {
            await result.current.checkConsistency(mockSwapIds);
        });

        expect(result.current.hasInconsistencies).toBe(true);

        // Clear inconsistencies
        act(() => {
            result.current.clearInconsistencies();
        });

        expect(result.current.inconsistentSwaps).toEqual([]);
        expect(result.current.totalChecked).toBe(0);
        expect(result.current.hasInconsistencies).toBe(false);
    });

    it('should handle empty swap IDs array', async () => {
        const { result } = renderHook(() => useDataConsistencyMonitor());

        await act(async () => {
            await result.current.checkConsistency([]);
        });

        expect(result.current.inconsistentSwaps).toEqual([]);
        expect(result.current.totalChecked).toBe(0);
        expect(result.current.hasInconsistencies).toBe(false);
    });

    it('should handle missing consistency reports', async () => {
        vi.mocked(unifiedSwapDataService.getConsistencyReport).mockReturnValue(null);

        const { result } = renderHook(() => useDataConsistencyMonitor());

        await act(async () => {
            await result.current.checkConsistency(mockSwapIds);
        });

        expect(result.current.inconsistentSwaps).toEqual([]);
        expect(result.current.totalChecked).toBe(3);
        expect(result.current.hasInconsistencies).toBe(false);
    });
});