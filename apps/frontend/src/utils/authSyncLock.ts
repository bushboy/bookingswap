/**
 * Auth Sync Lock utility to prevent race conditions during synchronization
 */

interface SyncLockManager {
    withSyncLock: <T>(operation: () => Promise<T>) => Promise<T | null>;
    isLocked: () => boolean;
    forceRelease: () => void;
}

class AuthSyncLock {
    private syncInProgress = false;
    private lockTimeout: NodeJS.Timeout | null = null;
    private readonly LOCK_TIMEOUT_MS = 5000; // 5 seconds max lock time

    /**
     * Executes an operation with sync lock protection
     */
    async withSyncLock<T>(operation: () => Promise<T>): Promise<T | null> {
        if (this.syncInProgress) {
            console.log('🔒 Auth sync: Operation skipped - sync already in progress');
            return null;
        }

        this.acquireLock();

        try {
            const result = await operation();
            return result;
        } catch (error) {
            console.error('🔒 Auth sync: Operation failed with error:', error);
            throw error;
        } finally {
            this.releaseLock();
        }
    }

    /**
     * Checks if sync is currently locked
     */
    isLocked(): boolean {
        return this.syncInProgress;
    }

    /**
     * Forces release of the lock (use with caution)
     */
    forceRelease(): void {
        console.warn('🔒 Auth sync: Force releasing sync lock');
        this.releaseLock();
    }

    private acquireLock(): void {
        this.syncInProgress = true;

        // Set timeout to automatically release lock if operation hangs
        this.lockTimeout = setTimeout(() => {
            console.warn('🔒 Auth sync: Lock timeout reached, force releasing');
            this.releaseLock();
        }, this.LOCK_TIMEOUT_MS);

        console.log('🔒 Auth sync: Lock acquired');
    }

    private releaseLock(): void {
        this.syncInProgress = false;

        if (this.lockTimeout) {
            clearTimeout(this.lockTimeout);
            this.lockTimeout = null;
        }

        console.log('🔒 Auth sync: Lock released');
    }
}

// Singleton instance
const authSyncLock = new AuthSyncLock();

/**
 * Hook to get sync lock manager
 */
export const useAuthSyncLock = (): SyncLockManager => {
    return {
        withSyncLock: authSyncLock.withSyncLock.bind(authSyncLock),
        isLocked: authSyncLock.isLocked.bind(authSyncLock),
        forceRelease: authSyncLock.forceRelease.bind(authSyncLock),
    };
};

export default authSyncLock;