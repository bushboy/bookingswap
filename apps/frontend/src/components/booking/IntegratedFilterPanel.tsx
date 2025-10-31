import React, { useState, useCallback } from 'react';
import { Button, Input } from '@/components/ui';
import { tokens } from '@/design-system/tokens';
import {
  BookingFilters,
  BookingType,
  BookingStatus,
} from '@/services/bookingService';
import {
  getBookingTypeOptions,
  EnabledBookingType
} from '@booking-swap/shared';
import { useSwapFilterAccessibility, useSwapHighContrast } from '@/hooks/useSwapAccessibility';

// Enhanced filter interface that includes swap-specific filters
export interface EnhancedBookingFilters extends BookingFilters {
  // Swap-specific filters
  swapAvailable?: boolean;
  acceptsCash?: boolean;
  auctionMode?: boolean;
  swapType?: 'booking' | 'cash' | 'both';
}

interface IntegratedFilterPanelProps {
  filters: EnhancedBookingFilters;
  onChange: (filters: EnhancedBookingFilters) => void;
  onReset: () => void;
}

interface DateRangeInputs {
  startDate: string;
  endDate: string;
  flexible: boolean;
}

interface PriceRangeInputs {
  min: string;
  max: string;
}

interface LocationInputs {
  city: string;
  country: string;
  radius: string;
}

