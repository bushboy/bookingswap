import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  SwapCreationModal,
  EnhancedCreateSwapRequest,
} from '@/components/swap/SwapCreationModal';

import { useAuth } from '@/contexts/AuthContext';
import { tokens } from '@/design-system/tokens';
import { swapService } from '@/services/swapService';
import { SwapCardData } from '@booking-swap/shared';
import { SwapCard } from '@/components/swap/SwapCard';
import { SwapDetailsModal } from '@/components/swap/SwapDetailsModal';
import { swapTargetingService } from '@/services/swapTargetingService';
import { useEnhancedProposalActions } from '@/hooks/useProposalActions.enhanced';
import { useProposalUpdates } from '@/hooks/useProposalUpdates';
import { useOptimizedProposalData } from '@/hooks/useOptimizedProposalData';
import { proposalDataService, ProposalUpdate } from '@/services/proposalDataService';
import { ReceivedProposalsSection } from '@/components/swap/ReceivedProposalsSection';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useAppDispatch } from '@/store/hooks';
import { retryProposalOperation } from '@/store/thunks/proposalAcceptanceThunks';
import { usePaymentBlockchainStatus } from '@/hooks/usePaymentBlockchainStatus';
import { useTargetingData } from '@/hooks/useTargetingData';
import { validateAndExecuteTargetingCall } from '@/services/targetingAuthValidator';
import { generateTargetingSuccessFeedback } from '@/services/targetingFeedbackService';

