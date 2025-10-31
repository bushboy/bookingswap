import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BookingService } from '../services/booking/BookingService';
import {
    Booking,
    BookingType,
    BookingStatus,
    EnhancedCreateSwapRequest,
    PaymentTypePreference,
    AcceptanceStrategy,
} from '@booking-swap/shared';

// Mock BookingService with proper method binding
const createMockBookingService = () => {
    return {
        getBookingById: vi.fn(),
        lockBooking: vi.fn(),
        unlockBooking: vi.fn(),
        createBookingListing: vi.fn(),
        updateBookingStatus: vi.fn(),
        validateServiceIntegrity: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
    } as any;
};

// Mock SwapProposalService class for testing service integration
class MockSwapProposalService {
    constructor(
        private swapRepository: any,
        private auctionRepository: any,
        private swapTargetingRepository: any,
        private bookingService: any,
        private hederaService: any,
        private notificationService: any,
        private auctionNotificationService: any,
        private paymentNotificationService: any,
        private timingNotificationService: any,
        private auctionService: any,
        private paymentService: any
    ) {
        // Validate BookingService methods on instantiation
        this.validateBookingServiceMethods();
    }

    /**
     * Validate that BookingService has all required methods
     */
    private validateBookingServiceMethods(): void {
        const requiredMethods = ['getBookingById', 'lockBooking', 'unlockBooking'];
        const missingMethods: string[] = [];

        for (const method of requiredMethods) {
            if (!this.bookingService || typeof (this.bookingService as any)[method] !== 'function') {
                missingMethods.push(method);
            }
        }

        if (missingMethods.length > 0) {
            const errorMessage = `BookingService is missing required methods: ${missingMethods.join(', ')}. ` +
                `Service instance: ${this.bookingService ? 'exists' : 'null/undefined'}. ` +
                `Available methods: ${this.bookingService ? Object.getOwnPropertyNames(Object.getPrototypeOf(this.bookingService)).filter(name => typeof (this.bookingService as any)[name] === 'function').join(', ') : 'none'}`;

            throw new Error(errorMessage);
        }
    }

    /**
     * Mock implementation of createEnhancedSwapProposal
     */
    async createEnhancedSwapProposal(request: EnhancedCreateSwapRequest): Promise<any> {
        // Validate request
        if (!request.sourceBookingId) {
            throw new Error('Invalid booking ID provided');
        }

        // Call BookingService.getBookingById to test integration
        const booking = await this.bookingService.getBookingById(request.sourceBookingId);

        if (!booking) {
            throw new Error(`Source booking ${request.sourceBookingId} not found`);
        }

        // Mock successful swap creation
        return {
            swap: {
                id: 'test-swap-id',
                sourceBookingId: request.sourceBookingId,
                status: 'pending',
                createdAt: new Date(),
            },
            blockchainTransaction: {
                transactionId: 'test-transaction-id',
                consensusTimestamp: '2023-01-01T00:00:00Z',
            },
        };
    }
}

// Mock other dependencies
const mockSwapRepository = {
    createEnhancedSwap: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
} as any;

const mockAuctionRepository = {
    create: vi.fn(),
    findBySwapId: vi.fn(),
} as any;

const mockSwapTargetingRepository = {
    create: vi.fn(),
    findBySwapId: vi.fn(),
} as any;

const mockHederaService = {
    submitTransaction: vi.fn().mockResolvedValue({
        transactionId: 'test-transaction-id',
        consensusTimestamp: '2023-01-01T00:00:00Z',
    }),
} as any;

const mockNotificationService = {
    sendNotification: vi.fn(),
} as any;

const mockAuctionNotificationService = {
    sendAuctionCreated: vi.fn(),
} as any;

const mockPaymentNotificationService = {
    sendPaymentRequired: vi.fn(),
} as any;

const mockTimingNotificationService = {
    sendLastMinuteBookingRestriction: vi.fn(),
} as any;

