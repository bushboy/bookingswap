import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  UnifiedBookingData,
  BookingWithSwapInfo,
  EnhancedBookingFilters,
  UnifiedBookingResponse,
  UpdateBookingWithSwapRequest,
} from '@booking-swap/shared';
import { RootState } from '../index';
import { bookingService } from '../../services/bookingService';
import { swapService } from '../../services/swapService';
import {
  setBookingsWithSwapInfo,
  setLoading,
  setError,
  addBooking,
  updateBooking,
  updateSwapInfo,
  removeSwapInfo,
} from '../slices/bookingsSlice';
import {
  closeBookingForm,
  setInlineProposalLoading,
  setInlineProposalError,
  closeInlineProposal,
} from '../slices/uiSlice';

// Unified booking creation with optional swap
export const createBookingWithSwap = createAsyncThunk<
  UnifiedBookingResponse,
  UnifiedBookingData,
  { state: RootState }
>(
  'bookings/createBookingWithSwap',
  async (bookingData, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));

      // Create booking first
      const booking = await bookingService.createBooking({
        type: bookingData.type,
        title: bookingData.title,
        description: bookingData.description,
        location: bookingData.location,
        dateRange: bookingData.dateRange,
        originalPrice: bookingData.originalPrice,
        swapValue: bookingData.swapValue,
        providerDetails: bookingData.providerDetails,
      });

      let swap = undefined;

      // Create swap if preferences are provided
      if (bookingData.swapEnabled && bookingData.swapPreferences) {
        const swapData = {
          sourceBookingId: booking.id,
          title: `Swap for ${booking.title}`,
          paymentTypes: {
            bookingExchange: bookingData.swapPreferences.paymentTypes.includes('booking'),
            cashPayment: bookingData.swapPreferences.paymentTypes.includes('cash'),
          },
          acceptanceStrategy: {
            type: bookingData.swapPreferences.acceptanceStrategy,
            auctionEndDate: bookingData.swapPreferences.auctionEndDate,
          },
          cashDetails: bookingData.swapPreferences.minCashAmount ? {
            enabled: true,
            minimumAmount: bookingData.swapPreferences.minCashAmount,
            maximumAmount: bookingData.swapPreferences.minCashAmount * 2, // Default max
          } : undefined,
          terms: {
            conditions: bookingData.swapPreferences.swapConditions || [],
          },
        };

        swap = await swapService.createEnhancedSwap(swapData);
      }

      const response: UnifiedBookingResponse = {
        booking,
        swap: swap ? {
          id: swap.id,
          paymentTypes: swap.paymentTypes,
          acceptanceStrategy: swap.acceptanceStrategy,
          cashDetails: swap.cashDetails,
        } : undefined,
      };

      // Add booking to store with swap info
      const bookingWithSwapInfo: BookingWithSwapInfo = {
        ...booking,
        swapInfo: swap ? {
          swapId: swap.id,
          paymentTypes: Object.entries(swap.paymentTypes)
            .filter(([_, enabled]) => enabled)
            .map(([type]) => type === 'bookingExchange' ? 'booking' : 'cash') as ('booking' | 'cash')[],
          acceptanceStrategy: swap.acceptanceStrategy.type,
          auctionEndDate: swap.acceptanceStrategy.auctionEndDate,
          minCashAmount: swap.cashDetails?.minimumAmount,
          maxCashAmount: swap.cashDetails?.maximumAmount,
          hasActiveProposals: true,
          activeProposalCount: 0,
          userProposalStatus: 'none',
          swapConditions: swap.terms.conditions,
        } : undefined,
      };

      dispatch(addBooking(bookingWithSwapInfo));
      dispatch(closeBookingForm());
      dispatch(setLoading(false));

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create booking';
      dispatch(setError(errorMessage));
      return rejectWithValue(errorMessage);
    }
  }
);

