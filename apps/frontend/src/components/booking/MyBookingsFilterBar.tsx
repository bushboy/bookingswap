import React from 'react';
import { tokens } from '@/design-system/tokens';
import { BookingCounts } from '@/types/myBookings';
import { useResponsive, useTouch } from '@/hooks/useResponsive';
import { touchTargets } from '@/utils/responsive';

/**
 * Simple status-based filter type for personal booking management.
 * 
 * This replaces the complex EnhancedBookingFilters interface that was designed
 * for browsing other users' bookings. The simplified approach focuses on status
 * categories that are most relevant for personal booking management:
 * 
 * - 'all': Shows all user's bookings regardless of status
 * - 'active': Current and upcoming bookings without swap activity
 * - 'with_swaps': Bookings that have active swap proposals or pending activity
 * - 'completed': Bookings where swaps have been accepted/completed
 * - 'expired': Bookings where the event date has passed
 * 
 * @see Requirements 5.1, 5.2, 8.4 - Simplified filtering for personal booking management
 */
export type MyBookingsStatus = 'all' | 'active' | 'with_swaps' | 'completed' | 'expired';

/**
 * Props interface for the MyBookingsFilterBar component.
 * 
 * This interface defines the contract for the simplified filter bar that replaces
 * the complex IntegratedFilterPanel. The design focuses on personal booking
 * management rather than browsing functionality.
 * 
 * @interface MyBookingsFilterBarProps
 */
export interface MyBookingsFilterBarProps {
  /** Currently selected filter status */
  currentFilter: MyBookingsStatus;
  /** Count of bookings in each status category for badge display */
  bookingCounts: BookingCounts;
  /** Callback function called when user selects a different filter status */
  onChange: (status: MyBookingsStatus) => void;
}

/**
 * Internal interface defining the structure of each filter tab.
 * 
 * Each tab represents a booking status category with visual and accessibility
 * information for optimal user experience across devices.
 * 
 * @interface FilterTab
 * @internal
 */
interface FilterTab {
  /** The booking status this tab represents */
  status: MyBookingsStatus;
  /** Display label for the tab */
  label: string;
  /** Emoji icon for visual identification */
  icon: string;
  /** Accessible description for screen readers and tooltips */
  description: string;
}

/**
 * Configuration for filter tabs in the personal booking management interface.
 * 
 * This simplified approach replaces complex browse-style filtering with
 * status-based categories that are most relevant for managing personal bookings.
 * Each tab includes visual indicators and accessibility descriptions.
 * 
 * Design Rationale:
 * - Focuses on booking lifecycle stages (active → with_swaps → completed/expired)
 * - Uses intuitive icons and labels for quick visual identification
 * - Provides clear descriptions for accessibility and user guidance
 * - Optimized for personal management rather than discovery/browsing
 * 
 * @see Requirements 5.1, 5.3 - Simple status-based filtering for personal bookings
 */
const filterTabs: FilterTab[] = [
  {
    status: 'all',
    label: 'All',
    icon: '📋',
    description: 'All your bookings'
  },
  {
    status: 'active',
    label: 'Active',
    icon: '✅',
    description: 'Current and upcoming bookings'
  },
  {
    status: 'with_swaps',
    label: 'With Swaps',
    icon: '🔄',
    description: 'Bookings with active swap proposals'
  },
  {
    status: 'completed',
    label: 'Completed',
    icon: '✔️',
    description: 'Past bookings and completed swaps'
  },
  {
    status: 'expired',
    label: 'Expired',
    icon: '⏰',
    description: 'Expired or cancelled bookings'
  }
];

/**
 * MyBookingsFilterBar - Simplified filter interface for personal booking management.
 * 
 * This component replaces the complex IntegratedFilterPanel with a streamlined
 * status-based filtering approach specifically designed for managing personal
 * bookings rather than browsing other users' bookings.
 * 
 * Key Features:
 * - Simple status-based filtering (all, active, with_swaps, completed, expired)
 * - Mobile-optimized horizontal tab layout with touch-friendly interactions
 * - Real-time booking counts displayed as badges on each filter tab
 * - Accessible keyboard navigation and screen reader support
 * - Responsive design that adapts to mobile, tablet, and desktop viewports
 * 
 * Design Philosophy:
 * The component prioritizes clarity and simplicity over comprehensive filtering
 * options. Instead of complex search, location, and date filters suitable for
 * browsing, it focuses on the booking lifecycle stages most relevant to
 * personal booking management.
 * 
 * Mobile Optimizations:
 * - Touch-friendly minimum target sizes (44px minimum)
 * - Horizontal scrolling with scroll snap for easy navigation
 * - Simplified labels on small screens to prevent overflow
 * - Enhanced touch feedback and gesture support
 * - Prevents iOS zoom on input focus with 16px minimum font size
 * 
 * @param props - Component props
 * @returns JSX element representing the filter bar
 * 
 * @see Requirements 5.1, 5.2, 5.3, 5.6, 7.1, 7.2, 7.3, 7.4 - Personal booking filtering with mobile optimization
 * 
 * @example
 * ```tsx
 * <MyBookingsFilterBar
 *   currentFilter="active"
 *   bookingCounts={{ all: 10, active: 5, with_swaps: 2, completed: 2, expired: 1 }}
 *   onChange={(status) => setFilter(status)}
 * />
 * ```
 */
