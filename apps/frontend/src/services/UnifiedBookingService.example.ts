/**
 * Example usage of UnifiedBookingService
 * This file demonstrates how to use the service for various booking and swap operations
 */

import { unifiedBookingService } from './UnifiedBookingService';
import {
  UnifiedBookingData,
  EnhancedBookingFilters,
  InlineProposalData,
  UpdateBookingWithSwapRequest,
} from '@booking-swap/shared';

// Example 1: Creating a booking with swap preferences
export async function createHotelBookingWithSwap() {
  const bookingData: UnifiedBookingData = {
    type: 'hotel',
    title: 'Luxury Suite at The Plaza',
    description: 'Beautiful suite with Central Park view, perfect for a romantic getaway',
    location: {
      city: 'New York',
      country: 'USA',
      coordinates: [40.7614, -73.9776],
    },
    dateRange: {
      checkIn: new Date('2024-07-15'),
      checkOut: new Date('2024-07-18'),
    },
    originalPrice: 1200,
    swapValue: 1200,
    providerDetails: {
      provider: 'Booking.com',
      confirmationNumber: 'NYC789456',
      bookingReference: 'PLAZA2024',
    },
    swapEnabled: true,
    swapPreferences: {
      paymentTypes: ['booking', 'cash'],
      minCashAmount: 500,
      maxCashAmount: 1000,
      acceptanceStrategy: 'auction',
      auctionEndDate: new Date('2024-07-08'), // One week before check-in
      swapConditions: [
        'Prefer similar luxury level',
        'Must be in major city',
        'Non-smoking room required',
      ],
    },
  };

  try {
    const result = await unifiedBookingService.createBookingWithSwap(bookingData);
    
    console.log('✅ Booking created successfully:', {
      bookingId: result.booking.id,
      title: result.booking.title,
      swapEnabled: !!result.swap,
      swapId: result.swap?.id,
    });

    return result;
  } catch (error) {
    console.error('❌ Failed to create booking with swap:', error);
    throw error;
  }
}

// Example 2: Creating a simple booking without swap
export async function createSimpleEventBooking() {
  const bookingData: UnifiedBookingData = {
    type: 'event',
    title: 'Broadway Show - Hamilton',
    description: 'Premium orchestra seats for the hit musical Hamilton',
    location: {
      city: 'New York',
      country: 'USA',
    },
    dateRange: {
      checkIn: new Date('2024-08-20'),
      checkOut: new Date('2024-08-20'),
    },
    originalPrice: 350,
    swapValue: 350,
    providerDetails: {
      provider: 'Ticketmaster',
      confirmationNumber: 'HAM2024789',
      bookingReference: 'BROADWAY350',
    },
    swapEnabled: false, // No swap for this booking
  };

  try {
    const result = await unifiedBookingService.createBookingWithSwap(bookingData);
    console.log('✅ Simple booking created:', result.booking.title);
    return result;
  } catch (error) {
    console.error('❌ Failed to create simple booking:', error);
    throw error;
  }
}

// Example 3: Browsing bookings with swap filters
export async function browseSwappableBookings(currentUserId: string) {
  const filters: EnhancedBookingFilters = {
    // Core booking filters
    type: ['hotel', 'event'],
    location: {
      city: 'New York',
      radius: 50, // 50km radius
    },
    dateRange: {
      start: new Date('2024-06-01'),
      end: new Date('2024-08-31'),
    },
    priceRange: {
      min: 200,
      max: 2000,
    },
    
    // Swap-specific filters
    swapAvailable: true,
    acceptsCash: true,
    auctionMode: false, // Only first-match swaps
    minCashAmount: 300,
    
    // Sorting and pagination
    sortBy: 'event_date',
    sortOrder: 'asc',
    limit: 20,
    offset: 0,
  };

  try {
    const bookings = await unifiedBookingService.getBookingsWithSwapInfo(filters, currentUserId);
    
    console.log(`📋 Found ${bookings.length} swappable bookings:`);
    
    bookings.forEach((booking, index) => {
      console.log(`${index + 1}. ${booking.title}`);
      console.log(`   📍 ${booking.location.city}, ${booking.location.country}`);
      console.log(`   💰 $${booking.originalPrice}`);
      
      if (booking.swapInfo) {
        console.log(`   🔄 Swap: ${booking.swapInfo.paymentTypes.join(' + ')}`);
        console.log(`   📊 ${booking.swapInfo.activeProposalCount} active proposals`);
        
        if (booking.swapInfo.minCashAmount) {
          console.log(`   💵 Min cash: $${booking.swapInfo.minCashAmount}`);
        }
      }
      console.log('');
    });

    return bookings;
  } catch (error) {
    console.error('❌ Failed to browse bookings:', error);
    throw error;
  }
}

