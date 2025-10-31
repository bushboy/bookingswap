import { createAsyncThunk } from '@reduxjs/toolkit';
import {
    SwapTarget,
    TargetingHistory,
    TargetingResult,
    TargetingValidation,
    AuctionEligibilityResult,
    OneForOneValidationResult,
} from '@booking-swap/shared';
import { swapTargetingService } from '../../services/swapTargetingService';
import {
    startTargeting,
    targetingSuccess,
    targetingError,
    startRetargeting,
    retargetingSuccess,
    retargetingError,
    startRemovingTarget,
    removeTargetSuccess,
    removeTargetError,
    setCurrentTarget,
    setTargetingHistory,
    setSwapsTargetingMe,
    setCachedValidation,
    setCachedCanTarget,
    setCachedAuctionEligibility,
    setCachedOneForOneEligibility,
    setTargetingStats,
    invalidateTargetingCache,
} from '../slices/targetingSlice';
import { RootState } from '../index';

// Targeting operations
export const targetSwap = createAsyncThunk<
    TargetingResult,
    {
        sourceSwapId: string;
        targetSwapId: string;
        message?: string;
        conditions?: string[];
    },
    { state: RootState }
>(
    'targeting/targetSwap',
    async ({ sourceSwapId, targetSwapId, message, conditions }, { dispatch, rejectWithValue }) => {
        try {
            dispatch(startTargeting(sourceSwapId));

            const result = await swapTargetingService.targetSwap(
                sourceSwapId,
                targetSwapId,
                message,
                conditions
            );

            dispatch(targetingSuccess(result));

            // Invalidate related cache
            dispatch(invalidateTargetingCache(sourceSwapId));
            dispatch(invalidateTargetingCache(targetSwapId));

            return result;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to target swap';
            dispatch(targetingError(errorMessage));
            return rejectWithValue(errorMessage);
        }
    }
);

export const retargetSwap = createAsyncThunk<
    TargetingResult,
    {
        sourceSwapId: string;
        newTargetSwapId: string;
        message?: string;
        conditions?: string[];
    },
    { state: RootState }
>(
    'targeting/retargetSwap',
    async ({ sourceSwapId, newTargetSwapId, message, conditions }, { dispatch, rejectWithValue }) => {
        try {
            dispatch(startRetargeting(sourceSwapId));

            const result = await swapTargetingService.retargetSwap(
                sourceSwapId,
                newTargetSwapId,
                message,
                conditions
            );

            dispatch(retargetingSuccess(result));

            // Invalidate related cache
            dispatch(invalidateTargetingCache(sourceSwapId));
            dispatch(invalidateTargetingCache(newTargetSwapId));

            return result;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to retarget swap';
            dispatch(retargetingError(errorMessage));
            return rejectWithValue(errorMessage);
        }
    }
);

export const removeTarget = createAsyncThunk<
    void,
    { sourceSwapId: string },
    { state: RootState }
>(
    'targeting/removeTarget',
    async ({ sourceSwapId }, { dispatch, rejectWithValue }) => {
        try {
            dispatch(startRemovingTarget(sourceSwapId));

            await swapTargetingService.removeTarget(sourceSwapId);

            dispatch(removeTargetSuccess(sourceSwapId));

            // Invalidate related cache
            dispatch(invalidateTargetingCache(sourceSwapId));
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to remove target';
            dispatch(removeTargetError(errorMessage));
            return rejectWithValue(errorMessage);
        }
    }
);

// Data fetching operations
export const fetchCurrentTarget = createAsyncThunk<
    SwapTarget | null,
    { swapId: string },
    { state: RootState }
>(
    'targeting/fetchCurrentTarget',
    async ({ swapId }, { dispatch, rejectWithValue }) => {
        try {
            const target = await swapTargetingService.getSwapTarget(swapId);
            dispatch(setCurrentTarget(target));
            return target;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch current target';
            return rejectWithValue(errorMessage);
        }
    }
);

export const fetchTargetingHistory = createAsyncThunk<
    TargetingHistory[],
    { swapId: string },
    { state: RootState }
>(
    'targeting/fetchTargetingHistory',
    async ({ swapId }, { dispatch, rejectWithValue }) => {
        try {
            const history = await swapTargetingService.getTargetingHistory(swapId);
            dispatch(setTargetingHistory(history));
            return history;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch targeting history';
            return rejectWithValue(errorMessage);
        }
    }
);

