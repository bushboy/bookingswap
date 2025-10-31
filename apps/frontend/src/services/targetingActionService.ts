import { TargetingAction } from '../components/swap/targeting/TargetingDetails';

export interface TargetingActionResult {
    success: boolean;
    message?: string;
    error?: string;
    data?: any;
}

export interface AcceptTargetRequest {
    targetId: string;
    proposalId: string;
    swapId: string;
}

export interface RejectTargetRequest {
    targetId: string;
    proposalId: string;
    swapId: string;
    reason?: string;
}

export interface RetargetRequest {
    sourceSwapId: string;
    currentTargetId: string;
    newTargetSwapId?: string; // Optional - if not provided, will open target browser
}

export interface CancelTargetingRequest {
    sourceSwapId: string;
    targetId: string;
}

/**
 * Service for handling targeting actions
 * Integrates with SwapTargetingService backend endpoints
 * Requirements: 5.4, 5.5, 5.6, 5.7
 */
export class TargetingActionService {
    private baseUrl: string;

    constructor(baseUrl: string = '/api') {
        this.baseUrl = baseUrl;
    }

    /**
     * Accept an incoming targeting proposal
     * Requirements: 5.1, 5.5
     */
    async acceptTarget(request: AcceptTargetRequest): Promise<TargetingActionResult> {
        try {
            // Get auth token from localStorage
            const token = localStorage.getItem('auth_token');
            if (!token) {
                throw new Error('Authentication required');
            }

            // Use the correct swap acceptance endpoint
            const response = await fetch(`${this.baseUrl}/swaps/${request.proposalId}/accept`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    targetId: request.targetId,
                    swapId: request.swapId
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            return {
                success: true,
                message: 'Targeting proposal accepted successfully',
                data: data.data
            };
        } catch (error) {
            console.error('Failed to accept target:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to accept targeting proposal'
            };
        }
    }

    /**
     * Reject an incoming targeting proposal
     * Requirements: 5.1, 5.5
     */
    async rejectTarget(request: RejectTargetRequest): Promise<TargetingActionResult> {
        try {
            // Get auth token from localStorage
            const token = localStorage.getItem('auth_token');
            if (!token) {
                throw new Error('Authentication required');
            }

            // Use the correct swap rejection endpoint
            const response = await fetch(`${this.baseUrl}/swaps/${request.proposalId}/reject`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    targetId: request.targetId,
                    swapId: request.swapId,
                    reason: request.reason || 'Targeting proposal rejected'
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            return {
                success: true,
                message: 'Targeting proposal rejected successfully',
                data: data.data
            };
        } catch (error) {
            console.error('Failed to reject target:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to reject targeting proposal'
            };
        }
    }

    /**
     * Retarget a swap to a different target
     * Requirements: 5.2, 5.5
     */
    async retargetSwap(request: RetargetRequest): Promise<TargetingActionResult> {
        try {
            if (request.newTargetSwapId) {
                // Direct retargeting to a specific swap
                const response = await fetch(`${this.baseUrl}/swaps/${request.newTargetSwapId}/retarget`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        sourceSwapId: request.sourceSwapId
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                return {
                    success: true,
                    message: 'Swap retargeted successfully',
                    data
                };
            } else {
                // Cancel current targeting to allow browsing for new target
                const cancelResult = await this.cancelTargeting({
                    sourceSwapId: request.sourceSwapId,
                    targetId: request.currentTargetId
                });

                if (!cancelResult.success) {
                    return cancelResult;
                }

                return {
                    success: true,
                    message: 'Current targeting cancelled. You can now browse for a new target.',
                    data: {
                        action: 'browse_targets',
                        sourceSwapId: request.sourceSwapId
                    }
                };
            }
        } catch (error) {
            console.error('Failed to retarget swap:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to retarget swap'
            };
        }
    }

    /**
     * Cancel targeting for a swap
     * Requirements: 5.2, 5.5
     */
    async cancelTargeting(request: CancelTargetingRequest): Promise<TargetingActionResult> {
        try {
            const response = await fetch(`${this.baseUrl}/swaps/${request.sourceSwapId}/target`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    sourceSwapId: request.sourceSwapId,
                    targetId: request.targetId
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            return {
                success: true,
                message: 'Targeting cancelled successfully',
                data
            };
        } catch (error) {
            console.error('Failed to cancel targeting:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to cancel targeting'
            };
        }
    }

    /**
     * Get available swaps for targeting
     * Requirements: 5.3
     */
    async getAvailableTargets(sourceSwapId: string): Promise<TargetingActionResult> {
        try {
            const response = await fetch(`${this.baseUrl}/swaps/browse?excludeOwn=true&status=pending&sourceSwapId=${sourceSwapId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            return {
                success: true,
                message: 'Available targets retrieved successfully',
                data: data.swaps || []
            };
        } catch (error) {
            console.error('Failed to get available targets:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get available targets'
            };
        }
    }

    /**
     * Check if a swap can be targeted
     * Requirements: 5.4
     */
    async canTargetSwap(targetSwapId: string): Promise<TargetingActionResult> {
        try {
            const response = await fetch(`${this.baseUrl}/swaps/${targetSwapId}/can-target`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            return {
                success: true,
                data: data.data || { canTarget: false }
            };
        } catch (error) {
            console.error('Failed to check targeting eligibility:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to check targeting eligibility'
            };
        }
    }

    /**
     * Execute a targeting action based on the action type
     * Requirements: 5.5, 5.6, 5.7
     */
    async executeAction(action: TargetingAction): Promise<TargetingActionResult> {
        switch (action.type) {
            case 'accept_target':
                if (!action.metadata?.proposalId) {
                    return {
                        success: false,
                        error: 'Proposal ID is required for accepting targets'
                    };
                }
                return this.acceptTarget({
                    targetId: action.targetId!,
                    proposalId: action.metadata.proposalId,
                    swapId: action.swapId
                });

            case 'reject_target':
                if (!action.metadata?.proposalId) {
                    return {
                        success: false,
                        error: 'Proposal ID is required for rejecting targets'
                    };
                }
                return this.rejectTarget({
                    targetId: action.targetId!,
                    proposalId: action.metadata.proposalId,
                    swapId: action.swapId,
                    reason: action.metadata?.reason
                });

            case 'retarget':
                return this.retargetSwap({
                    sourceSwapId: action.swapId,
                    currentTargetId: action.targetId!,
                    newTargetSwapId: action.metadata?.newTargetSwapId
                });

            case 'cancel_targeting':
                return this.cancelTargeting({
                    sourceSwapId: action.swapId,
                    targetId: action.targetId!
                });

            default:
                return {
                    success: false,
                    error: `Unknown action type: ${action.type}`
                };
        }
    }
}

// Export singleton instance
export const targetingActionService = new TargetingActionService();