// Example 4: Making a booking proposal
export async function makeBookingProposal(targetBookingId: string, userBookingId: string) {
  const proposalData: InlineProposalData = {
    type: 'booking',
    selectedBookingId: userBookingId,
    message: 'Hi! I have a beautiful beach resort booking that I think would be perfect for a swap. My dates are flexible and the location is amazing!',
    conditions: [
      'Flexible check-in time (+/- 2 hours)',
      'Can accommodate early check-out if needed',
      'Property has pool and beach access',
    ],
  };

  try {
    const proposal = await unifiedBookingService.makeInlineProposal(targetBookingId, proposalData);
    
    console.log('✅ Booking proposal submitted:', {
      proposalId: proposal.id,
      status: proposal.status,
      targetBooking: targetBookingId,
      offeredBooking: userBookingId,
    });

    return proposal;
  } catch (error) {
    console.error('❌ Failed to submit booking proposal:', error);
    throw error;
  }
}

// Example 5: Making a cash proposal
export async function makeCashProposal(targetBookingId: string) {
  const proposalData: InlineProposalData = {
    type: 'cash',
    cashAmount: 750,
    paymentMethodId: 'payment-method-123',
    message: 'I\'m offering cash for your booking. Payment can be made immediately upon acceptance.',
  };

  try {
    const proposal = await unifiedBookingService.makeInlineProposal(targetBookingId, proposalData);
    
    console.log('✅ Cash proposal submitted:', {
      proposalId: proposal.id,
      amount: proposalData.cashAmount,
      status: proposal.status,
    });

    return proposal;
  } catch (error) {
    console.error('❌ Failed to submit cash proposal:', error);
    throw error;
  }
}

// Example 6: Updating booking with new swap preferences
export async function enableSwapForExistingBooking(bookingId: string) {
  const updateRequest: UpdateBookingWithSwapRequest = {
    bookingData: {
      description: 'Updated: Now available for swapping! Flexible dates and great location.',
    },
    swapEnabled: true,
    swapPreferences: {
      paymentTypes: ['booking', 'cash'],
      minCashAmount: 400,
      acceptanceStrategy: 'first-match',
      swapConditions: [
        'Prefer similar or better accommodation',
        'Flexible with dates (+/- 3 days)',
        'Open to different cities',
      ],
    },
  };

  try {
    const result = await unifiedBookingService.updateBookingWithSwap(bookingId, updateRequest);
    
    console.log('✅ Booking updated with swap preferences:', {
      bookingId: result.booking.id,
      swapEnabled: !!result.swap,
      swapId: result.swap?.id,
    });

    return result;
  } catch (error) {
    console.error('❌ Failed to update booking with swap:', error);
    throw error;
  }
}

// Example 7: Disabling swap for existing booking
export async function disableSwapForBooking(bookingId: string) {
  const updateRequest: UpdateBookingWithSwapRequest = {
    bookingData: {
      description: 'Updated: No longer available for swapping.',
    },
    swapEnabled: false,
  };

  try {
    const result = await unifiedBookingService.updateBookingWithSwap(bookingId, updateRequest);
    
    console.log('✅ Swap disabled for booking:', {
      bookingId: result.booking.id,
      swapEnabled: !!result.swap,
    });

    return result;
  } catch (error) {
    console.error('❌ Failed to disable swap:', error);
    throw error;
  }
}

