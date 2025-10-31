import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TargetingEvent {
    id: string;
    type: string;
    timestamp: Date;
    data: any;
}

interface IncomingTargetInfo {
    targetId: string;
    sourceSwapId: string;
    sourceSwap: {
        id: string;
        title: string;
        ownerName: string;
    };
    status: 'active' | 'accepted' | 'rejected' | 'cancelled';
    createdAt: Date;
    updatedAt?: Date;
}

interface OutgoingTargetInfo {
    targetId: string;
    targetSwapId: string;
    targetSwap: {
        id: string;
        title: string;
        ownerName: string;
    };
    status: 'active' | 'accepted' | 'rejected' | 'cancelled';
    createdAt: Date;
    updatedAt?: Date;
}

interface AuctionInfo {
    endDate: Date;
    currentProposalCount: number;
    timeRemaining: string;
    isEnding: boolean;
}

interface SwapTargetingState {
    incomingTargets: IncomingTargetInfo[];
    outgoingTarget?: OutgoingTargetInfo;
    auctionInfo?: AuctionInfo;
    events: TargetingEvent[];
    lastUpdated?: Date;
}

interface TargetingState {
    // Map of swapId to targeting state
    swapTargeting: Record<string, SwapTargetingState>;

    // Global targeting status tracking
    targetingStatus: Record<string, {
        status: string;
        lastUpdated: Date;
    }>;

    // Connection status
    isConnected: boolean;
    connectionError?: string;

    // UI state
    showTargetingNotifications: boolean;
    unreadTargetingCount: number;

    // Targeting operations state
    isTargeting: boolean;
    targetingError?: string;
    currentTarget?: any;
    targetingHistory: any[];
    swapsTargetingMe: any[];

    // Cache state
    cachedValidations: Record<string, any>;
    cachedCanTarget: Record<string, boolean>;
    cachedAuctionEligibility: Record<string, any>;
    cachedOneForOneEligibility: Record<string, any>;
    targetingStats?: any;
}

const initialState: TargetingState = {
    swapTargeting: {},
    targetingStatus: {},
    isConnected: false,
    showTargetingNotifications: true,
    unreadTargetingCount: 0,
    isTargeting: false,
    targetingHistory: [],
    swapsTargetingMe: [],
    cachedValidations: {},
    cachedCanTarget: {},
    cachedAuctionEligibility: {},
    cachedOneForOneEligibility: {},
};

