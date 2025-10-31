import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';

export interface QueuedMessage {
    id: string;
    event: string;
    data: any;
    timestamp: Date;
    retryCount: number;
    maxRetries: number;
    priority: MessagePriority;
    expiresAt?: Date;
}

export enum MessagePriority {
    LOW = 0,
    NORMAL = 1,
    HIGH = 2,
    CRITICAL = 3
}

export interface MessageQueueConfig {
    maxQueueSize: number;
    defaultMaxRetries: number;
    retryDelay: number;
    persistToStorage: boolean;
    storageKey: string;
    messageExpirationTime: number; // milliseconds
}

export interface QueueStats {
    totalMessages: number;
    pendingMessages: number;
    failedMessages: number;
    sentMessages: number;
    queueSize: number;
    oldestMessage?: Date;
}

/**
 * Message queue for storing outgoing messages when WebSocket is unavailable
 * Provides persistence, retry logic, and priority handling
 */
export class MessageQueue extends EventEmitter {
    private config: MessageQueueConfig;
    private queue: QueuedMessage[] = [];
    private sentMessages: Set<string> = new Set();
    private failedMessages: Set<string> = new Set();
    private isProcessing: boolean = false;
    private processingTimer: NodeJS.Timeout | null = null;

    constructor(config: Partial<MessageQueueConfig> = {}) {
        super();

        this.config = {
            maxQueueSize: config.maxQueueSize || 1000,
            defaultMaxRetries: config.defaultMaxRetries || 3,
            retryDelay: config.retryDelay || 5000,
            persistToStorage: config.persistToStorage ?? true,
            storageKey: config.storageKey || 'websocket_message_queue',
            messageExpirationTime: config.messageExpirationTime || 24 * 60 * 60 * 1000, // 24 hours
        };

        // Load persisted messages on initialization
        if (this.config.persistToStorage) {
            this.loadFromStorage();
        }

        // Clean up expired messages periodically
        this.startExpirationCleanup();

        logger.debug('MessageQueue initialized', {
            maxQueueSize: this.config.maxQueueSize,
            persistToStorage: this.config.persistToStorage,
            loadedMessages: this.queue.length
        });
    }

    /**
     * Queue a message for later transmission
     */
    queueMessage(
        event: string,
        data: any,
        options: {
            priority?: MessagePriority;
            maxRetries?: number;
            expiresIn?: number; // milliseconds from now
        } = {}
    ): string {
        const messageId = this.generateMessageId();
        const now = new Date();

        const message: QueuedMessage = {
            id: messageId,
            event,
            data,
            timestamp: now,
            retryCount: 0,
            maxRetries: options.maxRetries ?? this.config.defaultMaxRetries,
            priority: options.priority ?? MessagePriority.NORMAL,
            expiresAt: options.expiresIn ? new Date(now.getTime() + options.expiresIn) : undefined
        };

        // Check queue size limit
        if (this.queue.length >= this.config.maxQueueSize) {
            // Remove oldest low-priority message to make room
            const removedMessage = this.removeOldestLowPriorityMessage();
            if (removedMessage) {
                logger.warn('Queue full, removed oldest low-priority message', {
                    removedMessageId: removedMessage.id,
                    removedEvent: removedMessage.event
                });
            } else {
                logger.error('Queue full and no low-priority messages to remove', {
                    queueSize: this.queue.length,
                    maxSize: this.config.maxQueueSize
                });
                throw new Error('Message queue is full');
            }
        }

        // Insert message in priority order
        this.insertMessageByPriority(message);

        logger.debug('Message queued', {
            messageId,
            event,
            priority: options.priority,
            queueSize: this.queue.length
        });

        // Persist to storage if enabled
        if (this.config.persistToStorage) {
            this.saveToStorage();
        }

        this.emit('messageQueued', message);

        return messageId;
    }

