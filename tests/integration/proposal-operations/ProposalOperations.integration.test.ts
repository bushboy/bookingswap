/**
 * Integration Tests for Proposal Operations
 * Requirements: 3.3, 3.4, 4.2 - Complete proposal workflows including creation, retrieval, acceptance, and rejection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { EnhancedProposalRepository, ProposalWithUserInfo, ProposalQueryFilters } from '../../../apps/backend/src/database/repositories/EnhancedProposalRepository';
import { ProposalAcceptanceService, ProposalAcceptanceRequest } from '../../../apps/backend/src/services/swap/ProposalAcceptanceService';
import { SwapProposalService } from '../../../apps/backend/src/services/swap/SwapProposalService';
import { CreateProposalMetadataRequest, ProposalMetadataEntity } from '../../../apps/backend/src/database/repositories/SwapProposalMetadataRepository';

// Mock logger to avoid console output during tests
vi.mock('../../../apps/backend/src/utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('Proposal Operations Integration Tests', () => {
    let mockPool: Pool;
    let mockClient: any;
    let proposalRepository: EnhancedProposalRepository;
    let mockProposalAcceptanceService: any;
    let mockSwapProposalService: any;

    // Test data for multi-user scenarios
    const testUsers = {
        alice: { id: 'user-alice', name: 'Alice Smith', email: 'alice@example.com' },
        bob: { id: 'user-bob', name: 'Bob Johnson', email: 'bob@example.com' },
        charlie: { id: 'user-charlie', name: 'Charlie Brown', email: 'charlie@example.com' }
    };

    const testSwaps = {
        aliceSwap: { id: 'swap-alice-1', sourceBookingId: 'booking-alice-1' },
        bobSwap: { id: 'swap-bob-1', sourceBookingId: 'booking-bob-1' },
        charlieSwap: { id: 'swap-charlie-1', sourceBookingId: 'booking-charlie-1' }
    };

    const testBookings = {
        alice: { id: 'booking-alice-1', userId: 'user-alice', title: 'Alice Beach House' },
        bob: { id: 'booking-bob-1', userId: 'user-bob', title: 'Bob Mountain Cabin' },
        charlie: { id: 'booking-charlie-1', userId: 'user-charlie', title: 'Charlie City Apartment' }
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

        proposalRepository = new EnhancedProposalRepository(mockPool);

        // Mock ProposalAcceptanceService
        mockProposalAcceptanceService = {
            acceptProposal: vi.fn(),
            rejectProposal: vi.fn(),
            getProposal: vi.fn(),
            validateProposalAccess: vi.fn()
        };

        // Mock SwapProposalService
        mockSwapProposalService = {
            createProposalFromBrowse: vi.fn(),
            createEnhancedProposal: vi.fn(),
            getProposalById: vi.fn(),
            getUserProposals: vi.fn()
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Complete Proposal Creation and Retrieval Workflows', () => {
        it('should create proposal and retrieve it with complete user information', async () => {
            // Arrange - Mock successful proposal creation
            const proposalId = 'prop-integration-test-1';
            const createRequest: CreateProposalMetadataRequest = {
                proposalId,
                sourceSwapId: testSwaps.aliceSwap.id,
                targetSwapId: testSwaps.bobSwap.id,
                proposerId: testUsers.alice.id,
                targetOwnerId: testUsers.bob.id,
                message: 'Integration test proposal',
                compatibilityScore: 85.5,
                createdFromBrowse: true,
                proposalSource: 'browse',
                blockchainTransactionId: 'tx-integration-test'
            };

            const mockCreatedProposal: ProposalMetadataEntity = {
                id: '1',
                proposalId,
                sourceSwapId: testSwaps.aliceSwap.id,
                targetSwapId: testSwaps.bobSwap.id,
                message: 'Integration test proposal',
                compatibilityScore: 85.5,
                createdFromBrowse: true,
                proposalSource: 'browse',
                createdAt: new Date('2024-01-01T10:00:00Z'),
                updatedAt: new Date('2024-01-01T10:00:00Z')
            };

            const mockProposalWithUserInfo: ProposalWithUserInfo = {
                ...mockCreatedProposal,
                proposerName: testUsers.alice.name,
                proposerEmail: testUsers.alice.email,
                targetOwnerName: testUsers.bob.name,
                targetOwnerEmail: testUsers.bob.email,
                sourceBookingTitle: testBookings.alice.title,
                targetBookingTitle: testBookings.bob.title
            };

            // Mock database responses
            (mockPool.query as any)
                .mockResolvedValueOnce({ rows: [mockCreatedProposal] }) // Creation
                .mockResolvedValueOnce({ rows: [mockProposalWithUserInfo] }); // Retrieval with user info

            // Act - Create proposal
            const createdProposal = await proposalRepository.createProposalMetadata(createRequest);

            // Retrieve proposal with user information
            const retrievedProposal = await proposalRepository.getProposalByIdWithUserInfo(proposalId);

            // Assert - Verify complete workflow
            expect(createdProposal).toEqual(mockCreatedProposal);
            expect(retrievedProposal).toEqual(mockProposalWithUserInfo);

            // Verify user information is correctly derived
            expect(retrievedProposal?.proposerName).toBe(testUsers.alice.name);
            expect(retrievedProposal?.proposerEmail).toBe(testUsers.alice.email);
            expect(retrievedProposal?.targetOwnerName).toBe(testUsers.bob.name);
            expect(retrievedProposal?.targetOwnerEmail).toBe(testUsers.bob.email);
            expect(retrievedProposal?.sourceBookingTitle).toBe(testBookings.alice.title);
            expect(retrievedProposal?.targetBookingTitle).toBe(testBookings.bob.title);

            // Verify database calls
            expect(mockPool.query).toHaveBeenCalledTimes(2);
        });

        it('should handle proposal creation workflow with schema column errors gracefully', async () => {
            // Arrange - Mock column not found error during creation
            const proposalId = 'prop-schema-error-test';
            const createRequest: CreateProposalMetadataRequest = {
                proposalId,
                sourceSwapId: testSwaps.aliceSwap.id,
                targetSwapId: testSwaps.bobSwap.id,
                proposerId: testUsers.alice.id,
                targetOwnerId: testUsers.bob.id,
                blockchainTransactionId: 'tx-schema-error'
            };

            const columnError = new Error('column "proposer_id" does not exist');
            (columnError as any).code = '42703';

            (mockPool.query as any).mockRejectedValue(columnError);

            // Act & Assert - Should handle schema errors gracefully
            await expect(
                proposalRepository.createProposalMetadata(createRequest)
            ).rejects.toThrow('Database schema mismatch');

            // Verify error handling was triggered
            expect(mockPool.query).toHaveBeenCalled();
        });

        it('should retrieve proposals with filtering and pagination', async () => {
            // Arrange - Mock multiple proposals for filtering test
            const mockProposals = [
                {
                    id: '1',
                    proposal_id: 'prop-1',
                    source_swap_id: testSwaps.aliceSwap.id,
                    target_swap_id: testSwaps.bobSwap.id,
                    message: 'First proposal',
                    compatibility_score: 90.0,
                    created_from_browse: true,
                    proposal_source: 'browse',
                    created_at: new Date('2024-01-01T10:00:00Z'),
                    updated_at: new Date('2024-01-01T10:00:00Z'),
                    proposer_name: testUsers.alice.name,
                    proposer_email: testUsers.alice.email,
                    target_owner_name: testUsers.bob.name,
                    target_owner_email: testUsers.bob.email,
                    source_booking_title: testBookings.alice.title,
                    target_booking_title: testBookings.bob.title,
                    total_count: '2'
                },
                {
                    id: '2',
                    proposal_id: 'prop-2',
                    source_swap_id: testSwaps.charlieSwap.id,
                    target_swap_id: testSwaps.bobSwap.id,
                    message: 'Second proposal',
                    compatibility_score: 75.0,
                    created_from_browse: false,
                    proposal_source: 'direct',
                    created_at: new Date('2024-01-01T11:00:00Z'),
                    updated_at: new Date('2024-01-01T11:00:00Z'),
                    proposer_name: testUsers.charlie.name,
                    proposer_email: testUsers.charlie.email,
                    target_owner_name: testUsers.bob.name,
                    target_owner_email: testUsers.bob.email,
                    source_booking_title: testBookings.charlie.title,
                    target_booking_title: testBookings.bob.title,
                    total_count: '2'
                }
            ];

            (mockPool.query as any).mockResolvedValue({ rows: mockProposals });

            // Act - Query proposals with filters
            const filters: ProposalQueryFilters = {
                targetOwnerId: testUsers.bob.id,
                limit: 10,
                offset: 0
            };

            const result = await proposalRepository.getProposalsWithUserInfo(filters);

            // Assert - Verify filtered results
            expect(result.proposals).toHaveLength(2);
            expect(result.totalCount).toBe(2);
            expect(result.hasMore).toBe(false);

            // Verify all proposals target Bob
            result.proposals.forEach(proposal => {
                expect(proposal.targetOwnerName).toBe(testUsers.bob.name);
                expect(proposal.targetOwnerEmail).toBe(testUsers.bob.email);
            });

            // Verify different proposers
            expect(result.proposals[0].proposerName).toBe(testUsers.alice.name);
            expect(result.proposals[1].proposerName).toBe(testUsers.charlie.name);
        });
    });

    describe('Proposal Acceptance and Rejection Processes', () => {
        it('should complete proposal acceptance workflow successfully', async () => {
            // Arrange - Mock successful acceptance workflow
            const proposalId = 'prop-acceptance-test';
            const acceptanceRequest: ProposalAcceptanceRequest = {
                proposalId,
                userId: testUsers.bob.id,
                action: 'accept'
            };

            const mockProposal: ProposalWithUserInfo = {
                id: '1',
                proposalId,
                sourceSwapId: testSwaps.aliceSwap.id,
                targetSwapId: testSwaps.bobSwap.id,
                message: 'Test acceptance proposal',
                compatibilityScore: 88.0,
                createdFromBrowse: true,
                proposalSource: 'browse',
                createdAt: new Date('2024-01-01T10:00:00Z'),
                updatedAt: new Date('2024-01-01T10:00:00Z'),
                proposerName: testUsers.alice.name,
                proposerEmail: testUsers.alice.email,
                targetOwnerName: testUsers.bob.name,
                targetOwnerEmail: testUsers.bob.email,
                sourceBookingTitle: testBookings.alice.title,
                targetBookingTitle: testBookings.bob.title
            };

            const mockAcceptanceResult = {
                proposal: mockProposal,
                swap: { id: testSwaps.bobSwap.id, status: 'accepted' },
                blockchainTransaction: {
                    transactionId: 'tx-acceptance-test',
                    consensusTimestamp: '2024-01-01T10:05:00Z'
                }
            };

            // Mock repository and service responses
            (mockPool.query as any).mockResolvedValue({ rows: [mockProposal] });
            mockProposalAcceptanceService.acceptProposal.mockResolvedValue(mockAcceptanceResult);

            // Act - Retrieve proposal and accept it
            const retrievedProposal = await proposalRepository.getProposalByIdWithUserInfo(proposalId);
            expect(retrievedProposal).toEqual(mockProposal);

            const acceptanceResult = await mockProposalAcceptanceService.acceptProposal(acceptanceRequest);

            // Assert - Verify acceptance workflow
            expect(acceptanceResult).toEqual(mockAcceptanceResult);
            expect(acceptanceResult.proposal.proposalId).toBe(proposalId);
            expect(acceptanceResult.swap.status).toBe('accepted');
            expect(acceptanceResult.blockchainTransaction.transactionId).toBeDefined();

            // Verify service was called with correct parameters
            expect(mockProposalAcceptanceService.acceptProposal).toHaveBeenCalledWith(acceptanceRequest);
        });

        it('should complete proposal rejection workflow successfully', async () => {
            // Arrange - Mock successful rejection workflow
            const proposalId = 'prop-rejection-test';
            const rejectionRequest: ProposalAcceptanceRequest = {
                proposalId,
                userId: testUsers.bob.id,
                action: 'reject',
                rejectionReason: 'Dates do not work for me'
            };

            const mockProposal: ProposalWithUserInfo = {
                id: '1',
                proposalId,
                sourceSwapId: testSwaps.aliceSwap.id,
                targetSwapId: testSwaps.bobSwap.id,
                message: 'Test rejection proposal',
                compatibilityScore: 70.0,
                createdFromBrowse: false,
                proposalSource: 'direct',
                createdAt: new Date('2024-01-01T10:00:00Z'),
                updatedAt: new Date('2024-01-01T10:00:00Z'),
                proposerName: testUsers.alice.name,
                proposerEmail: testUsers.alice.email,
                targetOwnerName: testUsers.bob.name,
                targetOwnerEmail: testUsers.bob.email,
                sourceBookingTitle: testBookings.alice.title,
                targetBookingTitle: testBookings.bob.title
            };

            const mockRejectionResult = {
                proposal: { ...mockProposal, status: 'rejected' },
                swap: { id: testSwaps.bobSwap.id, status: 'active' },
                blockchainTransaction: {
                    transactionId: 'tx-rejection-test',
                    consensusTimestamp: '2024-01-01T10:05:00Z'
                }
            };

            // Mock repository and service responses
            (mockPool.query as any).mockResolvedValue({ rows: [mockProposal] });
            mockProposalAcceptanceService.rejectProposal.mockResolvedValue(mockRejectionResult);

            // Act - Retrieve proposal and reject it
            const retrievedProposal = await proposalRepository.getProposalByIdWithUserInfo(proposalId);
            expect(retrievedProposal).toEqual(mockProposal);

            const rejectionResult = await mockProposalAcceptanceService.rejectProposal(rejectionRequest);

            // Assert - Verify rejection workflow
            expect(rejectionResult).toEqual(mockRejectionResult);
            expect(rejectionResult.proposal.proposalId).toBe(proposalId);
            expect(rejectionResult.swap.status).toBe('active'); // Target swap remains active
            expect(rejectionResult.blockchainTransaction.transactionId).toBeDefined();

            // Verify service was called with correct parameters
            expect(mockProposalAcceptanceService.rejectProposal).toHaveBeenCalledWith(rejectionRequest);
        });

        it('should handle proposal acceptance with payment processing', async () => {
            // Arrange - Mock proposal with payment requirements
            const proposalId = 'prop-payment-test';
            const acceptanceRequest: ProposalAcceptanceRequest = {
                proposalId,
                userId: testUsers.bob.id,
                action: 'accept'
            };

            const mockProposalWithPayment: ProposalWithUserInfo = {
                id: '1',
                proposalId,
                sourceSwapId: testSwaps.aliceSwap.id,
                targetSwapId: testSwaps.bobSwap.id,
                message: 'Proposal with additional payment',
                compatibilityScore: 92.0,
                createdFromBrowse: true,
                proposalSource: 'browse',
                createdAt: new Date('2024-01-01T10:00:00Z'),
                updatedAt: new Date('2024-01-01T10:00:00Z'),
                proposerName: testUsers.alice.name,
                proposerEmail: testUsers.alice.email,
                targetOwnerName: testUsers.bob.name,
                targetOwnerEmail: testUsers.bob.email,
                sourceBookingTitle: testBookings.alice.title,
                targetBookingTitle: testBookings.bob.title
            };

            const mockPaymentResult = {
                proposal: mockProposalWithPayment,
                swap: { id: testSwaps.bobSwap.id, status: 'accepted' },
                paymentTransaction: {
                    id: 'payment-tx-test',
                    amount: 150.00,
                    currency: 'EUR',
                    status: 'completed',
                    escrowReleased: true
                },
                blockchainTransaction: {
                    transactionId: 'tx-payment-test',
                    consensusTimestamp: '2024-01-01T10:05:00Z'
                }
            };

            // Mock repository and service responses
            (mockPool.query as any).mockResolvedValue({ rows: [mockProposalWithPayment] });
            mockProposalAcceptanceService.acceptProposal.mockResolvedValue(mockPaymentResult);

            // Act - Accept proposal with payment
            const retrievedProposal = await proposalRepository.getProposalByIdWithUserInfo(proposalId);
            const acceptanceResult = await mockProposalAcceptanceService.acceptProposal(acceptanceRequest);

            // Assert - Verify payment processing
            expect(acceptanceResult.paymentTransaction).toBeDefined();
            expect(acceptanceResult.paymentTransaction.status).toBe('completed');
            expect(acceptanceResult.paymentTransaction.escrowReleased).toBe(true);
            expect(acceptanceResult.proposal.proposalId).toBe(proposalId);
        });

        it('should handle proposal acceptance errors with rollback', async () => {
            // Arrange - Mock acceptance failure requiring rollback
            const proposalId = 'prop-rollback-test';
            const acceptanceRequest: ProposalAcceptanceRequest = {
                proposalId,
                userId: testUsers.bob.id,
                action: 'accept'
            };

            const mockProposal: ProposalWithUserInfo = {
                id: '1',
                proposalId,
                sourceSwapId: testSwaps.aliceSwap.id,
                targetSwapId: testSwaps.bobSwap.id,
                message: 'Test rollback proposal',
                compatibilityScore: 85.0,
                createdFromBrowse: true,
                proposalSource: 'browse',
                createdAt: new Date('2024-01-01T10:00:00Z'),
                updatedAt: new Date('2024-01-01T10:00:00Z'),
                proposerName: testUsers.alice.name,
                proposerEmail: testUsers.alice.email,
                targetOwnerName: testUsers.bob.name,
                targetOwnerEmail: testUsers.bob.email,
                sourceBookingTitle: testBookings.alice.title,
                targetBookingTitle: testBookings.bob.title
            };

            // Mock repository success but service failure
            (mockPool.query as any).mockResolvedValue({ rows: [mockProposal] });

            const acceptanceError = new Error('Payment processing failed');
            (acceptanceError as any).code = 'PAYMENT_FAILED';
            mockProposalAcceptanceService.acceptProposal.mockRejectedValue(acceptanceError);

            // Act & Assert - Should handle rollback gracefully
            const retrievedProposal = await proposalRepository.getProposalByIdWithUserInfo(proposalId);
            expect(retrievedProposal).toEqual(mockProposal);

            await expect(
                mockProposalAcceptanceService.acceptProposal(acceptanceRequest)
            ).rejects.toThrow('Payment processing failed');

            // Verify service was called
            expect(mockProposalAcceptanceService.acceptProposal).toHaveBeenCalledWith(acceptanceRequest);
        });
    });

    describe('Multi-User Proposal Scenarios with Data Derivation', () => {
        it('should handle complex multi-user proposal scenario with proper data derivation', async () => {
            // Arrange - Complex scenario: Alice proposes to Bob, Charlie proposes to Alice, Bob proposes to Charlie
            const proposals = [
                {
                    id: '1',
                    proposal_id: 'prop-alice-to-bob',
                    source_swap_id: testSwaps.aliceSwap.id,
                    target_swap_id: testSwaps.bobSwap.id,
                    message: 'Alice to Bob proposal',
                    compatibility_score: 88.0,
                    created_from_browse: true,
                    proposal_source: 'browse',
                    created_at: new Date('2024-01-01T10:00:00Z'),
                    updated_at: new Date('2024-01-01T10:00:00Z'),
                    proposer_name: testUsers.alice.name,
                    proposer_email: testUsers.alice.email,
                    target_owner_name: testUsers.bob.name,
                    target_owner_email: testUsers.bob.email,
                    source_booking_title: testBookings.alice.title,
                    target_booking_title: testBookings.bob.title,
                    total_count: '3'
                },
                {
                    id: '2',
                    proposal_id: 'prop-charlie-to-alice',
                    source_swap_id: testSwaps.charlieSwap.id,
                    target_swap_id: testSwaps.aliceSwap.id,
                    message: 'Charlie to Alice proposal',
                    compatibility_score: 75.0,
                    created_from_browse: false,
                    proposal_source: 'direct',
                    created_at: new Date('2024-01-01T11:00:00Z'),
                    updated_at: new Date('2024-01-01T11:00:00Z'),
                    proposer_name: testUsers.charlie.name,
                    proposer_email: testUsers.charlie.email,
                    target_owner_name: testUsers.alice.name,
                    target_owner_email: testUsers.alice.email,
                    source_booking_title: testBookings.charlie.title,
                    target_booking_title: testBookings.alice.title,
                    total_count: '3'
                },
                {
                    id: '3',
                    proposal_id: 'prop-bob-to-charlie',
                    source_swap_id: testSwaps.bobSwap.id,
                    target_swap_id: testSwaps.charlieSwap.id,
                    message: 'Bob to Charlie proposal',
                    compatibility_score: 92.0,
                    created_from_browse: true,
                    proposal_source: 'browse',
                    created_at: new Date('2024-01-01T12:00:00Z'),
                    updated_at: new Date('2024-01-01T12:00:00Z'),
                    proposer_name: testUsers.bob.name,
                    proposer_email: testUsers.bob.email,
                    target_owner_name: testUsers.charlie.name,
                    target_owner_email: testUsers.charlie.email,
                    source_booking_title: testBookings.bob.title,
                    target_booking_title: testBookings.charlie.title,
                    total_count: '3'
                }
            ];

            (mockPool.query as any).mockResolvedValue({ rows: proposals });

            // Act - Query all proposals
            const result = await proposalRepository.getProposalsWithUserInfo({});

            // Assert - Verify multi-user data derivation
            expect(result.proposals).toHaveLength(3);
            expect(result.totalCount).toBe(3);

            // Verify Alice to Bob proposal
            const aliceToBob = result.proposals.find(p => p.proposalId === 'prop-alice-to-bob');
            expect(aliceToBob?.proposerName).toBe(testUsers.alice.name);
            expect(aliceToBob?.proposerEmail).toBe(testUsers.alice.email);
            expect(aliceToBob?.targetOwnerName).toBe(testUsers.bob.name);
            expect(aliceToBob?.targetOwnerEmail).toBe(testUsers.bob.email);
            expect(aliceToBob?.sourceBookingTitle).toBe(testBookings.alice.title);
            expect(aliceToBob?.targetBookingTitle).toBe(testBookings.bob.title);

            // Verify Charlie to Alice proposal
            const charlieToAlice = result.proposals.find(p => p.proposalId === 'prop-charlie-to-alice');
            expect(charlieToAlice?.proposerName).toBe(testUsers.charlie.name);
            expect(charlieToAlice?.proposerEmail).toBe(testUsers.charlie.email);
            expect(charlieToAlice?.targetOwnerName).toBe(testUsers.alice.name);
            expect(charlieToAlice?.targetOwnerEmail).toBe(testUsers.alice.email);
            expect(charlieToAlice?.sourceBookingTitle).toBe(testBookings.charlie.title);
            expect(charlieToAlice?.targetBookingTitle).toBe(testBookings.alice.title);

            // Verify Bob to Charlie proposal
            const bobToCharlie = result.proposals.find(p => p.proposalId === 'prop-bob-to-charlie');
            expect(bobToCharlie?.proposerName).toBe(testUsers.bob.name);
            expect(bobToCharlie?.proposerEmail).toBe(testUsers.bob.email);
            expect(bobToCharlie?.targetOwnerName).toBe(testUsers.charlie.name);
            expect(bobToCharlie?.targetOwnerEmail).toBe(testUsers.charlie.email);
            expect(bobToCharlie?.sourceBookingTitle).toBe(testBookings.bob.title);
            expect(bobToCharlie?.targetBookingTitle).toBe(testBookings.charlie.title);

            // Verify all users have different roles in different proposals
            const proposerNames = result.proposals.map(p => p.proposerName);
            const targetNames = result.proposals.map(p => p.targetOwnerName);

            expect(proposerNames).toContain(testUsers.alice.name);
            expect(proposerNames).toContain(testUsers.bob.name);
            expect(proposerNames).toContain(testUsers.charlie.name);

            expect(targetNames).toContain(testUsers.alice.name);
            expect(targetNames).toContain(testUsers.bob.name);
            expect(targetNames).toContain(testUsers.charlie.name);
        });

        it('should filter proposals by user correctly in multi-user scenario', async () => {
            // Arrange - Mock proposals where Bob is involved as both proposer and target
            const bobProposals = [
                {
                    id: '1',
                    proposal_id: 'prop-bob-as-proposer',
                    source_swap_id: testSwaps.bobSwap.id,
                    target_swap_id: testSwaps.aliceSwap.id,
                    message: 'Bob proposing to Alice',
                    compatibility_score: 85.0,
                    created_from_browse: true,
                    proposal_source: 'browse',
                    created_at: new Date('2024-01-01T10:00:00Z'),
                    updated_at: new Date('2024-01-01T10:00:00Z'),
                    proposer_name: testUsers.bob.name,
                    proposer_email: testUsers.bob.email,
                    target_owner_name: testUsers.alice.name,
                    target_owner_email: testUsers.alice.email,
                    source_booking_title: testBookings.bob.title,
                    target_booking_title: testBookings.alice.title,
                    total_count: '2'
                },
                {
                    id: '2',
                    proposal_id: 'prop-charlie-to-bob',
                    source_swap_id: testSwaps.charlieSwap.id,
                    target_swap_id: testSwaps.bobSwap.id,
                    message: 'Charlie proposing to Bob',
                    compatibility_score: 78.0,
                    created_from_browse: false,
                    proposal_source: 'direct',
                    created_at: new Date('2024-01-01T11:00:00Z'),
                    updated_at: new Date('2024-01-01T11:00:00Z'),
                    proposer_name: testUsers.charlie.name,
                    proposer_email: testUsers.charlie.email,
                    target_owner_name: testUsers.bob.name,
                    target_owner_email: testUsers.bob.email,
                    source_booking_title: testBookings.charlie.title,
                    target_booking_title: testBookings.bob.title,
                    total_count: '2'
                }
            ];

            (mockPool.query as any).mockResolvedValue({ rows: bobProposals });

            // Act - Query proposals involving Bob
            const filters: ProposalQueryFilters = {
                userId: testUsers.bob.id, // Bob as either proposer or target
                limit: 10,
                offset: 0
            };

            const result = await proposalRepository.getProposalsWithUserInfo(filters);

            // Assert - Verify Bob appears in both roles
            expect(result.proposals).toHaveLength(2);
            expect(result.totalCount).toBe(2);

            // Verify Bob as proposer
            const bobAsProposer = result.proposals.find(p => p.proposalId === 'prop-bob-as-proposer');
            expect(bobAsProposer?.proposerName).toBe(testUsers.bob.name);
            expect(bobAsProposer?.targetOwnerName).toBe(testUsers.alice.name);

            // Verify Bob as target
            const bobAsTarget = result.proposals.find(p => p.proposalId === 'prop-charlie-to-bob');
            expect(bobAsTarget?.proposerName).toBe(testUsers.charlie.name);
            expect(bobAsTarget?.targetOwnerName).toBe(testUsers.bob.name);

            // Verify database query used correct filter
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('source_booking.user_id = $1 OR target_booking.user_id = $1'),
                expect.arrayContaining([testUsers.bob.id])
            );
        });

        it('should handle user proposal statistics across multiple users', async () => {
            // Arrange - Mock statistics for Alice across multiple proposals
            const mockStatsRow = {
                total_proposed: '3', // Alice made 3 proposals
                total_received: '2', // Alice received 2 proposals
                browse_proposals: '2', // 2 from browse
                direct_proposals: '1', // 1 direct
                auction_proposals: '0', // 0 from auction
                avg_compatibility_score: '84.5' // Average score
            };

            (mockPool.query as any).mockResolvedValue({ rows: [mockStatsRow] });

            // Act - Get Alice's proposal statistics
            const stats = await proposalRepository.getUserProposalStats(testUsers.alice.id);

            // Assert - Verify multi-user statistics
            expect(stats.totalProposed).toBe(3);
            expect(stats.totalReceived).toBe(2);
            expect(stats.browseProposals).toBe(2);
            expect(stats.directProposals).toBe(1);
            expect(stats.auctionProposals).toBe(0);
            expect(stats.averageCompatibilityScore).toBe(84.5);

            // Verify database query used correct user ID
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('proposer_id = $1'),
                [testUsers.alice.id]
            );
        });

        it('should handle schema errors gracefully in multi-user scenarios', async () => {
            // Arrange - Mock column not found error in multi-user query
            const columnError = new Error('column "target_owner_id" does not exist');
            (columnError as any).code = '42703';

            (mockPool.query as any).mockRejectedValue(columnError);

            // Act - Query should handle error gracefully
            const result = await proposalRepository.getProposalsWithUserInfo({
                userId: testUsers.alice.id
            });

            // Assert - Should return empty result instead of throwing
            expect(result.proposals).toHaveLength(0);
            expect(result.totalCount).toBe(0);
            expect(result.hasMore).toBe(false);

            // Verify error was handled
            expect(mockPool.query).toHaveBeenCalled();
        });

        it('should validate data consistency across multi-user proposal relationships', async () => {
            // Arrange - Mock proposals with potential data inconsistencies
            const inconsistentProposals = [
                {
                    id: '1',
                    proposal_id: 'prop-consistent',
                    source_swap_id: testSwaps.aliceSwap.id,
                    target_swap_id: testSwaps.bobSwap.id,
                    message: 'Consistent proposal',
                    compatibility_score: 85.0,
                    created_from_browse: true,
                    proposal_source: 'browse',
                    created_at: new Date('2024-01-01T10:00:00Z'),
                    updated_at: new Date('2024-01-01T10:00:00Z'),
                    proposer_name: testUsers.alice.name,
                    proposer_email: testUsers.alice.email,
                    target_owner_name: testUsers.bob.name,
                    target_owner_email: testUsers.bob.email,
                    source_booking_title: testBookings.alice.title,
                    target_booking_title: testBookings.bob.title,
                    total_count: '2'
                },
                {
                    id: '2',
                    proposal_id: 'prop-missing-data',
                    source_swap_id: testSwaps.charlieSwap.id,
                    target_swap_id: testSwaps.aliceSwap.id,
                    message: 'Proposal with missing user data',
                    compatibility_score: 75.0,
                    created_from_browse: false,
                    proposal_source: 'direct',
                    created_at: new Date('2024-01-01T11:00:00Z'),
                    updated_at: new Date('2024-01-01T11:00:00Z'),
                    proposer_name: null, // Missing proposer name
                    proposer_email: null, // Missing proposer email
                    target_owner_name: testUsers.alice.name,
                    target_owner_email: testUsers.alice.email,
                    source_booking_title: null, // Missing booking title
                    target_booking_title: testBookings.alice.title,
                    total_count: '2'
                }
            ];

            (mockPool.query as any).mockResolvedValue({ rows: inconsistentProposals });

            // Act - Query proposals with missing data
            const result = await proposalRepository.getProposalsWithUserInfo({});

            // Assert - Should handle missing data gracefully
            expect(result.proposals).toHaveLength(2);

            // Verify consistent proposal has all data
            const consistentProposal = result.proposals.find(p => p.proposalId === 'prop-consistent');
            expect(consistentProposal?.proposerName).toBe(testUsers.alice.name);
            expect(consistentProposal?.proposerEmail).toBe(testUsers.alice.email);
            expect(consistentProposal?.sourceBookingTitle).toBe(testBookings.alice.title);

            // Verify proposal with missing data still returns (with null values)
            const inconsistentProposal = result.proposals.find(p => p.proposalId === 'prop-missing-data');
            expect(inconsistentProposal?.proposerName).toBeUndefined();
            expect(inconsistentProposal?.proposerEmail).toBeUndefined();
            expect(inconsistentProposal?.sourceBookingTitle).toBeUndefined();
            expect(inconsistentProposal?.targetOwnerName).toBe(testUsers.alice.name); // This should still be present
        });
    });

    describe('Performance and Error Recovery in Integration Scenarios', () => {
        it('should handle large numbers of proposals efficiently', async () => {
            // Arrange - Mock large dataset
            const largeProposalSet = Array.from({ length: 50 }, (_, i) => ({
                id: `${i + 1}`,
                proposal_id: `prop-${i + 1}`,
                source_swap_id: `swap-${i + 1}`,
                target_swap_id: testSwaps.bobSwap.id,
                message: `Proposal ${i + 1}`,
                compatibility_score: 70 + (i % 30),
                created_from_browse: i % 2 === 0,
                proposal_source: i % 2 === 0 ? 'browse' : 'direct',
                created_at: new Date(`2024-01-01T${10 + (i % 14)}:00:00Z`),
                updated_at: new Date(`2024-01-01T${10 + (i % 14)}:00:00Z`),
                proposer_name: `User ${i + 1}`,
                proposer_email: `user${i + 1}@example.com`,
                target_owner_name: testUsers.bob.name,
                target_owner_email: testUsers.bob.email,
                source_booking_title: `Booking ${i + 1}`,
                target_booking_title: testBookings.bob.title,
                total_count: '50'
            }));

            (mockPool.query as any).mockResolvedValue({ rows: largeProposalSet });

            // Act - Query large dataset with timing
            const startTime = Date.now();
            const result = await proposalRepository.getProposalsWithUserInfo({
                targetOwnerId: testUsers.bob.id,
                limit: 50,
                offset: 0
            });
            const queryTime = Date.now() - startTime;

            // Assert - Verify performance and data integrity
            expect(result.proposals).toHaveLength(50);
            expect(result.totalCount).toBe(50);
            expect(queryTime).toBeLessThan(1000); // Should complete within 1 second

            // Verify all proposals have consistent target owner
            result.proposals.forEach(proposal => {
                expect(proposal.targetOwnerName).toBe(testUsers.bob.name);
                expect(proposal.targetOwnerEmail).toBe(testUsers.bob.email);
                expect(proposal.targetBookingTitle).toBe(testBookings.bob.title);
            });

            // Verify proposer data is unique for each proposal
            const proposerNames = result.proposals.map(p => p.proposerName);
            const uniqueProposerNames = new Set(proposerNames);
            expect(uniqueProposerNames.size).toBe(50); // All should be unique
        });

        it('should recover from database connection errors during proposal operations', async () => {
            // Arrange - Mock connection error followed by recovery
            const connectionError = new Error('connection refused');
            (connectionError as any).code = 'ECONNREFUSED';

            const mockProposal: ProposalWithUserInfo = {
                id: '1',
                proposalId: 'prop-recovery-test',
                sourceSwapId: testSwaps.aliceSwap.id,
                targetSwapId: testSwaps.bobSwap.id,
                message: 'Recovery test proposal',
                compatibilityScore: 80.0,
                createdFromBrowse: true,
                proposalSource: 'browse',
                createdAt: new Date('2024-01-01T10:00:00Z'),
                updatedAt: new Date('2024-01-01T10:00:00Z'),
                proposerName: testUsers.alice.name,
                proposerEmail: testUsers.alice.email,
                targetOwnerName: testUsers.bob.name,
                targetOwnerEmail: testUsers.bob.email,
                sourceBookingTitle: testBookings.alice.title,
                targetBookingTitle: testBookings.bob.title
            };

            (mockPool.query as any)
                .mockRejectedValueOnce(connectionError) // First call fails
                .mockResolvedValueOnce({ rows: [mockProposal] }); // Second call succeeds

            // Act & Assert - First call should throw user-friendly error
            await expect(
                proposalRepository.getProposalByIdWithUserInfo('prop-recovery-test')
            ).rejects.toThrow('Database temporarily unavailable');

            // Second call should succeed
            const result = await proposalRepository.getProposalByIdWithUserInfo('prop-recovery-test');
            expect(result).toEqual(mockProposal);
        });
    });
});