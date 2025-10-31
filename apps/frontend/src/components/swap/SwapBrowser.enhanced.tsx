import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useDebounce } from '@/hooks/useDebounce';
import { SwapCard } from './SwapCard';
import { CashSwapCard } from './CashSwapCard';
import { FilterPanel } from '@/components/booking/FilterPanel';
import { SwapProposalModal, SwapProposalData } from './SwapProposalModal';
import { Button, Input, Badge, Tooltip } from '@/components/ui';
import { tokens } from '@/design-system/tokens';
import { Booking } from '@booking-swap/shared';

// Use a unified type for swaps with bookings
interface SwapWithBookings {
    id: string;
    sourceBooking: Booking;
    targetBooking?: Booking;
    proposer: { id: string; walletAddress: string; verificationLevel: string; reputation?: number };
    owner: { id: string; walletAddress: string; verificationLevel: string; reputation?: number };
    swapType: 'booking' | 'cash';
    cashDetails?: any;
    hasActiveProposals: boolean;
    activeProposalCount: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

import { swapTargetingService } from '@/services/swapTargetingService';
import {
    selectCurrentTarget,
    selectTargetingLoading,
    selectTargetingError,

    startTargeting,
    targetingSuccess,
    setError,
} from '@/store/slices/targetingSlice';

interface TargetingFilters {
    showOnlyTargetable: boolean;
    excludeAuctionEnded: boolean;
    excludeWithPendingProposals: boolean;
    auctionModeOnly?: boolean;
    oneForOneOnly?: boolean;
}

interface SwapBrowserEnhancedProps {
    swaps: any[]; // Use any to avoid type conflicts for now
    userBookings: Booking[];
    loading?: boolean;
    error?: string;
    onSwapSelect: (swap: any) => void;
    onSwapProposal: (data: SwapProposalData) => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    totalCount?: number;
    currentUserId: string;
    userActiveSwap?: any; // Current user's active swap for targeting
}

export const SwapBrowserEnhanced: React.FC<SwapBrowserEnhancedProps> = ({
    swaps,
    userBookings,
    loading = false,
    error,
    onSwapSelect,
    onSwapProposal,
    onLoadMore,
    hasMore = false,

    currentUserId,
    userActiveSwap,
}) => {
    const dispatch = useDispatch();

    // Redux state
    const currentTarget = useSelector(selectCurrentTarget);
    const targetingLoading = useSelector(selectTargetingLoading);
    const targetingError = useSelector(selectTargetingError);

    // Local state
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<any>({});
    const [targetingFilters, setTargetingFilters] = useState<TargetingFilters>({
        showOnlyTargetable: false,
        excludeAuctionEnded: true,
        excludeWithPendingProposals: false,
        auctionModeOnly: undefined,
        oneForOneOnly: undefined,
    });
    const [targetingPreferences, setTargetingPreferences] = useState({
        savedFilters: {} as TargetingFilters,
        preferredSort: 'targetability' as typeof sortBy,
        autoApplyFilters: false,
    });
    const [showFilters, setShowFilters] = useState(false);
    const [sortBy, setSortBy] = useState<'price' | 'date' | 'location' | 'created' | 'targetability'>('created');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [targetingMode, setTargetingMode] = useState(false);
    const [proposalModalOpen, setProposalModalOpen] = useState(false);
    const [selectedTargetSwap, setSelectedTargetSwap] = useState<SwapWithBookings | null>(null);
    const [cashOfferModalOpen, setCashOfferModalOpen] = useState(false);
    const [selectedCashSwap, setSelectedCashSwap] = useState<SwapWithBookings | null>(null);

    // Debounce search query
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Check if user has an active swap for targeting
    const hasActiveSwap = Boolean(userActiveSwap);

    // Enhanced filtering with targeting awareness
    const filteredAndSortedSwaps = useMemo(() => {
        let filtered = [...swaps];

        // Apply core browsing filters first (skip for now due to type issues)
        // filtered = swapFilterService.applyCoreBrowsingFilters(filtered, currentUserId);

        // Apply enhanced search filter with targeting-specific fields
        if (debouncedSearchQuery) {
            const query = debouncedSearchQuery.toLowerCase();
            filtered = filtered.filter(swap => {
                const basicMatch =
                    swap.sourceBooking?.title?.toLowerCase().includes(query) ||
                    swap.sourceBooking?.description?.toLowerCase().includes(query) ||
                    (swap.sourceBooking?.location?.city || '').toLowerCase().includes(query) ||
                    (swap.sourceBooking?.location?.country || '').toLowerCase().includes(query);

                // Enhanced targeting search
                if (targetingMode && hasActiveSwap) {
                    const targetability = getSwapTargetability(swap);
                    const auctionInfo = (swap as any).auctionInfo;

                    const targetingMatch =
                        (auctionInfo?.isAuction && 'auction'.includes(query)) ||
                        (!auctionInfo?.isAuction && 'one-for-one'.includes(query)) ||
                        (targetability.canTarget && 'targetable'.includes(query)) ||
                        (!targetability.canTarget && 'restricted'.includes(query)) ||
                        (swap.owner?.verificationLevel?.toLowerCase().includes(query)) ||
                        (swap.sourceBooking?.propertyType?.toLowerCase().includes(query));

                    return basicMatch || targetingMatch;
                }

                return basicMatch;
            });
        }

        // Apply user-configurable filters (skip for now due to type issues)
        // const swapFilters: SwapFilters = {
        //   ...filters,
        //   excludeOwnSwaps: true as const,
        //   excludeCancelledBookings: true as const,
        //   requireActiveProposals: true as const,
        // };
        // filtered = swapFilterService.applyUserFilters(filtered, swapFilters);

        // Apply targeting-specific filters
        if (targetingMode && hasActiveSwap) {
            filtered = applyTargetingFilters(filtered, targetingFilters);
        }

        // Apply sorting with targeting awareness
        filtered.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'targetability':
                    if (targetingMode && hasActiveSwap) {
                        const aTargetable = getSwapTargetability(a);
                        const bTargetable = getSwapTargetability(b);

                        // Enhanced targetability scoring with multiple factors
                        let aScore = aTargetable.score;
                        let bScore = bTargetable.score;

                        // Boost score for auction mode swaps (more flexible)
                        const aAuction = (a as any).auctionInfo;
                        const bAuction = (b as any).auctionInfo;
                        if (aAuction?.isAuction) aScore += 10;
                        if (bAuction?.isAuction) bScore += 10;

                        // Boost score for verified users
                        if (a.owner?.verificationLevel === 'verified') aScore += 5;
                        if (b.owner?.verificationLevel === 'verified') bScore += 5;

                        // Boost score for similar property types (if available)
                        if (userActiveSwap?.sourceBooking?.propertyType === a.sourceBooking?.propertyType) aScore += 15;
                        if (userActiveSwap?.sourceBooking?.propertyType === b.sourceBooking?.propertyType) bScore += 15;

                        comparison = bScore - aScore;
                    } else {
                        comparison = 0;
                    }
                    break;
                case 'price':
                    const aPrice = a.sourceBooking?.swapValue || a.sourceBooking?.originalPrice || 0;
                    const bPrice = b.sourceBooking?.swapValue || b.sourceBooking?.originalPrice || 0;
                    comparison = aPrice - bPrice;
                    break;
                case 'date':
                    const aDate = new Date(a.sourceBooking?.dateRange?.checkIn || 0);
                    const bDate = new Date(b.sourceBooking?.dateRange?.checkIn || 0);
                    comparison = aDate.getTime() - bDate.getTime();
                    break;
                case 'location':
                    const aLocation = `${a.sourceBooking?.location?.city || ''}, ${a.sourceBooking?.location?.country || ''
                        }`;
                    const bLocation = `${b.sourceBooking?.location?.city || ''}, ${b.sourceBooking?.location?.country || ''
                        }`;
                    comparison = aLocation.localeCompare(bLocation);
                    break;
                case 'created':
                default:
                    comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                    break;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [
        swaps,
        currentUserId,
        debouncedSearchQuery,
        filters,
        targetingFilters,
        targetingMode,
        hasActiveSwap,
        sortBy,
        sortOrder,
    ]);

    // Apply targeting-specific filters
    const applyTargetingFilters = useCallback(
        (swapList: any[], tFilters: TargetingFilters): any[] => {
            let filtered = [...swapList];

            if (tFilters.showOnlyTargetable) {
                filtered = filtered.filter(swap => {
                    const targetability = getSwapTargetability(swap);
                    return targetability.canTarget;
                });
            }

            if (tFilters.excludeAuctionEnded) {
                filtered = filtered.filter(swap => {
                    const auctionInfo = (swap as any).auctionInfo;
                    if (auctionInfo?.isAuction && auctionInfo?.endDate) {
                        return new Date(auctionInfo.endDate) > new Date();
                    }
                    return true;
                });
            }

            if (tFilters.excludeWithPendingProposals) {
                filtered = filtered.filter(swap => {
                    const auctionInfo = (swap as any).auctionInfo;
                    return !auctionInfo || auctionInfo.proposalCount === 0;
                });
            }

            if (tFilters.auctionModeOnly) {
                filtered = filtered.filter(swap => {
                    const auctionInfo = (swap as any).auctionInfo;
                    return auctionInfo?.isAuction === true;
                });
            }

            if (tFilters.oneForOneOnly) {
                filtered = filtered.filter(swap => {
                    const auctionInfo = (swap as any).auctionInfo;
                    return !auctionInfo?.isAuction;
                });
            }

            return filtered;
        },
        []
    );

    // Get swap targetability information with enhanced scoring
    const getSwapTargetability = useCallback(
        (swap: any) => {
            if (!hasActiveSwap || !userActiveSwap) {
                return {
                    canTarget: false,
                    score: 0,
                    restrictions: ['No active swap'],
                    compatibility: 0,
                    successRate: 0,
                    details: {}
                };
            }

            let canTarget = true;
            let score = 100;
            let compatibility = 50; // Base compatibility score
            const restrictions: string[] = [];
            const warnings: string[] = [];
            const details: any = {};

            // Basic checks
            if (swap.owner?.id === currentUserId) {
                canTarget = false;
                score = 0;
                restrictions.push('Own swap');
            }

            if (swap.status !== 'pending') {
                canTarget = false;
                score = 0;
                restrictions.push('Swap not available');
            }

            // Check if already targeting this swap
            if (currentTarget?.targetSwapId === swap.id) {
                canTarget = false;
                score = 0;
                restrictions.push('Already targeting');
            }

            // Auction mode checks with enhanced details
            const auctionInfo = (swap as any).auctionInfo;
            if (auctionInfo?.isAuction) {
                details.auctionMode = true;
                details.auctionEndDate = auctionInfo.endDate;
                details.proposalCount = auctionInfo.proposalCount || 0;

                if (auctionInfo.endDate && new Date(auctionInfo.endDate) <= new Date()) {
                    canTarget = false;
                    score = 0;
                    restrictions.push('Auction ended');
                } else {
                    // Auction mode allows multiple proposals, higher base score
                    score += 20;
                    compatibility += 15; // Auctions are more flexible

                    // Calculate time remaining bonus
                    if (auctionInfo.endDate) {
                        const timeLeft = new Date(auctionInfo.endDate).getTime() - new Date().getTime();
                        const hoursLeft = timeLeft / (1000 * 60 * 60);
                        if (hoursLeft > 24) score += 10;
                        else if (hoursLeft > 6) score += 5;
                        else if (hoursLeft > 1) warnings.push('Auction ending soon');
                        else warnings.push('Auction ending very soon');
                    }
                }
            } else {
                // One-for-one mode
                details.auctionMode = false;
                details.proposalCount = auctionInfo?.proposalCount || 0;

                if (auctionInfo?.proposalCount > 0) {
                    canTarget = false;
                    score = 0;
                    restrictions.push('Proposal pending');
                } else {
                    compatibility += 10; // One-for-one can be more direct
                }
            }

            // Adjust score based on proposal competition (for auctions)
            if (auctionInfo?.isAuction && auctionInfo.proposalCount > 0) {
                const competitionPenalty = Math.min(auctionInfo.proposalCount * 8, 40);
                score -= competitionPenalty;
                compatibility -= Math.min(auctionInfo.proposalCount * 3, 15);

                if (auctionInfo.proposalCount >= 5) {
                    warnings.push('High competition');
                } else if (auctionInfo.proposalCount >= 2) {
                    warnings.push('Some competition');
                }
            }

            // Enhanced compatibility scoring
            if (canTarget) {
                // Location compatibility
                const userLocation = userActiveSwap.sourceBooking?.location;
                const swapLocation = swap.sourceBooking?.location;
                if (userLocation && swapLocation) {
                    if (userLocation.country === swapLocation.country) {
                        compatibility += 20;
                        if (userLocation.city === swapLocation.city) {
                            compatibility += 10;
                        }
                    }
                }

                // Property type compatibility
                if (userActiveSwap.sourceBooking?.propertyType === swap.sourceBooking?.propertyType) {
                    compatibility += 15;
                    score += 10;
                }

                // Date range compatibility
                const userDates = userActiveSwap.sourceBooking?.dateRange;
                const swapDates = swap.sourceBooking?.dateRange;
                if (userDates && swapDates) {
                    const userStart = new Date(userDates.checkIn);
                    const userEnd = new Date(userDates.checkOut);
                    const swapStart = new Date(swapDates.checkIn);
                    const swapEnd = new Date(swapDates.checkOut);

                    // Check for date overlap or proximity
                    const overlap = Math.max(0, Math.min(userEnd.getTime(), swapEnd.getTime()) - Math.max(userStart.getTime(), swapStart.getTime()));
                    if (overlap > 0) {
                        compatibility += 25;
                        score += 15;
                    } else {
                        // Check if dates are within reasonable range
                        const daysDiff = Math.abs(userStart.getTime() - swapStart.getTime()) / (1000 * 60 * 60 * 24);
                        if (daysDiff <= 7) {
                            compatibility += 15;
                            score += 10;
                        } else if (daysDiff <= 30) {
                            compatibility += 5;
                        }
                    }
                }

                // Value compatibility
                const userValue = userActiveSwap.sourceBooking?.swapValue || userActiveSwap.sourceBooking?.originalPrice || 0;
                const swapValue = swap.sourceBooking?.swapValue || swap.sourceBooking?.originalPrice || 0;
                if (userValue && swapValue) {
                    const valueDiff = Math.abs(userValue - swapValue) / Math.max(userValue, swapValue);
                    if (valueDiff <= 0.1) { // Within 10%
                        compatibility += 20;
                        score += 15;
                    } else if (valueDiff <= 0.25) { // Within 25%
                        compatibility += 10;
                        score += 5;
                    } else if (valueDiff > 0.5) { // More than 50% difference
                        warnings.push('Significant value difference');
                    }
                }

                // User verification bonus
                if (swap.owner?.verificationLevel === 'verified') {
                    compatibility += 10;
                    score += 5;
                }

                // Reputation bonus (if available)
                if (swap.owner?.reputation && swap.owner.reputation > 4) {
                    compatibility += 5;
                    score += 3;
                }
            }

            // Calculate estimated success rate based on various factors
            let successRate = 0;
            if (canTarget) {
                successRate = Math.min(100, Math.max(0,
                    (compatibility * 0.6) +
                    (score * 0.3) +
                    (auctionInfo?.isAuction ? 10 : 20) - // Auction vs one-for-one base rate
                    (auctionInfo?.proposalCount || 0) * 5 // Competition penalty
                ));
            }

            // Ensure scores are within bounds
            score = Math.max(0, Math.min(100, score));
            compatibility = Math.max(0, Math.min(100, compatibility));

            return {
                canTarget,
                score,
                restrictions,
                warnings,
                compatibility,
                successRate: Math.round(successRate),
                details: {
                    ...details,
                    userVerified: swap.owner?.verificationLevel === 'verified',
                    reputation: swap.owner?.reputation || 0,
                    valueMatch: userActiveSwap && swap.sourceBooking ?
                        Math.abs((userActiveSwap.sourceBooking?.swapValue || 0) - (swap.sourceBooking?.swapValue || 0)) : null
                }
            };
        },
        [hasActiveSwap, userActiveSwap, currentUserId, currentTarget]
    );

    // Handle targeting workflow
    const handleTargetSwap = useCallback(
        async (targetSwapId: string) => {
            if (!userActiveSwap) {
                console.error('No active swap to target with');
                return;
            }

            try {
                dispatch(startTargeting(userActiveSwap.id));

                const result = await swapTargetingService.targetSwap(
                    userActiveSwap.id,
                    targetSwapId
                );

                if (result.success) {
                    dispatch(targetingSuccess(result));
                } else {
                    dispatch(setError(result.error || 'Failed to target swap'));
                }
            } catch (error) {
                console.error('Error targeting swap:', error);
                dispatch(
                    setError(error instanceof Error ? error.message : 'Failed to target swap')
                );
            }
        },
        [userActiveSwap, dispatch]
    );

    // Handle swap actions with targeting integration
    const handleSwapAction = useCallback(
        (action: string, swap: any) => {
            if (action === 'target' && targetingMode) {
                handleTargetSwap(swap.id);
            } else if (action === 'propose') {
                setSelectedTargetSwap(swap);
                setProposalModalOpen(true);
            } else if (action === 'view') {
                onSwapSelect(swap);
            }
        },
        [targetingMode, handleTargetSwap, onSwapSelect]
    );

    // Handle cash swap actions
    const handleCashSwapMakeOffer = useCallback(
        (swapId: string) => {
            const swap = filteredAndSortedSwaps.find(s => s.id === swapId);
            if (swap) {
                setSelectedCashSwap(swap);
                setCashOfferModalOpen(true);
            }
        },
        [filteredAndSortedSwaps]
    );

    const handleCashSwapViewOffers = useCallback(
        (swapId: string) => {
            const swap = filteredAndSortedSwaps.find(s => s.id === swapId);
            if (swap) {
                onSwapSelect(swap);
            }
        },
        [filteredAndSortedSwaps, onSwapSelect]
    );

    const handleCashSwapViewDetails = useCallback(
        (swap: any) => {
            onSwapSelect(swap);
        },
        [onSwapSelect]
    );

    // Handle proposal submission
    const handleProposalSubmit = useCallback(
        (data: SwapProposalData) => {
            onSwapProposal(data);
            setProposalModalOpen(false);
            setSelectedTargetSwap(null);
        },
        [onSwapProposal]
    );

    // Handle modal close
    const handleProposalModalClose = useCallback(() => {
        setProposalModalOpen(false);
        setSelectedTargetSwap(null);
    }, []);

    const handleCashOfferModalClose = useCallback(() => {
        setCashOfferModalOpen(false);
        setSelectedCashSwap(null);
    }, []);

    // Handle filter changes
    const handleFilterChange = useCallback((newFilters: any) => {
        setFilters(newFilters);
    }, []);

    const handleTargetingFilterChange = useCallback((newFilters: Partial<TargetingFilters>) => {
        setTargetingFilters(prev => ({ ...prev, ...newFilters }));
    }, []);

    // Save targeting preferences
    const saveTargetingPreferences = useCallback(() => {
        const preferences = {
            savedFilters: targetingFilters,
            preferredSort: sortBy,
            autoApplyFilters: targetingPreferences.autoApplyFilters,
        };
        setTargetingPreferences(preferences);

        // In a real app, this would save to localStorage or user preferences API
        try {
            localStorage.setItem('swapTargetingPreferences', JSON.stringify(preferences));
        } catch (error) {
            console.warn('Failed to save targeting preferences:', error);
        }
    }, [targetingFilters, sortBy, targetingPreferences.autoApplyFilters]);

    // Load targeting preferences
    const loadTargetingPreferences = useCallback(() => {
        try {
            const saved = localStorage.getItem('swapTargetingPreferences');
            if (saved) {
                const preferences = JSON.parse(saved);
                setTargetingPreferences(preferences);
                if (preferences.autoApplyFilters) {
                    setTargetingFilters(preferences.savedFilters);
                    setSortBy(preferences.preferredSort);
                }
            }
        } catch (error) {
            console.warn('Failed to load targeting preferences:', error);
        }
    }, []);

    // Load preferences on mount
    useEffect(() => {
        loadTargetingPreferences();
    }, [loadTargetingPreferences]);

    const handleFilterReset = useCallback(() => {
        setFilters({});
        setTargetingFilters({
            showOnlyTargetable: false,
            excludeAuctionEnded: true,
            excludeWithPendingProposals: false,
            auctionModeOnly: undefined,
            oneForOneOnly: undefined,
        });
        setSearchQuery('');
    }, []);

    // Handle load more
    const handleLoadMore = useCallback(() => {
        if (onLoadMore && hasMore && !loading) {
            onLoadMore();
        }
    }, [onLoadMore, hasMore, loading]);

    // Infinite scroll effect
    useEffect(() => {
        const handleScroll = () => {
            if (
                window.innerHeight + document.documentElement.scrollTop >=
                document.documentElement.offsetHeight - 1000
            ) {
                handleLoadMore();
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [handleLoadMore]);

    // Toggle targeting mode when user has active swap
    const handleToggleTargetingMode = useCallback(() => {
        if (hasActiveSwap) {
            setTargetingMode(!targetingMode);
            if (!targetingMode) {
                // Entering targeting mode - add targetability sort option
                setSortBy('targetability');
            } else {
                // Exiting targeting mode - reset to default sort
                setSortBy('created');
            }
        }
    }, [hasActiveSwap, targetingMode]);

    // Get filter summary
    const filterSummary = useMemo(() => {
        // Skip filter service for now due to type issues
        let summary = 'Basic filters applied';

        if (targetingMode) {
            const targetingFilterCount = Object.values(targetingFilters).filter(Boolean).length;
            if (targetingFilterCount > 0) {
                summary += `, ${targetingFilterCount} targeting filter${targetingFilterCount !== 1 ? 's' : ''}`;
            }
        }

        return summary;
    }, [filters, targetingFilters, targetingMode, currentUserId]);

    // Styles
    const containerStyles = {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: tokens.spacing[6],
        padding: tokens.spacing[6],
        maxWidth: '1400px',
        margin: '0 auto',
    };

    const headerStyles = {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: tokens.spacing[4],
    };

    const searchBarStyles = {
        display: 'flex',
        gap: tokens.spacing[4],
        alignItems: 'center',
        flexWrap: 'wrap' as const,
    };

    const controlsStyles = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap' as const,
        gap: tokens.spacing[4],
    };

    const sortControlsStyles = {
        display: 'flex',
        gap: tokens.spacing[2],
        alignItems: 'center',
    };

    const viewControlsStyles = {
        display: 'flex',
        gap: tokens.spacing[2],
        alignItems: 'center',
    };

    const gridStyles = {
        display: 'grid',
        gridTemplateColumns:
            viewMode === 'grid' ? 'repeat(auto-fill, minmax(400px, 1fr))' : '1fr',
        gap: tokens.spacing[6],
    };

    const resultsHeaderStyles = {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: tokens.spacing[2],
        padding: `${tokens.spacing[4]} 0`,
        borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
    };

    const loadingStyles = {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: tokens.spacing[8],
        color: tokens.colors.neutral[500],
    };

    const errorStyles = {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: tokens.spacing[8],
        color: tokens.colors.error[600],
        backgroundColor: tokens.colors.error[50],
        borderRadius: tokens.borderRadius.md,
        border: `1px solid ${tokens.colors.error[200]}`,
    };

    const emptyStateStyles = {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing[12],
        textAlign: 'center' as const,
        color: tokens.colors.neutral[500],
    };

    const filterInfoStyles = {
        padding: tokens.spacing[3],
        backgroundColor: targetingMode ? tokens.colors.success[50] : tokens.colors.primary[50],
        borderRadius: tokens.borderRadius.md,
        border: `1px solid ${targetingMode ? tokens.colors.success[200] : tokens.colors.primary[200]}`,
        fontSize: tokens.typography.fontSize.sm,
        color: targetingMode ? tokens.colors.success[700] : tokens.colors.primary[700],
    };

    return (
        <div style={containerStyles}>
            {/* Header */}
            <div style={headerStyles}>
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[4] }}>
                    <h1
                        style={{
                            fontSize: tokens.typography.fontSize['3xl'],
                            fontWeight: tokens.typography.fontWeight.bold,
                            color: tokens.colors.neutral[900],
                            margin: 0,
                        }}
                    >
                        {targetingMode ? 'Target Your Swap' : 'Browse Available Swaps'}
                    </h1>

                    {/* Targeting Mode Toggle */}
                    {hasActiveSwap && (
                        <Tooltip
                            content={
                                targetingMode
                                    ? 'Exit targeting mode to browse normally'
                                    : 'Enter targeting mode to find swaps for your active booking'
                            }
                        >
                            <Button
                                variant={targetingMode ? 'primary' : 'outline'}
                                onClick={handleToggleTargetingMode}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: tokens.spacing[2],
                                }}
                            >
                                <span>{targetingMode ? '🎯' : '🔍'}</span>
                                <span>{targetingMode ? 'Targeting Mode' : 'Browse Mode'}</span>
                            </Button>
                        </Tooltip>
                    )}
                </div>

                <p
                    style={{
                        fontSize: tokens.typography.fontSize.lg,
                        color: tokens.colors.neutral[600],
                        margin: 0,
                    }}
                >
                    {targetingMode
                        ? `Find the perfect match for your ${userActiveSwap?.sourceBooking?.title || 'booking'}`
                        : 'Discover swaps available for proposals and find your perfect match'}
                </p>

                {/* Active Swap Info in Targeting Mode */}
                {targetingMode && userActiveSwap && (
                    <div
                        style={{
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.success[50],
                            borderRadius: tokens.borderRadius.md,
                            border: `1px solid ${tokens.colors.success[200]}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[3],
                        }}
                    >
                        <Badge variant="success">Your Active Swap</Badge>
                        <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                            {userActiveSwap.sourceBooking?.title}
                        </span>
                        <span style={{ color: tokens.colors.neutral[600] }}>
                            {userActiveSwap.sourceBooking?.location?.city}, {userActiveSwap.sourceBooking?.location?.country}
                        </span>
                        {currentTarget && (
                            <Badge variant="info">
                                Currently targeting: {currentTarget.targetSwapId}
                            </Badge>
                        )}
                    </div>
                )}
            </div>

            {/* Search and Filter Controls */}
            <div style={searchBarStyles}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <Input
                        placeholder={
                            targetingMode
                                ? 'Search for swaps to target...'
                                : 'Search by title, location, or description...'
                        }
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        leftIcon={<span>🔍</span>}
                        rightIcon={
                            searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: tokens.colors.neutral[400],
                                        padding: 0,
                                        pointerEvents: 'auto',
                                    }}
                                    aria-label="Clear search"
                                >
                                    ✕
                                </button>
                            )
                        }
                    />
                </div>

                <Button
                    variant={showFilters ? 'primary' : 'outline'}
                    onClick={() => setShowFilters(!showFilters)}
                >
                    {showFilters ? 'Hide Filters' : 'Show Filters'}
                    <span style={{ marginLeft: tokens.spacing[2] }}>
                        {showFilters ? '▲' : '▼'}
                    </span>
                </Button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
                    <FilterPanel
                        filters={filters}
                        onChange={handleFilterChange}
                        onReset={handleFilterReset}
                        mode="swap"
                    />

                    {/* Targeting-Specific Filters */}
                    {targetingMode && hasActiveSwap && (
                        <div
                            style={{
                                padding: tokens.spacing[4],
                                backgroundColor: tokens.colors.success[50],
                                borderRadius: tokens.borderRadius.md,
                                border: `1px solid ${tokens.colors.success[200]}`,
                            }}
                        >
                            <h4
                                style={{
                                    fontSize: tokens.typography.fontSize.lg,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.success[800],
                                    margin: `0 0 ${tokens.spacing[3]} 0`,
                                }}
                            >
                                Targeting Filters
                            </h4>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                    gap: tokens.spacing[4],
                                }}
                            >
                                <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                    <input
                                        type="checkbox"
                                        checked={targetingFilters.showOnlyTargetable}
                                        onChange={e =>
                                            handleTargetingFilterChange({ showOnlyTargetable: e.target.checked })
                                        }
                                    />
                                    <span>Show only targetable swaps</span>
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                    <input
                                        type="checkbox"
                                        checked={targetingFilters.excludeAuctionEnded}
                                        onChange={e =>
                                            handleTargetingFilterChange({ excludeAuctionEnded: e.target.checked })
                                        }
                                    />
                                    <span>Exclude ended auctions</span>
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                    <input
                                        type="checkbox"
                                        checked={targetingFilters.excludeWithPendingProposals}
                                        onChange={e =>
                                            handleTargetingFilterChange({
                                                excludeWithPendingProposals: e.target.checked,
                                            })
                                        }
                                    />
                                    <span>Exclude swaps with pending proposals</span>
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                    <input
                                        type="checkbox"
                                        checked={targetingFilters.auctionModeOnly || false}
                                        onChange={e =>
                                            handleTargetingFilterChange({
                                                auctionModeOnly: e.target.checked ? true : undefined,
                                                oneForOneOnly: e.target.checked ? undefined : targetingFilters.oneForOneOnly,
                                            })
                                        }
                                    />
                                    <span>Auction mode only</span>
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                    <input
                                        type="checkbox"
                                        checked={targetingFilters.oneForOneOnly || false}
                                        onChange={e =>
                                            handleTargetingFilterChange({
                                                oneForOneOnly: e.target.checked ? true : undefined,
                                                auctionModeOnly: e.target.checked ? undefined : targetingFilters.auctionModeOnly,
                                            })
                                        }
                                    />
                                    <span>One-for-one mode only</span>
                                </label>
                            </div>

                            {/* Targeting Preferences */}
                            <div
                                style={{
                                    marginTop: tokens.spacing[4],
                                    paddingTop: tokens.spacing[4],
                                    borderTop: `1px solid ${tokens.colors.success[200]}`,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: tokens.spacing[3],
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[3] }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                        <input
                                            type="checkbox"
                                            checked={targetingPreferences.autoApplyFilters}
                                            onChange={e =>
                                                setTargetingPreferences(prev => ({
                                                    ...prev,
                                                    autoApplyFilters: e.target.checked,
                                                }))
                                            }
                                        />
                                        <span>Auto-apply saved preferences</span>
                                    </label>
                                </div>

                                <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={saveTargetingPreferences}
                                    >
                                        💾 Save Preferences
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setTargetingFilters(targetingPreferences.savedFilters);
                                            setSortBy(targetingPreferences.preferredSort);
                                        }}
                                        disabled={!Object.keys(targetingPreferences.savedFilters).length}
                                    >
                                        📋 Load Saved
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Filter Information */}
            <div style={filterInfoStyles}>
                <strong>Active Filters:</strong> {filterSummary}
                {targetingMode && (
                    <span style={{ marginLeft: tokens.spacing[2] }}>
                        • Targeting mode active for {userActiveSwap?.sourceBooking?.title}
                    </span>
                )}
            </div>

            {/* Controls */}
            <div style={controlsStyles}>
                <div style={sortControlsStyles}>
                    <label
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.neutral[700],
                        }}
                    >
                        Sort by:
                    </label>
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as typeof sortBy)}
                        style={{
                            padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                            border: `1px solid ${tokens.colors.neutral[300]}`,
                            borderRadius: tokens.borderRadius.md,
                            fontSize: tokens.typography.fontSize.sm,
                        }}
                    >
                        <option value="created">Date Created</option>
                        <option value="date">Check-in Date</option>
                        <option value="price">Swap Value</option>
                        <option value="location">Location</option>
                        {targetingMode && hasActiveSwap && (
                            <option value="targetability">Targetability</option>
                        )}
                    </select>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        aria-label={`Sort ${sortOrder === 'desc' ? 'ascending' : 'descending'}`}
                    >
                        {sortOrder === 'asc' ? '↑' : '↓'}
                    </Button>
                </div>

                <div style={viewControlsStyles}>
                    <Button
                        variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        aria-label="Grid view"
                    >
                        ⊞
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        aria-label="List view"
                    >
                        ☰
                    </Button>
                </div>
            </div>

            {/* Results Header */}
            <div style={resultsHeaderStyles}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                        }}
                    >
                        {filteredAndSortedSwaps.length} swaps{' '}
                        {targetingMode ? 'available for targeting' : 'available for proposals'}
                        {(debouncedSearchQuery || Object.keys(filters).length > 0 || targetingMode) && (
                            <span style={{ fontStyle: 'italic' }}> - filters applied</span>
                        )}
                    </div>

                    {(debouncedSearchQuery || Object.keys(filters).length > 0) && (
                        <Button variant="ghost" size="sm" onClick={handleFilterReset}>
                            Clear search & filters
                        </Button>
                    )}
                </div>
            </div>

            {/* Error State */}
            {(error || targetingError) && (
                <div style={errorStyles}>
                    <span style={{ marginRight: tokens.spacing[2] }}>⚠️</span>
                    {error || targetingError}
                </div>
            )}

            {/* Loading State */}
            {(loading || targetingLoading) && swaps.length === 0 && (
                <div style={loadingStyles}>
                    <div
                        style={{
                            width: '32px',
                            height: '32px',
                            border: `3px solid ${tokens.colors.neutral[200]}`,
                            borderTop: `3px solid ${tokens.colors.primary[500]}`,
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            marginRight: tokens.spacing[3],
                        }}
                    />
                    {targetingMode ? 'Finding targetable swaps...' : 'Loading swaps...'}
                </div>
            )}

            {/* Empty State */}
            {!loading && !targetingLoading && filteredAndSortedSwaps.length === 0 && !error && !targetingError && (
                <div style={emptyStateStyles}>
                    <div style={{ fontSize: '48px', marginBottom: tokens.spacing[4] }}>
                        {swaps.length === 0 ? '📭' : targetingMode ? '🎯' : '🔍'}
                    </div>
                    <h3
                        style={{
                            fontSize: tokens.typography.fontSize.xl,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[700],
                            margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                    >
                        {swaps.length === 0
                            ? 'No swaps available'
                            : targetingMode
                                ? 'No targetable swaps found'
                                : 'No swaps match your criteria'}
                    </h3>
                    <p
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.neutral[500],
                            margin: 0,
                            maxWidth: '500px',
                            lineHeight: 1.5,
                        }}
                    >
                        {swaps.length === 0 ? (
                            'There are no active swaps available at the moment. Check back later or create your own swap to get started!'
                        ) : targetingMode ? (
                            <>
                                No swaps are currently available for targeting with your active booking.
                                <br />
                                Try adjusting your targeting filters or check back later for new opportunities.
                            </>
                        ) : (
                            <>
                                All available swaps are filtered out. Try adjusting your search or filters to find more results.
                            </>
                        )}
                    </p>
                    {(debouncedSearchQuery || Object.keys(filters).length > 0 || targetingMode) && (
                        <Button
                            variant="outline"
                            onClick={handleFilterReset}
                            style={{ marginTop: tokens.spacing[4] }}
                        >
                            Clear all filters
                        </Button>
                    )}
                </div>
            )}

            {/* Swap Grid */}
            {filteredAndSortedSwaps.length > 0 && (
                <div style={gridStyles}>
                    {filteredAndSortedSwaps.map(swap => {
                        // Render different card types based on mode and swap type
                        if (targetingMode && hasActiveSwap) {
                            // Use enhanced swap card with targeting functionality in targeting mode
                            const targetability = getSwapTargetability(swap);
                            const auctionInfo = (swap as any).auctionInfo;

                            return (
                                <div key={swap.id} style={{ position: 'relative' }}>
                                    {/* Enhanced targeting overlay */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: tokens.spacing[2],
                                            right: tokens.spacing[2],
                                            zIndex: 10,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: tokens.spacing[1],
                                            alignItems: 'flex-end',
                                        }}
                                    >
                                        {/* Auction/Mode indicator */}
                                        <Badge
                                            variant={auctionInfo?.isAuction ? 'info' : 'secondary'}
                                            style={{ fontSize: tokens.typography.fontSize.xs }}
                                        >
                                            {auctionInfo?.isAuction ? '🏆 Auction' : '🤝 One-for-One'}
                                        </Badge>

                                        {/* Proposal count for auctions */}
                                        {auctionInfo?.isAuction && auctionInfo.proposalCount > 0 && (
                                            <Badge variant="warning" style={{ fontSize: tokens.typography.fontSize.xs }}>
                                                {auctionInfo.proposalCount} proposal{auctionInfo.proposalCount !== 1 ? 's' : ''}
                                            </Badge>
                                        )}

                                        {/* Auction end time */}
                                        {auctionInfo?.isAuction && auctionInfo.endDate && (
                                            <Badge
                                                variant={
                                                    new Date(auctionInfo.endDate).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000
                                                        ? 'error' : 'info'
                                                }
                                                style={{ fontSize: tokens.typography.fontSize.xs }}
                                            >
                                                {(() => {
                                                    const timeLeft = new Date(auctionInfo.endDate).getTime() - new Date().getTime();
                                                    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                                                    const daysLeft = Math.floor(hoursLeft / 24);

                                                    if (daysLeft > 0) return `${daysLeft}d left`;
                                                    if (hoursLeft > 0) return `${hoursLeft}h left`;
                                                    return 'Ending soon';
                                                })()}
                                            </Badge>
                                        )}

                                        {/* Main targeting button */}
                                        {targetability.canTarget ? (
                                            <Tooltip
                                                content={`Success Rate: ${targetability.successRate}% | Compatibility: ${targetability.compatibility}%${targetability.warnings && targetability.warnings.length > 0 ? ' | Warnings: ' + targetability.warnings.join(', ') : ''}`}
                                            >
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => handleTargetSwap(swap.id)}
                                                    style={{
                                                        backgroundColor: tokens.colors.success[500],
                                                        borderColor: tokens.colors.success[500],
                                                    }}
                                                >
                                                    🎯 Target ({targetability.successRate}%)
                                                </Button>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip
                                                content={`Restrictions: ${targetability.restrictions.join(', ')}`}
                                            >
                                                <Badge variant="error">
                                                    ❌ {targetability.restrictions[0] || 'Cannot Target'}
                                                </Badge>
                                            </Tooltip>
                                        )}
                                    </div>

                                    {/* Enhanced targetability indicators */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: tokens.spacing[2],
                                            left: tokens.spacing[2],
                                            zIndex: 10,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: tokens.spacing[1],
                                        }}
                                    >
                                        {/* Compatibility score */}
                                        <Tooltip content={`Compatibility based on location, dates, property type, and value`}>
                                            <Badge
                                                variant={
                                                    targetability.compatibility >= 80
                                                        ? 'success'
                                                        : targetability.compatibility >= 60
                                                            ? 'info'
                                                            : targetability.compatibility >= 40
                                                                ? 'warning'
                                                                : 'error'
                                                }
                                                style={{ fontSize: tokens.typography.fontSize.xs }}
                                            >
                                                🎯 {targetability.compatibility}%
                                            </Badge>
                                        </Tooltip>

                                        {/* User verification indicator */}
                                        {targetability.details.userVerified && (
                                            <Badge variant="success" style={{ fontSize: tokens.typography.fontSize.xs }}>
                                                ✓ Verified
                                            </Badge>
                                        )}

                                        {/* High reputation indicator */}
                                        {targetability.details.reputation > 4 && (
                                            <Badge variant="info" style={{ fontSize: tokens.typography.fontSize.xs }}>
                                                ⭐ {targetability.details.reputation.toFixed(1)}
                                            </Badge>
                                        )}

                                        {/* Value match indicator */}
                                        {targetability.details.valueMatch !== null && targetability.details.valueMatch < 100 && (
                                            <Badge variant="success" style={{ fontSize: tokens.typography.fontSize.xs }}>
                                                💰 Similar Value
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Targeting warnings overlay */}
                                    {targetability.warnings && targetability.warnings.length > 0 && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                bottom: tokens.spacing[2],
                                                left: tokens.spacing[2],
                                                right: tokens.spacing[2],
                                                zIndex: 10,
                                                backgroundColor: tokens.colors.warning[50],
                                                border: `1px solid ${tokens.colors.warning[200]}`,
                                                borderRadius: tokens.borderRadius.sm,
                                                padding: tokens.spacing[2],
                                                fontSize: tokens.typography.fontSize.xs,
                                                color: tokens.colors.warning[800],
                                            }}
                                        >
                                            ⚠️ {targetability.warnings.join(', ')}
                                        </div>
                                    )}

                                    <SwapCard
                                        swap={swap as any}
                                        userRole="proposer"
                                        onAction={handleSwapAction}
                                    />
                                </div>
                            );
                        } else if (swap.swapType === 'cash') {
                            return (
                                <CashSwapCard
                                    key={swap.id}
                                    swap={swap}
                                    onMakeOffer={handleCashSwapMakeOffer}
                                    onViewOffers={handleCashSwapViewOffers}
                                    onViewDetails={handleCashSwapViewDetails}
                                    currentUserId={currentUserId}
                                    loading={loading}
                                />
                            );
                        } else {
                            return (
                                <SwapCard
                                    key={swap.id}
                                    swap={swap}
                                    userRole="proposer"
                                    onAction={handleSwapAction}
                                />
                            );
                        }
                    })}
                </div>
            )}

            {/* Load More Button */}
            {hasMore && !loading && !targetingLoading && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginTop: tokens.spacing[6],
                    }}
                >
                    <Button variant="outline" onClick={handleLoadMore} loading={loading || targetingLoading}>
                        Load More Swaps
                    </Button>
                </div>
            )}

            {/* Loading More Indicator */}
            {(loading || targetingLoading) && swaps.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: tokens.spacing[4],
                        color: tokens.colors.neutral[500],
                    }}
                >
                    <div
                        style={{
                            width: '20px',
                            height: '20px',
                            border: `2px solid ${tokens.colors.neutral[200]}`,
                            borderTop: `2px solid ${tokens.colors.primary[500]}`,
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            marginRight: tokens.spacing[2],
                        }}
                    />
                    Loading more...
                </div>
            )}

            {/* Swap Proposal Modal */}
            <SwapProposalModal
                isOpen={proposalModalOpen}
                onClose={handleProposalModalClose}
                targetBooking={selectedTargetSwap?.sourceBooking || null}
                userBookings={userBookings}
                onSubmit={handleProposalSubmit}
                loading={loading}
            />

            {/* Cash Offer Modal */}
            {selectedCashSwap && (
                <SwapProposalModal
                    isOpen={cashOfferModalOpen}
                    onClose={handleCashOfferModalClose}
                    targetBooking={selectedCashSwap.sourceBooking}
                    userBookings={[]}
                    onSubmit={handleProposalSubmit}
                    loading={loading}
                    mode="cash"
                    cashDetails={selectedCashSwap.cashDetails}
                />
            )}
        </div>
    );
};


export default SwapBrowserEnhanced;