export const fetchSwapsTargetingMe = createAsyncThunk<
    SwapTarget[],
    { userId?: string },
    { state: RootState }
>(
    'targeting/fetchSwapsTargetingMe',
    async ({ userId }, { dispatch, rejectWithValue }) => {
        try {
            const targets = await swapTargetingService.getSwapsTargetingMe(userId);
            dispatch(setSwapsTargetingMe(targets));
            return targets;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch swaps targeting me';
            return rejectWithValue(errorMessage);
        }
    }
);

export const fetchSwapsTargetedBy = createAsyncThunk<
    SwapTarget[],
    { swapId: string },
    { state: RootState }
>(
    'targeting/fetchSwapsTargetedBy',
    async ({ swapId }, { rejectWithValue }) => {
        try {
            const targets = await swapTargetingService.getSwapsTargetedBy(swapId);
            return targets;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch swaps targeted by this swap';
            return rejectWithValue(errorMessage);
        }
    }
);

// Validation operations
export const validateTargeting = createAsyncThunk<
    TargetingValidation,
    { sourceSwapId: string; targetSwapId: string },
    { state: RootState }
>(
    'targeting/validateTargeting',
    async ({ sourceSwapId, targetSwapId }, { dispatch, getState, rejectWithValue }) => {
        try {
            // Check cache first
            const state = getState();
            const cacheKey = `${sourceSwapId}-${targetSwapId}`;
            const cached = state.targeting.validationCache[cacheKey];

            if (cached) {
                return cached;
            }

            const validation = await swapTargetingService.validateTargeting(sourceSwapId, targetSwapId);

            dispatch(setCachedValidation({ key: cacheKey, validation }));

            return validation;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to validate targeting';
            return rejectWithValue(errorMessage);
        }
    }
);

export const checkCanTarget = createAsyncThunk<
    boolean,
    { targetSwapId: string },
    { state: RootState }
>(
    'targeting/checkCanTarget',
    async ({ targetSwapId }, { dispatch, getState, rejectWithValue }) => {
        try {
            // Check cache first
            const state = getState();
            const cached = state.targeting.eligibilityCache.canTarget[targetSwapId];

            if (cached !== undefined) {
                return cached;
            }

            const canTarget = await swapTargetingService.canTargetSwap(targetSwapId);

            dispatch(setCachedCanTarget({ targetSwapId, canTarget }));

            return canTarget;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to check targeting eligibility';
            return rejectWithValue(errorMessage);
        }
    }
);

export const checkAuctionEligibility = createAsyncThunk<
    AuctionEligibilityResult,
    { targetSwapId: string },
    { state: RootState }
>(
    'targeting/checkAuctionEligibility',
    async ({ targetSwapId }, { dispatch, getState, rejectWithValue }) => {
        try {
            // Check cache first
            const state = getState();
            const cached = state.targeting.eligibilityCache.auctionEligibility[targetSwapId];

            if (cached) {
                return cached;
            }

            const eligibility = await swapTargetingService.checkAuctionEligibility(targetSwapId);

            dispatch(setCachedAuctionEligibility({ targetSwapId, eligibility }));

            return eligibility;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to check auction eligibility';
            return rejectWithValue(errorMessage);
        }
    }
);

export const checkOneForOneEligibility = createAsyncThunk<
    OneForOneValidationResult,
    { targetSwapId: string },
    { state: RootState }
>(
    'targeting/checkOneForOneEligibility',
    async ({ targetSwapId }, { dispatch, getState, rejectWithValue }) => {
        try {
            // Check cache first
            const state = getState();
            const cached = state.targeting.eligibilityCache.oneForOneEligibility[targetSwapId];

            if (cached) {
                return cached;
            }

            const eligibility = await swapTargetingService.checkOneForOneEligibility(targetSwapId);

            dispatch(setCachedOneForOneEligibility({ targetSwapId, eligibility }));

            return eligibility;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to check one-for-one eligibility';
            return rejectWithValue(errorMessage);
        }
    }
);