export const SwapsPage: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const debugSwaps = import.meta.env.VITE_DEBUG_SWAPS === 'true';
  if (debugSwaps) console.log('SwapsPage: Component mounting/remounting');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, user } = useAuth();
  const dispatch = useAppDispatch();

  // Set up authentication redirect handling
  useAuthRedirect();

  // Payment and blockchain status management
  const { getProposalStatusData } = usePaymentBlockchainStatus();

  // Enhanced proposal actions hook with caching
  const {
    handleAcceptProposal,
    handleRejectProposal,
    globalError,
  } = useEnhancedProposalActions(user?.id);

  // Isolated targeting data management
  const {
    targetingState,
    loadTargetingData,
    loadMultipleTargetingData,
    refreshTargetingData,
    clearTargetingData,
    retryTargetingOperation,
    getTargetingData,
    hasTargetingData,
    isTargetingLoading,
    getTargetingError
  } = useTargetingData({
    autoLoad: false,
    retryOnError: true,
    maxRetries: 2,
    retryDelay: 1500,
    onError: (error) => {
      if (debugSwaps) console.warn('SwapsPage: Targeting data error (main auth preserved):', error);

      // Use the enhanced feedback message if available
      if (error.feedbackMessage) {
        setUserFeedback({
          message: error.feedbackMessage.message,
          type: error.feedbackMessage.type,
          isTargetingRelated: true,
          showRetryOption: error.feedbackMessage.showRetryOption
        });
      } else {
        // Fallback to basic error handling
        if (!error.preservesMainAuth) {
          setError(`Targeting error: ${error.message}`);
        } else {
          setUserFeedback({
            message: 'Some targeting information could not be loaded. Your swaps are still available.',
            type: 'warning',
            isTargetingRelated: true,
            showRetryOption: error.shouldRetry
          });
        }
      }
    },
    onSuccess: (data) => {
      if (debugSwaps) console.log('SwapsPage: Targeting data loaded successfully for swap:', data.swapId);

      // Show success feedback only in development or for first-time loads
      if (debugSwaps || !hasTargetingData(data.swapId)) {
        const successFeedback = generateTargetingSuccessFeedback(
          'get_status',
          { swapId: data.swapId, operation: 'get_status' }
        );

        // Only show success message briefly for targeting data loads
        setUserFeedback({
          message: 'Targeting information loaded successfully.',
          type: 'success',
          isTargetingRelated: true,
          showRetryOption: false
        });

        // Auto-dismiss success message after 3 seconds
        setTimeout(() => {
          setUserFeedback(prev =>
            prev.type === 'success' && prev.isTargetingRelated
              ? { message: null, type: 'info', isTargetingRelated: false, showRetryOption: false }
              : prev
          );
        }, 3000);
      }
    }
  });


  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState<'created' | 'status' | 'targeting_activity' | 'incoming_targets'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [rawSwaps, setRawSwaps] = useState<SwapCardData[]>([]);
  const [isCreatingSwap, setIsCreatingSwap] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sourceBooking, setSourceBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSwap, setSelectedSwap] = useState<SwapCardData | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Enhanced state management for targeting vs main data
  const [loadingPhase, setLoadingPhase] = useState<'auth' | 'swaps' | 'targeting' | 'complete' | 'error'>('auth');
  const [swapDataState, setSwapDataState] = useState({
    isLoading: false,
    error: null as string | null,
    lastUpdated: null as Date | null,
    retryCount: 0
  });
  const [userFeedback, setUserFeedback] = useState({
    message: null as string | null,
    type: 'info' as 'info' | 'warning' | 'error' | 'success',
    isTargetingRelated: false,
    showRetryOption: false
  });

  // Optimized proposal data with caching and performance features
  const {
    proposals,
    proposalStats,
    loading: proposalsLoading,
    error: proposalsError,
    lastUpdated: proposalsLastUpdated,
    cacheHit: proposalsCacheHit,
    refresh: refreshProposals,
    handleRealTimeUpdate: handleOptimizedRealTimeUpdate,
  } = useOptimizedProposalData(user?.id, {
    enableCaching: true,
    enableOptimisticUpdates: true,
    enablePreloading: false, // Disable preloading to reduce API calls
    refreshInterval: 0, // Disable auto-refresh to prevent repeated calls
  });

  // Check if we're creating a swap from a booking or managing an existing swap
  const bookingId = searchParams.get('booking');
  const manageSwapId = searchParams.get('manage');



  // Helper function to handle proposal retry
  const handleRetryProposal = async (proposalId: string) => {
    if (!user?.id) return;

    try {
      await dispatch(retryProposalOperation({
        proposalId,
        userId: user.id,
      })).unwrap();

      // Refresh proposals after retry
      await loadUserProposals();
    } catch (error) {
      console.error('Failed to retry proposal operation:', error);
    }
  };

  React.useEffect(() => {
    if (bookingId) {
      // Load the booking details for swap creation
      loadBookingForSwap(bookingId);
      setIsCreatingSwap(true);
    } else if (manageSwapId) {
      // Navigate to manage the specific swap
      // For now, we'll just show the swaps page with the specific swap highlighted
      // In a full implementation, this could open a swap management modal
      if (debugSwaps) console.log('Managing swap:', manageSwapId);
      // TODO: Implement swap management functionality
    }
  }, [bookingId, manageSwapId]);

  // Load swaps from database
  React.useEffect(() => {
    if (debugSwaps) console.log('SwapsPage: useEffect triggered - user:', !!user?.id);
    // Only load swaps if we have a user
    if (user?.id) {
      if (debugSwaps) console.log('SwapsPage: Loading swaps for user:', user.id);
      loadSwaps();
      // Note: loadUserProposals is now handled by useOptimizedProposalData hook
    } else {
      if (debugSwaps) console.log('SwapsPage - Waiting for user authentication, user:', !!user?.id);
    }
  }, [user?.id, activeTab, sortBy, sortOrder, searchQuery]);

  // Skip targeting data loading to prevent repeated API calls
  React.useEffect(() => {
    if (loadingPhase === 'targeting') {
      if (debugSwaps) console.log('SwapsPage: Skipping targeting data load to prevent repeated API calls');
      setLoadingPhase('complete');
    }
  }, [loadingPhase]);

  // Handle targeting data loading completion
  React.useEffect(() => {
    if (loadingPhase === 'complete') {
      if (debugSwaps) console.log('SwapsPage: Data loading complete. Targeting state:', {
        hasError: !!targetingState.error,
        dataCount: Object.keys(targetingState.data).length,
        isLoading: targetingState.isLoading
      });
    }
  }, [loadingPhase, targetingState]);

  // Set up real-time proposal updates with optimized handling
  useEffect(() => {
    if (!user?.id) return;

    const handleProposalUpdate = (update: ProposalUpdate) => {
      if (debugSwaps) console.log('Received proposal update:', update);

      // Use the optimized real-time update handler
      handleOptimizedRealTimeUpdate(update);
    };

    // Subscribe to real-time updates
    proposalDataService.subscribeToProposalUpdates(user.id, handleProposalUpdate);

    // Cleanup subscription on unmount
    return () => {
      proposalDataService.unsubscribeFromProposalUpdates(user.id);
    };
  }, [user?.id, handleOptimizedRealTimeUpdate]);

  const sortSwaps = useCallback((swaps: SwapCardData[], sortBy: string, sortOrder: 'asc' | 'desc'): SwapCardData[] => {
    return [...swaps].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'created':
          comparison = new Date(a.userSwap.createdAt).getTime() - new Date(b.userSwap.createdAt).getTime();
          break;
        case 'status':
          comparison = a.userSwap.status.localeCompare(b.userSwap.status);
          break;
        case 'targeting_activity': {
          // Sort by total targeting activity (incoming + outgoing)
          const aTargeting = 'targeting' in a ? (a as any).targeting : null;
          const bTargeting = 'targeting' in b ? (b as any).targeting : null;

          const aActivity = (aTargeting?.incomingTargets?.length || 0) + (aTargeting?.outgoingTarget ? 1 : 0);
          const bActivity = (bTargeting?.incomingTargets?.length || 0) + (bTargeting?.outgoingTarget ? 1 : 0);

          comparison = aActivity - bActivity;
          break;
        }
        case 'incoming_targets': {
          // Sort by number of incoming targets
          const aTargeting = 'targeting' in a ? (a as any).targeting : null;
          const bTargeting = 'targeting' in b ? (b as any).targeting : null;

          const aIncoming = aTargeting?.incomingTargets?.length || 0;
          const bIncoming = bTargeting?.incomingTargets?.length || 0;

          comparison = aIncoming - bIncoming;
          break;
        }
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, []);

  const searchSwaps = useCallback((swaps: SwapCardData[], query: string): SwapCardData[] => {
    if (!query.trim()) return swaps;

    const lowerQuery = query.toLowerCase();

    return swaps.filter(swap => {
      // Search in basic swap data
      const basicMatch =
        swap.userSwap.bookingDetails?.title?.toLowerCase().includes(lowerQuery) ||
        swap.userSwap.bookingDetails?.location?.city?.toLowerCase().includes(lowerQuery) ||
        swap.userSwap.bookingDetails?.location?.country?.toLowerCase().includes(lowerQuery) ||
        swap.userSwap.status.toLowerCase().includes(lowerQuery);

      if (basicMatch) return true;

      // Search in targeting data if available
      const isEnhanced = 'targeting' in swap;
      if (isEnhanced) {
        const enhancedSwap = swap as any;
        const targeting = enhancedSwap.targeting;

        // Search in incoming targets
        if (targeting?.incomingTargets?.length > 0) {
          const incomingMatch = targeting.incomingTargets.some((target: any) =>
            target.sourceSwap?.ownerName?.toLowerCase().includes(lowerQuery) ||
            target.sourceSwap?.bookingDetails?.title?.toLowerCase().includes(lowerQuery) ||
            target.sourceSwap?.bookingDetails?.location?.city?.toLowerCase().includes(lowerQuery)
          );
          if (incomingMatch) return true;
        }

        // Search in outgoing target
        if (targeting?.outgoingTarget) {
          const outgoingMatch =
            targeting.outgoingTarget.targetSwap?.ownerName?.toLowerCase().includes(lowerQuery) ||
            targeting.outgoingTarget.targetSwap?.bookingDetails?.title?.toLowerCase().includes(lowerQuery) ||
            targeting.outgoingTarget.targetSwap?.bookingDetails?.location?.city?.toLowerCase().includes(lowerQuery);
          if (outgoingMatch) return true;
        }
      }

      return false;
    });
  }, []);

  const applyTargetingFilters = useCallback((swaps: SwapCardData[], filter: string): SwapCardData[] => {
    if (filter === 'all') return swaps;

    return swaps.filter(swap => {
      // Check if this is enhanced swap card data with targeting information
      const isEnhanced = 'targeting' in swap;

      if (!isEnhanced) {
        // For non-enhanced data, only apply status filters
        return ['pending', 'accepted', 'completed', 'rejected', 'cancelled'].includes(filter)
          ? swap.userSwap.status === filter
          : true;
      }

      const enhancedSwap = swap as any; // Type assertion for targeting data
      const targeting = enhancedSwap.targeting;

      switch (filter) {
        case 'has_incoming_targets':
          return targeting?.incomingTargets?.length > 0;
        case 'is_targeting_others':
          return !!targeting?.outgoingTarget;
        case 'no_targeting_activity':
          return (!targeting?.incomingTargets?.length || targeting.incomingTargets.length === 0) &&
            !targeting?.outgoingTarget;
        default:
          // Handle status filters
          return swap.userSwap.status === filter;
      }
    });
  }, []);

  // Enhanced proposal loading with cache invalidation
  const loadUserProposals = useCallback(async () => {
    if (!user?.id) {
      console.log('SwapsPage - No user available for proposals, skipping API call');
      return;
    }

    try {
      console.log('SwapsPage - Refreshing proposals for user:', user.id);
      await refreshProposals();
      console.log('SwapsPage - Proposals refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh user proposals:', error);
    }
  }, [user?.id, refreshProposals]);

  // Real-time proposal updates hook
  useProposalUpdates({
    userId: user?.id,
    autoConnect: true,
    onProposalStatusUpdate: (update) => {
      if (debugSwaps) console.log('Received real-time proposal update:', update);
      // Refresh proposals when we get real-time updates
      if (user?.id) {
        loadUserProposals();
      }
    },
    onConnectionChange: (isConnected) => {
      if (debugSwaps) console.log('Proposal WebSocket connection changed:', isConnected);
    },
    onConnectionError: (error) => {
      console.error('Proposal WebSocket connection error:', error);
    },
  });

  const loadSwaps = async () => {
    if (debugSwaps) console.log('SwapsPage - loadSwaps called, user:', user?.id);
    if (debugSwaps) console.log('SwapsPage - token exists:', !!token);
    if (debugSwaps) console.log('SwapsPage - localStorage token exists:', !!localStorage.getItem('auth_token'));

    if (!user?.id) {
      if (debugSwaps) console.log('SwapsPage - No user available, skipping API call');
      setLoadingPhase('error');
      setSwapDataState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Authentication required. Please log in to view your proposals.'
      }));
      setError('Authentication required. Please log in to view your proposals.');
      setIsLoading(false);
      return;
    }

    // Update loading states
    setLoadingPhase('swaps');
    setIsLoading(true);
    setSwapDataState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));
    setError(null);
    setUserFeedback({ message: null, type: 'info', isTargetingRelated: false, showRetryOption: false });

    try {
      // Build filters based on active tab
      let filters: any = undefined;

      if (activeTab !== 'all') {
        // Handle status-based filters
        if (['pending', 'accepted', 'completed', 'rejected', 'cancelled'].includes(activeTab)) {
          filters = { status: [activeTab] };
        }
        // Handle targeting-based filters (these would be processed client-side for now)
        // In a full implementation, these could be server-side filters
      }

      // Use the new getUserSwapCards method that returns clean SwapCardData
      const swapCardData = await swapService.getUserSwapCards(user.id, filters);

      // Ensure swapCardData is an array before processing
      if (!Array.isArray(swapCardData)) {
        console.error('SwapsPage - swapCardData is not an array:', swapCardData);
        const errorMessage = 'Invalid data format received from server. Please try refreshing the page.';

        setLoadingPhase('error');
        setSwapDataState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          retryCount: prev.retryCount + 1
        }));
        setError(errorMessage);
        setRawSwaps([]);
        return;
      }

      // Store raw swaps data - processing will be done when rendering
      setRawSwaps(swapCardData);
      setLoadingPhase('targeting'); // Move to targeting phase
      setSwapDataState(prev => ({
        ...prev,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
        retryCount: 0
      }));

      if (debugSwaps) console.log(`SwapsPage - Successfully loaded ${swapCardData.length} swaps`);

      // Debug: Log proposal data for each swap
      if (debugSwaps) {
        swapCardData.forEach(swap => {
          console.log(`[SwapsPage] Swap ${swap.userSwap.id} proposals:`, {
            proposalCount: swap.proposalCount,
            proposalsFromOthers: swap.proposalsFromOthers?.length || 0,
            proposalDetails: swap.proposalsFromOthers?.map(p => ({
              id: p.id,
              status: p.status,
              proposerName: p.proposerName
            })) || []
          });
        });
      }
    } catch (error) {
      console.error('Failed to load swaps:', error);

      // Provide more specific error messages based on the error type
      let errorMessage = 'Failed to load swaps';
      let isAuthError = false;

      if (error instanceof Error) {
        // Check for specific error types that might indicate partial data issues
        if (error.message.includes('booking details')) {
          errorMessage = 'Some booking details could not be loaded. Please try refreshing the page.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error occurred while loading swaps. Please check your connection and try again.';
        } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
          errorMessage = 'Authentication error. Please log in again to view your swaps.';
          isAuthError = true;
        } else {
          errorMessage = error.message;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      setLoadingPhase('error');
      setSwapDataState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        retryCount: prev.retryCount + 1
      }));
      setError(errorMessage);
      setRawSwaps([]); // Ensure swaps is always an array

      // Set user feedback for main data errors
      setUserFeedback({
        message: errorMessage,
        type: isAuthError ? 'error' : 'warning',
        isTargetingRelated: false,
        showRetryOption: !isAuthError
      });
    } finally {
      setIsLoading(false);
    }
  };

  const acceptSwap = async (swapId: string) => {
    try {
      await swapService.acceptSwap(swapId);
      await loadSwaps();
      alert('Swap proposal accepted successfully!');
    } catch (e) {
      console.error('Accept swap failed', e);
      alert(e instanceof Error ? e.message : 'Accept swap failed');
    }
  };

  const rejectSwap = async (swapId: string) => {
    try {
      await swapService.rejectSwap(swapId);
      await loadSwaps();
      alert('Swap proposal rejected.');
    } catch (e) {
      console.error('Reject swap failed', e);
      alert(e instanceof Error ? e.message : 'Reject swap failed');
    }
  };

  // Targeting action handlers with isolated error handling
  const handleAcceptTarget = async (targetId: string, proposalId: string) => {
    const result = await validateAndExecuteTargetingCall(
      async () => {
        if (debugSwaps) console.log('Accepting targeting proposal:', { targetId, proposalId });
        // TODO: Implement targeting proposal acceptance API
        return await swapTargetingService.acceptTargetingProposal('', targetId, proposalId);
      },
      {
        operation: 'target',
        endpoint: `/swaps/${proposalId}/accept`,
        targetSwapId: targetId,
        userId: user?.id
      }
    );

    if (result.success) {
      alert('Targeting proposal accepted successfully!');
      // Refresh targeting data for affected swaps
      await refreshTargetingData(targetId);
    } else {
      console.error('Failed to accept targeting proposal:', result.error);
      if (result.preservedAuth) {
        alert(`Targeting operation failed: ${result.error}. Your session remains active.`);
      } else {
        alert(result.error || 'Failed to accept targeting proposal');
      }
    }
  };

  const handleRejectTarget = async (targetId: string, proposalId: string) => {
    const result = await validateAndExecuteTargetingCall(
      async () => {
        if (debugSwaps) console.log('Rejecting targeting proposal:', { targetId, proposalId });
        // TODO: Implement targeting proposal rejection API
        return await swapTargetingService.rejectTargetingProposal('', targetId, proposalId);
      },
      {
        operation: 'target',
        endpoint: `/swaps/${proposalId}/reject`,
        targetSwapId: targetId,
        userId: user?.id
      }
    );

    if (result.success) {
      alert('Targeting proposal rejected.');
      // Refresh targeting data for affected swaps
      await refreshTargetingData(targetId);
    } else {
      console.error('Failed to reject targeting proposal:', result.error);
      if (result.preservedAuth) {
        alert(`Targeting operation failed: ${result.error}. Your session remains active.`);
      } else {
        alert(result.error || 'Failed to reject targeting proposal');
      }
    }
  };

  const handleRetarget = async (swapId: string, currentTargetId: string) => {
    const result = await validateAndExecuteTargetingCall(
      async () => {
        return await swapTargetingService.removeTarget(swapId);
      },
      {
        operation: 'remove_target',
        endpoint: `/swaps/${swapId}/target`,
        sourceSwapId: swapId,
        targetSwapId: currentTargetId,
        userId: user?.id
      }
    );

    if (result.success) {
      // Clear targeting data for this swap
      clearTargetingData(swapId);
      // Navigate to browse page to select new target
      navigate(`/browse?retarget=${swapId}`);
    } else {
      console.error('Failed to cancel current targeting:', result.error);
      if (result.preservedAuth) {
        alert(`Failed to cancel targeting: ${result.error}. Your session remains active.`);
      } else {
        alert(result.error || 'Failed to cancel current targeting');
      }
    }
  };

  const handleCancelTargeting = async (swapId: string, targetId: string) => {
    const result = await validateAndExecuteTargetingCall(
      async () => {
        return await swapTargetingService.removeTarget(swapId);
      },
      {
        operation: 'remove_target',
        endpoint: `/swaps/${swapId}/target`,
        sourceSwapId: swapId,
        targetSwapId: targetId,
        userId: user?.id
      }
    );

    if (result.success) {
      // Clear targeting data for this swap
      clearTargetingData(swapId);
      alert('Targeting cancelled successfully.');
    } else {
      console.error('Failed to cancel targeting:', result.error);
      if (result.preservedAuth) {
        alert(`Failed to cancel targeting: ${result.error}. Your session remains active.`);
      } else {
        alert(result.error || 'Failed to cancel targeting');
      }
    }
  };

  const handleBrowseTargets = (swapId: string) => {
    // Navigate to browse page with targeting context
    navigate(`/browse?target=${swapId}`);
  };

  // Enhanced user feedback handlers
  const handleRetrySwapData = async () => {
    if (debugSwaps) console.log('SwapsPage: Retrying swap data load');
    setUserFeedback({ message: null, type: 'info', isTargetingRelated: false, showRetryOption: false });
    await loadSwaps();
  };

  const handleRetryTargetingData = async () => {
    if (debugSwaps) console.log('SwapsPage: Retrying targeting data load');

    // Show retry in progress feedback
    const retryFeedback = generateTargetingSuccessFeedback(
      'get_status',
      { operation: 'retry_targeting_data' }
    );

    setUserFeedback({
      message: 'Retrying targeting data load...',
      type: 'info',
      isTargetingRelated: true,
      showRetryOption: false
    });

    if (rawSwaps.length > 0) {
      const swapIds = rawSwaps.map(swap => swap.userSwap.id);
      try {
        await loadMultipleTargetingData(swapIds);

        // Generate success feedback
        const successFeedback = generateTargetingSuccessFeedback(
          'get_status',
          { operation: 'retry_targeting_data' }
        );

        setUserFeedback({
          message: successFeedback.message,
          type: 'success',
          isTargetingRelated: true,
          showRetryOption: false
        });

        // Auto-dismiss success message after 3 seconds
        setTimeout(() => {
          setUserFeedback(prev =>
            prev.type === 'success' && prev.isTargetingRelated
              ? { message: null, type: 'info', isTargetingRelated: false, showRetryOption: false }
              : prev
          );
        }, 3000);
      } catch (error) {
        // The error will be handled by the onError callback in useTargetingData
        // which will set appropriate feedback messages
        if (debugSwaps) console.warn('SwapsPage: Retry failed, error handled by useTargetingData hook');
      }
    }
  };

  const dismissUserFeedback = () => {
    setUserFeedback({ message: null, type: 'info', isTargetingRelated: false, showRetryOption: false });
  };

  // Enhanced error classification
  const getErrorSeverity = (error: string | null, isTargetingError: boolean): 'low' | 'medium' | 'high' => {
    if (!error) return 'low';

    if (isTargetingError) {
      // Targeting errors are always low severity since they preserve main auth
      return 'low';
    }

    if (error.includes('authentication') || error.includes('unauthorized')) {
      return 'high';
    }

    if (error.includes('network') || error.includes('server')) {
      return 'medium';
    }

    return 'medium';
  };



  const loadBookingForSwap = async (id: string) => {
    try {
      // For now, we'll get the booking from the bookings list
      // In a real app, you might want a separate API call
      const response = await fetch('http://localhost:3001/api/bookings', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        const bookings = responseData.data?.bookings || [];
        const booking = bookings.find((b: any) => b.id === id);

        if (booking) {
          setSourceBooking({
            id: booking.id,
            title: booking.title,
            location: `${booking.location?.city || booking.city}, ${booking.location?.country || booking.country}`,
            dateRange: `${new Date(booking.dateRange?.checkIn || booking.checkInDate).toLocaleDateString()} - ${new Date(booking.dateRange?.checkOut || booking.checkOutDate).toLocaleDateString()}`,
            originalPrice: booking.originalPrice,
            swapValue: booking.swapValue,
            type: booking.type,
            status: booking.status,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load booking for swap:', error);
    }
  };

  const handleCreateSwap = async (swapData: EnhancedCreateSwapRequest) => {
    setIsSubmitting(true);
    try {
      console.log('Creating swap:', swapData);

      const response = await fetch('http://localhost:3001/api/swaps/enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(swapData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create swap');
      }

      const createdSwap = await response.json();
      console.log('Swap created successfully:', createdSwap);

      // Close modal and clear URL params
      setIsCreatingSwap(false);
      setSourceBooking(null);
      navigate('/swaps', { replace: true });

      // Reload swaps to show the new one
      await loadSwaps();

      alert('Swap proposal created successfully!');
    } catch (error) {
      console.error('Failed to create swap:', error);
      throw error; // Re-throw to be handled by the modal
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSwapModal = () => {
    setIsCreatingSwap(false);
    setSourceBooking(null);
    if (bookingId) {
      navigate('/swaps', { replace: true });
    }
  };
  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing[6],
  };

  const titleStyles = {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  const tabsStyles = {
    display: 'flex',
    gap: tokens.spacing[1],
    marginBottom: tokens.spacing[6],
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const tabStyles = {
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[600],
    transition: 'all 0.2s ease-in-out',
  };

  const activeTabStyles = {
    ...tabStyles,
    color: tokens.colors.primary[600],
    borderBottomColor: tokens.colors.primary[600],
  };

  const swapsListStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[4],
  };

  const swapCardStyles = {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr auto',
    gap: tokens.spacing[6],
    alignItems: 'center',
    padding: tokens.spacing[6],
  };

  const bookingInfoStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[2],
  };

  const bookingTitleStyles = {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  const bookingDetailsStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
  };

  const swapArrowStyles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: tokens.colors.primary[100],
    color: tokens.colors.primary[600],
  };

  const statusBadgeStyles = (status: string) => {
    const statusColors = {
      pending: {
        bg: tokens.colors.warning[100],
        text: tokens.colors.warning[800],
      },
      accepted: {
        bg: tokens.colors.success[100],
        text: tokens.colors.success[800],
      },
      rejected: {
        bg: tokens.colors.error[100],
        text: tokens.colors.error[800],
      },
      completed: {
        bg: tokens.colors.primary[100],
        text: tokens.colors.primary[800],
      },
    };

    const colors =
      statusColors[status as keyof typeof statusColors] || statusColors.pending;

    return {
      display: 'inline-block',
      padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
      borderRadius: tokens.borderRadius.full,
      fontSize: tokens.typography.fontSize.xs,
      fontWeight: tokens.typography.fontWeight.medium,
      backgroundColor: colors.bg,
      color: colors.text,
      textTransform: 'capitalize' as const,
    };
  };

  const actionsStyles = {
    display: 'flex',
    gap: tokens.spacing[2],
    justifyContent: 'flex-end',
  };

  return (
    <div>
      <div style={headerStyles}>
        <h1 style={titleStyles}>My Proposals</h1>
        <div style={{ display: 'flex', gap: tokens.spacing[3], alignItems: 'center' }}>
          {/* Sorting Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
            <label style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.neutral[600] }}>
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${tokens.colors.neutral[300]}`,
                fontSize: tokens.typography.fontSize.sm,
                backgroundColor: 'white',
              }}
            >
              <option value="created">Created Date</option>
              <option value="status">Status</option>
              <option value="targeting_activity">Targeting Activity</option>
              <option value="incoming_targets">Incoming Targets</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              style={{
                padding: tokens.spacing[2],
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${tokens.colors.neutral[300]}`,
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: tokens.typography.fontSize.sm,
              }}
              title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              loadSwaps();
              refreshProposals();
            }}
            disabled={isLoading || proposalsLoading}
            title={proposalsCacheHit ? 'Last data from cache' : 'Fresh data from server'}
          >
            {(isLoading || proposalsLoading) ? 'Refreshing...' : '🔄 Refresh'}
            {proposalsCacheHit && <span style={{ fontSize: '0.8em', marginLeft: '4px' }}>📋</span>}
          </Button>
          <Button variant="primary" onClick={() => navigate('/browse')}>
            Browse Swaps
          </Button>
        </div>
      </div>

      {/* Search Input - Moved to top */}
      <div style={{ marginBottom: tokens.spacing[4] }}>
        <input
          type="text"
          placeholder="Search swaps, locations, or targeting partners..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
            borderRadius: tokens.borderRadius.lg,
            border: `1px solid ${tokens.colors.neutral[300]}`,
            fontSize: tokens.typography.fontSize.base,
            backgroundColor: 'white',
          }}
        />
      </div>




      <div style={tabsStyles}>
        <button
          style={activeTab === 'all' ? activeTabStyles : tabStyles}
          onClick={() => setActiveTab('all')}
        >
          All Swaps
        </button>
        <button
          style={activeTab === 'pending' ? activeTabStyles : tabStyles}
          onClick={() => setActiveTab('pending')}
        >
          Pending
        </button>
        <button
          style={activeTab === 'accepted' ? activeTabStyles : tabStyles}
          onClick={() => setActiveTab('accepted')}
        >
          Accepted
        </button>
        <button
          style={activeTab === 'completed' ? activeTabStyles : tabStyles}
          onClick={() => setActiveTab('completed')}
        >
          Completed
        </button>
        <button
          style={activeTab === 'has_incoming_targets' ? activeTabStyles : tabStyles}
          onClick={() => setActiveTab('has_incoming_targets')}
        >
          🎯 Has Targets
        </button>
        <button
          style={activeTab === 'is_targeting_others' ? activeTabStyles : tabStyles}
          onClick={() => setActiveTab('is_targeting_others')}
        >
          📤 Targeting Others
        </button>
        <button
          style={activeTab === 'no_targeting_activity' ? activeTabStyles : tabStyles}
          onClick={() => setActiveTab('no_targeting_activity')}
        >
          ⚪ No Targeting
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card variant="outlined">
          <CardContent
            style={{ textAlign: 'center', padding: tokens.spacing[12] }}
          >
            <div
              style={{
                fontSize: tokens.typography.fontSize['4xl'],
                marginBottom: tokens.spacing[4],
              }}
            >
              ⏳
            </div>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.semibold,
                marginBottom: tokens.spacing[2],
              }}
            >
              Loading swaps...
            </h3>
            <p style={{ color: tokens.colors.neutral[600] }}>
              Fetching your swap proposals from the database.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card variant="outlined">
          <CardContent
            style={{ textAlign: 'center', padding: tokens.spacing[12] }}
          >
            <div
              style={{
                fontSize: tokens.typography.fontSize['4xl'],
                marginBottom: tokens.spacing[4],
              }}
            >
              ❌
            </div>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.semibold,
                marginBottom: tokens.spacing[2],
              }}
            >
              Failed to load swaps
            </h3>
            <p
              style={{
                color: tokens.colors.neutral[600],
                marginBottom: tokens.spacing[6],
              }}
            >
              {error}
            </p>
            <Button variant="primary" onClick={() => loadSwaps()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Swaps List */}
      {!isLoading && !error && (
        <div style={swapsListStyles}>
          {(() => {
            // Process swaps data for display
            const searchedSwaps = searchSwaps(rawSwaps, searchQuery);
            const filteredSwaps = applyTargetingFilters(searchedSwaps, activeTab);
            const sortedSwaps = sortSwaps(filteredSwaps, sortBy, sortOrder);
            return sortedSwaps;
          })().map(swapCardData => {
            // Create handlers that include loading state management
            const handleAcceptProposalWrapper = async (proposalId: string) => {
              console.log(`[SwapsPage] Accept proposal wrapper called for ${proposalId}`);
              try {
                // For the simplified schema, proposalId IS the swap_targets.id for booking proposals
                // and swap_proposals.id for cash proposals. The backend expects the same ID for both.
                // No need to pass swapTargetId separately - it's the same as proposalId.
                console.log(`[SwapsPage] Calling handleAcceptProposal for ${proposalId}`);
                await handleAcceptProposal(proposalId, undefined, undefined);
                // Cache invalidation and optimistic updates are handled automatically
                // Reload swaps to show updated status
                await loadSwaps();
              } catch (error) {
                // Error handling is managed by Redux state and will be displayed via UI
                console.error('Failed to accept proposal:', error);
              }
            };

            const handleRejectProposalWrapper = async (proposalId: string, reason?: string) => {
              console.log(`[SwapsPage] Reject proposal wrapper called for ${proposalId}`, { reason });
              try {
                // For the simplified schema, proposalId IS the swap_targets.id for booking proposals
                // and swap_proposals.id for cash proposals. The backend expects the same ID for both.
                // No need to pass swapTargetId separately - it's the same as proposalId.
                console.log(`[SwapsPage] Calling handleRejectProposal for ${proposalId}`);
                await handleRejectProposal(proposalId, reason, undefined, undefined);
                // Cache invalidation and optimistic updates are handled automatically
                // Reload swaps to show updated status
                await loadSwaps();
              } catch (error) {
                // Error handling is managed by Redux state and will be displayed via UI
                console.error('Failed to reject proposal:', error);
              }
            };

            return (
              <SwapCard
                key={swapCardData.userSwap.id}
                swapData={swapCardData}
                currentUserId={user?.id}
                onAcceptProposal={handleAcceptProposalWrapper}
                onRejectProposal={handleRejectProposalWrapper}
                onViewDetails={() => {
                  // Handle view details
                  console.log('Viewing details for swap:', swapCardData.userSwap.id);
                  setSelectedSwap(swapCardData);
                  setIsDetailsModalOpen(true);
                }}
                // Targeting action handlers
                onAcceptTarget={handleAcceptTarget}
                onRejectTarget={handleRejectTarget}
                onRetarget={handleRetarget}
                onCancelTargeting={handleCancelTargeting}
                onBrowseTargets={handleBrowseTargets}
              />
            );
          })}
        </div>
      )}

      {!isLoading && !error && (() => {
        const searchedSwaps = searchSwaps(rawSwaps, searchQuery);
        const filteredSwaps = applyTargetingFilters(searchedSwaps, activeTab);
        const sortedSwaps = sortSwaps(filteredSwaps, sortBy, sortOrder);
        return sortedSwaps.length === 0;
      })() && (
          <Card variant="outlined">
            <CardContent
              style={{ textAlign: 'center', padding: tokens.spacing[12] }}
            >
              <div
                style={{
                  fontSize: tokens.typography.fontSize['4xl'],
                  marginBottom: tokens.spacing[4],
                }}
              >
                🔄
              </div>
              <h3
                style={{
                  fontSize: tokens.typography.fontSize.xl,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  marginBottom: tokens.spacing[2],
                }}
              >
                {activeTab === 'all' ? 'No swaps yet' : `No ${activeTab} swaps`}
              </h3>
              <p
                style={{
                  color: tokens.colors.neutral[600],
                  marginBottom: tokens.spacing[6],
                }}
              >
                {activeTab === 'all'
                  ? 'Start by browsing available bookings and proposing your first swap.'
                  : `You don't have any ${activeTab} swaps at the moment. Try switching to "All Swaps" to see your complete swap history.`
                }
              </p>
              <Button variant="primary" onClick={() => navigate('/browse')}>
                Browse Swaps
              </Button>
            </CardContent>
          </Card>
        )}

      {/* Swap Creation Modal */}
      <SwapCreationModal
        isOpen={isCreatingSwap}
        onClose={handleCloseSwapModal}
        booking={sourceBooking}
        onSubmit={handleCreateSwap}
        loading={isSubmitting}
      />

      {/* Swap Details Modal */}
      {selectedSwap && (
        <SwapDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedSwap(null);
          }}
          swapData={selectedSwap}
        />
      )}
    </div>
  );
};