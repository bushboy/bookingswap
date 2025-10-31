import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BookingsPage } from '../BookingsPage';
import { AuthContext } from '@/contexts/AuthContext';
import { vi } from 'vitest';

// Mock all external dependencies
vi.mock('@/services/UnifiedBookingService', () => ({
  unifiedBookingService: {
    getBookingsWithSwapInfo: vi.fn(),
    createBookingWithSwap: vi.fn(),
    updateBookingWithSwap: vi.fn(),
    makeInlineProposal: vi.fn(),
  },
}));

vi.mock('@/components/booking/UnifiedBookingForm', () => ({
  UnifiedBookingForm: ({ isOpen, onSubmit, onClose, booking, mode }: any) => (
    <div data-testid="unified-booking-form">
      {isOpen && (
        <div>
          <span data-testid="form-mode">{mode}</span>
          <span data-testid="form-booking-id">{booking?.id || 'new'}</span>
          <button 
            onClick={() => onSubmit({ 
              title: booking ? 'Updated Booking' : 'New Booking', 
              swapEnabled: true 
            })}
            data-testid="submit-form"
          >
            Submit
          </button>
          <button onClick={onClose} data-testid="close-form">Close</button>
        </div>
      )}
    </div>
  ),
}));

vi.mock('@/components/booking/MyBookingsFilterBar', () => ({
  MyBookingsFilterBar: ({ currentFilter, bookingCounts, onChange }: any) => (
    <div data-testid="my-bookings-filter-bar">
      <button 
        onClick={() => onChange('all')} 
        data-testid="filter-all"
        className={currentFilter === 'all' ? 'active' : ''}
      >
        All ({bookingCounts.all})
      </button>
      <button 
        onClick={() => onChange('active')} 
        data-testid="filter-active"
        className={currentFilter === 'active' ? 'active' : ''}
      >
        Active ({bookingCounts.active})
      </button>
      <button 
        onClick={() => onChange('with_swaps')} 
        data-testid="filter-with-swaps"
        className={currentFilter === 'with_swaps' ? 'active' : ''}
      >
        With Swaps ({bookingCounts.with_swaps})
      </button>
      <button 
        onClick={() => onChange('completed')} 
        data-testid="filter-completed"
        className={currentFilter === 'completed' ? 'active' : ''}
      >
        Completed ({bookingCounts.completed})
      </button>
      <button 
        onClick={() => onChange('expired')} 
        data-testid="filter-expired"
        className={currentFilter === 'expired' ? 'active' : ''}
      >
        Expired ({bookingCounts.expired})
      </button>
    </div>
  ),
}));

vi.mock('@/components/booking/BookingCard', () => ({
  BookingCard: ({ booking, userRole, onInlineProposal, onEdit, onDelete, onCreateSwap, onViewDetails }: any) => (
    <div data-testid={`booking-card-${booking.id}`} data-user-role={userRole}>
      <h3 data-testid={`booking-title-${booking.id}`}>{booking.title}</h3>
      <span data-testid={`booking-role-${booking.id}`}>Role: {userRole}</span>
      <span data-testid={`booking-status-${booking.id}`}>
        Status: {booking.swapInfo?.userProposalStatus || 'none'}
      </span>
      {userRole === 'browser' && (
        <button 
          onClick={() => onInlineProposal(booking.id, { type: 'cash', cashAmount: 100 })}
          data-testid={`make-proposal-${booking.id}`}
        >
          Make Proposal
        </button>
      )}
      {userRole === 'owner' && (
        <>
          <button onClick={() => onEdit(booking)} data-testid={`edit-${booking.id}`}>
            Edit
          </button>
          <button onClick={() => onDelete(booking.id)} data-testid={`delete-${booking.id}`}>
            Delete
          </button>
          <button onClick={() => onCreateSwap(booking)} data-testid={`create-swap-${booking.id}`}>
            Create Swap
          </button>
          <button onClick={() => onViewDetails(booking)} data-testid={`view-details-${booking.id}`}>
            View Details
          </button>
        </>
      )}
    </div>
  ),
}));

vi.mock('@/components/booking/BookingDetailsModal', () => ({
  BookingDetailsModal: ({ isOpen, onClose, booking }: any) => (
    <div data-testid="booking-details-modal" style={{ display: isOpen ? 'block' : 'none' }}>
      {isOpen && (
        <div>
          <span data-testid="modal-booking-title">{booking?.title}</span>
          <button onClick={onClose} data-testid="close-modal">Close Modal</button>
        </div>
      )}
    </div>
  ),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/bookings' }),
  };
});

