/**
 * Simple Integration Test for Proposal Operations
 * Requirements: 3.3, 3.4, 4.2 - Basic proposal workflow validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { EnhancedProposalRepository, ProposalWithUserInfo } from '../../database/repositories/EnhancedProposalRepository';
import { CreateProposalMetadataRequest, ProposalMetadataEntity } from '../../database/repositories/SwapProposalMetadataRepository';

// Mock logger to avoid console output during tests
vi.mock('../../utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('Proposal Operations Integration Tests - Simple', () => {
    let mockPool: Pool;
    let proposalRepository: EnhancedProposalRepository;

    beforeEach(() => {
        mockPool = {
            query: vi.fn(),
            connect: vi.fn().mockResolvedValue({
                query: vi.fn(),
                release: vi.fn(),
            }),
        } as any;

        proposalRepository = new EnhancedProposalRepository(mockPool);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Proposal Creation and Retrieval', () => {
        it('should create and retrieve a proposal successfully', async () => {
            // Arrange
            const proposalId = 'test-proposal-1';
            const createRequest: CreateProposalMetadataRequest = {
                proposalId,
                sourceSwapId: 'swap-1',
                targetSwapId: 'swap-2',
                proposerId: 'user-1',
                targetOwnerId: 'user-2',
                blockchainTransactionId: 'tx-1'
            };

            const mockCreatedProposal: ProposalMetadataEntity = {
                id: '1',
                proposalId,
                sourceSwapId: 'swap-1',
                targetSwapId: 'swap-2',
                message: '',
                compatibilityScore: 0,
                createdFromBrowse: false,
                proposalSource: 'direct',
                createdAt: new Date('2024-01-01T10:00:00Z'),
                updatedAt: new Date('2024-01-01T10:00:00Z')
            };

            const mockProposalWithUserInfoRow = {
                id: '1',
                proposal_id: proposalId,
                source_swap_id: 'swap-1',
                target_swap_id: 'swap-2',
                message: '',
                compatibility_score: 0,
                created_from_browse: false,
                proposal_source: 'direct',
                created_at: new Date('2024-01-01T10:00:00Z'),
                updated_at: new Date('2024-01-01T10:00:00Z'),
                proposer_name: 'Test User 1',
                proposer_email: 'user1@test.com',
                target_owner_name: 'Test User 2',
                target_owner_email: 'user2@test.com',
                source_booking_title: 'Test Booking 1',
                target_booking_title: 'Test Booking 2'
            };

            // Mock database responses - separate mocks for each call
            (mockPool.query as any).mockImplementation((query: string) => {
                if (query.includes('INSERT INTO')) {
                    // Return raw database row format for creation
                    const createdRow = {
                        id: '1',
                        proposal_id: proposalId,
                        source_swap_id: 'swap-1',
                        target_swap_id: 'swap-2',
                        message: '',
                        compatibility_score: 0,
                        created_from_browse: false,
                        proposal_source: 'direct',
                        created_at: '2024-01-01T10:00:00Z',
                        updated_at: '2024-01-01T10:00:00Z'
                    };
                    return Promise.resolve({ rows: [createdRow] });
                } else if (query.includes('LEFT JOIN')) {
                    return Promise.resolve({ rows: [mockProposalWithUserInfoRow] });
                }
                return Promise.resolve({ rows: [] });
            });

            // Act
            const createdProposal = await proposalRepository.createProposalMetadata(createRequest);
            const retrievedProposal = await proposalRepository.getProposalByIdWithUserInfo(proposalId);

            // Assert
            expect(createdProposal).toEqual(mockCreatedProposal);
            expect(retrievedProposal?.proposalId).toBe(proposalId);
            expect(retrievedProposal?.proposerName).toBe('Test User 1');
            expect(retrievedProposal?.targetOwnerName).toBe('Test User 2');
        });

        it('should handle proposal retrieval with missing data gracefully', async () => {
            // Arrange
            const proposalId = 'non-existent-proposal';

            (mockPool.query as any).mockResolvedValue({ rows: [] });

            // Act
            const result = await proposalRepository.getProposalByIdWithUserInfo(proposalId);

            // Assert
            expect(result).toBeNull();
        });

        it('should handle database errors gracefully', async () => {
            // Arrange
            const proposalId = 'error-proposal';
            const columnError = new Error('column "proposer_id" does not exist');
            (columnError as any).code = '42703';

            (mockPool.query as any).mockRejectedValue(columnError);

            // Act
            const result = await proposalRepository.getProposalByIdWithUserInfo(proposalId);

            // Assert - Should return null instead of throwing
            expect(result).toBeNull();
        });
    });

    describe('Multi-User Proposal Scenarios', () => {
        it('should retrieve proposals with proper user information derivation', async () => {
            // Arrange
            const mockProposals = [
                {
                    id: '1',
                    proposal_id: 'prop-1',
                    source_swap_id: 'swap-1',
                    target_swap_id: 'swap-2',
                    message: 'Test proposal 1',
                    compatibility_score: 85.0,
                    created_from_browse: true,
                    proposal_source: 'browse',
                    created_at: new Date('2024-01-01T10:00:00Z'),
                    updated_at: new Date('2024-01-01T10:00:00Z'),
                    proposer_name: 'Alice Smith',
                    proposer_email: 'alice@test.com',
                    target_owner_name: 'Bob Johnson',
                    target_owner_email: 'bob@test.com',
                    source_booking_title: 'Alice Booking',
                    target_booking_title: 'Bob Booking',
                    total_count: '2'
                },
                {
                    id: '2',
                    proposal_id: 'prop-2',
                    source_swap_id: 'swap-3',
                    target_swap_id: 'swap-1',
                    message: 'Test proposal 2',
                    compatibility_score: 75.0,
                    created_from_browse: false,
                    proposal_source: 'direct',
                    created_at: new Date('2024-01-01T11:00:00Z'),
                    updated_at: new Date('2024-01-01T11:00:00Z'),
                    proposer_name: 'Charlie Brown',
                    proposer_email: 'charlie@test.com',
                    target_owner_name: 'Alice Smith',
                    target_owner_email: 'alice@test.com',
                    source_booking_title: 'Charlie Booking',
                    target_booking_title: 'Alice Booking',
                    total_count: '2'
                }
            ];

            (mockPool.query as any).mockResolvedValue({ rows: mockProposals });

            // Act
            const result = await proposalRepository.getProposalsWithUserInfo({});

            // Assert
            expect(result.proposals).toHaveLength(2);
            expect(result.totalCount).toBe(2);

            // Verify user information is correctly derived
            const proposal1 = result.proposals[0];
            expect(proposal1.proposerName).toBe('Alice Smith');
            expect(proposal1.targetOwnerName).toBe('Bob Johnson');

            const proposal2 = result.proposals[1];
            expect(proposal2.proposerName).toBe('Charlie Brown');
            expect(proposal2.targetOwnerName).toBe('Alice Smith');
        });

        it('should filter proposals by user correctly', async () => {
            // Arrange
            const userId = 'user-alice';
            const mockFilteredProposals = [
                {
                    id: '1',
                    proposal_id: 'prop-alice-involved',
                    source_swap_id: 'swap-1',
                    target_swap_id: 'swap-2',
                    message: 'Alice involved proposal',
                    compatibility_score: 88.0,
                    created_from_browse: true,
                    proposal_source: 'browse',
                    created_at: new Date('2024-01-01T10:00:00Z'),
                    updated_at: new Date('2024-01-01T10:00:00Z'),
                    proposer_name: 'Alice Smith',
                    proposer_email: 'alice@test.com',
                    target_owner_name: 'Bob Johnson',
                    target_owner_email: 'bob@test.com',
                    source_booking_title: 'Alice Booking',
                    target_booking_title: 'Bob Booking',
                    total_count: '1'
                }
            ];

            (mockPool.query as any).mockResolvedValue({ rows: mockFilteredProposals });

            // Act
            const result = await proposalRepository.getProposalsWithUserInfo({
                userId: userId,
                limit: 10,
                offset: 0
            });

            // Assert
            expect(result.proposals).toHaveLength(1);
            expect(result.proposals[0].proposerName).toBe('Alice Smith');

            // Verify the query was called with the correct user filter
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('source_booking.user_id = $1 OR target_booking.user_id = $1'),
                expect.arrayContaining([userId])
            );
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should handle connection errors gracefully', async () => {
            // Arrange
            const connectionError = new Error('connection refused');
            (connectionError as any).code = 'ECONNREFUSED';

            (mockPool.query as any).mockRejectedValue(connectionError);

            // Act & Assert
            await expect(
                proposalRepository.getProposalByIdWithUserInfo('test-proposal')
            ).rejects.toThrow('Database temporarily unavailable');
        });

        it('should handle constraint violations during creation', async () => {
            // Arrange
            const createRequest: CreateProposalMetadataRequest = {
                proposalId: 'duplicate-proposal',
                sourceSwapId: 'swap-1',
                targetSwapId: 'swap-2',
                proposerId: 'user-1',
                targetOwnerId: 'user-2',
                blockchainTransactionId: 'tx-1'
            };

            const constraintError = new Error('duplicate key value violates unique constraint');
            (constraintError as any).code = '23505';

            (mockPool.query as any).mockRejectedValue(constraintError);

            // Act & Assert
            await expect(
                proposalRepository.createProposalMetadata(createRequest)
            ).rejects.toThrow('Unable to create proposal due to data validation error');
        });

        it('should handle schema column errors with fallback', async () => {
            // Arrange
            const columnError = new Error('column "target_owner_id" does not exist');
            (columnError as any).code = '42703';

            (mockPool.query as any).mockRejectedValue(columnError);

            // Act
            const result = await proposalRepository.getProposalsWithUserInfo({
                targetOwnerId: 'user-1'
            });

            // Assert - Should return empty result instead of throwing
            expect(result.proposals).toHaveLength(0);
            expect(result.totalCount).toBe(0);
            expect(result.hasMore).toBe(false);
        });
    });
});