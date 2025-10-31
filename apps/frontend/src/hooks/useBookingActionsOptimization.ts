import { useMemo, useCallback, useRef } from 'react';
import { Booking, SwapInfo } from '@booking-swap/shared';
import { getSwapButtonState, shouldShowManageSwap } from '@/utils/swapButtonState';

/**
 * Performance optimization hook for booking actions
 * Provides memoized calculations and optimized event handlers for large booking lists
 */
export const useBookingActionsOptimization = (
    booking: Booking,
    swapInfo?: SwapInfo,
    onCreateSwap?: (booking: Booking) => void,
    onEdit?: (booking: Booking) => void,
    onManageSwap?: (swapInfo: SwapInfo) => void,
    onViewProposals?: (swapInfo: SwapInfo) => void
) => {
    // Use refs to store stable references for callbacks
    const onCreateSwapRef = useRef(onCreateSwap);
    const onEditRef = useRef(onEdit);
    const onManageSwapRef = useRef(onManageSwap);
    const onViewProposalsRef = useRef(onViewProposals);

    // Update refs when callbacks change
    onCreateSwapRef.current = onCreateSwap;
    onEditRef.current = onEdit;
    onManageSwapRef.current = onManageSwap;
    onViewProposalsRef.current = onViewProposals;

    // Memoize expensive calculations based on minimal dependencies
    const bookingState = useMemo(() => ({
        id: booking.id,
        status: booking.status,
        checkInDate: booking.dateRange.checkIn,
        verificationStatus: booking.verification.status
    }), [booking.id, booking.status, booking.dateRange.checkIn, booking.verification.status]);

    const swapState = useMemo(() => ({
        hasActiveProposals: swapInfo?.hasActiveProposals,
        activeProposalCount: swapInfo?.activeProposalCount,
        acceptanceStrategy: swapInfo?.acceptanceStrategy,
        userProposalStatus: swapInfo?.userProposalStatus,
        timeRemaining: swapInfo?.timeRemaining
    }), [
        swapInfo?.hasActiveProposals,
        swapInfo?.activeProposalCount,
        swapInfo?.acceptanceStrategy,
        swapInfo?.userProposalStatus,
        swapInfo?.timeRemaining
    ]);

    // Memoize button state calculations
    const swapButtonState = useMemo(() =>
        getSwapButtonState(booking, swapInfo, onCreateSwap),
        [bookingState.status, bookingState.checkInDate, bookingState.verificationStatus, swapState.hasActiveProposals, onCreateSwap]
    );

    const showManageSwap = useMemo(() =>
        shouldShowManageSwap(swapInfo),
        [swapState.hasActiveProposals]
    );

    const hasPendingProposals = useMemo(() =>
        Boolean(swapState.activeProposalCount && swapState.activeProposalCount > 0),
        [swapState.activeProposalCount]
    );

    const isBookingActive = useMemo(() =>
        bookingState.status === 'available',
        [bookingState.status]
    );

    // Memoize stable event handlers to prevent unnecessary re-renders
    const handleEdit = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onEditRef.current?.(booking);
    }, [booking.id]); // Only depend on booking ID for stability

    const handleCreateSwap = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onCreateSwapRef.current?.(booking);
    }, [booking.id]); // Only depend on booking ID for stability

    const handleManageSwap = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (swapInfo) {
            onManageSwapRef.current?.(swapInfo);
        }
    }, [swapInfo?.hasActiveProposals]); // Depend on a stable property

    const handleViewProposals = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (swapInfo) {
            onViewProposalsRef.current?.(swapInfo);
        }
    }, [swapInfo?.hasActiveProposals]); // Depend on a stable property

    // Memoize tooltip calculations
    const editTooltip = useMemo(() =>
        !isBookingActive ? 'Cannot edit inactive booking' : 'Edit booking details only',
        [isBookingActive]
    );

    const proposalsTooltip = useMemo(() =>
        `View ${swapState.activeProposalCount} pending proposal${swapState.activeProposalCount && swapState.activeProposalCount > 1 ? 's' : ''}`,
        [swapState.activeProposalCount]
    );

    return {
        // State
        swapButtonState,
        showManageSwap,
        hasPendingProposals,
        isBookingActive,

        // Event handlers
        handleEdit,
        handleCreateSwap,
        handleManageSwap,
        handleViewProposals,

        // Tooltips
        editTooltip,
        proposalsTooltip,

        // Raw state for advanced usage
        bookingState,
        swapState
    };
};