// Sub-components for swap filters
interface SwapAvailabilityToggleProps {
  checked?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

const SwapAvailabilityToggle: React.FC<SwapAvailabilityToggleProps> = ({
  checked = false,
  onChange,
  label,
}) => {
  const { getInteractiveStyles } = useSwapHighContrast();

  return (
    <label
      style={getInteractiveStyles({
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
        cursor: 'pointer',
        padding: tokens.spacing[2],
        borderRadius: tokens.borderRadius.md,
        backgroundColor: checked ? tokens.colors.primary[50] : 'transparent',
        border: `1px solid ${checked ? tokens.colors.primary[200] : tokens.colors.neutral[200]}`,
        transition: 'all 0.2s ease',
      })}
      onMouseEnter={e => {
        if (!checked) {
          e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
        }
      }}
      onMouseLeave={e => {
        if (!checked) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ margin: 0 }}
        aria-describedby="swap-available-help"
      />
      <span
        style={{
          fontSize: tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.medium,
          color: tokens.colors.neutral[700],
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: '16px', marginLeft: 'auto' }} aria-hidden="true">🔄</span>
      <div id="swap-available-help" className="sr-only">
        Filter to show only bookings that are available for swapping
      </div>
    </label>
  );
};

interface CashAcceptanceToggleProps {
  checked?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

const CashAcceptanceToggle: React.FC<CashAcceptanceToggleProps> = ({
  checked = false,
  onChange,
  label,
}) => {
  const { getInteractiveStyles } = useSwapHighContrast();

  return (
    <label
      style={getInteractiveStyles({
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
        cursor: 'pointer',
        padding: tokens.spacing[2],
        borderRadius: tokens.borderRadius.md,
        backgroundColor: checked ? tokens.colors.success[50] : 'transparent',
        border: `1px solid ${checked ? tokens.colors.success[200] : tokens.colors.neutral[200]}`,
        transition: 'all 0.2s ease',
      })}
      onMouseEnter={e => {
        if (!checked) {
          e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
        }
      }}
      onMouseLeave={e => {
        if (!checked) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ margin: 0 }}
        aria-describedby="cash-acceptance-help"
      />
      <span
        style={{
          fontSize: tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.medium,
          color: tokens.colors.neutral[700],
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: '16px', marginLeft: 'auto' }} aria-hidden="true">💰</span>
      <div id="cash-acceptance-help" className="sr-only">
        Filter to show only bookings that accept cash offers for swaps
      </div>
    </label>
  );
};

interface AuctionModeToggleProps {
  checked?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

const AuctionModeToggle: React.FC<AuctionModeToggleProps> = ({
  checked = false,
  onChange,
  label,
}) => {
  const { getInteractiveStyles } = useSwapHighContrast();

  return (
    <label
      style={getInteractiveStyles({
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
        cursor: 'pointer',
        padding: tokens.spacing[2],
        borderRadius: tokens.borderRadius.md,
        backgroundColor: checked ? tokens.colors.warning[50] : 'transparent',
        border: `1px solid ${checked ? tokens.colors.warning[200] : tokens.colors.neutral[200]}`,
        transition: 'all 0.2s ease',
      })}
      onMouseEnter={e => {
        if (!checked) {
          e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
        }
      }}
      onMouseLeave={e => {
        if (!checked) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ margin: 0 }}
        aria-describedby="auction-mode-help"
      />
      <span
        style={{
          fontSize: tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.medium,
          color: tokens.colors.neutral[700],
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: '16px', marginLeft: 'auto' }} aria-hidden="true">⏰</span>
      <div id="auction-mode-help" className="sr-only">
        Filter to show only bookings with active auction-mode swaps
      </div>
    </label>
  );
};

// Filter Summary Component
interface FilterSummaryProps {
  filters: EnhancedBookingFilters;
}

const FilterSummary: React.FC<FilterSummaryProps> = ({ filters }) => {
  const activeFilters: string[] = [];

  // Count booking filters
  if (filters.type?.length) {
    activeFilters.push(`${filters.type.length} type${filters.type.length > 1 ? 's' : ''}`);
  }
  if (filters.status?.length) {
    activeFilters.push(`${filters.status.length} status${filters.status.length > 1 ? 'es' : ''}`);
  }
  if (filters.location) {
    activeFilters.push('location');
  }
  if (filters.dateRange) {
    activeFilters.push('dates');
  }
  if (filters.priceRange) {
    activeFilters.push('price range');
  }
  if (filters.verificationStatus?.length) {
    activeFilters.push('verification');
  }

  // Count swap filters
  if (filters.swapAvailable) {
    activeFilters.push('swap available');
  }
  if (filters.acceptsCash) {
    activeFilters.push('accepts cash');
  }
  if (filters.auctionMode) {
    activeFilters.push('auction mode');
  }

  if (activeFilters.length === 0) {
    return (
      <div
        style={{
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.neutral[500],
          fontStyle: 'italic',
        }}
      >
        No filters applied
      </div>
    );
  }

  return (
    <div
      style={{
        fontSize: tokens.typography.fontSize.sm,
        color: tokens.colors.neutral[600],
      }}
    >
      <strong>{activeFilters.length}</strong> filter{activeFilters.length > 1 ? 's' : ''} active:
      <div
        style={{
          marginTop: tokens.spacing[1],
          display: 'flex',
          flexWrap: 'wrap',
          gap: tokens.spacing[1],
        }}
      >
        {activeFilters.map((filter, index) => (
          <span
            key={index}
            style={{
              backgroundColor: tokens.colors.primary[100],
              color: tokens.colors.primary[700],
              padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
              borderRadius: tokens.borderRadius.sm,
              fontSize: tokens.typography.fontSize.xs,
              fontWeight: tokens.typography.fontWeight.medium,
            }}
          >
            {filter}
          </span>
        ))}
      </div>
    </div>
  );
};

export const IntegratedFilterPanel: React.FC<IntegratedFilterPanelProps> = ({
  filters,
  onChange,
  onReset,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['type', 'location', 'swap'])
  );

  // Accessibility hooks for swap filters
  const swapFilters = [
    { id: 'swapAvailable', label: 'Available for swapping', enabled: !!filters.swapAvailable },
    { id: 'acceptsCash', label: 'Accepts cash offers', enabled: !!filters.acceptsCash },
    { id: 'auctionMode', label: 'Auction mode active', enabled: !!filters.auctionMode },
  ];

  const { getGroupProps, getFilterProps } = useSwapFilterAccessibility(
    swapFilters,
    (filterId) => {
      if (filterId === 'swapAvailable') handleSwapAvailableChange(!filters.swapAvailable);
      if (filterId === 'acceptsCash') handleAcceptsCashChange(!filters.acceptsCash);
      if (filterId === 'auctionMode') handleAuctionModeChange(!filters.auctionMode);
    },
    0 // We'll need to pass actual result count from parent
  );

