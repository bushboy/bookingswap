import axios, { AxiosResponse } from 'axios';
import { IncomingTargetInfo } from '@booking-swap/shared';
import { FinancialDataHandler } from '../utils/financialDataHandler';

export interface ProposalActionResult {
    success: boolean;
    message?: string;
    error?: string;
    data?: any;
}

export interface AcceptProposalRequest {
    proposalId: string;
    targetId: string;
    swapId: string;
}

export interface RejectProposalRequest {
    proposalId: string;
    targetId: string;
    swapId: string;
    reason?: string;
}

export interface ProposalDetailsResponse {
    proposal: IncomingTargetInfo;
    canAccept: boolean;
    canReject: boolean;
    restrictions?: string[];
}

export interface UserProposal {
    id: string;
    bookingId: string;
    userId: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
    updatedAt: string;
    terms?: {
        additionalPayment?: number;
        conditions?: string[];
        expiresAt?: string;
    };
}

export interface ProposalStatus {
    bookingId: string;
    userId: string;
    status: 'none' | 'pending' | 'accepted' | 'rejected';
    proposalId?: string;
    lastUpdated?: string;
}

export interface CreateProposalRequest {
    bookingId: string;
    terms?: {
        additionalPayment?: number;
        conditions?: string[];
        message?: string;
    };
}

/**
 * Service for handling comprehensive proposal details and actions
 * Implements requirements 5.1, 5.2, 5.3, 5.4, 5.5 from the design document
 */
export class ProposalService {
    private baseURL: string;
    private axiosInstance;

