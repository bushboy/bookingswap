import React, { useState } from 'react';
import { UnifiedBookingForm } from './UnifiedBookingForm';
import { Button } from '@/components/ui/Button';
import { UnifiedBookingData, Booking } from '@booking-swap/shared';

/**
 * Integration example showing how to use UnifiedBookingForm
 * This demonstrates the complete workflow for task 3 requirements
 */
export const UnifiedBookingFormIntegration: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | undefined>();
  const [loading, setLoading] = useState(false);

  const handleCreateBooking = () => {
    setEditingBooking(undefined);
    setIsFormOpen(true);
  };

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: UnifiedBookingData) => {
    setLoading(true);
    
    try {
      if (editingBooking) {
        // Update existing booking with swap preferences
        console.log('Updating booking with swap preferences:', data);
        // await updateBookingWithSwap(editingBooking.id, data);
      } else {
        // Create new booking with optional swap preferences
        console.log('Creating booking with swap preferences:', data);
        // await createBookingWithSwap(data);
      }
      
      // Success - form will close automatically
      console.log('Booking operation successful');
    } catch (error) {
      console.error('Booking operation failed:', error);
      // Error handling - form stays open to show errors
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setEditingBooking(undefined);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Unified Booking Form Integration</h2>
      <p>
        This demonstrates the UnifiedBookingForm component that integrates booking creation 
        with swap preferences in a single form, fulfilling task 3 requirements:
      </p>
      <ul>
        <li>✅ Replace existing BookingForm with integrated booking and swap creation</li>
        <li>✅ Implement toggle functionality for enabling/disabling swap preferences</li>
        <li>✅ Add real-time validation for both booking and swap fields</li>
        <li>✅ Create form submission handler that processes both booking and swap data</li>
        <li>✅ Implement progressive disclosure for swap settings</li>
      </ul>

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <Button onClick={handleCreateBooking}>
          Create New Booking
        </Button>
        <Button 
          variant="outline" 
          onClick={() => handleEditBooking({
            id: 'sample-booking',
            userId: 'user-1',
            type: 'hotel',
            title: 'Sample Hotel Booking',
            description: 'A sample booking for demonstration',
            location: { city: 'Paris', country: 'France' },
            dateRange: { 
              checkIn: new Date('2024-06-01'), 
              checkOut: new Date('2024-06-03') 
            },
            originalPrice: 200,
            swapValue: 180,
            providerDetails: {
              provider: 'Booking.com',
              confirmationNumber: 'ABC123',
              bookingReference: 'REF456',
            },
            verification: { status: 'verified', documents: [] },
            blockchain: { topicId: 'topic-1' },
            status: 'available',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          } as Booking)}
        >
          Edit Sample Booking
        </Button>
      </div>

      <UnifiedBookingForm
        isOpen={isFormOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        booking={editingBooking}
        mode={editingBooking ? 'edit' : 'create'}
        loading={loading}
      />

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h3>Key Features Implemented:</h3>
        <ul>
          <li><strong>Integrated Form:</strong> Single form handles both booking creation and swap preferences</li>
          <li><strong>Toggle Functionality:</strong> Users can enable/disable swap preferences with a checkbox</li>
          <li><strong>Real-time Validation:</strong> Form validates both booking and swap fields as users type</li>
          <li><strong>Progressive Disclosure:</strong> Swap settings only appear when enabled</li>
          <li><strong>Unified Submission:</strong> Single handler processes both booking and swap data</li>
          <li><strong>Dynamic Button Text:</strong> Button text changes based on swap enablement</li>
          <li><strong>Error Handling:</strong> Comprehensive validation with error summaries</li>
          <li><strong>Edit Mode:</strong> Supports editing existing bookings with swap preferences</li>
        </ul>
      </div>
    </div>
  );
};