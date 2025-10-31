import React, { memo, useMemo } from 'react';
import { Booking, SwapInfo, BookingWithSwapInfo, BookingUserRole } from '@booking-swap/shared';
import { BookingCard } from './BookingCard';
import { useBookingListVirtualization, useBookingListOptimization } from '@/utils/bookingListOptimization';
import { useBookingActionsOptimization } from '@/hooks/useBookingActionsOptimization';

interface OptimizedBookingListProps {
    bookings: BookingWithSwapInfo[];
    userRole: BookingUserRole;
    onEdit?: (booking: Booking) => void;
    onCreateSwap?: (booking: Booking) => void;
    onManageSwap?: (swapInfo: SwapInfo) => void;
    onViewProposals?: (swapInfo: SwapInfo) => void;
    onMakeProposal?: () => void;
    onViewDetails?: (booking: Booking) => void;
    virtualizationConfig?: {
        itemHeight?: number;
        containerHeight?: number;
        overscan?: number;
        threshold?: number;
    };
}

/**
 * Optimized booking card component with memoization
 */
const OptimizedBookingCard = memo<{
    bookingWithSwapInfo: BookingWithSwapInfo;
    userRole: BookingUserRole;
    onEdit?: (booking: Booking) => void;
    onCreateSwap?: (booking: Booking) => void;
    onManageSwap?: (swapInfo: SwapInfo) => void;
    onViewProposals?: (swapInfo: SwapInfo) => void;
    onMakeProposal?: () => void;
    onViewDetails?: (booking: Booking) => void;
}>(({ bookingWithSwapInfo, userRole, ...handlers }) => {
    return (
        <BookingCard
            booking={bookingWithSwapInfo}
            userRole={userRole}
            onEdit={handlers.onEdit}
            onCreateSwap={handlers.onCreateSwap}
            onManageSwap={handlers.onManageSwap}
            onViewProposals={handlers.onViewProposals}
            onMakeProposal={handlers.onMakeProposal}
            onViewDetails={handlers.onViewDetails}
        />
    );
});

OptimizedBookingCard.displayName = 'OptimizedBookingCard';

/**
 * Optimized booking list with virtualization and performance optimizations
 */
export const OptimizedBookingList: React.FC<OptimizedBookingListProps> = memo(({
    bookings,
    swapInfoMap,
    userRole,
    virtualizationConfig,
    ...handlers
}) => {
    // Use booking list optimization hook
    const { bookingSwapPairs } = useBookingListOptimization(bookings, swapInfoMap);

    // Use virtualization for large lists
    const {
        containerRef,
        visibleItems,
        totalHeight,
        offsetY,
        handleScroll,
        shouldVirtualize
    } = useBookingListVirtualization(bookings, virtualizationConfig);

    // Memoize the items to render
    const itemsToRender = useMemo(() => {
        const items = shouldVirtualize ? visibleItems : bookingSwapPairs.map((pair, index) => ({
            booking: pair.booking,
            index
        }));

        return items.map(({ booking, index }) => {
            const swapInfo = swapInfoMap.get(booking.id);
            const key = `${booking.id}-${booking.updatedAt}`;

            return (
                <div
                    key={key}
                    style={{
                        position: shouldVirtualize ? 'absolute' : 'relative',
                        top: shouldVirtualize ? index * (virtualizationConfig?.itemHeight || 200) : undefined,
                        width: '100%',
                        height: shouldVirtualize ? virtualizationConfig?.itemHeight || 200 : 'auto'
                    }}
                >
                    <OptimizedBookingCard
                        booking={booking}
                        swapInfo={swapInfo}
                        userRole={userRole}
                        {...handlers}
                    />
                </div>
            );
        });
    }, [
        shouldVirtualize,
        visibleItems,
        bookingSwapPairs,
        swapInfoMap,
        userRole,
        virtualizationConfig?.itemHeight,
        handlers
    ]);

    const containerStyle = useMemo(() => ({
        height: virtualizationConfig?.containerHeight || 600,
        overflow: 'auto' as const,
        position: 'relative' as const
    }), [virtualizationConfig?.containerHeight]);

    const contentStyle = useMemo(() => ({
        height: totalHeight,
        position: 'relative' as const,
        paddingTop: shouldVirtualize ? offsetY : 0
    }), [totalHeight, shouldVirtualize, offsetY]);

    if (bookings.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>No bookings found.</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={containerStyle}
            onScroll={shouldVirtualize ? handleScroll : undefined}
        >
            <div style={contentStyle}>
                {itemsToRender}
            </div>
        </div>
    );
});

OptimizedBookingList.displayName = 'OptimizedBookingList';

/**
 * Hook for using the optimized booking list with performance monitoring
 */
export const useOptimizedBookingList = (
    bookings: Booking[],
    swapInfoMap: Map<string, SwapInfo>
) => {
    const optimization = useBookingListOptimization(bookings, swapInfoMap);

    // Performance metrics
    const performanceMetrics = useMemo(() => ({
        totalBookings: bookings.length,
        bookingsWithSwaps: optimization.bookingsWithSwaps.length,
        bookingsWithoutSwaps: optimization.bookingsWithoutSwaps.length,
        activeBookings: optimization.activeBookings.length,
        swapInfoCacheSize: swapInfoMap.size
    }), [bookings.length, optimization, swapInfoMap.size]);

    return {
        ...optimization,
        performanceMetrics
    };
};

export default OptimizedBookingList;