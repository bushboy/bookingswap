import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface SwapProposal {
  id: string;
  sourceBookingId: string;
  targetBookingId: string;
  proposerId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface BookingSwapInfo {
  bookingId: string;
  hasPendingSwaps: boolean;
  pendingProposals: SwapProposal[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to check if a booking has pending swap proposals
 */
export const useBookingSwaps = (bookingId: string): BookingSwapInfo => {
  const { token } = useAuth();
  const [swapInfo, setSwapInfo] = useState<BookingSwapInfo>({
    bookingId,
    hasPendingSwaps: false,
    pendingProposals: [],
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!bookingId || !token) {
      return;
    }

    const fetchSwapProposals = async () => {
      setSwapInfo(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(
          `http://localhost:3001/api/swaps/booking/${bookingId}/proposals`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const responseData = await response.json();

          // Handle the backend API response format
          let proposals: SwapProposal[] = [];

          if (
            responseData.success &&
            responseData.data &&
            Array.isArray(responseData.data)
          ) {
            proposals = responseData.data;
          } else if (Array.isArray(responseData)) {
            proposals = responseData;
          }

          // Filter for pending proposals only
          const pendingProposals = proposals.filter(
            proposal => proposal.status === 'pending'
          );

          setSwapInfo({
            bookingId,
            hasPendingSwaps: pendingProposals.length > 0,
            pendingProposals,
            isLoading: false,
            error: null,
          });
        } else if (response.status === 404) {
          // No proposals found - this is normal
          setSwapInfo({
            bookingId,
            hasPendingSwaps: false,
            pendingProposals: [],
            isLoading: false,
            error: null,
          });
        } else {
          throw new Error(
            `Failed to fetch swap proposals: ${response.statusText}`
          );
        }
      } catch (error) {
        console.error('Error fetching swap proposals:', error);
        setSwapInfo(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    fetchSwapProposals();
  }, [bookingId, token]);

  return swapInfo;
};

/**
 * Hook to check pending swaps for multiple bookings at once
 */
export const useMultipleBookingSwaps = (bookingIds: string[]) => {
  const { token } = useAuth();
  const [swapInfoMap, setSwapInfoMap] = useState<
    Record<string, BookingSwapInfo>
  >({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!bookingIds.length || !token) {
      return;
    }

    const fetchAllSwapProposals = async () => {
      setIsLoading(true);
      const newSwapInfoMap: Record<string, BookingSwapInfo> = {};

      // Fetch swap proposals for each booking
      const promises = bookingIds.map(async bookingId => {
        try {
          const response = await fetch(
            `http://localhost:3001/api/swaps/booking/${bookingId}/proposals`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const responseData = await response.json();

            let proposals: SwapProposal[] = [];
            if (
              responseData.success &&
              responseData.data &&
              Array.isArray(responseData.data)
            ) {
              proposals = responseData.data;
            } else if (Array.isArray(responseData)) {
              proposals = responseData;
            }

            const pendingProposals = proposals.filter(
              proposal => proposal.status === 'pending'
            );

            newSwapInfoMap[bookingId] = {
              bookingId,
              hasPendingSwaps: pendingProposals.length > 0,
              pendingProposals,
              isLoading: false,
              error: null,
            };
          } else if (response.status === 404) {
            // No proposals found
            newSwapInfoMap[bookingId] = {
              bookingId,
              hasPendingSwaps: false,
              pendingProposals: [],
              isLoading: false,
              error: null,
            };
          } else {
            throw new Error(
              `Failed to fetch swap proposals: ${response.statusText}`
            );
          }
        } catch (error) {
          console.error(
            `Error fetching swap proposals for booking ${bookingId}:`,
            error
          );
          newSwapInfoMap[bookingId] = {
            bookingId,
            hasPendingSwaps: false,
            pendingProposals: [],
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      await Promise.all(promises);
      setSwapInfoMap(newSwapInfoMap);
      setIsLoading(false);
    };

    fetchAllSwapProposals();
  }, [bookingIds.join(','), token]);

  return {
    swapInfoMap,
    isLoading,
    getSwapInfo: (bookingId: string) =>
      swapInfoMap[bookingId] || {
        bookingId,
        hasPendingSwaps: false,
        pendingProposals: [],
        isLoading: false,
        error: null,
      },
  };
};
