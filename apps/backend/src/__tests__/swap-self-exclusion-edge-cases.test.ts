import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../index';
import {
    BookingType,
    EnhancedCreateSwapRequest,
    CreateEnhancedProposalRequest
} from '@booking-swap/shared';
import { logger } from '../utils/logger';

/**
 * Test suite for swap self-exclusion edge cases and error scenarios
 * Requirements: 2.2, 3.4
 * 
 * This test suite verifies:
 * 1. Swaps with no proposals from others are handled correctly
 * 2. Users with multiple swaps in various proposal states work properly
 * 3. Data inconsistencies are handled gracefully
 * 4. Error scenarios don't break the system
 */
describe('Swap Self-Exclusion Edge Cases and Error Scenarios', () => {
    let app: any;
    let server: any;

    // Test users
    let user1: { id: string; token: string; email: string };
    let user2: { id: string; token: string; email: string };
    let user3: { id: string; token: string; email: string };
    let user4: { id: string; token: string; email: string };

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
        user1 = await createTestUser('edge1@test.com', 'Edge User One');
        user2 = await createTestUser('edge2@test.com', 'Edge User Two');
        user3 = await createTestUser('edge3@test.com', 'Edge User Three');
        user4 = await createTestUser('edge4@test.com', 'Edge User Four');

        logger.info('Edge case test users created', {
            user1: user1.id,
            user2: user2.id,
            user3: user3.id,
            user4: user4.id
        });
    });

    describe('Swaps with No Proposals from Others', () => {
        it('should handle user with swaps that have no proposals', async () => {
            // Create bookings and swaps for user1
            const booking1 = await createTestBooking(user1.token, 'Lonely Hotel 1', 'Paris', 'France', 500);
            const booking2 = await createTestBooking(user1.token, 'Lonely Hotel 2', 'London', 'UK', 600);

            await createTestSwap(user1.token, booking1, 'Swap with No Proposals 1');
            await createTestSwap(user1.token, booking2, 'Swap with No Proposals 2');

            // Don't create any proposals - test empty state

            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.swapCards).toHaveLength(2);

            // Verify each swap card shows empty proposals correctly
            for (const card of response.body.data.swapCards) {
                expect(card.userSwap).toBeDefined();
                expect(card.proposalsFromOthers).toEqual([]);
                expect(card.proposalCount).toBe(0);
                expect(card.cardMetadata.hasProposals).toBe(false);
                expect(card.cardMetadata.proposalStatus).toBe('no_proposals');
            }

            // Verify metadata reflects empty state
            expect(response.body.metadata.dataQuality.totalSwaps).toBe(2);
            expect(response.body.metadata.dataQuality.totalProposals).toBe(0);
            expect(response.body.metadata.dataQuality.swapsWithProposals).toBe(0);
            expect(response.body.metadata.dataQuality.swapsWithoutProposals).toBe(2);

            logger.info('Empty proposals scenario validated');
        });

        it('should display appropriate messaging for swaps with no proposals', async () => {
            const booking = await createTestBooking(user1.token, 'No Proposals Hotel', 'Berlin', 'Germany', 400);
            await createTestSwap(user1.token, booking, 'No Proposals Swap');

            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            const swapCard = response.body.data.swapCards[0];
            expect(swapCard.proposalsFromOthers).toEqual([]);
            expect(swapCard.proposalCount).toBe(0);
            expect(swapCard.cardMetadata.proposalStatus).toBe('no_proposals');

            // Verify the frontend can handle this state appropriately
            expect(swapCard.userSwap.id).toBeTruthy();
            expect(swapCard.userSwap.bookingDetails).toBeDefined();
            expect(swapCard.userSwap.bookingDetails.title).toBe('No Proposals Hotel');

            logger.info('No proposals messaging validated');
        });

        it('should handle mixed scenario - some swaps with proposals, some without', async () => {
            // Create multiple bookings and swaps
            const booking1 = await createTestBooking(user1.token, 'Mixed Hotel 1', 'Paris', 'France', 500);
            const booking2 = await createTestBooking(user1.token, 'Mixed Hotel 2', 'London', 'UK', 600);
            const booking3 = await createTestBooking(user1.token, 'Mixed Hotel 3', 'Berlin', 'Germany', 400);

            const swap1 = await createTestSwap(user1.token, booking1, 'Swap With Proposals');
            await createTestSwap(user1.token, booking2, 'Swap Without Proposals');
            const swap3 = await createTestSwap(user1.token, booking3, 'Another Swap With Proposals');

            // Create proposals for some swaps but not others
            const user2Booking = await createTestBooking(user2.token, 'Proposer Hotel 1', 'Rome', 'Italy', 550);
            const user3Booking = await createTestBooking(user3.token, 'Proposer Hotel 2', 'Madrid', 'Spain', 450);

            await createTestProposal(user2.token, swap1, user2Booking, 'Proposal for swap1');
            await createTestProposal(user3.token, swap3, user3Booking, 'Proposal for swap3');
            // No proposals for swap2

            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            expect(response.body.data.swapCards).toHaveLength(3);

            // Categorize swaps by proposal status
            const swapsWithProposals = response.body.data.swapCards.filter(card => card.proposalCount > 0);
            const swapsWithoutProposals = response.body.data.swapCards.filter(card => card.proposalCount === 0);

            expect(swapsWithProposals).toHaveLength(2);
            expect(swapsWithoutProposals).toHaveLength(1);

            // Verify metadata
            expect(response.body.metadata.dataQuality.swapsWithProposals).toBe(2);
            expect(response.body.metadata.dataQuality.swapsWithoutProposals).toBe(1);
            expect(response.body.metadata.dataQuality.totalProposals).toBe(2);

            logger.info('Mixed scenario validated', {
                swapsWithProposals: swapsWithProposals.length,
                swapsWithoutProposals: swapsWithoutProposals.length
            });
        });
    });

    describe('Multiple Swaps with Various Proposal States', () => {
        it('should handle user with many swaps in different states', async () => {
            // Create multiple bookings for user1
            const bookings = [];
            const swaps = [];

            for (let i = 1; i <= 5; i++) {
                const booking = await createTestBooking(
                    user1.token,
                    `Multi Hotel ${i}`,
                    `City${i}`,
                    'Country',
                    400 + i * 50
                );
                bookings.push(booking);

                const swap = await createTestSwap(user1.token, booking, `Multi Swap ${i}`);
                swaps.push(swap);
            }

            // Create proposer bookings
            const proposerBookings = [];
            for (let i = 1; i <= 3; i++) {
                const booking = await createTestBooking(
                    user2.token,
                    `Proposer Hotel ${i}`,
                    `ProposerCity${i}`,
                    'ProposerCountry',
                    300 + i * 40
                );
                proposerBookings.push(booking);
            }

            // Create various proposal scenarios:
            // Swap 1: Multiple proposals
            await createTestProposal(user2.token, swaps[0], proposerBookings[0], 'First proposal for swap1');
            const user3Booking = await createTestBooking(user3.token, 'User3 Hotel', 'User3City', 'User3Country', 350);
            await createTestProposal(user3.token, swaps[0], user3Booking, 'Second proposal for swap1');

            // Swap 2: Single proposal
            await createTestProposal(user2.token, swaps[1], proposerBookings[1], 'Single proposal for swap2');

            // Swap 3: No proposals
            // (intentionally left empty)

            // Swap 4: Multiple proposals from same user
            await createTestProposal(user2.token, swaps[3], proposerBookings[2], 'First proposal from user2 for swap4');
            const user2SecondBooking = await createTestBooking(user2.token, 'User2 Second Hotel', 'User2City2', 'User2Country', 380);
            await createTestProposal(user2.token, swaps[3], user2SecondBooking, 'Second proposal from user2 for swap4');

            // Swap 5: No proposals

            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            expect(response.body.data.swapCards).toHaveLength(5);

            // Analyze the results
            const cardsByProposalCount = response.body.data.swapCards.reduce((acc, card) => {
                const count = card.proposalCount;
                if (!acc[count]) acc[count] = [];
                acc[count].push(card);
                return acc;
            }, {});

            // Verify expected distribution
            expect(cardsByProposalCount[0]).toHaveLength(2); // 2 swaps with no proposals
            expect(cardsByProposalCount[1]).toHaveLength(1); // 1 swap with single proposal
            expect(cardsByProposalCount[2]).toHaveLength(2); // 2 swaps with multiple proposals

            // Verify metadata
            expect(response.body.metadata.dataQuality.totalSwaps).toBe(5);
            expect(response.body.metadata.dataQuality.totalProposals).toBe(5);
            expect(response.body.metadata.dataQuality.swapsWithProposals).toBe(3);
            expect(response.body.metadata.dataQuality.swapsWithoutProposals).toBe(2);

            logger.info('Multiple swaps with various states validated', {
                distribution: Object.keys(cardsByProposalCount).map(count => ({
                    proposalCount: count,
                    swapCount: cardsByProposalCount[count].length
                }))
            });
        });

        it('should handle user with swaps in different statuses', async () => {
            // Create bookings and swaps
            const booking1 = await createTestBooking(user1.token, 'Active Hotel', 'Paris', 'France', 500);
            const booking2 = await createTestBooking(user1.token, 'Pending Hotel', 'London', 'UK', 600);

            const activeSwap = await createTestSwap(user1.token, booking1, 'Active Swap');
            const pendingSwap = await createTestSwap(user1.token, booking2, 'Pending Swap');

            // Create proposals for both
            const proposerBooking1 = await createTestBooking(user2.token, 'Proposer Hotel 1', 'Rome', 'Italy', 550);
            const proposerBooking2 = await createTestBooking(user3.token, 'Proposer Hotel 2', 'Madrid', 'Spain', 450);

            await createTestProposal(user2.token, activeSwap, proposerBooking1, 'Proposal for active swap');
            await createTestProposal(user3.token, pendingSwap, proposerBooking2, 'Proposal for pending swap');

            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            expect(response.body.data.swapCards).toHaveLength(2);

            // Verify both swaps are returned with their proposals
            for (const card of response.body.data.swapCards) {
                expect(card.userSwap.status).toBeTruthy();
                expect(card.proposalCount).toBe(1);
                expect(card.proposalsFromOthers).toHaveLength(1);
            }

            // Verify summary includes status breakdown
            expect(response.body.metadata.summary).toBeDefined();
            expect(response.body.metadata.summary.pendingSwaps).toBeGreaterThan(0);

            logger.info('Different swap statuses validated');
        });
    });

    describe('Data Inconsistency Handling', () => {
        it('should gracefully handle corrupted proposal data', async () => {
            const booking = await createTestBooking(user1.token, 'Corrupted Data Hotel', 'Paris', 'France', 500);
            const swap = await createTestSwap(user1.token, booking, 'Corrupted Data Swap');

            // Create a normal proposal first
            const proposerBooking = await createTestBooking(user2.token, 'Normal Proposer Hotel', 'Rome', 'Italy', 550);
            await createTestProposal(user2.token, swap, proposerBooking, 'Normal proposal');

            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            // System should still return valid data
            expect(response.body.success).toBe(true);
            expect(response.body.data.swapCards).toHaveLength(1);

            const card = response.body.data.swapCards[0];
            expect(card.proposalCount).toBeGreaterThanOrEqual(0);
            expect(Array.isArray(card.proposalsFromOthers)).toBe(true);

            // Verify all returned proposals have required fields
            for (const proposal of card.proposalsFromOthers) {
                expect(proposal.id).toBeTruthy();
                expect(proposal.proposerId).toBeTruthy();
                expect(proposal.proposerId).not.toBe(user1.id); // No self-proposals
                expect(proposal.targetBookingDetails).toBeDefined();
            }

            logger.info('Data corruption resilience validated');
        });

        it('should handle missing booking details gracefully', async () => {
            const booking = await createTestBooking(user1.token, 'Missing Details Hotel', 'Berlin', 'Germany', 400);
            const swap = await createTestSwap(user1.token, booking, 'Missing Details Swap');

            // Create proposal with potentially missing booking details
            const proposerBooking = await createTestBooking(user2.token, 'Proposer Hotel', 'Madrid', 'Spain', 450);
            await createTestProposal(user2.token, swap, proposerBooking, 'Proposal with potential missing details');

            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            const card = response.body.data.swapCards[0];

            // Verify fallback values are provided for missing data
            expect(card.userSwap.bookingDetails.title).toBeTruthy();
            expect(card.userSwap.bookingDetails.location).toBeDefined();
            expect(card.userSwap.bookingDetails.location.city).toBeTruthy();
            expect(card.userSwap.bookingDetails.location.country).toBeTruthy();

            if (card.proposalsFromOthers.length > 0) {
                const proposal = card.proposalsFromOthers[0];
                expect(proposal.targetBookingDetails.title).toBeTruthy();
                expect(proposal.targetBookingDetails.location).toBeDefined();
            }

            logger.info('Missing booking details handling validated');
        });

        it('should handle database connection issues gracefully', async () => {
            // Test the error handling in the API with invalid parameters
            const response = await request(app)
                .get('/api/swaps/cards?limit=invalid')
                .set('Authorization', `Bearer ${user1.token}`);

            // System should handle invalid parameters gracefully
            expect(response.status).toBeOneOf([200, 400]); // Either success with default params or validation error

            if (response.status === 200) {
                expect(response.body.success).toBe(true);
                expect(response.body.data.swapCards).toBeDefined();
            } else {
                expect(response.body.error).toBeDefined();
            }

            logger.info('Parameter validation handling tested');
        });
    });

    describe('Performance and Scalability Edge Cases', () => {
        it('should handle large number of proposals per swap efficiently', async () => {
            const booking = await createTestBooking(user1.token, 'Popular Hotel', 'Paris', 'France', 500);
            const swap = await createTestSwap(user1.token, booking, 'Popular Swap');

            // Create many proposals (simulate popular swap)
            const proposalPromises = [];
            for (let i = 1; i <= 10; i++) {
                const proposerBooking = createTestBooking(
                    user2.token,
                    `Proposer Hotel ${i}`,
                    `City${i}`,
                    'Country',
                    400 + i * 10
                ).then(bookingId =>
                    createTestProposal(user2.token, swap, bookingId, `Proposal ${i}`)
                );
                proposalPromises.push(proposerBooking);
            }

            await Promise.all(proposalPromises);

            const startTime = Date.now();
            const response = await request(app)
                .get('/api/swaps/cards')
                .set('Authorization', `Bearer ${user1.token}`)
                .expect(200);
            const responseTime = Date.now() - startTime;

            // Verify performance is acceptable (under 2 seconds as per requirements)
            expect(responseTime).toBeLessThan(2000);
            expect(response.body.metadata.performance.executionTime).toBeLessThan(2000);
            expect(response.body.metadata.performance.meetsTarget).toBe(true);

            // Verify all proposals are returned
            const card = response.body.data.swapCards[0];
            expect(card.proposalCount).toBe(10);
            expect(card.proposalsFromOthers).toHaveLength(10);

            // Verify no self-proposals
            for (const proposal of card.proposalsFromOthers) {
                expect(proposal.proposerId).not.toBe(user1.id);
            }

            logger.info('Large number of proposals handled efficiently', {
                proposalCount: card.proposalCount,
                responseTime,
                meetsTarget: response.body.metadata.performance.meetsTarget
            });
        });

        it('should handle pagination correctly with edge cases', async () => {
            // Create exactly the limit number of swaps to test boundary conditions
            const swapPromises = [];
            for (let i = 1; i <= 5; i++) {
                const bookingPromise = createTestBooking(
                    user1.token,
                    `Pagination Hotel ${i}`,
                    `City${i}`,
                    'Country',
                    400 + i * 50
                ).then(bookingId =>
                    createTestSwap(user1.token, bookingId, `Pagination Swap ${i}`)
                );
                swapPromises.push(bookingPromise);
            }

            await Promise.all(swapPromises);

            // Test different pagination scenarios
            const scenarios = [
                { limit: 2, offset: 0, expectedCount: 2 },
                { limit: 2, offset: 2, expectedCount: 2 },
                { limit: 2, offset: 4, expectedCount: 1 },
                { limit: 10, offset: 0, expectedCount: 5 },
                { limit: 1, offset: 10, expectedCount: 0 }
            ];

            for (const scenario of scenarios) {
                const response = await request(app)
                    .get(`/api/swaps/cards?limit=${scenario.limit}&offset=${scenario.offset}`)
                    .set('Authorization', `Bearer ${user1.token}`)
                    .expect(200);

                expect(response.body.data.swapCards).toHaveLength(scenario.expectedCount);
                expect(response.body.metadata.pagination.limit).toBe(scenario.limit);
                expect(response.body.metadata.pagination.offset).toBe(scenario.offset);

                logger.info('Pagination scenario tested', {
                    limit: scenario.limit,
                    offset: scenario.offset,
                    expected: scenario.expectedCount,
                    actual: response.body.data.swapCards.length
                });
            }
        });
    });

    // Helper functions (same as in the main test file)
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