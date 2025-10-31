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
import { SwapFilters } from '@/services/SwapFilterService';

interface FilterPanelProps {
  filters: BookingFilters | Partial<SwapFilters>;
  onChange: (filters: BookingFilters | Partial<SwapFilters>) => void;
  onReset: () => void;
  mode?: 'booking' | 'swap'; // New prop to determine which filters to show
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

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onChange,
  onReset,
  mode = 'booking',
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['type', 'location'])
  );
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

  const swapFilters = filters as Partial<SwapFilters>;

  const handleSwapTypeChange = useCallback(
    (swapType: 'booking' | 'cash' | 'both') => {
      if (mode === 'swap') {
        onChange({
          ...swapFilters,
          swapType,
        });
      }
    },
    [swapFilters, onChange, mode]
  );

  const activeFiltersCount = [
    filters.type?.length || 0,
    filters.status?.length || 0,
    filters.verificationStatus?.length || 0,
    filters.dateRange ? 1 : 0,
    filters.priceRange ? 1 : 0,
    filters.location ? 1 : 0,
    mode === 'swap' && swapFilters.swapType && swapFilters.swapType !== 'both' ? 1 : 0,
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
          {mode === 'swap' ? 'Filter Swaps' : 'Filter Bookings'}
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

      {/* Swap Type Filter - Only show in swap mode */}
      {mode === 'swap' && (
        <div style={sectionStyles}>
          <div
            style={sectionHeaderStyles}
            onClick={() => toggleSection('swapType')}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSection('swapType');
              }
            }}
          >
            <h4 style={sectionTitleStyles}>Swap Type</h4>
            <span style={{ color: tokens.colors.neutral[500] }}>
              {expandedSections.has('swapType') ? '▲' : '▼'}
            </span>
          </div>

          {expandedSections.has('swapType') && (
            <div style={sectionContentStyles}>
              <div style={checkboxGroupStyles}>
                {[
                  { value: 'both', label: 'All Swaps', icon: '🔄' },
                  { value: 'booking', label: 'Booking Swaps', icon: '🏨' },
                  { value: 'cash', label: 'Cash Sales', icon: '💰' },
                ].map(({ value, label, icon }) => (
                  <label
                    key={value}
                    style={{
                      ...checkboxItemStyles,
                      backgroundColor: swapFilters.swapType === value
                        ? tokens.colors.primary[50]
                        : 'transparent',
                    }}
                    onMouseEnter={e => {
                      if (swapFilters.swapType !== value) {
                        e.currentTarget.style.backgroundColor =
                          tokens.colors.neutral[100];
                      }
                    }}
                    onMouseLeave={e => {
                      if (swapFilters.swapType !== value) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <input
                      type="radio"
                      name="swapType"
                      checked={swapFilters.swapType === value || (value === 'both' && !swapFilters.swapType)}
                      onChange={() => handleSwapTypeChange(value as 'booking' | 'cash' | 'both')}
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
      )}

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
    </div>
  );
};
