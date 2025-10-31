import { logger } from '../../utils/logger';

/**
 * Fallback BookingService implementation for when the main service is unavailable
 * Provides basic functionality to prevent complete system failure
 */
export class FallbackBookingService {
    private cache: Map<string, any> = new Map();

    constructor() {
        logger.info('FallbackBookingService initialized');
    }

    /**
     * Fallback implementation of getBookingById
     * Returns cached data if available, otherwise returns a minimal booking object
     */
    async getBookingById(bookingId: string): Promise<any> {
        logger.warn(`Using fallback BookingService.getBookingById for booking: ${bookingId}`);

        // Check cache first
        if (this.cache.has(bookingId)) {
            const cachedBooking = this.cache.get(bookingId);
            logger.info(`Returning cached booking data for ${bookingId}`);
            return cachedBooking;
        }

        // Return minimal booking object to prevent system failure
        const fallbackBooking = {
            id: bookingId,
            status: 'unknown',
            userId: 'unknown',
            eventName: 'Booking details unavailable',
            eventDate: new Date(),
            venue: 'Unknown venue',
            seatSection: 'Unknown',
            seatRow: 'Unknown',
            seatNumber: 'Unknown',
            price: 0,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
            isFallback: true, // Flag to indicate this is fallback data
            fallbackReason: 'Main BookingService unavailable'
        };

        // Cache the fallback data
        this.cache.set(bookingId, fallbackBooking);

        logger.warn(`Returning fallback booking data for ${bookingId}`);
        return fallbackBooking;
    }

    /**
     * Fallback implementation of createBooking
     */
    async createBooking(bookingData: any): Promise<any> {
        logger.error('FallbackBookingService.createBooking called - this operation is not supported in fallback mode');
        throw new Error('Booking creation is not available in fallback mode. Please try again later.');
    }

    /**
     * Fallback implementation of updateBooking
     */
    async updateBooking(bookingId: string, updateData: any): Promise<any> {
        logger.error(`FallbackBookingService.updateBooking called for ${bookingId} - this operation is not supported in fallback mode`);
        throw new Error('Booking updates are not available in fallback mode. Please try again later.');
    }

    /**
     * Cache booking data for future fallback use
     */
    cacheBooking(bookingId: string, bookingData: any): void {
        this.cache.set(bookingId, {
            ...bookingData,
            cachedAt: new Date(),
            isFallback: false
        });
        logger.debug(`Cached booking data for ${bookingId}`);
    }

    /**
     * Clear cached booking data
     */
    clearCache(): void {
        this.cache.clear();
        logger.info('FallbackBookingService cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * Health check for fallback service
     */
    async healthCheck(): Promise<boolean> {
        try {
            // Basic health check - verify service is responsive
            return true;
        } catch (error) {
            logger.error('FallbackBookingService health check failed:', error);
            return false;
        }
    }
}