import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Request, Response } from 'express';
import { AuthController } from '../AuthController';
import { AuthService, LoginResult } from '../../services/auth/AuthService';
import { User } from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../services/auth/AuthService');
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: AuthService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  const mockUser: User = {
    id: 'user-123',
    walletAddress: '0.0.123456',
    profile: {
      preferences: { notifications: true },
    },
    verification: {
      level: 'basic',
      documents: [],
    },
    reputation: {
      score: 100,
      completedSwaps: 0,
      cancelledSwaps: 0,
      reviews: [],
    },
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLoginResult: LoginResult = {
    user: mockUser,
    token: 'jwt-token',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  beforeEach(() => {
    mockAuthService = new AuthService({} as any, {} as any);
    authController = new AuthController(mockAuthService);

    mockRequest = {
      body: {},
      user: undefined,
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    vi.clearAllMocks();
  });

  describe('generateChallenge', () => {
    it('should generate challenge message for valid wallet address', async () => {
      // Arrange
      mockRequest.body = { walletAddress: '0.0.123456' };
      (mockAuthService.generateChallengeMessage as Mock).mockReturnValue('Challenge message');

      // Act
      await authController.generateChallenge(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAuthService.generateChallengeMessage).toHaveBeenCalledWith('0.0.123456');
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Challenge message',
        walletAddress: '0.0.123456',
      });
    });

    it('should return validation error for missing wallet address', async () => {
      // Arrange
      mockRequest.body = {};

      // Act
      await authController.generateChallenge(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('walletAddress'),
          category: 'validation',
        },
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      mockRequest.body = { walletAddress: '0.0.123456' };
      (mockAuthService.generateChallengeMessage as Mock).mockImplementation(() => {
        throw new Error('Service error');
      });

      // Act
      await authController.generateChallenge(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'CHALLENGE_GENERATION_FAILED',
          message: 'Failed to generate challenge message',
          category: 'authentication',
        },
      });
    });
  });

  describe('login', () => {
    const validSignatureData = {
      message: 'Challenge message',
      signature: 'signature',
      publicKey: 'public-key',
      walletAddress: '0.0.123456',
    };

    it('should login user with valid signature data', async () => {
      // Arrange
      mockRequest.body = validSignatureData;
      (mockAuthService.authenticateWithWallet as Mock).mockResolvedValue(mockLoginResult);

      // Act
      await authController.login(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAuthService.authenticateWithWallet).toHaveBeenCalledWith(validSignatureData);
      expect(mockResponse.json).toHaveBeenCalledWith({
        user: expect.objectContaining({
          id: mockUser.id,
          walletAddress: mockUser.walletAddress,
        }),
        token: mockLoginResult.token,
        expiresAt: mockLoginResult.expiresAt,
      });
    });

    it('should return validation error for invalid signature data', async () => {
      // Arrange
      mockRequest.body = { message: 'incomplete data' };

      // Act
      await authController.login(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.any(String),
          category: 'validation',
        },
      });
    });

    it('should return 401 for authentication failure', async () => {
      // Arrange
      mockRequest.body = validSignatureData;
      (mockAuthService.authenticateWithWallet as Mock).mockRejectedValue(
        new Error('Authentication failed')
      );

      // Act
      await authController.login(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Invalid wallet signature or authentication failed',
          category: 'authentication',
        },
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      mockRequest.body = validSignatureData;
      (mockAuthService.authenticateWithWallet as Mock).mockRejectedValue(
        new Error('Service error')
      );

      // Act
      await authController.login(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'LOGIN_ERROR',
          message: 'Login process failed',
          category: 'authentication',
        },
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token for authenticated user', async () => {
      // Arrange
      mockRequest.user = mockUser;
      (mockAuthService.generateToken as Mock).mockReturnValue('new-token');

      // Act
      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAuthService.generateToken).toHaveBeenCalledWith(mockUser);
      expect(mockResponse.json).toHaveBeenCalledWith({
        token: 'new-token',
        expiresAt: expect.any(Date),
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

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

    it('should handle service errors', async () => {
      // Arrange
      mockRequest.user = mockUser;
      (mockAuthService.generateToken as Mock).mockImplementation(() => {
        throw new Error('Service error');
      });

      // Act
      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: 'Failed to refresh authentication token',
          category: 'authentication',
        },
      });
    });
  });

  describe('validateToken', () => {
    it('should validate token and return user info', async () => {
      // Arrange
      mockRequest.user = mockUser;
      mockRequest.tokenPayload = {
        userId: mockUser.id,
        walletAddress: mockUser.walletAddress,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      // Act
      await authController.validateToken(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        user: expect.objectContaining({
          id: mockUser.id,
          walletAddress: mockUser.walletAddress,
        }),
        tokenPayload: mockRequest.tokenPayload,
      });
    });

    it('should return 401 for invalid token', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await authController.validateToken(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
          category: 'authentication',
        },
      });
    });
  });
});