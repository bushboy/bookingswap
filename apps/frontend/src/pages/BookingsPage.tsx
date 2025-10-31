import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { BookingEditForm, BookingEditData } from '@/components/booking/BookingEditForm';
import { MyBookingsFilterBar, MyBookingsStatus } from '@/components/booking/MyBookingsFilterBar';
import { BookingCard } from '@/components/booking/BookingCard';
import {
  Booking,
  BookingWithSwapInfo,
  UnifiedBookingData,
  BookingUserRole,
  InlineProposalData,
  SwapInfo
} from '@booking-swap/shared';
import { BookingDetailsModal } from '@/components/booking/BookingDetailsModal';
import { EnhancedSwapCreationModal } from '@/components/swap/EnhancedSwapCreationModal';
import { useAuth } from '@/contexts/AuthContext';
import { unifiedBookingService } from '@/services/UnifiedBookingService';
import { bookingService } from '@/services/bookingService';
import { tokens } from '@/design-system/tokens';
import {
  BookingCounts,
  BookingStatus,
  FilterStatistics
} from '@/types/myBookings';
import { useResponsive } from '@/hooks/useResponsive';
import { EnhancedCreateSwapRequest } from '@booking-swap/shared';
// import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'; // Temporarily disabled

/**
 * SIMPLIFIED FILTERING APPROACH - DESIGN RATIONALE
 * 
 * This page has been refactored from complex browse-style filtering to simple
 * status-based filtering optimized for personal booking management.
 * 
 * REMOVED COMPLEX FILTER IMPORTS (Requirements 5.1, 8.4):
 * - EnhancedBookingFilters: Replaced with simple MyBookingsStatus type
 * - IntegratedFilterPanel: Replaced with MyBookingsFilterBar component
 * - Complex filter state management: Simplified to single status string
 * 
 * RATIONALE FOR SIMPLIFICATION:
 * 
 * 1. PURPOSE ALIGNMENT: The "My Bookings" page is for personal management,
 *    not discovery/browsing. Users don't need to search through their own
 *    bookings by location, date ranges, or keywords.
 * 
 * 2. COGNITIVE LOAD: Complex filtering creates decision paralysis. Status-based
 *    filtering aligns with natural booking lifecycle stages.
 * 
 * 3. MOBILE EXPERIENCE: Simplified filtering works better on mobile devices
 *    where screen space is limited and touch interactions are primary.
 * 
 * 4. MAINTENANCE: Fewer filter options mean less complexity in state management,
 *    URL synchronization, and edge case handling.
 * 
 * 5. USER BEHAVIOR: Personal booking management typically involves checking
 *    status and taking actions, not searching through large datasets.
 * 
 * STATUS CATEGORIES CHOSEN:
 * - 'all': Complete overview of user's booking portfolio
 * - 'active': Focus on current/upcoming bookings requiring attention
 * - 'with_swaps': Highlight bookings with swap activity needing response
 * - 'completed': Review successful swaps and past bookings
 * - 'expired': Manage expired bookings and cleanup
 * 
 * @see Requirements 1.1, 5.1, 5.4, 8.1, 8.2, 8.3 - Personal booking management focus
 */

