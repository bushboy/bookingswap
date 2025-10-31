import axios, { AxiosResponse } from 'axios';
import { User } from '@booking-swap/shared';
import { proposalCacheService } from './proposalCacheService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export interface UpdateWalletRequest {
    walletAddress: string;
}

export interface UserResponse {
    user: User;
}

export interface ProposalResponse {
    id: string;
    proposalId: string;
    action: 'accept' | 'reject';
    reason?: string;
    respondedAt: string;
    swapId?: string;
    paymentTransactionId?: string;
    blockchainTransactionId?: string;
}

export interface ProposalResponseHistoryResponse {
    responses: ProposalResponse[];
    totalCount: number;
    pagination?: {
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    };
}

export class UserService {
    private axiosInstance = axios.create({
        baseURL: API_BASE_URL,
        timeout: 10000,
    });

    constructor() {
        // Add request interceptor to include auth token
        this.axiosInstance.interceptors.request.use(
            (config) => {
                // Try both possible token keys for compatibility
                const token = localStorage.getItem('auth_token') || localStorage.getItem('authToken');
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        // Add response interceptor for error handling
        this.axiosInstance.interceptors.response.use(
            (response) => response,
            (error) => {
                // Don't automatically redirect on 401 errors for user service
                // Let the calling code handle authentication errors appropriately
                console.warn('UserService API error:', error.response?.status, error.response?.data);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Get current user profile
     */
    async getProfile(): Promise<User> {
        try {
            const response: AxiosResponse<UserResponse> = await this.axiosInstance.get('/users/profile');
            return response.data.user;
        } catch (error) {
            console.error('Failed to get user profile:', error);
            throw error;
        }
    }

    /**
     * Update user's wallet address
     */
    async updateWallet(walletAddress: string): Promise<User> {
        try {
            const request: UpdateWalletRequest = { walletAddress };
            const response: AxiosResponse<UserResponse> = await this.axiosInstance.put('/users/wallet', request);
            return response.data.user;
        } catch (error) {
            console.error('Failed to update wallet address:', error);
            throw error;
        }
    }

    /**
     * Get user's proposal response history
     * @param userId - The user's ID
     * @param page - Page number for pagination (optional)
     * @param limit - Number of items per page (optional)
     */
    async getProposalResponseHistory(
        userId: string,
        page?: number,
        limit?: number
    ): Promise<ProposalResponseHistoryResponse> {
        try {
            // Check cache first
            const cachedHistory = proposalCacheService.getProposalResponseHistory(userId, page, limit);
            if (cachedHistory) {
                return cachedHistory;
            }

            const params = new URLSearchParams();
            if (page !== undefined) params.append('page', page.toString());
            if (limit !== undefined) params.append('limit', limit.toString());

            const queryString = params.toString();
            const url = `/users/${userId}/proposal-responses${queryString ? `?${queryString}` : ''}`;

            const response: AxiosResponse<ProposalResponseHistoryResponse> = await this.axiosInstance.get(url);

            // Cache the response
            proposalCacheService.setProposalResponseHistory(userId, response.data, page, limit);

            return response.data;
        } catch (error) {
            console.error('Failed to get proposal response history:', error);
            throw error;
        }
    }

    /**
     * Get current user's proposal response history
     * @param page - Page number for pagination (optional)
     * @param limit - Number of items per page (optional)
     */
    async getCurrentUserProposalResponseHistory(
        page?: number,
        limit?: number
    ): Promise<ProposalResponseHistoryResponse> {
        try {
            // For current user, we use 'me' as the cache key
            const cachedHistory = proposalCacheService.getProposalResponseHistory('me', page, limit);
            if (cachedHistory) {
                return cachedHistory;
            }

            const params = new URLSearchParams();
            if (page !== undefined) params.append('page', page.toString());
            if (limit !== undefined) params.append('limit', limit.toString());

            const queryString = params.toString();
            const url = `/users/me/proposal-responses${queryString ? `?${queryString}` : ''}`;

            const response: AxiosResponse<ProposalResponseHistoryResponse> = await this.axiosInstance.get(url);

            // Cache the response using 'me' as the user ID
            proposalCacheService.setProposalResponseHistory('me', response.data, page, limit);

            return response.data;
        } catch (error) {
            console.error('Failed to get current user proposal response history:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const userService = new UserService();