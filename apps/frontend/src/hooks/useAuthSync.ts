import { useEffect, useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout as reduxLogout, initializeFromAuthContext, setSyncError, clearSyncError } from '@/store/slices/authSlice';
import { selectCurrentUser, selectIsAuthenticated } from '@/store/selectors/authSelectors';
import { useAuthSyncLock } from '@/utils/authSyncLock';
import {
    validateSyncOperation,
    convertAuthContextUserToRedux,
    areUsersEqual
} from '@/utils/authSyncValidation';
import { authSyncErrorRecovery } from '@/utils/authSyncErrorRecovery';

interface SyncStatus {
    isInSync: boolean;
    lastSyncTime: Date | null;
    syncAttempts: number;
    syncErrors: string[];
    hasSyncError: boolean;
    syncErrorMessage: string | null;
}

interface AuthSyncHook {
    syncUserToRedux: (user: any | null, token: string | null) => void;
    ensureSync: () => void;
    syncStatus: SyncStatus;
}

export const useAuthSync = (): AuthSyncHook => {
    const dispatch = useAppDispatch();
    const { user: authContextUser, token: authContextToken, isAuthenticated: authContextIsAuthenticated } = useAuth();
    const reduxUser = useAppSelector(selectCurrentUser);
    const reduxIsAuthenticated = useAppSelector(selectIsAuthenticated);
    const { withSyncLock } = useAuthSyncLock();

    const [syncStatus, setSyncStatus] = useState<SyncStatus>({
        isInSync: false,
        lastSyncTime: null,
        syncAttempts: 0,
        syncErrors: [],
        hasSyncError: false,
        syncErrorMessage: null,
    });

    // Helper function to check if user data is in sync
    const checkSyncStatus = useCallback(() => {
        const isInSync = areUsersEqual(authContextUser, reduxUser);

        setSyncStatus(prev => ({
            ...prev,
            isInSync,
        }));

        return isInSync;
    }, [authContextUser, reduxUser]);

    // Function to sync user data to Redux store
    const syncUserToRedux = useCallback(async (user: any | null, token: string | null) => {
        const syncOperation = async () => {
            // Validate sync operation parameters
            const validation = validateSyncOperation(user, token, reduxUser);

            if (!validation.isValid) {
                const errorMessage = `Sync validation failed: ${validation.errors.join(', ')}`;
                console.error('❌ Auth sync validation failed:', validation.errors);

                setSyncStatus(prev => ({
                    ...prev,
                    syncErrors: [...prev.syncErrors.slice(-4), errorMessage],
                    hasSyncError: true,
                    syncErrorMessage: errorMessage,
                }));

                dispatch(setSyncError(errorMessage));
                return;
            }

            // Log warnings if any
            if (validation.warnings.length > 0) {
                console.warn('⚠️ Auth sync warnings:', validation.warnings);
            }

            setSyncStatus(prev => ({
                ...prev,
                syncAttempts: prev.syncAttempts + 1,
                hasSyncError: false,
                syncErrorMessage: null,
            }));

            dispatch(clearSyncError());

            if (user && token) {
                // Convert and validate user data
                const { user: convertedUser, validation: conversionValidation } = convertAuthContextUserToRedux(user);

                if (!convertedUser || !conversionValidation.isValid) {
                    const errorMessage = `User conversion failed: ${conversionValidation.errors.join(', ')}`;
                    throw new Error(errorMessage);
                }

                dispatch(initializeFromAuthContext({
                    user: convertedUser,
                    isAuthenticated: true,
                    syncSource: 'authContext',
                }));

                console.log('✅ Auth sync: User data synced to Redux store', { userId: user.id });
            } else {
                dispatch(reduxLogout());
                console.log('✅ Auth sync: Cleared Redux store (user logged out)');
            }

            setSyncStatus(prev => ({
                ...prev,
                lastSyncTime: new Date(),
                isInSync: true,
            }));
        };

        try {
            await withSyncLock(syncOperation);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
            console.error('❌ Auth sync failed:', error);

            // Attempt error recovery
            try {
                const recoveryResult = await authSyncErrorRecovery.attemptRecovery(
                    error as Error,
                    'syncUserToRedux',
                    async () => {
                        await syncOperation();
                    }
                );

                if (!recoveryResult.success) {
                    setSyncStatus(prev => ({
                        ...prev,
                        syncErrors: [...prev.syncErrors.slice(-4), errorMessage],
                        hasSyncError: true,
                        syncErrorMessage: errorMessage,
                    }));

                    dispatch(setSyncError(errorMessage));
                }
            } catch (recoveryError) {
                console.error('❌ Auth sync recovery failed:', recoveryError);
                setSyncStatus(prev => ({
                    ...prev,
                    syncErrors: [...prev.syncErrors.slice(-4), errorMessage],
                    hasSyncError: true,
                    syncErrorMessage: errorMessage,
                }));

                dispatch(setSyncError(errorMessage));
            }
        }
    }, [dispatch, reduxUser, withSyncLock]);

    // Function to ensure synchronization
    const ensureSync = useCallback(() => {
        const isCurrentlyInSync = checkSyncStatus();

        if (!isCurrentlyInSync) {
            console.log('🔄 Auth sync: Detected mismatch, triggering sync', {
                authContextUser: authContextUser?.id || 'none',
                reduxUser: reduxUser?.id || 'none',
                authContextAuthenticated: authContextIsAuthenticated,
                reduxAuthenticated: reduxIsAuthenticated,
            });

            syncUserToRedux(authContextUser, authContextToken);
        }
    }, [checkSyncStatus, syncUserToRedux, authContextUser, authContextToken, reduxUser, reduxIsAuthenticated, authContextIsAuthenticated]);

    // Auto-sync when AuthContext changes
    useEffect(() => {
        // Only sync if there's a meaningful change
        const shouldSync = !checkSyncStatus();

        if (shouldSync) {
            console.log('🔄 Auth sync: AuthContext changed, syncing to Redux', {
                authContextUser: authContextUser?.id || 'none',
                authContextAuthenticated: authContextIsAuthenticated,
            });

            syncUserToRedux(authContextUser, authContextToken);
        }
    }, [authContextUser, authContextToken, authContextIsAuthenticated, syncUserToRedux, checkSyncStatus]);

    // Initial sync status check
    useEffect(() => {
        checkSyncStatus();
    }, [checkSyncStatus]);

    return {
        syncUserToRedux,
        ensureSync,
        syncStatus,
    };
};