    constructor() {
        this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
        this.axiosInstance = axios.create({
            baseURL: this.baseURL,
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor to add auth token
        this.axiosInstance.interceptors.request.use(
            config => {
                const token = localStorage.getItem('auth_token');
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            error => Promise.reject(error)
        );

        // Response interceptor for error handling
        this.axiosInstance.interceptors.response.use(
            response => response,
            error => {
                console.error('Proposal service error:', error);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Get comprehensive proposal details with all pertinent information
     * Requirements: 5.1, 5.2
     */
    async getProposalDetails(proposalId: string): Promise<ProposalDetailsResponse> {
        try {
            if (!proposalId || proposalId.trim().length === 0) {
                throw new Error('Proposal ID is required');
            }

            const response: AxiosResponse<{
                success: boolean;
                data: {
                    proposal: IncomingTargetInfo;
                    canAccept: boolean;
                    canReject: boolean;
                    restrictions?: string[];
                }
            }> = await this.axiosInstance.get(`/proposals/${proposalId}/details`);

            const proposalData = response.data.data;

            // Validate and sanitize financial data
            if (proposalData.proposal.sourceSwap.bookingDetails) {
                const bookingDetails = proposalData.proposal.sourceSwap.bookingDetails;

                // Ensure pricing is properly formatted
                if (bookingDetails.swapValue !== undefined) {
                    const formattedPrice = FinancialDataHandler.formatCurrency(
                        bookingDetails.swapValue,
                        (bookingDetails as any).currency || 'USD'
                    );

                    // Update the booking details with validated pricing
                    (bookingDetails as any).formattedPrice = formattedPrice;
                }
            }

            return proposalData;
        } catch (error: any) {
            console.error('Failed to get proposal details:', error);
            throw new Error(error.response?.data?.error?.message || 'Failed to retrieve proposal details');
        }
    }

    /**
     * Accept a targeting proposal with comprehensive validation
     * Requirements: 5.3, 5.4, 5.5
     */
    async acceptProposal(request: AcceptProposalRequest): Promise<ProposalActionResult> {
        try {
            if (!request.proposalId || request.proposalId.trim().length === 0) {
                throw new Error('Proposal ID is required');
            }

            if (!request.targetId || request.targetId.trim().length === 0) {
                throw new Error('Target ID is required');
            }

            if (!request.swapId || request.swapId.trim().length === 0) {
                throw new Error('Swap ID is required');
            }

            // First, get proposal details to ensure we have complete information
            const proposalDetails = await this.getProposalDetails(request.proposalId);

            if (!proposalDetails.canAccept) {
                throw new Error('This proposal cannot be accepted at this time');
            }

            // Get user ID from token - the backend extracts userId from the JWT token
            // So we don't need to explicitly pass it, but we need to use the correct proposal acceptance endpoint

            // Debug logging to track what we're sending
            console.log('ProposalService.acceptProposal - Request data:', {
                proposalId: request.proposalId,
                targetId: request.targetId,
                swapId: request.swapId,
                willPassSwapTargetId: !!request.targetId
            });

            const requestBody = {
                autoProcessPayment: true
            };

            // Only include swapTargetId if targetId is provided and not empty
            if (request.targetId && request.targetId.trim().length > 0) {
                (requestBody as any).swapTargetId = request.targetId;
                console.log('ProposalService.acceptProposal - Including swapTargetId:', request.targetId);
            } else {
                console.warn('ProposalService.acceptProposal - No targetId provided, swapTargetId will not be sent');
            }

            const response: AxiosResponse<{
                success: boolean;
                data: {
                    proposal: any;
                    swap?: any;
                    paymentTransaction?: any;
                    blockchain: any;
                }
            }> = await this.axiosInstance.post(`/proposals/${request.proposalId}/accept`, requestBody);

            return {
                success: true,
                message: `Proposal from ${proposalDetails.proposal.sourceSwap.ownerName} accepted successfully`,
                data: response.data.data
            };
        } catch (error: any) {
            console.error('Failed to accept proposal:', error);
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message || 'Failed to accept proposal'
            };
        }
    }

    /**
     * Reject a targeting proposal with comprehensive validation
     * Requirements: 5.3, 5.4, 5.5
     */
    async rejectProposal(request: RejectProposalRequest): Promise<ProposalActionResult> {
        try {
            if (!request.proposalId || request.proposalId.trim().length === 0) {
                throw new Error('Proposal ID is required');
            }

            if (!request.targetId || request.targetId.trim().length === 0) {
                throw new Error('Target ID is required');
            }

            if (!request.swapId || request.swapId.trim().length === 0) {
                throw new Error('Swap ID is required');
            }

            // First, get proposal details to ensure we have complete information
            const proposalDetails = await this.getProposalDetails(request.proposalId);

            if (!proposalDetails.canReject) {
                throw new Error('This proposal cannot be rejected at this time');
            }

            // Debug logging to track what we're sending
            console.log('ProposalService.rejectProposal - Request data:', {
                proposalId: request.proposalId,
                targetId: request.targetId,
                swapId: request.swapId,
                reason: request.reason,
                willPassSwapTargetId: !!request.targetId
            });

            const requestBody = {
                reason: request.reason || 'Proposal rejected by user'
            };

            // Only include swapTargetId if targetId is provided and not empty
            if (request.targetId && request.targetId.trim().length > 0) {
                (requestBody as any).swapTargetId = request.targetId;
                console.log('ProposalService.rejectProposal - Including swapTargetId:', request.targetId);
            } else {
                console.warn('ProposalService.rejectProposal - No targetId provided, swapTargetId will not be sent');
            }

            // Use the correct proposal rejection endpoint
            const response: AxiosResponse<{
                success: boolean;
                data: {
                    proposal: any;
                    blockchain: any;
                }
            }> = await this.axiosInstance.post(`/proposals/${request.proposalId}/reject`, requestBody);

            return {
                success: true,
                message: `Proposal from ${proposalDetails.proposal.sourceSwap.ownerName} rejected successfully`,
                data: response.data.data
            };
        } catch (error: any) {
            console.error('Failed to reject proposal:', error);
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message || 'Failed to reject proposal'
            };
        }
    }

    /**
     * Get all proposals for a specific swap with complete details
     * Requirements: 5.1, 5.2
     */
    async getSwapProposals(swapId: string): Promise<IncomingTargetInfo[]> {
        try {
            if (!swapId || swapId.trim().length === 0) {
                throw new Error('Swap ID is required');
            }

            const response: AxiosResponse<{
                success: boolean;
                data: {
                    proposals: IncomingTargetInfo[];
                }
            }> = await this.axiosInstance.get(`/swaps/${swapId}/proposals`);

            const proposals = response.data.data.proposals || [];

            // Validate and sanitize financial data for all proposals
            return proposals.map(proposal => {
                if (proposal.sourceSwap.bookingDetails) {
                    const bookingDetails = proposal.sourceSwap.bookingDetails;

                    // Ensure pricing is properly formatted
                    if (bookingDetails.swapValue !== undefined) {
                        const formattedPrice = FinancialDataHandler.formatCurrency(
                            bookingDetails.swapValue,
                            (bookingDetails as any).currency || 'USD'
                        );

                        // Update the booking details with validated pricing
                        (bookingDetails as any).formattedPrice = formattedPrice;
                    }
                }
                return proposal;
            });
        } catch (error: any) {
            console.error('Failed to get swap proposals:', error);
            throw new Error(error.response?.data?.error?.message || 'Failed to retrieve swap proposals');
        }
    }

    /**
     * Validate proposal action permissions
     * Requirements: 5.4
     */
    async validateProposalAction(
        proposalId: string,
        action: 'accept' | 'reject'
    ): Promise<{ canPerform: boolean; restrictions?: string[] }> {
        try {
            const response: AxiosResponse<{
                success: boolean;
                data: {
                    canPerform: boolean;
                    restrictions?: string[];
                }
            }> = await this.axiosInstance.get(`/proposals/${proposalId}/validate-action`, {
                params: { action }
            });

            return response.data.data;
        } catch (error: any) {
            console.error('Failed to validate proposal action:', error);
            return {
                canPerform: false,
                restrictions: ['Unable to validate action permissions']
            };
        }
    }

    /**
     * Get all proposals for a specific user
     * Requirements: 3.3, 4.1, 4.2, 4.3
     */
    async getUserProposals(userId: string): Promise<UserProposal[]> {
        try {
            if (!userId || userId.trim().length === 0) {
                throw new Error('User ID is required');
            }

            const response: AxiosResponse<{
                success: boolean;
                data: UserProposal[];
            }> = await this.axiosInstance.get(`/proposals/user/${userId}`);

            return response.data.data || [];
        } catch (error: any) {
            console.error('Failed to get user proposals:', error);

            // Handle 404 cases when no proposals exist
            if (error.response?.status === 404) {
                return [];
            }

            throw new Error(error.response?.data?.error?.message || 'Failed to retrieve user proposals');
        }
    }

    /**
     * Get proposal status for a specific booking and user
     * Requirements: 3.3, 4.1, 4.2, 4.3
     */
    async getProposalStatus(bookingId: string, userId: string): Promise<ProposalStatus> {
        try {
            if (!bookingId || bookingId.trim().length === 0) {
                throw new Error('Booking ID is required');
            }

            if (!userId || userId.trim().length === 0) {
                throw new Error('User ID is required');
            }

            const response: AxiosResponse<{
                success: boolean;
                data: ProposalStatus;
            }> = await this.axiosInstance.get(`/proposals/status`, {
                params: { bookingId, userId }
            });

            return response.data.data;
        } catch (error: any) {
            console.error('Failed to get proposal status:', error);

            // Handle 404 cases when no proposal exists
            if (error.response?.status === 404) {
                return {
                    bookingId,
                    userId,
                    status: 'none'
                };
            }

            throw new Error(error.response?.data?.error?.message || 'Failed to retrieve proposal status');
        }
    }

    /**
     * Create a new proposal for a booking
     * Requirements: 3.3, 4.1
     */
    async createProposal(request: CreateProposalRequest): Promise<UserProposal> {
        try {
            if (!request.bookingId || request.bookingId.trim().length === 0) {
                throw new Error('Booking ID is required');
            }

            const response: AxiosResponse<{
                success: boolean;
                data: UserProposal;
            }> = await this.axiosInstance.post('/proposals', {
                bookingId: request.bookingId,
                terms: request.terms
            });

            return response.data.data;
        } catch (error: any) {
            console.error('Failed to create proposal:', error);
            throw new Error(error.response?.data?.error?.message || 'Failed to create proposal');
        }
    }
}

// Create and export singleton instance
export const proposalService = new ProposalService();
export default proposalService;