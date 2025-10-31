import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { BookingCard } from './BookingCard';
import { FilterPanel } from './FilterPanel';
import {
  SwapProposalModal,
  SwapProposalData,
} from '@/components/swap/SwapProposalModal';
import { Button, Input } from '@/components/ui';
import { tokens } from '@/design-system/tokens';
import { Booking, BookingFilters } from '@/services/bookingService';
import { swapFilterService } from '@/services/SwapFilterService';

interface BookingBrowserProps {
  bookings: Booking[];
  userBookings: Booking[];
  loading?: boolean;
  error?: string;
  onBookingSelect: (booking: Booking) => void;
  onSwapProposal: (data: SwapProposalData) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  totalCount?: number;
  currentUserId?: string; // For filtering out user's own bookings
}

interface PaginationState {
  page: number;
  limit: number;
}

export const BookingBrowser: React.FC<BookingBrowserProps> = ({
  bookings,
  userBookings,
  loading = false,
  error,
  onBookingSelect,
  onSwapProposal,
  onLoadMore,
  hasMore = false,
  totalCount = 0,
  currentUserId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<BookingFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<
    'price' | 'date' | 'location' | 'created'
  >('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
  });
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [selectedTargetBooking, setSelectedTargetBooking] =
    useState<Booking | null>(null);

  // Debounce search query to avoid excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Filter and sort bookings locally for better UX
  const filteredAndSortedBookings = useMemo(() => {
    let filtered = [...bookings];

    // Core filtering (own bookings, cancelled bookings) is now done at the backend level
    // Only apply client-side search and user filters here

    // Apply search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        booking =>
          booking.title.toLowerCase().includes(query) ||
          booking.description.toLowerCase().includes(query) ||
          (booking.location?.city || booking.city || '')
            .toLowerCase()
            .includes(query) ||
          (booking.location?.country || booking.country || '')
            .toLowerCase()
            .includes(query)
      );
    }

    // Apply additional user filters using the SwapFilterService
    const swapFilters = {
      location: filters.location,
      dateRange: filters.dateRange,
      priceRange: filters.priceRange,
      excludeOwnSwaps: true as const,
      excludeCancelledBookings: true as const,
      requireActiveProposals: true as const,
    };

    filtered = swapFilterService.applyUserFiltersToBookings(
      filtered,
      swapFilters
    );

    // Apply legacy filters that aren't handled by SwapFilterService yet
    if (filters.type && filters.type.length > 0) {
      filtered = filtered.filter(booking =>
        filters.type!.includes(booking.type)
      );
    }

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(booking =>
        filters.status!.includes(booking.status)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'price':
          comparison = (a.swapValue || 0) - (b.swapValue || 0);
          break;
        case 'date':
          const aDate = new Date(a.dateRange?.checkIn || a.checkInDate);
          const bDate = new Date(b.dateRange?.checkIn || b.checkInDate);
          comparison = aDate.getTime() - bDate.getTime();
          break;
        case 'location':
          const aLocation = `${a.location?.city || a.city}, ${a.location?.country || a.country}`;
          const bLocation = `${b.location?.city || b.city}, ${b.location?.country || b.country}`;
          comparison = aLocation.localeCompare(bLocation);
          break;
        case 'created':
        default:
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [bookings, debouncedSearchQuery, filters, sortBy, sortOrder]);

  // Handle booking action
  const handleBookingAction = useCallback(
    (action: string, booking: Booking) => {
      if (action === 'propose') {
        setSelectedTargetBooking(booking);
        setProposalModalOpen(true);
      } else if (action === 'view') {
        onBookingSelect(booking);
      }
    },
    [onBookingSelect]
  );

  // Handle proposal submission
  const handleProposalSubmit = useCallback(
    (data: SwapProposalData) => {
      onSwapProposal(data);
      setProposalModalOpen(false);
      setSelectedTargetBooking(null);
    },
    [onSwapProposal]
  );

  // Handle proposal modal close
  const handleProposalModalClose = useCallback(() => {
    setProposalModalOpen(false);
    setSelectedTargetBooking(null);
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: BookingFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  }, []);

  // Handle filter reset
  const handleFilterReset = useCallback(() => {
    setFilters({});
    setSearchQuery('');
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  // Handle load more for infinite scroll
  const handleLoadMore = useCallback(() => {
    if (onLoadMore && hasMore && !loading) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, loading]);

  // Infinite scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 1000
      ) {
        handleLoadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleLoadMore]);

  const containerStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[6],
    padding: tokens.spacing[6],
    maxWidth: '1400px',
    margin: '0 auto',
  };

  const headerStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[4],
  };

  const searchBarStyles = {
    display: 'flex',
    gap: tokens.spacing[4],
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  };

  const controlsStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: tokens.spacing[4],
  };

  const sortControlsStyles = {
    display: 'flex',
    gap: tokens.spacing[2],
    alignItems: 'center',
  };

  const viewControlsStyles = {
    display: 'flex',
    gap: tokens.spacing[2],
    alignItems: 'center',
  };

  const gridStyles = {
    display: 'grid',
    gridTemplateColumns:
      viewMode === 'grid' ? 'repeat(auto-fill, minmax(350px, 1fr))' : '1fr',
    gap: tokens.spacing[6],
  };

  const resultsHeaderStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${tokens.spacing[4]} 0`,
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const loadingStyles = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing[8],
    color: tokens.colors.neutral[500],
  };

  const errorStyles = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing[8],
    color: tokens.colors.error[600],
    backgroundColor: tokens.colors.error[50],
    borderRadius: tokens.borderRadius.md,
    border: `1px solid ${tokens.colors.error[200]}`,
  };

  const emptyStateStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing[12],
    textAlign: 'center' as const,
    color: tokens.colors.neutral[500],
  };

  return (
    <div style={containerStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <h1
          style={{
            fontSize: tokens.typography.fontSize['3xl'],
            fontWeight: tokens.typography.fontWeight.bold,
            color: tokens.colors.neutral[900],
            margin: 0,
          }}
        >
          Browse Available Bookings
        </h1>

        <p
          style={{
            fontSize: tokens.typography.fontSize.lg,
            color: tokens.colors.neutral[600],
            margin: 0,
          }}
        >
          Discover bookings available for swapping and find your perfect match
        </p>
      </div>

      {/* Search and Filter Controls */}
      <div style={searchBarStyles}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <Input
            placeholder="Search by title, location, or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            leftIcon={<span>🔍</span>}
            rightIcon={
              searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: tokens.colors.neutral[400],
                    padding: 0,
                    pointerEvents: 'auto',
                  }}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )
            }
          />
        </div>

        <Button
          variant={showFilters ? 'primary' : 'outline'}
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          <span style={{ marginLeft: tokens.spacing[2] }}>
            {showFilters ? '▲' : '▼'}
          </span>
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleFilterReset}
        />
      )}

      {/* Controls */}
      <div style={controlsStyles}>
        <div style={sortControlsStyles}>
          <label
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
            }}
          >
            Sort by:
          </label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
              border: `1px solid ${tokens.colors.neutral[300]}`,
              borderRadius: tokens.borderRadius.md,
              fontSize: tokens.typography.fontSize.sm,
            }}
          >
            <option value="created">Date Created</option>
            <option value="date">Check-in Date</option>
            <option value="price">Swap Value</option>
            <option value="location">Location</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            aria-label={`Sort ${sortOrder === 'desc' ? 'ascending' : 'descending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>

        <div style={viewControlsStyles}>
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            ⊞
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            ☰
          </Button>
        </div>
      </div>

      {/* Results Header */}
      <div style={resultsHeaderStyles}>
        <div
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
          }}
        >
          {filteredAndSortedBookings.length} bookings available for swapping
          <div
            style={{
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.colors.neutral[500],
              marginTop: tokens.spacing[1],
            }}
          >
            {currentUserId
              ? '(Excluding your own bookings and cancelled bookings)'
              : '(Only showing available bookings)'}
          </div>
          {(debouncedSearchQuery || Object.keys(filters).length > 0) && (
            <span style={{ fontStyle: 'italic' }}>
              {' '}
              - additional filters applied
            </span>
          )}
        </div>

        {(debouncedSearchQuery || Object.keys(filters).length > 0) && (
          <Button variant="ghost" size="sm" onClick={handleFilterReset}>
            Clear search & filters
          </Button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div style={errorStyles}>
          <span style={{ marginRight: tokens.spacing[2] }}>⚠️</span>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && bookings.length === 0 && (
        <div style={loadingStyles}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: `3px solid ${tokens.colors.neutral[200]}`,
              borderTop: `3px solid ${tokens.colors.primary[500]}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginRight: tokens.spacing[3],
            }}
          />
          Loading bookings...
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredAndSortedBookings.length === 0 && !error && (
        <div style={emptyStateStyles}>
          <div style={{ fontSize: '48px', marginBottom: tokens.spacing[4] }}>
            🔍
          </div>
          <h3
            style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.neutral[700],
              margin: `0 0 ${tokens.spacing[2]} 0`,
            }}
          >
            No bookings found
          </h3>
          <p
            style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.neutral[500],
              margin: 0,
              maxWidth: '400px',
            }}
          >
            {debouncedSearchQuery || Object.keys(filters).length > 0
              ? 'Try adjusting your search or filters to find more results.'
              : 'There are no available bookings at the moment. Check back later!'}
          </p>
          {(debouncedSearchQuery || Object.keys(filters).length > 0) && (
            <Button
              variant="outline"
              onClick={handleFilterReset}
              style={{ marginTop: tokens.spacing[4] }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Booking Grid */}
      {filteredAndSortedBookings.length > 0 && (
        <div style={gridStyles}>
          {filteredAndSortedBookings.map(booking => (
            <BookingCard
              key={booking.id}
              booking={booking}
              variant="browse"
              onAction={handleBookingAction}
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && !loading && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: tokens.spacing[6],
          }}
        >
          <Button variant="outline" onClick={handleLoadMore} loading={loading}>
            Load More Bookings
          </Button>
        </div>
      )}

      {/* Loading More Indicator */}
      {loading && bookings.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: tokens.spacing[4],
            color: tokens.colors.neutral[500],
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              border: `2px solid ${tokens.colors.neutral[200]}`,
              borderTop: `2px solid ${tokens.colors.primary[500]}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginRight: tokens.spacing[2],
            }}
          />
          Loading more...
        </div>
      )}

      {/* Swap Proposal Modal */}
      <SwapProposalModal
        isOpen={proposalModalOpen}
        onClose={handleProposalModalClose}
        targetBooking={selectedTargetBooking}
        userBookings={userBookings}
        onSubmit={handleProposalSubmit}
        loading={loading}
      />
    </div>
  );
};
