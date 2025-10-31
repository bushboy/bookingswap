import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Booking, SwapInfo } from '@booking-swap/shared';

/**
 * Configuration for booking list virtualization
 */
export interface VirtualizationConfig {
    itemHeight: number;
    containerHeight: number;
    overscan: number;
    threshold: number;
}

/**
 * Default virtualization configuration
 */
export const DEFAULT_VIRTUALIZATION_CONFIG: VirtualizationConfig = {
    itemHeight: 200, // Approximate height of a booking card
    containerHeight: 600, // Height of the scrollable container
    overscan: 5, // Number of items to render outside visible area
    threshold: 50 // Minimum number of items before virtualization kicks in
};

/**
 * Hook for virtualizing large booking lists to improve performance
 */
export const useBookingListVirtualization = (
    bookings: Booking[],
    config: Partial<VirtualizationConfig> = {}
) => {
    const fullConfig = { ...DEFAULT_VIRTUALIZATION_CONFIG, ...config };
    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Only virtualize if we have enough items
    const shouldVirtualize = bookings.length > fullConfig.threshold;

    // Calculate visible range
    const visibleRange = useMemo(() => {
        if (!shouldVirtualize) {
            return { start: 0, end: bookings.length };
        }

        const visibleStart = Math.floor(scrollTop / fullConfig.itemHeight);
        const visibleEnd = Math.min(
            bookings.length,
            Math.ceil((scrollTop + fullConfig.containerHeight) / fullConfig.itemHeight)
        );

        // Add overscan
        const start = Math.max(0, visibleStart - fullConfig.overscan);
        const end = Math.min(bookings.length, visibleEnd + fullConfig.overscan);

        return { start, end };
    }, [scrollTop, bookings.length, shouldVirtualize, fullConfig]);

    // Get visible items
    const visibleItems = useMemo(() => {
        if (!shouldVirtualize) {
            return bookings.map((booking, index) => ({ booking, index }));
        }

        return bookings
            .slice(visibleRange.start, visibleRange.end)
            .map((booking, relativeIndex) => ({
                booking,
                index: visibleRange.start + relativeIndex
            }));
    }, [bookings, visibleRange, shouldVirtualize]);

    // Handle scroll events
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    // Calculate total height and offset
    const totalHeight = shouldVirtualize ? bookings.length * fullConfig.itemHeight : 'auto';
    const offsetY = shouldVirtualize ? visibleRange.start * fullConfig.itemHeight : 0;

    return {
        containerRef,
        visibleItems,
        totalHeight,
        offsetY,
        handleScroll,
        shouldVirtualize,
        visibleRange
    };
};

/**
 * Hook for optimizing booking list rendering with memoization
 */
export const useBookingListOptimization = (
    bookings: Booking[],
    swapInfoMap: Map<string, SwapInfo>
) => {
    // Memoize booking-swap pairs to prevent unnecessary re-renders
    const bookingSwapPairs = useMemo(() => {
        return bookings.map(booking => ({
            booking,
            swapInfo: swapInfoMap.get(booking.id),
            key: `${booking.id}-${booking.updatedAt}-${swapInfoMap.get(booking.id)?.hasActiveProposals || ''}`
        }));
    }, [bookings, swapInfoMap]);

    // Group bookings by status for optimized filtering
    const bookingsByStatus = useMemo(() => {
        const groups = new Map<string, typeof bookingSwapPairs>();

        bookingSwapPairs.forEach(pair => {
            const status = pair.booking.status;
            if (!groups.has(status)) {
                groups.set(status, []);
            }
            groups.get(status)!.push(pair);
        });

        return groups;
    }, [bookingSwapPairs]);

    // Memoize filtered results for common filters
    const activeBookings = useMemo(() =>
        bookingsByStatus.get('available') || [],
        [bookingsByStatus]
    );

    const bookingsWithSwaps = useMemo(() =>
        bookingSwapPairs.filter(pair => pair.swapInfo?.hasActiveProposals),
        [bookingSwapPairs]
    );

    const bookingsWithoutSwaps = useMemo(() =>
        bookingSwapPairs.filter(pair => !pair.swapInfo?.hasActiveProposals),
        [bookingSwapPairs]
    );

    return {
        bookingSwapPairs,
        bookingsByStatus,
        activeBookings,
        bookingsWithSwaps,
        bookingsWithoutSwaps
    };
};