// Update booking with swap preferences
export const updateBookingWithSwap = createAsyncThunk<
  UnifiedBookingResponse,
  UpdateBookingWithSwapRequest,
  { state: RootState }
>(
  'bookings/updateBookingWithSwap',
  async ({ bookingId, bookingData, swapEnabled, swapPreferences }, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));

      // Update booking
      const updatedBooking = await bookingService.updateBooking(bookingId, bookingData);

      // Handle swap preferences
      const existingSwap = await swapService.getSwapByBookingId(bookingId);
      let swap = undefined;

      if (swapEnabled && swapPreferences) {
        const swapData = {
          sourceBookingId: bookingId,
          title: `Swap for ${updatedBooking.title}`,
          paymentTypes: {
            bookingExchange: swapPreferences.paymentTypes.includes('booking'),
            cashPayment: swapPreferences.paymentTypes.includes('cash'),
          },
          acceptanceStrategy: {
            type: swapPreferences.acceptanceStrategy,
            auctionEndDate: swapPreferences.auctionEndDate,
          },
          cashDetails: swapPreferences.minCashAmount ? {
            enabled: true,
            minimumAmount: swapPreferences.minCashAmount,
            maximumAmount: swapPreferences.minCashAmount * 2,
          } : undefined,
          terms: {
            conditions: swapPreferences.swapConditions || [],
          },
        };

        if (existingSwap) {
          // Update existing swap
          swap = await swapService.updateSwap(existingSwap.id, swapData);
        } else {
          // Create new swap
          swap = await swapService.createEnhancedSwap(swapData);
        }
      } else if (existingSwap) {
        // Disable swap if it exists but preferences are disabled
        await swapService.cancelSwap(existingSwap.id);
        dispatch(removeSwapInfo(bookingId));
      }

      const response: UnifiedBookingResponse = {
        booking: updatedBooking,
        swap: swap ? {
          id: swap.id,
          paymentTypes: swap.paymentTypes,
          acceptanceStrategy: swap.acceptanceStrategy,
          cashDetails: swap.cashDetails,
        } : undefined,
      };

      // Update booking in store with swap info
      const bookingWithSwapInfo: BookingWithSwapInfo = {
        ...updatedBooking,
        swapInfo: swap ? {
          swapId: swap.id,
          paymentTypes: Object.entries(swap.paymentTypes)
            .filter(([_, enabled]) => enabled)
            .map(([type]) => type === 'bookingExchange' ? 'booking' : 'cash') as ('booking' | 'cash')[],
          acceptanceStrategy: swap.acceptanceStrategy.type,
          auctionEndDate: swap.acceptanceStrategy.auctionEndDate,
          minCashAmount: swap.cashDetails?.minimumAmount,
          maxCashAmount: swap.cashDetails?.maximumAmount,
          hasActiveProposals: true,
          activeProposalCount: existingSwap?.proposals?.length || 0,
          userProposalStatus: 'none',
          swapConditions: swap.terms.conditions,
        } : undefined,
      };

      dispatch(updateBooking(bookingWithSwapInfo));
      dispatch(closeBookingForm());
      dispatch(setLoading(false));

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update booking';
      dispatch(setError(errorMessage));
      return rejectWithValue(errorMessage);
    }
  }
);

// Fetch bookings with integrated swap information
export const fetchBookingsWithSwapInfo = createAsyncThunk<
  BookingWithSwapInfo[],
  { filters?: EnhancedBookingFilters; currentUserId: string },
  { state: RootState }
