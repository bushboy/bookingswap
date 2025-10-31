import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { EnhancedProposalRepository, ProposalWithUserInfo, ProposalQueryFilters } from '../EnhancedProposalRepository';
import { ProposalMetadataEntity, CreateProposalMetadataRequest } from '../SwapProposalMetadataRepository';

describe('EnhancedProposalRepository', () => {
    let mockPool: Pool;
    let mockClient: any;
    let repository: EnhancedProposalRepository;

    // Mock data for testing
    const mockProposalRow = {
        id: '1',
        proposal_id: 'prop-123',
        source_swap_id: 'swap-456',
        target_swap_id: 'swap-789',
        message: 'Test proposal message',
        compatibility_score: 85.5,
        created_from_browse: true,
        proposal_source: 'browse',
        created_at: new Date('2023-01-01'),
        updated_at: new Date('2023-01-02'),
    };

    const mockProposalWithUserInfoRow = {
        ...mockProposalRow,
        proposer_name: 'John Doe',
        proposer_email: 'john@example.com',
        target_owner_name: 'Jane Smith',
        target_owner_email: 'jane@example.com',
        source_booking_title: 'Beach House in Miami',
        target_booking_title: 'Mountain Cabin in Colorado',
        total_count: '1',
    };

    const expectedProposalEntity: ProposalMetadataEntity = {
        id: '1',
        proposalId: 'prop-123',
        sourceSwapId: 'swap-456',
        targetSwapId: 'swap-789',
        message: 'Test proposal message',
        compatibilityScore: 85.5,
        createdFromBrowse: true,
        proposalSource: 'browse',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
    };

    const expectedProposalWithUserInfo: ProposalWithUserInfo = {
        ...expectedProposalEntity,
        proposerName: 'John Doe',
        proposerEmail: 'john@example.com',
        targetOwnerName: 'Jane Smith',
        targetOwnerEmail: 'jane@example.com',
        sourceBookingTitle: 'Beach House in Miami',
        targetBookingTitle: 'Mountain Cabin in Colorado',
    };

    beforeEach(() => {
        mockClient = {
            query: vi.fn(),
            release: vi.fn(),
        };

        mockPool = {
            query: vi.fn(),
            connect: vi.fn().mockResolvedValue(mockClient),
        } as any;

        repository = new EnhancedProposalRepository(mockPool);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getProposalByIdWithUserInfo', () => {
        it('should retrieve proposal with user information successfully', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [mockProposalWithUserInfoRow],
            });

            const result = await repository.getProposalByIdWithUserInfo('prop-123');

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                ['prop-123']
            );
            expect(result).toEqual(expectedProposalWithUserInfo);
        });

        it('should return null when proposal not found', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [],
            });

            const result = await repository.getProposalByIdWithUserInfo('nonexistent');

            expect(result).toBeNull();
        });

        it('should handle column not found errors gracefully', async () => {
            const columnError = new Error('column "proposer_id" does not exist');
            (columnError as any).code = '42703';
            (mockPool.query as any).mockRejectedValue(columnError);

            const result = await repository.getProposalByIdWithUserInfo('prop-123');

            expect(result).toBeNull();
        });

        it('should handle database connection errors', async () => {
            const connectionError = new Error('connection refused');
            (connectionError as any).code = 'ECONNREFUSED';
            (mockPool.query as any).mockRejectedValue(connectionError);

            await expect(
                repository.getProposalByIdWithUserInfo('prop-123')
            ).rejects.toThrow('Database temporarily unavailable');
        });
    });

    describe('getProposalsWithUserInfo', () => {
        it('should retrieve proposals with user information and filters', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [mockProposalWithUserInfoRow],
            });

            const filters: ProposalQueryFilters = {
                userId: 'user-123',
                limit: 10,
                offset: 0,
            };

            const result = await repository.getProposalsWithUserInfo(filters);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.arrayContaining(['user-123', 10, 0])
            );
            expect(result.proposals).toHaveLength(1);
            expect(result.proposals[0]).toEqual(expectedProposalWithUserInfo);
            expect(result.totalCount).toBe(1);
            expect(result.hasMore).toBe(false);
        });

        it('should handle multiple filters correctly', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [mockProposalWithUserInfoRow],
            });

            const filters: ProposalQueryFilters = {
                sourceSwapId: 'swap-456',
                proposerId: 'user-123',
                createdAfter: new Date('2023-01-01'),
                limit: 20,
                offset: 10,
            };

            const result = await repository.getProposalsWithUserInfo(filters);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE'),
                expect.arrayContaining(['swap-456', 'user-123', expect.any(Date), 20, 10])
            );
            expect(result.proposals).toHaveLength(1);
        });

        it('should return empty result when no proposals found', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [],
            });

            const result = await repository.getProposalsWithUserInfo({});

            expect(result.proposals).toHaveLength(0);
            expect(result.totalCount).toBe(0);
            expect(result.hasMore).toBe(false);
        });

        it('should handle column not found errors gracefully', async () => {
            const columnError = new Error('column "target_owner_id" does not exist');
            (columnError as any).code = '42703';
            (mockPool.query as any).mockRejectedValue(columnError);

            const result = await repository.getProposalsWithUserInfo({});

            expect(result.proposals).toHaveLength(0);
            expect(result.totalCount).toBe(0);
            expect(result.hasMore).toBe(false);
        });
    });

    describe('findByProposalId', () => {
        it('should find proposal by ID successfully', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [mockProposalRow],
            });

            const result = await repository.findByProposalId('prop-123');

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE proposal_id = $1'),
                ['prop-123']
            );
            expect(result).toEqual(expectedProposalEntity);
        });

        it('should return null when proposal not found', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [],
            });

            const result = await repository.findByProposalId('nonexistent');

            expect(result).toBeNull();
        });

        it('should handle column not found errors gracefully', async () => {
            const columnError = new Error('column "proposal_id" does not exist');
            (columnError as any).code = '42703';
            (mockPool.query as any).mockRejectedValue(columnError);

            const result = await repository.findByProposalId('prop-123');

            expect(result).toBeNull();
        });
    });

    describe('findProposalsByProposerId', () => {
        it('should find proposals by proposer ID successfully', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [mockProposalRow],
            });

            const result = await repository.findProposalsByProposerId('user-123', 10, 0);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE proposer_id = $1'),
                ['user-123', 10, 0]
            );
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(expectedProposalEntity);
        });

        it('should return empty array when no proposals found', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [],
            });

            const result = await repository.findProposalsByProposerId('user-123');

            expect(result).toHaveLength(0);
        });

        it('should handle column not found errors with fallback strategy', async () => {
            const columnError = new Error('column "proposer_id" does not exist');
            (columnError as any).code = '42703';
            (mockPool.query as any).mockRejectedValue(columnError);

            const result = await repository.findProposalsByProposerId('user-123');

            expect(result).toHaveLength(0);
        });
    });

    describe('findProposalsReceivedByUserId', () => {
        it('should find proposals received by user ID successfully', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [mockProposalRow],
            });

            const result = await repository.findProposalsReceivedByUserId('user-456', 10, 0);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE target_owner_id = $1'),
                ['user-456', 10, 0]
            );
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(expectedProposalEntity);
        });

        it('should return empty array when no proposals found', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [],
            });

            const result = await repository.findProposalsReceivedByUserId('user-456');

            expect(result).toHaveLength(0);
        });

        it('should handle column not found errors with fallback strategy', async () => {
            const columnError = new Error('column "target_owner_id" does not exist');
            (columnError as any).code = '42703';
            (mockPool.query as any).mockRejectedValue(columnError);

            const result = await repository.findProposalsReceivedByUserId('user-456');

            expect(result).toHaveLength(0);
        });
    });

    describe('createProposalMetadata', () => {
        it('should create proposal metadata successfully', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [mockProposalRow],
            });

            const createRequest: CreateProposalMetadataRequest = {
                proposalId: 'prop-123',
                sourceSwapId: 'swap-456',
                targetSwapId: 'swap-789',
                proposerId: 'user-123',
                targetOwnerId: 'user-456',
                message: 'Test proposal message',
                compatibilityScore: 85.5,
                createdFromBrowse: true,
                proposalSource: 'browse',
                blockchainTransactionId: 'tx-123',
            };

            const result = await repository.createProposalMetadata(createRequest);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO'),
                expect.arrayContaining([
                    'prop-123',
                    'swap-456',
                    'swap-789',
                    'user-123',
                    'user-456',
                    'Test proposal message',
                    85.5,
                    true,
                    'browse',
                    'tx-123',
                ])
            );
            expect(result).toEqual(expectedProposalEntity);
        });

        it('should handle constraint violation errors', async () => {
            const constraintError = new Error('duplicate key value violates unique constraint');
            (constraintError as any).code = '23505';
            (mockPool.query as any).mockRejectedValue(constraintError);

            const createRequest: CreateProposalMetadataRequest = {
                proposalId: 'prop-123',
                sourceSwapId: 'swap-456',
                targetSwapId: 'swap-789',
                proposerId: 'user-123',
                targetOwnerId: 'user-456',
                blockchainTransactionId: 'tx-123',
            };

            await expect(
                repository.createProposalMetadata(createRequest)
            ).rejects.toThrow('Unable to create proposal due to data validation error');
        });

        it('should handle column not found errors', async () => {
            const columnError = new Error('column "proposer_id" does not exist');
            (columnError as any).code = '42703';
            (mockPool.query as any).mockRejectedValue(columnError);

            const createRequest: CreateProposalMetadataRequest = {
                proposalId: 'prop-123',
                sourceSwapId: 'swap-456',
                targetSwapId: 'swap-789',
                proposerId: 'user-123',
                targetOwnerId: 'user-456',
                blockchainTransactionId: 'tx-123',
            };

            await expect(
                repository.createProposalMetadata(createRequest)
            ).rejects.toThrow('Database schema mismatch');
        });
    });

    describe('getUserProposalStats', () => {
        it('should get user proposal statistics successfully', async () => {
            const mockStatsRow = {
                total_proposed: '5',
                total_received: '3',
                browse_proposals: '4',
                direct_proposals: '1',
                auction_proposals: '0',
                avg_compatibility_score: '82.5',
            };

            (mockPool.query as any).mockResolvedValue({
                rows: [mockStatsRow],
            });

            const result = await repository.getUserProposalStats('user-123');

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('COUNT(CASE WHEN proposer_id = $1'),
                ['user-123']
            );
            expect(result).toEqual({
                totalProposed: 5,
                totalReceived: 3,
                browseProposals: 4,
                directProposals: 1,
                auctionProposals: 0,
                averageCompatibilityScore: 82.5,
            });
        });

        it('should return default stats when no data found', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [{
                    total_proposed: '0',
                    total_received: '0',
                    browse_proposals: '0',
                    direct_proposals: '0',
                    auction_proposals: '0',
                    avg_compatibility_score: null,
                }],
            });

            const result = await repository.getUserProposalStats('user-123');

            expect(result).toEqual({
                totalProposed: 0,
                totalReceived: 0,
                browseProposals: 0,
                directProposals: 0,
                auctionProposals: 0,
                averageCompatibilityScore: 0,
            });
        });

        it('should handle column not found errors gracefully', async () => {
            const columnError = new Error('column "proposer_id" does not exist');
            (columnError as any).code = '42703';
            (mockPool.query as any).mockRejectedValue(columnError);

            const result = await repository.getUserProposalStats('user-123');

            expect(result).toEqual({
                totalProposed: 0,
                totalReceived: 0,
                browseProposals: 0,
                directProposals: 0,
                auctionProposals: 0,
                averageCompatibilityScore: 0,
            });
        });
    });

    describe('findProposalsBySourceSwapId', () => {
        it('should find proposals by source swap ID successfully', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [mockProposalRow],
            });

            const result = await repository.findProposalsBySourceSwapId('swap-456');

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE source_swap_id = $1'),
                ['swap-456']
            );
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(expectedProposalEntity);
        });

        it('should return empty array when no proposals found', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [],
            });

            const result = await repository.findProposalsBySourceSwapId('swap-456');

            expect(result).toHaveLength(0);
        });

        it('should handle column not found errors gracefully', async () => {
            const columnError = new Error('column "source_swap_id" does not exist');
            (columnError as any).code = '42703';
            (mockPool.query as any).mockRejectedValue(columnError);

            const result = await repository.findProposalsBySourceSwapId('swap-456');

            expect(result).toHaveLength(0);
        });
    });

    describe('findProposalsByTargetSwapId', () => {
        it('should find proposals by target swap ID successfully', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [mockProposalRow],
            });

            const result = await repository.findProposalsByTargetSwapId('swap-789');

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE target_swap_id = $1'),
                ['swap-789']
            );
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(expectedProposalEntity);
        });

        it('should return empty array when no proposals found', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [],
            });

            const result = await repository.findProposalsByTargetSwapId('swap-789');

            expect(result).toHaveLength(0);
        });

        it('should handle column not found errors gracefully', async () => {
            const columnError = new Error('column "target_swap_id" does not exist');
            (columnError as any).code = '42703';
            (mockPool.query as any).mockRejectedValue(columnError);

            const result = await repository.findProposalsByTargetSwapId('swap-789');

            expect(result).toHaveLength(0);
        });
    });

    describe('updateCompatibilityScore', () => {
        it('should update compatibility score successfully', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [{ ...mockProposalRow, compatibility_score: 90.0 }],
            });

            const result = await repository.updateCompatibilityScore('prop-123', 90.0);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE'),
                [90.0, 'prop-123']
            );
            expect(result?.compatibilityScore).toBe(90.0);
        });

        it('should return null when proposal not found', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [],
            });

            const result = await repository.updateCompatibilityScore('nonexistent', 90.0);

            expect(result).toBeNull();
        });

        it('should handle column not found errors gracefully', async () => {
            const columnError = new Error('column "compatibility_score" does not exist');
            (columnError as any).code = '42703';
            (mockPool.query as any).mockRejectedValue(columnError);

            const result = await repository.updateCompatibilityScore('prop-123', 90.0);

            expect(result).toBeNull();
        });

        it('should handle constraint violation errors', async () => {
            const constraintError = new Error('check constraint violation');
            (constraintError as any).code = '23514';
            (mockPool.query as any).mockRejectedValue(constraintError);

            await expect(
                repository.updateCompatibilityScore('prop-123', -10.0)
            ).rejects.toThrow('Invalid compatibility score value');
        });
    });

    describe('Error Handler Integration', () => {
        it('should provide error handler statistics', () => {
            const stats = repository.getErrorHandlerStats();

            expect(stats).toHaveProperty('columnValidationEnabled');
            expect(stats).toHaveProperty('performanceLoggingEnabled');
            expect(stats).toHaveProperty('fallbackStrategiesEnabled');
            expect(stats).toHaveProperty('performanceStats');
        });

        it('should reset error handler state', () => {
            expect(() => repository.resetErrorHandler()).not.toThrow();
        });
    });

    describe('Previously Failing Proposal Test', () => {
        it('should handle the previously failing proposal ID from error log', async () => {
            // Test with a specific proposal ID that was mentioned in the error logs
            const failingProposalId = 'prop-error-42703';

            (mockPool.query as any).mockResolvedValue({
                rows: [mockProposalWithUserInfoRow],
            });

            const result = await repository.getProposalByIdWithUserInfo(failingProposalId);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [failingProposalId]
            );
            expect(result).toEqual(expectedProposalWithUserInfo);
        });

        it('should verify derived user information is correctly retrieved', async () => {
            (mockPool.query as any).mockResolvedValue({
                rows: [mockProposalWithUserInfoRow],
            });

            const result = await repository.getProposalByIdWithUserInfo('prop-123');

            // Verify that user information is derived from JOIN operations
            expect(result?.proposerName).toBe('John Doe');
            expect(result?.proposerEmail).toBe('john@example.com');
            expect(result?.targetOwnerName).toBe('Jane Smith');
            expect(result?.targetOwnerEmail).toBe('jane@example.com');
            expect(result?.sourceBookingTitle).toBe('Beach House in Miami');
            expect(result?.targetBookingTitle).toBe('Mountain Cabin in Colorado');
        });
    });
});