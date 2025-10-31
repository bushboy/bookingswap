import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BookingsPage } from '../BookingsPage';
import { AuthContext } from '@/contexts/AuthContext';
import { unifiedBookingService } from '@/services/UnifiedBookingService';
import { vi } from 'vitest';

// Mock the unified booking service
vi.mock('@/services/UnifiedBookingService', () => ({
  unifiedBookingService: {
    getBookingsWithSwapInfo: vi.fn(),
    createBookingWithSwap: vi.fn(),
    updateBookingWithSwap: vi.fn(),
    makeInlineProposal: vi.fn(),
  },
}));

// Mock the components
vi.mock('@/components/booking/UnifiedBookingForm', () => ({
  UnifiedBookingForm: ({ isOpen, onSubmit, onClose }: any) => (
    <div data-testid="unified-booking-form">
      {isOpen && (
        <div>
          <button onClick={() => onSubmit({ title: 'Test Booking', swapEnabled: true })}>
            Submit
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      )}
    </div>
  ),
}));

// Mock the NEW MyBookingsFilterBar component (not IntegratedFilterPanel)
vi.mock('@/components/booking/MyBookingsFilterBar', () => ({
  MyBookingsFilterBar: ({ currentFilter, bookingCounts, onChange }: any) => (
    <div data-testid="my-bookings-filter-bar">
      <button onClick={() => onChange('all')} data-testid="filter-all">
        All ({bookingCounts.all})
      </button>
      <button onClick={() => onChange('active')} data-testid="filter-active">
        Active ({bookingCounts.active})
      </button>
      <button onClick={() => onChange('with_swaps')} data-testid="filter-with-swaps">
        With Swaps ({bookingCounts.with_swaps})
      </button>
      <button onClick={() => onChange('completed')} data-testid="filter-completed">
        Completed ({bookingCounts.completed})
      </button>
      <button onClick={() => onChange('expired')} data-testid="filter-expired">
        Expired ({bookingCounts.expired})
      </button>
    </div>
  ),
}));

