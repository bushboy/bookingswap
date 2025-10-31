import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { SwapExpirationService } from '../SwapExpirationService';
import { SwapProposalService } from '../SwapProposalService';

// Mock dependencies
vi.mock('../SwapProposalService');
vi.mock('../../../utils/logger');

// Mock timers
vi.useFakeTimers();

describe('SwapExpirationService', () => {
  let swapExpirationService: SwapExpirationService;
  let mockSwapProposalService: vi.Mocked<SwapProposalService>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();

    mockSwapProposalService = vi.mocked(new SwapProposalService({} as any, {} as any, {} as any, {} as any));
    swapExpirationService = new SwapExpirationService(mockSwapProposalService, 1); // 1 minute interval for testing
  });

  afterEach(() => {
    swapExpirationService.stop();
  });

  describe('start', () => {
    it('should start the expiration service', () => {
      // Arrange
      mockSwapProposalService.handleExpiredProposals.mockResolvedValue();

      // Act
      swapExpirationService.start();

      // Assert
      expect(mockSwapProposalService.handleExpiredProposals).toHaveBeenCalledTimes(1);
    });

    it('should not start if already running', () => {
      // Arrange
      mockSwapProposalService.handleExpiredProposals.mockResolvedValue();
      swapExpirationService.start();
      const initialCallCount = mockSwapProposalService.handleExpiredProposals.mock.calls.length;

      // Act
      swapExpirationService.start(); // Try to start again

      // Assert - should not be called again
      expect(mockSwapProposalService.handleExpiredProposals).toHaveBeenCalledTimes(initialCallCount);
    });

    it('should handle errors during expiration check', () => {
      // Arrange
      mockSwapProposalService.handleExpiredProposals.mockRejectedValue(new Error('Database error'));

      // Act & Assert - should not throw error
      expect(() => swapExpirationService.start()).not.toThrow();
      expect(mockSwapProposalService.handleExpiredProposals).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('should stop the expiration service', () => {
      // Arrange
      mockSwapProposalService.handleExpiredProposals.mockResolvedValue();
      swapExpirationService.start();

      // Act
      swapExpirationService.stop();

      // Advance timer and check that it doesn't run
      vi.advanceTimersByTime(60000);

      // Assert - should only be called once from start, not again after stop
      expect(mockSwapProposalService.handleExpiredProposals).toHaveBeenCalledTimes(1);
    });

    it('should handle stop when not running', () => {
      // Act & Assert - should not throw error
      expect(() => swapExpirationService.stop()).not.toThrow();
    });
  });

  describe('forceCheck', () => {
    it('should force check for expired proposals', async () => {
      // Arrange
      mockSwapProposalService.handleExpiredProposals.mockResolvedValue();

      // Act
      await swapExpirationService.forceCheck();

      // Assert
      expect(mockSwapProposalService.handleExpiredProposals).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during force check', async () => {
      // Arrange
      mockSwapProposalService.handleExpiredProposals.mockRejectedValue(new Error('Database error'));

      // Act & Assert - should not throw error
      await expect(swapExpirationService.forceCheck()).resolves.toBeUndefined();
    });
  });

  describe('getStatus', () => {
    it('should return status when not running', () => {
      // Act
      const status = swapExpirationService.getStatus();

      // Assert
      expect(status).toEqual({
        isRunning: false,
        checkIntervalMs: 60000, // 1 minute in ms
        nextCheckIn: undefined,
      });
    });

    it('should return status when running', () => {
      // Arrange
      mockSwapProposalService.handleExpiredProposals.mockResolvedValue();
      swapExpirationService.start();

      // Act
      const status = swapExpirationService.getStatus();

      // Assert
      expect(status).toEqual({
        isRunning: true,
        checkIntervalMs: 60000,
        nextCheckIn: 60000,
      });
    });
  });

  describe('constructor', () => {
    it('should use default check interval', () => {
      // Arrange & Act
      const service = new SwapExpirationService(mockSwapProposalService);

      // Assert
      const status = service.getStatus();
      expect(status.checkIntervalMs).toBe(5 * 60 * 1000); // 5 minutes in ms
    });

    it('should use custom check interval', () => {
      // Arrange & Act
      const service = new SwapExpirationService(mockSwapProposalService, 10);

      // Assert
      const status = service.getStatus();
      expect(status.checkIntervalMs).toBe(10 * 60 * 1000); // 10 minutes in ms
    });
  });

  describe('periodic execution', () => {
    it('should create interval timer when started', () => {
      // Arrange
      mockSwapProposalService.handleExpiredProposals.mockResolvedValue();

      // Act
      swapExpirationService.start();

      // Assert
      const status = swapExpirationService.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.checkIntervalMs).toBe(60000);
    });

    it('should clear interval timer when stopped', () => {
      // Arrange
      mockSwapProposalService.handleExpiredProposals.mockResolvedValue();
      swapExpirationService.start();

      // Act
      swapExpirationService.stop();

      // Assert
      const status = swapExpirationService.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.nextCheckIn).toBeUndefined();
    });
  });
});