import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { bookingService } from '../services/bookingService';
import { proposalService, UserProposal } from '../services/proposalService';
import { BookingWithProposalStatus, ProposalStatus } from '../types/browsePageFiltering';
import { swapService } from '../services/swapService';

/**
 * Hook return interface for browse data management
 */
export interface BrowseDataHook {
    bookings: BookingWithProposalStatus[];
    loading: boolean;
    error: string | null;
    refreshData: () => Promise<void>;
}

/**
 * Custom hook for managing browse page data with user-aware filtering
 * 
 * Features:
 * - Fetches bookings and user proposals in parallel for authenticated users
 * - Filters out user's own bookings when authenticated
 * - Maps proposal status to booking objects (pending, rejected, accepted, none)
 * - Calculates canPropose flag based on proposal status (false for pending, true for others)
 * - Provides loading, error, and refresh functionality
 * 
 * Requirements: 1.1, 1.2, 1.4, 3.3, 4.1, 4.2, 4.3
 */
export const useBrowseData = (): BrowseDataHook => {
    const { user, isAuthenticated } = useAuth();
    const [bookings, setBookings] = useState<BookingWithProposalStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Fetches browse data with appropriate filtering based on authentication status
     * For unauthenticated users: fetches all swaps
     * For authenticated users: fetches swaps excluding user's own + user proposals
     */
    const fetchBrowseData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch swaps from the browse API (includes booking details)
            const swaps = await swapService.browseSwaps({ limit: 100 });

            if (!isAuthenticated || !user) {
                // For unauthenticated users, convert swaps to booking format
                const bookingsWithStatus = swaps.map(swap => ({
                    ...swap.sourceBooking,
                    swapId: swap.id, // Store the swap ID
                    canPropose: true, // Will prompt for auth when clicked
                    isOwnBooking: false,
                    userProposalStatus: 'none' as ProposalStatus,
                }));
                setBookings(bookingsWithStatus);
            } else {
                // Fetch user proposals for authenticated users
                const userProposals = await proposalService.getUserProposals(user.id);

                // Create a map of proposal status by booking ID for efficient lookup
                const proposalStatusMap = new Map<string, UserProposal>();
                userProposals.forEach(proposal => {
                    proposalStatusMap.set(proposal.bookingId, proposal);
                });

                // Map swaps to bookings with proposal status
                const bookingsWithStatus = swaps
                    .filter(swap => swap.ownerId !== user.id) // Filter out user's own swaps
                    .map(swap => {
                        const booking = swap.sourceBooking;
                        const userProposal = proposalStatusMap.get(booking.id);
                        const proposalStatus: ProposalStatus = userProposal?.status || 'none';

                        return {
                            ...booking,
                            swapId: swap.id, // Store the swap ID for proposals
                            userProposalStatus: proposalStatus,
                            canPropose: proposalStatus !== 'pending', // Can't propose if already pending
                            isOwnBooking: false, // Already filtered out above
                        };
                    });

                setBookings(bookingsWithStatus);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load browse data';
            setError(errorMessage);
            console.error('Failed to fetch browse data:', err);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, user?.id]);

    /**
     * Effect to fetch data when authentication status or user changes
     */
    useEffect(() => {
        fetchBrowseData();
    }, [fetchBrowseData]);

    /**
     * Public refresh function for manual data updates
     */
    const refreshData = useCallback(async () => {
        await fetchBrowseData();
    }, [fetchBrowseData]);

    return {
        bookings,
        loading,
        error,
        refreshData,
    };
};

export default useBrowseData;