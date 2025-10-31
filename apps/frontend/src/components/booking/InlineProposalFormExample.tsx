import React, { useState } from 'react';
import { InlineProposalForm } from './InlineProposalForm';
import { BookingWithSwapInfo, InlineProposalData } from '@booking-swap/shared';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';

// Example booking data for demonstration
const exampleBooking: BookingWithSwapInfo = {
  id: 'booking-example-1',
  title: 'Luxury Hotel in Paris',
  description: 'Beautiful 5-star hotel in the heart of Paris with amazing city views',
  type: 'hotel',
  location: {
    city: 'Paris',
    country: 'France',
    address: '123 Champs-Élysées',
    coordinates: { lat: 48.8566, lng: 2.3522 },
  },
  dateRange: {
    checkIn: new Date('2024-07-15'),
    checkOut: new Date('2024-07-20'),
  },
  originalPrice: 800,
  swapValue: 750,
  providerDetails: {
    provider: 'Hotel Luxe Paris',
    confirmationNumber: 'PAR123456',
    bookingReference: 'LUXE789',
  },
  status: 'available',
  verification: {
    status: 'verified',
    verifiedAt: new Date().toISOString(),
  },
  userId: 'user-owner-123',
  createdAt: new Date().toISOString(),
  swapInfo: {
    swapId: 'swap-example-1',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'auction',
    auctionEndDate: new Date('2024-07-08'),
    minCashAmount: 200,
    maxCashAmount: 900,
    hasActiveProposals: true,
    activeProposalCount: 3,
    swapConditions: ['Non-smoking room preferred', 'Flexible check-in time'],
  },
};

export const InlineProposalFormExample: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [submittedProposal, setSubmittedProposal] = useState<InlineProposalData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (proposal: InlineProposalData) => {
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Proposal submitted:', proposal);
    setSubmittedProposal(proposal);
    setShowForm(false);
    setIsSubmitting(false);
  };

  const handleCancel = () => {
    setShowForm(false);
  };

  const containerStyles = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: tokens.spacing[6],
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const cardStyles = {
    backgroundColor: 'white',
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing[6],
    marginBottom: tokens.spacing[4],
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  };

  const titleStyles = {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[4],
  };

  const bookingInfoStyles = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacing[4],
    marginBottom: tokens.spacing[4],
  };

  const infoItemStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
  };

  const labelStyles = {
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[700],
  };

  const swapBadgeStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
    padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
    backgroundColor: tokens.colors.primary[100],
    color: tokens.colors.primary[800],
    borderRadius: tokens.borderRadius.full,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    marginBottom: tokens.spacing[4],
  };

  const successMessageStyles = {
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.success[50],
    border: `1px solid ${tokens.colors.success[200]}`,
    borderRadius: tokens.borderRadius.md,
    color: tokens.colors.success[800],
    marginBottom: tokens.spacing[4],
  };

  const proposalDetailsStyles = {
    backgroundColor: tokens.colors.neutral[50],
    padding: tokens.spacing[3],
    borderRadius: tokens.borderRadius.md,
    marginTop: tokens.spacing[2],
  };

  return (
    <div style={containerStyles}>
      <h1 style={titleStyles}>InlineProposalForm Example</h1>
      
      {submittedProposal && (
        <div style={successMessageStyles}>
          <h3 style={{ marginTop: 0, marginRight: 0, marginBottom: tokens.spacing[2], marginLeft: 0 }}>
            ✅ Proposal Submitted Successfully!
          </h3>
          <div style={proposalDetailsStyles}>
            <strong>Proposal Type:</strong> {submittedProposal.type}<br />
            {submittedProposal.type === 'booking' && (
              <>
                <strong>Selected Booking:</strong> {submittedProposal.selectedBookingId}<br />
              </>
            )}
            {submittedProposal.type === 'cash' && (
              <>
                <strong>Cash Amount:</strong> ${submittedProposal.cashAmount}<br />
              </>
            )}
            {submittedProposal.message && (
              <>
                <strong>Message:</strong> {submittedProposal.message}<br />
              </>
            )}
          </div>
        </div>
      )}

      <div style={cardStyles}>
        <div style={swapBadgeStyles}>
          🔄 Available for Swap • Auction Mode • {exampleBooking.swapInfo?.activeProposalCount} proposals
        </div>
        
        <h2 style={{ ...titleStyles, fontSize: tokens.typography.fontSize.lg }}>
          {exampleBooking.title}
        </h2>
        
        <div style={bookingInfoStyles}>
          <div>
            <div style={infoItemStyles}>
              <span style={labelStyles}>Location:</span> {exampleBooking.location.city}, {exampleBooking.location.country}
            </div>
            <div style={infoItemStyles}>
              <span style={labelStyles}>Check-in:</span> {exampleBooking.dateRange.checkIn.toLocaleDateString()}
            </div>
            <div style={infoItemStyles}>
              <span style={labelStyles}>Check-out:</span> {exampleBooking.dateRange.checkOut.toLocaleDateString()}
            </div>
          </div>
          <div>
            <div style={infoItemStyles}>
              <span style={labelStyles}>Original Price:</span> ${exampleBooking.originalPrice}
            </div>
            <div style={infoItemStyles}>
              <span style={labelStyles}>Swap Value:</span> ${exampleBooking.swapValue}
            </div>
            <div style={infoItemStyles}>
              <span style={labelStyles}>Cash Range:</span> ${exampleBooking.swapInfo?.minCashAmount} - ${exampleBooking.swapInfo?.maxCashAmount}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: tokens.spacing[4] }}>
          <div style={infoItemStyles}>
            <span style={labelStyles}>Swap Conditions:</span>
          </div>
          <ul style={{ margin: `${tokens.spacing[1]} 0`, paddingLeft: tokens.spacing[4] }}>
            {exampleBooking.swapInfo?.swapConditions.map((condition, index) => (
              <li key={index} style={infoItemStyles}>{condition}</li>
            ))}
          </ul>
        </div>

        {!showForm && (
          <div style={{ display: 'flex', gap: tokens.spacing[3] }}>
            <Button 
              variant="primary" 
              onClick={() => setShowForm(true)}
              disabled={isSubmitting}
            >
              Make Proposal
            </Button>
            <Button variant="outline">
              View Details
            </Button>
          </div>
        )}

        {showForm && (
          <InlineProposalForm
            booking={exampleBooking}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}
      </div>

      <div style={{ marginTop: tokens.spacing[6], padding: tokens.spacing[4], backgroundColor: tokens.colors.neutral[50], borderRadius: tokens.borderRadius.md }}>
        <h3 style={{ marginTop: 0, marginRight: 0, marginBottom: tokens.spacing[2], marginLeft: 0 }}>Component Features:</h3>
        <ul style={{ margin: 0, paddingLeft: tokens.spacing[4] }}>
          <li>Supports both booking exchange and cash offer proposals</li>
          <li>Automatically fetches user's available bookings for exchange</li>
          <li>Validates cash amounts against min/max limits</li>
          <li>Includes optional message input with character counter</li>
          <li>Provides real-time form validation</li>
          <li>Shows loading states during submission</li>
          <li>Handles errors gracefully with user feedback</li>
          <li>Responsive design that works on mobile and desktop</li>
        </ul>
      </div>
    </div>
  );
};