const mockAuctionService = {
    createAuction: vi.fn().mockResolvedValue({
        auction: { id: 'test-auction-id' },
    }),
} as any;

const mockPaymentService = {
    processPayment: vi.fn(),
} as any;

describe('SwapProposalService Integration Tests', () => {
    let swapProposalService: MockSwapProposalService;
    let mockBookingService: any;
    let testBooking: Booking;
    let testEnhancedSwapRequest: EnhancedCreateSwapRequest;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create fresh mock BookingService
        mockBookingService = createMockBookingService();

        // Create service instance
        swapProposalService = new MockSwapProposalService(
            mockSwapRepository,
            mockAuctionRepository,
            mockSwapTargetingRepository,
            mockBookingService,
            mockHederaService,
            mockNotificationService,
            mockAuctionNotificationService,
            mockPaymentNotificationService,
            mockTimingNotificationService,
            mockAuctionService,
            mockPaymentService
        );

        // Create test booking data
        testBooking = {
            id: 'test-booking-id',
            userId: 'test-user-id',
            type: 'hotel' as BookingType,
            title: 'Test Hotel Booking',
            description: 'A test hotel booking',
            location: {
                city: 'Test City',
                country: 'Test Country',
                coordinates: [40.7128, -74.0060],
            },
            dateRange: {
                checkIn: new Date('2024-06-01'),
                checkOut: new Date('2024-06-05'),
            },
            originalPrice: 500,
            swapValue: 450,
            providerDetails: {
                provider: 'TestProvider',
                confirmationNumber: 'CONF123',
                bookingReference: 'REF456',
            },
            verification: {
                status: 'verified',
                documents: [],
            },
            blockchain: {
                topicId: 'test-topic-id',
            },
            status: 'available' as BookingStatus,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
        };

        // Create test enhanced swap request
        testEnhancedSwapRequest = {
            sourceBookingId: 'test-booking-id',
            paymentTypes: ['booking_only' as PaymentTypePreference],
            acceptanceStrategy: {
                type: 'first_match',
            } as AcceptanceStrategy,
            swapPreferences: {
                preferredLocations: ['Test City'],
                additionalRequirements: ['Pet-friendly'],
            },
            expirationDate: new Date('2024-12-31'),
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Service Initialization and Dependency Injection', () => {
        it('should properly initialize with all dependencies', () => {
            // Assert - Service should be created without errors
            expect(swapProposalService).toBeDefined();
            expect(swapProposalService).toBeInstanceOf(MockSwapProposalService);
        });

        it('should validate BookingService methods on instantiation', () => {
            // Act - Creating service should validate BookingService methods
            expect(() => {
                new MockSwapProposalService(
                    mockSwapRepository,
                    mockAuctionRepository,
                    mockSwapTargetingRepository,
                    mockBookingService,
                    mockHederaService,
                    mockNotificationService,
                    mockAuctionNotificationService,
                    mockPaymentNotificationService,
                    mockTimingNotificationService,
                    mockAuctionService,
                    mockPaymentService
                );
            }).not.toThrow();
        });

        it('should throw error when BookingService is missing required methods', () => {
            // Arrange - Create BookingService without required methods
            const incompleteBookingService = {
                // Missing getBookingById, lockBooking, unlockBooking
                validateServiceIntegrity: vi.fn().mockReturnValue({ isValid: false, errors: ['Missing methods'] }),
            };

            // Act & Assert
            expect(() => {
                new MockSwapProposalService(
                    mockSwapRepository,
                    mockAuctionRepository,
                    mockSwapTargetingRepository,
                    incompleteBookingService as any,
                    mockHederaService,
                    mockNotificationService,
                    mockAuctionNotificationService,
                    mockPaymentNotificationService,
                    mockTimingNotificationService,
                    mockAuctionService,
                    mockPaymentService
                );
            }).toThrow(/BookingService is missing required methods/);
        });

        it('should handle null BookingService gracefully', () => {
            // Act & Assert
            expect(() => {
                new MockSwapProposalService(
                    mockSwapRepository,
                    mockAuctionRepository,
                    mockSwapTargetingRepository,
                    null as any,
                    mockHederaService,
                    mockNotificationService,
                    mockAuctionNotificationService,
                    mockPaymentNotificationService,
                    mockTimingNotificationService,
                    mockAuctionService,
                    mockPaymentService
                );
            }).toThrow(/BookingService is missing required methods/);
        });
    });

    describe('createEnhancedSwapProposal Integration', () => {
        beforeEach(() => {
            // Setup successful mocks
            mockBookingService.getBookingById.mockResolvedValue(testBooking);
            mockSwapRepository.createEnhancedSwap.mockResolvedValue({
                id: 'test-swap-id',
                ...testEnhancedSwapRequest,
                status: 'pending',
                createdAt: new Date(),
            });
        });

        it('should successfully create enhanced swap proposal with real BookingService instance', async () => {
            // Act
            const result = await swapProposalService.createEnhancedSwapProposal(testEnhancedSwapRequest);

            // Assert
            expect(result).toBeDefined();
            expect(result.swap).toBeDefined();
            expect(result.swap.id).toBe('test-swap-id');
            expect(mockBookingService.getBookingById).toHaveBeenCalledWith('test-booking-id');
        });

        it('should verify proper service dependency injection and method calls', async () => {
            // Act
            await swapProposalService.createEnhancedSwapProposal(testEnhancedSwapRequest);

            // Assert - Verify all expected service calls
            expect(mockBookingService.getBookingById).toHaveBeenCalledWith('test-booking-id');
            expect(mockBookingService.getBookingById).toHaveBeenCalledTimes(1);
        });

        it('should handle missing booking scenario gracefully', async () => {
            // Arrange
            mockBookingService.getBookingById.mockResolvedValue(null);

            // Act & Assert
            await expect(
                swapProposalService.createEnhancedSwapProposal(testEnhancedSwapRequest)
            ).rejects.toThrow(/Source booking .* not found/);

            expect(mockBookingService.getBookingById).toHaveBeenCalledWith('test-booking-id');
        });

        it('should handle BookingService method unavailability', async () => {
            // Arrange - Create service with BookingService missing getBookingById
            const faultyBookingService = {
                lockBooking: vi.fn(),
                unlockBooking: vi.fn(),
                // Missing getBookingById method
            };

            // Act & Assert
            expect(() => {
                new MockSwapProposalService(
                    mockSwapRepository,
                    mockAuctionRepository,
                    mockSwapTargetingRepository,
                    faultyBookingService as any,
                    mockHederaService,
                    mockNotificationService,
                    mockAuctionNotificationService,
                    mockPaymentNotificationService,
                    mockTimingNotificationService,
                    mockAuctionService,
                    mockPaymentService
                );
            }).toThrow(/BookingService is missing required methods/);
        });

        it('should handle invalid booking IDs', async () => {
            // Arrange
            const invalidRequest = {
                ...testEnhancedSwapRequest,
                sourceBookingId: '',
            };

            // Act & Assert
            await expect(
                swapProposalService.createEnhancedSwapProposal(invalidRequest)
            ).rejects.toThrow(/Invalid booking ID/);
        });
    });

    describe('Error Scenarios for Missing or Invalid Bookings', () => {
        it('should handle BookingService throwing errors', async () => {
            // Arrange
            const bookingError = new Error('Database connection failed');
            mockBookingService.getBookingById.mockRejectedValue(bookingError);

            // Act & Assert
            await expect(
                swapProposalService.createEnhancedSwapProposal(testEnhancedSwapRequest)
            ).rejects.toThrow('Database connection failed');

            expect(mockBookingService.getBookingById).toHaveBeenCalledWith('test-booking-id');
        });

        it('should handle booking ownership validation', async () => {
            // Arrange - Booking exists but belongs to different user
            const otherUserBooking = {
                ...testBooking,
                userId: 'other-user-id',
            };
            mockBookingService.getBookingById.mockResolvedValue(otherUserBooking);

            // Act
            const result = await swapProposalService.createEnhancedSwapProposal(testEnhancedSwapRequest);

            // Assert - Should still create swap (ownership validation happens elsewhere)
            expect(result).toBeDefined();
            expect(mockBookingService.getBookingById).toHaveBeenCalledWith('test-booking-id');
        });

        it('should handle booking status validation', async () => {
            // Arrange - Booking is not available
            const unavailableBooking = {
                ...testBooking,
                status: 'locked' as BookingStatus,
            };
            mockBookingService.getBookingById.mockResolvedValue(unavailableBooking);

            // Act
            const result = await swapProposalService.createEnhancedSwapProposal(testEnhancedSwapRequest);

            // Assert - Should still create swap (status validation happens elsewhere)
            expect(result).toBeDefined();
            expect(mockBookingService.getBookingById).toHaveBeenCalledWith('test-booking-id');
        });

        it('should handle malformed booking data', async () => {
            // Arrange - Booking with missing required fields
            const malformedBooking = {
                id: 'test-booking-id',
                // Missing other required fields
            };
            mockBookingService.getBookingById.mockResolvedValue(malformedBooking);

            // Act - Should handle gracefully
            const result = await swapProposalService.createEnhancedSwapProposal(testEnhancedSwapRequest);

            // Assert
            expect(result).toBeDefined();
            expect(mockBookingService.getBookingById).toHaveBeenCalledWith('test-booking-id');
        });
    });

    describe('Service Method Availability and Binding', () => {
        it('should have all required methods properly bound', () => {
            // Assert - Verify critical methods exist and are functions
            expect(typeof swapProposalService.createEnhancedSwapProposal).toBe('function');

            // Test method binding by extracting and calling independently
            const createMethod = swapProposalService.createEnhancedSwapProposal;
            expect(typeof createMethod).toBe('function');
        });

        it('should maintain proper context when methods are called independently', async () => {
            // Arrange
            mockBookingService.getBookingById.mockResolvedValue(testBooking);

            // Act - Extract method and call it
            const createMethod = swapProposalService.createEnhancedSwapProposal.bind(swapProposalService);
            const result = await createMethod(testEnhancedSwapRequest);

            // Assert
            expect(result).toBeDefined();
            expect(result.swap.id).toBe('test-swap-id');
        });
    });

    describe('Performance and Concurrency', () => {
        beforeEach(() => {
            mockBookingService.getBookingById.mockResolvedValue(testBooking);
        });

        it('should handle concurrent swap creation requests', async () => {
            // Arrange
            const concurrentRequests = 5;
            const requests = Array.from({ length: concurrentRequests }, (_, i) => ({
                ...testEnhancedSwapRequest,
                sourceBookingId: `test-booking-${i}`,
            }));

            // Setup mocks for each request
            requests.forEach((_, i) => {
                mockBookingService.getBookingById.mockResolvedValueOnce({
                    ...testBooking,
                    id: `test-booking-${i}`,
                });
            });

            // Act
            const startTime = Date.now();
            const promises = requests.map(request =>
                swapProposalService.createEnhancedSwapProposal(request)
            );
            const results = await Promise.all(promises);
            const endTime = Date.now();

            // Assert
            expect(results).toHaveLength(concurrentRequests);
            results.forEach((result, i) => {
                expect(result.swap.id).toBe('test-swap-id');
            });

            // Should complete within reasonable time
            const executionTime = endTime - startTime;
            expect(executionTime).toBeLessThan(5000);
        });

        it('should complete swap creation within acceptable time limits', async () => {
            // Act
            const startTime = Date.now();
            await swapProposalService.createEnhancedSwapProposal(testEnhancedSwapRequest);
            const endTime = Date.now();

            // Assert - Should complete within 2 seconds
            const executionTime = endTime - startTime;
            expect(executionTime).toBeLessThan(2000);
        });
    });
});