  const { getInteractiveStyles } = useSwapHighContrast();
  const [dateInputs, setDateInputs] = useState<DateRangeInputs>({
    startDate: filters.dateRange?.start
      ? filters.dateRange.start.toISOString().split('T')[0]
      : '',
    endDate: filters.dateRange?.end
      ? filters.dateRange.end.toISOString().split('T')[0]
      : '',
    flexible: filters.dateRange?.flexible || false,
  });
  const [priceInputs, setPriceInputs] = useState<PriceRangeInputs>({
    min: filters.priceRange?.min?.toString() || '',
    max: filters.priceRange?.max?.toString() || '',
  });
  const [locationInputs, setLocationInputs] = useState<LocationInputs>({
    city: filters.location?.city || '',
    country: filters.location?.country || '',
    radius: filters.location?.radius?.toString() || '',
  });

  // Get booking types from centralized configuration
  const bookingTypes = getBookingTypeOptions();

  const bookingStatuses: {
    value: BookingStatus;
    label: string;
    color: string;
  }[] = [
      {
        value: 'available',
        label: 'Available',
        color: tokens.colors.success[500],
      },
      { value: 'locked', label: 'Locked', color: tokens.colors.warning[500] },
      { value: 'swapped', label: 'Swapped', color: tokens.colors.neutral[500] },
      { value: 'cancelled', label: 'Cancelled', color: tokens.colors.error[500] },
    ];

  const verificationStatuses = [
    { value: 'verified', label: 'Verified', icon: '✓' },
    { value: 'pending', label: 'Pending', icon: '⏳' },
    { value: 'failed', label: 'Failed', icon: '✗' },
  ];

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  const handleTypeChange = useCallback(
    (type: BookingType, checked: boolean) => {
      const currentTypes = filters.type || [];
      const newTypes = checked
        ? [...currentTypes, type]
        : currentTypes.filter(t => t !== type);

      onChange({
        ...filters,
        type: newTypes.length > 0 ? newTypes : undefined,
      });
    },
    [filters, onChange]
  );

  const handleStatusChange = useCallback(
    (status: BookingStatus, checked: boolean) => {
      const currentStatuses = filters.status || [];
      const newStatuses = checked
        ? [...currentStatuses, status]
        : currentStatuses.filter(s => s !== status);

      onChange({
        ...filters,
        status: newStatuses.length > 0 ? newStatuses : undefined,
      });
    },
    [filters, onChange]
  );

  const handleVerificationStatusChange = useCallback(
    (status: 'pending' | 'verified' | 'failed', checked: boolean) => {
      const currentStatuses = filters.verificationStatus || [];
      const newStatuses = checked
        ? [...currentStatuses, status]
        : currentStatuses.filter(s => s !== status);

      onChange({
        ...filters,
        verificationStatus: newStatuses.length > 0 ? newStatuses : undefined,
      });
    },
    [filters, onChange]
  );

  // Swap filter handlers
  const handleSwapAvailableChange = useCallback(
    (checked: boolean) => {
      onChange({
        ...filters,
        swapAvailable: checked || undefined,
      });
    },
    [filters, onChange]
  );

  const handleAcceptsCashChange = useCallback(
    (checked: boolean) => {
      onChange({
        ...filters,
        acceptsCash: checked || undefined,
      });
    },
    [filters, onChange]
  );

  const handleAuctionModeChange = useCallback(
    (checked: boolean) => {
      onChange({
        ...filters,
        auctionMode: checked || undefined,
      });
    },
    [filters, onChange]
  );

  const handleDateRangeChange = useCallback(() => {
    const { startDate, endDate, flexible } = dateInputs;

    if (startDate && endDate) {
      onChange({
        ...filters,
        dateRange: {
          start: new Date(startDate),
          end: new Date(endDate),
          flexible,
        },
      });
    } else {
      const { dateRange, ...filtersWithoutDate } = filters;
      onChange(filtersWithoutDate);
    }
  }, [dateInputs, filters, onChange]);

  const handlePriceRangeChange = useCallback(() => {
    const { min, max } = priceInputs;
    const minNum = min ? parseFloat(min) : undefined;
    const maxNum = max ? parseFloat(max) : undefined;

    if (minNum !== undefined || maxNum !== undefined) {
      onChange({
        ...filters,
        priceRange: {
          min: minNum,
          max: maxNum,
        },
      });
    } else {
      const { priceRange, ...filtersWithoutPrice } = filters;
      onChange(filtersWithoutPrice);
    }
  }, [priceInputs, filters, onChange]);