    /**
     * Flush all queued messages by attempting to send them
     */
    async flushQueue(sendFunction: (event: string, data: any) => Promise<void>): Promise<void> {
        if (this.isProcessing) {
            logger.debug('Queue flush already in progress');
            return;
        }

        if (this.queue.length === 0) {
            logger.debug('No messages to flush');
            return;
        }

        logger.info('Starting queue flush', { messageCount: this.queue.length });

        this.isProcessing = true;
        this.emit('flushStarted', { messageCount: this.queue.length });

        const messagesToProcess = [...this.queue];
        let successCount = 0;
        let failureCount = 0;

        for (const message of messagesToProcess) {
            try {
                // Check if message has expired
                if (this.isMessageExpired(message)) {
                    this.removeMessage(message.id);
                    logger.debug('Skipped expired message', { messageId: message.id });
                    continue;
                }

                await sendFunction(message.event, message.data);

                // Message sent successfully
                this.markMessageAsSent(message.id);
                successCount++;

                logger.debug('Message sent successfully', {
                    messageId: message.id,
                    event: message.event
                });

            } catch (error) {
                // Message failed to send
                this.handleMessageFailure(message, error instanceof Error ? error : new Error('Unknown error'));
                failureCount++;

                logger.warn('Message failed to send', {
                    messageId: message.id,
                    event: message.event,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    retryCount: message.retryCount
                });
            }
        }

        this.isProcessing = false;

        // Persist changes to storage
        if (this.config.persistToStorage) {
            this.saveToStorage();
        }

        const flushResult = {
            totalProcessed: messagesToProcess.length,
            successCount,
            failureCount,
            remainingInQueue: this.queue.length
        };

        logger.info('Queue flush completed', flushResult);

        this.emit('flushCompleted', flushResult);
    }

    /**
     * Get queue statistics
     */
    getStats(): QueueStats {
        const oldestMessage = this.queue.length > 0
            ? this.queue.reduce((oldest, msg) => msg.timestamp < oldest.timestamp ? msg : oldest).timestamp
            : undefined;

        return {
            totalMessages: this.queue.length + this.sentMessages.size + this.failedMessages.size,
            pendingMessages: this.queue.length,
            failedMessages: this.failedMessages.size,
            sentMessages: this.sentMessages.size,
            queueSize: this.queue.length,
            oldestMessage
        };
    }

    /**
     * Clear all messages from the queue
     */
    clearQueue(): void {
        const clearedCount = this.queue.length;
        this.queue = [];
        this.sentMessages.clear();
        this.failedMessages.clear();

        if (this.config.persistToStorage) {
            this.saveToStorage();
        }

        logger.info('Queue cleared', { clearedCount });
        this.emit('queueCleared', { clearedCount });
    }

    /**
     * Remove a specific message from the queue
     */
    removeMessage(messageId: string): boolean {
        const index = this.queue.findIndex(msg => msg.id === messageId);
        if (index !== -1) {
            const removedMessage = this.queue.splice(index, 1)[0];

            if (this.config.persistToStorage) {
                this.saveToStorage();
            }

            logger.debug('Message removed from queue', { messageId });
            this.emit('messageRemoved', removedMessage);
            return true;
        }
        return false;
    }

    /**
     * Get all queued messages (for debugging/monitoring)
     */
    getQueuedMessages(): QueuedMessage[] {
        return [...this.queue];
    }

    /**
     * Check if queue is empty
     */
    isEmpty(): boolean {
        return this.queue.length === 0;
    }

    /**
     * Start automatic retry processing for failed messages
     */
    startRetryProcessing(sendFunction: (event: string, data: any) => Promise<void>): void {
        if (this.processingTimer) {
            return;
        }

        this.processingTimer = setInterval(async () => {
            const retryableMessages = this.queue.filter(msg =>
                msg.retryCount > 0 && msg.retryCount < msg.maxRetries && !this.isMessageExpired(msg)
            );

            if (retryableMessages.length > 0) {
                logger.debug('Processing retry messages', { count: retryableMessages.length });

                for (const message of retryableMessages) {
                    try {
                        await sendFunction(message.event, message.data);
                        this.markMessageAsSent(message.id);
                    } catch (error) {
                        this.handleMessageFailure(message, error instanceof Error ? error : new Error('Unknown error'));
                    }
                }

                if (this.config.persistToStorage) {
                    this.saveToStorage();
                }
            }
        }, this.config.retryDelay);

        logger.debug('Started retry processing');
    }

    /**
     * Stop automatic retry processing
     */
    stopRetryProcessing(): void {
        if (this.processingTimer) {
            clearInterval(this.processingTimer);
            this.processingTimer = null;
            logger.debug('Stopped retry processing');
        }
    }