export const BookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const { isMobile, isTablet } = useResponsive();

  // Enhanced state management for unified booking-swap operations
  const [bookings, setBookings] = useState<BookingWithSwapInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form and modal states - Updated for separated components
  const [isBookingEditOpen, setIsBookingEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Swap creation modal state
  const [isSwapCreationOpen, setIsSwapCreationOpen] = useState(false);
  const [swapCreationBooking, setSwapCreationBooking] = useState<Booking | null>(null);
  const [isSwapSubmitting, setIsSwapSubmitting] = useState(false);

  /**
   * Simplified status-based filtering state.
   * 
   * Replaces complex EnhancedBookingFilters object with a single status string.
   * This approach eliminates the need for:
   * - Search query management
   * - Location-based filtering
   * - Date range filtering
   * - Complex filter combination logic
   * 
   * The single status filter provides all the filtering capability needed
   * for personal booking management while maintaining simplicity.
   * 
   * @see Requirements 5.1, 5.4 - Simplified filter state management
   */
  const [statusFilter, setStatusFilter] = useState<MyBookingsStatus>('all');

  // Real-time update state
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  // Check if we're on the /bookings/new route
  const isNewBookingRoute = location.pathname === '/bookings/new';

  // Temporarily disable unsaved changes handling to test navigation
  const unsavedChanges = {
    navigateWithConfirmation: async (path: string) => {
      console.log('Navigation to:', path);
      return true; // Always allow navigation for testing
    },
    isSaving: false,
    markAsSaved: () => { },
  };

  // Load bookings with integrated swap information
  const loadBookingsWithSwapInfo = useCallback(async () => {
    if (!user?.id || !token) {
      console.log('No user or token available, skipping booking load');
      setBookings([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Loading bookings with swap information...');

      // Use UnifiedBookingService to get bookings with integrated swap info
      // Pass empty filters object since we'll handle filtering client-side with status filter
      const bookingsWithSwapInfo = await unifiedBookingService.getBookingsWithSwapInfo(
        {},
        user.id
      );

      // Ensure bookingsWithSwapInfo is always an array
      const safeBookings = Array.isArray(bookingsWithSwapInfo) ? bookingsWithSwapInfo : [];

      // Debug logging to see the data structure
      if (safeBookings.length > 0) {
        console.log('BookingsPage - sample booking data:', {
          id: safeBookings[0].id,
          location: safeBookings[0].location,
          dateRange: safeBookings[0].dateRange,
          locationType: typeof safeBookings[0].location,
          dateRangeType: typeof safeBookings[0].dateRange,
        });
      }

      setBookings(safeBookings);
      setLastUpdateTime(new Date());
      console.log('Successfully loaded', safeBookings.length, 'bookings with swap info');
    } catch (error) {
      console.error('Error loading bookings with swap info:', error);
      setError(error instanceof Error ? error.message : 'Failed to load your bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, token]);

  // Load bookings on component mount and when filters change
  useEffect(() => {
    loadBookingsWithSwapInfo();
  }, [loadBookingsWithSwapInfo]);

  // Real-time updates for swap status changes
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      // Refresh bookings every 30 seconds to get real-time swap updates
      loadBookingsWithSwapInfo();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadBookingsWithSwapInfo, user?.id]);

  // Open modal if we're on the new booking route
  useEffect(() => {
    if (isNewBookingRoute) {
      setIsBookingEditOpen(true);
      setEditingBooking(null); // Ensure we're in create mode
    }
  }, [isNewBookingRoute]);
  // Separated handlers for focused booking operations (no swap logic)
  const handleCreateBooking = async (bookingData: BookingEditData) => {
    setIsSubmitting(true);
    try {
      console.log('Creating booking with focused service:', bookingData);

      // Convert BookingEditData to the format expected by the booking service
      const bookingPayload = {
        type: bookingData.type,
        title: bookingData.title,
        description: bookingData.description,
        location: bookingData.location,
        dateRange: bookingData.dateRange,
        originalPrice: bookingData.originalPrice,
        swapValue: bookingData.swapValue,
        providerDetails: bookingData.providerDetails,
      };

      const result = await bookingService.createBooking(bookingPayload);

      console.log('Booking created successfully:', result);

      // Invalidate cache immediately to ensure fresh data on next fetch
      // This clears the UnifiedBookingService cache which is used by loadBookingsWithSwapInfo
      unifiedBookingService.invalidateCache();

      // Refresh the bookings list to show the new booking
      await loadBookingsWithSwapInfo();

      // Close modal and navigate back to bookings list
      setIsBookingEditOpen(false);
      setEditingBooking(null);
      setHasUnsavedChanges(false);
      navigate('/bookings');

      // Show success message
      alert('✅ Your booking has been created successfully!');
    } catch (error) {
      console.error('Failed to create booking:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Failed to create your booking'}`);
      // Re-throw the error so the form component knows the submission failed
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditBooking = async (bookingData: BookingEditData) => {
    if (!editingBooking) return;

    setIsSubmitting(true);
    try {
      console.log('Updating booking with focused service:', bookingData);

      // Convert BookingEditData to the format expected by the booking service
      // UpdateBookingRequest only allows certain fields to be updated
      const bookingPayload = {
        title: bookingData.title,
        description: bookingData.description,
        swapValue: bookingData.swapValue,
      };

      const result = await bookingService.updateBooking(editingBooking.id, bookingPayload);

      console.log('Booking updated successfully:', result);

      // Refresh the bookings list to show the updated booking
      await loadBookingsWithSwapInfo();

      // Close modal
      setIsBookingEditOpen(false);
      setEditingBooking(null);
      setHasUnsavedChanges(false);

      // Show success message
      alert('✅ Your booking has been updated successfully!');
    } catch (error) {
      console.error('Failed to update booking:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Failed to update your booking'}`);
      // Re-throw the error so the form component knows the submission failed
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInlineProposal = async (bookingId: string, proposalData: InlineProposalData) => {
    try {
      console.log('Making inline proposal:', { bookingId, proposalData });

      const proposal = await unifiedBookingService.makeInlineProposal(bookingId, proposalData);

      console.log('Proposal submitted successfully:', proposal);

      // Refresh bookings to show updated proposal status
      await loadBookingsWithSwapInfo();

      alert('✅ Your swap proposal has been submitted successfully!');
    } catch (error) {
      console.error('Failed to submit proposal:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Failed to submit your proposal'}`);
      throw error; // Re-throw to let the component handle loading states
    }
  };

  const getUserRoleForBooking = (booking: BookingWithSwapInfo): BookingUserRole => {
    if (!user?.id) return 'browser';

    if (booking.userId === user.id) {
      return 'owner';
    }

    // Check if user has made proposals for this booking
    if (booking.swapInfo?.userProposalStatus && booking.swapInfo.userProposalStatus !== 'none') {
      return 'proposer';
    }

    return 'browser';
  };

  /**
   * Type-safe filter change handler for simplified status filtering.
   * 
   * This handler replaces complex filter object management with simple
   * status string updates. The type safety ensures only valid status
   * values can be set, preventing runtime errors.
   * 
   * Benefits of simplified approach:
   * - No need to merge filter objects or handle partial updates
   * - Clear, predictable state transitions
   * - Easier debugging and testing
   * - Better TypeScript inference and error checking
   * 
   * @param status - The new filter status to apply
   * @see Requirements 5.1, 8.4 - Type-safe simplified filtering
   */
  const handleFilterChange = (status: MyBookingsStatus): void => {
    console.log('Filter changed to:', status);
    setStatusFilter(status);
  };

  // Mobile-optimized header styles
  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'flex-start' : 'center',
    marginBottom: tokens.spacing[6],
    flexDirection: isMobile ? 'column' as const : 'row' as const,
    gap: isMobile ? tokens.spacing[4] : '0',
  };

  // Mobile-optimized title styles
  const titleStyles = {
    fontSize: isMobile
      ? tokens.typography.fontSize.xl
      : tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  // Mobile-optimized grid styles using responsive hook
  const bookingsGridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile
      ? '1fr' // Single column on mobile
      : isTablet
        ? 'repeat(auto-fill, minmax(300px, 1fr))' // Smaller cards on tablet
        : 'repeat(auto-fill, minmax(350px, 1fr))', // Full size on desktop
    gap: isMobile ? tokens.spacing[4] : tokens.spacing[6],
    padding: isMobile ? `0 ${tokens.spacing[2]}` : '0',
  };

  const handleSubmitBooking = async (bookingData: BookingEditData) => {
    if (editingBooking) {
      await handleEditBooking(bookingData);
    } else {
      await handleCreateBooking(bookingData);
    }
  };

  const handleCloseModal = async () => {
    // Check for unsaved changes before closing
    if (hasUnsavedChanges) {
      const canClose = await unsavedChanges.navigateWithConfirmation('/bookings');
      if (!canClose) return;
    }

    setIsBookingEditOpen(false);
    setEditingBooking(null);
    setHasUnsavedChanges(false);

    // If we came from /bookings/new route, navigate back to /bookings
    if (isNewBookingRoute) {
      navigate('/bookings');
    }
  };

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsDetailsModalOpen(true);
  };

  const handleEditBookingClick = async (booking: Booking) => {
    // Check if booking has active swap proposals
    const bookingWithSwapInfo = bookings.find(b => b.id === booking.id);
    if (bookingWithSwapInfo && hasActiveSwapActivity(bookingWithSwapInfo)) {
      alert('⚠️ Cannot edit this booking because it has active swap proposals. Please manage or cancel the swap first.');
      return;
    }

    // Check for unsaved changes before switching to edit mode
    if (hasUnsavedChanges) {
      const canSwitch = await unsavedChanges.navigateWithConfirmation('/bookings');
      if (!canSwitch) return;
    }

    setEditingBooking(booking);
    setIsBookingEditOpen(true);
    setHasUnsavedChanges(false);
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      console.log('Deleting booking:', bookingId);

      // Make API call to delete booking
      const response = await fetch(
        `http://localhost:3001/api/bookings/${bookingId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        // Refresh bookings list
        await loadBookingsWithSwapInfo();
        alert('Your booking has been deleted successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete your booking');
      }
    } catch (error) {
      console.error('Failed to delete booking:', error);
      alert(
        `Failed to delete your booking: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };



  const handleCreateSwap = (booking: Booking) => {
    console.log('🔵 handleCreateSwap called with booking:', booking.id);
    console.log('🔵 Setting modal state - isOpen:', true, 'booking:', booking);
    setSwapCreationBooking(booking);
    setIsSwapCreationOpen(true);
  };

  const handleManageSwap = (swapInfo: SwapInfo) => {
    // Navigate to swaps page to manage the existing swap
    navigate(`/swaps?manage=${swapInfo.id}`);
  };

  const handleSwapCreationSubmit = async (swapData: EnhancedCreateSwapRequest) => {
    setIsSwapSubmitting(true);
    try {
      console.log('Creating swap from BookingsPage:', swapData);

      // Use direct API call to match SwapsPage implementation
      const response = await fetch('http://localhost:3001/api/swaps/enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(swapData),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create swap';

        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          // If we can't parse the error response, create a message based on status code
          switch (response.status) {
            case 503:
              errorMessage = 'Service temporarily unavailable (503). Please try again in a few moments.';
              break;
            case 500:
              errorMessage = 'Internal server error (500). Please try again later.';
              break;
            case 404:
              errorMessage = 'Resource not found (404). Please refresh the page and try again.';
              break;
            case 401:
              errorMessage = 'Unauthorized (401). Please log in again.';
              break;
            case 403:
              errorMessage = 'Forbidden (403). You do not have permission to create this swap.';
              break;
            default:
              errorMessage = `Request failed with status ${response.status}. Please try again.`;
          }
        }

        throw new Error(errorMessage);
      }

      const createdSwap = await response.json();
      console.log('Swap created successfully:', createdSwap);

      // Close modal and clear state
      setIsSwapCreationOpen(false);
      setSwapCreationBooking(null);

      // Refresh bookings to show updated swap status
      try {
        await loadBookingsWithSwapInfo();
      } catch (refreshError) {
        // Log the error but don't prevent success message
        console.warn('Failed to refresh bookings after swap creation:', refreshError);
        // The swap was still created successfully, so don't throw
      }

      alert('✅ Swap proposal created successfully!');
    } catch (error) {
      console.error('Failed to create swap:', error);
      throw error; // Re-throw to be handled by the modal
    } finally {
      setIsSwapSubmitting(false);
    }
  };

  const handleCloseSwapCreationModal = () => {
    setIsSwapCreationOpen(false);
    setSwapCreationBooking(null);
  };

  // Helper functions for booking status determination with validation and type safety (Requirements 8.4)
  const isBookingExpired = (booking: BookingWithSwapInfo): boolean => {
    try {
      const now = new Date();
      const eventDate = new Date(booking.dateRange.checkOut);

      // Validate date
      if (isNaN(eventDate.getTime())) {
        console.warn('Invalid event date for booking:', booking.id);
        return false;
      }

      return eventDate < now;
    } catch (error) {
      console.error('Error checking if booking is expired:', error);
      return false;
    }
  };

  const hasActiveSwapActivity = (booking: BookingWithSwapInfo): boolean => {
    if (!booking.swapInfo) return false;

    try {
      return booking.swapInfo.hasActiveProposals ||
        booking.swapInfo.activeProposalCount > 0 ||
        booking.swapInfo.userProposalStatus === 'pending';
    } catch (error) {
      console.error('Error checking swap activity for booking:', booking.id, error);
      return false;
    }
  };

  const isSwapCompleted = (booking: BookingWithSwapInfo): boolean => {
    try {
      return booking.swapInfo?.userProposalStatus === 'accepted';
    } catch (error) {
      console.error('Error checking if swap is completed for booking:', booking.id, error);
      return false;
    }
  };

  /**
   * Enhanced client-side filtering based on status with comprehensive logic.
   * 
   * This function implements the core logic for the simplified filtering approach,
   * replacing complex server-side filtering with efficient client-side status
   * determination. The status categories align with booking lifecycle stages
   * that are most relevant for personal booking management.
   * 
   * Status Categories (in priority order):
   * - 'expired': Bookings where the event date has passed
   * - 'completed': Bookings where a swap has been accepted/completed  
   * - 'with_swaps': Bookings with active swap proposals or pending activity
   * - 'active': Default status for bookings without swap activity
   * 
   * Priority Logic:
   * The function checks conditions in priority order to ensure each booking
   * gets exactly one status. Higher priority statuses override lower ones.
   * For example, an expired booking with active swaps will be marked as
   * 'expired' rather than 'with_swaps'.
   * 
   * Benefits of Client-Side Approach:
   * - Faster filtering (no API calls)
   * - Real-time updates as booking data changes
   * - Simplified server API (no complex filter parameters)
   * - Better offline experience
   * 
   * @param booking - Booking with integrated swap information
   * @returns BookingStatus - The determined status for filtering
   * 
   * @see Requirements 5.2, 5.5, 5.6 - Status-based filtering and indicators
   */
  const getBookingStatus = (booking: BookingWithSwapInfo): BookingStatus => {
    // Priority 1: Check if booking is expired (event date has passed)
    if (isBookingExpired(booking)) {
      return 'expired';
    }

    // Priority 2: Check if swap was completed/accepted
    if (isSwapCompleted(booking)) {
      return 'completed';
    }

    // Priority 3: Check if there are active swap proposals or pending activity
    if (hasActiveSwapActivity(booking)) {
      return 'with_swaps';
    }

    // Default: Active bookings (no swap activity, rejected proposals, or no swap info)
    return 'active';
  };

  /**
   * Enhanced filtering function with status-based filtering and error handling.
   * 
   * This function applies the selected status filter to the bookings array,
   * implementing the simplified filtering approach that replaces complex
   * server-side filtering with efficient client-side operations.
   * 
   * Key Features:
   * - Handles 'all' filter by returning unfiltered results
   * - Uses getBookingStatus() for consistent status determination
   * - Includes error handling for malformed booking objects
   * - Maintains referential equality for 'all' filter (performance optimization)
   * 
   * Performance Considerations:
   * - Client-side filtering is efficient for typical user booking counts (5-50)
   * - Avoids API calls and server-side complexity
   * - Enables real-time filtering as booking status changes
   * 
   * @param bookings - Array of bookings with swap information
   * @param filter - Selected status filter to apply
   * @returns Filtered array of bookings matching the status
   * 
   * @see Requirements 5.2, 5.5 - Status-based filtering implementation
   */
  const applyStatusFilter = (bookings: BookingWithSwapInfo[], filter: MyBookingsStatus): BookingWithSwapInfo[] => {
    if (filter === 'all') return bookings;

    try {
      return bookings.filter(booking => {
        if (!booking || !booking.id) {
          console.warn('Invalid booking object encountered during filtering');
          return false;
        }

        const status = getBookingStatus(booking);
        return status === filter;
      });
    } catch (error) {
      console.error('Error applying status filter:', error);
      return bookings; // Return unfiltered bookings on error
    }
  };

  // Apply current filter to bookings
  const filteredBookings = applyStatusFilter(bookings, statusFilter);

  /**
   * Calculate booking counts for each status category (for filter bar badges).
   * 
   * This function generates the count data displayed as badges on each filter
   * tab in the MyBookingsFilterBar. The counts help users understand their
   * booking distribution and make informed filtering decisions.
   * 
   * Implementation Details:
   * - Iterates through all bookings once for efficiency
   * - Uses getBookingStatus() for consistent status determination
   * - Includes error handling for malformed booking objects
   * - Returns counts object with all status categories initialized
   * 
   * Badge Benefits:
   * - Provides immediate visual feedback about booking distribution
   * - Helps users identify categories that need attention
   * - Shows total booking count for portfolio overview
   * - Enables quick decision-making about which filter to apply
   * 
   * @returns BookingCounts object with counts for each status category
   * 
   * @see Requirements 5.6 - Filter counts and badges for user guidance
   */
  const getBookingCounts = (): BookingCounts => {
    const counts: BookingCounts = {
      all: bookings.length,
      active: 0,
      with_swaps: 0,
      completed: 0,
      expired: 0
    };

    try {
      // Count bookings by status with error handling
      bookings.forEach(booking => {
        if (!booking || !booking.id) {
          console.warn('Invalid booking object encountered during counting');
          return;
        }

        const status = getBookingStatus(booking);
        if (status in counts) {
          counts[status]++;
        } else {
          console.warn('Unknown booking status:', status, 'for booking:', booking.id);
        }
      });
    } catch (error) {
      console.error('Error calculating booking counts:', error);
    }

    return counts;
  };

  const bookingCounts = getBookingCounts();



  // Validation function to ensure BookingWithSwapInfo compatibility with type safety (Requirements 8.4)
  const validateBookingData = (booking: BookingWithSwapInfo): booking is BookingWithSwapInfo => {
    if (!booking || typeof booking !== 'object') {
      console.warn('Invalid booking object:', booking);
      return false;
    }

    if (!booking.id || !booking.dateRange || !booking.dateRange.checkOut) {
      console.warn('Booking missing required fields:', booking.id);
      return false;
    }

    return true;
  };

  // Log filtering statistics for debugging with type safety (Requirements 8.4)
  React.useEffect(() => {
    if (bookings.length > 0) {
      const statistics: FilterStatistics = {
        total: bookings.length,
        counts: bookingCounts,
        currentFilter: statusFilter,
        filteredCount: filteredBookings.length,
        validBookings: bookings.filter(validateBookingData).length
      };
      console.log('Booking Filter Statistics:', statistics);
    }
  }, [bookings, statusFilter, bookingCounts, filteredBookings.length]);

  return (
    <div>
      <div style={headerStyles}>
        <div>
          <h1 style={titleStyles}>My Bookings</h1>
          <p
            style={{
              fontSize: isMobile ? '14px' : tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
              margin: `${tokens.spacing[1]} 0 0 0`,
              lineHeight: tokens.typography.lineHeight.normal,
            }}
          >
            {loading ? 'Loading your bookings...' : (
              <>
                You have {filteredBookings.length} booking
                {filteredBookings.length !== 1 ? 's' : ''}
                {statusFilter !== 'all' && ` with ${statusFilter.replace('_', ' ')} status`}
              </>
            )}
            {lastUpdateTime && !isMobile && (
              <span style={{ marginLeft: tokens.spacing[2], fontStyle: 'italic' }}>
                • Last updated: {lastUpdateTime.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsBookingEditOpen(true)}>
          Add New Booking
        </Button>
      </div>

      {/* MyBookingsFilterBar Component */}
      <MyBookingsFilterBar
        currentFilter={statusFilter}
        bookingCounts={bookingCounts}
        onChange={handleFilterChange}
      />

      {/* Error Display */}
      {error && (
        <div
          style={{
            padding: tokens.spacing[4],
            backgroundColor: tokens.colors.error[50],
            border: `1px solid ${tokens.colors.error[200]}`,
            borderRadius: tokens.borderRadius.md,
            marginBottom: tokens.spacing[6],
            color: tokens.colors.error[800],
          }}
        >
          ⚠️ Unable to load your bookings: {error}
          <Button
            variant="ghost"
            size="sm"
            onClick={loadBookingsWithSwapInfo}
            style={{ marginLeft: tokens.spacing[2] }}
          >
            Retry
          </Button>
        </div>
      )}

      <div style={bookingsGridStyles}>
        {loading ? (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: tokens.spacing[12],
              color: tokens.colors.neutral[500],
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: tokens.spacing[4] }}>
              ⏳
            </div>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.xl,
                marginBottom: tokens.spacing[2],
              }}
            >
              Loading your bookings...
            </h3>
            <p>Please wait while we fetch your personal bookings and swap activity.</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: tokens.spacing[12],
              color: tokens.colors.neutral[500],
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: tokens.spacing[4] }}>
              📋
            </div>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.xl,
                marginBottom: tokens.spacing[2],
              }}
            >
              {statusFilter !== 'all'
                ? `No bookings with ${statusFilter.replace('_', ' ')} status`
                : 'You haven\'t created any bookings yet'}
            </h3>
            <p style={{ marginBottom: tokens.spacing[4] }}>
              {statusFilter !== 'all'
                ? 'Try selecting a different status filter to see your other bookings.'
                : 'Create your first booking to start managing your reservations and exploring swap opportunities.'}
            </p>
            <Button
              variant="primary"
              onClick={() => setIsBookingEditOpen(true)}
            >
              Create Your First Booking
            </Button>
          </div>
        ) : (
          filteredBookings.map(booking => {
            const userRole = getUserRoleForBooking(booking);
            return (
              <BookingCard
                key={booking.id}
                booking={booking}
                userRole={userRole}
                onViewDetails={handleViewDetails}
                onEdit={handleEditBookingClick}
                onDelete={handleDeleteBooking}
                onCreateSwap={handleCreateSwap}
                onManageSwap={handleManageSwap}
                showInlineProposal={userRole === 'browser'}
                onInlineProposal={handleInlineProposal}
                showSwapIndicators={true}
              />
            );
          })
        )}
      </div>

      {/* Focused Booking Edit Form - Separated from swap functionality */}
      {isBookingEditOpen && (
        <BookingEditForm
          isOpen={isBookingEditOpen}
          onClose={handleCloseModal}
          onSubmit={handleSubmitBooking}
          booking={editingBooking}
          loading={isSubmitting}
          onUnsavedChangesChange={setHasUnsavedChanges}
        />
      )}

      {/* Booking Details Modal */}
      <BookingDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking ?? undefined}
        variant="own"
        onEdit={handleEditBookingClick}
        onDelete={handleDeleteBooking}
        onCreateSwap={handleCreateSwap}
      />

      {/* Enhanced Swap Creation Modal */}
      {console.log('🟢 Rendering EnhancedSwapCreationModal - isOpen:', isSwapCreationOpen, 'booking:', swapCreationBooking?.id)}
      <EnhancedSwapCreationModal
        isOpen={isSwapCreationOpen}
        onClose={handleCloseSwapCreationModal}
        booking={swapCreationBooking}
        onSubmit={handleSwapCreationSubmit}
        loading={isSwapSubmitting}
      />
    </div>
  );
};
