import React, { useState, useRef, useEffect } from 'react';
import { tokens } from '@/design-system/tokens';
import { useResponsive } from '@/hooks/useResponsive';
import { Button } from '@/components/ui/Button';
import { EnhancedBookingFilters } from '@booking-swap/shared';
import { FinancialDataHandler } from '../../utils/financialDataHandler';

interface MobileFilterInterfaceProps {
  filters: EnhancedBookingFilters;
  onChange: (filters: EnhancedBookingFilters) => void;
  onReset: () => void;
  onClose: () => void;
  isOpen: boolean;
  resultCount?: number;
}

// Mobile filter bottom sheet component
const MobileFilterBottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}> = ({ isOpen, onClose, children, title }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
      document.body.style.paddingBottom = 'env(safe-area-inset-bottom)';
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingBottom = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingBottom = '';
    };
  }, [isOpen]);

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    transition: 'opacity 0.3s ease-in-out, visibility 0.3s ease-in-out',
  };

  const sheetStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.colors.white,
    borderTopLeftRadius: tokens.borderRadius['2xl'],
    borderTopRightRadius: tokens.borderRadius['2xl'],
    maxHeight: '90vh',
    transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 'env(safe-area-inset-bottom)',
  };

  const handleStyles: React.CSSProperties = {
    width: '40px',
    height: '4px',
    backgroundColor: tokens.colors.neutral[300],
    borderRadius: tokens.borderRadius.full,
    margin: `${tokens.spacing[3]} auto ${tokens.spacing[2]}`,
    cursor: 'grab',
  };

  const headerStyles: React.CSSProperties = {
    padding: `0 ${tokens.spacing[6]} ${tokens.spacing[4]}`,
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
    backgroundColor: tokens.colors.white,
    borderTopLeftRadius: tokens.borderRadius['2xl'],
    borderTopRightRadius: tokens.borderRadius['2xl'],
  };

  const titleStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    margin: 0,
    textAlign: 'center',
  };

  const contentStyles: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    backgroundColor: tokens.colors.white,
    WebkitOverflowScrolling: 'touch',
  };

  if (!isOpen) return null;

  return (
    <div style={overlayStyles} onClick={onClose}>
      <div
        ref={sheetRef}
        style={sheetStyles}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={handleStyles} />
        <div style={headerStyles}>
          <h3 style={titleStyles}>{title}</h3>
        </div>
        <div style={contentStyles}>
          {children}
        </div>
      </div>
    </div>
  );
};