/**
 * Performance optimization hook for browser actions
 */
export const useBrowserActionsOptimization = (
    booking: Booking,
    swapInfo: SwapInfo,
    onMakeProposal?: () => void,
    onViewDetails?: (booking: Booking) => void
) => {
    const onMakeProposalRef = useRef(onMakeProposal);
    const onViewDetailsRef = useRef(onViewDetails);

    onMakeProposalRef.current = onMakeProposal;
    onViewDetailsRef.current = onViewDetails;

    const canMakeProposal = useMemo(() =>
        booking.status === 'available' && swapInfo.hasActiveProposals,
        [booking.status, swapInfo.hasActiveProposals]
    );

    const isAuction = useMemo(() =>
        swapInfo.acceptanceStrategy === 'auction',
        [swapInfo.acceptanceStrategy]
    );

    const isEndingSoon = useMemo(() =>
        swapInfo.timeRemaining && swapInfo.timeRemaining < 24 * 60 * 60 * 1000,
        [swapInfo.timeRemaining]
    );

    const proposalButtonText = useMemo(() => {
        if (isAuction) {
            return isEndingSoon ? 'Bid Now!' : 'Place Bid';
        }
        return 'Make Proposal';
    }, [isAuction, isEndingSoon]);

    const proposalButtonVariant = useMemo(() => {
        if (isEndingSoon) return 'primary';
        return isAuction ? 'secondary' : 'primary';
    }, [isEndingSoon, isAuction]);

    const handleViewDetails = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onViewDetailsRef.current?.(booking);
    }, [booking.id]);

    const handleMakeProposal = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onMakeProposalRef.current?.();
    }, []);

    const proposalTooltip = useMemo(() =>
        isAuction
            ? `Place a bid in this auction${isEndingSoon ? ' - ending soon!' : ''}`
            : 'Make a swap proposal for this booking',
        [isAuction, isEndingSoon]
    );

    return {
        canMakeProposal,
        isAuction,
        isEndingSoon,
        proposalButtonText,
        proposalButtonVariant,
        proposalTooltip,
        handleViewDetails,
        handleMakeProposal
    };
};

/**
 * Performance optimization hook for proposer actions
 */
export const useProposerActionsOptimization = (
    swapInfo: SwapInfo,
    onViewProposal?: () => void,
    onEditProposal?: () => void,
    onWithdrawProposal?: () => void
) => {
    const onViewProposalRef = useRef(onViewProposal);
    const onEditProposalRef = useRef(onEditProposal);
    const onWithdrawProposalRef = useRef(onWithdrawProposal);

    onViewProposalRef.current = onViewProposal;
    onEditProposalRef.current = onEditProposal;
    onWithdrawProposalRef.current = onWithdrawProposal;

    const proposalStatus = useMemo(() =>
        swapInfo.userProposalStatus,
        [swapInfo.userProposalStatus]
    );

    const isAuction = useMemo(() =>
        swapInfo.acceptanceStrategy === 'auction',
        [swapInfo.acceptanceStrategy]
    );

    const canEdit = useMemo(() =>
        proposalStatus === 'pending' && isAuction,
        [proposalStatus, isAuction]
    );

    const canWithdraw = useMemo(() =>
        proposalStatus === 'pending',
        [proposalStatus]
    );

    const handleViewProposal = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onViewProposalRef.current?.();
    }, []);

    const handleEditProposal = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onEditProposalRef.current?.();
    }, []);

    const handleWithdrawProposal = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onWithdrawProposalRef.current?.();
    }, []);

    return {
        proposalStatus,
        isAuction,
        canEdit,
        canWithdraw,
        handleViewProposal,
        handleEditProposal,
        handleWithdrawProposal
    };
};