import React, { useState, useEffect, useMemo } from 'react';
import { BookingCard } from './BookingCard';
import { BookingSearch, SearchFilters } from './BookingSearch';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { tokens } from '@/design-system/tokens';
import { useResponsive } from '@/hooks/useResponsive';
import { useId, useAnnouncements } from '@/hooks/useAccessibility';
import { Booking, BookingType, BookingStatus } from '@booking-swap/shared';

export interface BookingFilters extends SearchFilters {
  status?: BookingStatus[];
  sortBy: 'title' | 'price' | 'date' | 'location';
  sortOrder: 'asc' | 'desc';
}

interface BookingListProps {
  bookings: Booking[];
  loading?: boolean;
  onViewDetails: (bookingId: string) => void;
  onProposeSwap: (bookingId: string) => void;
  onEditBooking?: (booking: Booking) => void;
  onDeleteBooking?: (bookingId: string) => void;
  onCreateSwap?: (booking: Booking) => void;
  showActions?: boolean;
  variant?: 'own' | 'browse';
  emptyMessage?: string;
}

const getItemsPerPage = (isMobile: boolean, isTablet: boolean) => {
  if (isMobile) return 6;
  if (isTablet) return 8;
  return 12;
};

const ITEMS_PER_PAGE = getItemsPerPage(false, false); // Default for SSR

const SORT_OPTIONS = [
  { value: 'title', label: 'Title' },
  { value: 'price', label: 'Price' },
  { value: 'date', label: 'Date' },
  { value: 'location', label: 'Location' },
];

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available', color: tokens.colors.success[500] },
  { value: 'locked', label: 'Locked', color: tokens.colors.warning[500] },
  { value: 'swapped', label: 'Swapped', color: tokens.colors.neutral[500] },
  { value: 'cancelled', label: 'Cancelled', color: tokens.colors.error[500] },
];

const LoadingSkeleton: React.FC = () => (
  <div
    style={{
      height: '400px',
      backgroundColor: tokens.colors.neutral[100],
      borderRadius: tokens.borderRadius.lg,
      animation: 'pulse 2s infinite',
    }}
  />
);

