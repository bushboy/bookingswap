import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookingCard } from '../BookingCard';
import { BookingWithProposalStatus } from '@/types/browsePageFiltering';
import { vi } from 'vitest';

// Mock the UI components
vi.mock('@/components/ui/Card', () => ({
    Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
    CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/Button', () => ({
    Button: ({ children, onClick, disabled, title, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} title={title} {...props}>
            {children}
        </button>
    ),
}));

const mockBookingWithProposalStatus: BookingWithProposalStatus = {
    id: 'booking-1',
    userId: 'user-1',
    type: 'hotel',
    title: 'Test Hotel Booking',
    description: 'A test hotel booking',
    location: {
        city: 'New York',
        country: 'USA',
        address: '123 Test St',
        coordinates: { lat: 40.7128, lng: -74.0060 }
    },
    dateRange: {
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-03')
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
        name: 'Test Hotel',
        confirmationNumber: 'TEST123'
    },
    status: 'available',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    userProposalStatus: 'none',
    canPropose: true,
    isOwnBooking: false,
};

describe('BookingCard - Proposal Status Display', () => {
    const defaultProps = {
        booking: mockBookingWithProposalStatus,
        isAuthenticated: true,
        onPropose: vi.fn(),
        onViewDetails: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows "Propose Swap" button for bookings with no proposal status', () => {
        render(<BookingCard {...defaultProps} />);

        expect(screen.getByText('Propose Swap')).toBeInTheDocument();
        expect(screen.getByText('Propose Swap')).not.toBeDisabled();
    });

    it('shows "Proposal Pending" button for pending proposals', () => {
        const bookingWithPendingProposal = {
            ...mockBookingWithProposalStatus,
            userProposalStatus: 'pending' as const,
            canPropose: false,
        };

        render(<BookingCard {...defaultProps} booking={bookingWithPendingProposal} />);

        const button = screen.getByRole('button', { name: 'Proposal Pending' });
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
    });

    it('shows "Proposal Accepted" button for accepted proposals', () => {
        const bookingWithAcceptedProposal = {
            ...mockBookingWithProposalStatus,
            userProposalStatus: 'accepted' as const,
            canPropose: false,
        };

        render(<BookingCard {...defaultProps} booking={bookingWithAcceptedProposal} />);

        const button = screen.getByRole('button', { name: 'Proposal Accepted' });
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
    });

    it('shows "Propose Again" button for rejected proposals', () => {
        const bookingWithRejectedProposal = {
            ...mockBookingWithProposalStatus,
            userProposalStatus: 'rejected' as const,
            canPropose: true,
        };

        render(<BookingCard {...defaultProps} booking={bookingWithRejectedProposal} />);

        expect(screen.getByText('Propose Again')).toBeInTheDocument();
        expect(screen.getByText('Propose Again')).not.toBeDisabled();
    });

    it('displays proposal status indicator for pending proposals', () => {
        const bookingWithPendingProposal = {
            ...mockBookingWithProposalStatus,
            userProposalStatus: 'pending' as const,
            canPropose: false,
        };

        render(<BookingCard {...defaultProps} booking={bookingWithPendingProposal} />);

        expect(screen.getByText('⏳')).toBeInTheDocument();
        expect(screen.getAllByText('Proposal Pending')).toHaveLength(2); // Status indicator and button
    });

    it('displays proposal status indicator for accepted proposals', () => {
        const bookingWithAcceptedProposal = {
            ...mockBookingWithProposalStatus,
            userProposalStatus: 'accepted' as const,
            canPropose: false,
        };

        render(<BookingCard {...defaultProps} booking={bookingWithAcceptedProposal} />);

        expect(screen.getByText('✅')).toBeInTheDocument();
        expect(screen.getAllByText('Proposal Accepted')).toHaveLength(2); // Status indicator and button
    });

    it('displays proposal status indicator for rejected proposals', () => {
        const bookingWithRejectedProposal = {
            ...mockBookingWithProposalStatus,
            userProposalStatus: 'rejected' as const,
            canPropose: true,
        };

        render(<BookingCard {...defaultProps} booking={bookingWithRejectedProposal} />);

        expect(screen.getByText('❌')).toBeInTheDocument();
        expect(screen.getByText('Previous Proposal Rejected')).toBeInTheDocument();
    });

    it('does not show proposal status indicator for unauthenticated users', () => {
        const bookingWithPendingProposal = {
            ...mockBookingWithProposalStatus,
            userProposalStatus: 'pending' as const,
            canPropose: false,
        };

        render(<BookingCard {...defaultProps} booking={bookingWithPendingProposal} isAuthenticated={false} />);

        expect(screen.queryByText('⏳')).not.toBeInTheDocument();
        expect(screen.queryByText('Proposal Pending')).not.toBeInTheDocument();
    });

    it('shows "Propose Swap" for unauthenticated users regardless of proposal status', () => {
        const bookingWithPendingProposal = {
            ...mockBookingWithProposalStatus,
            userProposalStatus: 'pending' as const,
            canPropose: false,
        };

        render(<BookingCard {...defaultProps} booking={bookingWithPendingProposal} isAuthenticated={false} />);

        expect(screen.getByText('Propose Swap')).toBeInTheDocument();
        expect(screen.getByText('Propose Swap')).not.toBeDisabled();
    });

    it('calls onPropose when propose button is clicked', () => {
        const onPropose = vi.fn();

        render(<BookingCard {...defaultProps} onPropose={onPropose} />);

        fireEvent.click(screen.getByText('Propose Swap'));

        expect(onPropose).toHaveBeenCalledWith(mockBookingWithProposalStatus);
    });

    it('includes tooltip text for disabled buttons', () => {
        const bookingWithPendingProposal = {
            ...mockBookingWithProposalStatus,
            userProposalStatus: 'pending' as const,
            canPropose: false,
        };

        render(<BookingCard {...defaultProps} booking={bookingWithPendingProposal} />);

        const button = screen.getByRole('button', { name: 'Proposal Pending' });
        expect(button).toHaveAttribute('title', 'You have a pending proposal for this booking');
    });

    it('includes tooltip text for rejected proposals', () => {
        const bookingWithRejectedProposal = {
            ...mockBookingWithProposalStatus,
            userProposalStatus: 'rejected' as const,
            canPropose: true,
        };

        render(<BookingCard {...defaultProps} booking={bookingWithRejectedProposal} />);

        const button = screen.getByText('Propose Again');
        expect(button).toHaveAttribute('title', 'Your previous proposal was rejected. You can propose again.');
    });
});