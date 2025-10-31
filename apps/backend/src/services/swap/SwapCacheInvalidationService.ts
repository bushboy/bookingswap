import { SwapMatchingCacheService } from './SwapMatchingCacheService';
import { getCacheInvalidationConfig, CacheInvalidationConfig } from './cache-config';
import { logger } from '../../utils/logger';

export interface CacheInvalidationEvent {
  type: 'swap_updated' | 'user_updated' | 'proposal_created' | 'booking_updated';
  entityId: string;
  relatedIds?: string[];
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class SwapCacheInvalidationService {
  private cacheService: SwapMatchingCacheService;
  private config: CacheInvalidationConfig;
  private pendingInvalidations: Map<string, CacheInvalidationEvent[]> = new Map();
  private batchTimer?: NodeJS.Timeout;

  constructor(cacheService: SwapMatchingCacheService) {
    this.cacheService = cacheService;
    this.config = getCacheInvalidationConfig();
  }

  /**
   * Handle cache invalidation for swap updates
   */
  async handleSwapUpdate(swapId: string, userId: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.config.invalidateOnSwapUpdate) {
      return;
    }

    const event: CacheInvalidationEvent = {
      type: 'swap_updated',
      entityId: swapId,
      relatedIds: [userId],
      timestamp: new Date(),
      metadata
    };

    await this.processInvalidationEvent(event);
  }

  /**
   * Handle cache invalidation for user updates
   */
  async handleUserUpdate(userId: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.config.invalidateOnUserUpdate) {
      return;
    }

    const event: CacheInvalidationEvent = {
      type: 'user_updated',
      entityId: userId,
      timestamp: new Date(),
      metadata
    };