export const BookingList: React.FC<BookingListProps> = ({
  bookings,
  loading = false,
  onViewDetails,
  onProposeSwap,
  onEditBooking,
  onDeleteBooking,
  onCreateSwap,
  showActions = true,
  variant = 'browse',
  emptyMessage = 'No bookings found. Try adjusting your search filters.',
}) => {
  const { isMobile, isTablet } = useResponsive();
  const { announce } = useAnnouncements();
  const listId = useId('booking-list');
  const filtersId = useId('booking-filters');
  const resultsId = useId('booking-results');

  const [filters, setFilters] = useState<BookingFilters>({
    query: '',
    location: '',
    type: 'all',
    minPrice: 0,
    maxPrice: 10000,
    dateFrom: '',
    dateTo: '',
    status: [],
    sortBy: 'date',
    sortOrder: 'desc',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    isMobile ? 'list' : 'grid'
  );
  const [showFilters, setShowFilters] = useState(!isMobile);

  // Filter and sort bookings
  const filteredAndSortedBookings = useMemo(() => {
    let filtered = bookings.filter(booking => {
      // Text search
      if (filters.query) {
        const searchText = filters.query.toLowerCase();
        const matchesText =
          booking.title.toLowerCase().includes(searchText) ||
          booking.description.toLowerCase().includes(searchText) ||
          booking.location.city.toLowerCase().includes(searchText) ||
          booking.location.country.toLowerCase().includes(searchText);
        if (!matchesText) return false;
      }

      // Location filter
      if (filters.location) {
        const locationText = filters.location.toLowerCase();
        const matchesLocation =
          booking.location.city.toLowerCase().includes(locationText) ||
          booking.location.country.toLowerCase().includes(locationText);
        if (!matchesLocation) return false;
      }

      // Type filter
      if (filters.type !== 'all' && booking.type !== filters.type) {
        return false;
      }

      // Price filter
      if (
        booking.swapValue < filters.minPrice ||
        booking.swapValue > filters.maxPrice
      ) {
        return false;
      }

      // Date filter
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        if (booking.dateRange.checkIn < fromDate) return false;
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        if (booking.dateRange.checkOut > toDate) return false;
      }

      // Status filter
      if (filters.status && filters.status.length > 0) {
        if (!filters.status.includes(booking.status)) return false;
      }

      return true;
    });

    // Sort bookings
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'price':
          comparison = a.swapValue - b.swapValue;
          break;
        case 'date':
          comparison =
            a.dateRange.checkIn.getTime() - b.dateRange.checkIn.getTime();
          break;
        case 'location':
          comparison =
            `${a.location.city}, ${a.location.country}`.localeCompare(
              `${b.location.city}, ${b.location.country}`
            );
          break;
      }

      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [bookings, filters]);

  // Responsive pagination
  const itemsPerPage = getItemsPerPage(isMobile, isTablet);
  const totalPages = Math.ceil(filteredAndSortedBookings.length / itemsPerPage);
  const paginatedBookings = filteredAndSortedBookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filters change and announce results
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Announce filter results to screen readers
  useEffect(() => {
    if (!loading) {
      const resultCount = filteredAndSortedBookings.length;
      const message = `${resultCount} booking${resultCount !== 1 ? 's' : ''} found`;
      announce(message);
    }
  }, [filteredAndSortedBookings.length, loading, announce]);

  const handleSearch = (searchFilters: SearchFilters) => {
    setFilters(prev => ({ ...prev, ...searchFilters }));
  };

  const handleStatusFilter = (status: BookingStatus) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status?.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...(prev.status || []), status],
    }));
  };

  const handleSort = (sortBy: BookingFilters['sortBy']) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder:
        prev.sortBy === sortBy && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const selectStyles = {
    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
    fontSize: tokens.typography.fontSize.sm,
    border: `1px solid ${tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
    color: tokens.colors.neutral[900],
    outline: 'none',
  };

  if (loading) {
    return (
      <div style={{ padding: `${tokens.spacing[6]} 0` }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              viewMode === 'grid'
                ? isMobile
                  ? '1fr'
                  : isTablet
                    ? 'repeat(auto-fill, minmax(300px, 1fr))'
                    : 'repeat(auto-fill, minmax(350px, 1fr))'
                : '1fr',
            gap: isMobile ? tokens.spacing[4] : tokens.spacing[6],
          }}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <LoadingSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? tokens.spacing[4] : tokens.spacing[6],
      }}
      role="main"
      aria-labelledby={listId}
    >
      {/* Search and Filters */}
      <section aria-labelledby="search-heading">
        <h2 id="search-heading" className="sr-only">
          Search and filter bookings
        </h2>
        <BookingSearch onSearch={handleSearch} loading={loading} />
      </section>

      {/* Mobile Filter Toggle */}
      {isMobile && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            style={{ flex: 1, marginRight: tokens.spacing[2] }}
            aria-expanded={showFilters}
            aria-controls={filtersId}
            aria-label={`${showFilters ? 'Hide' : 'Show'} filters. ${filteredAndSortedBookings.length} bookings found`}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'} (
            {filteredAndSortedBookings.length})
          </Button>
          <div
            style={{
              display: 'flex',
              border: `1px solid ${tokens.colors.neutral[300]}`,
              borderRadius: tokens.borderRadius.md,
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                border: 'none',
                backgroundColor:
                  viewMode === 'list'
                    ? tokens.colors.primary[100]
                    : 'transparent',
                color:
                  viewMode === 'list'
                    ? tokens.colors.primary[700]
                    : tokens.colors.neutral[600],
                cursor: 'pointer',
                borderRadius: `${tokens.borderRadius.md} 0 0 ${tokens.borderRadius.md}`,
                minWidth: '44px', // Touch target
                minHeight: '44px',
              }}
              title="List view"
              aria-label="List view"
            >
              ☰
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                border: 'none',
                backgroundColor:
                  viewMode === 'grid'
                    ? tokens.colors.primary[100]
                    : 'transparent',
                color:
                  viewMode === 'grid'
                    ? tokens.colors.primary[700]
                    : tokens.colors.neutral[600],
                cursor: 'pointer',
                borderRadius: `0 ${tokens.borderRadius.md} ${tokens.borderRadius.md} 0`,
                minWidth: '44px', // Touch target
                minHeight: '44px',
              }}
              title="Grid view"
              aria-label="Grid view"
            >
              ⊞
            </button>
          </div>
        </div>
      )}

      {/* Additional Filters and Controls */}
      {showFilters && (
        <section aria-labelledby="filters-heading">
          <Card variant="outlined" id={filtersId}>
            <CardContent>
              <div
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: tokens.spacing[4],
                }}
              >
                {/* Status Filters */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    gap: tokens.spacing[3],
                  }}
                >
                  <span
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.medium,
                      color: tokens.colors.neutral[700],
                      minWidth: isMobile ? 'auto' : 'fit-content',
                    }}
                  >
                    Status:
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: tokens.spacing[2],
                    }}
                  >
                    {STATUS_OPTIONS.map(status => (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() =>
                          handleStatusFilter(status.value as BookingStatus)
                        }
                        style={{
                          padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                          fontSize: tokens.typography.fontSize.xs,
                          fontWeight: tokens.typography.fontWeight.medium,
                          border: `1px solid ${status.color}`,
                          borderRadius: tokens.borderRadius.full,
                          backgroundColor: filters.status?.includes(
                            status.value as BookingStatus
                          )
                            ? status.color
                            : 'transparent',
                          color: filters.status?.includes(
                            status.value as BookingStatus
                          )
                            ? 'white'
                            : status.color,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          minHeight: '44px', // Touch target
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        aria-pressed={filters.status?.includes(
                          status.value as BookingStatus
                        )}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort and View Controls */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    gap: tokens.spacing[3],
                  }}
                >
                  {/* Sort Controls */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[2],
                      flexWrap: isMobile ? 'wrap' : 'nowrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                        minWidth: 'fit-content',
                      }}
                    >
                      Sort by:
                    </span>
                    <select
                      value={filters.sortBy}
                      onChange={e =>
                        handleSort(e.target.value as BookingFilters['sortBy'])
                      }
                      style={{
                        ...selectStyles,
                        minHeight: '44px', // Touch target
                        flex: isMobile ? '1' : 'none',
                      }}
                      aria-label="Sort bookings by"
                    >
                      {SORT_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setFilters(prev => ({
                          ...prev,
                          sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
                        }))
                      }
                      style={{
                        padding: tokens.spacing[2],
                        border: `1px solid ${tokens.colors.neutral[300]}`,
                        borderRadius: tokens.borderRadius.md,
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '44px', // Touch target
                        minHeight: '44px',
                      }}
                      title={`Sort ${filters.sortOrder === 'asc' ? 'ascending' : 'descending'}`}
                      aria-label={`Sort ${filters.sortOrder === 'asc' ? 'ascending' : 'descending'}`}
                    >
                      {filters.sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>

                  {/* Desktop View Mode Toggle */}
                  {!isMobile && (
                    <div
                      style={{
                        display: 'flex',
                        border: `1px solid ${tokens.colors.neutral[300]}`,
                        borderRadius: tokens.borderRadius.md,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        style={{
                          padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                          border: 'none',
                          backgroundColor:
                            viewMode === 'grid'
                              ? tokens.colors.primary[100]
                              : 'transparent',
                          color:
                            viewMode === 'grid'
                              ? tokens.colors.primary[700]
                              : tokens.colors.neutral[600],
                          cursor: 'pointer',
                          borderRadius: `${tokens.borderRadius.md} 0 0 ${tokens.borderRadius.md}`,
                          minWidth: '44px',
                          minHeight: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Grid view"
                        aria-label="Grid view"
                        aria-pressed={viewMode === 'grid'}
                      >
                        ⊞
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        style={{
                          padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                          border: 'none',
                          backgroundColor:
                            viewMode === 'list'
                              ? tokens.colors.primary[100]
                              : 'transparent',
                          color:
                            viewMode === 'list'
                              ? tokens.colors.primary[700]
                              : tokens.colors.neutral[600],
                          cursor: 'pointer',
                          borderRadius: `0 ${tokens.borderRadius.md} ${tokens.borderRadius.md} 0`,
                          minWidth: '44px',
                          minHeight: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="List view"
                        aria-label="List view"
                        aria-pressed={viewMode === 'list'}
                      >
                        ☰
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Results Summary */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2
          id={listId}
          style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
            margin: 0,
          }}
        >
          {variant === 'own' ? 'My Bookings' : 'Available Bookings'}
        </h2>
        <div
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
          }}
          aria-live="polite"
          aria-atomic="true"
        >
          {filteredAndSortedBookings.length} booking
          {filteredAndSortedBookings.length !== 1 ? 's' : ''} found
          {totalPages > 1 && (
            <span>
              {' '}
              • Page {currentPage} of {totalPages}
            </span>
          )}
        </div>
      </div>

      {/* Bookings Grid/List */}
      <section
        aria-labelledby={resultsId}
        aria-live="polite"
        aria-busy={loading}
      >
        <h3 id={resultsId} className="sr-only">
          Booking results
        </h3>

        {filteredAndSortedBookings.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: `${tokens.spacing[12]} ${tokens.spacing[6]}`,
              color: tokens.colors.neutral[600],
            }}
            role="status"
            aria-label="No bookings found"
          >
            <div
              style={{
                fontSize: '64px',
                marginBottom: tokens.spacing[4],
              }}
              aria-hidden="true"
            >
              🔍
            </div>
            <h4
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.neutral[700],
                margin: `0 0 ${tokens.spacing[2]} 0`,
              }}
            >
              No bookings found
            </h4>
            <p
              style={{
                fontSize: tokens.typography.fontSize.base,
                color: tokens.colors.neutral[600],
                margin: 0,
                maxWidth: '400px',
                marginLeft: 'auto',
                marginRight: 'auto',
                lineHeight: tokens.typography.lineHeight.relaxed,
              }}
            >
              {emptyMessage}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                viewMode === 'grid'
                  ? isMobile
                    ? '1fr'
                    : isTablet
                      ? 'repeat(auto-fill, minmax(300px, 1fr))'
                      : 'repeat(auto-fill, minmax(350px, 1fr))'
                  : '1fr',
              gap: isMobile ? tokens.spacing[4] : tokens.spacing[6],
            }}
            role="grid"
            aria-label={`${filteredAndSortedBookings.length} bookings in ${viewMode} view`}
          >
            {paginatedBookings.map((booking, index) => (
              <div
                key={booking.id}
                role="gridcell"
                style={{ display: 'contents' }}
              >
                <BookingCard
                  booking={booking}
                  variant={variant}
                  onAction={(action, booking) => {
                    // Announce action to screen readers
                    const actionMessages = {
                      view: `Viewing details for ${booking.title}`,
                      propose: `Proposing swap for ${booking.title}`,
                      edit: `Editing ${booking.title}`,
                      delete: `Deleting ${booking.title}`,
                      swap: `Creating swap for ${booking.title}`,
                    };

                    if (actionMessages[action as keyof typeof actionMessages]) {
                      announce(
                        actionMessages[action as keyof typeof actionMessages]
                      );
                    }

                    switch (action) {
                      case 'view':
                        onViewDetails(booking.id);
                        break;
                      case 'propose':
                        onProposeSwap(booking.id);
                        break;
                      case 'edit':
                        onEditBooking?.(booking);
                        break;
                      case 'delete':
                        onDeleteBooking?.(booking.id);
                        break;
                      case 'swap':
                        onCreateSwap?.(booking);
                        break;
                    }
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          aria-label="Booking list pagination"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: tokens.spacing[2],
            padding: `${tokens.spacing[6]} 0`,
            flexWrap: 'wrap',
          }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              minWidth: isMobile ? '80px' : 'auto',
              minHeight: '44px', // Touch target
            }}
          >
            {isMobile ? '‹' : 'Previous'}
          </Button>

          <div
            style={{
              display: 'flex',
              gap: tokens.spacing[1],
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {Array.from(
              { length: Math.min(isMobile ? 3 : 5, totalPages) },
              (_, i) => {
                let pageNum;
                const maxPages = isMobile ? 3 : 5;

                if (totalPages <= maxPages) {
                  pageNum = i + 1;
                } else if (currentPage <= Math.floor(maxPages / 2) + 1) {
                  pageNum = i + 1;
                } else if (
                  currentPage >=
                  totalPages - Math.floor(maxPages / 2)
                ) {
                  pageNum = totalPages - maxPages + 1 + i;
                } else {
                  pageNum = currentPage - Math.floor(maxPages / 2) + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                      border: `1px solid ${tokens.colors.neutral[300]}`,
                      borderRadius: tokens.borderRadius.md,
                      backgroundColor:
                        currentPage === pageNum
                          ? tokens.colors.primary[500]
                          : 'white',
                      color:
                        currentPage === pageNum
                          ? 'white'
                          : tokens.colors.neutral[700],
                      cursor: 'pointer',
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.medium,
                      minWidth: '44px', // Touch target
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label={`Go to page ${pageNum}`}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                );
              }
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage(prev => Math.min(totalPages, prev + 1))
            }
            disabled={currentPage === totalPages}
            style={{
              minWidth: isMobile ? '80px' : 'auto',
              minHeight: '44px', // Touch target
            }}
          >
            {isMobile ? '›' : 'Next'}
          </Button>
        </nav>
      )}
    </div>
  );
};
