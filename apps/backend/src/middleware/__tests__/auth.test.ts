import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '../auth';
import { AuthService, AuthTokenPayload } from '../../services/auth/AuthService';
import { UserRepository } from '../../database/repositories/UserRepository';
import { User } from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../services/auth/AuthService');
vi.mock('../../database/repositories/UserRepository');
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let mockAuthService: AuthService;
  let mockUserRepository: UserRepository;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const mockUser: User = {
    id: 'user-123',
    walletAddress: '0.0.123456',
    profile: {
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

  const mockTokenPayload: AuthTokenPayload = {
    userId: 'user-123',
    walletAddress: '0.0.123456',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(() => {
    mockAuthService = new AuthService({} as any, {} as any);
    mockUserRepository = new UserRepository({} as any);
    authMiddleware = new AuthMiddleware(mockAuthService, mockUserRepository);

    mockRequest = {
      headers: {},
      user: undefined,
      tokenPayload: undefined,
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };

    mockNext = vi.fn();

    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate user with valid token', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (mockAuthService.verifyToken as Mock).mockResolvedValue(mockTokenPayload);
      (mockUserRepository.findById as Mock).mockResolvedValue(mockUser);
      (mockUserRepository.updateLastActive as Mock).mockResolvedValue(undefined);
      (mockAuthService.refreshTokenIfNeeded as Mock).mockResolvedValue(null);

      const middleware = authMiddleware.authenticate();

      // Act
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockTokenPayload.userId);
      expect(mockUserRepository.updateLastActive).toHaveBeenCalledWith(mockUser.id);
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockRequest.tokenPayload).toEqual(mockTokenPayload);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 for missing token when required', async () => {
      // Arrange
      const middleware = authMiddleware.authenticate({ required: true });

      // Act
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token is required',
          category: 'authentication',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should continue without authentication when not required', async () => {
      // Arrange
      const middleware = authMiddleware.authenticate({ required: false });

      // Act
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token when required', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      (mockAuthService.verifyToken as Mock).mockRejectedValue(new Error('Invalid token'));

      const middleware = authMiddleware.authenticate({ required: true });

      // Act
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token',
          category: 'authentication',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user not found', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (mockAuthService.verifyToken as Mock).mockResolvedValue(mockTokenPayload);
      (mockUserRepository.findById as Mock).mockResolvedValue(null);

      const middleware = authMiddleware.authenticate({ required: true });

      // Act
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User associated with token not found',
          category: 'authentication',
        },
      });
    });

    it('should set refresh token header when token needs refresh', async () => {
      // Arrange
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (mockAuthService.verifyToken as Mock).mockResolvedValue(mockTokenPayload);
      (mockUserRepository.findById as Mock).mockResolvedValue(mockUser);
      (mockUserRepository.updateLastActive as Mock).mockResolvedValue(undefined);
      (mockAuthService.refreshTokenIfNeeded as Mock).mockResolvedValue('new-token');

      const middleware = authMiddleware.authenticate({ refreshToken: true });

      // Act
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-New-Token', 'new-token');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireVerificationLevel', () => {
    beforeEach(() => {
      mockRequest.user = mockUser;
    });

    it('should allow access for sufficient verification level', () => {
      // Arrange
      const middleware = authMiddleware.requireVerificationLevel('basic');

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for insufficient verification level', () => {
      // Arrange
      mockRequest.user = { ...mockUser, verification: { ...mockUser.verification, level: 'basic' } };
      const middleware = authMiddleware.requireVerificationLevel('premium');

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INSUFFICIENT_VERIFICATION',
          message: "Verification level 'premium' or higher required",
          category: 'authorization',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require authentication first', () => {
      // Arrange
      mockRequest.user = undefined;
      const middleware = authMiddleware.requireVerificationLevel('basic');

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

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

  describe('requireMinimumReputation', () => {
    beforeEach(() => {
      mockRequest.user = mockUser;
    });

    it('should allow access for sufficient reputation', () => {
      // Arrange
      const middleware = authMiddleware.requireMinimumReputation(100);

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for insufficient reputation', () => {
      // Arrange
      const middleware = authMiddleware.requireMinimumReputation(200);

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INSUFFICIENT_REPUTATION',
          message: 'Minimum reputation score of 200 required',
          category: 'authorization',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireOwnership', () => {
    beforeEach(() => {
      mockRequest.user = mockUser;
      mockRequest.params = { userId: 'user-123' };
    });

    it('should allow access to own resources', () => {
      // Arrange
      const middleware = authMiddleware.requireOwnership();

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access to other users resources', () => {
      // Arrange
      mockRequest.params = { userId: 'other-user-456' };
      const middleware = authMiddleware.requireOwnership();

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied: can only access own resources',
          category: 'authorization',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should work with custom parameter name', () => {
      // Arrange
      mockRequest.params = { customId: 'user-123' };
      const middleware = authMiddleware.requireOwnership('customId');

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
    });
  });
});