const targetingSlice = createSlice({
    name: 'targeting',
    initialState,
    reducers: {
        // Connection management
        setConnectionStatus: (state, action: PayloadAction<{ isConnected: boolean; error?: string }>) => {
            state.isConnected = action.payload.isConnected;
            state.connectionError = action.payload.error;
        },

        // Swap targeting state management
        initializeSwapTargeting: (state, action: PayloadAction<{ swapId: string; targetingState: SwapTargetingState }>) => {
            const { swapId, targetingState } = action.payload;
            state.swapTargeting[swapId] = {
                ...targetingState,
                lastUpdated: new Date(),
            };
        },

        // Incoming targets management
        addIncomingTarget: (state, action: PayloadAction<{ swapId: string; targetInfo: IncomingTargetInfo }>) => {
            const { swapId, targetInfo } = action.payload;

            if (!state.swapTargeting[swapId]) {
                state.swapTargeting[swapId] = {
                    incomingTargets: [],
                    events: [],
                };
            }

            // Check if target already exists
            const existingIndex = state.swapTargeting[swapId].incomingTargets.findIndex(
                target => target.targetId === targetInfo.targetId
            );

            if (existingIndex >= 0) {
                // Update existing target
                state.swapTargeting[swapId].incomingTargets[existingIndex] = {
                    ...targetInfo,
                    updatedAt: new Date(),
                };
            } else {
                // Add new target
                state.swapTargeting[swapId].incomingTargets.push(targetInfo);
                state.unreadTargetingCount += 1;
            }

            state.swapTargeting[swapId].lastUpdated = new Date();
        },

        removeIncomingTarget: (state, action: PayloadAction<{ swapId: string; targetId: string }>) => {
            const { swapId, targetId } = action.payload;

            if (state.swapTargeting[swapId]) {
                state.swapTargeting[swapId].incomingTargets = state.swapTargeting[swapId].incomingTargets.filter(
                    target => target.targetId !== targetId
                );
                state.swapTargeting[swapId].lastUpdated = new Date();
            }
        },

        updateIncomingTarget: (state, action: PayloadAction<{
            swapId: string;
            targetId: string;
            updates: Partial<IncomingTargetInfo>
        }>) => {
            const { swapId, targetId, updates } = action.payload;

            if (state.swapTargeting[swapId]) {
                const targetIndex = state.swapTargeting[swapId].incomingTargets.findIndex(
                    target => target.targetId === targetId
                );

                if (targetIndex >= 0) {
                    state.swapTargeting[swapId].incomingTargets[targetIndex] = {
                        ...state.swapTargeting[swapId].incomingTargets[targetIndex],
                        ...updates,
                        updatedAt: new Date(),
                    };
                    state.swapTargeting[swapId].lastUpdated = new Date();
                }
            }
        },

        // Outgoing target management
        updateOutgoingTarget: (state, action: PayloadAction<{
            swapId: string;
            targetUpdate: Partial<OutgoingTargetInfo> & { targetId: string }
        }>) => {
            const { swapId, targetUpdate } = action.payload;

            if (!state.swapTargeting[swapId]) {
                state.swapTargeting[swapId] = {
                    incomingTargets: [],
                    events: [],
                };
            }

            if (state.swapTargeting[swapId].outgoingTarget?.targetId === targetUpdate.targetId) {
                state.swapTargeting[swapId].outgoingTarget = {
                    ...state.swapTargeting[swapId].outgoingTarget!,
                    ...targetUpdate,
                    updatedAt: new Date(),
                };
            }

            state.swapTargeting[swapId].lastUpdated = new Date();
        },

        setOutgoingTarget: (state, action: PayloadAction<{ swapId: string; targetInfo: OutgoingTargetInfo }>) => {
            const { swapId, targetInfo } = action.payload;

            if (!state.swapTargeting[swapId]) {
                state.swapTargeting[swapId] = {
                    incomingTargets: [],
                    events: [],
                };
            }

            state.swapTargeting[swapId].outgoingTarget = targetInfo;
            state.swapTargeting[swapId].lastUpdated = new Date();
        },

        removeOutgoingTarget: (state, action: PayloadAction<{ swapId: string; targetId: string }>) => {
            const { swapId, targetId } = action.payload;

            if (state.swapTargeting[swapId] &&
                state.swapTargeting[swapId].outgoingTarget?.targetId === targetId) {
                delete state.swapTargeting[swapId].outgoingTarget;
                state.swapTargeting[swapId].lastUpdated = new Date();
            }
        },

        // Auction info management
        updateAuctionCountdown: (state, action: PayloadAction<{ swapId: string; auctionInfo: AuctionInfo }>) => {
            const { swapId, auctionInfo } = action.payload;

            if (!state.swapTargeting[swapId]) {
                state.swapTargeting[swapId] = {
                    incomingTargets: [],
                    events: [],
                };
            }

            state.swapTargeting[swapId].auctionInfo = auctionInfo;
            state.swapTargeting[swapId].lastUpdated = new Date();
        },

        // Events management
        addTargetingEvent: (state, action: PayloadAction<{ swapId: string; event: TargetingEvent }>) => {
            const { swapId, event } = action.payload;

            if (!state.swapTargeting[swapId]) {
                state.swapTargeting[swapId] = {
                    incomingTargets: [],
                    events: [],
                };
            }

            // Add event to the beginning of the array (most recent first)
            state.swapTargeting[swapId].events.unshift(event);

            // Keep only the last 50 events per swap
            if (state.swapTargeting[swapId].events.length > 50) {
                state.swapTargeting[swapId].events = state.swapTargeting[swapId].events.slice(0, 50);
            }

            state.swapTargeting[swapId].lastUpdated = new Date();
        },

        // Global targeting status
        updateTargetingStatus: (state, action: PayloadAction<{
            targetId: string;
            status: string;
            lastUpdated: Date
        }>) => {
            const { targetId, status, lastUpdated } = action.payload;
            state.targetingStatus[targetId] = { status, lastUpdated };
        },

        // UI state management
        setShowTargetingNotifications: (state, action: PayloadAction<boolean>) => {
            state.showTargetingNotifications = action.payload;
        },

        markTargetingAsRead: (state, action: PayloadAction<{ swapId: string; targetId?: string }>) => {
            const { swapId, targetId } = action.payload;

            if (targetId) {
                // Mark specific targeting as read
                if (state.swapTargeting[swapId]) {
                    const incomingTarget = state.swapTargeting[swapId].incomingTargets.find(
                        target => target.targetId === targetId
                    );
                    if (incomingTarget) {
                        state.unreadTargetingCount = Math.max(0, state.unreadTargetingCount - 1);
                    }
                }
            } else {
                // Mark all targeting for swap as read
                if (state.swapTargeting[swapId]) {
                    const unreadCount = state.swapTargeting[swapId].incomingTargets.length;
                    state.unreadTargetingCount = Math.max(0, state.unreadTargetingCount - unreadCount);
                }
            }
        },

        resetUnreadTargetingCount: (state) => {
            state.unreadTargetingCount = 0;
        },

        // Bulk operations
        updateSwapTargeting: (state, action: PayloadAction<{
            swapId: string;
            updates: Partial<SwapTargetingState>
        }>) => {
            const { swapId, updates } = action.payload;

            if (!state.swapTargeting[swapId]) {
                state.swapTargeting[swapId] = {
                    incomingTargets: [],
                    events: [],
                };
            }

            state.swapTargeting[swapId] = {
                ...state.swapTargeting[swapId],
                ...updates,
                lastUpdated: new Date(),
            };
        },

        clearSwapTargeting: (state, action: PayloadAction<string>) => {
            const swapId = action.payload;
            delete state.swapTargeting[swapId];
        },

        clearAllTargeting: (state) => {
            state.swapTargeting = {};
            state.targetingStatus = {};
            state.unreadTargetingCount = 0;
        },

        // Targeting operations
        startTargeting: (state) => {
            state.isTargeting = true;
            state.targetingError = undefined;
        },

        targetingSuccess: (state, action: PayloadAction<any>) => {
            state.isTargeting = false;
            state.currentTarget = action.payload;
        },

        targetingError: (state, action: PayloadAction<string>) => {
            state.isTargeting = false;
            state.targetingError = action.payload;
        },

        startRetargeting: (state) => {
            state.isTargeting = true;
            state.targetingError = undefined;
        },

        retargetingSuccess: (state, action: PayloadAction<any>) => {
            state.isTargeting = false;
            state.currentTarget = action.payload;
        },

        retargetingError: (state, action: PayloadAction<string>) => {
            state.isTargeting = false;
            state.targetingError = action.payload;
        },

        startRemovingTarget: (state) => {
            state.isTargeting = true;
            state.targetingError = undefined;
        },

        removeTargetSuccess: (state) => {
            state.isTargeting = false;
            state.currentTarget = undefined;
        },

        removeTargetError: (state, action: PayloadAction<string>) => {
            state.isTargeting = false;
            state.targetingError = action.payload;
        },

        setCurrentTarget: (state, action: PayloadAction<any>) => {
            state.currentTarget = action.payload;
        },

        setTargetingHistory: (state, action: PayloadAction<any[]>) => {
            state.targetingHistory = action.payload;
        },

        setSwapsTargetingMe: (state, action: PayloadAction<any[]>) => {
            state.swapsTargetingMe = action.payload;
        },

        // Cache management
        setCachedValidation: (state, action: PayloadAction<{ key: string; validation: any }>) => {
            const { key, validation } = action.payload;
            state.cachedValidations[key] = validation;
        },

        setCachedCanTarget: (state, action: PayloadAction<{ key: string; canTarget: boolean }>) => {
            const { key, canTarget } = action.payload;
            state.cachedCanTarget[key] = canTarget;
        },

        setCachedAuctionEligibility: (state, action: PayloadAction<{ key: string; eligibility: any }>) => {
            const { key, eligibility } = action.payload;
            state.cachedAuctionEligibility[key] = eligibility;
        },

        setCachedOneForOneEligibility: (state, action: PayloadAction<{ key: string; eligibility: any }>) => {
            const { key, eligibility } = action.payload;
            state.cachedOneForOneEligibility[key] = eligibility;
        },

        setTargetingStats: (state, action: PayloadAction<any>) => {
            state.targetingStats = action.payload;
        },

        invalidateTargetingCache: (state) => {
            state.cachedValidations = {};
            state.cachedCanTarget = {};
            state.cachedAuctionEligibility = {};
            state.cachedOneForOneEligibility = {};
        },

        updateLastUpdateTime: (state, action: PayloadAction<{ swapId: string }>) => {
            const { swapId } = action.payload;
            if (state.swapTargeting[swapId]) {
                state.swapTargeting[swapId].lastUpdated = new Date();
            }
        },
    },
});