>(
  'bookings/fetchBookingsWithSwapInfo',
  async ({ filters = {}, currentUserId }, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));

      // Fetch bookings with basic filters
      const coreFilters = {
        type: filters.type,
        location: filters.location,
        dateRange: filters.dateRange,
        priceRange: filters.priceRange,
        status: filters.status,
      };

      const bookings = await bookingService.getBookings(coreFilters);

      // Fetch swap information for each booking
      const bookingsWithSwapInfo: BookingWithSwapInfo[] = await Promise.all(
        bookings.map(async (booking) => {
          try {
            const swap = await swapService.getSwapByBookingId(booking.id);
            
            if (swap) {
              const proposals = await swapService.getProposalsForSwap(swap.id);
              const userProposal = proposals.find(p => p.proposerId === currentUserId);
              
              return {
                ...booking,
                swapInfo: {
                  swapId: swap.id,
                  paymentTypes: Object.entries(swap.paymentTypes)
                    .filter(([_, enabled]) => enabled)
                    .map(([type]) => type === 'bookingExchange' ? 'booking' : 'cash') as ('booking' | 'cash')[],
                  acceptanceStrategy: swap.acceptanceStrategy.type,
                  auctionEndDate: swap.acceptanceStrategy.auctionEndDate,
                  minCashAmount: swap.cashDetails?.minimumAmount,
                  maxCashAmount: swap.cashDetails?.maximumAmount,
                  hasActiveProposals: swap.status === 'pending',
                  activeProposalCount: proposals.length,
                  userProposalStatus: userProposal ? userProposal.status : 'none',
                  timeRemaining: swap.acceptanceStrategy.auctionEndDate ? 
                    new Date(swap.acceptanceStrategy.auctionEndDate).getTime() - Date.now() : undefined,
                  swapConditions: swap.terms.conditions,
                  hasAnySwapInitiated: true, // Any swap exists means it was initiated
                },
              };
            }
            
            return booking;
          } catch (error) {
            // If swap fetch fails, return booking without swap info
            console.warn(`Failed to fetch swap info for booking ${booking.id}:`, error);
            return booking;
          }
        })
      );

      // Apply swap-specific filters
      let filteredBookings = bookingsWithSwapInfo;

      if (filters.swapAvailable) {
        filteredBookings = filteredBookings.filter(booking => booking.swapInfo?.hasActiveProposals);
      }

      if (filters.acceptsCash) {
        filteredBookings = filteredBookings.filter(booking => 
          booking.swapInfo?.paymentTypes.includes('cash')
        );
      }

      if (filters.auctionMode) {
        filteredBookings = filteredBookings.filter(booking => 
          booking.swapInfo?.acceptanceStrategy === 'auction' &&
          booking.swapInfo?.auctionEndDate && 
          new Date(booking.swapInfo.auctionEndDate) > new Date()
        );
      }

      // Apply browsing restrictions (exclude own bookings when browsing)
      const browsableBookings = filteredBookings.filter(booking => {
        // Don't show user's own bookings when browsing
        if (booking.userId === currentUserId) {
          return false;
        }
        
        // Don't show cancelled bookings
        if (booking.status === 'cancelled') {
          return false;
        }
        
        return true;
      });

      dispatch(setBookingsWithSwapInfo(browsableBookings));
      dispatch(setLoading(false));

      return browsableBookings;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch bookings';
      dispatch(setError(errorMessage));
      return rejectWithValue(errorMessage);
    }
  }
);

// Make inline proposal from booking listing
export const makeInlineProposal = createAsyncThunk<
  void,
  {
    bookingId: string;
    proposalData: {
      type: 'booking' | 'cash';
      selectedBookingId?: string;
      cashAmount?: number;
      paymentMethodId?: string;
      message?: string;
      conditions?: string[];
    };
  },
  { state: RootState }