// Statistics operations
export const fetchTargetingStats = createAsyncThunk<
    {
        totalTargets: number;
        activeTargets: number;
        successfulTargets: number;
        successRate: number;
    },
    { userId?: string },
    { state: RootState }
>(
    'targeting/fetchTargetingStats',
    async ({ userId }, { dispatch, getState, rejectWithValue }) => {
        try {
            // Calculate stats from current state data
            const state = getState();
            const history = state.targeting.targetingHistory;
            const swapsTargetingMe = state.targeting.swapsTargetingMe;

            const totalTargets = history.length;
            const activeTargets = swapsTargetingMe.filter(t => t.status === 'active').length;
            const successfulTargets = history.filter(h => h.action === 'accepted').length;
            const successRate = totalTargets > 0 ? (successfulTargets / totalTargets) * 100 : 0;

            const stats = {
                totalTargets,
                activeTargets,
                successfulTargets,
                successRate,
            };

            dispatch(setTargetingStats(stats));

            return stats;
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch targeting statistics';
            return rejectWithValue(errorMessage);
        }
    }
);

// Batch operations
export const refreshTargetingData = createAsyncThunk<
    void,
    { swapId: string; userId?: string },
    { state: RootState }
>(
    'targeting/refreshTargetingData',
    async ({ swapId, userId }, { dispatch }) => {
        try {
            // Fetch all targeting-related data
            await Promise.all([
                dispatch(fetchCurrentTarget({ swapId })),
                dispatch(fetchTargetingHistory({ swapId })),
                dispatch(fetchSwapsTargetingMe({ userId })),
                dispatch(fetchTargetingStats({ userId })),
            ]);
        } catch (error) {
            // Individual thunks will handle their own errors
            console.error('Error refreshing targeting data:', error);
        }
    }
);

// Cache management operations
export const preloadTargetingValidation = createAsyncThunk<
    void,
    { sourceSwapId: string; targetSwapIds: string[] },
    { state: RootState }
>(
    'targeting/preloadTargetingValidation',
    async ({ sourceSwapId, targetSwapIds }, { dispatch }) => {
        try {
            // Preload validation for multiple target swaps
            const validationPromises = targetSwapIds.map(targetSwapId =>
                dispatch(validateTargeting({ sourceSwapId, targetSwapId }))
            );

            await Promise.all(validationPromises);
        } catch (error) {
            console.error('Error preloading targeting validation:', error);
        }
    }
);

export const preloadEligibilityChecks = createAsyncThunk<
    void,
    { targetSwapIds: string[] },
    { state: RootState }
>(
    'targeting/preloadEligibilityChecks',
    async ({ targetSwapIds }, { dispatch }) => {
        try {
            // Preload eligibility checks for multiple swaps
            const eligibilityPromises = targetSwapIds.flatMap(targetSwapId => [
                dispatch(checkCanTarget({ targetSwapId })),
                dispatch(checkAuctionEligibility({ targetSwapId })),
                dispatch(checkOneForOneEligibility({ targetSwapId })),
            ]);

            await Promise.all(eligibilityPromises);
        } catch (error) {
            console.error('Error preloading eligibility checks:', error);
        }
    }
);

// Real-time update handlers
export const handleTargetingUpdate = createAsyncThunk<
    void,
    {
        type: 'target_created' | 'target_updated' | 'target_removed';
        data: SwapTarget | { targetId: string };
    },
    { state: RootState }
>(
    'targeting/handleTargetingUpdate',
    async ({ type, data }, { dispatch, getState }) => {
        try {
            const state = getState();

            switch (type) {
                case 'target_created':
                case 'target_updated':
                    if ('id' in data) {
                        const target = data as SwapTarget;

                        // Update current target if it matches
                        if (state.targeting.currentTarget?.id === target.id) {
                            dispatch(setCurrentTarget(target));
                        }

                        // Invalidate related cache
                        dispatch(invalidateTargetingCache(target.sourceSwapId));
                        dispatch(invalidateTargetingCache(target.targetSwapId));
                    }
                    break;

                case 'target_removed':
                    if ('targetId' in data) {
                        const { targetId } = data as { targetId: string };

                        // Clear current target if it matches
                        if (state.targeting.currentTarget?.id === targetId) {
                            dispatch(setCurrentTarget(null));
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('Error handling targeting update:', error);
        }
    }
);