// Mobile filter toggle component
const MobileFilterToggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  icon?: string;
}> = ({ label, checked, onChange, description, icon }) => {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacing[4]} ${tokens.spacing[6]}`,
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
    minHeight: '64px',
    cursor: 'pointer',
  };

  const contentStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[3],
    flex: 1,
  };

  const textStyles: React.CSSProperties = {
    flex: 1,
  };

  const labelStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: description ? tokens.spacing[1] : 0,
  };

  const descriptionStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
  };

  const switchStyles: React.CSSProperties = {
    position: 'relative',
    width: '52px',
    height: '28px',
    backgroundColor: checked ? tokens.colors.primary[500] : tokens.colors.neutral[300],
    borderRadius: tokens.borderRadius.full,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease-in-out',
  };

  const switchKnobStyles: React.CSSProperties = {
    position: 'absolute',
    top: '2px',
    left: checked ? '26px' : '2px',
    width: '24px',
    height: '24px',
    backgroundColor: tokens.colors.white,
    borderRadius: '50%',
    transition: 'left 0.2s ease-in-out',
    boxShadow: tokens.shadows.sm,
  };

  return (
    <div style={containerStyles} onClick={() => onChange(!checked)}>
      <div style={contentStyles}>
        {icon && (
          <span style={{ fontSize: tokens.typography.fontSize.xl }}>{icon}</span>
        )}
        <div style={textStyles}>
          <div style={labelStyles}>{label}</div>
          {description && <div style={descriptionStyles}>{description}</div>}
        </div>
      </div>
      <div style={switchStyles}>
        <div style={switchKnobStyles} />
      </div>
    </div>
  );
};

// Mobile filter section component
const MobileFilterSection: React.FC<{
  title: string;
  children: React.ReactNode;
  icon?: string;
}> = ({ title, children, icon }) => {
  const headerStyles: React.CSSProperties = {
    padding: `${tokens.spacing[4]} ${tokens.spacing[6]} ${tokens.spacing[3]}`,
    backgroundColor: tokens.colors.neutral[50],
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
  };

  const titleStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  return (
    <div>
      <div style={headerStyles}>
        {icon && (
          <span style={{ fontSize: tokens.typography.fontSize.lg }}>{icon}</span>
        )}
        <h4 style={titleStyles}>{title}</h4>
      </div>
      {children}
    </div>
  );
};

// Mobile range selector component
const MobileRangeSelector: React.FC<{
  label: string;
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  formatValue?: (value: number) => string;
  step?: number;
}> = ({ label, min, max, value, onChange, formatValue = (v) => v.toString(), step = 1 }) => {
  const containerStyles: React.CSSProperties = {
    padding: `${tokens.spacing[4]} ${tokens.spacing[6]}`,
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const labelStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[3],
    display: 'block',
  };

  const valuesStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing[4],
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
  };

  const rangeContainerStyles: React.CSSProperties = {
    position: 'relative',
    height: '20px',
  };

  const rangeStyles: React.CSSProperties = {
    width: '100%',
    height: '4px',
    borderRadius: tokens.borderRadius.full,
    backgroundColor: tokens.colors.neutral[200],
    outline: 'none',
    appearance: 'none',
    position: 'absolute',
    top: '8px',
  };

  return (
    <div style={containerStyles}>
      <label style={labelStyles}>{label}</label>
      <div style={valuesStyles}>
        <span>{formatValue(value[0])}</span>
        <span>{formatValue(value[1])}</span>
      </div>
      <div style={rangeContainerStyles}>
        <input
          type="range"
          min={min}
          max={max}
          value={value[0]}
          step={step}
          onChange={(e) => onChange([parseInt(e.target.value), value[1]])}
          style={rangeStyles}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value[1]}
          step={step}
          onChange={(e) => onChange([value[0], parseInt(e.target.value)])}
          style={rangeStyles}
        />
      </div>
    </div>
  );
};

// Main mobile filter interface component
export const MobileFilterInterface: React.FC<MobileFilterInterfaceProps> = ({
  filters,
  onChange,
  onReset,
  onClose,
  isOpen,
  resultCount,
}) => {
  const { isMobile } = useResponsive();
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Count active filters
  useEffect(() => {
    let count = 0;
    if (filters.swapAvailable) count++;
    if (filters.acceptsCash) count++;
    if (filters.auctionMode) count++;
    if (filters.type && filters.type.length > 0) count++;
    if (filters.priceRange && (filters.priceRange.min > 0 || filters.priceRange.max < 10000)) count++;
    if (filters.location && filters.location.city) count++;
    setActiveFiltersCount(count);
  }, [filters]);

  const handleFilterChange = (key: keyof EnhancedBookingFilters, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const formatPrice = (price: any) => FinancialDataHandler.formatCurrency(price, 'USD');

  if (!isMobile) {
    return null; // Use regular filter panel on desktop
  }

  return (
    <MobileFilterBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Bookings"
    >
      <div style={{ paddingBottom: tokens.spacing[6] }}>
        {/* Swap Filters Section */}
        <MobileFilterSection title="Swap Options" icon="🔄">
          <MobileFilterToggle
            label="Available for Swap"
            description="Show only bookings open to swapping"
            checked={filters.swapAvailable || false}
            onChange={(checked) => handleFilterChange('swapAvailable', checked)}
            icon="💫"
          />
          <MobileFilterToggle
            label="Accepts Cash"
            description="Show bookings that accept cash offers"
            checked={filters.acceptsCash || false}
            onChange={(checked) => handleFilterChange('acceptsCash', checked)}
            icon="💰"
          />
          <MobileFilterToggle
            label="Auction Mode"
            description="Show active auction bookings"
            checked={filters.auctionMode || false}
            onChange={(checked) => handleFilterChange('auctionMode', checked)}
            icon="🏆"
          />
        </MobileFilterSection>

        {/* Booking Type Section */}
        <MobileFilterSection title="Booking Type" icon="📋">
          <div style={{ padding: `${tokens.spacing[2]} ${tokens.spacing[6]}` }}>
            {['hotel', 'event', 'flight', 'rental'].map((type) => (
              <MobileFilterToggle
                key={type}
                label={type.charAt(0).toUpperCase() + type.slice(1)}
                checked={filters.type?.includes(type) || false}
                onChange={(checked) => {
                  const currentTypes = filters.type || [];
                  const newTypes = checked
                    ? [...currentTypes, type]
                    : currentTypes.filter(t => t !== type);
                  handleFilterChange('type', newTypes);
                }}
                icon={type === 'hotel' ? '🏨' : type === 'event' ? '🎫' : type === 'flight' ? '✈️' : '🏠'}
              />
            ))}
          </div>
        </MobileFilterSection>

        {/* Price Range Section */}
        <MobileFilterSection title="Price Range" icon="💵">
          <MobileRangeSelector
            label="Price Range"
            min={0}
            max={10000}
            value={[filters.priceRange?.min || 0, filters.priceRange?.max || 10000]}
            onChange={([min, max]) => handleFilterChange('priceRange', { min, max })}
            formatValue={formatPrice}
            step={100}
          />
        </MobileFilterSection>

        {/* Location Section */}
        <MobileFilterSection title="Location" icon="📍">
          <div style={{ padding: `${tokens.spacing[4]} ${tokens.spacing[6]}` }}>
            <input
              type="text"
              placeholder="Enter city or country..."
              value={filters.location?.city || ''}
              onChange={(e) => handleFilterChange('location', {
                ...filters.location,
                city: e.target.value
              })}
              style={{
                width: '100%',
                padding: tokens.spacing[4],
                borderRadius: tokens.borderRadius.lg,
                border: `2px solid ${tokens.colors.neutral[300]}`,
                fontSize: tokens.typography.fontSize.base,
                minHeight: '48px',
              }}
            />
          </div>
        </MobileFilterSection>
      </div>

      {/* Action buttons */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        padding: `${tokens.spacing[4]} ${tokens.spacing[6]}`,
        backgroundColor: tokens.colors.white,
        borderTop: `1px solid ${tokens.colors.neutral[200]}`,
        display: 'flex',
        gap: tokens.spacing[3],
      }}>
        <Button
          variant="secondary"
          onClick={onReset}
          style={{
            flex: 1,
            minHeight: '48px',
            fontSize: tokens.typography.fontSize.base,
          }}
        >
          Reset ({activeFiltersCount})
        </Button>
        <Button
          variant="primary"
          onClick={onClose}
          style={{
            flex: 2,
            minHeight: '48px',
            fontSize: tokens.typography.fontSize.base,
          }}
        >
          Show Results {resultCount !== undefined ? `(${resultCount})` : ''}
        </Button>
      </div>
    </MobileFilterBottomSheet>
  );
};