import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '@/utils/logger';

/**
 * Hook to handle authentication redirects
 * Implements requirement 6.2
 */
export const useAuthRedirect = () => {
    const { logout } = useAuth();

    useEffect(() => {
        const handleAuthRedirect = () => {
            const currentPath = window.location.pathname;
            const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;

            console.log('🔒 LOGIN REDIRECT TRIGGERED by useAuthRedirect Hook:', {
                component: 'useAuthRedirect',
                reason: 'auth:redirect-to-login event received',
                conditions: {
                    eventTriggered: true,
                    currentPath: currentPath
                },
                redirectTo: loginUrl,
                timestamp: new Date().toISOString(),
                stackTrace: new Error().stack
            });

            logger.info('Authentication redirect triggered, logging out user');

            // Clear authentication state
            logout();

            // Use replace to prevent back button issues
            window.location.replace(loginUrl);
        };

        // Listen for auth redirect events
        window.addEventListener('auth:redirect-to-login', handleAuthRedirect);

        return () => {
            window.removeEventListener('auth:redirect-to-login', handleAuthRedirect);
        };
    }, [logout]);
};

/**
 * Trigger authentication redirect
 */
export const triggerAuthRedirect = () => {
    window.dispatchEvent(new CustomEvent('auth:redirect-to-login'));
};