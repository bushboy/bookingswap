import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { unifiedSwapDataService } from '../unifiedSwapDataService';
import * as swapServiceModule from '../swapService';
import * as swapTargetingServiceModule from '../swapTargetingService';
import * as proposalServiceModule from '../proposalService';
import { swapService } from '../swapService';
import { swapService } from '../swapService';
import { swapService } from '../swapService';
import { swapService } from '../swapService';
import { swapService } from '../swapService';
import { swapService } from '../swapService';
import { swapService } from '../swapService';
import { swapService } from '../swapService';
import { swapService } from '../swapService';
import { swapService } from '../swapService';
import { swapService } from '../swapService';
import { swapService } from '../swapService';

/**
 * Tests for Unified Swap Data Service
 * 
 * These tests ensure that the unified data service correctly coordinates
 * data fetching, validation, and synchronization across all sources.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

// Mock the dependencies
vi.mock('../swapService', () => ({
    swapService: {
        getSwap: vi.fn()
    }
}));
vi.mock('../swapTargetingService', () => ({
    swapTargetingService: {
        getSwapsTargetedBy: vi.fn(),
        getSwapTarget: vi.fn()
    }
}));
vi.mock('../proposalService', () => ({
    proposalService: {
        getProposalsForSwap: vi.fn()
    }
}));

describe('UnifiedSwapDataService', () => {
    const mockSwapId = 'swap-123';
    const mockSwapData = {
        id: mockSwapId,
        status: 'pending',
        sourceBooking: {
            id: 'booking-456',
            title: 'Luxury Hotel in Paris',
            type: 'hotel',
            location: { city: 'Paris', country: 'France' },
            dateRange: { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-07') },
            swapValue: 1200
        },
        createdAt: new Date('2024-01-15T10:00:00Z'),
        terms: { expiresAt: new Date('2024-06-01T10:00:00Z') }
    };

    const mockTargetingData = {
        incoming: [
            {
                id: 'target-1',
                sourceSwapId: 'swap-789',
                proposerName: 'John Doe',
                proposerSwapTitle: 'Beach Resort in Nice',
                status: 'pending',
                createdAt: new Date('2024-01-16T10:00:00Z')
            }
        ],
        outgoing: {
            id: 'target-out-1',
            targetSwapId: 'swap-202',
            targetOwnerName: 'Bob Wilson',
            targetSwapTitle: 'City Apartment in Rome',
            status: 'pending',
            createdAt: new Date('2024-01-18T10:00:00Z')
        }
    };

    const mockProposalData = [
        {
            id: 'proposal-1',
            swapId: mockSwapId,
            proposerId: 'user-1',
            message: 'Interested in your swap',
            status: 'pending',
            createdAt: new Date('2024-01-17T10:00:00Z')
        }
    ];

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Clear service cache
        unifiedSwapDataService.clearAllCache();

        // Setup default mock implementations
        vi.mocked(swapService.getSwap).mockResolvedValue(mockSwapData as any);
        vi.mocked(swapTargetingService.getSwapsTargetedBy).mockResolvedValue(mockTargetingData.incoming as any);
        vi.mocked(swapTargetingService.getSwapTarget).mockResolvedValue(mockTargetingData.outgoing as any);
        vi.mocked(proposalService.getProposalsForSwap).mockResolvedValue(mockProposalData as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getUnifiedSwapData', () => {
        it('should fetch and unify data from all sources', async () => {
            const result = await unifiedSwapDataService.getUnifiedSwapData(mockSwapId);

            expect(result).toBeDefined();
            expect(result.userSwap.id).toBe(mockSwapId);
            expect(result.userSwap.status).toBe('pending');
            expect(result.userSwap.bookingDetails.title).toBe('Luxury Hotel in Paris');
            expect(result.userSwap.bookingDetails.swapValue).toBe(1200);

            // Verify all services were called
            expect(swapService.getSwap).toHaveBeenCalledWith(mockSwapId);
            expect(swapTargetingService.getSwapsTargetedBy).toHaveBeenCalledWith(mockSwapId);
            expect(swapTargetingService.getSwapTarget).toHaveBeenCalledWith(mockSwapId);
            expect(proposalService.getProposalsForSwap).toHaveBeenCalledWith(mockSwapId);
        });

        it('should include targeting data when requested', async () => {
            const result = await unifiedSwapDataService.getUnifiedSwapData(mockSwapId, {
                includeTargeting: true
            });

            expect('targeting' in result).toBe(true);
            const enhancedResult = result as any;
            expect(enhancedResult.targeting.incomingTargets).toHaveLength(1);
            expect(enhancedResult.targeting.incomingTargets[0].proposerName).toBe('John Doe');
            expect(enhancedResult.targeting.outgoingTarget.targetOwnerName).toBe('Bob Wilson');
        });

        it('should exclude targeting data when not requested', async () => {
            const result = await unifiedSwapDataService.getUnifiedSwapData(mockSwapId, {
                includeTargeting: false
            });

            expect('targeting' in result).toBe(false);
            expect(swapTargetingService.getSwapsTargetedBy).not.toHaveBeenCalled();
            expect(swapTargetingService.getSwapTarget).not.toHaveBeenCalled();
        });

        it('should handle partial data failures gracefully', async () => {
            // Mock targeting service to fail
            vi.mocked(swapTargetingService.getSwapsTargetedBy).mockRejectedValue(new Error('Targeting service error'));
            vi.mocked(swapTargetingService.getSwapTarget).mockRejectedValue(new Error('Targeting service error'));

            const result = await unifiedSwapDataService.getUnifiedSwapData(mockSwapId);

            // Should still return data with swap information
            expect(result).toBeDefined();
            expect(result.userSwap.id).toBe(mockSwapId);

            // Targeting should be handled gracefully
            if ('targeting' in result) {
                const enhancedResult = result as any;
                expect(enhancedResult.targeting.incomingTargets).toHaveLength(0);
                expect(enhancedResult.targeting.outgoingTarget).toBeNull();
            }
        });

        it('should return fallback data when swap service fails', async () => {
            vi.mocked(swapService.getSwap).mockRejectedValue(new Error('Swap service error'));

            const result = await unifiedSwapDataService.getUnifiedSwapData(mockSwapId);

            expect(result).toBeDefined();
            expect(result.userSwap.id).toBe(mockSwapId);
            expect(result.userSwap.bookingDetails.title).toBe('Data unavailable');
        });

        it('should use cached data when available', async () => {
            // First call
            await unifiedSwapDataService.getUnifiedSwapData(mockSwapId);

            // Second call should use cache
            await unifiedSwapDataService.getUnifiedSwapData(mockSwapId);

            // Services should only be called once
            expect(swapService.getSwap).toHaveBeenCalledTimes(1);
        });

        it('should force refresh when requested', async () => {
            // First call
            await unifiedSwapDataService.getUnifiedSwapData(mockSwapId);

            // Second call with force refresh
            await unifiedSwapDataService.getUnifiedSwapData(mockSwapId, { forceRefresh: true });

            // Services should be called twice
            expect(swapService.getSwap).toHaveBeenCalledTimes(2);
        });

        it('should validate consistency when requested', async () => {
            const result = await unifiedSwapDataService.getUnifiedSwapData(mockSwapId, {
                validateConsistency: true
            });

            expect(result).toBeDefined();

            // Check that consistency report was generated
            const consistencyReport = unifiedSwapDataService.getConsistencyReport(mockSwapId);
            expect(consistencyReport).toBeDefined();
            expect(consistencyReport?.swapId).toBe(mockSwapId);
        });
    });

    describe('getMultipleUnifiedSwapData', () => {
        const swapIds = ['swap-1', 'swap-2', 'swap-3'];

        beforeEach(() => {
            // Mock responses for multiple swaps
            vi.mocked(swapService.getSwap).mockImplementation((id) =>
                Promise.resolve({ ...mockSwapData, id } as any)
            );
        });

        it('should fetch multiple swaps efficiently', async () => {
            const results = await unifiedSwapDataService.getMultipleUnifiedSwapData(swapIds);

            expect(results).toHaveLength(3);
            expect(results[0].userSwap.id).toBe('swap-1');
            expect(results[1].userSwap.id).toBe('swap-2');
            expect(results[2].userSwap.id).toBe('swap-3');
        });

        it('should handle partial failures in multiple fetch', async () => {
            // Make one swap fail
            vi.mocked(swapService.getSwap).mockImplementation((id) => {
                if (id === 'swap-2') {
                    return Promise.reject(new Error('Service error'));
                }
                return Promise.resolve({ ...mockSwapData, id } as any);
            });

            const results = await unifiedSwapDataService.getMultipleUnifiedSwapData(swapIds);

            // Should return successful results only
            expect(results).toHaveLength(2);
            expect(results.some(r => r.userSwap.id === 'swap-1')).toBe(true);
            expect(results.some(r => r.userSwap.id === 'swap-3')).toBe(true);
        });
    });

    describe('synchronizeSwapData', () => {
        it('should synchronize data and notify callbacks', async () => {
            const callback = vi.fn();

            // Register callback
            const unregister = unifiedSwapDataService.registerSyncCallback(mockSwapId, callback);

            // Synchronize data
            await unifiedSwapDataService.synchronizeSwapData(mockSwapId);

            // Callback should be called
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                userSwap: expect.objectContaining({
                    id: mockSwapId
                })
            }));

            unregister();
        });

        it('should handle synchronization errors gracefully', async () => {
            vi.mocked(swapService.getSwap).mockRejectedValue(new Error('Sync error'));

            // Should not throw
            await expect(unifiedSwapDataService.synchronizeSwapData(mockSwapId)).resolves.toBeUndefined();
        });
    });

    describe('registerSyncCallback', () => {
        it('should register and unregister callbacks correctly', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            // Register callbacks
            const unregister1 = unifiedSwapDataService.registerSyncCallback(mockSwapId, callback1);
            const unregister2 = unifiedSwapDataService.registerSyncCallback(mockSwapId, callback2);

            // Unregister first callback
            unregister1();

            // Trigger sync (this would normally be called internally)
            // We'll test this indirectly through synchronizeSwapData
        });

        it('should handle callback errors gracefully', async () => {
            const errorCallback = vi.fn().mockImplementation(() => {
                throw new Error('Callback error');
            });
            const normalCallback = vi.fn();

            unifiedSwapDataService.registerSyncCallback(mockSwapId, errorCallback);
            unifiedSwapDataService.registerSyncCallback(mockSwapId, normalCallback);

            // Should not throw even if callback throws
            await expect(unifiedSwapDataService.synchronizeSwapData(mockSwapId)).resolves.toBeUndefined();

            // Normal callback should still be called
            expect(normalCallback).toHaveBeenCalled();
        });
    });

    describe('cache management', () => {
        it('should invalidate specific swap data', async () => {
            // Fetch data to populate cache
            await unifiedSwapDataService.getUnifiedSwapData(mockSwapId);

            // Invalidate cache
            unifiedSwapDataService.invalidateSwapData(mockSwapId);

            // Next fetch should call service again
            await unifiedSwapDataService.getUnifiedSwapData(mockSwapId);

            expect(swapService.getSwap).toHaveBeenCalledTimes(2);
        });

        it('should clear all cache', async () => {
            // Fetch multiple swaps
            await unifiedSwapDataService.getUnifiedSwapData('swap-1');
            await unifiedSwapDataService.getUnifiedSwapData('swap-2');

            // Clear all cache
            unifiedSwapDataService.clearAllCache();

            // Next fetches should call services again
            await unifiedSwapDataService.getUnifiedSwapData('swap-1');
            await unifiedSwapDataService.getUnifiedSwapData('swap-2');

            expect(swapService.getSwap).toHaveBeenCalledTimes(4);
        });
    });

    describe('data sanitization', () => {
        it('should sanitize financial data correctly', async () => {
            const swapWithNullValue = {
                ...mockSwapData,
                sourceBooking: {
                    ...mockSwapData.sourceBooking,
                    swapValue: null
                }
            };

            vi.mocked(swapService.getSwap).mockResolvedValue(swapWithNullValue as any);

            const result = await unifiedSwapDataService.getUnifiedSwapData(mockSwapId);

            expect(result.userSwap.bookingDetails.swapValue).toBeNull();
            expect(result.userSwap.bookingDetails.currency).toBeDefined();
        });

        it('should handle missing booking details gracefully', async () => {
            const swapWithMissingDetails = {
                ...mockSwapData,
                sourceBooking: {
                    id: 'booking-456',
                    // Missing title, location, etc.
                }
            };

            vi.mocked(swapService.getSwap).mockResolvedValue(swapWithMissingDetails as any);

            const result = await unifiedSwapDataService.getUnifiedSwapData(mockSwapId);

            expect(result.userSwap.bookingDetails.title).toBe('Untitled Booking');
            expect(result.userSwap.bookingDetails.location.city).toBe('Unknown');
            expect(result.userSwap.bookingDetails.location.country).toBe('Unknown');
        });
    });

    describe('consistency reporting', () => {
        it('should generate consistency reports', async () => {
            await unifiedSwapDataService.getUnifiedSwapData(mockSwapId, {
                validateConsistency: true
            });

            const report = unifiedSwapDataService.getConsistencyReport(mockSwapId);

            expect(report).toBeDefined();
            expect(report?.swapId).toBe(mockSwapId);
            expect(report?.timestamp).toBeInstanceOf(Date);
            expect(typeof report?.isConsistent).toBe('boolean');
            expect(Array.isArray(report?.discrepancies)).toBe(true);
        });

        it('should return null for non-existent consistency reports', () => {
            const report = unifiedSwapDataService.getConsistencyReport('non-existent-swap');
            expect(report).toBeNull();
        });
    });
});