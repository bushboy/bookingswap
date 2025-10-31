/**
 * Tests for ProposalWebSocketService throttling integration
 * 
 * Tests the integration of connection throttling with the ProposalWebSocketService.
 * Focuses on core throttling functionality without testing the full WebSocket behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProposalWebSocketService } from '../proposalWebSocketService';
import { connectionStateChecker, connectionThrottlingManager } from '@/utils/connectionThrottling';

// Mock the realtimeService
vi.mock('../realtimeService', () => ({
    realtimeService: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn(() => false),
        on: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
    },
}));

// Mock the logger
vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('ProposalWebSocketService Throttling Integration', () => {
    let service: ProposalWebSocketService;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset connection state
        connectionStateChecker.resetConnectionState('proposalWebSocketService');
        connectionThrottlingManager.resetConnectionTracking('proposalWebSocketService');

        service = new ProposalWebSocketService();
    });

    afterEach(() => {
        service.disconnect();
    });

    describe('connection state checking', () => {
        it('should check connection state before attempting new connections', async () => {
            // Set service as already connected
            connectionStateChecker.setConnectionState('proposalWebSocketService', true);

            // Attempt to connect should be skipped
            await service.connect();

            // Verify that realtimeService.connect was not called
            const { realtimeService } = await import('../realtimeService');
            expect(realtimeService.connect).not.toHaveBeenCalled();
        });

        it('should update connection state on successful connection', async () => {
            const { realtimeService } = await import('../realtimeService');
            vi.mocked(realtimeService.connect).mockResolvedValue(undefined);
            vi.mocked(realtimeService.isConnected).mockReturnValue(true);

            await service.connect();

            expect(connectionStateChecker.isConnected('proposalWebSocketService')).toBe(true);
        });

        it('should update connection state on disconnection', () => {
            // Set as connected first
            connectionStateChecker.setConnectionState('proposalWebSocketService', true);
            expect(connectionStateChecker.isConnected('proposalWebSocketService')).toBe(true);

            service.disconnect();

            expect(connectionStateChecker.isConnected('proposalWebSocketService')).toBe(false);
        });
    });

    describe('connection throttling', () => {
        it('should use throttled connection method', async () => {
            const { realtimeService } = await import('../realtimeService');
            vi.mocked(realtimeService.connect).mockResolvedValue(undefined);

            // Spy on the throttling manager
            const debounceConnectionSpy = vi.spyOn(connectionThrottlingManager, 'debounceConnection');

            await service.connect();

            expect(debounceConnectionSpy).toHaveBeenCalledWith(
                'proposalWebSocketService',
                expect.any(Function),
                expect.any(Number)
            );
        });

        it('should prevent duplicate connection attempts when pending', async () => {
            const { realtimeService } = await import('../realtimeService');

            // Mock a slow connection
            vi.mocked(realtimeService.connect).mockImplementation(() =>
                new Promise(resolve => setTimeout(resolve, 100))
            );

            // Start first connection
            const firstConnection = service.connect();

            // Attempt second connection immediately
            const secondConnection = service.connect();

            await Promise.all([firstConnection, secondConnection]);

            // Should only call connect once due to throttling
            expect(realtimeService.connect).toHaveBeenCalledTimes(1);
        });
    });

    describe('throttling status', () => {
        it('should provide throttling status information', () => {
            const status = service.getThrottlingStatus();

            expect(status).toMatchObject({
                serviceId: 'proposalWebSocketService',
                throttlingEnabled: true,
                connectionStatus: expect.any(Object),
                config: expect.any(Object),
            });
        });

        it('should include throttling status in subscription status', () => {
            const status = service.getSubscriptionStatus();

            expect(status).toHaveProperty('connectionStatus');
            expect(status.connectionStatus).toMatchObject({
                isConnected: expect.any(Boolean),
                canConnect: expect.any(Boolean),
                throttlingStatus: expect.any(Object),
            });
        });
    });

    describe('throttling reset', () => {
        it('should reset throttling state', () => {
            // Set some connection state
            connectionStateChecker.setConnectionState('proposalWebSocketService', true);

            service.resetThrottling();

            expect(connectionStateChecker.isConnected('proposalWebSocketService')).toBe(false);
        });
    });
});