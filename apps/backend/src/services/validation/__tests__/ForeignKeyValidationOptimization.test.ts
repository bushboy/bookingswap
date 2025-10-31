import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import { ForeignKeyValidationService } from '../ForeignKeyValidationService';
import { ForeignKeyValidationOptimizer } from '../../../database/optimizations/ForeignKeyValidationOptimizer';

describe('Foreign Key Validation Optimization', () => {
    let mockPool: Pool;
    let validationService: ForeignKeyValidationService;
    let optimizer: ForeignKeyValidationOptimizer;

    beforeEach(() => {
        mockPool = {
            query: vi.fn()
        } as any;

        validationService = new ForeignKeyValidationService(mockPool);
        optimizer = new ForeignKeyValidationOptimizer(mockPool);
    });

    describe('Single Query Validation', () => {
        it('should validate all references in a single query for auction scenario', async () => {
            const mockQueryResult = {
                rows: [{
                    swap_exists: 'swap-123',
                    swap_status: 'active',
                    acceptance_strategy: { type: 'auction' },
                    payment_types: { cashPayment: true },
                    swap_owner_id: 'owner-123',
                    payer_exists: 'payer-123',
                    recipient_exists: 'recipient-123',
                    proposal_exists: 'proposal-123',
                    proposal_status: 'pending',
                    proposal_swap_id: 'swap-123',
                    active_auction_exists: 'auction-123',
                    active_auction_status: 'active'
                }]
            };

            vi.mocked(mockPool.query).mockResolvedValue(mockQueryResult);

            const request = {
                swapId: 'swap-123',
                proposalId: 'proposal-123',
                payerId: 'payer-123',
                recipientId: 'recipient-123',
                amount: 100,
                currency: 'USD',
                gatewayTransactionId: 'gateway-123',
                platformFee: 5,
                blockchainTransactionId: 'blockchain-123'
            };

            const result = await validationService.validateAllReferencesInSingleQuery(request);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metadata.scenario).toBe('auction');
            expect(mockPool.query).toHaveBeenCalledTimes(1);
        });

        it('should validate all references in a single query for direct swap scenario', async () => {
            const mockQueryResult = {
                rows: [{
                    swap_exists: 'swap-123',
                    swap_status: 'active',
                    acceptance_strategy: { type: 'first_match' },
                    payment_types: { cashPayment: true },
                    swap_owner_id: 'owner-123',
                    payer_exists: 'payer-123',
                    recipient_exists: 'recipient-123',
                    proposal_exists: null,
                    proposal_status: null,
                    proposal_swap_id: null,
                    active_auction_exists: null,
                    active_auction_status: null
                }]
            };

            vi.mocked(mockPool.query).mockResolvedValue(mockQueryResult);

            const request = {
                swapId: 'swap-123',
                proposalId: null,
                payerId: 'payer-123',
                recipientId: 'recipient-123',
                amount: 100,
                currency: 'USD',
                gatewayTransactionId: 'gateway-123',
                platformFee: 5,
                blockchainTransactionId: 'blockchain-123'
            };

            const result = await validationService.validateAllReferencesInSingleQuery(request);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metadata.scenario).toBe('first_match');
            expect(mockPool.query).toHaveBeenCalledTimes(1);
        });

        it('should detect missing swap in single query', async () => {
            const mockQueryResult = {
                rows: []
            };

            vi.mocked(mockPool.query).mockResolvedValue(mockQueryResult);

            const request = {
                swapId: 'nonexistent-swap',
                proposalId: null,
                payerId: 'payer-123',
                recipientId: 'recipient-123',
                amount: 100,
                currency: 'USD',
                gatewayTransactionId: 'gateway-123',
                platformFee: 5,
                blockchainTransactionId: 'blockchain-123'
            };

            const result = await validationService.validateAllReferencesInSingleQuery(request);

            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].code).toBe('SWAP_NOT_FOUND');
        });
    });

    describe('Validation Method Comparison', () => {
        it('should compare optimized vs standard validation methods', async () => {
            const mockQueryResult = {
                rows: [{
                    swap_exists: 'swap-123',
                    swap_status: 'active',
                    acceptance_strategy: { type: 'first_match' },
                    payment_types: { cashPayment: true },
                    swap_owner_id: 'owner-123',
                    payer_exists: 'payer-123',
                    recipient_exists: 'recipient-123',
                    proposal_exists: null,
                    proposal_status: null,
                    proposal_swap_id: null,
                    active_auction_exists: null,
                    active_auction_status: null
                }]
            };

            // Mock all queries to return valid results
            vi.mocked(mockPool.query).mockResolvedValue(mockQueryResult);

            const request = {
                swapId: 'swap-123',
                proposalId: null,
                payerId: 'payer-123',
                recipientId: 'recipient-123',
                amount: 100,
                currency: 'USD',
                gatewayTransactionId: 'gateway-123',
                platformFee: 5,
                blockchainTransactionId: 'blockchain-123'
            };

            const comparison = await validationService.compareValidationMethods(request);

            // Both methods should return results (may not match due to different validation logic)
            expect(comparison.optimizedResult).toBeDefined();
            expect(comparison.standardResult).toBeDefined();
            expect(comparison.performanceComparison).toBeDefined();
            expect(comparison.performanceComparison.optimizedTime).toBeGreaterThanOrEqual(0);
            expect(comparison.performanceComparison.standardTime).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Validation Configuration', () => {
        it('should allow toggling optimization on/off', () => {
            const stats1 = validationService.getValidationStats();
            expect(stats1.optimizedValidationEnabled).toBe(true);
            expect(stats1.validationMethod).toBe('single_query_optimized');

            validationService.setOptimizedValidation(false);

            const stats2 = validationService.getValidationStats();
            expect(stats2.optimizedValidationEnabled).toBe(false);
            expect(stats2.validationMethod).toBe('multi_query_standard');
        });
    });

    describe('Index Verification', () => {
        it('should verify required indexes exist', async () => {
            const mockIndexResult = {
                rows: [{
                    schemaname: 'public',
                    tablename: 'payment_transactions',
                    indexname: 'idx_payment_transactions_proposal_null',
                    indexdef: 'CREATE INDEX ...',
                    size: '64 kB',
                    scans: 100,
                    tuples_returned: 1000,
                    tuples_fetched: 1000
                }]
            };

            vi.mocked(mockPool.query).mockResolvedValue(mockIndexResult);

            const result = await optimizer.verifyOptimizationIndexes();

            expect(result.allIndexesPresent).toBeDefined();
            expect(result.recommendations).toBeDefined();
            expect(Array.isArray(result.indexes)).toBe(true);
        });
    });
});