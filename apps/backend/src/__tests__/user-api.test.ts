import request from 'supertest';
import { Express } from 'express';
import express from 'express';
import { UserController } from '../controllers/UserController';
import { createUserRoutes } from '../routes/users';
import { WALLET_CONFIG } from '../../../../tests/fixtures/wallet-config';

// Mock the repositories for testing
const mockUserRepository = {
  update: vi.fn(),
};

const mockBookingRepository = {
  findByFilters: vi.fn(),
};

const mockSwapRepository = {
  findByFilters: vi.fn(),
};

// Mock auth middleware with a test user
const mockUser = {
  id: 'test-user-id',
  walletAddress: WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT,
  profile: {
    displayName: 'Test User',
    email: 'test@example.com',
    phone: '+1234567890',
    preferences: {
      notifications: true,
      autoAcceptCriteria: {
        maxAdditionalPayment: 100,
        preferredLocations: ['Paris', 'London'],
        bookingTypes: ['hotel', 'event'],
      },
    },
  },
  verification: {
    level: 'verified',
    verifiedAt: new Date().toISOString(),
    documents: [],
  },
  reputation: {
    score: 85,
    completedSwaps: 12,
    cancelledSwaps: 1,
    reviews: [],
  },
  createdAt: new Date('2023-01-01').toISOString(),
  lastActiveAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAuthMiddleware = {
  requireAuth: () => (req: any, res: any, next: any) => {
    req.user = mockUser;
    next();
  },
};

describe('User Management API Endpoints', () => {
  let app: Express;

  beforeAll(() => {
    // Create test app with mocked dependencies
    app = express();
    app.use(express.json());

    const userController = new UserController(
      mockUserRepository as any,
      mockBookingRepository as any,
      mockSwapRepository as any
    );
    const authMiddleware = mockAuthMiddleware as any;

    app.use('/api/users', createUserRoutes(userController, authMiddleware));
  });

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  describe('GET /api/users/profile', () => {
    it('should return user profile', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe('test-user-id');
      expect(response.body.user.walletAddress).toBe(WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT);
      expect(response.body.user.profile.displayName).toBe('Test User');
      expect(response.body.user.profile.email).toBe('test@example.com');
      expect(response.body.user.verification.level).toBe('verified');
      expect(response.body.user.reputation.score).toBe(85);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user profile', async () => {
      const updateData = {
        displayName: 'Updated Test User',
        email: 'updated@example.com',
        preferences: {
          notifications: false,
        },
      };

      const updatedUser = {
        ...mockUser,
        profile: {
          ...mockUser.profile,
          displayName: updateData.displayName,
          email: updateData.email,
          preferences: {
            ...mockUser.profile.preferences,
            notifications: updateData.preferences.notifications,
          },
        },
        updatedAt: new Date().toISOString(),
      };

      mockUserRepository.update.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/profile')
        .send(updateData)
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.profile.displayName).toBe('Updated Test User');
      expect(response.body.user.profile.email).toBe('updated@example.com');
      expect(response.body.user.profile.preferences.notifications).toBe(false);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({
          profile: expect.objectContaining({
            displayName: 'Updated Test User',
            email: 'updated@example.com',
          }),
        })
      );
    });

    it('should return 400 for invalid email format', async () => {
      const invalidData = {
        email: 'invalid-email-format',
      };

      const response = await request(app)
        .put('/api/users/profile')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('email');
    });

    it('should return 400 for invalid phone format', async () => {
      const invalidData = {
        phone: 'invalid-phone',
      };

      const response = await request(app)
        .put('/api/users/profile')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle partial profile updates', async () => {
      const partialUpdate = {
        displayName: 'Partially Updated User',
      };

      const updatedUser = {
        ...mockUser,
        profile: {
          ...mockUser.profile,
          displayName: partialUpdate.displayName,
        },
      };

      mockUserRepository.update.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/profile')
        .send(partialUpdate)
        .expect(200);

      expect(response.body.user.profile.displayName).toBe('Partially Updated User');
      expect(response.body.user.profile.email).toBe('test@example.com'); // Should remain unchanged
    });
  });

  describe('GET /api/users/dashboard', () => {
    it('should return user dashboard data', async () => {
      const mockActiveBookings = [
        { id: 'booking-1', status: 'available', title: 'Hotel in Paris' },
        { id: 'booking-2', status: 'available', title: 'Event in London' },
      ];

      const mockPendingSwaps = [
        { id: 'swap-1', status: 'pending', sourceBookingId: 'booking-1' },
      ];

      const mockRecentBookings = [
        { id: 'booking-1', title: 'Hotel in Paris', createdAt: new Date().toISOString() },
        { id: 'booking-2', title: 'Event in London', createdAt: new Date().toISOString() },
      ];

      const mockRecentSwaps = [
        { id: 'swap-1', status: 'pending', createdAt: new Date().toISOString() },
      ];

      // Mock repository calls for dashboard aggregation
      mockBookingRepository.findByFilters
        .mockResolvedValueOnce(mockActiveBookings) // activeBookings
        .mockResolvedValueOnce(mockRecentBookings); // recentBookings

      mockSwapRepository.findByFilters
        .mockResolvedValueOnce(mockPendingSwaps) // pendingSwaps
        .mockResolvedValueOnce(mockRecentSwaps); // recentSwaps

      const response = await request(app)
        .get('/api/users/dashboard')
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.activeBookings).toBe(2);
      expect(response.body.stats.pendingSwaps).toBe(1);
      expect(response.body.stats.completedSwaps).toBe(12); // From user reputation
      expect(response.body.recentActivity).toBeDefined();
      expect(response.body.recentActivity.recentBookings).toHaveLength(2);
      expect(response.body.recentActivity.recentSwaps).toHaveLength(1);
    });
  });

  describe('GET /api/users/history', () => {
    it('should return user transaction history with default pagination', async () => {
      const mockSwaps = [
        { id: 'swap-1', status: 'completed', createdAt: new Date().toISOString() },
        { id: 'swap-2', status: 'pending', createdAt: new Date().toISOString() },
      ];

      const mockBookings = [
        { id: 'booking-1', status: 'swapped', createdAt: new Date().toISOString() },
        { id: 'booking-2', status: 'available', createdAt: new Date().toISOString() },
      ];

      mockSwapRepository.findByFilters.mockResolvedValue(mockSwaps);
      mockBookingRepository.findByFilters.mockResolvedValue(mockBookings);

      const response = await request(app)
        .get('/api/users/history')
        .expect(200);

      expect(response.body.swaps).toEqual(mockSwaps);
      expect(response.body.bookings).toEqual(mockBookings);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
      expect(mockSwapRepository.findByFilters).toHaveBeenCalledWith(
        { userId: 'test-user-id' },
        20,
        0
      );
      expect(mockBookingRepository.findByFilters).toHaveBeenCalledWith(
        { userId: 'test-user-id' },
        20,
        0
      );
    });

    it('should return user transaction history with custom pagination', async () => {
      const mockSwaps = [];
      const mockBookings = [];

      mockSwapRepository.findByFilters.mockResolvedValue(mockSwaps);
      mockBookingRepository.findByFilters.mockResolvedValue(mockBookings);

      const response = await request(app)
        .get('/api/users/history')
        .query({ page: '2', limit: '10' })
        .expect(200);

      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
      expect(mockSwapRepository.findByFilters).toHaveBeenCalledWith(
        { userId: 'test-user-id' },
        10,
        10 // offset = (page - 1) * limit = (2 - 1) * 10 = 10
      );
    });

    it('should limit maximum page size to 100', async () => {
      mockSwapRepository.findByFilters.mockResolvedValue([]);
      mockBookingRepository.findByFilters.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users/history')
        .query({ limit: '200' }) // Request more than max
        .expect(200);

      expect(response.body.pagination.limit).toBe(100); // Should be capped at 100
      expect(mockSwapRepository.findByFilters).toHaveBeenCalledWith(
        { userId: 'test-user-id' },
        100,
        0
      );
    });
  });

  describe('GET /api/users/statistics', () => {
    it('should return user statistics and reputation', async () => {
      const mockTotalBookings = [
        { id: 'booking-1' },
        { id: 'booking-2' },
        { id: 'booking-3' },
      ];

      const mockActiveBookings = [
        { id: 'booking-1', status: 'available' },
        { id: 'booking-2', status: 'available' },
      ];

      const mockCompletedBookings = [
        { id: 'booking-3', status: 'swapped' },
      ];

      const mockTotalSwaps = [
        { id: 'swap-1' },
        { id: 'swap-2' },
        { id: 'swap-3' },
        { id: 'swap-4' },
      ];

      const mockPendingSwaps = [
        { id: 'swap-1', status: 'pending' },
      ];

      const mockCompletedSwaps = [
        { id: 'swap-2', status: 'completed' },
        { id: 'swap-3', status: 'completed' },
      ];

      const mockRejectedSwaps = [
        { id: 'swap-4', status: 'rejected' },
      ];

      // Mock all the repository calls for statistics calculation
      mockBookingRepository.findByFilters
        .mockResolvedValueOnce(mockTotalBookings) // totalBookings
        .mockResolvedValueOnce(mockActiveBookings) // activeBookings
        .mockResolvedValueOnce(mockCompletedBookings); // completedBookings

      mockSwapRepository.findByFilters
        .mockResolvedValueOnce(mockTotalSwaps) // totalSwaps
        .mockResolvedValueOnce(mockPendingSwaps) // pendingSwaps
        .mockResolvedValueOnce(mockCompletedSwaps) // completedSwaps
        .mockResolvedValueOnce(mockRejectedSwaps); // rejectedSwaps

      const response = await request(app)
        .get('/api/users/statistics')
        .expect(200);

      expect(response.body.userId).toBe('test-user-id');
      expect(response.body.statistics).toBeDefined();
      expect(response.body.statistics.bookings).toEqual({
        total: 3,
        active: 2,
        completed: 1,
      });
      expect(response.body.statistics.swaps).toEqual({
        total: 4,
        pending: 1,
        completed: 2,
        rejected: 1,
        successRate: 50, // 2 completed out of 4 total = 50%
      });
      expect(response.body.reputation).toEqual(mockUser.reputation);
      expect(response.body.verification).toEqual(mockUser.verification);
    });

    it('should handle zero swaps for success rate calculation', async () => {
      // Mock empty results
      mockBookingRepository.findByFilters.mockResolvedValue([]);
      mockSwapRepository.findByFilters.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users/statistics')
        .expect(200);

      expect(response.body.statistics.swaps.successRate).toBe(0);
    });
  });
});