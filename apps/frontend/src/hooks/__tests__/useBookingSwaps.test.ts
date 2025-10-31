import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useBookingSwaps, useMultipleBookingSwaps } from '../useBookingSwaps';

// Mock the auth context
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('useBookingSwaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: 'test-token',
    });
  });

  describe('useBookingSwaps', () => {
    it('should return no pending swaps when API returns empty array', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      });

      const { result } = renderHook(() => useBookingSwaps('booking-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasPendingSwaps).toBe(false);
      expect(result.current.pendingProposals).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should return pending swaps when API returns proposals', async () => {
      const mockProposals = [
        {
          id: 'swap-1',
          sourceBookingId: 'booking-2',
          targetBookingId: 'booking-1',
          proposerId: 'user-2',
          status: 'pending',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'swap-2',
          sourceBookingId: 'booking-3',
          targetBookingId: 'booking-1',
          proposerId: 'user-3',
          status: 'accepted',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockProposals,
        }),
      });

      const { result } = renderHook(() => useBookingSwaps('booking-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasPendingSwaps).toBe(true);
      expect(result.current.pendingProposals).toHaveLength(1);
      expect(result.current.pendingProposals[0].status).toBe('pending');
      expect(result.current.error).toBeNull();
    });

    it('should handle 404 response gracefully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const { result } = renderHook(() => useBookingSwaps('booking-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasPendingSwaps).toBe(false);
      expect(result.current.pendingProposals).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle API errors', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useBookingSwaps('booking-1'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasPendingSwaps).toBe(false);
      expect(result.current.error).toContain('Failed to fetch swap proposals');
    });

    it('should not make API call when no token is available', () => {
      mockUseAuth.mockReturnValue({
        token: null,
      });

      const { result } = renderHook(() => useBookingSwaps('booking-1'));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasPendingSwaps).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('useMultipleBookingSwaps', () => {
    it('should fetch swap info for multiple bookings', async () => {
      const mockResponses = [
        {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'swap-1',
                sourceBookingId: 'booking-2',
                targetBookingId: 'booking-1',
                proposerId: 'user-2',
                status: 'pending',
                createdAt: '2024-01-01T00:00:00Z',
              },
            ],
          }),
        },
        {
          ok: true,
          json: async () => ({
            success: true,
            data: [],
          }),
        },
      ];

      (fetch as any)
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1]);

      const { result } = renderHook(() =>
        useMultipleBookingSwaps(['booking-1', 'booking-2'])
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.getSwapInfo('booking-1').hasPendingSwaps).toBe(
        true
      );
      expect(result.current.getSwapInfo('booking-2').hasPendingSwaps).toBe(
        false
      );
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should return default swap info for unknown booking IDs', () => {
      const { result } = renderHook(() => useMultipleBookingSwaps([]));

      const unknownSwapInfo = result.current.getSwapInfo('unknown-booking');

      expect(unknownSwapInfo.bookingId).toBe('unknown-booking');
      expect(unknownSwapInfo.hasPendingSwaps).toBe(false);
      expect(unknownSwapInfo.pendingProposals).toEqual([]);
      expect(unknownSwapInfo.error).toBeNull();
    });
  });
});
