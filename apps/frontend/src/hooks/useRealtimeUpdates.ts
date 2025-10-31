import { useEffect, useCallback, useRef } from 'react';
import { realtimeService, RealtimeMessage } from '../services/realtimeService';

export interface UseRealtimeUpdatesOptions {
  channels?: string[];
  bookingIds?: string[];
  onBookingUpdated?: (data: any) => void;
  onSwapStatusChanged?: (data: any) => void;
  onProposalUpdated?: (data: any) => void;
  onAuctionEndingSoon?: (data: any) => void;
  onAuctionEnded?: (data: any) => void;
  onMessage?: (message: RealtimeMessage) => void;
  autoConnect?: boolean;
}

/**
 * Hook for managing real-time updates in React components
 * Provides automatic subscription management and cleanup
 */
export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions = {}) {
  const {
    channels = [],
    bookingIds = [],
    onBookingUpdated,
    onSwapStatusChanged,
    onProposalUpdated,
    onAuctionEndingSoon,
    onAuctionEnded,
    onMessage,
    autoConnect = true,
  } = options;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Connection management
  const connect = useCallback(async () => {
    try {
      await realtimeService.connect();
      return true;
    } catch (error) {
      console.error('Failed to connect to real-time service:', error);
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    realtimeService.disconnect();
  }, []);

  const isConnected = useCallback(() => {
    return realtimeService.isConnected();
  }, []);

  // Subscription management
  const subscribe = useCallback((channelsToSubscribe: string[]) => {
    realtimeService.subscribe(channelsToSubscribe);
  }, []);

  const unsubscribe = useCallback((channelsToUnsubscribe: string[]) => {
    realtimeService.unsubscribe(channelsToUnsubscribe);
  }, []);

  const monitorBookings = useCallback((bookingIdsToMonitor: string[]) => {
    realtimeService.monitorBookings(bookingIdsToMonitor);
  }, []);

  const unmonitorBookings = useCallback((bookingIdsToUnmonitor: string[]) => {
    realtimeService.unmonitorBookings(bookingIdsToUnmonitor);
  }, []);

  // Event handlers
  useEffect(() => {
    const handleBookingUpdated = (data: any) => {
      optionsRef.current.onBookingUpdated?.(data);
    };

    const handleSwapStatusChanged = (data: any) => {
      optionsRef.current.onSwapStatusChanged?.(data);
    };

    const handleProposalUpdated = (data: any) => {
      optionsRef.current.onProposalUpdated?.(data);
    };

    const handleAuctionEndingSoon = (data: any) => {
      optionsRef.current.onAuctionEndingSoon?.(data);
    };

    const handleAuctionEnded = (data: any) => {
      optionsRef.current.onAuctionEnded?.(data);
    };

    const handleMessage = (message: RealtimeMessage) => {
      optionsRef.current.onMessage?.(message);
    };

    // Register event listeners
    realtimeService.on('bookingUpdated', handleBookingUpdated);
    realtimeService.on('swapStatusChanged', handleSwapStatusChanged);
    realtimeService.on('proposalUpdated', handleProposalUpdated);
    realtimeService.on('auctionEndingSoon', handleAuctionEndingSoon);
    realtimeService.on('auctionEnded', handleAuctionEnded);
    realtimeService.on('message', handleMessage);

    return () => {
      // Cleanup event listeners
      realtimeService.off('bookingUpdated', handleBookingUpdated);
      realtimeService.off('swapStatusChanged', handleSwapStatusChanged);
      realtimeService.off('proposalUpdated', handleProposalUpdated);
      realtimeService.off('auctionEndingSoon', handleAuctionEndingSoon);
      realtimeService.off('auctionEnded', handleAuctionEnded);
      realtimeService.off('message', handleMessage);
    };
  }, []);

  // Auto-connect and subscription management
  useEffect(() => {
    let mounted = true;

    const setupConnection = async () => {
      if (autoConnect && !realtimeService.isConnected()) {
        const connected = await connect();
        if (!connected || !mounted) return;
      }

      // Subscribe to channels
      if (channels.length > 0) {
        subscribe(channels);
      }

      // Monitor specific bookings
      if (bookingIds.length > 0) {
        monitorBookings(bookingIds);
      }
    };

    setupConnection();

    return () => {
      mounted = false;
      
      // Cleanup subscriptions
      if (channels.length > 0) {
        unsubscribe(channels);
      }
      
      if (bookingIds.length > 0) {
        unmonitorBookings(bookingIds);
      }
    };
  }, [channels.join(','), bookingIds.join(','), autoConnect, connect, subscribe, unsubscribe, monitorBookings, unmonitorBookings]);

  return {
    // Connection methods
    connect,
    disconnect,
    isConnected,
    
    // Subscription methods
    subscribe,
    unsubscribe,
    monitorBookings,
    unmonitorBookings,
    
    // Service instance for advanced usage
    service: realtimeService,
  };
}

/**
 * Simplified hook for booking-specific real-time updates
 */
export function useBookingRealtimeUpdates(
  bookingIds: string[],
  callbacks: {
    onBookingUpdated?: (data: any) => void;
    onSwapStatusChanged?: (data: any) => void;
    onProposalUpdated?: (data: any) => void;
  }
) {
  return useRealtimeUpdates({
    channels: ['bookings', 'swaps', 'proposals'],
    bookingIds,
    ...callbacks,
  });
}

/**
 * Hook for auction-specific real-time updates
 */
export function useAuctionRealtimeUpdates(
  auctionIds: string[],
  callbacks: {
    onAuctionEndingSoon?: (data: any) => void;
    onAuctionEnded?: (data: any) => void;
    onProposalUpdated?: (data: any) => void;
  }
) {
  return useRealtimeUpdates({
    channels: ['auctions', 'proposals'],
    bookingIds: auctionIds, // Auctions are tied to bookings
    ...callbacks,
  });
}