import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '@/utils/logger';
import { handleAuthError } from '@/services/authErrorHandler';
import { createErrorContext, createTargetingErrorContext } from '@/types/authError';
import {
    getTargetingErrorInfo,
    shouldTargetingErrorTriggerLogout,
    logTargetingError
} from '@/utils/targetingErrorUtils';

class ApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Enhanced request interceptor with targeting operation identification
        this.client.interceptors.request.use(
            (config) => {
                // Add auth token if available
                const token = localStorage.getItem('auth_token');
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }

                // Identify targeting operations and add metadata
                const url = config.url || '';
                const method = config.method || 'GET';
                const isTargetingRequest = this.isTargetingRequest(url);

                if (isTargetingRequest) {
                    const operation = this.getTargetingOperation(url, method);

                    // Add targeting-specific headers
                    config.headers['X-Targeting-Operation'] = operation;
                    config.headers['X-Targeting-Request'] = 'true';

                    // Add swap IDs if available
                    const swapId = this.extractSwapId(url);
                    const targetSwapId = this.extractTargetSwapId(url) || config.params?.targetSwapId;

                    if (swapId) {
                        config.headers['X-Source-Swap-Id'] = swapId;
                    }
                    if (targetSwapId) {
                        config.headers['X-Target-Swap-Id'] = targetSwapId;
                    }

                    logger.debug('Targeting API Request', {
                        method: config.method,
                        url: config.url,
                        operation,
                        swapId,
                        targetSwapId,
                        params: config.params
                    });
                } else {
                    logger.debug('API Request', {
                        method: config.method,
                        url: config.url,
                        params: config.params
                    });
                }

                return config;
            },
            (error) => {
                logger.error('API Request Error', { error: error.message });
                return Promise.reject(error);
            }
        );

        // Enhanced response interceptor with targeting-aware error handling
        this.client.interceptors.response.use(
            (response) => {
                const url = response.config.url || '';
                const isTargetingRequest = this.isTargetingRequest(url);

                if (isTargetingRequest) {
                    logger.debug('Targeting API Response', {
                        status: response.status,
                        url: response.config.url,
                        operation: response.config.headers?.['X-Targeting-Operation'],
                        preservedAuth: response.headers?.['x-preserves-main-auth']
                    });
                } else {
                    logger.debug('API Response', {
                        status: response.status,
                        url: response.config.url
                    });
                }

                return response;
            },
            async (error) => {
                const url = error.config?.url || '';
                const method = error.config?.method || 'GET';
                const isTargetingRequest = this.isTargetingRequest(url);
                const operation = isTargetingRequest ? this.getTargetingOperation(url, method) : undefined;

                // Enhanced error logging for targeting operations
                if (isTargetingRequest) {
                    logger.error('Targeting API Response Error', {
                        status: error.response?.status,
                        message: error.message,
                        url: error.config?.url,
                        operation,
                        isTargetingRelated: error.response?.data?.error?.isTargetingRelated,
                        preservesMainAuth: error.response?.data?.error?.preservesMainAuth,
                        targetingErrorCode: error.response?.headers?.['x-targeting-auth-error']
                    });
                } else {
                    logger.error('API Response Error', {
                        status: error.response?.status,
                        message: error.message,
                        url: error.config?.url
                    });
                }

                // Create appropriate error context
                const context = isTargetingRequest
                    ? createTargetingErrorContext(url, this.extractSwapId(url), this.extractTargetSwapId(url))
                    : createErrorContext(url, 'api_request');

                // Enhanced error handling using targeting error utilities
                const targetingErrorInfo = getTargetingErrorInfo(error);

                if (targetingErrorInfo.isTargetingError) {
                    // Log targeting error with appropriate level
                    logTargetingError(error, { operation, url });

                    // Handle authentication errors for targeting operations
                    if (error.response?.status === 401) {
                        if (targetingErrorInfo.preservesMainAuth) {
                            logger.warn('Targeting authentication error - preserving main session', {
                                url,
                                operation,
                                errorCode: targetingErrorInfo.errorCode,
                                preservesMainAuth: targetingErrorInfo.preservesMainAuth
                            });

                            // Add targeting-specific error information to the error object
                            error.isTargetingAuthError = true;
                            error.preservesMainAuth = true;
                            error.targetingOperation = operation;

                            return Promise.reject(error);
                        } else {
                            // Handle as genuine authentication failure
                            logger.error('Genuine authentication failure in targeting operation', {
                                url,
                                operation,
                                errorCode: targetingErrorInfo.errorCode
                            });
                        }
                    }

                    // Handle authorization errors for targeting operations
                    if (error.response?.status === 403) {
                        logger.warn('Targeting authorization error', {
                            url,
                            operation,
                            errorCode: targetingErrorInfo.errorCode,
                            errorCategory: targetingErrorInfo.errorCategory
                        });

                        // Add targeting-specific error information
                        error.isTargetingAuthorizationError = true;
                        error.targetingOperation = operation;
                        error.preservesMainAuth = targetingErrorInfo.preservesMainAuth;

                        return Promise.reject(error);
                    }
                }

                // Handle authentication errors with enhanced targeting awareness
                if (error.response?.status === 401) {
                    if (shouldTargetingErrorTriggerLogout(error)) {
                        // Clear auth and redirect for genuine auth failures
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('authToken');

                        console.log('🔒 LOGIN REDIRECT TRIGGERED by ApiClient (Targeting Auth Failure):', {
                            component: 'ApiClient',
                            reason: 'Targeting authentication failure that should trigger logout',
                            conditions: {
                                httpStatus: error.response?.status,
                                shouldTargetingErrorTriggerLogout: true,
                                isTargetingRequest: targetingErrorInfo.isTargetingError,
                                preservesMainAuth: targetingErrorInfo.preservesMainAuth
                            },
                            url,
                            redirectTo: '/login',
                            timestamp: new Date().toISOString()
                        });

                        logger.info('Authentication failure - redirecting to login', {
                            url,
                            isTargetingRequest: targetingErrorInfo.isTargetingError,
                            preservesMainAuth: targetingErrorInfo.preservesMainAuth
                        });

                        //window.location.href = '/login';
                    } else {
                        // Use existing auth error handler for non-targeting errors
                        const handlingResult = await handleAuthError(error, context);

                        if (handlingResult.shouldTriggerLogout) {
                            console.log('🔒 LOGIN REDIRECT TRIGGERED by ApiClient (Auth Error Handler):', {
                                component: 'ApiClient',
                                reason: 'Auth error handler determined logout required',
                                conditions: {
                                    httpStatus: error.response?.status,
                                    shouldTriggerLogout: handlingResult.shouldTriggerLogout,
                                    errorType: handlingResult.errorType,
                                    isTargetingError: handlingResult.isTargetingError,
                                    preserveAuthState: handlingResult.preserveAuthState
                                },
                                url,
                                redirectTo: '/login',
                                timestamp: new Date().toISOString()
                            });

                            localStorage.removeItem('auth_token');
                            localStorage.removeItem('authToken');
                            window.location.href = '/login';
                        } else {
                            logger.warn('Authentication error handled without logout', {
                                url,
                                isTargetingRequest: targetingErrorInfo.isTargetingError,
                                errorType: handlingResult.errorType
                            });
                        }
                    }
                }

                return Promise.reject(error);
            }
        );
    }

    async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.get<T>(url, config);
    }

    async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.post<T>(url, data, config);
    }

    async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.put<T>(url, data, config);
    }

    async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.patch<T>(url, data, config);
    }

    async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.client.delete<T>(url, config);
    }

    /**
     * Check if a request URL is targeting-related
     */
    private isTargetingRequest(url: string): boolean {
        const targetingPatterns = [
            '/targeting-status',
            '/target',
            '/retarget',
            '/validate-targeting',
            '/can-target',
            '/auction-eligibility',
            '/one-for-one-eligibility',
            '/targeting-history',
            '/targeting-activity',
            '/targeted-by'
        ];

        return targetingPatterns.some(pattern => url.includes(pattern));
    }

    /**
     * Determine the targeting operation type from URL and method
     */
    private getTargetingOperation(url: string, method: string): string {
        if (url.includes('/targeting-status')) return 'get_status';
        if (url.includes('/targeting-history')) return 'get_history';
        if (url.includes('/targeting-activity')) return 'get_history';
        if (url.includes('/targeted-by')) return 'get_history';
        if (url.includes('/can-target')) return 'validate';
        if (url.includes('/validate-targeting')) return 'validate';
        if (url.includes('/auction-eligibility')) return 'validate';
        if (url.includes('/one-for-one-eligibility')) return 'validate';

        if (url.includes('/target')) {
            if (method.toUpperCase() === 'POST') return 'target';
            if (method.toUpperCase() === 'DELETE') return 'remove_target';
        }
        if (url.includes('/retarget')) return 'retarget';

        return 'unknown';
    }

    /**
     * Extract swap ID from URL
     */
    private extractSwapId(url: string): string | undefined {
        const swapIdMatch = url.match(/\/swaps\/([^\/]+)/);
        return swapIdMatch ? swapIdMatch[1] : undefined;
    }

    /**
     * Extract target swap ID from URL parameters
     */
    private extractTargetSwapId(url: string): string | undefined {
        const targetSwapIdMatch = url.match(/targetSwapId=([^&]+)/);
        return targetSwapIdMatch ? targetSwapIdMatch[1] : undefined;
    }
}

export const apiClient = new ApiClient();
export default apiClient;