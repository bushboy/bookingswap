import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Request, Response } from 'express';
import { UserController } from '../UserController';
import { UserRepository } from '../../database/repositories/UserRepository';
import { BookingRepository } from '../../database/repositories/BookingRepository';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { User } from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../database/repositories/UserRepository');
vi.mock('../../database/repositories/BookingRepository');
vi.mock('../../database/repositories/SwapRepository');
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('UserController', () => {
  let userController: UserController;
  let mockUserRepository: UserRepository;
  let mockBookingRepository: BookingRepository;
  let mockSwapRepository: SwapRepository;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  const mockUser: User = {
    id: 'user-123',
    walletAddress: '0.0.123456',
    profile: {
      displayName: 'Test User',
      email: 'test@example.com',
      preferences: { notifications: true },
    },
    verification: {
      level: 'verified',
      documents: [],
    },
    reputation: {
      score: 150,
      completedSwaps: 5,
      cancelledSwaps: 1,
      reviews: [],
    },
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockUserRepository = new UserRepository({} as any);
    mockBookingRepository = new BookingRepository({} as any);
    mockSwapRepository = new SwapRepository({} as any);
    userController = new UserController(
      mockUserRepository,
      mockBookingRepository,
      mockSwapRepository
    );

    mockRequest = {
      body: {},
      query: {},
      user: mockUser,
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    vi.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile for authenticated user', async () => {
      // Act
      await userController.getProfile(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        user: expect.objectContaining({
          id: mockUser.id,
          walletAddress: mockUser.walletAddress,
          profile: mockUser.profile,
        }),
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await userController.getProfile(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          category: 'authentication',
        },
      });
    });
  });

  describe('updateProfile', () => {
    it('should update user profile with valid data', async () => {
      // Arrange
      const updateData = {
        displayName: 'Updated Name',
        email: 'updated@example.com',
        preferences: { notifications: false },
      };
      mockRequest.body = updateData;

      const updatedUser = { ...mockUser, profile: { ...mockUser.profile, ...updateData } };
      (mockUserRepository.update as Mock).mockResolvedValue(updatedUser);

      // Act
      await userController.updateProfile(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          profile: expect.objectContaining({
            displayName: 'Updated Name',
            email: 'updated@example.com',
            preferences: expect.objectContaining({
              notifications: false,
            }),
          }),
        })
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        user: expect.objectContaining({
          id: updatedUser.id,
          profile: expect.objectContaining(updateData),
        }),
      });
    });

    it('should return validation error for invalid data', async () => {
      // Arrange
      mockRequest.body = { email: 'invalid-email' };

      // Act
      await userController.updateProfile(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('email'),
          category: 'validation',
        },
      });
    });

    it('should return 404 if user not found during update', async () => {
      // Arrange
      mockRequest.body = { displayName: 'New Name' };
      (mockUserRepository.update as Mock).mockResolvedValue(null);

      // Act
      await userController.updateProfile(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          category: 'user_management',
        },
      });
    });
  });

  describe('getDashboard', () => {
    it('should return dashboard data for authenticated user', async () => {
      // Arrange
      const mockBookings = [{ id: 'booking-1' }, { id: 'booking-2' }];
      const mockSwaps = [{ id: 'swap-1' }];

      (mockBookingRepository.findByFilters as Mock)
        .mockResolvedValueOnce([{ id: 'active-1' }]) // active bookings
        .mockResolvedValueOnce(mockBookings); // recent bookings

      (mockSwapRepository.findByFilters as Mock)
        .mockResolvedValueOnce([{ id: 'pending-1' }]) // pending swaps
        .mockResolvedValueOnce(mockSwaps); // recent swaps

      // Act
      await userController.getDashboard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        user: mockUser,
        stats: {
          activeBookings: 1,
          pendingSwaps: 1,
          completedSwaps: mockUser.reputation.completedSwaps,
          totalBookings: mockBookings.length,
        },
        recentActivity: {
          recentBookings: mockBookings.slice(0, 5),
          recentSwaps: mockSwaps.slice(0, 5),
        },
      });
    });

    it('should handle repository errors', async () => {
      // Arrange
      (mockBookingRepository.findByFilters as Mock).mockRejectedValue(new Error('DB error'));

      // Act
      await userController.getDashboard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'DASHBOARD_FETCH_FAILED',
          message: 'Failed to fetch dashboard data',
          category: 'user_management',
        },
      });
    });
  });

  describe('getTransactionHistory', () => {
    it('should return paginated transaction history', async () => {
      // Arrange
      const mockSwaps = [{ id: 'swap-1' }, { id: 'swap-2' }];
      const mockBookings = [{ id: 'booking-1' }, { id: 'booking-2' }];

      mockRequest.query = { page: '2', limit: '10' };

      (mockSwapRepository.findByFilters as Mock).mockResolvedValue(mockSwaps);
      (mockBookingRepository.findByFilters as Mock).mockResolvedValue(mockBookings);

      // Act
      await userController.getTransactionHistory(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSwapRepository.findByFilters).toHaveBeenCalledWith(
        { userId: mockUser.id },
        10,
        10 // offset for page 2
      );
      expect(mockBookingRepository.findByFilters).toHaveBeenCalledWith(
        { userId: mockUser.id },
        10,
        10
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        swaps: mockSwaps,
        bookings: mockBookings,
        pagination: {
          page: 2,
          limit: 10,
          hasMore: false, // less than limit returned
        },
      });
    });

    it('should use default pagination values', async () => {
      // Arrange
      (mockSwapRepository.findByFilters as Mock).mockResolvedValue([]);
      (mockBookingRepository.findByFilters as Mock).mockResolvedValue([]);

      // Act
      await userController.getTransactionHistory(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSwapRepository.findByFilters).toHaveBeenCalledWith(
        { userId: mockUser.id },
        20, // default limit
        0   // default offset
      );
    });

    it('should limit maximum page size', async () => {
      // Arrange
      mockRequest.query = { limit: '200' }; // exceeds max of 100
      (mockSwapRepository.findByFilters as Mock).mockResolvedValue([]);
      (mockBookingRepository.findByFilters as Mock).mockResolvedValue([]);

      // Act
      await userController.getTransactionHistory(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSwapRepository.findByFilters).toHaveBeenCalledWith(
        { userId: mockUser.id },
        100, // capped at 100
        0
      );
    });
  });

  describe('getStatistics', () => {
    it('should return user statistics', async () => {
      // Arrange
      const mockStats = {
        bookings: { total: 10, active: 3, completed: 7 },
        swaps: { total: 8, pending: 1, completed: 5, rejected: 2, successRate: 62.5 },
      };

      // Mock all the repository calls for statistics
      (mockBookingRepository.findByFilters as Mock)
        .mockResolvedValueOnce(new Array(10)) // total bookings
        .mockResolvedValueOnce(new Array(3))  // active bookings
        .mockResolvedValueOnce(new Array(7)); // completed bookings

      (mockSwapRepository.findByFilters as Mock)
        .mockResolvedValueOnce(new Array(8)) // total swaps
        .mockResolvedValueOnce(new Array(1)) // pending swaps
        .mockResolvedValueOnce(new Array(5)) // completed swaps
        .mockResolvedValueOnce(new Array(2)); // rejected swaps

      // Act
      await userController.getStatistics(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        userId: mockUser.id,
        statistics: mockStats,
        reputation: mockUser.reputation,
        verification: mockUser.verification,
      });
    });

    it('should handle zero swaps for success rate calculation', async () => {
      // Arrange
      (mockBookingRepository.findByFilters as Mock).mockResolvedValue([]);
      (mockSwapRepository.findByFilters as Mock).mockResolvedValue([]);

      // Act
      await userController.getStatistics(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        userId: mockUser.id,
        statistics: {
          bookings: { total: 0, active: 0, completed: 0 },
          swaps: { total: 0, pending: 0, completed: 0, rejected: 0, successRate: 0 },
        },
        reputation: mockUser.reputation,
        verification: mockUser.verification,
      });
    });
  });
});