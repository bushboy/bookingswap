import { Booking, BookingType } from '@booking-swap/shared';
import { BookingRepository, BookingSearchCriteria } from '../../database/repositories/BookingRepository';
import { RedisService } from '../../database/cache/RedisService';
import { CacheManager } from '../../database/cache/CacheManager';
import { QueryOptimizer } from '../../database/optimizations/QueryOptimizer';
import { logger } from '../../utils/logger';

export interface SearchFilters {
  query?: string;
  location?: {
    city?: string;
    country?: string;
    radius?: number; // in km
    coordinates?: [number, number];
  };
  dateRange?: {
    checkIn?: Date;
    checkOut?: Date;
    flexible?: boolean;
  };
  priceRange?: {
    min?: number;
    max?: number;
  };
  types?: BookingType[];
  sortBy?: 'price' | 'date' | 'relevance' | 'created';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  bookings: Booking[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RecommendationCriteria {
  userId: string;
  userLocation?: {
    city: string;
    country: string;
    coordinates?: [number, number];
  };
  preferredTypes?: BookingType[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  excludeBookingIds?: string[];
}

export class BookingSearchService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly SEARCH_CACHE_PREFIX = 'search:';
  private readonly RECOMMENDATION_CACHE_PREFIX = 'recommendations:';

  constructor(
    private bookingRepository: BookingRepository,
    private cacheService: RedisService,
    private cacheManager?: CacheManager,
    private queryOptimizer?: QueryOptimizer
  ) {}

  /**
   * Search bookings with advanced filtering and caching
   */
  async searchBookings(
    filters: SearchFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Searching bookings', { filters, page, limit });

      // Generate cache key
      const cacheKey = this.generateSearchCacheKey(filters, page, limit);
      
      // Try to get from cache first using enhanced cache manager
      if (this.cacheManager) {
        const cachedResult = await this.cacheManager.get<SearchResult>(cacheKey);
        if (cachedResult) {
          logger.info('Returning cached search result', { cacheKey, duration: Date.now() - startTime });
          return cachedResult;
        }
      } else {
        const cachedResult = await this.getCachedSearchResult(cacheKey);
        if (cachedResult) {
          logger.info('Returning cached search result', { cacheKey, duration: Date.now() - startTime });
          return cachedResult;
        }
      }

      // Use optimized query if available
      let bookings: Booking[];
      let total: number;

      if (this.queryOptimizer) {
        // Use optimized query builder
        const searchCriteria = this.convertFiltersToSearchCriteria(filters);
        const offset = (page - 1) * limit;
        
        const { query, params } = this.queryOptimizer.buildOptimizedBookingSearchQuery({
          ...searchCriteria,
          limit: limit + 1,
          offset,
        });

        const rawResults = await this.queryOptimizer.executeOptimizedQuery(
          query, 
          [...params, limit + 1, offset], 
          'booking_search'
        );

        // Map raw results to Booking objects
        bookings = rawResults.map(row => this.bookingRepository.mapRowToEntity(row));
        
        // Get total count with optimized query
        total = await this.getOptimizedSearchResultCount(searchCriteria);
      } else {
        // Fallback to original implementation
        const searchCriteria = this.convertFiltersToSearchCriteria(filters);
        const offset = (page - 1) * limit;

        bookings = await this.bookingRepository.searchBookings(searchCriteria, limit + 1, offset);
        total = await this.getSearchResultCount(searchCriteria);
      }
      
      // Check if there are more results
      const hasMore = bookings.length > limit;
      const resultBookings = hasMore ? bookings.slice(0, limit) : bookings;

      // Apply sorting if specified
      const sortedBookings = this.applySorting(resultBookings, filters.sortBy, filters.sortOrder);

      const result: SearchResult = {
        bookings: sortedBookings,
        total,
        page,
        limit,
        hasMore,
      };

      // Cache the result with enhanced cache manager
      if (this.cacheManager) {
        await this.cacheManager.set(cacheKey, result, 'search');
      } else {
        await this.cacheSearchResult(cacheKey, result);
      }

      const duration = Date.now() - startTime;
      logger.info('Search completed', {
        resultsCount: result.bookings.length,
        total: result.total,
        hasMore: result.hasMore,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Search failed', { error, filters, duration });
      throw error;
    }
  }

  /**
   * Get booking recommendations for a user
   */
  async getRecommendations(
    criteria: RecommendationCriteria,
    limit: number = 10
  ): Promise<Booking[]> {
    try {
      logger.info('Getting booking recommendations', { userId: criteria.userId, limit });

      // Generate cache key
      const cacheKey = `${this.RECOMMENDATION_CACHE_PREFIX}${criteria.userId}:${JSON.stringify(criteria)}`;
      
      // Try to get from cache
      const cachedRecommendations = await this.cacheService.get<Booking[]>(cacheKey);
      if (cachedRecommendations) {
        logger.info('Returning cached recommendations', { userId: criteria.userId });
        return cachedRecommendations;
      }

      // Build recommendation filters
      const filters: SearchFilters = {
        types: criteria.preferredTypes,
        priceRange: criteria.priceRange,
        location: criteria.userLocation,
        sortBy: 'relevance',
      };

      // Get initial recommendations
      let recommendations = await this.searchBookings(filters, 1, limit * 2);
      let bookings = recommendations.bookings;

      // Filter out user's own bookings and excluded bookings
      bookings = bookings.filter(booking => {
        if (booking.userId === criteria.userId) return false;
        if (criteria.excludeBookingIds?.includes(booking.id)) return false;
        return true;
      });

      // Apply recommendation scoring
      bookings = this.applyRecommendationScoring(bookings, criteria);

      // Limit results
      const finalRecommendations = bookings.slice(0, limit);

      // Cache recommendations
      await this.cacheService.set(
        cacheKey,
        JSON.stringify(finalRecommendations),
        this.CACHE_TTL
      );

      logger.info('Recommendations generated', {
        userId: criteria.userId,
        count: finalRecommendations.length,
      });

      return finalRecommendations;
    } catch (error) {
      logger.error('Failed to get recommendations', { error, criteria });
      throw error;
    }
  }

  /**
   * Get popular bookings based on search frequency and user activity
   */
  async getPopularBookings(limit: number = 10): Promise<Booking[]> {
    try {
      const cacheKey = `popular:bookings:${limit}`;
      
      // Try cache first
      const cached = await this.cacheService.get<Booking[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get recent bookings with high activity
      const filters: SearchFilters = {
        sortBy: 'created',
        sortOrder: 'desc',
      };

      const result = await this.searchBookings(filters, 1, limit * 2);
      
      // Apply popularity scoring (simplified - in real implementation, this would use analytics data)
      const popularBookings = result.bookings
        .filter(booking => booking.status === 'available')
        .slice(0, limit);

      // Cache for longer period
      await this.cacheService.set(cacheKey, JSON.stringify(popularBookings), 900); // 15 minutes

      return popularBookings;
    } catch (error) {
      logger.error('Failed to get popular bookings', { error });
      throw error;
    }
  }

  /**
   * Convert search filters to repository search criteria
   */
  private convertFiltersToSearchCriteria(filters: SearchFilters): BookingSearchCriteria {
    return {
      query: filters.query,
      location: filters.location,
      dateRange: filters.dateRange,
      priceRange: filters.priceRange,
      types: filters.types,
    };
  }

  /**
   * Apply sorting to search results
   */
  private applySorting(
    bookings: Booking[],
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Booking[] {
    if (!sortBy) return bookings;

    return bookings.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'price':
          comparison = a.swapValue - b.swapValue;
          break;
        case 'date':
          comparison = a.dateRange.checkIn.getTime() - b.dateRange.checkIn.getTime();
          break;
        case 'created':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'relevance':
        default:
          // For relevance, we could implement a scoring algorithm
          // For now, just sort by creation date
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Apply recommendation scoring based on user preferences and booking attributes
   */
  private applyRecommendationScoring(
    bookings: Booking[],
    criteria: RecommendationCriteria
  ): Booking[] {
    return bookings.map(booking => {
      let score = 0;

      // Type preference scoring
      if (criteria.preferredTypes?.includes(booking.type)) {
        score += 10;
      }

      // Location proximity scoring
      if (criteria.userLocation && booking.location) {
        if (booking.location.city.toLowerCase() === criteria.userLocation.city.toLowerCase()) {
          score += 8;
        }
        if (booking.location.country.toLowerCase() === criteria.userLocation.country.toLowerCase()) {
          score += 5;
        }
      }

      // Price range scoring
      if (criteria.priceRange) {
        const { min, max } = criteria.priceRange;
        if (min && booking.swapValue >= min) score += 3;
        if (max && booking.swapValue <= max) score += 3;
      }

      // Recency scoring (newer bookings get higher scores)
      if (booking.createdAt) {
        const daysSinceCreated = (Date.now() - booking.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCreated < 7) score += 5;
        else if (daysSinceCreated < 30) score += 3;
      }

      // Verification status scoring
      if (booking.verification?.status === 'verified') {
        score += 7;
      }

      return { ...booking, _score: score };
    })
    .sort((a: any, b: any) => b._score - a._score)
    .map(({ _score, ...booking }) => booking); // Remove the score property
  }

  /**
   * Generate cache key for search results
   */
  private generateSearchCacheKey(filters: SearchFilters, page: number, limit: number): string {
    const filterString = JSON.stringify({
      ...filters,
      // Normalize date objects for consistent caching
      dateRange: filters.dateRange ? {
        ...filters.dateRange,
        checkIn: filters.dateRange.checkIn?.toISOString(),
        checkOut: filters.dateRange.checkOut?.toISOString(),
      } : undefined,
    });
    
    return `${this.SEARCH_CACHE_PREFIX}${Buffer.from(filterString).toString('base64')}:${page}:${limit}`;
  }

  /**
   * Get cached search result
   */
  private async getCachedSearchResult(cacheKey: string): Promise<SearchResult | null> {
    try {
      const cached = await this.cacheService.get<SearchResult>(cacheKey);
      if (cached) {
        // Parse date strings back to Date objects
        cached.bookings = cached.bookings.map((booking: any) => ({
          ...booking,
          dateRange: {
            checkIn: new Date(booking.dateRange.checkIn),
            checkOut: new Date(booking.dateRange.checkOut),
          },
          createdAt: new Date(booking.createdAt),
          updatedAt: new Date(booking.updatedAt),
          verification: {
            ...booking.verification,
            verifiedAt: booking.verification.verifiedAt ? new Date(booking.verification.verifiedAt) : undefined,
          },
        }));
        return cached;
      }
      return null;
    } catch (error) {
      logger.warn('Failed to get cached search result', { error, cacheKey });
      return null;
    }
  }

  /**
   * Cache search result
   */
  private async cacheSearchResult(cacheKey: string, result: SearchResult): Promise<void> {
    try {
      await this.cacheService.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);
    } catch (error) {
      logger.warn('Failed to cache search result', { error, cacheKey });
    }
  }

  /**
   * Get total count of search results (simplified implementation)
   */
  private async getSearchResultCount(criteria: BookingSearchCriteria): Promise<number> {
    try {
      // This is a simplified implementation
      // In a real scenario, you'd want a dedicated count query for better performance
      const allResults = await this.bookingRepository.searchBookings(criteria, 10000, 0);
      return allResults.length;
    } catch (error) {
      logger.warn('Failed to get search result count', { error });
      return 0;
    }
  }

  /**
   * Get optimized search result count using dedicated count query
   */
  private async getOptimizedSearchResultCount(criteria: BookingSearchCriteria): Promise<number> {
    if (!this.queryOptimizer) {
      return this.getSearchResultCount(criteria);
    }

    try {
      const conditions: string[] = ['status = $1'];
      const params: any[] = ['available'];
      let paramIndex = 2;

      // Build count query with same conditions as search query
      if (criteria.query) {
        conditions.push(`search_vector @@ plainto_tsquery('english', $${paramIndex})`);
        params.push(criteria.query);
        paramIndex++;
      }

      if (criteria.location?.city) {
        conditions.push(`city_normalized = lower($${paramIndex})`);
        params.push(criteria.location.city.toLowerCase());
        paramIndex++;
      }

      if (criteria.location?.country) {
        conditions.push(`country_normalized = lower($${paramIndex})`);
        params.push(criteria.location.country.toLowerCase());
        paramIndex++;
      }

      if (criteria.location?.coordinates && criteria.location?.radius) {
        conditions.push(`
          coordinates IS NOT NULL AND
          ST_DWithin(
            coordinates::geography,
            ST_Point($${paramIndex}, $${paramIndex + 1})::geography,
            $${paramIndex + 2}
          )
        `);
        params.push(
          criteria.location.coordinates[1],
          criteria.location.coordinates[0],
          criteria.location.radius * 1000
        );
        paramIndex += 3;
      }

      if (criteria.dateRange?.checkIn) {
        if (criteria.dateRange.flexible) {
          conditions.push(`check_out_date >= $${paramIndex}`);
        } else {
          conditions.push(`check_in_date >= $${paramIndex}`);
        }
        params.push(criteria.dateRange.checkIn);
        paramIndex++;
      }

      if (criteria.dateRange?.checkOut) {
        if (criteria.dateRange.flexible) {
          conditions.push(`check_in_date <= $${paramIndex}`);
        } else {
          conditions.push(`check_out_date <= $${paramIndex}`);
        }
        params.push(criteria.dateRange.checkOut);
        paramIndex++;
      }

      if (criteria.priceRange?.min !== undefined) {
        conditions.push(`swap_value >= $${paramIndex}`);
        params.push(criteria.priceRange.min);
        paramIndex++;
      }

      if (criteria.priceRange?.max !== undefined) {
        conditions.push(`swap_value <= $${paramIndex}`);
        params.push(criteria.priceRange.max);
        paramIndex++;
      }

      if (criteria.types && criteria.types.length > 0) {
        const typePlaceholders = criteria.types.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`type IN (${typePlaceholders})`);
        params.push(...criteria.types);
      }

      const countQuery = `
        SELECT COUNT(*) as total
        FROM bookings
        WHERE ${conditions.join(' AND ')}
      `;

      const results = await this.queryOptimizer.executeOptimizedQuery(
        countQuery,
        params,
        'booking_search_count'
      );

      return parseInt(results[0]?.total || '0');
    } catch (error) {
      logger.warn('Failed to get optimized search result count', { error });
      return this.getSearchResultCount(criteria);
    }
  }

  /**
   * Clear search cache (useful for cache invalidation)
   */
  async clearSearchCache(): Promise<void> {
    try {
      // This would require implementing a pattern-based delete in Redis
      // For now, we'll just log the action
      logger.info('Search cache clear requested');
      // In a real implementation:
      // await this.cacheService.deletePattern(`${this.SEARCH_CACHE_PREFIX}*`);
    } catch (error) {
      logger.error('Failed to clear search cache', { error });
    }
  }
}