export const {
    setConnectionStatus,
    initializeSwapTargeting,
    addIncomingTarget,
    removeIncomingTarget,
    updateIncomingTarget,
    updateOutgoingTarget,
    setOutgoingTarget,
    removeOutgoingTarget,
    updateAuctionCountdown,
    addTargetingEvent,
    updateTargetingStatus,
    setShowTargetingNotifications,
    markTargetingAsRead,
    resetUnreadTargetingCount,
    updateSwapTargeting,
    clearSwapTargeting,
    clearAllTargeting,
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
    updateLastUpdateTime,
} = targetingSlice.actions;

export default targetingSlice.reducer;

// Selectors
export const selectSwapTargeting = (state: { targeting: TargetingState }, swapId: string) =>
    state.targeting.swapTargeting[swapId];

export const selectIncomingTargets = (state: { targeting: TargetingState }, swapId: string) =>
    state.targeting.swapTargeting[swapId]?.incomingTargets || [];

export const selectOutgoingTarget = (state: { targeting: TargetingState }, swapId: string) =>
    state.targeting.swapTargeting[swapId]?.outgoingTarget;

export const selectTargetingEvents = (state: { targeting: TargetingState }, swapId: string) =>
    state.targeting.swapTargeting[swapId]?.events || [];

export const selectAuctionInfo = (state: { targeting: TargetingState }, swapId: string) =>
    state.targeting.swapTargeting[swapId]?.auctionInfo;

