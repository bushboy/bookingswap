import React, { useState } from 'react';
import { BookingCard } from './BookingCard';
import { BookingWithSwapInfo, BookingUserRole, SwapInfo, InlineProposalData } from '@booking-swap/shared';

/**
 * Example usage of the enhanced BookingCard component
 * Demonstrates the new swap integration features
 */

// Mock data for demonstration
const mockBookingWithSwap: BookingWithSwapInfo = {
  id: 'booking-1',
  userId: 'user-1',
  type: 'hotel',
  title: 'Luxury Hotel in Manhattan',
  description: 'Beautiful 5-star hotel with city views',
  location: {
    city: 'New York',
    country: 'USA',
    address: '123 Broadway, New York, NY',
    coordinates: { lat: 40.7128, lng: -74.0060 }
  },
  dateRange: {
    checkIn: new Date('2024-07-15'),
    checkOut: new Date('2024-07-18')
  },
  originalPrice: 800,
  swapValue: 720,
  providerDetails: {
    name: 'Grand Manhattan Hotel',
    confirmationNumber: 'GMH789456'
  },
  status: 'available',
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
  swapInfo: {
    swapId: 'swap-1',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'auction',
    auctionEndDate: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours from now
    minCashAmount: 300,
    maxCashAmount: 600,
    hasActiveProposals: true,
    activeProposalCount: 3,
    userProposalStatus: 'none',
    timeRemaining: 5 * 60 * 60 * 1000, // 5 hours in milliseconds
    swapConditions: ['Must be in NYC area', 'Similar star rating preferred']
  }
};

const mockBookingWithoutSwap: BookingWithSwapInfo = {
  ...mockBookingWithSwap,
  id: 'booking-2',
  title: 'Beach Resort in Miami',
  swapInfo: undefined
};

const mockUrgentAuctionBooking: BookingWithSwapInfo = {
  ...mockBookingWithSwap,
  id: 'booking-3',
  title: 'Concert Tickets - Last Chance!',
  type: 'event',
  swapInfo: {
    ...mockBookingWithSwap.swapInfo!,
    acceptanceStrategy: 'auction',
    timeRemaining: 1.5 * 60 * 60 * 1000, // 1.5 hours - urgent!
    activeProposalCount: 8
  }
};

export const EnhancedBookingCardExample: React.FC = () => {
  const [userRole, setUserRole] = useState<BookingUserRole>('browser');
  const [showInlineProposal, setShowInlineProposal] = useState(true);
  const [showSwapIndicators, setShowSwapIndicators] = useState(true);
  const [compact, setCompact] = useState(false);

  const handleInlineProposal = async (bookingId: string, proposalData: InlineProposalData) => {
    console.log('Inline proposal submitted:', { bookingId, proposalData });
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    alert(`Proposal submitted for booking ${bookingId}!\nType: ${proposalData.type}\nAmount: ${proposalData.cashAmount || 'N/A'}`);
  };

  const handleViewDetails = (booking: any) => {
    console.log('View details for booking:', booking.id);
    alert(`Viewing details for: ${booking.title}`);
  };

  const handleMakeProposal = () => {
    console.log('Make proposal clicked');
    alert('Opening proposal form...');
  };

  const handleManageSwap = (swapInfo: SwapInfo) => {
    console.log('Manage swap:', swapInfo.swapId);
    alert(`Managing swap: ${swapInfo.swapId}`);
  };

  const controlsStyle = {
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    marginBottom: '20px',
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '15px',
    alignItems: 'center'
  };

  const cardContainerStyle = {
    display: 'grid',
    gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(300px, 1fr))' : 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '20px',
    padding: '20px'
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>Enhanced BookingCard Component Examples</h1>
      
      {/* Controls */}
      <div style={controlsStyle}>
        <div>
          <label style={{ marginRight: '10px' }}>User Role:</label>
          <select 
            value={userRole} 
            onChange={(e) => setUserRole(e.target.value as BookingUserRole)}
            style={{ padding: '5px' }}
          >
            <option value="browser">Browser</option>
            <option value="owner">Owner</option>
            <option value="proposer">Proposer</option>
          </select>
        </div>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input
            type="checkbox"
            checked={showInlineProposal}
            onChange={(e) => setShowInlineProposal(e.target.checked)}
          />
          Show Inline Proposal
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input
            type="checkbox"
            checked={showSwapIndicators}
            onChange={(e) => setShowSwapIndicators(e.target.checked)}
          />
          Show Swap Indicators
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input
            type="checkbox"
            checked={compact}
            onChange={(e) => setCompact(e.target.checked)}
          />
          Compact Mode
        </label>
      </div>

      {/* Example Cards */}
      <div style={cardContainerStyle}>
        {/* Regular booking with swap */}
        <div>
          <h3>Booking with Active Swap</h3>
          <BookingCard
            booking={mockBookingWithSwap}
            userRole={userRole}
            compact={compact}
            showInlineProposal={showInlineProposal}
            showSwapIndicators={showSwapIndicators}
            onViewDetails={handleViewDetails}
            onMakeProposal={handleMakeProposal}
            onManageSwap={handleManageSwap}
            onInlineProposal={handleInlineProposal}
          />
        </div>

        {/* Urgent auction booking */}
        <div>
          <h3>Urgent Auction (Ending Soon)</h3>
          <BookingCard
            booking={mockUrgentAuctionBooking}
            userRole={userRole}
            compact={compact}
            showInlineProposal={showInlineProposal}
            showSwapIndicators={showSwapIndicators}
            onViewDetails={handleViewDetails}
            onMakeProposal={handleMakeProposal}
            onManageSwap={handleManageSwap}
            onInlineProposal={handleInlineProposal}
          />
        </div>

        {/* Booking without swap */}
        <div>
          <h3>Regular Booking (No Swap)</h3>
          <BookingCard
            booking={mockBookingWithoutSwap}
            userRole={userRole}
            compact={compact}
            showInlineProposal={showInlineProposal}
            showSwapIndicators={showSwapIndicators}
            onViewDetails={handleViewDetails}
            onMakeProposal={handleMakeProposal}
            onManageSwap={handleManageSwap}
            onInlineProposal={handleInlineProposal}
          />
        </div>
      </div>

      {/* Feature Highlights */}
      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#e8f4fd', borderRadius: '8px' }}>
        <h2>Enhanced Features Demonstrated</h2>
        <ul style={{ lineHeight: '1.6' }}>
          <li><strong>Visual Swap Indicators:</strong> Payment type badges, auction countdown overlays, and status badges</li>
          <li><strong>Inline Proposal Forms:</strong> Submit proposals directly from the card without navigation</li>
          <li><strong>Role-Based Actions:</strong> Different action buttons based on user relationship to booking</li>
          <li><strong>Urgency Indicators:</strong> Special highlighting for auctions ending soon</li>
          <li><strong>Compact Mode:</strong> Optimized layout for mobile and dense listings</li>
          <li><strong>Quick Swap Summary:</strong> Essential swap info at a glance</li>
          <li><strong>Enhanced Visual Design:</strong> Better use of colors, icons, and spacing</li>
        </ul>
      </div>
    </div>
  );
};

export default EnhancedBookingCardExample;