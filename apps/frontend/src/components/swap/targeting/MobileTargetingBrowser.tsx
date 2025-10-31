import React, { useState, useEffect } from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import { SwapCardData } from '@booking-swap/shared';
import styles from './mobile-targeting.module.css';

export interface MobileTargetingBrowserProps {
    swapId: string;
    availableTargets: SwapCardData[];
    onSelectTarget: (targetSwapId: string) => Promise<void>;
    onClose: () => void;
    loading?: boolean;
    filters?: {
        location?: string;
        dateRange?: { start: Date; end: Date };
        priceRange?: { min: number; max: number };
        bookingType?: string;
    };
    onFiltersChange?: (filters: any) => void;
}

/**
 * Mobile-optimized targeting browsing interface
 * Features touch-friendly target selection and filtering
 */
export const MobileTargetingBrowser: React.FC<MobileTargetingBrowserProps> = ({
    swapId,
    availableTargets,
    onSelectTarget,
    onClose,
    loading = false,
    filters,
    onFiltersChange,
}) => {
    const { isMobile } = useResponsive();
    const [activeFilters, setActiveFilters] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredTargets, setFilteredTargets] = useState(availableTargets);
    const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

    // Don't render on desktop
    if (!isMobile) {
        return null;
    }

    // Filter targets based on search and active filters
    useEffect(() => {
        let filtered = availableTargets;

        // Apply search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(target =>
                target.userSwap.bookingDetails?.title?.toLowerCase().includes(query) ||
                target.userSwap.bookingDetails?.location?.city?.toLowerCase().includes(query) ||
                target.userSwap.bookingDetails?.location?.country?.toLowerCase().includes(query)
            );
        }

        // Apply active filters
        if (activeFilters.includes('nearby')) {
            // Filter by nearby locations (simplified logic)
            filtered = filtered.filter(target => {
                // This would typically use geolocation or user's preferred locations
                return true; // Placeholder
            });
        }

        if (activeFilters.includes('similar-price')) {
            // Filter by similar price range (simplified logic)
            filtered = filtered.filter(target => {
                // This would compare price ranges
                return true; // Placeholder
            });
        }

        if (activeFilters.includes('similar-dates')) {
            // Filter by similar date ranges (simplified logic)
            filtered = filtered.filter(target => {
                // This would compare date ranges
                return true; // Placeholder
            });
        }

        if (activeFilters.includes('auction')) {
            // Filter by auction mode swaps
            filtered = filtered.filter(target => {
                // This would check acceptance strategy
                return true; // Placeholder
            });
        }

        setFilteredTargets(filtered);
    }, [availableTargets, searchQuery, activeFilters]);

    const handleFilterToggle = (filter: string) => {
        const newFilters = activeFilters.includes(filter)
            ? activeFilters.filter(f => f !== filter)
            : [...activeFilters, filter];

        setActiveFilters(newFilters);

        if (onFiltersChange) {
            onFiltersChange({ activeFilters: newFilters });
        }
    };

    const handleSelectTarget = async (targetSwapId: string) => {
        if (selectedTargetId === targetSwapId || loading) return;

        setSelectedTargetId(targetSwapId);

        try {
            await onSelectTarget(targetSwapId);
            onClose();
        } catch (error) {
            console.error('Failed to select target:', error);
            setSelectedTargetId(null);
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const getBookingDates = (booking: any) => {
        if (booking?.dateRange?.checkIn && booking?.dateRange?.checkOut) {
            return `${formatDate(booking.dateRange.checkIn)} - ${formatDate(booking.dateRange.checkOut)}`;
        }
        return 'Dates TBD';
    };

    const filterOptions = [
        { id: 'nearby', label: '📍 Nearby', description: 'Similar locations' },
        { id: 'similar-price', label: '💰 Similar Price', description: 'Similar value range' },
        { id: 'similar-dates', label: '📅 Similar Dates', description: 'Similar date ranges' },
        { id: 'auction', label: '🎯 Auction Mode', description: 'Auction-based swaps' },
    ];

    return (
        <div className={styles['mobile-targeting-browse']}>
            <div className={styles['mobile-targeting-browse-header']}>
                <h2 className={styles['mobile-targeting-browse-title']}>
                    Find Target Swap
                </h2>
                <button
                    className={styles['mobile-targeting-browse-close']}
                    onClick={onClose}
                    aria-label="Close targeting browser"
                >
                    ✕
                </button>
            </div>

            {/* Search input */}
            <div className={styles['mobile-targeting-search']}>
                <input
                    type="text"
                    placeholder="Search by location or title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles['mobile-targeting-search-input']}
                />
            </div>

            {/* Filter options */}
            <div className={styles['mobile-targeting-browse-filters']}>
                {filterOptions.map((filter) => (
                    <button
                        key={filter.id}
                        className={`${styles['mobile-targeting-browse-filter']} ${activeFilters.includes(filter.id) ? styles.active : ''
                            }`}
                        onClick={() => handleFilterToggle(filter.id)}
                        aria-label={`Filter by ${filter.description}`}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {/* Results */}
            <div className={styles['mobile-targeting-browse-results']}>
                {loading ? (
                    <div className={styles['mobile-targeting-loading']}>
                        <div className={styles['mobile-targeting-spinner']} />
                        <span>Loading available targets...</span>
                    </div>
                ) : filteredTargets.length === 0 ? (
                    <div className={styles['mobile-targeting-browse-empty']}>
                        <div className={styles['mobile-targeting-browse-empty-icon']}>
                            🔍
                        </div>
                        <p className={styles['mobile-targeting-browse-empty-text']}>
                            {searchQuery || activeFilters.length > 0
                                ? 'No swaps match your criteria'
                                : 'No available targets found'
                            }
                        </p>
                    </div>
                ) : (
                    filteredTargets.map((target) => {
                        const isSelecting = selectedTargetId === target.userSwap.id;
                        const booking = target.userSwap.bookingDetails;

                        return (
                            <div
                                key={target.userSwap.id}
                                className={styles['mobile-targeting-browse-item']}
                                onClick={() => handleSelectTarget(target.userSwap.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleSelectTarget(target.userSwap.id);
                                    }
                                }}
                                aria-label={`Select ${booking?.title || 'swap'} for targeting`}
                            >
                                <div className={styles['mobile-targeting-browse-item-avatar']}>
                                    {booking?.title?.charAt(0).toUpperCase() || '?'}
                                </div>

                                <div className={styles['mobile-targeting-browse-item-info']}>
                                    <h3 className={styles['mobile-targeting-browse-item-title']}>
                                        {booking?.title || 'Untitled Booking'}
                                    </h3>
                                    <p className={styles['mobile-targeting-browse-item-subtitle']}>
                                        {booking?.location?.city}, {booking?.location?.country} • {getBookingDates(booking)}
                                    </p>
                                    <p className={styles['mobile-targeting-browse-item-subtitle']}>
                                        {formatPrice(booking?.swapValue || 0)}
                                    </p>
                                </div>

                                <button
                                    className={styles['mobile-targeting-browse-item-action']}
                                    disabled={isSelecting}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectTarget(target.userSwap.id);
                                    }}
                                >
                                    {isSelecting ? (
                                        <div className={styles['mobile-targeting-spinner']} />
                                    ) : (
                                        'Target'
                                    )}
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default MobileTargetingBrowser;