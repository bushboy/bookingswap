import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';

// Base auth state selector
export const selectAuthState = (state: RootState) => state.auth;

// User selectors
export const selectCurrentUser = createSelector(
    [selectAuthState],
    (auth) => auth.user
);

export const selectCurrentUserId = createSelector(
    [selectCurrentUser],
    (user) => user?.id || null
);

export const selectIsAuthenticated = createSelector(
    [selectAuthState],
    (auth) => auth.isAuthenticated
);

export const selectWalletConnected = createSelector(
    [selectAuthState],
    (auth) => auth.walletConnected
);

export const selectAuthLoading = createSelector(
    [selectAuthState],
    (auth) => auth.loading
);

export const selectAuthError = createSelector(
    [selectAuthState],
    (auth) => auth.error
);

// Permission validation selectors
export const selectUserPermissions = createSelector(
    [selectCurrentUser],
    (user) => {
        if (!user) {
            return {
                canAcceptProposals: false,
                canRejectProposals: false,
                canCreateProposals: false,
                verificationLevel: null
            };
        }

        return {
            canAcceptProposals: true,
            canRejectProposals: true,
            canCreateProposals: user.verificationLevel !== 'basic',
            verificationLevel: user.verificationLevel
        };
    }
);

// Proposal-specific permission checker
export const createProposalPermissionSelector = () => createSelector(
    [selectCurrentUserId, (_: RootState, proposalOwnerId: string) => proposalOwnerId],
    (currentUserId, proposalOwnerId) => {
        if (!currentUserId || !proposalOwnerId) {
            return {
                canView: false,
                canAccept: false,
                canReject: false,
                isOwner: false,
                reason: 'User not authenticated or proposal owner not specified'
            };
        }

        const isOwner = currentUserId === proposalOwnerId;

        return {
            canView: true,
            canAccept: isOwner,
            canReject: isOwner,
            isOwner,
            reason: isOwner ? null : 'User is not the proposal owner'
        };
    }
);

export const selectProposalPermissions = createProposalPermissionSelector();

// Sync status selectors for serializable state
export const selectSyncStatus = createSelector(
    [selectAuthState],
    (auth) => auth.syncStatus
);

export const selectLastSyncTime = createSelector(
    [selectSyncStatus],
    (syncStatus) => syncStatus.lastSyncTime
);

export const selectLastSyncTimeAsDate = createSelector(
    [selectLastSyncTime],
    (lastSyncTime) => lastSyncTime ? new Date(lastSyncTime) : null
);

export const selectSyncSource = createSelector(
    [selectSyncStatus],
    (syncStatus) => syncStatus.syncSource
);

export const selectHasSyncError = createSelector(
    [selectSyncStatus],
    (syncStatus) => syncStatus.hasSyncError
);

export const selectSyncErrorMessage = createSelector(
    [selectSyncStatus],
    (syncStatus) => syncStatus.syncErrorMessage
);