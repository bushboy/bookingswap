import { Request, Response } from 'express';
import { UserRepository } from '../database/repositories/UserRepository';
import { BookingRepository } from '../database/repositories/BookingRepository';
import { SwapRepository } from '../database/repositories/SwapRepository';
import { User, UserProfile } from '@booking-swap/shared';
import { logger } from '../utils/logger';
import Joi from '@hapi/joi';

const updateProfileSchema = Joi.object({
  displayName: Joi.string().max(100).optional(),
  email: Joi.string().email({ tlds: false }).optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
  preferences: Joi.object({
    notifications: Joi.boolean().optional(),
    autoAcceptCriteria: Joi.object({
      maxAdditionalPayment: Joi.number().min(0).optional(),
      preferredLocations: Joi.array().items(Joi.string()).optional(),
      bookingTypes: Joi.array().items(Joi.string()).optional(),
    }).optional(),
  }).optional(),
});

const updateWalletSchema = Joi.object({
  walletAddress: Joi.string().pattern(/^0\.0\.\d+$/).required(), // Hedera account ID format
});

export interface UserDashboardData {
  user: User;
  stats: {
    activeBookings: number;
    pendingSwaps: number;
    completedSwaps: number;
    totalBookings: number;
  };
  recentActivity: {
    recentBookings: any[];
    recentSwaps: any[];
  };
}

export class UserController {
  constructor(
    private userRepository: UserRepository,
    private bookingRepository: BookingRepository,
    private swapRepository: SwapRepository
  ) { }