  const handleLocationChange = useCallback(() => {
    const { city, country, radius } = locationInputs;
    const radiusNum = radius ? parseFloat(radius) : undefined;

    if (city || country || radiusNum) {
      onChange({
        ...filters,
        location: {
          city: city || undefined,
          country: country || undefined,
          radius: radiusNum,
        },
      });
    } else {
      const { location, ...filtersWithoutLocation } = filters;
      onChange(filtersWithoutLocation);
    }
  }, [locationInputs, filters, onChange]);

  // Apply date changes when inputs change
  React.useEffect(() => {
    handleDateRangeChange();
  }, [dateInputs]);

  // Apply price changes when inputs change
  React.useEffect(() => {
    handlePriceRangeChange();
  }, [priceInputs]);

  // Apply location changes when inputs change
  React.useEffect(() => {
    handleLocationChange();
  }, [locationInputs]);

  const containerStyles = {
    backgroundColor: tokens.colors.neutral[50],
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing[6],
  };

  const sectionStyles = {
    marginBottom: tokens.spacing[6],
  };

  const sectionHeaderStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${tokens.spacing[3]} 0`,
    cursor: 'pointer',
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
    marginBottom: tokens.spacing[4],
  };

  const sectionTitleStyles = {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  const sectionContentStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[4],
  };

  const checkboxGroupStyles = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: tokens.spacing[3],
  };

  const checkboxItemStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
    padding: tokens.spacing[2],
    borderRadius: tokens.borderRadius.md,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  };

  const inputGroupStyles = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacing[3],
  };

  const flexInputGroupStyles = {
    display: 'flex',
    gap: tokens.spacing[3],
    alignItems: 'end',
  };

  const swapFilterGroupStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[3],
  };

  const activeFiltersCount = [
    filters.type?.length || 0,
    filters.status?.length || 0,
    filters.verificationStatus?.length || 0,
    filters.dateRange ? 1 : 0,
    filters.priceRange ? 1 : 0,
    filters.location ? 1 : 0,
    filters.swapAvailable ? 1 : 0,
    filters.acceptsCash ? 1 : 0,
    filters.auctionMode ? 1 : 0,
  ].reduce((sum, count) => sum + count, 0);

  return (
    <div style={containerStyles}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.spacing[6],
        }}
      >
        <h3
          style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
            margin: 0,
          }}
        >
          Filter Bookings
          {activeFiltersCount > 0 && (
            <span
              style={{
                marginLeft: tokens.spacing[2],
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.normal,
                color: tokens.colors.primary[600],
                backgroundColor: tokens.colors.primary[100],
                padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                borderRadius: tokens.borderRadius.full,
              }}
            >
              {activeFiltersCount} active
            </span>
          )}
        </h3>

        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={activeFiltersCount === 0}
        >
          Reset All
        </Button>
      </div>

      {/* Swap Filters Section - New */}
      <div style={sectionStyles}>
        <div
          style={getInteractiveStyles(sectionHeaderStyles)}
          onClick={() => toggleSection('swap')}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('swap');
            }
          }}
          aria-expanded={expandedSections.has('swap')}
          aria-controls="swap-filters-content"
        >
          <h4 style={sectionTitleStyles} id="swap-filters-heading">Swap Filters</h4>
          <span style={{ color: tokens.colors.neutral[500] }} aria-hidden="true">
            {expandedSections.has('swap') ? '▲' : '▼'}
          </span>
        </div>

        {expandedSections.has('swap') && (
          <div
            style={sectionContentStyles}
            id="swap-filters-content"
            aria-labelledby="swap-filters-heading"
          >
            <div style={swapFilterGroupStyles} {...getGroupProps()}>
              <SwapAvailabilityToggle
                checked={filters.swapAvailable}
                onChange={handleSwapAvailableChange}
                label="Available for swapping"
              />
              <CashAcceptanceToggle
                checked={filters.acceptsCash}
                onChange={handleAcceptsCashChange}
                label="Accepts cash offers"
              />
              <AuctionModeToggle
                checked={filters.auctionMode}
                onChange={handleAuctionModeChange}
                label="Auction mode active"
              />
            </div>
          </div>
        )}
      </div>

      {/* Booking Type Filter */}
      <div style={sectionStyles}>
        <div
          style={sectionHeaderStyles}
          onClick={() => toggleSection('type')}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('type');
            }
          }}
        >
          <h4 style={sectionTitleStyles}>Booking Type</h4>
          <span style={{ color: tokens.colors.neutral[500] }}>
            {expandedSections.has('type') ? '▲' : '▼'}
          </span>
        </div>

        {expandedSections.has('type') && (
          <div style={sectionContentStyles}>
            <div style={checkboxGroupStyles}>
              {bookingTypes.map(({ value, label, icon }) => (
                <label
                  key={value}
                  style={{
                    ...checkboxItemStyles,
                    backgroundColor: filters.type?.includes(value)
                      ? tokens.colors.primary[50]
                      : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (!filters.type?.includes(value)) {
                      e.currentTarget.style.backgroundColor =
                        tokens.colors.neutral[100];
                    }
                  }}
                  onMouseLeave={e => {
                    if (!filters.type?.includes(value)) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filters.type?.includes(value) || false}
                    onChange={e => handleTypeChange(value, e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  <span style={{ fontSize: '18px' }}>{icon}</span>
                  <span
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.medium,
                      color: tokens.colors.neutral[700],
                    }}
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Location Filter */}
      <div style={sectionStyles}>
        <div
          style={sectionHeaderStyles}
          onClick={() => toggleSection('location')}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('location');
            }
          }}
        >
          <h4 style={sectionTitleStyles}>Location</h4>
          <span style={{ color: tokens.colors.neutral[500] }}>
            {expandedSections.has('location') ? '▲' : '▼'}
          </span>
        </div>

        {expandedSections.has('location') && (
          <div style={sectionContentStyles}>
            <div style={inputGroupStyles}>
              <Input
                label="City"
                placeholder="e.g., New York"
                value={locationInputs.city}
                onChange={e =>
                  setLocationInputs(prev => ({ ...prev, city: e.target.value }))
                }
                leftIcon={<span>🏙️</span>}
              />
              <Input
                label="Country"
                placeholder="e.g., United States"
                value={locationInputs.country}
                onChange={e =>
                  setLocationInputs(prev => ({
                    ...prev,
                    country: e.target.value,
                  }))
                }
                leftIcon={<span>🌍</span>}
              />
            </div>
            <div style={{ maxWidth: '200px' }}>
              <Input
                label="Search Radius (km)"
                type="number"
                placeholder="50"
                value={locationInputs.radius}
                onChange={e =>
                  setLocationInputs(prev => ({
                    ...prev,
                    radius: e.target.value,
                  }))
                }
                leftIcon={<span>📍</span>}
                helperText="Leave empty for exact location match"
              />
            </div>
          </div>
        )}
      </div>

      {/* Date Range Filter */}
      <div style={sectionStyles}>
        <div
          style={sectionHeaderStyles}
          onClick={() => toggleSection('dates')}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('dates');
            }
          }}
        >
          <h4 style={sectionTitleStyles}>Date Range</h4>
          <span style={{ color: tokens.colors.neutral[500] }}>
            {expandedSections.has('dates') ? '▲' : '▼'}
          </span>
        </div>

        {expandedSections.has('dates') && (
          <div style={sectionContentStyles}>
            <div style={inputGroupStyles}>
              <Input
                label="Check-in Date"
                type="date"
                value={dateInputs.startDate}
                onChange={e =>
                  setDateInputs(prev => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                min={new Date().toISOString().split('T')[0]}
              />
              <Input
                label="Check-out Date"
                type="date"
                value={dateInputs.endDate}
                onChange={e =>
                  setDateInputs(prev => ({ ...prev, endDate: e.target.value }))
                }
                min={
                  dateInputs.startDate || new Date().toISOString().split('T')[0]
                }
              />
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={dateInputs.flexible}
                onChange={e =>
                  setDateInputs(prev => ({
                    ...prev,
                    flexible: e.target.checked,
                  }))
                }
              />
              <span
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[700],
                }}
              >
                Flexible dates (allow overlapping bookings)
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Price Range Filter */}
      <div style={sectionStyles}>
        <div
          style={sectionHeaderStyles}
          onClick={() => toggleSection('price')}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('price');
            }
          }}
        >
          <h4 style={sectionTitleStyles}>Price Range</h4>
          <span style={{ color: tokens.colors.neutral[500] }}>
            {expandedSections.has('price') ? '▲' : '▼'}
          </span>
        </div>

        {expandedSections.has('price') && (
          <div style={sectionContentStyles}>
            <div style={flexInputGroupStyles}>
              <Input
                label="Min Price ($)"
                type="number"
                placeholder="0"
                value={priceInputs.min}
                onChange={e =>
                  setPriceInputs(prev => ({ ...prev, min: e.target.value }))
                }
                leftIcon={<span>💰</span>}
                min="0"
                step="10"
              />
              <span
                style={{
                  padding: `0 ${tokens.spacing[2]}`,
                  color: tokens.colors.neutral[500],
                  alignSelf: 'center',
                }}
              >
                to
              </span>
              <Input
                label="Max Price ($)"
                type="number"
                placeholder="10000"
                value={priceInputs.max}
                onChange={e =>
                  setPriceInputs(prev => ({ ...prev, max: e.target.value }))
                }
                leftIcon={<span>💰</span>}
                min={priceInputs.min || '0'}
                step="10"
              />
            </div>
          </div>
        )}
      </div>

      {/* Status Filter */}
      <div style={sectionStyles}>
        <div
          style={sectionHeaderStyles}
          onClick={() => toggleSection('status')}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('status');
            }
          }}
        >
          <h4 style={sectionTitleStyles}>Booking Status</h4>
          <span style={{ color: tokens.colors.neutral[500] }}>
            {expandedSections.has('status') ? '▲' : '▼'}
          </span>
        </div>

        {expandedSections.has('status') && (
          <div style={sectionContentStyles}>
            <div style={checkboxGroupStyles}>
              {bookingStatuses.map(({ value, label, color }) => (
                <label
                  key={value}
                  style={{
                    ...checkboxItemStyles,
                    backgroundColor: filters.status?.includes(value)
                      ? `${color}20`
                      : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (!filters.status?.includes(value)) {
                      e.currentTarget.style.backgroundColor =
                        tokens.colors.neutral[100];
                    }
                  }}
                  onMouseLeave={e => {
                    if (!filters.status?.includes(value)) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filters.status?.includes(value) || false}
                    onChange={e => handleStatusChange(value, e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: color,
                    }}
                  />
                  <span
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.medium,
                      color: tokens.colors.neutral[700],
                    }}
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Verification Status Filter */}
      <div style={sectionStyles}>
        <div
          style={sectionHeaderStyles}
          onClick={() => toggleSection('verification')}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('verification');
            }
          }}
        >
          <h4 style={sectionTitleStyles}>Verification Status</h4>
          <span style={{ color: tokens.colors.neutral[500] }}>
            {expandedSections.has('verification') ? '▲' : '▼'}
          </span>
        </div>

        {expandedSections.has('verification') && (
          <div style={sectionContentStyles}>
            <div style={checkboxGroupStyles}>
              {verificationStatuses.map(({ value, label, icon }) => (
                <label
                  key={value}
                  style={{
                    ...checkboxItemStyles,
                    backgroundColor: filters.verificationStatus?.includes(
                      value as any
                    )
                      ? tokens.colors.primary[50]
                      : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (!filters.verificationStatus?.includes(value as any)) {
                      e.currentTarget.style.backgroundColor =
                        tokens.colors.neutral[100];
                    }
                  }}
                  onMouseLeave={e => {
                    if (!filters.verificationStatus?.includes(value as any)) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      filters.verificationStatus?.includes(value as any) ||
                      false
                    }
                    onChange={e =>
                      handleVerificationStatusChange(
                        value as any,
                        e.target.checked
                      )
                    }
                    style={{ margin: 0 }}
                  />
                  <span style={{ fontSize: '16px' }}>{icon}</span>
                  <span
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.medium,
                      color: tokens.colors.neutral[700],
                    }}
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter Summary */}
      <div
        style={{
          marginTop: tokens.spacing[6],
          padding: tokens.spacing[4],
          backgroundColor: tokens.colors.neutral[100],
          borderRadius: tokens.borderRadius.md,
          border: `1px solid ${tokens.colors.neutral[200]}`,
        }}
      >
        <FilterSummary filters={filters} />
      </div>
    </div>
  );
};