    await this.processInvalidationEvent(event);
  }

  /**
   * Handle cache invalidation for proposal creation
   */
  async handleProposalCreate(
    proposalId: string, 
    sourceSwapId: string, 
    targetSwapId: string, 
    proposerId: string,
    targetOwnerId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.config.invalidateOnProposalCreate) {
      return;
    }

    const event: CacheInvalidationEvent = {
      type: 'proposal_created',
      entityId: proposalId,
      relatedIds: [sourceSwapId, targetSwapId, proposerId, targetOwnerId],
      timestamp: new Date(),
      metadata
    };

    await this.processInvalidationEvent(event);
  }

  /**
   * Handle cache invalidation for booking updates
   */
  async handleBookingUpdate(bookingId: string, userId: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.config.invalidateOnBookingUpdate) {
      return;
    }

    const event: CacheInvalidationEvent = {
      type: 'booking_updated',
      entityId: bookingId,
      relatedIds: [userId],
      timestamp: new Date(),
      metadata
    };

    await this.processInvalidationEvent(event);
  }

  /**
   * Process invalidation event (with optional batching)
   */
  private async processInvalidationEvent(event: CacheInvalidationEvent): Promise<void> {
    try {
      if (this.config.batchInvalidationDelay > 0) {
        // Add to batch for delayed processing
        await this.addToBatch(event);
      } else {
        // Process immediately
        await this.executeInvalidation(event);
      }
    } catch (error) {
      logger.error('Failed to process cache invalidation event', { error, event });
    }
  }

  /**
   * Add event to batch for delayed processing
   */
  private async addToBatch(event: CacheInvalidationEvent): Promise<void> {
    const batchKey = `${event.type}:${event.entityId}`;
    
    if (!this.pendingInvalidations.has(batchKey)) {
      this.pendingInvalidations.set(batchKey, []);
    }
    
    this.pendingInvalidations.get(batchKey)!.push(event);

    // Set or reset the batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(async () => {
      await this.processBatch();
    }, this.config.batchInvalidationDelay);
  }

  /**
   * Process all pending invalidations in batch
   */
  private async processBatch(): Promise<void> {
    try {
      const allEvents = Array.from(this.pendingInvalidations.values()).flat();
      
      if (allEvents.length === 0) {
        return;
      }

      logger.info('Processing batch cache invalidation', { eventCount: allEvents.length });

      // Group events by type for efficient processing
      const eventsByType = allEvents.reduce((acc, event) => {
        if (!acc[event.type]) {
          acc[event.type] = [];
        }
        acc[event.type].push(event);
        return acc;
      }, {} as Record<string, CacheInvalidationEvent[]>);

      // Process each type of event
      await Promise.allSettled([
        this.processBatchSwapUpdates(eventsByType.swap_updated || []),
        this.processBatchUserUpdates(eventsByType.user_updated || []),
        this.processBatchProposalCreates(eventsByType.proposal_created || []),
        this.processBatchBookingUpdates(eventsByType.booking_updated || [])
      ]);

      // Clear pending invalidations
      this.pendingInvalidations.clear();
      this.batchTimer = undefined;

      logger.info('Batch cache invalidation completed');
    } catch (error) {
      logger.error('Batch cache invalidation failed', { error });
    }
  }

  /**
   * Execute individual invalidation event
   */
  private async executeInvalidation(event: CacheInvalidationEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'swap_updated':
          await this.invalidateForSwapUpdate(event);
          break;
        case 'user_updated':
          await this.invalidateForUserUpdate(event);
          break;
        case 'proposal_created':
          await this.invalidateForProposalCreate(event);
          break;
        case 'booking_updated':
          await this.invalidateForBookingUpdate(event);
          break;
        default:
          logger.warn('Unknown invalidation event type', { event });
      }
    } catch (error) {
      logger.error('Failed to execute cache invalidation', { error, event });
    }
  }

  /**
   * Invalidate cache for swap update
   */
  private async invalidateForSwapUpdate(event: CacheInvalidationEvent): Promise<void> {
    const swapId = event.entityId;
    const userId = event.relatedIds?.[0];

    // Invalidate swap-specific cache
    await this.cacheService.invalidateSwapCache(swapId);

    // Invalidate user cache if user ID is available
    if (userId) {
      await this.cacheService.invalidateUserCache(userId);
    }

    logger.debug('Invalidated cache for swap update', { swapId, userId });
  }

  /**
   * Invalidate cache for user update
   */
  private async invalidateForUserUpdate(event: CacheInvalidationEvent): Promise<void> {
    const userId = event.entityId;

    // Invalidate all user-related cache
    await this.cacheService.invalidateUserCache(userId);

    logger.debug('Invalidated cache for user update', { userId });
  }

  /**
   * Invalidate cache for proposal creation
   */
  private async invalidateForProposalCreate(event: CacheInvalidationEvent): Promise<void> {
    const [sourceSwapId, targetSwapId, proposerId, targetOwnerId] = event.relatedIds || [];

    // Invalidate cache for both swaps involved
    if (sourceSwapId) {
      await this.cacheService.invalidateSwapCache(sourceSwapId);
    }
    if (targetSwapId) {
      await this.cacheService.invalidateSwapCache(targetSwapId);
    }

    // Invalidate cache for both users involved
    if (proposerId) {
      await this.cacheService.invalidateUserCache(proposerId);
    }
    if (targetOwnerId && targetOwnerId !== proposerId) {
      await this.cacheService.invalidateUserCache(targetOwnerId);
    }

    // Invalidate compatibility cache for the specific pair
    if (sourceSwapId && targetSwapId) {
      await this.cacheService.invalidateCompatibilityCache(sourceSwapId, targetSwapId);
    }

    logger.debug('Invalidated cache for proposal creation', { 
      sourceSwapId, 
      targetSwapId, 
      proposerId, 
      targetOwnerId 
    });
  }

  /**
   * Invalidate cache for booking update
   */
  private async invalidateForBookingUpdate(event: CacheInvalidationEvent): Promise<void> {
    const bookingId = event.entityId;
    const userId = event.relatedIds?.[0];

    // Invalidate user cache (which includes their swaps)
    if (userId) {
      await this.cacheService.invalidateUserCache(userId);
    }

    // Note: We might need to find swaps associated with this booking
    // and invalidate their cache as well, but that would require additional queries

    logger.debug('Invalidated cache for booking update', { bookingId, userId });
  }

  /**
   * Process batch swap updates
   */
  private async processBatchSwapUpdates(events: CacheInvalidationEvent[]): Promise<void> {
    if (events.length === 0) return;

    const swapIds = events.map(e => e.entityId);
    const userIds = events.map(e => e.relatedIds?.[0]).filter(Boolean) as string[];

    // Batch invalidate swap caches
    await Promise.allSettled(
      swapIds.map(swapId => this.cacheService.invalidateSwapCache(swapId))
    );

    // Batch invalidate user caches
    const uniqueUserIds = [...new Set(userIds)];
    await Promise.allSettled(
      uniqueUserIds.map(userId => this.cacheService.invalidateUserCache(userId))
    );

    logger.debug('Processed batch swap updates', { 
      swapCount: swapIds.length, 
      userCount: uniqueUserIds.length 
    });
  }

  /**
   * Process batch user updates
   */
  private async processBatchUserUpdates(events: CacheInvalidationEvent[]): Promise<void> {
    if (events.length === 0) return;

    const userIds = [...new Set(events.map(e => e.entityId))];

    await Promise.allSettled(
      userIds.map(userId => this.cacheService.invalidateUserCache(userId))
    );

    logger.debug('Processed batch user updates', { userCount: userIds.length });
  }

  /**
   * Process batch proposal creates
   */
  private async processBatchProposalCreates(events: CacheInvalidationEvent[]): Promise<void> {
    if (events.length === 0) return;

    const swapIds = new Set<string>();
    const userIds = new Set<string>();
    const compatibilityPairs: Array<{ sourceSwapId: string; targetSwapId: string }> = [];

    events.forEach(event => {
      const [sourceSwapId, targetSwapId, proposerId, targetOwnerId] = event.relatedIds || [];
      
      if (sourceSwapId) swapIds.add(sourceSwapId);
      if (targetSwapId) swapIds.add(targetSwapId);
      if (proposerId) userIds.add(proposerId);
      if (targetOwnerId) userIds.add(targetOwnerId);
      
      if (sourceSwapId && targetSwapId) {
        compatibilityPairs.push({ sourceSwapId, targetSwapId });
      }
    });

    // Batch invalidate all affected caches
    await Promise.allSettled([
      ...Array.from(swapIds).map(swapId => this.cacheService.invalidateSwapCache(swapId)),
      ...Array.from(userIds).map(userId => this.cacheService.invalidateUserCache(userId)),
      ...compatibilityPairs.map(({ sourceSwapId, targetSwapId }) => 
        this.cacheService.invalidateCompatibilityCache(sourceSwapId, targetSwapId)
      )
    ]);

    logger.debug('Processed batch proposal creates', { 
      swapCount: swapIds.size, 
      userCount: userIds.size,
      compatibilityPairCount: compatibilityPairs.length
    });
  }

  /**
   * Process batch booking updates
   */
  private async processBatchBookingUpdates(events: CacheInvalidationEvent[]): Promise<void> {
    if (events.length === 0) return;

    const userIds = events.map(e => e.relatedIds?.[0]).filter(Boolean) as string[];
    const uniqueUserIds = [...new Set(userIds)];

    await Promise.allSettled(
      uniqueUserIds.map(userId => this.cacheService.invalidateUserCache(userId))
    );

    logger.debug('Processed batch booking updates', { userCount: uniqueUserIds.length });
  }

  /**
   * Force process any pending invalidations
   */
  async flushPendingInvalidations(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    if (this.pendingInvalidations.size > 0) {
      await this.processBatch();
    }
  }

  /**
   * Get statistics about cache invalidation
   */
  getInvalidationStats(): {
    pendingEvents: number;
    batchingEnabled: boolean;
    config: CacheInvalidationConfig;
  } {
    return {
      pendingEvents: Array.from(this.pendingInvalidations.values()).flat().length,
      batchingEnabled: this.config.batchInvalidationDelay > 0,
      config: this.config
    };
  }
}