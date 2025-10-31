import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { SwapController } from '../controllers/SwapController';
import { CompatibilityResponse, CompatibilityAnalysis } from '@booking-swap/shared';

// Mock the dependencies
const mockSwapProposalService = {
    createSwapProposal: vi.fn(),
    getUserSwapProposals: vi.fn(),
    getSwapProposalById: vi.fn(),
    cancelSwapProposal: vi.fn(),
    getPendingProposalsForBooking: vi.fn(),
    createEnhancedSwapProposal: vi.fn(),
    createEnhancedProposal: vi.fn(),
    getUserSwapsWithProposals: vi.fn(),
};

const mockSwapResponseService = {
    acceptSwapProposal: vi.fn(),
    rejectSwapProposal: vi.fn(),
    getUserSwapResponses: vi.fn(),
};

const mockSwapMatchingService = {
    createProposalFromBrowse: vi.fn(),
    getUserEligibleSwaps: vi.fn(),
    analyzeSwapCompatibility: vi.fn(),
    validateProposalEligibility: vi.fn(),
    getSwapCompatibility: vi.fn(),
};

const mockAuctionService = {
    createAuction: vi.fn(),
    submitBid: vi.fn(),
    endAuction: vi.fn(),
};

const mockPaymentService = {
    processPayment: vi.fn(),
    refundPayment: vi.fn(),
};

const mockSwapOfferWorkflowService = {
    processSwapOffer: vi.fn(),
    validateSwapOffer: vi.fn(),
};

// Mock the utility functions
vi.mock('../utils/logger');
vi.mock('../utils/swap-error-handler');

// Import mocked modules
import { logger } from '../utils/logger';
import { handleSwapError, generateRequestId, SWAP_ERROR_CODES } from '../utils/swap-error-handler';

