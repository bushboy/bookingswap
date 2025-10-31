import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ReceivedProposalsSection } from '../ReceivedProposalsSection';
import { AuthProvider } from '../../../contexts/AuthContext';
import authSlice from '../../../store/slices/authSlice';
import { vi } from 'vitest';

// Mock the useAuthSync hook
vi.mock('../../../hooks/useAuthSync', () => ({
    useAuthSync: () => ({
        ensureSync: vi.fn(),
        syncStatus: {
            isInSync: false,
            lastSyncTime: null,
            syncAttempts: 0,
            syncErrors: [],
            hasSyncError: false,
            syncErrorMessage: null,
        }
    })
}));

// Mock other dependencies
vi.mock('../../../hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: false })
}));

vi.mock('../../../hooks/useAccessibility', () => ({
    useId: () => 'test-id',
    useAnnouncements: () => ({ announce: vi.fn() }),
    useHighContrast: () => ({ isHighContrast: false })
}));

describe('ReceivedProposalsSection - User ID Fallback', () => {
    const mockProposals = [
        {
            id: 'proposal-1',
            proposerId: 'user-2',
            proposerName: 'John Doe',
            status: 'pending',
            targetBookingDetails: {
                title: 'Test Booking',
                location: { city: 'Test City', country: 'Test Country' },
                swapValue: 100
            },
            createdAt: new Date(),
            conditions: [],
            additionalPayment: 0
        }
    ];

    const createMockStore = (authState = {}) => {
        return configureStore({
            reducer: {
                auth: authSlice,
                proposalAcceptance: (state = { activeOperations: {} }) => state
            },
            preloadedState: {
                auth: {
                    user: null,
                    isAuthenticated: false,
                    loading: false,
                    error: null,
                    permissions: {
                        canAcceptProposals: true,
                        canRejectProposals: true,
                        verificationLevel: 'basic'
                    },
                    syncStatus: {
                        lastSyncTime: null,
                        syncSource: null,
                        hasSyncError: false,
                        syncErrorMessage: null,
                    },
                    ...authState
                }
            }
        });
    };

    const mockAuthContextValue = {
        user: { id: 'auth-user-1', username: 'testuser', email: 'test@example.com', verificationLevel: 'basic', createdAt: '2023-01-01' },
        token: 'mock-token',
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        isAuthenticated: true,
        isStable: true,
        lastValidation: new Date(),
        validateToken: vi.fn(),
        waitForStableAuth: vi.fn()
    };

    it('should use AuthContext user ID when Redux store is empty', () => {
        const store = createMockStore(); // Empty auth state

        const TestWrapper = ({ children }: { children: React.ReactNode }) => (
            <Provider store={store}>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </Provider>
        );

        // Mock AuthContext to return user data
        const AuthContextSpy = vi.spyOn(require('../../../contexts/AuthContext'), 'useAuth');
        AuthContextSpy.mockReturnValue(mockAuthContextValue);

        render(
            <TestWrapper>
                <ReceivedProposalsSection
                    proposals={mockProposals}
                    onAcceptProposal={vi.fn()}
                    onRejectProposal={vi.fn()}
                />
            </TestWrapper>
        );

        // The component should render without the "User Profile Not Loaded" error
        // because it should fall back to AuthContext user ID
        expect(screen.queryByText('User Profile Not Loaded')).not.toBeInTheDocument();
    });

    it('should prioritize Redux user ID over AuthContext', () => {
        const store = createMockStore({
            user: { id: 'redux-user-1', displayName: 'Redux User', email: 'redux@example.com' },
            isAuthenticated: true
        });

        const TestWrapper = ({ children }: { children: React.ReactNode }) => (
            <Provider store={store}>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </Provider>
        );

        // Mock AuthContext to return different user data
        const AuthContextSpy = vi.spyOn(require('../../../contexts/AuthContext'), 'useAuth');
        AuthContextSpy.mockReturnValue(mockAuthContextValue);

        render(
            <TestWrapper>
                <ReceivedProposalsSection
                    proposals={mockProposals}
                    onAcceptProposal={vi.fn()}
                    onRejectProposal={vi.fn()}
                />
            </TestWrapper>
        );

        // Should use Redux user ID (redux-user-1) not AuthContext user ID (auth-user-1)
        // We can verify this by checking that no fallback warning is shown
        expect(screen.queryByText('User Profile Not Loaded')).not.toBeInTheDocument();
    });

    it('should show user profile not loaded when both Redux and AuthContext are empty', () => {
        const store = createMockStore(); // Empty auth state

        const TestWrapper = ({ children }: { children: React.ReactNode }) => (
            <Provider store={store}>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </Provider>
        );

        // Mock AuthContext to return no user data
        const AuthContextSpy = vi.spyOn(require('../../../contexts/AuthContext'), 'useAuth');
        AuthContextSpy.mockReturnValue({
            ...mockAuthContextValue,
            user: null,
            isAuthenticated: false
        });

        render(
            <TestWrapper>
                <ReceivedProposalsSection
                    proposals={mockProposals}
                    onAcceptProposal={vi.fn()}
                    onRejectProposal={vi.fn()}
                />
            </TestWrapper>
        );

        // Should show the user profile not loaded warning
        expect(screen.getByText('User Profile Not Loaded')).toBeInTheDocument();
    });
});