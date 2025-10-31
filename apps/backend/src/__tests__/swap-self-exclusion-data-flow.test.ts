import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../index';
import {
    BookingType,
    EnhancedCreateSwapRequest,
    CreateEnhancedProposalRequest
} from '@booking-swap/shared';
import { logger } from '../utils/logger';

/**
 * Test suite for swap self-exclusion data flow validation
 * Requirements: 1.1, 1.2, 2.3, 2.5
 * 
 * This test suite verifies that:
 * 1. Self-proposals are filtered out at the database level
 * 2. Multiple proposals per swap scenario works correctly
 * 3. User swaps and proposals from others are properly displayed
 * 4. The complete data flow from database to API response is correct
 */
describe('Swap Self-Exclusion Data Flow Tests', () => {
    let app: any;
    let server: any;

    // Test users
    let user1: { id: string; token: string; email: string };
    let user2: { id: string; token: string; email: string };
    let user3: { id: string; token: string; email: string };

    beforeAll(async () => {
        // Set test environment variables
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = 'test-secret-key';
        process.env.HEDERA_ACCOUNT_ID = '0.0.123456';
        process.env.HEDERA_PRIVATE_KEY = '302e020100300506032b657004220420abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
        process.env.HEDERA_NETWORK = 'testnet';

        // Initialize the app
        const appResult = await createApp();
        app = appResult.app;
        server = appResult.server;

        // Create test users
        user1 = await createTestUser('dataflow1@test.com', 'DataFlow User One');
        user2 = await createTestUser('dataflow2@test.com', 'DataFlow User Two');
        user3 = await createTestUser('dataflow3@test.com', 'DataFlow User Three');

        logger.info('Test users created', {
            user1: user1.id,
            user2: user2.id,
            user3: user3.id
        });
    });

    describe('Database Level Self-Proposal Filtering', () => {
        it('should filter out self-proposals at the database level', async () => {
            // Create bookings and swaps for user1
            const user1Booking1 = await createTestBooking(user1.token, 'Paris Hotel', 'Paris', 'France', 500);
            const user1Booking2 = await createTestBooking(user1.token, 'London Hotel', 'London', 'UK', 600);
            const user1Swap1 = await createTestSwap(user1.token, user1Booking1, 'Paris Hotel Swap');

            // Create proposals from other users to user1's swaps
            const user2Booking1 = await createTestBooking(user2.token, 'Berlin Hotel', 'Berlin', 'Germany', 400);
            const user3Booking1 = await createTestBooking(user3.token, 'Tokyo Hotel', 'Tokyo', 'Japan', 700);

            await createTestProposal(user2.token, user1Swap1, user2Booking1, 'Proposal from User2');
            await createTestProposal(user3.token, user1Swap1, user3Booking1, 'Proposal from User3');

            // Attempt to create a self-proposal (this should be prevented or filtered)
            try {
                await createTestProposal(user1.token, user1Swap1, user1Booking2, 'Self-proposal attempt');
                logger.warn('Self-proposal creation succeeded - this should be prevented');
            } catch (error) {
                // Self-proposal creation should fail, which is expected
                logger.info('Self-proposal creation failed as expected', { error: error.message });
            }

            // Test the API endpoint to ensure filtering works
            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.swapCards).toHaveLength(1);

            const swapCard = response.body.data.swapCards[0];

            // Verify that only proposals from other users are returned
            expect(swapCard.proposalsFromOthers.length).toBeGreaterThan(0);

            // Check that all proposals are from other users (not user1)
            for (const proposal of swapCard.proposalsFromOthers) {
                expect(proposal.proposerId).not.toBe(user1.id);
                expect([user2.id, user3.id]).toContain(proposal.proposerId);
            }

            // Verify metadata indicates self-proposals were filtered
            expect(response.body.metadata.dataQuality.selfProposalsFiltered).toBe(true);

            logger.info('Database level filtering verified', {
                proposalCount: swapCard.proposalsFromOthers.length,
                proposerIds: swapCard.proposalsFromOthers.map(p => p.proposerId)
            });
        });

        it('should handle multiple proposals per swap correctly', async () => {
            // Create bookings and swap for user1
            const user1Booking = await createTestBooking(user1.token, 'Multi Proposal Hotel', 'Paris', 'France', 500);
            const user1Swap = await createTestSwap(user1.token, user1Booking, 'Multi Proposal Swap');

            // Create multiple proposals from different users
            const user2Booking1 = await createTestBooking(user2.token, 'User2 Hotel 1', 'Berlin', 'Germany', 400);
            const user2Booking2 = await createTestBooking(user2.token, 'User2 Hotel 2', 'Rome', 'Italy', 550);
            const user3Booking = await createTestBooking(user3.token, 'User3 Hotel', 'Madrid', 'Spain', 450);

            await createTestProposal(user2.token, user1Swap, user2Booking1, 'First proposal from User2');
            await createTestProposal(user2.token, user1Swap, user2Booking2, 'Second proposal from User2');
            await createTestProposal(user3.token, user1Swap, user3Booking, 'Proposal from User3');

            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            const swapCard = response.body.data.swapCards.find(card => card.userSwap.id === user1Swap);
            expect(swapCard).toBeDefined();

            // Should have 3 proposals
            expect(swapCard.proposalCount).toBe(3);
            expect(swapCard.proposalsFromOthers).toHaveLength(3);

            // Verify all proposals are from other users
            const proposerIds = swapCard.proposalsFromOthers.map(p => p.proposerId);
            expect(proposerIds).not.toContain(user1.id);
            expect(proposerIds).toContain(user2.id);
            expect(proposerIds).toContain(user3.id);

            // Verify proposal data integrity
            for (const proposal of swapCard.proposalsFromOthers) {
                expect(proposal.id).toBeTruthy();
                expect(proposal.proposerId).toBeTruthy();
                expect(proposal.proposerName).toBeTruthy();
                expect(proposal.targetBookingDetails).toBeDefined();
                expect(proposal.targetBookingDetails.title).toBeTruthy();
            }

            logger.info('Multiple proposals per swap verified', {
                swapId: user1Swap,
                proposalCount: swapCard.proposalCount,
                proposerIds
            });
        });

        it('should properly separate user swaps from proposals in API response', async () => {
            // Create multiple swaps for user1
            const user1Booking1 = await createTestBooking(user1.token, 'Separation Hotel 1', 'Paris', 'France', 500);
            const user1Booking2 = await createTestBooking(user1.token, 'Separation Hotel 2', 'London', 'UK', 600);
            const user1Swap1 = await createTestSwap(user1.token, user1Booking1, 'Separation Swap 1');
            const user1Swap2 = await createTestSwap(user1.token, user1Booking2, 'Separation Swap 2');

            // Create proposals for both swaps
            const user2Booking = await createTestBooking(user2.token, 'User2 Proposal Hotel', 'Berlin', 'Germany', 400);
            const user3Booking = await createTestBooking(user3.token, 'User3 Proposal Hotel', 'Madrid', 'Spain', 450);

            await createTestProposal(user2.token, user1Swap1, user2Booking, 'Proposal for Swap1');
            await createTestProposal(user3.token, user1Swap2, user3Booking, 'Proposal for Swap2');

            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            expect(response.body.data.swapCards).toHaveLength(2);

            // Verify data separation for each swap card
            for (const card of response.body.data.swapCards) {
                // Verify user swap data (left side of card)
                expect(card.userSwap).toBeDefined();
                expect(card.userSwap.id).toBeTruthy();
                expect(card.userSwap.bookingDetails).toBeDefined();
                expect(card.userSwap.bookingDetails.title).toBeTruthy();
                expect(card.userSwap.status).toBeTruthy();
                expect(card.userSwap.createdAt).toBeTruthy();

                // Verify proposals from others (right side of card)
                expect(card.proposalsFromOthers).toBeDefined();
                expect(Array.isArray(card.proposalsFromOthers)).toBe(true);
                expect(card.proposalCount).toBe(card.proposalsFromOthers.length);

                // Verify all proposals are from other users
                for (const proposal of card.proposalsFromOthers) {
                    expect(proposal.proposerId).not.toBe(user1.id);
                    expect(proposal.proposerName).toBeTruthy();
                    expect(proposal.targetBookingDetails).toBeDefined();
                }
            }

            logger.info('Data separation verified', {
                swapCount: response.body.data.swapCards.length,
                totalProposals: response.body.metadata.dataQuality.totalProposals
            });
        });
    });

    describe('Service Layer Data Flow', () => {
        it('should return properly structured swap card data through service layer', async () => {
            // Create test data
            const user1Booking1 = await createTestBooking(user1.token, 'Service Test Hotel 1', 'Paris', 'France', 500);
            const user1Booking2 = await createTestBooking(user1.token, 'Service Test Hotel 2', 'London', 'UK', 600);
            const user1Swap1 = await createTestSwap(user1.token, user1Booking1, 'Service Test Swap 1');
            const user1Swap2 = await createTestSwap(user1.token, user1Booking2, 'Service Test Swap 2');

            // Create test proposals
            const user2Booking1 = await createTestBooking(user2.token, 'User2 Service Hotel 1', 'Berlin', 'Germany', 400);
            const user2Booking2 = await createTestBooking(user2.token, 'User2 Service Hotel 2', 'Rome', 'Italy', 550);
            const user3Booking = await createTestBooking(user3.token, 'User3 Service Hotel', 'Madrid', 'Spain', 450);

            await createTestProposal(user2.token, user1Swap1, user2Booking1, 'Service test proposal 1');
            await createTestProposal(user3.token, user1Swap1, user3Booking, 'Service test proposal 2');
            await createTestProposal(user2.token, user1Swap2, user2Booking2, 'Service test proposal 3');

            // Test the service method through API endpoint
            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.swapCards).toBeDefined();
            expect(Array.isArray(response.body.data.swapCards)).toBe(true);

            const swapCards = response.body.data.swapCards;
            expect(swapCards.length).toBe(2); // user1 has 2 swaps

            // Verify structure of each swap card
            for (const card of swapCards) {
                // Verify user swap structure (left side of card)
                expect(card.userSwap).toBeDefined();
                expect(card.userSwap.id).toBeTruthy();
                expect(card.userSwap.bookingDetails).toBeDefined();
                expect(card.userSwap.status).toBeTruthy();
                expect(card.userSwap.createdAt).toBeTruthy();

                // Verify proposals from others structure (right side of card)
                expect(card.proposalsFromOthers).toBeDefined();
                expect(Array.isArray(card.proposalsFromOthers)).toBe(true);
                expect(card.proposalCount).toBeDefined();
                expect(card.proposalCount).toBe(card.proposalsFromOthers.length);

                // Verify no self-proposals in the proposals list
                for (const proposal of card.proposalsFromOthers) {
                    expect(proposal.proposerId).not.toBe(user1.id);
                    expect(proposal.proposerName).toBeTruthy();
                    expect(proposal.targetBookingDetails).toBeDefined();
                }

                // Verify card metadata
                expect(card.cardMetadata).toBeDefined();
                expect(card.cardMetadata.hasProposals).toBe(card.proposalCount > 0);
                expect(card.cardMetadata.proposalStatus).toBeTruthy();
            }

            // Verify metadata
            expect(response.body.metadata).toBeDefined();
            expect(response.body.metadata.dataQuality.selfProposalsFiltered).toBe(true);
            expect(response.body.metadata.dataQuality.totalSwaps).toBe(2);
            expect(response.body.metadata.dataQuality.totalProposals).toBe(3);

            logger.info('Service layer data flow verified', {
                swapCardCount: swapCards.length,
                totalProposals: response.body.metadata.dataQuality.totalProposals
            });
        });

        it('should handle swaps with no proposals correctly', async () => {
            // Create swaps without any proposals
            const user1Booking1 = await createTestBooking(user1.token, 'No Proposals Hotel 1', 'Paris', 'France', 500);
            const user1Booking2 = await createTestBooking(user1.token, 'No Proposals Hotel 2', 'London', 'UK', 600);
            await createTestSwap(user1.token, user1Booking1, 'No Proposals Swap 1');
            await createTestSwap(user1.token, user1Booking2, 'No Proposals Swap 2');

            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            const swapCards = response.body.data.swapCards;
            expect(swapCards.length).toBe(2);

            // Verify each swap card has empty proposals
            for (const card of swapCards) {
                expect(card.proposalsFromOthers).toEqual([]);
                expect(card.proposalCount).toBe(0);
                expect(card.cardMetadata.hasProposals).toBe(false);
                expect(card.cardMetadata.proposalStatus).toBe('no_proposals');
            }

            // Verify metadata reflects no proposals
            expect(response.body.metadata.dataQuality.totalProposals).toBe(0);
            expect(response.body.metadata.dataQuality.swapsWithoutProposals).toBe(2);

            logger.info('Empty proposals scenario verified');
        });
    });

    describe('API Response Structure Validation', () => {
        it('should return consistent API response structure with proper metadata', async () => {
            // Create varied test data
            const user1Booking1 = await createTestBooking(user1.token, 'API Test Hotel 1', 'Paris', 'France', 500);
            const user1Booking2 = await createTestBooking(user1.token, 'API Test Hotel 2', 'London', 'UK', 600);
            const user1Swap1 = await createTestSwap(user1.token, user1Booking1, 'API Test Swap 1');
            await createTestSwap(user1.token, user1Booking2, 'API Test Swap 2'); // No proposals for this one

            const user2Booking = await createTestBooking(user2.token, 'User2 API Hotel', 'Berlin', 'Germany', 400);
            const user3Booking = await createTestBooking(user3.token, 'User3 API Hotel', 'Madrid', 'Spain', 450);

            await createTestProposal(user2.token, user1Swap1, user2Booking, 'API test proposal 1');
            await createTestProposal(user3.token, user1Swap1, user3Booking, 'API test proposal 2');

            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            // Verify top-level response structure
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('metadata');

            // Verify data structure
            const { data } = response.body;
            expect(data).toHaveProperty('swapCards');
            expect(Array.isArray(data.swapCards)).toBe(true);

            // Verify metadata structure
            const { metadata } = response.body;
            expect(metadata).toHaveProperty('requestId');
            expect(metadata).toHaveProperty('timestamp');
            expect(metadata).toHaveProperty('performance');
            expect(metadata).toHaveProperty('dataQuality');
            expect(metadata).toHaveProperty('pagination');
            expect(metadata).toHaveProperty('summary');

            // Verify data quality metadata
            const { dataQuality } = metadata;
            expect(dataQuality).toHaveProperty('totalSwaps', 2);
            expect(dataQuality).toHaveProperty('totalProposals', 2);
            expect(dataQuality).toHaveProperty('swapsWithProposals', 1);
            expect(dataQuality).toHaveProperty('swapsWithoutProposals', 1);
            expect(dataQuality).toHaveProperty('selfProposalsFiltered', true);
            expect(dataQuality).toHaveProperty('dataStructure', 'swap_cards');
            expect(dataQuality).toHaveProperty('dataIntegrity', 'verified');

            // Verify summary metadata
            const { summary } = metadata;
            expect(summary).toHaveProperty('activeSwaps');
            expect(summary).toHaveProperty('pendingSwaps');
            expect(summary).toHaveProperty('completedSwaps');
            expect(summary).toHaveProperty('averageProposalsPerSwap');

            logger.info('API response structure validated', {
                dataQuality,
                summary
            });
        });
    });

    // Helper functions
    async function createTestUser(email: string, name: string): Promise<{ id: string; token: string; email: string }> {
        const username = name.toLowerCase().replace(/\s+/g, '');

        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
                username,
                email,
                password: 'password123'
            });

        let token, userId;
        if (registerResponse.status === 201) {
            token = registerResponse.body.token;
            userId = registerResponse.body.user?.id;
        } else {
            // Try email login if user exists
            const loginResponse = await request(app)
                .post('/api/auth/email-login')
                .send({
                    email,
                    password: 'password123'
                });

            if (loginResponse.status === 200) {
                token = loginResponse.body.token;
                userId = loginResponse.body.user?.id;
            } else {
                throw new Error(`Failed to create or login user: Register: ${registerResponse.status} ${JSON.stringify(registerResponse.body)}, Login: ${loginResponse.status} ${JSON.stringify(loginResponse.body)}`);
            }
        }

        if (!token || !userId) {
            throw new Error(`Invalid user creation response: token=${token}, userId=${userId}`);
        }

        return { id: userId, token, email };
    }

    async function createTestBooking(token: string, title: string, city: string, country: string, price: number): Promise<string> {
        const response = await request(app)
            .post('/api/bookings')
            .set('Authorization', `Bearer ${token}`)
            .send({
                type: 'hotel' as BookingType,
                title,
                description: `Test booking for ${title}`,
                location: {
                    city,
                    country,
                    address: `123 ${city} Street`,
                    coordinates: { lat: 48.8566, lng: 2.3522 }
                },
                dateRange: {
                    checkIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    checkOut: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000).toISOString()
                },
                originalPrice: price,
                currency: 'EUR',
                bookingReference: `TEST-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
                provider: 'booking.com'
            });

        expect(response.status).toBe(201);
        return response.body.data.booking.id;
    }

    async function createTestSwap(token: string, bookingId: string, title: string): Promise<string> {
        const swapRequest: EnhancedCreateSwapRequest = {
            sourceBookingId: bookingId,
            title,
            description: `Test swap for ${title}`,
            paymentTypes: {
                bookingExchange: true,
                cashPayment: false
            },
            acceptanceStrategy: {
                type: 'first_match'
            },
            swapPreferences: {
                preferredLocations: ['London', 'Berlin'],
                additionalRequirements: []
            },
            expirationDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
        };

        const response = await request(app)
            .post('/api/swaps/enhanced')
            .set('Authorization', `Bearer ${token}`)
            .send(swapRequest);

        expect(response.status).toBe(201);
        return response.body.data.swap.id;
    }

    async function createTestProposal(token: string, swapId: string, bookingId: string, message: string): Promise<string> {
        const proposalRequest: CreateEnhancedProposalRequest = {
            swapId,
            proposalType: 'booking',
            bookingId,
            message,
            conditions: ['Test condition']
        };

        const response = await request(app)
            .post(`/api/swaps/${swapId}/proposals/enhanced`)
            .set('Authorization', `Bearer ${token}`)
            .send(proposalRequest);

        expect(response.status).toBe(201);
        return response.body.data.proposalId;
    }

    afterAll(async () => {
        try {
            // Clean up environment variables
            delete process.env.NODE_ENV;
            delete process.env.JWT_SECRET;
            delete process.env.HEDERA_ACCOUNT_ID;
            delete process.env.HEDERA_PRIVATE_KEY;
            delete process.env.HEDERA_NETWORK;

            if (server) {
                server.close();
            }
        } catch (error) {
            logger.error('Error during test teardown', { error });
        }
    });
});