vi.mock('@/components/booking/BookingCard', () => ({
  BookingCard: ({ booking, userRole, onInlineProposal, onEdit, onDelete, onCreateSwap, onViewDetails }: any) => (
    <div data-testid={`booking-card-${booking.id}`}>
      <h3>{booking.title}</h3>
      <span>Role: {userRole}</span>
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
  BookingDetailsModal: ({ isOpen, onClose }: any) => (
    <div data-testid="booking-details-modal">
      {isOpen && (
        <div>
          <button onClick={onClose}>Close Modal</button>
        </div>
      )}
    </div>
  ),
}));

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

describe('Enhanced BookingsPage - Functionality Validation', () => {
  const mockBookingsWithSwapInfo = [
    {
      id: 'booking-1',
      title: 'Test Hotel Booking',
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
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (unifiedBookingService.getBookingsWithSwapInfo as any).mockResolvedValue(
      mockBookingsWithSwapInfo
    );
  });

  describe('Core Functionality Validation', () => {
    it('should render My Bookings page with simplified filter bar', async () => {
      renderWithProviders(<BookingsPage />);

      // Check that the main components are rendered
      expect(screen.getByText('My Bookings')).toBeInTheDocument();
      expect(screen.getByTestId('my-bookings-filter-bar')).toBeInTheDocument();
      expect(screen.getByTestId('unified-booking-form')).toBeInTheDocument();

      // Wait for bookings to load
      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Check that booking information is displayed
      expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
      expect(screen.getByText('Role: owner')).toBeInTheDocument(); // User owns this booking
    });

    it('should handle simplified status-based filtering', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('my-bookings-filter-bar')).toBeInTheDocument();
      });

      // Check filter counts are displayed
      expect(screen.getByTestId('filter-all')).toHaveTextContent('All (3)');
      expect(screen.getByTestId('filter-active')).toHaveTextContent('Active (1)');
      expect(screen.getByTestId('filter-with-swaps')).toHaveTextContent('With Swaps (1)');
      expect(screen.getByTestId('filter-completed')).toHaveTextContent('Completed (1)');
      expect(screen.getByTestId('filter-expired')).toHaveTextContent('Expired (1)');

      // Test filtering by status
      fireEvent.click(screen.getByTestId('filter-with-swaps'));

      // Should show only bookings with active swaps
      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-2')).not.toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-3')).not.toBeInTheDocument();
      });
    });

    it('should handle booking creation successfully', async () => {
      (unifiedBookingService.createBookingWithSwap as any).mockResolvedValue({
        booking: { id: 'new-booking', title: 'Test Booking' },
        swap: { id: 'new-swap' },
      });

      renderWithProviders(<BookingsPage />);

      // Open booking form
      fireEvent.click(screen.getByText('Add New Booking'));

      // Submit form
      fireEvent.click(screen.getByText('Submit'));

      // Should call the unified service
      await waitFor(() => {
        expect(unifiedBookingService.createBookingWithSwap).toHaveBeenCalledWith({
          title: 'Test Booking',
          swapEnabled: true,
        });
      });
    });

    it('should handle booking editing successfully', async () => {
      (unifiedBookingService.updateBookingWithSwap as any).mockResolvedValue({
        booking: { id: 'booking-1', title: 'Updated Booking' },
        swap: { id: 'swap-1' },
      });

      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Click edit button
      fireEvent.click(screen.getByTestId('edit-booking-1'));

      // Form should open in edit mode
      expect(screen.getByTestId('unified-booking-form')).toBeInTheDocument();

      // Submit form
      fireEvent.click(screen.getByText('Submit'));

      // Should call the update service
      await waitFor(() => {
        expect(unifiedBookingService.updateBookingWithSwap).toHaveBeenCalledWith(
          'booking-1',
          expect.any(Object)
        );
      });
    });

    it('should handle booking deletion with confirmation', async () => {
      // Mock fetch for delete API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Booking deleted' }),
      });

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
  });

  describe('Swap Management Functionality', () => {
    it('should handle swap creation navigation', async () => {
      const mockNavigate = vi.fn();
      
      // Mock useNavigate
      vi.mock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useNavigate: () => mockNavigate,
        };
      });

      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });

      // Click create swap button
      fireEvent.click(screen.getByTestId('create-swap-booking-1'));

      // Should navigate to swaps page with booking parameter
      expect(mockNavigate).toHaveBeenCalledWith('/swaps?booking=booking-1');
    });

    it('should handle inline proposals for browser role', async () => {
      // Mock booking from another user
      const otherUserBooking = {
        ...mockBookingsWithSwapInfo[0],
        userId: 'other-user',
      };

      (unifiedBookingService.getBookingsWithSwapInfo as any).mockResolvedValue([
        otherUserBooking,
      ]);

      (unifiedBookingService.makeInlineProposal as any).mockResolvedValue({
        id: 'proposal-1',
        status: 'pending',
      });

      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
        expect(screen.getByText('Role: browser')).toBeInTheDocument();
      });

      // Click make proposal button
      fireEvent.click(screen.getByTestId('make-proposal-booking-1'));

      // Should call the inline proposal service
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

      // Click view details button
      fireEvent.click(screen.getByTestId('view-details-booking-1'));

      // Modal should open
      expect(screen.getByTestId('booking-details-modal')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates and Error Handling', () => {
    it('should show real-time updates indicator', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });

    it('should handle loading states correctly', async () => {
      // Test loading state
      (unifiedBookingService.getBookingsWithSwapInfo as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      renderWithProviders(<BookingsPage />);

      expect(screen.getByText('Loading your bookings...')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading your bookings...')).not.toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('should handle error states with retry functionality', async () => {
      // Test error state
      (unifiedBookingService.getBookingsWithSwapInfo as any).mockRejectedValue(
        new Error('Network error')
      );

      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Unable to load your bookings: Network error/)).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      // Test retry functionality
      (unifiedBookingService.getBookingsWithSwapInfo as any).mockResolvedValue(
        mockBookingsWithSwapInfo
      );

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.queryByText(/Unable to load your bookings/)).not.toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
      });
    });

    it('should validate booking status determination logic', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        // All bookings should be loaded
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-2')).toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-3')).toBeInTheDocument();
      });

      // Test expired filter
      fireEvent.click(screen.getByTestId('filter-expired'));
      await waitFor(() => {
        expect(screen.queryByTestId('booking-card-booking-1')).not.toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-2')).toBeInTheDocument(); // Expired booking
        expect(screen.queryByTestId('booking-card-booking-3')).not.toBeInTheDocument();
      });

      // Test completed filter
      fireEvent.click(screen.getByTestId('filter-completed'));
      await waitFor(() => {
        expect(screen.queryByTestId('booking-card-booking-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('booking-card-booking-2')).not.toBeInTheDocument();
        expect(screen.getByTestId('booking-card-booking-3')).toBeInTheDocument(); // Completed swap
      });
    });
  });

  describe('User Role Determination', () => {
    it('should correctly determine owner role for user bookings', async () => {
      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
        expect(screen.getByText('Role: owner')).toBeInTheDocument();
      });

      // Owner should see management buttons
      expect(screen.getByTestId('edit-booking-1')).toBeInTheDocument();
      expect(screen.getByTestId('delete-booking-1')).toBeInTheDocument();
      expect(screen.getByTestId('create-swap-booking-1')).toBeInTheDocument();
    });

    it('should correctly determine browser role for other user bookings', async () => {
      const otherUserBooking = {
        ...mockBookingsWithSwapInfo[0],
        userId: 'other-user',
      };

      (unifiedBookingService.getBookingsWithSwapInfo as any).mockResolvedValue([
        otherUserBooking,
      ]);

      renderWithProviders(<BookingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument();
        expect(screen.getByText('Role: browser')).toBeInTheDocument();
      });

      // Browser should see proposal button
      expect(screen.getByTestId('make-proposal-booking-1')).toBeInTheDocument();
    });
  });
});