// Example 8: Getting user's available bookings for proposals
export async function getUserBookingsForSwap(userId: string, excludeBookingId?: string) {
  try {
    const availableBookings = await unifiedBookingService.getUserAvailableBookings(
      userId,
      excludeBookingId
    );
    
    console.log(`📚 User has ${availableBookings.length} available bookings for swapping:`);
    
    availableBookings.forEach((booking, index) => {
      console.log(`${index + 1}. ${booking.title}`);
      console.log(`   📅 ${booking.dateRange.checkIn.toDateString()} - ${booking.dateRange.checkOut.toDateString()}`);
      console.log(`   💰 $${booking.originalPrice}`);
      console.log(`   ✅ Status: ${booking.status} | Verified: ${booking.verification.status}`);
      console.log('');
    });

    return availableBookings;
  } catch (error) {
    console.error('❌ Failed to get user bookings:', error);
    throw error;
  }
}

// Example 9: Determining user role for a booking
export async function checkUserRoleForBooking(bookingId: string, userId: string) {
  try {
    const role = await unifiedBookingService.getUserRoleForBooking(bookingId, userId);
    
    console.log(`👤 User role for booking ${bookingId}: ${role}`);
    
    switch (role) {
      case 'owner':
        console.log('   🏠 You own this booking - you can manage swap settings');
        break;
      case 'proposer':
        console.log('   📝 You have made proposals for this booking');
        break;
      case 'browser':
        console.log('   👀 You can view and make proposals for this booking');
        break;
    }

    return role;
  } catch (error) {
    console.error('❌ Failed to determine user role:', error);
    throw error;
  }
}

// Example 10: Complete workflow - Create, Browse, Propose
export async function completeSwapWorkflow() {
  const currentUserId = 'user-123';
  
  try {
    console.log('🚀 Starting complete swap workflow...\n');

    // Step 1: Create a booking with swap enabled
    console.log('Step 1: Creating booking with swap preferences...');
    const newBooking = await createHotelBookingWithSwap();
    
    // Step 2: Browse available swappable bookings
    console.log('\nStep 2: Browsing swappable bookings...');
    const availableBookings = await browseSwappableBookings(currentUserId);
    
    if (availableBookings.length > 0) {
      const targetBooking = availableBookings[0];
      
      // Step 3: Check user role for target booking
      console.log('\nStep 3: Checking user role...');
      const userRole = await checkUserRoleForBooking(targetBooking.id, currentUserId);
      
      if (userRole === 'browser') {
        // Step 4: Get user's available bookings
        console.log('\nStep 4: Getting user\'s available bookings...');
        const userBookings = await getUserBookingsForSwap(currentUserId, newBooking.booking.id);
        
        if (userBookings.length > 0) {
          // Step 5: Make a booking proposal
          console.log('\nStep 5: Making booking proposal...');
          await makeBookingProposal(targetBooking.id, userBookings[0].id);
        } else {
          // Step 5: Make a cash proposal instead
          console.log('\nStep 5: Making cash proposal (no available bookings)...');
          await makeCashProposal(targetBooking.id);
        }
      }
    }
    
    console.log('\n✅ Complete workflow finished successfully!');
    
  } catch (error) {
    console.error('❌ Workflow failed:', error);
    throw error;
  }
}

// Export all examples for easy testing
export const examples = {
  createHotelBookingWithSwap,
  createSimpleEventBooking,
  browseSwappableBookings,
  makeBookingProposal,
  makeCashProposal,
  enableSwapForExistingBooking,
  disableSwapForBooking,
  getUserBookingsForSwap,
  checkUserRoleForBooking,
  completeSwapWorkflow,
};