/**
 * Hook for debouncing search and filter operations
 */
export const useBookingListSearch = (
    bookings: Booking[],
    searchTerm: string,
    debounceMs: number = 300
) => {
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [searchTerm, debounceMs]);

    const filteredBookings = useMemo(() => {
        if (!debouncedSearchTerm.trim()) {
            return bookings;
        }

        const term = debouncedSearchTerm.toLowerCase();
        return bookings.filter(booking =>
            booking.title.toLowerCase().includes(term) ||
            booking.location.city.toLowerCase().includes(term) ||
            booking.location.country.toLowerCase().includes(term) ||
            booking.description?.toLowerCase().includes(term)
        );
    }, [bookings, debouncedSearchTerm]);

    return {
        filteredBookings,
        debouncedSearchTerm,
        isSearching: searchTerm !== debouncedSearchTerm
    };
};

/**
 * Performance monitoring hook for booking list operations
 */
export const useBookingListPerformance = (bookings: Booking[]) => {
    const renderCountRef = useRef(0);
    const lastRenderTimeRef = useRef(Date.now());
    const [performanceMetrics, setPerformanceMetrics] = useState({
        renderCount: 0,
        averageRenderTime: 0,
        lastRenderDuration: 0
    });

    useEffect(() => {
        const startTime = Date.now();
        renderCountRef.current += 1;

        // Measure render time using requestAnimationFrame
        requestAnimationFrame(() => {
            const endTime = Date.now();
            const renderDuration = endTime - startTime;
            const timeSinceLastRender = startTime - lastRenderTimeRef.current;

            setPerformanceMetrics(prev => ({
                renderCount: renderCountRef.current,
                averageRenderTime: (prev.averageRenderTime * (prev.renderCount - 1) + renderDuration) / prev.renderCount,
                lastRenderDuration: renderDuration
            }));

            lastRenderTimeRef.current = startTime;

            // Log performance warnings in development
            if (import.meta.env.DEV) {
                if (renderDuration > 100) {
                    console.warn(`Slow booking list render: ${renderDuration}ms for ${bookings.length} items`);
                }
                if (timeSinceLastRender < 16 && renderCountRef.current > 1) {
                    console.warn(`Frequent booking list re-renders: ${timeSinceLastRender}ms since last render`);
                }
            }
        });
    }, [bookings.length]);

    return performanceMetrics;
};

/**
 * Utility for batching booking updates to prevent excessive re-renders
 */
export class BookingUpdateBatcher {
    private updates: Map<string, Booking> = new Map();
    private timeoutId: NodeJS.Timeout | null = null;
    private callback: (updates: Booking[]) => void;
    private batchDelay: number;

    constructor(callback: (updates: Booking[]) => void, batchDelay: number = 100) {
        this.callback = callback;
        this.batchDelay = batchDelay;
    }

    addUpdate(booking: Booking) {
        this.updates.set(booking.id, booking);

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        this.timeoutId = setTimeout(() => {
            this.flush();
        }, this.batchDelay);
    }

    flush() {
        if (this.updates.size > 0) {
            const updates = Array.from(this.updates.values());
            this.updates.clear();
            this.callback(updates);
        }

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    destroy() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.updates.clear();
    }
}

/**
 * Hook for using the booking update batcher
 */
export const useBookingUpdateBatcher = (
    onBatchUpdate: (updates: Booking[]) => void,
    batchDelay: number = 100
) => {
    const batcherRef = useRef<BookingUpdateBatcher | null>(null);

    useEffect(() => {
        batcherRef.current = new BookingUpdateBatcher(onBatchUpdate, batchDelay);

        return () => {
            batcherRef.current?.destroy();
        };
    }, [onBatchUpdate, batchDelay]);

    const addUpdate = useCallback((booking: Booking) => {
        batcherRef.current?.addUpdate(booking);
    }, []);

    const flush = useCallback(() => {
        batcherRef.current?.flush();
    }, []);

    return { addUpdate, flush };
};