// Mock fetch for delete operations
global.fetch = vi.fn();

const mockAuthContext = {
  user: { id: 'user-123', username: 'testuser' },
  token: 'mock-token',
  login: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: true,
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={mockAuthContext}>
        {component}
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('BookingsPage - Functionality Validation After Filter Changes', () => {
  const mockBookingsWithSwapInfo = [
    {
      id: 'booking-1',
      title: 'Active Hotel Booking',
      type: 'hotel',
      status: 'available',
      userId: 'user-123', // Owner booking
      location: { city: 'Paris', country: 'France' },
      dateRange: { 
        checkIn: new Date('2024-06-01'), 
        checkOut: new Date('2024-06-05') 
      },
      originalPrice: 500,
      swapValue: 450,
      description: 'Nice hotel',
      providerDetails: { provider: 'Booking.com', confirmationNumber: '123' },
      verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
      blockchain: { topicId: 'topic-1' },
      createdAt: new Date(),
      updatedAt: new Date(),
      swapInfo: {
        swapId: 'swap-1',
        paymentTypes: ['booking', 'cash'],
        acceptanceStrategy: 'first-match',
        hasActiveProposals: true,
        activeProposalCount: 2,
        minCashAmount: 100,
        userProposalStatus: 'none',
      },
    },
    {
      id: 'booking-2',
      title: 'Expired Booking',
      type: 'hotel',
      status: 'available',
      userId: 'user-123',
      location: { city: 'Rome', country: 'Italy' },
      dateRange: { 
        checkIn: new Date('2023-06-01'), 
        checkOut: new Date('2023-06-05') // Past date - expired
      },
      originalPrice: 300,
      swapValue: 280,
      description: 'Expired booking',
      providerDetails: { provider: 'Hotels.com', confirmationNumber: '456' },
      verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
      blockchain: { topicId: 'topic-2' },
      createdAt: new Date(),
      updatedAt: new Date(),
      swapInfo: null,
    },
    {
      id: 'booking-3',
      title: 'Completed Swap Booking',
      type: 'hotel',
      status: 'available',
      userId: 'user-123',
      location: { city: 'London', country: 'UK' },
      dateRange: { 
        checkIn: new Date('2024-07-01'), 
        checkOut: new Date('2024-07-05') 
      },
      originalPrice: 400,
      swapValue: 380,
      description: 'Completed swap',
      providerDetails: { provider: 'Expedia', confirmationNumber: '789' },
      verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
      blockchain: { topicId: 'topic-3' },
      createdAt: new Date(),
      updatedAt: new Date(),
      swapInfo: {
        swapId: 'swap-3',
        paymentTypes: ['booking'],
        acceptanceStrategy: 'first-match',
        hasActiveProposals: false,
        activeProposalCount: 0,
        userProposalStatus: 'accepted', // Completed swap
      },
    },
    {
      id: 'booking-4',
      title: 'Simple Active Booking',
      type: 'hotel',
      status: 'available',
      userId: 'user-123',
      location: { city: 'Barcelona', country: 'Spain' },
      dateRange: { 
        checkIn: new Date('2024-08-01'), 
        checkOut: new Date('2024-08-05') 
      },
      originalPrice: 250,
      swapValue: 230,
      description: 'Simple booking without swaps',
      providerDetails: { provider: 'Airbnb', confirmationNumber: '999' },
      verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
      blockchain: { topicId: 'topic-4' },
      createdAt: new Date(),
      updatedAt: new Date(),
      swapInfo: null, // No swap info - should be "active"
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Import and mock the service
    const { unifiedBookingService } = require('@/services/UnifiedBookingService');
    unifiedBookingService.getBookingsWithSwapInfo.mockResolvedValue(mockBookingsWithSwapInfo);
    unifiedBookingService.createBookingWithSwap.mockResolvedValue({
      booking: { id: 'new-booking', title: 'New Booking' },
      swap: { id: 'new-swap' },
    });
    unifiedBookingService.updateBookingWithSwap.mockResolvedValue({
      booking: { id: 'booking-1', title: 'Updated Booking' },
      swap: { id: 'swap-1' },
    });
    unifiedBookingService.makeInlineProposal.mockResolvedValue({
      id: 'proposal-1',
      status: 'pending',
    });

    // Mock successful delete
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Booking deleted' }),
    });
  });

  describe('Task 6.1: Verify booking management features work after filter changes', () => {
    it('should render My Bookings page with new simplified filter bar', async () => {
      renderWithProviders(<BookingsPage />);

      // Check main page elements
      expect(screen.getByText('My Bookings')).toBeInTheDocument();
      expect(screen.getByTestId('my-bookings-filter-bar')).toBeInTheDocument();
      expect(screen.getByText('Add New Booking')).toBeInTheDocument();

      // Wait for bookings to load
      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Verify all bookings are displayed initially
      expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      expect(screen.getByTestId('booking-card-booking-2')).toBeInTheDocument();
      expect(screen.getByTestId('booking-card-booking-3')).toBeInTheDocument();
      expect(screen.getByTestId('booking-card-booking-4')).toBeInTheDocument();
    });

    it('should display correct filter counts based on booking status', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-all')).toBeInTheDocument();
      });

      // Verify filter counts
      expect(screen.getByTestId('filter-all')).toHaveTextContent('All (4)');
      expect(screen.getByTestId('filter-active')).toHaveTextContent('Active (1)'); // booking-4
      expect(screen.getByTestId('filter-with-swaps')).toHaveTextContent('With Swaps (1)'); // booking-1
      expect(screen.getByTestId('filter-completed')).toHaveTextContent('Completed (1)'); // booking-3
      expect(screen.getByTestId('filter-expired')).toHaveTextContent('Expired (1)'); // booking-2
    });

    it('should filter bookings correctly by status', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Test "With Swaps" filter
      fireEvent.click(screen.getByTestId('filter-with-swaps'));
      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument(); // Has active swaps
        expect(screen.queryByTestId('booking-card-booking-2')).not.toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-3')).not.toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-4')).not.toBeInTheDocument();
      });

      // Test "Expired" filter
      fireEvent.click(screen.getByTestId('filter-expired'));
      await waitFor(() => {
        expect(screen.queryByTestId('booking-card-booking-1')).not.toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-2')).toBeInTheDocument(); // Expired
        expect(screen.queryByTestId('booking-card-booking-3')).not.toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-4')).not.toBeInTheDocument();
      });

      // Test "Completed" filter
      fireEvent.click(screen.getByTestId('filter-completed'));
      await waitFor(() => {
        expect(screen.queryByTestId('booking-card-booking-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-2')).not.toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-3')).toBeInTheDocument(); // Completed swap
        expect(screen.queryByTestId('booking-card-booking-4')).not.toBeInTheDocument();
      });

      // Test "Active" filter
      fireEvent.click(screen.getByTestId('filter-active'));
      await waitFor(() => {
        expect(screen.queryByTestId('booking-card-booking-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-2')).not.toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-3')).not.toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-4')).toBeInTheDocument(); // Simple active
      });

      // Test "All" filter
      fireEvent.click(screen.getByTestId('filter-all'));
      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-2')).toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-3')).toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-4')).toBeInTheDocument();
      });
    });
  });

  describe('Task 6.2: Test booking creation, editing, deletion with simplified filtering', () => {
    it('should create new booking successfully', async () => {
      renderWithProviders(<BookingsPage />);

      // Click create booking button
      fireEvent.click(screen.getByText('Add New Booking'));

      // Form should open
      expect(screen.getByTestId('unified-booking-form')).toBeInTheDocument();
      expect(screen.getByTestId('form-mode')).toHaveTextContent('create');

      // Submit form
      fireEvent.click(screen.getByTestId('submit-form'));

      // Should call create service
      await waitFor(() => {
        const { unifiedBookingService } = require('@/services/UnifiedBookingService');
        expect(unifiedBookingService.createBookingWithSwap).toHaveBeenCalledWith({
          title: 'New Booking',
          swapEnabled: true,
        });
      });
    });

    it('should edit existing booking successfully', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Click edit button
      fireEvent.click(screen.getByTestId('edit-booking-1'));

      // Form should open in edit mode
      expect(screen.getByTestId('unified-booking-form')).toBeInTheDocument();
      expect(screen.getByTestId('form-mode')).toHaveTextContent('edit');
      expect(screen.getByTestId('form-booking-id')).toHaveTextContent('booking-1');

      // Submit form
      fireEvent.click(screen.getByTestId('submit-form'));

      // Should call update service
      await waitFor(() => {
        const { unifiedBookingService } = require('@/services/UnifiedBookingService');
        expect(unifiedBookingService.updateBookingWithSwap).toHaveBeenCalledWith(
          'booking-1',
          expect.any(Object)
        );
      });
    });

    it('should delete booking successfully', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Click delete button
      fireEvent.click(screen.getByTestId('delete-booking-1'));

      // Should call delete API
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/bookings/booking-1',
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-token',
            }),
          })
        );
      });
    });

    it('should maintain filter state during booking operations', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Apply filter
      fireEvent.click(screen.getByTestId('filter-with-swaps'));
      
      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-4')).not.toBeInTheDocument();
      });

      // Open and close booking form
      fireEvent.click(screen.getByText('Add New Booking'));
      expect(screen.getByTestId('unified-booking-form')).toBeInTheDocument();
      
      fireEvent.click(screen.getByTestId('close-form'));
      
      // Filter should still be active
      await waitFor(() => {
        expect(screen.getByTestId('filter-with-swaps')).toHaveClass('active');
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-4')).not.toBeInTheDocument();
      });
    });
  });

  describe('Task 6.3: Ensure swap management functionality remains intact', () => {
    it('should handle swap creation navigation', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Click create swap button
      fireEvent.click(screen.getByTestId('create-swap-booking-1'));

      // Should navigate to swaps page with booking parameter
      expect(mockNavigate).toHaveBeenCalledWith('/swaps?booking=booking-1');
    });

    it('should handle inline proposals for browser role bookings', async () => {
      // Mock booking from another user
      const otherUserBooking = {
        ...mockBookingsWithSwapInfo[0],
        userId: 'other-user',
      };

      const { unifiedBookingService } = require('@/services/UnifiedBookingService');
      unifiedBookingService.getBookingsWithSwapInfo.mockResolvedValue([otherUserBooking]);

      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
        expect(screen.getByTestId('booking-role-booking-1')).toHaveTextContent('Role: browser');
      });

      // Click make proposal button
      fireEvent.click(screen.getByTestId('make-proposal-booking-1'));

      // Should call inline proposal service
      await waitFor(() => {
        expect(unifiedBookingService.makeInlineProposal).toHaveBeenCalledWith(
          'booking-1',
          { type: 'cash', cashAmount: 100 }
        );
      });
    });

    it('should display booking details modal', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Modal should be hidden initially
      expect(screen.getByTestId('booking-details-modal')).toHaveStyle('display: none');

      // Click view details button
      fireEvent.click(screen.getByTestId('view-details-booking-1'));

      // Modal should open
      expect(screen.getByTestId('booking-details-modal')).toHaveStyle('display: block');
      expect(screen.getByTestId('modal-booking-title')).toHaveTextContent('Active Hotel Booking');
    });

    it('should correctly determine user roles for swap functionality', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // User owns this booking - should be owner role
      expect(screen.getByTestId('booking-role-booking-1')).toHaveTextContent('Role: owner');
      
      // Owner should see management buttons
      expect(screen.getByTestId('edit-booking-1')).toBeInTheDocument();
      expect(screen.getByTestId('delete-booking-1')).toBeInTheDocument();
      expect(screen.getByTestId('create-swap-booking-1')).toBeInTheDocument();
      expect(screen.getByTestId('view-details-booking-1')).toBeInTheDocument();
      
      // Should not see proposal button for own booking
      expect(screen.queryByTestId('make-proposal-booking-1')).not.toBeInTheDocument();
    });
  });

  describe('Task 6.4: Validate real-time updates and error handling continue to work', () => {
    it('should show real-time update timestamp', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });

    it('should handle loading states correctly', async () => {
      const { unifiedBookingService } = require('@/services/UnifiedBookingService');
      
      // Mock loading state
      unifiedBookingService.getBookingsWithSwapInfo.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      renderWithProviders(<BookingsPage />);

      // Should show loading state
      expect(screen.getByText('Loading your bookings...')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading your bookings...')).not.toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('should handle error states with retry functionality', async () => {
      const { unifiedBookingService } = require('@/services/UnifiedBookingService');
      
      // Mock error state
      unifiedBookingService.getBookingsWithSwapInfo.mockRejectedValue(
        new Error('Network connection failed')
      );

      renderWithProviders(<BookingsPage />);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Unable to load your bookings: Network connection failed/)).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      // Mock successful retry
      unifiedBookingService.getBookingsWithSwapInfo.mockResolvedValue(mockBookingsWithSwapInfo);

      // Click retry
      fireEvent.click(screen.getByText('Retry'));

      // Should load bookings successfully
      await waitFor(() => {
        expect(screen.queryByText(/Unable to load your bookings/)).not.toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });
    });

    it('should handle booking operation errors gracefully', async () => {
      const { unifiedBookingService } = require('@/services/UnifiedBookingService');
      
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Mock delete error
      (global.fetch as any).mockRejectedValue(new Error('Delete failed'));

      // Try to delete booking
      fireEvent.click(screen.getByTestId('delete-booking-1'));

      // Should handle error gracefully (component should still be functional)
      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });
    });

    it('should validate booking status determination logic works correctly', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Verify status determination for each booking type
      expect(screen.getByTestId('booking-status-booking-1')).toHaveTextContent('Status: none'); // Has swaps but no user proposal
      expect(screen.getByTestId('booking-status-booking-2')).toHaveTextContent('Status: none'); // Expired, no swap info
      expect(screen.getByTestId('booking-status-booking-3')).toHaveTextContent('Status: accepted'); // Completed swap
      expect(screen.getByTestId('booking-status-booking-4')).toHaveTextContent('Status: none'); // Active, no swaps

      // Test that filtering works based on these statuses
      fireEvent.click(screen.getByTestId('filter-completed'));
      
      await waitFor(() => {
        // Only booking-3 should be visible (completed swap)
        expect(screen.queryByTestId('booking-card-booking-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-2')).not.toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-3')).toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-4')).not.toBeInTheDocument();
      });
    });

    it('should maintain functionality during real-time updates', async () => {
      const { unifiedBookingService } = require('@/services/UnifiedBookingService');
      
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Simulate real-time update by changing mock data
      const updatedBookings = [
        ...mockBookingsWithSwapInfo,
        {
          id: 'booking-5',
          title: 'New Real-time Booking',
          type: 'hotel',
          status: 'available',
          userId: 'user-123',
          location: { city: 'Madrid', country: 'Spain' },
          dateRange: { 
            checkIn: new Date('2024-09-01'), 
            checkOut: new Date('2024-09-05') 
          },
          originalPrice: 350,
          swapValue: 320,
          description: 'New booking from real-time update',
          providerDetails: { provider: 'Booking.com', confirmationNumber: '555' },
          verification: { status: 'verified', verifiedAt: new Date(), documents: [] },
          blockchain: { topicId: 'topic-5' },
          createdAt: new Date(),
          updatedAt: new Date(),
          swapInfo: null,
        },
      ];

      unifiedBookingService.getBookingsWithSwapInfo.mockResolvedValue(updatedBookings);

      // Trigger a manual refresh (simulating real-time update)
      fireEvent.click(screen.getByText('Retry')); // Using retry button to trigger refresh

      // Should show new booking
      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-5')).toBeInTheDocument();
        expect(screen.getByTestId('booking-title-booking-5')).toHaveTextContent('New Real-time Booking');
      });

      // Filter counts should update
      expect(screen.getByTestId('filter-all')).toHaveTextContent('All (5)');
      expect(screen.getByTestId('filter-active')).toHaveTextContent('Active (2)'); // booking-4 + booking-5
    });
  });

  describe('Integration: Complete workflow validation', () => {
    it('should handle complete booking management workflow with filtering', async () => {
      renderWithProviders(<BookingsPage />);

      // 1. Initial load
      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // 2. Apply filter
      fireEvent.click(screen.getByTestId('filter-active'));
      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-4')).toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-1')).not.toBeInTheDocument();
      });

      // 3. Create new booking
      fireEvent.click(screen.getByText('Add New Booking'));
      fireEvent.click(screen.getByTestId('submit-form'));

      // 4. Edit existing booking
      fireEvent.click(screen.getByTestId('filter-all')); // Show all bookings
      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('edit-booking-1'));
      fireEvent.click(screen.getByTestId('submit-form'));

      // 5. View booking details
      fireEvent.click(screen.getByTestId('view-details-booking-1'));
      expect(screen.getByTestId('booking-details-modal')).toHaveStyle('display: block');
      
      fireEvent.click(screen.getByTestId('close-modal'));
      expect(screen.getByTestId('booking-details-modal')).toHaveStyle('display: none');

      // 6. Create swap
      fireEvent.click(screen.getByTestId('create-swap-booking-1'));
      expect(mockNavigate).toHaveBeenCalledWith('/swaps?booking=booking-1');

      // All operations should have completed successfully
      const { unifiedBookingService } = require('@/services/UnifiedBookingService');
      expect(unifiedBookingService.createBookingWithSwap).toHaveBeenCalled();
      expect(unifiedBookingService.updateBookingWithSwap).toHaveBeenCalled();
    });
  });
});