export const selectUnreadTargetingCount = (state: { targeting: TargetingState }) =>
    state.targeting.unreadTargetingCount;

export const selectTargetingConnectionStatus = (state: { targeting: TargetingState }) => ({
    isConnected: state.targeting.isConnected,
    error: state.targeting.connectionError,
});

export const selectIsTargeting = (state: { targeting: TargetingState }) =>
    state.targeting.isTargeting;

export const selectTargetingError = (state: { targeting: TargetingState }) =>
    state.targeting.targetingError;

export const selectCurrentTarget = (state: { targeting: TargetingState }) =>
    state.targeting.currentTarget;

export const selectTargetingHistory = (state: { targeting: TargetingState }) =>
    state.targeting.targetingHistory;

export const selectSwapsTargetingMe = (state: { targeting: TargetingState }) =>
    state.targeting.swapsTargetingMe;

export const selectTargetingStats = (state: { targeting: TargetingState }) =>
    state.targeting.targetingStats;

export const selectCachedValidation = (state: { targeting: TargetingState }, key: string) =>
    state.targeting.cachedValidations[key];

export const selectCachedCanTarget = (state: { targeting: TargetingState }, key: string) =>
    state.targeting.cachedCanTarget[key];

export const selectCachedAuctionEligibility = (state: { targeting: TargetingState }, key: string) =>
    state.targeting.cachedAuctionEligibility[key];

export const selectCachedOneForOneEligibility = (state: { targeting: TargetingState }, key: string) =>
    state.targeting.cachedOneForOneEligibility[key];