    /**
     * Insert message into queue maintaining priority order
     */
    private insertMessageByPriority(message: QueuedMessage): void {
        let insertIndex = this.queue.length;

        // Find the correct position based on priority (higher priority first)
        for (let i = 0; i < this.queue.length; i++) {
            if (message.priority > this.queue[i].priority) {
                insertIndex = i;
                break;
            }
        }

        this.queue.splice(insertIndex, 0, message);
    }

    /**
     * Remove oldest low-priority message to make room
     */
    private removeOldestLowPriorityMessage(): QueuedMessage | null {
        // Find oldest message with LOW or NORMAL priority
        let oldestIndex = -1;
        let oldestTimestamp = new Date();

        for (let i = 0; i < this.queue.length; i++) {
            const message = this.queue[i];
            if ((message.priority === MessagePriority.LOW || message.priority === MessagePriority.NORMAL) &&
                message.timestamp < oldestTimestamp) {
                oldestIndex = i;
                oldestTimestamp = message.timestamp;
            }
        }

        if (oldestIndex !== -1) {
            return this.queue.splice(oldestIndex, 1)[0];
        }

        return null;
    }

    /**
     * Mark message as successfully sent
     */
    private markMessageAsSent(messageId: string): void {
        this.removeMessage(messageId);
        this.sentMessages.add(messageId);
        this.emit('messageSent', { messageId });
    }

    /**
     * Handle message sending failure
     */
    private handleMessageFailure(message: QueuedMessage, error: Error): void {
        message.retryCount++;

        if (message.retryCount >= message.maxRetries) {
            // Max retries exceeded, remove from queue and mark as failed
            this.removeMessage(message.id);
            this.failedMessages.add(message.id);

            logger.error('Message failed permanently', {
                messageId: message.id,
                event: message.event,
                retryCount: message.retryCount,
                maxRetries: message.maxRetries,
                error: error.message
            });

            this.emit('messageFailed', { message, error });
        } else {
            // Will retry later
            logger.debug('Message will be retried', {
                messageId: message.id,
                retryCount: message.retryCount,
                maxRetries: message.maxRetries
            });

            this.emit('messageRetry', { message, error });
        }
    }

    /**
     * Check if a message has expired
     */
    private isMessageExpired(message: QueuedMessage): boolean {
        if (!message.expiresAt) {
            // Check default expiration time
            const age = Date.now() - message.timestamp.getTime();
            return age > this.config.messageExpirationTime;
        }

        return new Date() > message.expiresAt;
    }

    /**
     * Generate unique message ID
     */
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Save queue to localStorage
     */
    private saveToStorage(): void {
        try {
            const data = {
                queue: this.queue,
                sentMessages: Array.from(this.sentMessages),
                failedMessages: Array.from(this.failedMessages),
                timestamp: new Date().toISOString()
            };

            localStorage.setItem(this.config.storageKey, JSON.stringify(data));
        } catch (error) {
            logger.error('Failed to save queue to storage', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Load queue from localStorage
     */
    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(this.config.storageKey);
            if (!stored) {
                return;
            }

            const data = JSON.parse(stored);

            // Restore queue with proper date objects
            this.queue = (data.queue || []).map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
                expiresAt: msg.expiresAt ? new Date(msg.expiresAt) : undefined
            }));

            this.sentMessages = new Set(data.sentMessages || []);
            this.failedMessages = new Set(data.failedMessages || []);

            // Clean up expired messages
            this.cleanupExpiredMessages();

            logger.debug('Queue loaded from storage', {
                queueSize: this.queue.length,
                sentCount: this.sentMessages.size,
                failedCount: this.failedMessages.size
            });

        } catch (error) {
            logger.error('Failed to load queue from storage', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Clean up expired messages
     */
    private cleanupExpiredMessages(): void {
        const initialCount = this.queue.length;
        this.queue = this.queue.filter(msg => !this.isMessageExpired(msg));

        const removedCount = initialCount - this.queue.length;
        if (removedCount > 0) {
            logger.debug('Cleaned up expired messages', { removedCount });

            if (this.config.persistToStorage) {
                this.saveToStorage();
            }
        }
    }

    /**
     * Start periodic cleanup of expired messages
     */
    private startExpirationCleanup(): void {
        // Clean up expired messages every 5 minutes
        setInterval(() => {
            this.cleanupExpiredMessages();
        }, 5 * 60 * 1000);
    }
}

// Export singleton instance
export const messageQueue = new MessageQueue();