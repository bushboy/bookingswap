import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { SwapCard } from './SwapCard';
import { CashSwapCard } from './CashSwapCard';
import { FilterPanel } from '@/components/booking/FilterPanel';
import { SwapProposalModal, SwapProposalData } from './SwapProposalModal';
import { Button, Input } from '@/components/ui';
import { tokens } from '@/design-system/tokens';
import { SwapWithBookings, Booking } from '@/services/bookingService';
import { swapFilterService, SwapFilters } from '@/services/SwapFilterService';

interface SwapBrowserProps {
  swaps: SwapWithBookings[];
  userBookings: Booking[];
  loading?: boolean;
  error?: string;
  onSwapSelect: (swap: SwapWithBookings) => void;
  onSwapProposal: (data: SwapProposalData) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  totalCount?: number;
  currentUserId: string; // Required for filtering out user's own swaps
}

interface PaginationState {
  page: number;
  limit: number;
}

export const SwapBrowser: React.FC<SwapBrowserProps> = ({
  swaps,
  userBookings,
  loading = false,
  error,
  onSwapSelect,
  onSwapProposal,
  onLoadMore,
  hasMore = false,
  totalCount = 0,
  currentUserId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Partial<SwapFilters>>({});
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
  const [selectedTargetSwap, setSelectedTargetSwap] =
    useState<SwapWithBookings | null>(null);
  const [cashOfferModalOpen, setCashOfferModalOpen] = useState(false);
  const [selectedCashSwap, setSelectedCashSwap] = useState<SwapWithBookings | null>(null);

  // Debounce search query to avoid excessive filtering
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Apply strict filtering with core browsing restrictions
  const filteredAndSortedSwaps = useMemo(() => {
    let filtered = [...swaps];

    // Apply core browsing filters first (always applied)
    filtered = swapFilterService.applyCoreBrowsingFilters(
      filtered,
      currentUserId
    );

    // Apply search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        swap =>
          swap.sourceBooking?.title?.toLowerCase().includes(query) ||
          swap.sourceBooking?.description?.toLowerCase().includes(query) ||
          (swap.sourceBooking?.location?.city || swap.sourceBooking?.city || '')
            .toLowerCase()
            .includes(query) ||
          (
            swap.sourceBooking?.location?.country ||
            swap.sourceBooking?.country ||
            ''
          )
            .toLowerCase()
            .includes(query)
      );
    }

    // Apply user-configurable filters
    const swapFilters: SwapFilters = {
      ...filters,
      excludeOwnSwaps: true as const,
      excludeCancelledBookings: true as const,
      requireActiveProposals: true as const,
    };

    filtered = swapFilterService.applyUserFilters(filtered, swapFilters);

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'price':
          const aPrice =
            a.sourceBooking?.swapValue || a.sourceBooking?.originalPrice || 0;
          const bPrice =
            b.sourceBooking?.swapValue || b.sourceBooking?.originalPrice || 0;
          comparison = aPrice - bPrice;
          break;
        case 'date':
          const aDate = new Date(
            a.sourceBooking?.dateRange?.checkIn ||
              a.sourceBooking?.checkInDate ||
              0
          );
          const bDate = new Date(
            b.sourceBooking?.dateRange?.checkIn ||
              b.sourceBooking?.checkInDate ||
              0
          );
          comparison = aDate.getTime() - bDate.getTime();
          break;
        case 'location':
          const aLocation = `${a.sourceBooking?.location?.city || a.sourceBooking?.city || ''}, ${a.sourceBooking?.location?.country || a.sourceBooking?.country || ''}`;
          const bLocation = `${b.sourceBooking?.location?.city || b.sourceBooking?.city || ''}, ${b.sourceBooking?.location?.country || b.sourceBooking?.country || ''}`;
          comparison = aLocation.localeCompare(bLocation);
          break;
        case 'created':
        default:
          comparison =
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [swaps, currentUserId, debouncedSearchQuery, filters, sortBy, sortOrder]);

  // Handle swap action
  const handleSwapAction = useCallback(
    (action: string, swap: SwapWithBookings) => {
      if (action === 'propose') {
        setSelectedTargetSwap(swap);
        setProposalModalOpen(true);
      } else if (action === 'view') {
        onSwapSelect(swap);
      }
    },
    [onSwapSelect]
  );

  // Handle cash swap actions
  const handleCashSwapMakeOffer = useCallback(
    (swapId: string) => {
      const swap = filteredAndSortedSwaps.find(s => s.id === swapId);
      if (swap) {
        setSelectedCashSwap(swap);
        setCashOfferModalOpen(true);
      }
    },
    [filteredAndSortedSwaps]
  );

  const handleCashSwapViewOffers = useCallback(
    (swapId: string) => {
      const swap = filteredAndSortedSwaps.find(s => s.id === swapId);
      if (swap) {
        onSwapSelect(swap);
      }
    },
    [filteredAndSortedSwaps, onSwapSelect]
  );

  const handleCashSwapViewDetails = useCallback(
    (swap: SwapWithBookings) => {
      onSwapSelect(swap);
    },
    [onSwapSelect]
  );

  // Handle proposal submission
  const handleProposalSubmit = useCallback(
    (data: SwapProposalData) => {
      onSwapProposal(data);
      setProposalModalOpen(false);
      setSelectedTargetSwap(null);
    },
    [onSwapProposal]
  );

  // Handle proposal modal close
  const handleProposalModalClose = useCallback(() => {
    setProposalModalOpen(false);
    setSelectedTargetSwap(null);
  }, []);

  // Handle cash offer modal close
  const handleCashOfferModalClose = useCallback(() => {
    setCashOfferModalOpen(false);
    setSelectedCashSwap(null);
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: any) => {
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

  // Get filter summary for display
  const filterSummary = useMemo(() => {
    const swapFilters: SwapFilters = {
      ...filters,
      excludeOwnSwaps: true as const,
      excludeCancelledBookings: true as const,
      requireActiveProposals: true as const,
    };
    return swapFilterService.getFilterSummary(swapFilters, currentUserId);
  }, [filters, currentUserId]);

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
      viewMode === 'grid' ? 'repeat(auto-fill, minmax(400px, 1fr))' : '1fr',
    gap: tokens.spacing[6],
  };

  const resultsHeaderStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[2],
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

  const filterInfoStyles = {
    padding: tokens.spacing[3],
    backgroundColor: tokens.colors.primary[50],
    borderRadius: tokens.borderRadius.md,
    border: `1px solid ${tokens.colors.primary[200]}`,
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.primary[700],
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
          Browse Available Swaps
        </h1>

        <p
          style={{
            fontSize: tokens.typography.fontSize.lg,
            color: tokens.colors.neutral[600],
            margin: 0,
          }}
        >
          Discover swaps available for proposals and find your perfect match
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
          mode="swap"
        />
      )}

      {/* Filter Information */}
      <div style={filterInfoStyles}>
        <strong>Active Filters:</strong> {filterSummary}
      </div>

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
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
            }}
          >
            {filteredAndSortedSwaps.length} swaps available for proposals
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
      </div>

      {/* Error State */}
      {error && (
        <div style={errorStyles}>
          <span style={{ marginRight: tokens.spacing[2] }}>⚠️</span>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && swaps.length === 0 && (
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
          Loading swaps...
        </div>
      )}

      {/* Empty State with Filtering Context */}
      {!loading && filteredAndSortedSwaps.length === 0 && !error && (
        <div style={emptyStateStyles}>
          <div style={{ fontSize: '48px', marginBottom: tokens.spacing[4] }}>
            {swaps.length === 0 ? '📭' : '🔍'}
          </div>
          <h3
            style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.neutral[700],
              margin: `0 0 ${tokens.spacing[2]} 0`,
            }}
          >
            {swaps.length === 0
              ? 'No swaps available'
              : 'No swaps match your criteria'}
          </h3>
          <p
            style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.neutral[500],
              margin: 0,
              maxWidth: '500px',
              lineHeight: 1.5,
            }}
          >
            {swaps.length === 0 ? (
              'There are no active swaps available at the moment. Check back later or create your own swap to get started!'
            ) : (
              <>
                All available swaps are filtered out due to the following
                restrictions:
                <br />
                • Your own swaps are hidden
                <br />
                • Cancelled bookings are excluded
                <br />
                • Only swaps with active proposals are shown
                <br />
                {(debouncedSearchQuery || Object.keys(filters).length > 0) && (
                  <>
                    <br />
                    Try adjusting your search or filters to find more results.
                  </>
                )}
              </>
            )}
          </p>
          {(debouncedSearchQuery || Object.keys(filters).length > 0) && (
            <Button
              variant="outline"
              onClick={handleFilterReset}
              style={{ marginTop: tokens.spacing[4] }}
            >
              Clear all filters
            </Button>
          )}
        </div>
      )}

      {/* Swap Grid */}
      {filteredAndSortedSwaps.length > 0 && (
        <div style={gridStyles}>
          {filteredAndSortedSwaps.map(swap => {
            // Render different card types based on swap type
            if (swap.swapType === 'cash') {
              return (
                <CashSwapCard
                  key={swap.id}
                  swap={swap}
                  onMakeOffer={handleCashSwapMakeOffer}
                  onViewOffers={handleCashSwapViewOffers}
                  onViewDetails={handleCashSwapViewDetails}
                  currentUserId={currentUserId}
                  loading={loading}
                />
              );
            } else {
              return (
                <SwapCard
                  key={swap.id}
                  swap={swap}
                  userRole="proposer"
                  onAction={handleSwapAction}
                />
              );
            }
          })}
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
            Load More Swaps
          </Button>
        </div>
      )}

      {/* Loading More Indicator */}
      {loading && swaps.length > 0 && (
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
        targetBooking={selectedTargetSwap?.sourceBooking || null}
        userBookings={userBookings}
        onSubmit={handleProposalSubmit}
        loading={loading}
      />

      {/* Cash Offer Modal */}
      {selectedCashSwap && (
        <SwapProposalModal
          isOpen={cashOfferModalOpen}
          onClose={handleCashOfferModalClose}
          targetBooking={selectedCashSwap.sourceBooking}
          userBookings={[]} // No user bookings needed for cash offers
          onSubmit={handleProposalSubmit}
          loading={loading}
          mode="cash"
          cashDetails={selectedCashSwap.cashDetails}
        />
      )}
    </div>
  );
};
