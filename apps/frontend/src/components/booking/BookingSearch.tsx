import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { tokens } from '@/design-system/tokens';
import { BookingType } from '@booking-swap/shared';
import {
  getBookingTypeOptions,
  EnabledBookingType
} from '@booking-swap/shared';

export interface SearchFilters {
  query: string;
  location: string;
  type: BookingType | 'all';
  minPrice: number;
  maxPrice: number;
  dateFrom: string;
  dateTo: string;
}

interface BookingSearchProps {
  onSearch: (filters: SearchFilters) => void;
  loading?: boolean;
}

// Get booking types from centralized configuration and add 'All Types' option
const BOOKING_TYPES: { value: BookingType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  ...getBookingTypeOptions().map(type => ({
    value: type.value as BookingType,
    label: type.label
  }))
];

export const BookingSearch: React.FC<BookingSearchProps> = ({
  onSearch,
  loading = false,
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    location: '',
    type: 'all',
    minPrice: 0,
    maxPrice: 10000,
    dateFrom: '',
    dateTo: '',
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleReset = () => {
    const resetFilters: SearchFilters = {
      query: '',
      location: '',
      type: 'all',
      minPrice: 0,
      maxPrice: 10000,
      dateFrom: '',
      dateTo: '',
    };
    setFilters(resetFilters);
    onSearch(resetFilters);
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const selectStyles = {
    width: '100%',
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    fontSize: tokens.typography.fontSize.base,
    border: `1px solid ${tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
    color: tokens.colors.neutral[900],
    outline: 'none',
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <form onSubmit={handleSearch}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.spacing[4],
            }}
          >
            {/* Main search row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr auto',
                gap: tokens.spacing[3],
                alignItems: 'end',
              }}
            >
              <Input
                label="Search bookings"
                id="search-query"
                value={filters.query}
                onChange={e => updateFilter('query', e.target.value)}
                placeholder="Search by title, description, or location..."
                leftIcon={<span>🔍</span>}
              />

              <Input
                label="Location"
                id="search-location"
                value={filters.location}
                onChange={e => updateFilter('location', e.target.value)}
                placeholder="City or country"
                leftIcon={<span>📍</span>}
              />

              <div>
                <label
                  htmlFor="search-type"
                  style={{
                    display: 'block',
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[700],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  Type
                </label>
                <select
                  id="search-type"
                  value={filters.type}
                  onChange={e =>
                    updateFilter('type', e.target.value as BookingType | 'all')
                  }
                  style={selectStyles}
                >
                  {BOOKING_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <Button type="submit" loading={loading}>
                Search
              </Button>
            </div>

            {/* Advanced filters toggle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? '▼' : '▶'} Advanced Filters
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
              >
                Reset Filters
              </Button>
            </div>

            {/* Advanced filters */}
            {showAdvanced && (
              <div
                style={{
                  padding: tokens.spacing[4],
                  backgroundColor: tokens.colors.neutral[50],
                  borderRadius: tokens.borderRadius.md,
                  border: `1px solid ${tokens.colors.neutral[200]}`,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: tokens.spacing[4],
                  }}
                >
                  <Input
                    label="Min Price ($)"
                    id="min-price"
                    type="number"
                    min="0"
                    step="10"
                    value={filters.minPrice}
                    onChange={e =>
                      updateFilter('minPrice', parseInt(e.target.value) || 0)
                    }
                    placeholder="0"
                  />

                  <Input
                    label="Max Price ($)"
                    id="max-price"
                    type="number"
                    min="0"
                    step="10"
                    value={filters.maxPrice}
                    onChange={e =>
                      updateFilter(
                        'maxPrice',
                        parseInt(e.target.value) || 10000
                      )
                    }
                    placeholder="10000"
                  />

                  <Input
                    label="Available From"
                    id="date-from"
                    type="date"
                    value={filters.dateFrom}
                    onChange={e => updateFilter('dateFrom', e.target.value)}
                  />

                  <Input
                    label="Available To"
                    id="date-to"
                    type="date"
                    value={filters.dateTo}
                    onChange={e => updateFilter('dateTo', e.target.value)}
                  />
                </div>

                <div
                  style={{
                    marginTop: tokens.spacing[4],
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[600],
                  }}
                >
                  <p style={{ margin: 0 }}>
                    <strong>Tips:</strong> Use advanced filters to narrow down
                    your search. Leave price fields empty to search all price
                    ranges.
                  </p>
                </div>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
