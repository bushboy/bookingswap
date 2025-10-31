import { AppDispatch } from '@/store';
import {
    addIncomingTarget,
    removeIncomingTarget,
    updateIncomingTarget,
    setOutgoingTarget,
    removeOutgoingTarget,
    updateOutgoingTarget,
    addTargetingEvent,
} from '@/store/slices/targetingSlice';
import { addNotification } from '@/store/slices/notificationSlice';

interface OptimisticUpdate {
    id: string;
    type: 'create_target' | 'accept_target' | 'reject_target' | 'cancel_target' | 'retarget';
    swapId: string;
    targetId?: string;
    originalState?: any;
    timestamp: Date;
}

interface TargetingActionOptions {
    enableOptimisticUpdates?: boolean;
    showLoadingStates?: boolean;
    retryOnFailure?: boolean;
    maxRetries?: number;
}

export class TargetingActionsService {
    private dispatch: AppDispatch;
    private pendingUpdates: Map<string, OptimisticUpdate> = new Map();
    private retryAttempts: Map<string, number> = new Map();

    constructor(dispatch: AppDispatch) {
        this.dispatch = dispatch;
    }

    /**
     * Create a targeting proposal with optimistic updates
     */
    async createTargetingProposal(
        sourceSwapId: string,
        targetSwapId: string,
        options: TargetingActionOptions = {}
    ): Promise<{ success: boolean; targetId?: string; error?: string }> {
        const {
            enableOptimisticUpdates = true,
            showLoadingStates = true,
            retryOnFailure = true,
            maxRetries = 3,
        } = options;

        const optimisticId = `create_${sourceSwapId}_${targetSwapId}_${Date.now()}`;
        const targetId = `temp_${optimisticId}`;

        try {
            // Apply optimistic update
            if (enableOptimisticUpdates) {
                await this.applyOptimisticTargetingCreation(sourceSwapId, targetSwapId, targetId, optimisticId);
            }

            // Show loading state
            if (showLoadingStates) {
                this.dispatch(addNotification({
                    id: `loading_${optimisticId}`,
                    type: 'info',
                    title: 'Creating targeting proposal...',
                    message: 'Your targeting request is being processed',
                    timestamp: new Date(),
                    read: false,
                    category: 'targeting',
                    autoHide: true,
                    hideAfter: 3000,
                }));
            }

            // Make API call (simulated for now)
            const result = await this.makeTargetingApiCall('create', {
                sourceSwapId,
                targetSwapId,
            });

            if (result.success) {
                // Replace optimistic update with real data
                if (enableOptimisticUpdates) {
                    await this.confirmOptimisticUpdate(optimisticId, result.data);
                }

                this.dispatch(addNotification({
                    id: `success_${optimisticId}`,
                    type: 'success',
                    title: 'Targeting proposal created!',
                    message: 'Your targeting request has been sent successfully',
                    timestamp: new Date(),
                    read: false,
                    category: 'targeting',
                    autoHide: true,
                    hideAfter: 5000,
                }));

                return { success: true, targetId: result.data.targetId };
            } else {
                throw new Error(result.error || 'Failed to create targeting proposal');
            }
        } catch (error) {
            // Rollback optimistic update
            if (enableOptimisticUpdates) {
                await this.rollbackOptimisticUpdate(optimisticId);
            }

            // Handle retry logic
            if (retryOnFailure && this.shouldRetry(optimisticId, maxRetries)) {
                this.dispatch(addNotification({
                    id: `retry_${optimisticId}`,
                    type: 'warning',
                    title: 'Retrying targeting proposal...',
                    message: 'The request failed, retrying automatically',
                    timestamp: new Date(),
                    read: false,
                    category: 'targeting',
                    autoHide: true,
                    hideAfter: 3000,
                }));

                // Retry after a delay
                setTimeout(() => {
                    this.createTargetingProposal(sourceSwapId, targetSwapId, options);
                }, 2000);

                return { success: false, error: 'Retrying...' };
            }

            this.dispatch(addNotification({
                id: `error_${optimisticId}`,
                type: 'error',
                title: 'Failed to create targeting proposal',
                message: error instanceof Error ? error.message : 'An unexpected error occurred',
                timestamp: new Date(),
                read: false,
                category: 'targeting',
                autoHide: true,
                hideAfter: 8000,
            }));

            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Accept a targeting proposal with optimistic updates
     */
    async acceptTargetingProposal(
        swapId: string,
        targetId: string,
        proposalId: string,
        options: TargetingActionOptions = {}
    ): Promise<{ success: boolean; error?: string }> {
        const {
            enableOptimisticUpdates = true,
            showLoadingStates = true,
            retryOnFailure = true,
            maxRetries = 3,
        } = options;

        const optimisticId = `accept_${targetId}_${Date.now()}`;

        try {
            // Apply optimistic update
            if (enableOptimisticUpdates) {
                await this.applyOptimisticTargetingAcceptance(swapId, targetId, optimisticId);
            }

            // Show loading state
            if (showLoadingStates) {
                this.dispatch(addNotification({
                    id: `loading_${optimisticId}`,
                    type: 'info',
                    title: 'Accepting targeting proposal...',
                    message: 'Processing your acceptance',
                    timestamp: new Date(),
                    read: false,
                    category: 'targeting',
                    autoHide: true,
                    hideAfter: 3000,
                }));
            }

            // Make API call
            const result = await this.makeTargetingApiCall('accept', {
                targetId,
                proposalId,
            });

            if (result.success) {
                // Confirm optimistic update
                if (enableOptimisticUpdates) {
                    await this.confirmOptimisticUpdate(optimisticId, result.data);
                }

                this.dispatch(addNotification({
                    id: `success_${optimisticId}`,
                    type: 'success',
                    title: 'Targeting proposal accepted!',
                    message: 'The targeting proposal has been accepted successfully',
                    timestamp: new Date(),
                    read: false,
                    category: 'targeting',
                    autoHide: true,
                    hideAfter: 5000,
                }));

                return { success: true };
            } else {
                throw new Error(result.error || 'Failed to accept targeting proposal');
            }
        } catch (error) {
            // Rollback optimistic update
            if (enableOptimisticUpdates) {
                await this.rollbackOptimisticUpdate(optimisticId);
            }

            // Handle retry logic
            if (retryOnFailure && this.shouldRetry(optimisticId, maxRetries)) {
                setTimeout(() => {
                    this.acceptTargetingProposal(swapId, targetId, proposalId, options);
                }, 2000);
                return { success: false, error: 'Retrying...' };
            }

            this.dispatch(addNotification({
                id: `error_${optimisticId}`,
                type: 'error',
                title: 'Failed to accept targeting proposal',
                message: error instanceof Error ? error.message : 'An unexpected error occurred',
                timestamp: new Date(),
                read: false,
                category: 'targeting',
                autoHide: true,
                hideAfter: 8000,
            }));

            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Reject a targeting proposal with optimistic updates
     */
    async rejectTargetingProposal(
        swapId: string,
        targetId: string,
        proposalId: string,
        reason?: string,
        options: TargetingActionOptions = {}
    ): Promise<{ success: boolean; error?: string }> {
        const {
            enableOptimisticUpdates = true,
            showLoadingStates = true,
            retryOnFailure = true,
            maxRetries = 3,
        } = options;

        const optimisticId = `reject_${targetId}_${Date.now()}`;

        try {
            // Apply optimistic update
            if (enableOptimisticUpdates) {
                await this.applyOptimisticTargetingRejection(swapId, targetId, optimisticId, reason);
            }

            // Show loading state
            if (showLoadingStates) {
                this.dispatch(addNotification({
                    id: `loading_${optimisticId}`,
                    type: 'info',
                    title: 'Rejecting targeting proposal...',
                    message: 'Processing your rejection',
                    timestamp: new Date(),
                    read: false,
                    category: 'targeting',
                    autoHide: true,
                    hideAfter: 3000,
                }));
            }

            // Make API call
            const result = await this.makeTargetingApiCall('reject', {
                targetId,
                proposalId,
                reason,
            });

            if (result.success) {
                // Confirm optimistic update
                if (enableOptimisticUpdates) {
                    await this.confirmOptimisticUpdate(optimisticId, result.data);
                }

                this.dispatch(addNotification({
                    id: `success_${optimisticId}`,
                    type: 'info',
                    title: 'Targeting proposal rejected',
                    message: 'The targeting proposal has been rejected',
                    timestamp: new Date(),
                    read: false,
                    category: 'targeting',
                    autoHide: true,
                    hideAfter: 5000,
                }));

                return { success: true };
            } else {
                throw new Error(result.error || 'Failed to reject targeting proposal');
            }
        } catch (error) {
            // Rollback optimistic update
            if (enableOptimisticUpdates) {
                await this.rollbackOptimisticUpdate(optimisticId);
            }

            // Handle retry logic
            if (retryOnFailure && this.shouldRetry(optimisticId, maxRetries)) {
                setTimeout(() => {
                    this.rejectTargetingProposal(swapId, targetId, proposalId, reason, options);
                }, 2000);
                return { success: false, error: 'Retrying...' };
            }

            this.dispatch(addNotification({
                id: `error_${optimisticId}`,
                type: 'error',
                title: 'Failed to reject targeting proposal',
                message: error instanceof Error ? error.message : 'An unexpected error occurred',
                timestamp: new Date(),
                read: false,
                category: 'targeting',
                autoHide: true,
                hideAfter: 8000,
            }));

            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Cancel targeting with optimistic updates
     */
    async cancelTargeting(
        swapId: string,
        targetId: string,
        options: TargetingActionOptions = {}
    ): Promise<{ success: boolean; error?: string }> {
        const {
            enableOptimisticUpdates = true,
            showLoadingStates = true,
            retryOnFailure = true,
            maxRetries = 3,
        } = options;

        const optimisticId = `cancel_${targetId}_${Date.now()}`;

        try {
            // Apply optimistic update
            if (enableOptimisticUpdates) {
                await this.applyOptimisticTargetingCancellation(swapId, targetId, optimisticId);
            }

            // Show loading state
            if (showLoadingStates) {
                this.dispatch(addNotification({
                    id: `loading_${optimisticId}`,
                    type: 'info',
                    title: 'Cancelling targeting...',
                    message: 'Removing your targeting request',
                    timestamp: new Date(),
                    read: false,
                    category: 'targeting',
                    autoHide: true,
                    hideAfter: 3000,
                }));
            }

            // Make API call
            const result = await this.makeTargetingApiCall('cancel', {
                targetId,
            });

            if (result.success) {
                // Confirm optimistic update
                if (enableOptimisticUpdates) {
                    await this.confirmOptimisticUpdate(optimisticId, result.data);
                }

                this.dispatch(addNotification({
                    id: `success_${optimisticId}`,
                    type: 'info',
                    title: 'Targeting cancelled',
                    message: 'Your targeting request has been cancelled',
                    timestamp: new Date(),
                    read: false,
                    category: 'targeting',
                    autoHide: true,
                    hideAfter: 5000,
                }));

                return { success: true };
            } else {
                throw new Error(result.error || 'Failed to cancel targeting');
            }
        } catch (error) {
            // Rollback optimistic update
            if (enableOptimisticUpdates) {
                await this.rollbackOptimisticUpdate(optimisticId);
            }

            // Handle retry logic
            if (retryOnFailure && this.shouldRetry(optimisticId, maxRetries)) {
                setTimeout(() => {
                    this.cancelTargeting(swapId, targetId, options);
                }, 2000);
                return { success: false, error: 'Retrying...' };
            }

            this.dispatch(addNotification({
                id: `error_${optimisticId}`,
                type: 'error',
                title: 'Failed to cancel targeting',
                message: error instanceof Error ? error.message : 'An unexpected error occurred',
                timestamp: new Date(),
                read: false,
                category: 'targeting',
                autoHide: true,
                hideAfter: 8000,
            }));

            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    // Private helper methods

    private async applyOptimisticTargetingCreation(
        sourceSwapId: string,
        targetSwapId: string,
        targetId: string,
        optimisticId: string
    ): Promise<void> {
        // Store original state for rollback
        const optimisticUpdate: OptimisticUpdate = {
            id: optimisticId,
            type: 'create_target',
            swapId: sourceSwapId,
            targetId,
            timestamp: new Date(),
        };

        this.pendingUpdates.set(optimisticId, optimisticUpdate);

        // Apply optimistic outgoing target
        this.dispatch(setOutgoingTarget({
            swapId: sourceSwapId,
            targetInfo: {
                targetId,
                targetSwapId,
                targetSwap: {
                    id: targetSwapId,
                    title: 'Loading...',
                    ownerName: 'Loading...',
                },
                status: 'active',
                createdAt: new Date(),
            },
        }));

        // Add targeting event
        this.dispatch(addTargetingEvent({
            swapId: sourceSwapId,
            event: {
                id: `optimistic_${optimisticId}`,
                type: 'targeting_created',
                timestamp: new Date(),
                data: {
                    targetId,
                    targetSwapId,
                    optimistic: true,
                },
            },
        }));
    }

    private async applyOptimisticTargetingAcceptance(
        swapId: string,
        targetId: string,
        optimisticId: string
    ): Promise<void> {
        const optimisticUpdate: OptimisticUpdate = {
            id: optimisticId,
            type: 'accept_target',
            swapId,
            targetId,
            timestamp: new Date(),
        };

        this.pendingUpdates.set(optimisticId, optimisticUpdate);

        // Update incoming target status
        this.dispatch(updateIncomingTarget({
            swapId,
            targetId,
            updates: {
                status: 'accepted',
                updatedAt: new Date(),
            },
        }));

        // Add targeting event
        this.dispatch(addTargetingEvent({
            swapId,
            event: {
                id: `optimistic_${optimisticId}`,
                type: 'targeting_accepted',
                timestamp: new Date(),
                data: {
                    targetId,
                    optimistic: true,
                },
            },
        }));
    }

    private async applyOptimisticTargetingRejection(
        swapId: string,
        targetId: string,
        optimisticId: string,
        reason?: string
    ): Promise<void> {
        const optimisticUpdate: OptimisticUpdate = {
            id: optimisticId,
            type: 'reject_target',
            swapId,
            targetId,
            timestamp: new Date(),
        };

        this.pendingUpdates.set(optimisticId, optimisticUpdate);

        // Remove incoming target
        this.dispatch(removeIncomingTarget({
            swapId,
            targetId,
        }));

        // Add targeting event
        this.dispatch(addTargetingEvent({
            swapId,
            event: {
                id: `optimistic_${optimisticId}`,
                type: 'targeting_rejected',
                timestamp: new Date(),
                data: {
                    targetId,
                    reason,
                    optimistic: true,
                },
            },
        }));
    }

    private async applyOptimisticTargetingCancellation(
        swapId: string,
        targetId: string,
        optimisticId: string
    ): Promise<void> {
        const optimisticUpdate: OptimisticUpdate = {
            id: optimisticId,
            type: 'cancel_target',
            swapId,
            targetId,
            timestamp: new Date(),
        };

        this.pendingUpdates.set(optimisticId, optimisticUpdate);

        // Remove outgoing target
        this.dispatch(removeOutgoingTarget({
            swapId,
            targetId,
        }));

        // Add targeting event
        this.dispatch(addTargetingEvent({
            swapId,
            event: {
                id: `optimistic_${optimisticId}`,
                type: 'targeting_cancelled',
                timestamp: new Date(),
                data: {
                    targetId,
                    optimistic: true,
                },
            },
        }));
    }

    private async confirmOptimisticUpdate(optimisticId: string, realData: any): Promise<void> {
        const update = this.pendingUpdates.get(optimisticId);
        if (!update) return;

        // Replace optimistic data with real data
        // This would typically involve updating the store with the real server response
        console.log('Confirming optimistic update:', optimisticId, realData);

        this.pendingUpdates.delete(optimisticId);
    }

    private async rollbackOptimisticUpdate(optimisticId: string): Promise<void> {
        const update = this.pendingUpdates.get(optimisticId);
        if (!update) return;

        console.log('Rolling back optimistic update:', optimisticId);

        // Rollback the optimistic changes based on the update type
        switch (update.type) {
            case 'create_target':
                if (update.targetId) {
                    this.dispatch(removeOutgoingTarget({
                        swapId: update.swapId,
                        targetId: update.targetId,
                    }));
                }
                break;
            case 'accept_target':
                if (update.targetId) {
                    this.dispatch(updateIncomingTarget({
                        swapId: update.swapId,
                        targetId: update.targetId,
                        updates: {
                            status: 'active',
                            updatedAt: new Date(),
                        },
                    }));
                }
                break;
            case 'reject_target':
                // Would need to restore the removed incoming target
                // This requires storing the original state
                break;
            case 'cancel_target':
                // Would need to restore the removed outgoing target
                // This requires storing the original state
                break;
        }

        this.pendingUpdates.delete(optimisticId);
    }

    private shouldRetry(optimisticId: string, maxRetries: number): boolean {
        const currentAttempts = this.retryAttempts.get(optimisticId) || 0;
        if (currentAttempts >= maxRetries) {
            this.retryAttempts.delete(optimisticId);
            return false;
        }

        this.retryAttempts.set(optimisticId, currentAttempts + 1);
        return true;
    }

    private async makeTargetingApiCall(
        action: string,
        data: any
    ): Promise<{ success: boolean; data?: any; error?: string }> {
        // Simulate API call with random success/failure
        return new Promise((resolve) => {
            setTimeout(() => {
                const success = Math.random() > 0.2; // 80% success rate for testing
                if (success) {
                    resolve({
                        success: true,
                        data: {
                            targetId: `real_${Date.now()}`,
                            ...data,
                        },
                    });
                } else {
                    resolve({
                        success: false,
                        error: `Failed to ${action} targeting: Network error`,
                    });
                }
            }, 1000 + Math.random() * 2000); // 1-3 second delay
        });
    }

    /**
     * Get pending optimistic updates
     */
    getPendingUpdates(): OptimisticUpdate[] {
        return Array.from(this.pendingUpdates.values());
    }

    /**
     * Clear all pending updates (useful for cleanup)
     */
    clearPendingUpdates(): void {
        this.pendingUpdates.clear();
        this.retryAttempts.clear();
    }
}

// Export singleton instance factory
export const createTargetingActionsService = (dispatch: AppDispatch) => {
    return new TargetingActionsService(dispatch);
};