import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealtimeService } from '../realtimeService';

// Mock Socket.IO
vi.mock('socket.io-client', () => ({
    io: vi.fn(() => ({
        connected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
    })),
    Socket: vi.fn(),
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Message Queue Integration', () => {
    let realtimeService: RealtimeService;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create a new instance for each test
        realtimeService = new RealtimeService({
            url: 'http://localhost:3001',
            reconnectInterval: 1000,
            maxReconnectAttempts: 3,
            heartbeatInterval: 30000,
            connectionTimeout: 10000,
        });

        // Clear the message queue to start fresh for each test
        realtimeService.clearMessageQueue();
    });

    it('should queue messages when not connected', () => {
        // Verify service is not connected
        expect(realtimeService.isConnected()).toBe(false);

        // Queue a message
        const messageId = realtimeService.queueMessage('test_event', { data: 'test' }, 'normal');

        // Verify message was queued
        expect(messageId).toBeDefined();
        expect(typeof messageId).toBe('string');

        // Check queue stats
        const stats = realtimeService.getMessageQueueStats();
        expect(stats.queueSize).toBe(1);
        expect(stats.pendingMessages).toBe(1);
    });

    it('should queue messages with different priorities', () => {
        // Queue messages with different priorities
        const lowPriorityId = realtimeService.queueMessage('low_event', { data: 'low' }, 'low');
        const normalPriorityId = realtimeService.queueMessage('normal_event', { data: 'normal' }, 'normal');
        const highPriorityId = realtimeService.queueMessage('high_event', { data: 'high' }, 'high');
        const criticalPriorityId = realtimeService.queueMessage('critical_event', { data: 'critical' }, 'critical');

        // Verify all messages were queued
        expect(lowPriorityId).toBeDefined();
        expect(normalPriorityId).toBeDefined();
        expect(highPriorityId).toBeDefined();
        expect(criticalPriorityId).toBeDefined();

        // Check queue stats
        const stats = realtimeService.getMessageQueueStats();
        expect(stats.queueSize).toBe(4);
        expect(stats.pendingMessages).toBe(4);
    });

    it('should provide queue statistics', () => {
        // Initially empty queue
        let stats = realtimeService.getMessageQueueStats();
        expect(stats.queueSize).toBe(0);
        expect(stats.pendingMessages).toBe(0);
        expect(stats.failedMessages).toBe(0);
        expect(stats.sentMessages).toBe(0);

        // Queue some messages
        realtimeService.queueMessage('event1', { data: 'test1' });
        realtimeService.queueMessage('event2', { data: 'test2' });

        // Check updated stats
        stats = realtimeService.getMessageQueueStats();
        expect(stats.queueSize).toBe(2);
        expect(stats.pendingMessages).toBe(2);
        expect(stats.totalMessages).toBe(2);
    });

    it('should clear message queue', () => {
        // Queue some messages
        realtimeService.queueMessage('event1', { data: 'test1' });
        realtimeService.queueMessage('event2', { data: 'test2' });

        // Verify messages are queued
        let stats = realtimeService.getMessageQueueStats();
        expect(stats.queueSize).toBe(2);

        // Clear the queue
        realtimeService.clearMessageQueue();

        // Verify queue is empty
        stats = realtimeService.getMessageQueueStats();
        expect(stats.queueSize).toBe(0);
        expect(stats.pendingMessages).toBe(0);
    });

    it('should include message queue stats in metrics', () => {
        // Queue some messages
        realtimeService.queueMessage('event1', { data: 'test1' });
        realtimeService.queueMessage('event2', { data: 'test2' });

        // Get metrics
        const metrics = realtimeService.getMetrics();

        // Verify message queue is included in metrics
        expect(metrics.messageQueue).toBeDefined();
        expect(metrics.messageQueue.queueSize).toBe(2);
        expect(metrics.messageQueue.pendingMessages).toBe(2);
    });

    it('should include message queue stats in health check', () => {
        // Queue some messages
        realtimeService.queueMessage('event1', { data: 'test1' });
        realtimeService.queueMessage('event2', { data: 'test2' });

        // Get health check
        const healthCheck = realtimeService.getHealthCheck();

        // Verify message queue is included in health check
        expect(healthCheck.messageQueue).toBeDefined();
        expect(healthCheck.messageQueue.queueSize).toBe(2);
        expect(healthCheck.messageQueue.pendingMessages).toBe(2);
        expect(healthCheck.messageQueue.failedMessages).toBe(0);
    });

    it('should mark status as degraded when queue size is large', () => {
        // Queue many messages to trigger degraded status
        for (let i = 0; i < 150; i++) {
            realtimeService.queueMessage(`event${i}`, { data: `test${i}` });
        }

        // Get health check
        const healthCheck = realtimeService.getHealthCheck();

        // Should be degraded due to large queue size
        expect(healthCheck.status).toBe('degraded');
        expect(healthCheck.messageQueue.queueSize).toBe(150);
    });
});