>(
  'bookings/makeInlineProposal',
  async ({ bookingId, proposalData }, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setInlineProposalLoading({ bookingId, loading: true }));

      // Get swap for the booking
      const swap = await swapService.getSwapByBookingId(bookingId);
      if (!swap) {
        throw new Error('No active swap found for this booking');
      }

      // Create proposal based on type
      if (proposalData.type === 'booking') {
        if (!proposalData.selectedBookingId) {
          throw new Error('Booking selection is required for booking proposals');
        }

        await swapService.createBookingProposal(swap.id, {
          bookingId: proposalData.selectedBookingId,
          message: proposalData.message || '',
          conditions: proposalData.conditions || [],
        });
      } else {
        if (!proposalData.cashAmount || !proposalData.paymentMethodId) {
          throw new Error('Cash amount and payment method are required for cash proposals');
        }

        await swapService.createCashProposal(swap.id, {
          amount: proposalData.cashAmount,
          currency: 'USD',
          paymentMethodId: proposalData.paymentMethodId,
          message: proposalData.message || '',
        });
      }

      // Update swap info to reflect new proposal
      const updatedSwap = await swapService.getSwapById(swap.id);
      const proposals = await swapService.getProposalsForSwap(swap.id);
      
      dispatch(updateSwapInfo({
        bookingId,
        swapInfo: {
          swapId: swap.id,
          paymentTypes: Object.entries(updatedSwap.paymentTypes)
            .filter(([_, enabled]) => enabled)
            .map(([type]) => type === 'bookingExchange' ? 'booking' : 'cash') as ('booking' | 'cash')[],
          acceptanceStrategy: updatedSwap.acceptanceStrategy.type,
          auctionEndDate: updatedSwap.acceptanceStrategy.auctionEndDate,
          minCashAmount: updatedSwap.cashDetails?.minimumAmount,
          maxCashAmount: updatedSwap.cashDetails?.maximumAmount,
          hasActiveProposals: true,
          activeProposalCount: proposals.length,
          userProposalStatus: 'pending',
          timeRemaining: updatedSwap.acceptanceStrategy.auctionEndDate ? 
            new Date(updatedSwap.acceptanceStrategy.auctionEndDate).getTime() - Date.now() : undefined,
          swapConditions: updatedSwap.terms.conditions,
        },
      }));

      dispatch(closeInlineProposal(bookingId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create proposal';
      dispatch(setInlineProposalError({ bookingId, error: errorMessage }));
      return rejectWithValue(errorMessage);
    }
  }
);

// Refresh swap information for a specific booking
export const refreshSwapInfo = createAsyncThunk<
  void,
  { bookingId: string; currentUserId: string },
  { state: RootState }
>(
  'bookings/refreshSwapInfo',
  async ({ bookingId, currentUserId }, { dispatch, rejectWithValue }) => {
    try {
      const swap = await swapService.getSwapByBookingId(bookingId);
      
      if (swap) {
        const proposals = await swapService.getProposalsForSwap(swap.id);
        const userProposal = proposals.find(p => p.proposerId === currentUserId);
        
        dispatch(updateSwapInfo({
          bookingId,
          swapInfo: {
            swapId: swap.id,
            paymentTypes: Object.entries(swap.paymentTypes)
              .filter(([_, enabled]) => enabled)
              .map(([type]) => type === 'bookingExchange' ? 'booking' : 'cash') as ('booking' | 'cash')[],
            acceptanceStrategy: swap.acceptanceStrategy.type,
            auctionEndDate: swap.acceptanceStrategy.auctionEndDate,
            minCashAmount: swap.cashDetails?.minimumAmount,
            maxCashAmount: swap.cashDetails?.maximumAmount,
            hasActiveProposals: swap.status === 'pending',
            activeProposalCount: proposals.length,
            userProposalStatus: userProposal ? userProposal.status : 'none',
            timeRemaining: swap.acceptanceStrategy.auctionEndDate ? 
              new Date(swap.acceptanceStrategy.auctionEndDate).getTime() - Date.now() : undefined,
            swapConditions: swap.terms.conditions,
            hasAnySwapInitiated: true, // Any swap exists means it was initiated
          },
        }));
      } else {
        dispatch(removeSwapInfo(bookingId));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh swap info';
      console.warn(`Failed to refresh swap info for booking ${bookingId}:`, errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);