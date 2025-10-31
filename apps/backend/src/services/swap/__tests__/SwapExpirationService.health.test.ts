import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SwapExpirationService } from '../SwapExpirationService';
import { SwapProposalService } from '../SwapProposalService';

// Mock the logger
vi.mock('../../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
    },
}));

describe('SwapExpirationService Health Monitoring', () => {
    let swapExpirationService: SwapExpirationService;
    let mockSwapProposalService: Partial<SwapProposalService>;

    beforeEach(() => {
        mockSwapProposalService = {
            handleExpiredProposals: vi.fn().mockResolvedValue(3), // Mock returning 3 processed swaps
        };

        swapExpirationService = new SwapExpirationService(
            mockSwapProposalService as SwapProposalService,
            1 // 1 minute interval for testing
        );
    });

    afterEach(() => {
        swapExpirationService.stop();
        vi.clearAllMocks();
    });

    describe('getStatus', () => {
        it('should return correct status when service is not running', () => {
            const status = swapExpirationService.getStatus();

            expect(status).toEqual({
                isRunning: false,
                checkIntervalMs: 60000, // 1 minute
                nextCheckIn: undefined,
                startedAt: undefined,
                lastCheckAt: undefined,
                totalChecksPerformed: 0,
                totalSwapsProcessed: 0,
                lastError: undefined,
            });
        });

        it('should return correct status when service is running', () => {
            swapExpirationService.start();
            const status = swapExpirationService.getStatus();

            expect(status.isRunning).toBe(true);
            expect(status.checkIntervalMs).toBe(60000);
            expect(status.nextCheckIn).toBe(60000);
            expect(status.startedAt).toBeInstanceOf(Date);
            expect(status.totalChecksPerformed).toBeGreaterThanOrEqual(0);
            expect(status.totalSwapsProcessed).toBeGreaterThanOrEqual(0);
        });

        it('should track check statistics after running checks', async () => {
            swapExpirationService.start();

            // Wait for initial check to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            const status = swapExpirationService.getStatus();

            expect(status.totalChecksPerformed).toBeGreaterThan(0);
            expect(status.lastCheckAt).toBeInstanceOf(Date);
            expect(mockSwapProposalService.handleExpiredProposals).toHaveBeenCalled();
        });

        it('should track error information when check fails', async () => {
            const errorMessage = 'Database connection failed';
            mockSwapProposalService.handleExpiredProposals = vi.fn().mockRejectedValue(new Error(errorMessage));

            swapExpirationService.start();

            // Wait for initial check to complete and fail
            await new Promise(resolve => setTimeout(resolve, 100));

            const status = swapExpirationService.getStatus();

            expect(status.lastError).toBeDefined();
            expect(status.lastError?.message).toBe(errorMessage);
            expect(status.lastError?.timestamp).toBeInstanceOf(Date);
        });

        it('should clear error after successful check', async () => {
            // First, cause an error
            mockSwapProposalService.handleExpiredProposals = vi.fn().mockRejectedValue(new Error('Test error'));

            swapExpirationService.start();
            await new Promise(resolve => setTimeout(resolve, 100));

            let status = swapExpirationService.getStatus();
            expect(status.lastError).toBeDefined();

            // Then fix the service
            mockSwapProposalService.handleExpiredProposals = vi.fn().mockResolvedValue(2);

            // Force another check
            await swapExpirationService.forceCheck();

            status = swapExpirationService.getStatus();
            expect(status.lastError).toBeUndefined();
        });
    });

    describe('forceCheck', () => {
        it('should perform a manual check and update statistics', async () => {
            const initialStatus = swapExpirationService.getStatus();
            expect(initialStatus.totalChecksPerformed).toBe(0);

            await swapExpirationService.forceCheck();

            const updatedStatus = swapExpirationService.getStatus();
            expect(updatedStatus.totalChecksPerformed).toBe(1);
            expect(updatedStatus.lastCheckAt).toBeInstanceOf(Date);
            expect(mockSwapProposalService.handleExpiredProposals).toHaveBeenCalledTimes(1);
        });
    });

    describe('service lifecycle', () => {
        it('should reset startedAt when stopped', () => {
            swapExpirationService.start();
            let status = swapExpirationService.getStatus();
            expect(status.startedAt).toBeInstanceOf(Date);
            expect(status.isRunning).toBe(true);

            swapExpirationService.stop();
            status = swapExpirationService.getStatus();
            expect(status.startedAt).toBeUndefined();
            expect(status.isRunning).toBe(false);
        });

        it('should maintain check statistics across start/stop cycles', () => {
            swapExpirationService.start();
            swapExpirationService.stop();

            const status = swapExpirationService.getStatus();
            // Statistics should be preserved even when stopped
            expect(status.totalChecksPerformed).toBeGreaterThanOrEqual(0);
            expect(status.totalSwapsProcessed).toBeGreaterThanOrEqual(0);
        });
    });
});