  /**
   * Get current user profile
   */
  getProfile = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            category: 'authentication',
          },
        });
      }

      res.json({
        user: {
          id: req.user.id,
          walletAddress: req.user.walletAddress,
          profile: req.user.profile,
          verification: req.user.verification,
          reputation: req.user.reputation,
          lastActiveAt: req.user.lastActiveAt,
          createdAt: req.user.createdAt,
          updatedAt: req.user.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Get profile failed', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        error: {
          code: 'PROFILE_FETCH_FAILED',
          message: 'Failed to fetch user profile',
          category: 'user_management',
        },
      });
    }
  };

  /**
   * Update user profile
   */
  updateProfile = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            category: 'authentication',
          },
        });
      }

      const { error, value } = updateProfileSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message,
            category: 'validation',
          },
        });
      }

      // Merge updated profile data
      const updatedProfile: UserProfile = {
        ...req.user.profile,
        ...value,
        preferences: {
          ...req.user.profile.preferences,
          ...(value.preferences || {}),
        },
      };

      const updatedUserData = {
        ...req.user,
        profile: updatedProfile,
      };

      const updatedUser = await this.userRepository.update(req.user.id, updatedUserData);
      if (!updatedUser) {
        return res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            category: 'user_management',
          },
        });
      }

      logger.info('User profile updated', { userId: req.user.id });

      res.json({
        user: {
          id: updatedUser.id,
          walletAddress: updatedUser.walletAddress,
          profile: updatedUser.profile,
          verification: updatedUser.verification,
          reputation: updatedUser.reputation,
          lastActiveAt: updatedUser.lastActiveAt,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Update profile failed', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        error: {
          code: 'PROFILE_UPDATE_FAILED',
          message: 'Failed to update user profile',
          category: 'user_management',
        },
      });
    }
  };

  /**
   * Update user wallet address
   */
  updateWallet = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            category: 'authentication',
          },
        });
      }

      const { error, value } = updateWalletSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message,
            category: 'validation',
          },
        });
      }

      const { walletAddress } = value;

      // Check if wallet address is already in use by another user
      const existingUser = await this.userRepository.findByWalletAddress(walletAddress);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(409).json({
          error: {
            code: 'WALLET_ADDRESS_IN_USE',
            message: 'This wallet address is already associated with another account',
            category: 'validation',
          },
        });
      }

      // Update user with wallet address
      const updatedUserData = {
        ...req.user,
        walletAddress,
      };

      const updatedUser = await this.userRepository.update(req.user.id, updatedUserData);
      if (!updatedUser) {
        return res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            category: 'user_management',
          },
        });
      }

      logger.info('User wallet address updated', {
        userId: req.user.id,
        walletAddress: walletAddress
      });

      res.json({
        user: {
          id: updatedUser.id,
          walletAddress: updatedUser.walletAddress,
          profile: updatedUser.profile,
          verification: updatedUser.verification,
          reputation: updatedUser.reputation,
          lastActiveAt: updatedUser.lastActiveAt,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Update wallet failed', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        error: {
          code: 'WALLET_UPDATE_FAILED',
          message: 'Failed to update wallet address',
          category: 'user_management',
        },
      });
    }
  };

  /**
   * Get user dashboard data with aggregated information
   */
  getDashboard = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            category: 'authentication',
          },
        });
      }

      const dashboardData = await this.aggregateDashboardData(req.user);

      res.json(dashboardData);
    } catch (error) {
      logger.error('Dashboard data fetch failed', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        error: {
          code: 'DASHBOARD_FETCH_FAILED',
          message: 'Failed to fetch dashboard data',
          category: 'user_management',
        },
      });
    }
  };

  /**
   * Get user transaction history
   */
  getTransactionHistory = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            category: 'authentication',
          },
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      // Get user's swaps (both as proposer and owner)
      const userSwaps = await this.swapRepository.findByFilters({
        userId: req.user.id,
      }, limit, offset);

      // Get user's bookings
      const userBookings = await this.bookingRepository.findByFilters({
        userId: req.user.id,
      }, limit, offset);

      res.json({
        swaps: userSwaps,
        bookings: userBookings,
        pagination: {
          page,
          limit,
          hasMore: userSwaps.length === limit || userBookings.length === limit,
        },
      });
    } catch (error) {
      logger.error('Transaction history fetch failed', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        error: {
          code: 'HISTORY_FETCH_FAILED',
          message: 'Failed to fetch transaction history',
          category: 'user_management',
        },
      });
    }
  };

  /**
   * Get user statistics
   */
  getStatistics = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            category: 'authentication',
          },
        });
      }

      const stats = await this.calculateUserStatistics(req.user.id);

      res.json({
        userId: req.user.id,
        statistics: stats,
        reputation: req.user.reputation,
        verification: req.user.verification,
      });
    } catch (error) {
      logger.error('Statistics fetch failed', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        error: {
          code: 'STATISTICS_FETCH_FAILED',
          message: 'Failed to fetch user statistics',
          category: 'user_management',
        },
      });
    }
  };

  /**
   * Aggregate dashboard data for user
   */
  private async aggregateDashboardData(user: User): Promise<UserDashboardData> {
    const [
      activeBookings,
      pendingSwaps,
      recentBookings,
      recentSwaps,
    ] = await Promise.all([
      this.bookingRepository.findByFilters({ userId: user.id, status: 'available' }),
      this.swapRepository.findByFilters({ userId: user.id, status: 'pending' }),
      this.bookingRepository.findByFilters({ userId: user.id }, 5, 0),
      this.swapRepository.findByFilters({ userId: user.id }, 5, 0),
    ]);

    const stats = {
      activeBookings: activeBookings.length,
      pendingSwaps: pendingSwaps.length,
      completedSwaps: user.reputation.completedSwaps,
      totalBookings: recentBookings.length, // This would be better with a count query
    };

    return {
      user,
      stats,
      recentActivity: {
        recentBookings: recentBookings.slice(0, 5),
        recentSwaps: recentSwaps.slice(0, 5),
      },
    };
  }

  /**
   * Calculate detailed user statistics
   */
  private async calculateUserStatistics(userId: string) {
    const [
      totalBookings,
      activeBookings,
      completedBookings,
      totalSwaps,
      pendingSwaps,
      completedSwaps,
      rejectedSwaps,
    ] = await Promise.all([
      this.bookingRepository.findByFilters({ userId }),
      this.bookingRepository.findByFilters({ userId, status: 'available' }),
      this.bookingRepository.findByFilters({ userId, status: 'swapped' }),
      this.swapRepository.findByFilters({ userId }),
      this.swapRepository.findByFilters({ userId, status: 'pending' }),
      this.swapRepository.findByFilters({ userId, status: 'completed' }),
      this.swapRepository.findByFilters({ userId, status: 'rejected' }),
    ]);

    return {
      bookings: {
        total: totalBookings.length,
        active: activeBookings.length,
        completed: completedBookings.length,
      },
      swaps: {
        total: totalSwaps.length,
        pending: pendingSwaps.length,
        completed: completedSwaps.length,
        rejected: rejectedSwaps.length,
        successRate: totalSwaps.length > 0
          ? (completedSwaps.length / totalSwaps.length) * 100
          : 0,
      },
    };
  }
}