describe('SwapController.getSwapCompatibility', () => {
    let swapController: SwapController;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockJson: ReturnType<typeof vi.fn>;
    let mockStatus: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create controller instance
        swapController = new SwapController(
            mockSwapProposalService as any,
            mockSwapResponseService as any,
            mockSwapMatchingService as any,
            mockAuctionService as any,
            mockPaymentService as any,
            mockSwapOfferWorkflowService as any
        );

        // Setup mock response
        mockJson = vi.fn();
        mockStatus = vi.fn().mockReturnValue({ json: mockJson });

        mockResponse = {
            status: mockStatus,
            json: mockJson,
        };

        // Setup default mock request
        mockRequest = {
            params: {
                sourceSwapId: '123e4567-e89b-12d3-a456-426614174000',
                targetSwapId: '987fcdeb-51a2-43d7-8f9e-123456789abc'
            },
            user: { id: 'test-user-id' },
        };

        // Setup default mock implementations
        vi.mocked(generateRequestId).mockReturnValue('test-request-id');
    });

    describe('4.1 Test successful compatibility analysis', () => {
        it('should return compatibility analysis with high score and highly_recommended', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id',
                proposerId: 'test-user-id',
                status: 'active'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'other-user-id',
                proposerId: 'other-user-id',
                status: 'active'
            };

            const mockCompatibilityResponse: CompatibilityResponse = {
                compatibility: {
                    overallScore: 95,
                    factors: {
                        locationCompatibility: {
                            score: 90,
                            weight: 0.25,
                            details: 'Both locations are in similar tourist areas',
                            status: 'excellent'
                        },
                        dateCompatibility: {
                            score: 100,
                            weight: 0.30,
                            details: 'Perfect date overlap with flexible options',
                            status: 'excellent'
                        },
                        valueCompatibility: {
                            score: 95,
                            weight: 0.20,
                            details: 'Very similar accommodation values',
                            status: 'excellent'
                        },
                        accommodationCompatibility: {
                            score: 90,
                            weight: 0.15,
                            details: 'Both are luxury hotels with similar amenities',
                            status: 'excellent'
                        },
                        guestCompatibility: {
                            score: 100,
                            weight: 0.10,
                            details: 'Same number of guests',
                            status: 'excellent'
                        }
                    },
                    recommendations: [
                        'This is an excellent match with high compatibility across all factors',
                        'Consider proposing soon as this swap is likely to be popular'
                    ],
                    potentialIssues: []
                },
                recommendation: 'highly_recommended'
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            mockSwapMatchingService.getSwapCompatibility.mockResolvedValue(mockCompatibilityResponse);

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockSwapProposalService.getSwapProposalById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
            expect(mockSwapProposalService.getSwapProposalById).toHaveBeenCalledWith('987fcdeb-51a2-43d7-8f9e-123456789abc');
            expect(mockSwapMatchingService.getSwapCompatibility).toHaveBeenCalledWith(
                '123e4567-e89b-12d3-a456-426614174000',
                '987fcdeb-51a2-43d7-8f9e-123456789abc'
            );
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockCompatibilityResponse,
                requestId: 'test-request-id',
                timestamp: expect.any(String),
            });
        });

        it('should return compatibility analysis with medium score and recommended', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id',
                proposerId: 'test-user-id',
                status: 'active'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'other-user-id',
                proposerId: 'other-user-id',
                status: 'active'
            };

            const mockCompatibilityResponse: CompatibilityResponse = {
                compatibility: {
                    overallScore: 75,
                    factors: {
                        locationCompatibility: {
                            score: 80,
                            weight: 0.25,
                            details: 'Locations are in the same region but different cities',
                            status: 'good'
                        },
                        dateCompatibility: {
                            score: 70,
                            weight: 0.30,
                            details: 'Some date overlap with moderate flexibility',
                            status: 'good'
                        },
                        valueCompatibility: {
                            score: 85,
                            weight: 0.20,
                            details: 'Similar accommodation values with minor differences',
                            status: 'good'
                        },
                        accommodationCompatibility: {
                            score: 65,
                            weight: 0.15,
                            details: 'Different accommodation types but similar quality',
                            status: 'fair'
                        },
                        guestCompatibility: {
                            score: 90,
                            weight: 0.10,
                            details: 'Compatible guest numbers',
                            status: 'excellent'
                        }
                    },
                    recommendations: [
                        'Good compatibility with some minor considerations',
                        'Consider discussing date flexibility with the other party'
                    ],
                    potentialIssues: [
                        'Different accommodation types may require adjustment'
                    ]
                },
                recommendation: 'recommended'
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            mockSwapMatchingService.getSwapCompatibility.mockResolvedValue(mockCompatibilityResponse);

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockCompatibilityResponse,
                requestId: 'test-request-id',
                timestamp: expect.any(String),
            });
        });

        it('should return compatibility analysis with low score and possible', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id',
                proposerId: 'test-user-id',
                status: 'active'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'other-user-id',
                proposerId: 'other-user-id',
                status: 'active'
            };

            const mockCompatibilityResponse: CompatibilityResponse = {
                compatibility: {
                    overallScore: 45,
                    factors: {
                        locationCompatibility: {
                            score: 30,
                            weight: 0.25,
                            details: 'Locations are in different regions',
                            status: 'poor'
                        },
                        dateCompatibility: {
                            score: 60,
                            weight: 0.30,
                            details: 'Limited date overlap',
                            status: 'fair'
                        },
                        valueCompatibility: {
                            score: 40,
                            weight: 0.20,
                            details: 'Significant value differences',
                            status: 'poor'
                        },
                        accommodationCompatibility: {
                            score: 50,
                            weight: 0.15,
                            details: 'Different accommodation types and quality levels',
                            status: 'fair'
                        },
                        guestCompatibility: {
                            score: 70,
                            weight: 0.10,
                            details: 'Manageable guest number differences',
                            status: 'good'
                        }
                    },
                    recommendations: [
                        'This swap has limited compatibility',
                        'Consider additional compensation or flexible terms',
                        'Verify travel logistics carefully'
                    ],
                    potentialIssues: [
                        'Significant location differences may affect travel costs',
                        'Value differences may require additional payment'
                    ]
                },
                recommendation: 'possible'
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            mockSwapMatchingService.getSwapCompatibility.mockResolvedValue(mockCompatibilityResponse);

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockCompatibilityResponse,
                requestId: 'test-request-id',
                timestamp: expect.any(String),
            });
        });

        it('should return compatibility analysis with very low score and not_recommended', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id',
                proposerId: 'test-user-id',
                status: 'active'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'other-user-id',
                proposerId: 'other-user-id',
                status: 'active'
            };

            const mockCompatibilityResponse: CompatibilityResponse = {
                compatibility: {
                    overallScore: 15,
                    factors: {
                        locationCompatibility: {
                            score: 10,
                            weight: 0.25,
                            details: 'Locations are on different continents',
                            status: 'poor'
                        },
                        dateCompatibility: {
                            score: 20,
                            weight: 0.30,
                            details: 'No date overlap and limited flexibility',
                            status: 'poor'
                        },
                        valueCompatibility: {
                            score: 15,
                            weight: 0.20,
                            details: 'Major value differences',
                            status: 'poor'
                        },
                        accommodationCompatibility: {
                            score: 10,
                            weight: 0.15,
                            details: 'Completely different accommodation types',
                            status: 'poor'
                        },
                        guestCompatibility: {
                            score: 30,
                            weight: 0.10,
                            details: 'Significant guest number differences',
                            status: 'poor'
                        }
                    },
                    recommendations: [
                        'This swap is not recommended due to low compatibility',
                        'Consider looking for alternative swaps',
                        'If proceeding, expect significant additional arrangements'
                    ],
                    potentialIssues: [
                        'Major location differences will require extensive travel',
                        'No date overlap makes scheduling very difficult',
                        'Value differences are too significant for fair exchange'
                    ]
                },
                recommendation: 'not_recommended'
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            mockSwapMatchingService.getSwapCompatibility.mockResolvedValue(mockCompatibilityResponse);

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockCompatibilityResponse,
                requestId: 'test-request-id',
                timestamp: expect.any(String),
            });
        });

        it('should log successful compatibility analysis', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id',
                proposerId: 'test-user-id',
                status: 'active'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'other-user-id',
                proposerId: 'other-user-id',
                status: 'active'
            };

            const mockCompatibilityResponse: CompatibilityResponse = {
                compatibility: {
                    overallScore: 85,
                    factors: {
                        locationCompatibility: { score: 80, weight: 0.25, details: 'Good location match', status: 'good' },
                        dateCompatibility: { score: 90, weight: 0.30, details: 'Excellent date compatibility', status: 'excellent' },
                        valueCompatibility: { score: 85, weight: 0.20, details: 'Similar values', status: 'good' },
                        accommodationCompatibility: { score: 80, weight: 0.15, details: 'Compatible accommodations', status: 'good' },
                        guestCompatibility: { score: 95, weight: 0.10, details: 'Perfect guest match', status: 'excellent' }
                    },
                    recommendations: ['Great match'],
                    potentialIssues: []
                },
                recommendation: 'recommended'
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            mockSwapMatchingService.getSwapCompatibility.mockResolvedValue(mockCompatibilityResponse);

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Getting swap compatibility analysis', {
                requestId: 'test-request-id',
                userId: 'test-user-id',
                sourceSwapId: '123e4567-e89b-12d3-a456-426614174000',
                targetSwapId: '987fcdeb-51a2-43d7-8f9e-123456789abc'
            });

            expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Swap compatibility analysis completed successfully', {
                requestId: 'test-request-id',
                userId: 'test-user-id',
                sourceSwapId: '123e4567-e89b-12d3-a456-426614174000',
                targetSwapId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                overallScore: 85,
                recommendation: 'recommended'
            });
        });
    });
    describe('4.2 Test input validation scenarios', () => {
        it('should return 400 for invalid sourceSwapId format', async () => {
            // Arrange
            mockRequest.params = {
                sourceSwapId: 'invalid-uuid',
                targetSwapId: '987fcdeb-51a2-43d7-8f9e-123456789abc'
            };

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(400).json({
                    error: {
                        code: 'INVALID_REQUEST_DATA',
                        message: 'Invalid sourceSwapId format',
                        category: 'validation',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Invalid sourceSwapId format',
                    code: SWAP_ERROR_CODES.INVALID_REQUEST_DATA
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    userId: 'test-user-id',
                    requestId: 'test-request-id'
                })
            );
            expect(mockSwapProposalService.getSwapProposalById).not.toHaveBeenCalled();
            expect(mockSwapMatchingService.getSwapCompatibility).not.toHaveBeenCalled();
        });

        it('should return 400 for invalid targetSwapId format', async () => {
            // Arrange
            mockRequest.params = {
                sourceSwapId: '123e4567-e89b-12d3-a456-426614174000',
                targetSwapId: 'invalid-uuid'
            };

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(400).json({
                    error: {
                        code: 'INVALID_REQUEST_DATA',
                        message: 'Invalid targetSwapId format',
                        category: 'validation',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Invalid targetSwapId format',
                    code: SWAP_ERROR_CODES.INVALID_REQUEST_DATA
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    userId: 'test-user-id',
                    requestId: 'test-request-id'
                })
            );
            expect(mockSwapProposalService.getSwapProposalById).not.toHaveBeenCalled();
            expect(mockSwapMatchingService.getSwapCompatibility).not.toHaveBeenCalled();
        });

        it('should return 400 when same swap ID is used for both parameters', async () => {
            // Arrange
            const sameSwapId = '123e4567-e89b-12d3-a456-426614174000';
            mockRequest.params = {
                sourceSwapId: sameSwapId,
                targetSwapId: sameSwapId
            };

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(400).json({
                    error: {
                        code: 'INVALID_REQUEST_DATA',
                        message: 'Cannot analyze compatibility between the same swap',
                        category: 'validation',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Cannot analyze compatibility between the same swap',
                    code: SWAP_ERROR_CODES.INVALID_REQUEST_DATA
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    userId: 'test-user-id',
                    requestId: 'test-request-id'
                })
            );
            expect(mockSwapProposalService.getSwapProposalById).not.toHaveBeenCalled();
            expect(mockSwapMatchingService.getSwapCompatibility).not.toHaveBeenCalled();
        });

        it('should return 400 for missing sourceSwapId parameter', async () => {
            // Arrange
            mockRequest.params = {
                sourceSwapId: undefined,
                targetSwapId: '987fcdeb-51a2-43d7-8f9e-123456789abc'
            };

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(400).json({
                    error: {
                        code: 'MISSING_REQUIRED_FIELDS',
                        message: 'Missing required parameters: sourceSwapId and targetSwapId',
                        category: 'validation',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Missing required parameters: sourceSwapId and targetSwapId',
                    code: SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    userId: 'test-user-id',
                    requestId: 'test-request-id'
                })
            );
        });

        it('should return 400 for missing targetSwapId parameter', async () => {
            // Arrange
            mockRequest.params = {
                sourceSwapId: '123e4567-e89b-12d3-a456-426614174000',
                targetSwapId: undefined
            };

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(400).json({
                    error: {
                        code: 'MISSING_REQUIRED_FIELDS',
                        message: 'Missing required parameters: sourceSwapId and targetSwapId',
                        category: 'validation',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Missing required parameters: sourceSwapId and targetSwapId',
                    code: SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    userId: 'test-user-id',
                    requestId: 'test-request-id'
                })
            );
        });

        it('should handle various invalid UUID formats', async () => {
            const invalidUuids = [
                'not-a-uuid',
                '123',
                '123e4567-e89b-12d3-a456',
                '123e4567-e89b-12d3-a456-426614174000-extra',
                'gggggggg-gggg-gggg-gggg-gggggggggggg',
                '123e4567_e89b_12d3_a456_426614174000',
                ''
            ];

            for (const invalidUuid of invalidUuids) {
                // Reset mocks for each iteration
                vi.clearAllMocks();
                vi.mocked(generateRequestId).mockReturnValue('test-request-id');

                mockRequest.params = {
                    sourceSwapId: invalidUuid,
                    targetSwapId: '987fcdeb-51a2-43d7-8f9e-123456789abc'
                };

                vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                    res.status(400).json({
                        error: {
                            code: 'INVALID_REQUEST_DATA',
                            message: 'Invalid sourceSwapId format',
                            category: 'validation',
                        },
                    });
                });

                // Act
                await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

                // Assert
                expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: 'Invalid sourceSwapId format',
                        code: SWAP_ERROR_CODES.INVALID_REQUEST_DATA
                    }),
                    mockResponse,
                    expect.any(Object)
                );
            }
        });

        it('should accept valid UUID formats (case insensitive)', async () => {
            // Arrange
            const validUuids = [
                '123e4567-e89b-12d3-a456-426614174000', // lowercase
                '123E4567-E89B-12D3-A456-426614174000', // uppercase
                '123e4567-E89B-12d3-A456-426614174000', // mixed case
            ];

            for (const validUuid of validUuids) {
                // Reset mocks for each iteration
                vi.clearAllMocks();
                vi.mocked(generateRequestId).mockReturnValue('test-request-id');

                const mockSourceSwap = {
                    id: validUuid.toLowerCase(),
                    ownerId: 'test-user-id',
                    proposerId: 'test-user-id',
                    status: 'active'
                };

                const mockTargetSwap = {
                    id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                    ownerId: 'other-user-id',
                    proposerId: 'other-user-id',
                    status: 'active'
                };

                const mockCompatibilityResponse: CompatibilityResponse = {
                    compatibility: {
                        overallScore: 80,
                        factors: {
                            locationCompatibility: { score: 80, weight: 0.25, details: 'Good match', status: 'good' },
                            dateCompatibility: { score: 80, weight: 0.30, details: 'Good match', status: 'good' },
                            valueCompatibility: { score: 80, weight: 0.20, details: 'Good match', status: 'good' },
                            accommodationCompatibility: { score: 80, weight: 0.15, details: 'Good match', status: 'good' },
                            guestCompatibility: { score: 80, weight: 0.10, details: 'Good match', status: 'good' }
                        },
                        recommendations: ['Good match'],
                        potentialIssues: []
                    },
                    recommendation: 'recommended'
                };

                mockRequest.params = {
                    sourceSwapId: validUuid,
                    targetSwapId: '987fcdeb-51a2-43d7-8f9e-123456789abc'
                };

                mockSwapProposalService.getSwapProposalById
                    .mockResolvedValueOnce(mockSourceSwap)
                    .mockResolvedValueOnce(mockTargetSwap);

                mockSwapMatchingService.getSwapCompatibility.mockResolvedValue(mockCompatibilityResponse);

                // Act
                await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

                // Assert - Should not call handleSwapError for validation
                expect(vi.mocked(handleSwapError)).not.toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: expect.stringContaining('Invalid')
                    }),
                    expect.any(Object),
                    expect.any(Object)
                );

                // Should proceed to service calls
                expect(mockSwapProposalService.getSwapProposalById).toHaveBeenCalled();
                expect(mockSwapMatchingService.getSwapCompatibility).toHaveBeenCalled();
            }
        });
    });

    describe('4.3 Test authentication and authorization', () => {
        it('should return 401 when user is not authenticated (no user object)', async () => {
            // Arrange
            mockRequest.user = undefined;

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(401).json({
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'User authentication required',
                        category: 'authentication',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'User authentication required'
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    requestId: 'test-request-id'
                })
            );
            expect(mockSwapProposalService.getSwapProposalById).not.toHaveBeenCalled();
            expect(mockSwapMatchingService.getSwapCompatibility).not.toHaveBeenCalled();
        });

        it('should return 401 when user ID is missing', async () => {
            // Arrange
            mockRequest.user = { id: undefined };

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(401).json({
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'User authentication required',
                        category: 'authentication',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'User authentication required'
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    requestId: 'test-request-id'
                })
            );
            expect(mockSwapProposalService.getSwapProposalById).not.toHaveBeenCalled();
            expect(mockSwapMatchingService.getSwapCompatibility).not.toHaveBeenCalled();
        });

        it('should return 401 when user ID is null', async () => {
            // Arrange
            mockRequest.user = { id: null };

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(401).json({
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'User authentication required',
                        category: 'authentication',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'User authentication required'
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    requestId: 'test-request-id'
                })
            );
        });

        it('should return 403 when user does not have access to source swap', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'other-user-id', // Different from test-user-id
                proposerId: 'another-user-id', // Different from test-user-id
                status: 'active'
            };

            mockSwapProposalService.getSwapProposalById.mockResolvedValueOnce(mockSourceSwap);

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(403).json({
                    error: {
                        code: 'BOOKING_ACCESS_DENIED',
                        message: 'Access denied to source swap',
                        category: 'authorization',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockSwapProposalService.getSwapProposalById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Access denied to source swap',
                    code: SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    userId: 'test-user-id',
                    requestId: 'test-request-id'
                })
            );
            expect(mockSwapMatchingService.getSwapCompatibility).not.toHaveBeenCalled();
        });

        it('should return 403 when user does not have access to target swap', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id', // User owns source swap
                proposerId: 'test-user-id',
                status: 'active'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'other-user-id', // Different from test-user-id
                proposerId: 'another-user-id', // Different from test-user-id
                status: 'active'
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(403).json({
                    error: {
                        code: 'BOOKING_ACCESS_DENIED',
                        message: 'Access denied to target swap',
                        category: 'authorization',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockSwapProposalService.getSwapProposalById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
            expect(mockSwapProposalService.getSwapProposalById).toHaveBeenCalledWith('987fcdeb-51a2-43d7-8f9e-123456789abc');
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Access denied to target swap',
                    code: SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    userId: 'test-user-id',
                    requestId: 'test-request-id'
                })
            );
            expect(mockSwapMatchingService.getSwapCompatibility).not.toHaveBeenCalled();
        });

        it('should allow access when user owns source swap', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id', // User owns source swap
                proposerId: 'other-user-id',
                status: 'active'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'test-user-id', // User also owns target swap
                proposerId: 'test-user-id',
                status: 'active'
            };

            const mockCompatibilityResponse: CompatibilityResponse = {
                compatibility: {
                    overallScore: 80,
                    factors: {
                        locationCompatibility: { score: 80, weight: 0.25, details: 'Good match', status: 'good' },
                        dateCompatibility: { score: 80, weight: 0.30, details: 'Good match', status: 'good' },
                        valueCompatibility: { score: 80, weight: 0.20, details: 'Good match', status: 'good' },
                        accommodationCompatibility: { score: 80, weight: 0.15, details: 'Good match', status: 'good' },
                        guestCompatibility: { score: 80, weight: 0.10, details: 'Good match', status: 'good' }
                    },
                    recommendations: ['Good match'],
                    potentialIssues: []
                },
                recommendation: 'recommended'
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            mockSwapMatchingService.getSwapCompatibility.mockResolvedValue(mockCompatibilityResponse);

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockSwapMatchingService.getSwapCompatibility).toHaveBeenCalledWith(
                '123e4567-e89b-12d3-a456-426614174000',
                '987fcdeb-51a2-43d7-8f9e-123456789abc'
            );
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockCompatibilityResponse,
                requestId: 'test-request-id',
                timestamp: expect.any(String),
            });
        });

        it('should allow access when user is proposer of source swap', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'other-user-id',
                proposerId: 'test-user-id', // User is proposer of source swap
                status: 'active'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'test-user-id', // User owns target swap
                proposerId: 'test-user-id',
                status: 'active'
            };

            const mockCompatibilityResponse: CompatibilityResponse = {
                compatibility: {
                    overallScore: 80,
                    factors: {
                        locationCompatibility: { score: 80, weight: 0.25, details: 'Good match', status: 'good' },
                        dateCompatibility: { score: 80, weight: 0.30, details: 'Good match', status: 'good' },
                        valueCompatibility: { score: 80, weight: 0.20, details: 'Good match', status: 'good' },
                        accommodationCompatibility: { score: 80, weight: 0.15, details: 'Good match', status: 'good' },
                        guestCompatibility: { score: 80, weight: 0.10, details: 'Good match', status: 'good' }
                    },
                    recommendations: ['Good match'],
                    potentialIssues: []
                },
                recommendation: 'recommended'
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            mockSwapMatchingService.getSwapCompatibility.mockResolvedValue(mockCompatibilityResponse);

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockSwapMatchingService.getSwapCompatibility).toHaveBeenCalledWith(
                '123e4567-e89b-12d3-a456-426614174000',
                '987fcdeb-51a2-43d7-8f9e-123456789abc'
            );
            expect(mockStatus).toHaveBeenCalledWith(200);
        });

        it('should allow access when user is proposer of target swap', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id', // User owns source swap
                proposerId: 'test-user-id',
                status: 'active'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'other-user-id',
                proposerId: 'test-user-id', // User is proposer of target swap
                status: 'active'
            };

            const mockCompatibilityResponse: CompatibilityResponse = {
                compatibility: {
                    overallScore: 80,
                    factors: {
                        locationCompatibility: { score: 80, weight: 0.25, details: 'Good match', status: 'good' },
                        dateCompatibility: { score: 80, weight: 0.30, details: 'Good match', status: 'good' },
                        valueCompatibility: { score: 80, weight: 0.20, details: 'Good match', status: 'good' },
                        accommodationCompatibility: { score: 80, weight: 0.15, details: 'Good match', status: 'good' },
                        guestCompatibility: { score: 80, weight: 0.10, details: 'Good match', status: 'good' }
                    },
                    recommendations: ['Good match'],
                    potentialIssues: []
                },
                recommendation: 'recommended'
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            mockSwapMatchingService.getSwapCompatibility.mockResolvedValue(mockCompatibilityResponse);

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockSwapMatchingService.getSwapCompatibility).toHaveBeenCalledWith(
                '123e4567-e89b-12d3-a456-426614174000',
                '987fcdeb-51a2-43d7-8f9e-123456789abc'
            );
            expect(mockStatus).toHaveBeenCalledWith(200);
        });

        it('should deny access when target swap is not pending and user has no access', async () => {
            // Test case: User owns source but target is not pending and user has no access
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id', // User owns source
                proposerId: 'test-user-id',
                status: 'pending'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'other-user-id', // User doesn't own target
                proposerId: 'another-user-id', // User is not proposer of target
                status: 'completed' // Target is completed, so user should be denied access
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(403).json({
                    error: {
                        code: 'BOOKING_ACCESS_DENIED',
                        message: 'Access denied to target swap',
                        category: 'authorization',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Access denied to target swap',
                    code: SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED
                }),
                mockResponse,
                expect.any(Object)
            );
        });

        it('should allow access to pending target swap that user does not own or propose to', async () => {
            // Test case: User owns source and target is pending (publicly accessible)
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id', // User owns source
                proposerId: 'test-user-id',
                status: 'pending'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'other-user-id', // User doesn't own target
                proposerId: 'another-user-id', // User is not proposer of target
                status: 'pending' // But target is pending (publicly accessible)
            };

            const mockCompatibilityResponse: CompatibilityResponse = {
                compatibility: {
                    overallScore: 75,
                    factors: {
                        locationCompatibility: { score: 75, weight: 0.25, details: 'Good match', status: 'good' },
                        dateCompatibility: { score: 75, weight: 0.30, details: 'Good match', status: 'good' },
                        valueCompatibility: { score: 75, weight: 0.20, details: 'Good match', status: 'good' },
                        accommodationCompatibility: { score: 75, weight: 0.15, details: 'Good match', status: 'good' },
                        guestCompatibility: { score: 75, weight: 0.10, details: 'Good match', status: 'good' }
                    },
                    recommendations: ['Good match'],
                    potentialIssues: []
                },
                recommendation: 'recommended'
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            mockSwapMatchingService.getSwapCompatibility.mockResolvedValue(mockCompatibilityResponse);

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert - Should succeed because target swap is active
            expect(mockSwapMatchingService.getSwapCompatibility).toHaveBeenCalledWith(
                '123e4567-e89b-12d3-a456-426614174000',
                '987fcdeb-51a2-43d7-8f9e-123456789abc'
            );
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith({
                success: true,
                data: mockCompatibilityResponse,
                requestId: 'test-request-id',
                timestamp: expect.any(String),
            });
        });
    });

    describe('4.4 Test error handling scenarios', () => {
        it('should return 404 when source swap does not exist', async () => {
            // Arrange
            mockSwapProposalService.getSwapProposalById.mockResolvedValueOnce(null); // Source swap not found

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(404).json({
                    error: {
                        code: 'BOOKING_NOT_FOUND',
                        message: 'Source swap not found',
                        category: 'not_found',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockSwapProposalService.getSwapProposalById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Source swap not found',
                    code: SWAP_ERROR_CODES.BOOKING_NOT_FOUND
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    userId: 'test-user-id',
                    requestId: 'test-request-id'
                })
            );
            expect(mockSwapMatchingService.getSwapCompatibility).not.toHaveBeenCalled();
        });

        it('should return 404 when target swap does not exist', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id',
                proposerId: 'test-user-id',
                status: 'active'
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(null); // Target swap not found

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(404).json({
                    error: {
                        code: 'BOOKING_NOT_FOUND',
                        message: 'Target swap not found',
                        category: 'not_found',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockSwapProposalService.getSwapProposalById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
            expect(mockSwapProposalService.getSwapProposalById).toHaveBeenCalledWith('987fcdeb-51a2-43d7-8f9e-123456789abc');
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Target swap not found',
                    code: SWAP_ERROR_CODES.BOOKING_NOT_FOUND
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    userId: 'test-user-id',
                    requestId: 'test-request-id'
                })
            );
            expect(mockSwapMatchingService.getSwapCompatibility).not.toHaveBeenCalled();
        });

        it('should return 404 when both swaps do not exist', async () => {
            // Arrange
            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(null) // Source swap not found
                .mockResolvedValueOnce(null); // Target swap not found

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(404).json({
                    error: {
                        code: 'BOOKING_NOT_FOUND',
                        message: 'Source swap not found',
                        category: 'not_found',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockSwapProposalService.getSwapProposalById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Source swap not found',
                    code: SWAP_ERROR_CODES.BOOKING_NOT_FOUND
                }),
                mockResponse,
                expect.any(Object)
            );
            // Should not proceed to check target swap if source swap is not found
            expect(mockSwapMatchingService.getSwapCompatibility).not.toHaveBeenCalled();
        });

        it('should return 500 when SwapMatchingService throws an error', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id',
                proposerId: 'test-user-id',
                status: 'active'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'other-user-id',
                proposerId: 'test-user-id', // User has access
                status: 'active'
            };

            const serviceError = new Error('Compatibility analysis engine failure');
            (serviceError as any).code = 'SERVICE_INTEGRATION_FAILED';

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            mockSwapMatchingService.getSwapCompatibility.mockRejectedValue(serviceError);

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(500).json({
                    error: {
                        code: 'SERVICE_INTEGRATION_FAILED',
                        message: 'Compatibility analysis engine failure',
                        category: 'system',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockSwapMatchingService.getSwapCompatibility).toHaveBeenCalledWith(
                '123e4567-e89b-12d3-a456-426614174000',
                '987fcdeb-51a2-43d7-8f9e-123456789abc'
            );
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                serviceError,
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    userId: 'test-user-id',
                    requestId: 'test-request-id'
                })
            );
        });

        it('should return 500 when SwapMatchingService returns invalid response', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id',
                proposerId: 'test-user-id',
                status: 'active'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'other-user-id',
                proposerId: 'test-user-id', // User has access
                status: 'active'
            };

            // Return invalid response (missing compatibility property)
            const invalidResponse = {
                recommendation: 'recommended'
                // Missing compatibility property
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            mockSwapMatchingService.getSwapCompatibility.mockResolvedValue(invalidResponse);

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(500).json({
                    error: {
                        code: 'SERVICE_INTEGRATION_FAILED',
                        message: 'Invalid compatibility analysis response from service',
                        category: 'system',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Invalid compatibility analysis response from service',
                    code: SWAP_ERROR_CODES.SERVICE_INTEGRATION_FAILED
                }),
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    userId: 'test-user-id',
                    requestId: 'test-request-id'
                })
            );
        });

        it('should return 500 when SwapMatchingService returns null response', async () => {
            // Arrange
            const mockSourceSwap = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                ownerId: 'test-user-id',
                proposerId: 'test-user-id',
                status: 'active'
            };

            const mockTargetSwap = {
                id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
                ownerId: 'other-user-id',
                proposerId: 'test-user-id', // User has access
                status: 'active'
            };

            mockSwapProposalService.getSwapProposalById
                .mockResolvedValueOnce(mockSourceSwap)
                .mockResolvedValueOnce(mockTargetSwap);

            mockSwapMatchingService.getSwapCompatibility.mockResolvedValue(null);

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(500).json({
                    error: {
                        code: 'SERVICE_INTEGRATION_FAILED',
                        message: 'Invalid compatibility analysis response from service',
                        category: 'system',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Invalid compatibility analysis response from service',
                    code: SWAP_ERROR_CODES.SERVICE_INTEGRATION_FAILED
                }),
                mockResponse,
                expect.any(Object)
            );
        });

        it('should handle database connection errors gracefully', async () => {
            // Arrange
            const dbError = new Error('Database connection timeout');
            (dbError as any).code = 'DB_CONNECTION_ERROR';

            mockSwapProposalService.getSwapProposalById.mockRejectedValue(dbError);

            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                res.status(500).json({
                    error: {
                        code: 'DB_CONNECTION_ERROR',
                        message: 'Database connection timeout',
                        category: 'system',
                    },
                });
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                dbError,
                mockResponse,
                expect.objectContaining({
                    operation: 'getSwapCompatibility',
                    userId: 'test-user-id',
                    requestId: 'test-request-id'
                })
            );
        });

        it('should verify error response format consistency', async () => {
            // Arrange
            mockRequest.user = undefined; // Trigger authentication error

            let capturedErrorResponse: any;
            vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                capturedErrorResponse = {
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'User authentication required',
                        category: 'authentication',
                    },
                    requestId: context.requestId,
                    timestamp: new Date().toISOString(),
                };
                res.status(401).json(capturedErrorResponse);
            });

            // Act
            await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

            // Assert - Verify error response structure
            expect(capturedErrorResponse).toEqual({
                error: {
                    code: expect.any(String),
                    message: expect.any(String),
                    category: expect.any(String),
                },
                requestId: expect.any(String),
                timestamp: expect.any(String),
            });

            // Verify specific error properties
            expect(capturedErrorResponse.error.code).toBe('UNAUTHORIZED');
            expect(capturedErrorResponse.error.message).toBe('User authentication required');
            expect(capturedErrorResponse.error.category).toBe('authentication');
            expect(capturedErrorResponse.requestId).toBe('test-request-id');
        });

        it('should handle multiple error scenarios in sequence', async () => {
            const errorScenarios = [
                {
                    name: 'Authentication Error',
                    setup: () => { mockRequest.user = undefined; },
                    expectedCode: 'UNAUTHORIZED',
                    expectedMessage: 'User authentication required'
                },
                {
                    name: 'Source Swap Not Found',
                    setup: () => {
                        mockRequest.user = { id: 'test-user-id' };
                        mockSwapProposalService.getSwapProposalById.mockResolvedValueOnce(null);
                    },
                    expectedCode: 'BOOKING_NOT_FOUND',
                    expectedMessage: 'Source swap not found'
                },
                {
                    name: 'Service Error',
                    setup: () => {
                        mockRequest.user = { id: 'test-user-id' };
                        const mockSourceSwap = { id: '123e4567-e89b-12d3-a456-426614174000', ownerId: 'test-user-id', proposerId: 'test-user-id', status: 'active' };
                        const mockTargetSwap = { id: '987fcdeb-51a2-43d7-8f9e-123456789abc', ownerId: 'test-user-id', proposerId: 'test-user-id', status: 'active' };
                        mockSwapProposalService.getSwapProposalById
                            .mockResolvedValueOnce(mockSourceSwap)
                            .mockResolvedValueOnce(mockTargetSwap);
                        mockSwapMatchingService.getSwapCompatibility.mockRejectedValue(new Error('Service failure'));
                    },
                    expectedCode: 'SERVICE_INTEGRATION_FAILED',
                    expectedMessage: 'Service failure'
                }
            ];

            for (const scenario of errorScenarios) {
                // Reset mocks for each scenario
                vi.clearAllMocks();
                vi.mocked(generateRequestId).mockReturnValue('test-request-id');

                // Setup scenario
                scenario.setup();

                vi.mocked(handleSwapError).mockImplementation((error, res, context) => {
                    res.status(500).json({
                        error: {
                            code: scenario.expectedCode,
                            message: scenario.expectedMessage,
                            category: 'system',
                        },
                    });
                });

                // Act
                await swapController.getSwapCompatibility(mockRequest as Request, mockResponse as Response);

                // Assert
                expect(vi.mocked(handleSwapError)).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: expect.stringContaining(scenario.expectedMessage.split(' ')[0]) // Check first word
                    }),
                    mockResponse,
                    expect.any(Object)
                );
            }
        });
    });
});