export const MyBookingsFilterBar: React.FC<MyBookingsFilterBarProps> = ({
  currentFilter,
  bookingCounts,
  onChange,
}) => {
  const { isMobile } = useResponsive();
  const isTouch = useTouch();

  // Mobile-optimized container styles
  const containerStyles = {
    backgroundColor: tokens.colors.neutral[50],
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.lg,
    padding: isMobile ? tokens.spacing[3] : tokens.spacing[4],
    marginBottom: tokens.spacing[6],
  };

  // Mobile-optimized header styles
  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isMobile ? tokens.spacing[3] : tokens.spacing[4],
    flexWrap: 'wrap' as const,
    gap: tokens.spacing[2],
  };

  // Mobile-optimized title styles
  const titleStyles = {
    fontSize: isMobile ? tokens.typography.fontSize.base : tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  // Mobile-optimized tab bar styles with enhanced scrolling
  const tabBarStyles: React.CSSProperties = {
    display: 'flex',
    gap: isMobile ? tokens.spacing[1] : tokens.spacing[2],
    overflowX: 'auto',
    paddingBottom: tokens.spacing[2],
    // Enhanced mobile scrolling
    WebkitOverflowScrolling: 'touch' as any,
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    // Add scroll snap for better mobile UX
    scrollSnapType: 'x mandatory',
  };

  // Mobile-optimized tab styles with touch-friendly sizing
  const getTabStyles = (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? tokens.spacing[1] : tokens.spacing[2],
    // Touch-friendly padding and sizing
    padding: isMobile 
      ? `${tokens.spacing[2]} ${tokens.spacing[3]}` 
      : `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    borderRadius: tokens.borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: isActive 
      ? tokens.colors.primary[100] 
      : tokens.colors.white,
    border: `1px solid ${isActive 
      ? tokens.colors.primary[300] 
      : tokens.colors.neutral[200]}`,
    color: isActive 
      ? tokens.colors.primary[700] 
      : tokens.colors.neutral[700],
    fontWeight: isActive 
      ? tokens.typography.fontWeight.semibold 
      : tokens.typography.fontWeight.medium,
    // Mobile-optimized font size (minimum 16px to prevent zoom on iOS)
    fontSize: isMobile ? '16px' : tokens.typography.fontSize.sm,
    whiteSpace: 'nowrap' as const,
    minWidth: 'fit-content',
    // Touch-friendly minimum size
    minHeight: isTouch ? touchTargets.minSize : 'auto',
    // Scroll snap alignment for mobile
    scrollSnapAlign: 'start',
    // Enhanced touch feedback
    WebkitTapHighlightColor: 'transparent',
    // Prevent text selection on touch
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
  });

  // Mobile-optimized badge styles
  const badgeStyles = {
    backgroundColor: tokens.colors.primary[600],
    color: tokens.colors.white,
    fontSize: isMobile ? '12px' : tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.bold,
    padding: isMobile 
      ? `${tokens.spacing[1]} ${tokens.spacing[1]}` 
      : `${tokens.spacing[1]} ${tokens.spacing[2]}`,
    borderRadius: tokens.borderRadius.full,
    minWidth: isMobile ? '18px' : '20px',
    textAlign: 'center' as const,
    lineHeight: 1,
    // Ensure badge is readable on mobile
    minHeight: isMobile ? '18px' : 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const totalBookings = Object.values(bookingCounts).reduce((sum, count) => sum + count, 0);

  const handleTabClick = (status: MyBookingsStatus) => {
    onChange(status);
  };

  const handleKeyDown = (event: React.KeyboardEvent, status: MyBookingsStatus) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onChange(status);
    }
  };

  /**
   * Enhanced touch handling for mobile devices.
   * 
   * Provides visual feedback during touch interactions by scaling the
   * touched element. This improves the mobile user experience by giving
   * immediate tactile feedback.
   * 
   * @param event - Touch event from React
   */
  const handleTouchStart = (event: React.TouchEvent) => {
    // Prevent default to avoid unwanted behaviors
    if (isTouch) {
      (event.currentTarget as HTMLElement).style.transform = 'scale(0.98)';
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (isTouch) {
      (event.currentTarget as HTMLElement).style.transform = 'scale(1)';
    }
  };

  return (
    <div style={containerStyles}>
      <div style={headerStyles}>
        <h3 style={titleStyles}>
          {isMobile ? 'Filter Bookings' : 'Filter My Bookings'}
        </h3>
      </div>

      <div style={tabBarStyles}>
        {filterTabs.map((tab) => {
          const isActive = currentFilter === tab.status;
          const count = bookingCounts[tab.status] || 0;

          return (
            <div
              key={tab.status}
              style={getTabStyles(isActive)}
              onClick={() => handleTabClick(tab.status)}
              onKeyDown={(e) => handleKeyDown(e, tab.status)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              aria-label={`${tab.label} bookings: ${count} items. ${tab.description}`}
              title={!isMobile ? tab.description : undefined} // Remove tooltips on mobile
              onMouseEnter={(e) => {
                // Only apply hover effects on non-touch devices
                if (!isActive && !isTouch) {
                  e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
                  e.currentTarget.style.borderColor = tokens.colors.neutral[300];
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive && !isTouch) {
                  e.currentTarget.style.backgroundColor = tokens.colors.white;
                  e.currentTarget.style.borderColor = tokens.colors.neutral[200];
                }
              }}
            >
              <span 
                style={{ 
                  fontSize: isMobile ? '14px' : '16px',
                  // Ensure emoji renders properly on mobile
                  lineHeight: 1,
                }} 
                aria-hidden="true"
              >
                {tab.icon}
              </span>
              <span style={{
                // Responsive label sizing
                fontSize: isMobile ? '14px' : 'inherit',
              }}>
                {isMobile && tab.label.length > 8 ? tab.label.substring(0, 6) + '...' : tab.label}
              </span>
              <span style={badgeStyles}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};